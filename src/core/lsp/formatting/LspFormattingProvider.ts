/**
 * QM Editor LSP Formatting Provider
 * Phase 06, Step 63 — LSP Document Formatting, Range Formatting & Safe Formatting Edit Integration
 */

import { LspServerManager, globalLspServerManager } from '../LspServerManager';
import { DocumentEngine, globalDocumentEngine } from '../../documents/DocumentEngine';
import { LspUriMapper } from '../LspUriMapper';
import { LspTextEdit, LspFormattingResponse } from '../LspTypes';
import { CancellationToken } from '../../symbols/SymbolTypes';
import { SettingsService } from '../../settings/SettingsService';
import { globalWorkspaceEngine } from '../../workspace';
import { logger } from '../../../utils/logger';
import {
  LspFormatDocumentRequest,
  LspFormatRangeRequest,
  FormattingValidationResult,
} from './LspFormattingTypes';
import { LspFormattingValidator } from './LspFormattingValidator';
import { LspFormattingMapper } from './LspFormattingMapper';

export class LspFormattingProvider {
  private static instance: LspFormattingProvider | null = null;

  constructor(
    private readonly serverManager: LspServerManager = globalLspServerManager,
    private readonly docEngine: DocumentEngine = globalDocumentEngine,
    private readonly settingsService: SettingsService = SettingsService.getInstance()
  ) {}

  public static getInstance(): LspFormattingProvider {
    if (!this.instance) {
      this.instance = new LspFormattingProvider();
    }
    return this.instance;
  }

  public isFormattingEnabled(): boolean {
    return this.settingsService.get('lsp.formatting.enabled') !== false;
  }

  /**
   * Executes a textDocument/formatting request against the active LSP session.
   */
  public async formatDocument(
    request: LspFormatDocumentRequest,
    token?: CancellationToken
  ): Promise<FormattingValidationResult<LspTextEdit[]>> {
    if (token?.isCancellationRequested) {
      return { valid: false, error: 'Formatting request was cancelled.', status: 'stale' };
    }

    if (!this.isFormattingEnabled()) {
      return { valid: false, error: 'LSP formatting is disabled in settings.', status: 'disabled' };
    }

    const doc = this.docEngine.getDocument(request.documentId);
    if (!doc) {
      return { valid: false, error: 'Target document is not open.', status: 'stale' };
    }

    if (doc.metadata.isReadOnly) {
      return { valid: false, error: 'Cannot format read-only document.', status: 'read_only' };
    }

    if (doc.contentRevision !== request.documentRevision) {
      return { valid: false, error: 'Document revision has changed.', status: 'stale' };
    }

    let session = this.serverManager.getActiveSession(
      request.languageId,
      request.workspaceId
    );
    if (!session && request.languageId) {
      session = this.serverManager.getActiveSession(request.languageId);
    }
    if (!session && request.languageId) {
      session = this.serverManager
        .getAllSessions()
        .find(
          (s) =>
            s.serverDefinition?.languageIds?.includes(request.languageId) &&
            (s.getState() === 'running' || s.getState() === 'ready')
        );
    }

    if (!session || (session.getState() !== 'ready' && session.getState() !== 'running')) {
      return {
        valid: false,
        error: `No active language server session available for language "${request.languageId}".`,
        status: 'not_supported',
      };
    }

    const caps = session.getCapabilities();
    if (!caps || !caps.documentFormattingProvider) {
      return {
        valid: false,
        error: `Language server does not support document formatting for "${request.languageId}".`,
        status: 'not_supported',
      };
    }

    const lspUri = LspUriMapper.pathToUri(request.resourceUri);
    const options = LspFormattingMapper.resolveFormattingOptions(request.options);

    try {
      const rawRes = await session.getClient().sendRequest<LspFormattingResponse>(
        'textDocument/formatting',
        {
          textDocument: { uri: lspUri },
          options,
        },
        {
          category: 'interactive',
          cancellationToken: token,
          timeoutMs: 15000,
        }
      );

      if (token?.isCancellationRequested) {
        return { valid: false, error: 'Formatting request was cancelled.', status: 'stale' };
      }

      // Re-verify document state after awaiting network response
      const currentDoc = this.docEngine.getDocument(request.documentId);
      if (!currentDoc || currentDoc.contentRevision !== request.documentRevision) {
        return {
          valid: false,
          error: 'Document content changed while formatting was in flight.',
          status: 'stale',
        };
      }

      if (request.workspaceGeneration !== globalWorkspaceEngine.getGeneration()) {
        return {
          valid: false,
          error: 'Workspace changed while formatting was in flight.',
          status: 'workspace_mismatch',
        };
      }

      return LspFormattingValidator.validateFormattingResponse(rawRes, currentDoc.content);
    } catch (err) {
      if (
        (err as Error).name === 'LspCancelledError' ||
        (err as Error).message?.includes('cancelled') ||
        token?.isCancellationRequested
      ) {
        return { valid: false, error: 'Formatting request was cancelled.', status: 'stale' };
      }
      if (
        (err as Error).name === 'LspStaleResponseError' ||
        (err as Error).message?.includes('stale')
      ) {
        return {
          valid: false,
          error: 'Document content changed while formatting was in flight.',
          status: 'stale',
        };
      }
      logger.error('LspFormattingProvider: document formatting request failed', {
        error: (err as Error).message,
        documentId: request.documentId,
      });

      return {
        valid: false,
        error: (err as Error).message || 'Formatting request failed.',
        status: 'conflict',
      };
    }
  }

  /**
   * Executes a textDocument/rangeFormatting request against the active LSP session.
   */
  public async formatRange(
    request: LspFormatRangeRequest,
    token?: CancellationToken
  ): Promise<FormattingValidationResult<LspTextEdit[]>> {
    if (token?.isCancellationRequested) {
      return { valid: false, error: 'Formatting request was cancelled.', status: 'stale' };
    }

    if (!this.isFormattingEnabled()) {
      return { valid: false, error: 'LSP formatting is disabled in settings.', status: 'disabled' };
    }

    const doc = this.docEngine.getDocument(request.documentId);
    if (!doc) {
      return { valid: false, error: 'Target document is not open.', status: 'stale' };
    }

    if (doc.metadata.isReadOnly) {
      return { valid: false, error: 'Cannot format read-only document.', status: 'read_only' };
    }

    if (doc.contentRevision !== request.documentRevision) {
      return { valid: false, error: 'Document revision has changed.', status: 'stale' };
    }

    const rangeVal = LspFormattingValidator.validateCanonicalRange(request.range, doc.content);
    if (!rangeVal.valid) {
      return rangeVal as FormattingValidationResult<LspTextEdit[]>;
    }

    let session = this.serverManager.getActiveSession(
      request.languageId,
      request.workspaceId
    );
    if (!session && request.languageId) {
      session = this.serverManager.getActiveSession(request.languageId);
    }
    if (!session && request.languageId) {
      session = this.serverManager
        .getAllSessions()
        .find(
          (s) =>
            s.serverDefinition?.languageIds?.includes(request.languageId) &&
            (s.getState() === 'running' || s.getState() === 'ready')
        );
    }

    if (!session || (session.getState() !== 'ready' && session.getState() !== 'running')) {
      return {
        valid: false,
        error: `No active language server session available for language "${request.languageId}".`,
        status: 'not_supported',
      };
    }

    const caps = session.getCapabilities();
    if (!caps || !caps.documentRangeFormattingProvider) {
      return {
        valid: false,
        error: `Language server does not support range formatting for "${request.languageId}".`,
        status: 'not_supported',
      };
    }

    const lspUri = LspUriMapper.pathToUri(request.resourceUri);
    const lspRange = LspFormattingMapper.mapToLspRange(request.range);
    const options = LspFormattingMapper.resolveFormattingOptions(request.options);

    try {
      const rawRes = await session.getClient().sendRequest<LspFormattingResponse>(
        'textDocument/rangeFormatting',
        {
          textDocument: { uri: lspUri },
          range: lspRange,
          options,
        },
        {
          category: 'interactive',
          cancellationToken: token,
          timeoutMs: 15000,
        }
      );

      if (token?.isCancellationRequested) {
        return { valid: false, error: 'Range formatting request was cancelled.', status: 'stale' };
      }

      // Re-verify document state after awaiting network response
      const currentDoc = this.docEngine.getDocument(request.documentId);
      if (!currentDoc || currentDoc.contentRevision !== request.documentRevision) {
        return {
          valid: false,
          error: 'Document content changed while range formatting was in flight.',
          status: 'stale',
        };
      }

      if (request.workspaceGeneration !== globalWorkspaceEngine.getGeneration()) {
        return {
          valid: false,
          error: 'Workspace changed while range formatting was in flight.',
          status: 'workspace_mismatch',
        };
      }

      return LspFormattingValidator.validateFormattingResponse(rawRes, currentDoc.content);
    } catch (err) {
      if (
        (err as Error).name === 'LspCancelledError' ||
        (err as Error).message?.includes('cancelled') ||
        token?.isCancellationRequested
      ) {
        return { valid: false, error: 'Formatting request was cancelled.', status: 'stale' };
      }
      if (
        (err as Error).name === 'LspStaleResponseError' ||
        (err as Error).message?.includes('stale')
      ) {
        return {
          valid: false,
          error: 'Document content changed while formatting was in flight.',
          status: 'stale',
        };
      }
      logger.error('LspFormattingProvider: range formatting request failed', {
        error: (err as Error).message,
        documentId: request.documentId,
      });

      return {
        valid: false,
        error: (err as Error).message || 'Range formatting request failed.',
        status: 'conflict',
      };
    }
  }

  public static resetInstance(): void {
    this.instance = null;
  }
}

export const globalLspFormattingProvider = LspFormattingProvider.getInstance();
