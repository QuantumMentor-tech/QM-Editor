/**
 * QM Editor LSP Rename Coordinator
 * Phase 06, Step 62 — LSP Rename, Prepare Rename & Safe Multi-File Workspace Edit Integration
 */

import {
  LspPrepareRenameRequest,
  PreparedRenameResult,
  LspRenameRequest,
  RenameExecutionResult,
  RenameValidationResult,
} from './LspRenameTypes';
import { LspRenameProvider } from './LspRenameProvider';
import { globalLspServerManager, LspServerManager } from '../LspServerManager';
import { globalDocumentEngine, DocumentEngine } from '../../documents/DocumentEngine';
import {
  CodeActionCoordinator,
  globalCodeActionCoordinator,
} from '../../language-intelligence/CodeActionCoordinator';
import { CodeAction, CodeActionPreview } from '../../language-intelligence/CodeActionTypes';
import { globalFeedbackService } from '../../feedback/FeedbackService';
import { globalWorkspaceEngine } from '../../workspace';
import { logger } from '../../../utils/logger';

export class LspRenameCoordinator {
  private static instance: LspRenameCoordinator | null = null;
  private readonly provider: LspRenameProvider;
  private currentOperationId: string | null = null;

  constructor(
    provider?: LspRenameProvider,
    private readonly codeActionCoordinator: CodeActionCoordinator = globalCodeActionCoordinator,
    private readonly docEngine: DocumentEngine = globalDocumentEngine,
    private readonly serverManager: LspServerManager = globalLspServerManager
  ) {
    this.provider = provider || new LspRenameProvider(this.serverManager, this.docEngine);
  }

  public static getInstance(): LspRenameCoordinator {
    if (!LspRenameCoordinator.instance) {
      LspRenameCoordinator.instance = new LspRenameCoordinator();
    }
    return LspRenameCoordinator.instance;
  }

  public getCurrentOperationId(): string | null {
    return this.currentOperationId;
  }

  public getProvider(): LspRenameProvider {
    return this.provider;
  }

  /**
   * Prepares rename for the symbol at the given cursor coordinates.
   */
  public async prepareRename(
    request: LspPrepareRenameRequest
  ): Promise<RenameValidationResult<PreparedRenameResult>> {
    return this.provider.prepareRename(request);
  }

  /**
   * Generates a read-only preview of the proposed rename without modifying any documents.
   */
  public async previewRename(
    request: LspRenameRequest
  ): Promise<RenameValidationResult<CodeActionPreview>> {
    const renameRes = await this.provider.requestRename(request);
    if (!renameRes.valid || !renameRes.value) {
      return {
        valid: false,
        error: renameRes.error || 'Failed to generate rename plan.',
        status: renameRes.status,
      };
    }

    const edit = renameRes.value;
    const action: CodeAction = {
      id: `rename-${Date.now()}`,
      providerId: 'lsp.rename',
      title: `Rename to '${request.newName}'`,
      kind: 'refactor.rewrite',
      edit,
      documentRevision: request.documentRevision,
      workspaceGeneration: request.workspaceGeneration,
    };

    const preview = await this.codeActionCoordinator.previewCodeAction(action);
    return { valid: true, value: preview, status: 'valid' };
  }

  /**
   * Executes a confirmed rename transaction through the central Code Action
   * and Edit Transaction architecture.
   */
  public async executeRename(
    request: LspRenameRequest,
    oldName: string
  ): Promise<RenameExecutionResult> {
    const opId = `op-rename-${Date.now()}`;
    this.currentOperationId = opId;

    logger.info('LspRenameCoordinator: starting rename execution', {
      operationId: opId,
      documentId: request.documentId,
      oldName,
      newName: request.newName,
    });

    const renameRes = await this.provider.requestRename(request);
    if (!renameRes.valid || !renameRes.value) {
      const err = renameRes.error || 'Rename failed: language server returned an invalid edit.';
      globalFeedbackService.showError(err);
      return {
        status: 'rejected',
        operationId: opId,
        oldName,
        newName: request.newName,
        affectedFilesCount: 0,
        appliedEditsCount: 0,
        affectedDocuments: [],
        error: err,
      };
    }

    const edit = renameRes.value;
    const action: CodeAction = {
      id: opId,
      providerId: 'lsp.rename',
      title: `Rename '${oldName}' to '${request.newName}'`,
      kind: 'refactor.rewrite',
      edit,
      documentRevision: request.documentRevision,
      workspaceGeneration: globalWorkspaceEngine.getGeneration(),
    };

    // Apply transactionally through CodeActionCoordinator
    const execRes = await this.codeActionCoordinator.applyCodeAction(action, {
      documentId: request.documentId,
      expectedRevision: request.documentRevision,
    });

    if (execRes.status === 'applied') {
      const fileCount = Object.keys(edit.changes || {}).length;
      const msg = `Successfully renamed '${oldName}' to '${request.newName}' across ${fileCount} file(s).`;
      globalFeedbackService.showSuccess(msg);

      return {
        status: 'applied',
        operationId: opId,
        oldName,
        newName: request.newName,
        affectedFilesCount: fileCount,
        appliedEditsCount: execRes.appliedEditsCount,
        affectedDocuments: execRes.affectedDocuments,
        edit,
      };
    } else {
      const err = execRes.error || `Failed to apply rename transaction (${execRes.status}).`;
      globalFeedbackService.showError(err);

      return {
        status: 'failed',
        operationId: opId,
        oldName,
        newName: request.newName,
        affectedFilesCount: 0,
        appliedEditsCount: 0,
        affectedDocuments: [],
        error: err,
      };
    }
  }
}

export const globalLspRenameCoordinator = LspRenameCoordinator.getInstance();
