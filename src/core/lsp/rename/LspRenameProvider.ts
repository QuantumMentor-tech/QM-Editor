/**
 * QM Editor LSP Rename Provider
 * Phase 06, Step 62 — LSP Rename, Prepare Rename & Safe Multi-File Workspace Edit Integration
 */

import {
  LspPrepareRenameRequest,
  PreparedRenameResult,
  LspRenameRequest,
  RenameValidationResult,
} from './LspRenameTypes';
import { LspServerManager, globalLspServerManager } from '../LspServerManager';
import { SettingsService } from '../../settings/SettingsService';
import { globalDocumentEngine, DocumentEngine } from '../../documents/DocumentEngine';
import { globalWorkspaceEngine } from '../../workspace';
import { LspUriMapper } from '../LspUriMapper';
import { LspLocationMapper } from '../navigation/LspLocationMapper';
import { LspWorkspaceEditValidator } from './LspWorkspaceEditValidator';
import { LspWorkspaceEditMapper } from './LspWorkspaceEditMapper';
import {
  LspPrepareRenameResponse,
  LspRenameResponse,
} from '../LspTypes';
import { WorkspaceEdit } from '../../language-intelligence/CodeActionTypes';
import { CancellationToken } from '../../symbols/SymbolTypes';
import { logger } from '../../../utils/logger';

export class LspRenameProvider {
  constructor(
    private readonly serverManager: LspServerManager = globalLspServerManager,
    private readonly docEngine: DocumentEngine = globalDocumentEngine,
    private readonly settingsService: SettingsService = SettingsService.getInstance()
  ) {}

  public isRenameEnabled(): boolean {
    const val = this.settingsService.get('lsp.rename.enabled');
    return val !== false;
  }

  public getInteractiveTimeoutMs(): number {
    const val = this.settingsService.get<number>('lsp.interactiveTimeoutMs');
    return typeof val === 'number' && val > 0 ? val : 3000;
  }

  /**
   * Prepares rename by verifying whether the symbol at cursor can be renamed
   * and determining its canonical 1-based range and current identifier placeholder.
   */
  public async prepareRename(
    request: LspPrepareRenameRequest,
    token?: CancellationToken
  ): Promise<RenameValidationResult<PreparedRenameResult>> {
    if (!this.isRenameEnabled()) {
      return { valid: false, error: 'LSP rename is disabled in settings.', status: 'disabled' };
    }

    const doc = this.docEngine.getDocument(request.documentId);
    if (!doc) {
      return { valid: false, error: 'Target document is not open.', status: 'stale' };
    }

    if (doc.metadata.isReadOnly) {
      return { valid: false, error: 'Cannot rename: document is read-only.', status: 'read_only' };
    }

    if (doc.contentRevision !== request.documentRevision) {
      return { valid: false, error: 'Document revision has changed.', status: 'stale' };
    }

    const session = this.serverManager.getActiveSession(
      request.languageId,
      request.workspaceId
    );

    if (!session || (session.getState() !== 'ready' && session.getState() !== 'running')) {
      return {
        valid: false,
        error: 'No active language server session available for rename.',
        status: 'disabled',
      };
    }

    const caps = session.getCapabilities();
    if (!caps || !caps.renameProvider) {
      return {
        valid: false,
        error: 'Language server does not support rename.',
        status: 'disabled',
      };
    }

    const prepareSupported =
      typeof caps.renameProvider === 'object' && Boolean(caps.renameProvider.prepareProvider);

    const lspUri = LspUriMapper.pathToUri(request.resourceUri);
    const lspPosition = {
      line: Math.max(0, request.line - 1),
      character: Math.max(0, request.column - 1),
    };

    if (prepareSupported) {
      try {
        const rawRes = await session.getClient().sendRequest<LspPrepareRenameResponse>(
          'textDocument/prepareRename',
          {
            textDocument: { uri: lspUri },
            position: lspPosition,
          },
          {
            category: 'interactive',
            cancellationToken: token,
            timeoutMs: this.getInteractiveTimeoutMs(),
          }
        );

        if (token?.isCancellationRequested) {
          return { valid: false, error: 'Prepare rename cancelled.', status: 'stale' };
        }

        if (!rawRes) {
          return {
            valid: false,
            error: 'You cannot rename this element.',
            status: 'not_renameable',
          };
        }

        // 1. Range + placeholder object
        if ('range' in rawRes && 'placeholder' in rawRes) {
          const canonicalRange = LspLocationMapper.mapLspRange(rawRes.range);
          return {
            valid: true,
            status: 'valid',
            value: {
              range: canonicalRange,
              placeholder: rawRes.placeholder || this.extractWordAt(doc.content, request.line, request.column),
            },
          };
        }

        // 2. Pure Range object
        if ('start' in rawRes && 'end' in rawRes) {
          const canonicalRange = LspLocationMapper.mapLspRange(rawRes);
          const placeholder = this.extractTextAtRange(doc.content, canonicalRange);
          return {
            valid: true,
            status: 'valid',
            value: {
              range: canonicalRange,
              placeholder: placeholder || this.extractWordAt(doc.content, request.line, request.column),
            },
          };
        }

        // 3. Default behavior object { defaultBehavior: true }
        if ('defaultBehavior' in rawRes && rawRes.defaultBehavior) {
          const fallback = this.getFallbackWordAndRange(doc.content, request.line, request.column);
          return { valid: true, status: 'valid', value: fallback };
        }
      } catch (err) {
        logger.debug('LspRenameProvider: prepareRename request failed or was rejected by server', {
          error: (err as Error).message,
        });
        return {
          valid: false,
          error: 'You cannot rename this element.',
          status: 'not_renameable',
        };
      }
    }

    // Server supports rename but lacks prepareProvider: fallback to word at cursor
    const fallback = this.getFallbackWordAndRange(doc.content, request.line, request.column);
    return { valid: true, status: 'valid', value: fallback };
  }

  /**
   * Executes the rename request against the language server, validating the result
   * and returning a canonical WorkspaceEdit.
   */
  public async requestRename(
    request: LspRenameRequest,
    token?: CancellationToken
  ): Promise<RenameValidationResult<WorkspaceEdit | null>> {
    if (!this.isRenameEnabled()) {
      return { valid: false, error: 'LSP rename is disabled in settings.', status: 'disabled' };
    }

    const nameVal = LspWorkspaceEditValidator.validateNewName(request.newName);
    if (!nameVal.valid || !nameVal.value) {
      return { valid: false, error: nameVal.error, status: nameVal.status };
    }

    const doc = this.docEngine.getDocument(request.documentId);
    if (!doc) {
      return { valid: false, error: 'Target document is no longer open.', status: 'stale' };
    }

    if (doc.metadata.isReadOnly) {
      return { valid: false, error: 'Target document is read-only.', status: 'read_only' };
    }

    if (doc.contentRevision !== request.documentRevision) {
      return {
        valid: false,
        error: `Document has been modified (revision ${doc.contentRevision} vs ${request.documentRevision}).`,
        status: 'stale',
      };
    }

    if (request.workspaceGeneration !== globalWorkspaceEngine.getGeneration()) {
      return { valid: false, error: 'Active workspace has changed.', status: 'workspace_mismatch' };
    }

    const session = this.serverManager.getActiveSession(
      request.languageId,
      request.workspaceId
    );

    if (!session || (session.getState() !== 'ready' && session.getState() !== 'running')) {
      return {
        valid: false,
        error: 'LSP server session is not ready.',
        status: 'disabled',
      };
    }

    const lspUri = LspUriMapper.pathToUri(request.resourceUri);
    const lspPosition = {
      line: Math.max(0, request.line - 1),
      character: Math.max(0, request.column - 1),
    };

    if (token?.isCancellationRequested) {
      return { valid: false, error: 'Rename operation was cancelled.', status: 'stale' };
    }

    try {
      const rawEdit = await session.getClient().sendRequest<LspRenameResponse>(
        'textDocument/rename',
        {
          textDocument: { uri: lspUri },
          position: lspPosition,
          newName: nameVal.value,
        },
        {
          category: 'interactive',
          cancellationToken: token,
          timeoutMs: this.getInteractiveTimeoutMs(),
        }
      );

      if (token?.isCancellationRequested) {
        return { valid: false, error: 'Rename operation was cancelled.', status: 'stale' };
      }

      if (!rawEdit) {
        return { valid: true, value: null, status: 'valid' };
      }

      // Validate incoming raw edit
      const editVal = LspWorkspaceEditValidator.validateWorkspaceEdit(rawEdit, {
        documentEngine: this.docEngine,
      });

      if (!editVal.valid) {
        return { valid: false, error: editVal.error, status: editVal.status };
      }

      // Map to canonical WorkspaceEdit
      const canonicalEdit = LspWorkspaceEditMapper.mapWorkspaceEdit(rawEdit);
      return { valid: true, value: canonicalEdit, status: 'valid' };
    } catch (err) {
      if (
        token?.isCancellationRequested ||
        (err as Error).name === 'LspCancelledError' ||
        (err as Error).message.toLowerCase().includes('cancel')
      ) {
        return {
          valid: false,
          error: 'Rename operation was cancelled.',
          status: 'stale',
        };
      }

      logger.warn('LspRenameProvider: textDocument/rename failed', {
        error: (err as Error).message,
      });
      return {
        valid: false,
        error: `Rename failed: ${(err as Error).message}`,
        status: 'conflict',
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Helper word boundary utilities
  // ---------------------------------------------------------------------------

  private extractWordAt(content: string, line1: number, col1: number): string {
    const lines = content.split('\n');
    const lineIndex = line1 - 1;
    if (lineIndex < 0 || lineIndex >= lines.length) return '';

    const text = lines[lineIndex];
    const colIndex = col1 - 1;
    const match = /[\w$]+/.exec(text.slice(Math.max(0, colIndex - 30), colIndex + 30));
    return match ? match[0] : '';
  }

  private extractTextAtRange(
    content: string,
    range: { startLine: number; startColumn: number; endLine: number; endColumn: number }
  ): string {
    const lines = content.split('\n');
    const startL = range.startLine - 1;
    const endL = range.endLine - 1;

    if (startL < 0 || endL >= lines.length) return '';
    if (startL === endL) {
      return lines[startL].slice(range.startColumn - 1, range.endColumn - 1);
    }
    return '';
  }

  private getFallbackWordAndRange(
    content: string,
    line1: number,
    col1: number
  ): PreparedRenameResult {
    const lines = content.split('\n');
    const lineIndex = line1 - 1;
    if (lineIndex < 0 || lineIndex >= lines.length) {
      return {
        range: { startLine: line1, startColumn: col1, endLine: line1, endColumn: col1 },
        placeholder: '',
      };
    }

    const text = lines[lineIndex];
    const colIndex = Math.max(0, col1 - 1);

    let start = colIndex;
    while (start > 0 && /[\w$]/.test(text[start - 1])) {
      start--;
    }
    let end = colIndex;
    while (end < text.length && /[\w$]/.test(text[end])) {
      end++;
    }

    const word = text.slice(start, end);
    return {
      range: {
        startLine: line1,
        startColumn: start + 1,
        endLine: line1,
        endColumn: end + 1,
      },
      placeholder: word,
    };
  }
}
