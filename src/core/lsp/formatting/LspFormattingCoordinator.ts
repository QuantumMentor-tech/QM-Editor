/**
 * QM Editor LSP Formatting Coordinator
 * Phase 06, Step 63 — LSP Document Formatting, Range Formatting & Safe Formatting Edit Integration
 */

import { DocumentEngine, globalDocumentEngine } from '../../documents/DocumentEngine';
import { EditorCoordinationService, globalEditorCoordinationService } from '../../editor/EditorCoordinationService';
import { globalWorkspaceEngine } from '../../workspace';
import { globalFeedbackService } from '../../feedback/FeedbackService';
import { CancellationTokenSource } from '../../symbols/CancellationToken';
import { Range } from '../../navigation/LocationTypes';
import { FormattingOptions } from '../LspTypes';
import { logger } from '../../../utils/logger';
import { LspFormattingProvider, globalLspFormattingProvider } from './LspFormattingProvider';
import { LspFormattingMapper } from './LspFormattingMapper';
import {
  LspFormatDocumentRequest,
  LspFormatRangeRequest,
  FormatExecutionResult,
} from './LspFormattingTypes';

export class LspFormattingCoordinator {
  private static instance: LspFormattingCoordinator | null = null;
  private currentCts: CancellationTokenSource | null = null;

  constructor(
    private readonly formattingProvider: LspFormattingProvider = globalLspFormattingProvider,
    private readonly editorCoordination: EditorCoordinationService = globalEditorCoordinationService,
    private readonly docEngine: DocumentEngine = globalDocumentEngine
  ) {}

  public static getInstance(): LspFormattingCoordinator {
    if (!this.instance) {
      this.instance = new LspFormattingCoordinator();
    }
    return this.instance;
  }

  /**
   * Formats the entire document using the active language server.
   */
  public async formatDocument(
    documentId: string,
    options?: Partial<FormattingOptions>
  ): Promise<FormatExecutionResult> {
    const startTime = performance.now();
    const doc = this.docEngine.getDocument(documentId);

    if (!doc) {
      return {
        status: 'failed',
        operationId: `fmt-${Date.now()}`,
        documentId,
        appliedEditsCount: 0,
        error: `Document "${documentId}" is not open.`,
      };
    }

    if (doc.metadata.isReadOnly) {
      globalFeedbackService.showWarning('Cannot format read-only document.');
      return {
        status: 'rejected',
        operationId: `fmt-${Date.now()}`,
        documentId,
        appliedEditsCount: 0,
        error: 'Document is read-only.',
      };
    }

    if (this.currentCts) {
      this.currentCts.cancel();
      this.currentCts.dispose();
    }
    this.currentCts = new CancellationTokenSource();

    const request: LspFormatDocumentRequest = {
      requestId: `fmt-doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      workspaceId: globalWorkspaceEngine.getWorkspaceId() || 'default-workspace',
      workspaceGeneration: globalWorkspaceEngine.getGeneration(),
      documentId: doc.id,
      resourceUri: doc.resourceUri || doc.id,
      documentRevision: doc.contentRevision,
      languageId: doc.languageId || 'plaintext',
      options,
    };

    logger.info('LspFormattingCoordinator: requesting document formatting', {
      documentId: doc.id,
      languageId: doc.languageId,
      revision: doc.contentRevision,
    });

    const valResult = await this.formattingProvider.formatDocument(request, this.currentCts.token);
    const durationMs = Math.round(performance.now() - startTime);

    if (valResult.status === 'no_changes' || (valResult.valid && (!valResult.value || valResult.value.length === 0))) {
      globalFeedbackService.showInfo('Document is already formatted.');
      return {
        status: 'no_changes',
        operationId: request.requestId,
        documentId: doc.id,
        appliedEditsCount: 0,
        durationMs,
      };
    }

    if (!valResult.valid || !valResult.value) {
      if (valResult.status === 'not_supported') {
        globalFeedbackService.showInfo(valResult.error || 'No formatter available for this document.');
      } else {
        globalFeedbackService.showWarning(valResult.error || 'Formatting failed.');
      }

      return {
        status:
          valResult.status === 'not_supported' ||
          valResult.status === 'disabled' ||
          valResult.status === 'read_only'
            ? 'rejected'
            : 'failed',
        operationId: request.requestId,
        documentId: doc.id,
        appliedEditsCount: 0,
        error: valResult.error,
        durationMs,
      };
    }

    // Map validated LSP edits to SingleTextEdits on document content
    const singleEdits = LspFormattingMapper.mapToTransactionEdits(valResult.value, doc.content);
    if (singleEdits.length === 0) {
      globalFeedbackService.showInfo('Document is already formatted.');
      return {
        status: 'no_changes',
        operationId: request.requestId,
        documentId: doc.id,
        appliedEditsCount: 0,
        durationMs,
      };
    }

    // Apply through Edit Transaction System
    const txRes = await this.editorCoordination.applyTransaction({
      documentId: doc.id,
      expectedRevision: doc.contentRevision,
      source: 'format',
      changes: singleEdits,
      description: 'Format Document',
    });

    if (txRes.status !== 'applied') {
      const err = txRes.error || `Transaction failed with status "${txRes.status}".`;
      globalFeedbackService.showError(`Formatting failed: ${err}`);
      return {
        status: 'failed',
        operationId: request.requestId,
        documentId: doc.id,
        appliedEditsCount: 0,
        error: err,
        durationMs,
      };
    }

    logger.info('LspFormattingCoordinator: document formatted successfully', {
      documentId: doc.id,
      appliedEdits: txRes.appliedOperationsCount,
      newRevision: txRes.newRevision,
      durationMs,
    });

    return {
      status: 'applied',
      operationId: request.requestId,
      documentId: doc.id,
      appliedEditsCount: txRes.appliedOperationsCount,
      newRevision: txRes.newRevision,
      durationMs,
    };
  }

  /**
   * Formats the specified selection / range using the active language server.
   */
  public async formatRange(
    documentId: string,
    range: Range,
    options?: Partial<FormattingOptions>
  ): Promise<FormatExecutionResult> {
    const startTime = performance.now();
    const doc = this.docEngine.getDocument(documentId);

    if (!doc) {
      return {
        status: 'failed',
        operationId: `fmt-range-${Date.now()}`,
        documentId,
        appliedEditsCount: 0,
        error: `Document "${documentId}" is not open.`,
      };
    }

    if (doc.metadata.isReadOnly) {
      globalFeedbackService.showWarning('Cannot format read-only document.');
      return {
        status: 'rejected',
        operationId: `fmt-range-${Date.now()}`,
        documentId,
        appliedEditsCount: 0,
        error: 'Document is read-only.',
      };
    }

    if (this.currentCts) {
      this.currentCts.cancel();
      this.currentCts.dispose();
    }
    this.currentCts = new CancellationTokenSource();

    const request: LspFormatRangeRequest = {
      requestId: `fmt-range-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      workspaceId: globalWorkspaceEngine.getWorkspaceId() || 'default-workspace',
      workspaceGeneration: globalWorkspaceEngine.getGeneration(),
      documentId: doc.id,
      resourceUri: doc.resourceUri || doc.id,
      documentRevision: doc.contentRevision,
      languageId: doc.languageId || 'plaintext',
      range,
      options,
    };

    logger.info('LspFormattingCoordinator: requesting range formatting', {
      documentId: doc.id,
      range,
      languageId: doc.languageId,
      revision: doc.contentRevision,
    });

    const valResult = await this.formattingProvider.formatRange(request, this.currentCts.token);
    const durationMs = Math.round(performance.now() - startTime);

    if (valResult.status === 'no_changes' || (valResult.valid && (!valResult.value || valResult.value.length === 0))) {
      globalFeedbackService.showInfo('Selected range is already formatted.');
      return {
        status: 'no_changes',
        operationId: request.requestId,
        documentId: doc.id,
        appliedEditsCount: 0,
        durationMs,
      };
    }

    if (!valResult.valid || !valResult.value) {
      if (valResult.status === 'not_supported') {
        globalFeedbackService.showInfo(valResult.error || 'No range formatter available for this document.');
      } else {
        globalFeedbackService.showWarning(valResult.error || 'Range formatting failed.');
      }

      return {
        status:
          valResult.status === 'not_supported' ||
          valResult.status === 'disabled' ||
          valResult.status === 'read_only'
            ? 'rejected'
            : 'failed',
        operationId: request.requestId,
        documentId: doc.id,
        appliedEditsCount: 0,
        error: valResult.error,
        durationMs,
      };
    }

    // Map validated LSP edits to SingleTextEdits on document content
    const singleEdits = LspFormattingMapper.mapToTransactionEdits(valResult.value, doc.content);
    if (singleEdits.length === 0) {
      globalFeedbackService.showInfo('Selected range is already formatted.');
      return {
        status: 'no_changes',
        operationId: request.requestId,
        documentId: doc.id,
        appliedEditsCount: 0,
        durationMs,
      };
    }

    // Apply through Edit Transaction System
    const txRes = await this.editorCoordination.applyTransaction({
      documentId: doc.id,
      expectedRevision: doc.contentRevision,
      source: 'format',
      changes: singleEdits,
      description: 'Format Selection',
    });

    if (txRes.status !== 'applied') {
      const err = txRes.error || `Transaction failed with status "${txRes.status}".`;
      globalFeedbackService.showError(`Range formatting failed: ${err}`);
      return {
        status: 'failed',
        operationId: request.requestId,
        documentId: doc.id,
        appliedEditsCount: 0,
        error: err,
        durationMs,
      };
    }

    logger.info('LspFormattingCoordinator: range formatted successfully', {
      documentId: doc.id,
      appliedEdits: txRes.appliedOperationsCount,
      newRevision: txRes.newRevision,
      durationMs,
    });

    return {
      status: 'applied',
      operationId: request.requestId,
      documentId: doc.id,
      appliedEditsCount: txRes.appliedOperationsCount,
      newRevision: txRes.newRevision,
      durationMs,
    };
  }

  public dispose(): void {
    if (this.currentCts) {
      this.currentCts.cancel();
      this.currentCts.dispose();
      this.currentCts = null;
    }
  }

  public static resetInstance(): void {
    if (this.instance) {
      this.instance.dispose();
      this.instance = null;
    }
  }
}

export const globalLspFormattingCoordinator = LspFormattingCoordinator.getInstance();
