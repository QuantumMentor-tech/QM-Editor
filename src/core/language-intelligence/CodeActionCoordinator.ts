/**
 * QM Editor Code Action & Code Transformation Coordinator
 * Phase 04, Step 44 — Code Actions, Quick Fixes & Safe Code Transformation Foundation
 */

import {
  CodeAction,
  CodeActionRequest,
  CodeActionPreview,
  FileEditPreview,
  CodeActionExecutionResult,
  CodeActionValidationResult,
} from './CodeActionTypes';
import {
  LanguageIntelligenceRegistry,
  globalLanguageIntelligenceRegistry,
} from './LanguageIntelligenceRegistry';
import { Range } from '../navigation/LocationTypes';
import { CancellationToken } from '../symbols/SymbolTypes';
import { CancellationTokenSource } from '../symbols/CancellationToken';
import { globalDocumentEngine, DocumentEngine } from '../documents/DocumentEngine';
import { normalizeResourceUri } from '../documents/ResourceIdentity';
import { globalEditorCoordinationService, EditorCoordinationService } from '../editor';
import { globalWorkspaceEngine } from '../workspace';
import { fileService } from '../../services/FileService';
import { SingleTextEdit } from '../edit/EditTypes';
import { logger } from '../../utils/logger';

/**
 * Converts 1-based Range to 0-based character offsets within text content.
 */
export function codeActionRangeToOffsets(content: string, range: Range): { from: number; to: number } {
  const lines = content.split('\n');
  
  let from = 0;
  const startLine = Math.max(1, range.startLine);
  for (let i = 0; i < startLine - 1 && i < lines.length; i++) {
    from += lines[i].length + 1;
  }
  from += Math.max(0, range.startColumn - 1);
  from = Math.min(from, content.length);

  let to = 0;
  const endLine = Math.max(startLine, range.endLine);
  for (let i = 0; i < endLine - 1 && i < lines.length; i++) {
    to += lines[i].length + 1;
  }
  to += Math.max(0, range.endColumn - 1);
  to = Math.min(to, content.length);

  return { from, to: Math.max(from, to) };
}

/**
 * Coordinator for Code Actions, Quick Fixes, and Safe Code Transformations.
 */
export class CodeActionCoordinator {
  private static instance: CodeActionCoordinator | null = null;
  private currentCts: CancellationTokenSource | null = null;
  private currentGeneration: number = 0;
  private isDisposed: boolean = false;

  constructor(
    private readonly registry: LanguageIntelligenceRegistry = globalLanguageIntelligenceRegistry,
    private readonly docEngine: DocumentEngine = globalDocumentEngine,
    private readonly editorCoordination: EditorCoordinationService = globalEditorCoordinationService
  ) {}

  public static getInstance(): CodeActionCoordinator {
    if (!CodeActionCoordinator.instance) {
      CodeActionCoordinator.instance = new CodeActionCoordinator();
    }
    return CodeActionCoordinator.instance;
  }

  /**
   * Requests code actions and quick fixes for the given document context.
   */
  public async provideCodeActions(
    request: CodeActionRequest,
    externalToken?: CancellationToken
  ): Promise<CodeAction[]> {
    if (this.isDisposed) {
      return [];
    }

    // 1. Cooperative cancellation of prior pending request
    if (this.currentCts) {
      this.currentCts.cancel();
      this.currentCts.dispose();
      this.currentCts = null;
    }

    const cts = new CancellationTokenSource();
    this.currentCts = cts;
    const token = cts.token;
    const requestGen = ++this.currentGeneration;

    // 2. Validate document existence and revision
    const doc = this.docEngine.getDocument(request.documentId);
    if (!doc) {
      return [];
    }

    if (request.documentRevision !== doc.contentRevision) {
      logger.info('CodeActionCoordinator: rejecting request with stale document revision', {
        expected: request.documentRevision,
        actual: doc.contentRevision,
      });
      return [];
    }

    // 3. Validate workspace generation
    if (
      request.workspaceGeneration !== undefined &&
      request.workspaceGeneration !== globalWorkspaceEngine.getGeneration()
    ) {
      logger.info('CodeActionCoordinator: rejecting request with stale workspace generation', {
        expected: request.workspaceGeneration,
        actual: globalWorkspaceEngine.getGeneration(),
      });
      return [];
    }

    // 4. Resolve compatible providers
    const providers = this.registry.getCodeActionProviders(request.languageId);
    if (providers.length === 0) {
      return [];
    }

    // 5. Query providers concurrently in isolated try/catch shields
    const queryPromises = providers.map(async (provider) => {
      try {
        if (!provider.provideCodeActions) return [];
        const result = await provider.provideCodeActions(request, token);
        return Array.isArray(result) ? result : [];
      } catch (err) {
        logger.error('CodeActionCoordinator: provider failed', {
          providerId: provider.providerId,
          error: (err as Error).message,
        });
        return [];
      }
    });

    const settled = await Promise.allSettled(queryPromises);

    // 6. Check cancellation and generation stability
    if (
      token.isCancellationRequested ||
      externalToken?.isCancellationRequested ||
      requestGen !== this.currentGeneration ||
      this.isDisposed
    ) {
      return [];
    }

    // 7. Flatten and normalize results
    const rawActions: CodeAction[] = [];
    for (let i = 0; i < settled.length; i++) {
      const res = settled[i];
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        const provider = providers[i];
        for (const action of res.value) {
          if (action && action.id && action.title) {
            rawActions.push({
              ...action,
              providerId: action.providerId || provider.providerId,
              documentRevision: action.documentRevision ?? doc.contentRevision,
            });
          }
        }
      }
    }

    // 8. Deterministic sorting:
    //    1) Preferred actions first
    //    2) Kind priority ('quickfix' -> 'refactor' -> 'source' -> 'format')
    //    3) Provider priority descending
    //    4) Title alphabetical
    const kindWeight: Record<string, number> = {
      quickfix: 1,
      refactor: 2,
      'refactor.extract': 2,
      'refactor.inline': 2,
      'refactor.rewrite': 2,
      source: 3,
      'source.organizeImports': 3,
      'source.fixAll': 3,
      format: 4,
    };

    return rawActions.sort((a, b) => {
      if (a.isPreferred && !b.isPreferred) return -1;
      if (!a.isPreferred && b.isPreferred) return 1;

      const weightA = kindWeight[a.kind] ?? 10;
      const weightB = kindWeight[b.kind] ?? 10;
      if (weightA !== weightB) return weightA - weightB;

      const prioA = this.registry.getProvider(a.providerId)?.priority ?? 50;
      const prioB = this.registry.getProvider(b.providerId)?.priority ?? 50;
      if (prioA !== prioB) return prioB - prioA;

      return a.title.localeCompare(b.title);
    });
  }

  /**
   * Double Validation: rigorously validates a code action before execution.
   */
  public validateCodeAction(
    action: CodeAction,
    context?: {
      documentId?: string;
      expectedRevision?: number;
      workspaceGeneration?: number;
    }
  ): CodeActionValidationResult {
    if (this.isDisposed) {
      return { valid: false, error: 'CodeActionCoordinator is disposed.' };
    }

    if (!action || !action.id) {
      return { valid: false, error: 'Invalid code action object.' };
    }

    // 1. Check disabled reason
    if (action.disabledReason) {
      return {
        valid: false,
        error: action.disabledReason,
        status: 'disabled',
      };
    }

    // 2. Workspace generation validation
    const targetGen = context?.workspaceGeneration ?? action.workspaceGeneration;
    if (
      targetGen !== undefined &&
      targetGen !== globalWorkspaceEngine.getGeneration()
    ) {
      return {
        valid: false,
        error: 'Action is invalid: active workspace has changed.',
        status: 'workspace_mismatch',
      };
    }

    // 3. Document validation for target open document
    const targetDocId = context?.documentId;
    if (targetDocId) {
      const doc = this.docEngine.getDocument(targetDocId);
      if (!doc) {
        return { valid: false, error: `Document "${targetDocId}" is no longer open.` };
      }

      if (doc.metadata.isReadOnly) {
        return {
          valid: false,
          error: 'Cannot apply action: document is read-only.',
          status: 'read_only',
        };
      }

      if (doc.metadata.hasConflict) {
        return {
          valid: false,
          error: 'Cannot apply action: document has an unresolved disk conflict.',
          status: 'conflict',
        };
      }

      // Check revision consistency
      const expectedRev = context?.expectedRevision ?? action.documentRevision;
      if (expectedRev !== undefined && doc.contentRevision !== expectedRev) {
        return {
          valid: false,
          error: `Stale action: document revision has advanced from ${expectedRev} to ${doc.contentRevision}.`,
          status: 'stale',
        };
      }
    }

    // 4. Validate edit sets if present
    if (action.edit?.changes) {
      for (const [uri, edits] of Object.entries(action.edit.changes)) {
        // Find matching open document
        const openDoc = this.findDocumentByUri(uri);
        if (openDoc) {
          if (openDoc.metadata.isReadOnly) {
            return {
              valid: false,
              error: `Target document "${openDoc.title}" is read-only.`,
              status: 'read_only',
            };
          }

          if (
            action.documentRevision !== undefined &&
            openDoc.contentRevision !== action.documentRevision
          ) {
            return {
              valid: false,
              error: `Stale action: document revision has advanced from ${action.documentRevision} to ${openDoc.contentRevision}.`,
              status: 'stale',
            };
          }

          const content = openDoc.content;
          const convertedEdits = edits.map((e) => codeActionRangeToOffsets(content, e.range));

          // Check ranges
          for (const ch of convertedEdits) {
            if (ch.from < 0 || ch.to > content.length || ch.from > ch.to) {
              return {
                valid: false,
                error: `Invalid edit range [${ch.from}, ${ch.to}] for file "${openDoc.title}".`,
                status: 'invalid_range',
              };
            }
          }

          // Check overlapping edits
          const sorted = [...convertedEdits].sort((a, b) => a.from - b.from);
          for (let i = 0; i < sorted.length - 1; i++) {
            if (sorted[i].to > sorted[i + 1].from) {
              return {
                valid: false,
                error: `Overlapping edit ranges detected for file "${openDoc.title}".`,
                status: 'invalid_range',
              };
            }
          }
        }
      }
    }

    return { valid: true };
  }

  /**
   * Generates a non-mutating preview of the proposed transformation.
   * Completely read-only: does not alter documents, filesystem, or undo stack.
   */
  public async previewCodeAction(action: CodeAction): Promise<CodeActionPreview> {
    const resolvedAction = await this.resolveActionIfNeeded(action);
    const affectedFiles: FileEditPreview[] = [];
    let totalEditsCount = 0;
    const resourceOperations = resolvedAction.edit?.resourceOperations ?? [];

    if (resolvedAction.edit?.changes) {
      for (const [uri, edits] of Object.entries(resolvedAction.edit.changes)) {
        const openDoc = this.findDocumentByUri(uri);
        let originalContent = '';
        let isOpen = false;
        let isReadOnly = false;
        let isDirty = false;
        let docId: string | undefined;

        if (openDoc) {
          isOpen = true;
          isReadOnly = openDoc.metadata.isReadOnly;
          isDirty = openDoc.isDirty;
          docId = openDoc.id;
          originalContent = openDoc.content;
        }

        // Apply edits to a simulated copy in reverse offset order
        const converted = edits.map((e) => ({
          ...codeActionRangeToOffsets(originalContent, e.range),
          insertText: e.newText,
        }));
        converted.sort((a, b) => b.from - a.from || b.to - a.to);

        let proposedContent = originalContent;
        for (const ch of converted) {
          proposedContent =
            proposedContent.slice(0, ch.from) + ch.insertText + proposedContent.slice(ch.to);
        }

        affectedFiles.push({
          resourceUri: uri,
          documentId: docId,
          isOpen,
          isReadOnly,
          isDirty,
          originalContent,
          proposedContent,
          editsCount: edits.length,
        });

        totalEditsCount += edits.length;
      }
    }

    const requiresConfirmation =
      affectedFiles.length > 1 || resourceOperations.length > 0;

    const confirmationReason = requiresConfirmation
      ? affectedFiles.length > 1
        ? `This transformation modifies ${affectedFiles.length} files.`
        : `This transformation performs file lifecycle operations.`
      : undefined;

    return {
      actionId: action.id,
      actionTitle: action.title,
      providerId: action.providerId,
      affectedFiles,
      resourceOperations: [...resourceOperations],
      totalEditsCount,
      requiresConfirmation,
      confirmationReason,
    };
  }

  /**
   * Applies the code action through the central Edit Transaction System.
   * Strictly enforces Double Validation, undo/redo integration, and revision updates.
   */
  public async applyCodeAction(
    action: CodeAction,
    options?: {
      documentId?: string;
      expectedRevision?: number;
      skipConfirmation?: boolean;
    }
  ): Promise<CodeActionExecutionResult> {
    if (this.isDisposed) {
      return {
        status: 'failed',
        actionId: action?.id || '',
        appliedEditsCount: 0,
        affectedDocuments: [],
        error: 'CodeActionCoordinator is disposed.',
      };
    }

    const resolvedAction = await this.resolveActionIfNeeded(action);

    // 1. Double Validation Rule at execution time
    const validation = this.validateCodeAction(resolvedAction, {
      documentId: options?.documentId,
      expectedRevision: options?.expectedRevision,
      workspaceGeneration: globalWorkspaceEngine.getGeneration(),
    });

    if (!validation.valid) {
      logger.warn('CodeActionCoordinator: action validation failed at execution', {
        actionId: action.id,
        error: validation.error,
        status: validation.status,
      });

      return {
        status: (validation.status as any) || 'rejected',
        actionId: action.id,
        appliedEditsCount: 0,
        affectedDocuments: [],
        error: validation.error,
      };
    }

    const affectedDocuments: string[] = [];
    let appliedEditsCount = 0;
    const errors: string[] = [];

    // 2. Apply Text Edits per file
    if (resolvedAction.edit?.changes) {
      for (const [uri, edits] of Object.entries(resolvedAction.edit.changes)) {
        const openDoc = this.findDocumentByUri(uri);

        if (openDoc) {
          const content = openDoc.content;
          const matchEdits: SingleTextEdit[] = edits.map((e) => {
            const offsets = codeActionRangeToOffsets(content, e.range);
            return {
              from: offsets.from,
              to: offsets.to,
              insertText: e.newText,
            };
          });

          matchEdits.sort((a, b) => a.from - b.from);

          // Apply through Edit Transaction System
          const txRes = await this.editorCoordination.applyTransaction({
            documentId: openDoc.id,
            expectedRevision: openDoc.contentRevision,
            source: 'codeAction',
            changes: matchEdits,
            description: resolvedAction.title,
          });

          if (txRes.status !== 'applied') {
            const err = txRes.error || `Transaction failed with status "${txRes.status}".`;
            errors.push(`${openDoc.title}: ${err}`);
          } else {
            affectedDocuments.push(openDoc.id);
            appliedEditsCount += txRes.appliedOperationsCount;
          }
        } else {
          // Closed file: safe write via fileService
          try {
            const readRes = await fileService.readFile(uri as any);
            const content = readRes.content;
            const converted = edits.map((e) => ({
              ...codeActionRangeToOffsets(content, e.range),
              insertText: e.newText,
            }));
            converted.sort((a, b) => b.from - a.from);

            let newContent = content;
            for (const ch of converted) {
              newContent =
                newContent.slice(0, ch.from) + ch.insertText + newContent.slice(ch.to);
            }

            await fileService.writeFile(uri as any, newContent);
            appliedEditsCount += edits.length;
          } catch (err) {
            errors.push(`${uri}: ${(err as Error).message}`);
          }
        }
      }
    }

    if (errors.length > 0) {
      const isPartial = appliedEditsCount > 0;
      return {
        status: isPartial ? 'partial_failure' : 'failed',
        actionId: action.id,
        appliedEditsCount,
        affectedDocuments,
        error: errors.join('; '),
        details: errors,
      };
    }

    logger.info('CodeActionCoordinator: code action applied successfully', {
      actionId: action.id,
      title: action.title,
      appliedEditsCount,
      affectedDocuments,
    });

    return {
      status: 'applied',
      actionId: action.id,
      appliedEditsCount,
      affectedDocuments,
    };
  }

  /**
   * Helper to resolve lazy code action edits from provider.
   */
  private async resolveActionIfNeeded(action: CodeAction): Promise<CodeAction> {
    if (action.edit) return action;

    const provider = this.registry.getProvider(action.providerId);
    if (provider && provider.resolveCodeAction) {
      try {
        return await provider.resolveCodeAction(action);
      } catch (err) {
        logger.error('CodeActionCoordinator: error resolving code action', {
          actionId: action.id,
          error: (err as Error).message,
        });
      }
    }
    return action;
  }

  /**
   * Helper to find an open DocumentRecord by URI or title.
   */
  private findDocumentByUri(uri: string) {
    const norm = uri.toLowerCase();
    const normalizedTarget = normalizeResourceUri(uri).toLowerCase();
    const allDocs = this.docEngine.getAllDocuments();
    return allDocs.find((d) => {
      const dNorm = d.resourceUri.toLowerCase();
      if (dNorm === norm || dNorm === normalizedTarget) return true;
      if (d.filePath) {
        const fpNorm = d.filePath.toLowerCase();
        if (
          fpNorm === norm ||
          fpNorm.replace(/\\/g, '/') === norm.replace(/\\/g, '/')
        ) {
          return true;
        }
      }
      return d.id.toLowerCase() === norm || d.title.toLowerCase() === norm;
    });
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;

    if (this.currentCts) {
      this.currentCts.cancel();
      this.currentCts.dispose();
      this.currentCts = null;
    }
  }

  public reset(): void {
    this.isDisposed = false;
    if (this.currentCts) {
      this.currentCts.cancel();
      this.currentCts.dispose();
      this.currentCts = null;
    }
    this.currentGeneration = 0;
  }

  public static resetInstance(): void {
    if (CodeActionCoordinator.instance) {
      CodeActionCoordinator.instance.dispose();
      CodeActionCoordinator.instance = null;
    }
  }
}

export const globalCodeActionCoordinator = CodeActionCoordinator.getInstance();
