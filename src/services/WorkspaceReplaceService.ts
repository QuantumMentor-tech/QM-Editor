import { QuickOpenResource } from './WorkspaceIndexService';
import { WorkspaceSearchQuery, WorkspaceMatchItem, WorkspaceFileSearchResult } from './WorkspaceSearchService';
import { searchService } from './SearchService';
import { fileService } from './FileService';
import { DocumentModel } from '../types';
import { globalEditorCoordinationService } from '../core/editor';
import { globalDocumentEngine } from '../core/documents';
import { logger } from '../utils/logger';

export interface FileReplaceItemPlan {
  resource: QuickOpenResource;
  matches: WorkspaceMatchItem[];
  oldContent: string;
  newContent: string;
  status: 'ready' | 'dirty_open' | 'read_only' | 'conflict' | 'error';
  statusMessage?: string;
}

export interface WorkspaceReplacePlan {
  query: WorkspaceSearchQuery;
  replaceText: string;
  filePlans: FileReplaceItemPlan[];
  totalMatchesCount: number;
  totalFilesCount: number;
  readyFilesCount: number;
  blockedFilesCount: number;
}

export interface WorkspaceReplaceResult {
  replacedFilesCount: number;
  totalReplacedMatchesCount: number;
  skippedFilesCount: number;
  errors: string[];
}

export class WorkspaceReplaceService {
  /**
   * Generates a previewable replacement plan and validates target file states
   */
  public static async buildReplacePlan(
    searchResults: WorkspaceFileSearchResult[],
    query: WorkspaceSearchQuery,
    replaceText: string,
    openDocs: DocumentModel[] = []
  ): Promise<WorkspaceReplacePlan> {
    const filePlans: FileReplaceItemPlan[] = [];
    let totalMatchesCount = 0;
    let readyFilesCount = 0;
    let blockedFilesCount = 0;

    for (const result of searchResults) {
      if (result.matches.length === 0 || result.isSkipped || result.error) {
        continue;
      }

      totalMatchesCount += result.matches.length;

      // Find if resource is loaded in an open tab
      const openDoc = openDocs.find(
        (d) =>
          (d.fileResource && d.fileResource.uri.toLowerCase() === result.resource.uri.toLowerCase()) ||
          (d.filePath && d.filePath.toLowerCase() === result.resource.uri.toLowerCase())
      );

      let status: 'ready' | 'dirty_open' | 'read_only' | 'conflict' | 'error' = 'ready';
      let statusMessage: string | undefined = undefined;
      let oldContent = '';

      if (openDoc) {
        if (openDoc.isDirty) {
          status = 'dirty_open';
          statusMessage = 'File has unsaved changes in open tab. Save or revert before replacing.';
        } else if (openDoc.fileResource?.readOnly) {
          status = 'read_only';
          statusMessage = 'File is read-only.';
        }
        oldContent = openDoc.content;
      } else {
        try {
          if (result.resource.handle && result.resource.handle.kind === 'file') {
            const readData = await fileService.readFile(result.resource.handle as FileSystemFileHandle);
            oldContent = readData.content;
            if (readData.resource.readOnly) {
              status = 'read_only';
              statusMessage = 'File is read-only.';
            }
          } else {
            status = 'error';
            statusMessage = 'File handle is not accessible for replacement.';
          }
        } catch (err) {
          status = 'error';
          statusMessage = (err as Error).message || 'Failed to read file for replacement.';
        }
      }

      let newContent = oldContent;
      if (status === 'ready' && oldContent) {
        // Convert matches to SearchMatch format for atomic replaceAllMatches
        const searchMatches = result.matches.map((m) => ({
          id: m.id,
          from: m.from,
          to: m.to,
          line: m.line,
          column: m.column,
          preview: m.lineText,
        }));

        const replaced = searchService.replaceAllMatches(oldContent, searchMatches, replaceText);
        newContent = replaced.newContent;
      }

      if (status === 'ready') {
        readyFilesCount += 1;
      } else {
        blockedFilesCount += 1;
      }

      filePlans.push({
        resource: result.resource,
        matches: result.matches,
        oldContent,
        newContent,
        status,
        statusMessage,
      });
    }

    return {
      query,
      replaceText,
      filePlans,
      totalMatchesCount,
      totalFilesCount: filePlans.length,
      readyFilesCount,
      blockedFilesCount,
    };
  }

  /**
   * Executes a validated replacement plan after explicit user confirmation
   */
  public static async executeReplacePlan(
    plan: WorkspaceReplacePlan,
    openDocs: DocumentModel[] = [],
    updateText?: (id: string, text: string) => void
  ): Promise<WorkspaceReplaceResult> {
    let replacedFilesCount = 0;
    let totalReplacedMatchesCount = 0;
    let skippedFilesCount = 0;
    const errors: string[] = [];

    for (const filePlan of plan.filePlans) {
      if (filePlan.status !== 'ready') {
        skippedFilesCount += 1;
        if (filePlan.statusMessage) {
          errors.push(`${filePlan.resource.relativePath}: ${filePlan.statusMessage}`);
        }
        continue;
      }

      const openDoc = openDocs.find(
        (d) =>
          (d.fileResource && d.fileResource.uri.toLowerCase() === filePlan.resource.uri.toLowerCase()) ||
          (d.filePath && d.filePath.toLowerCase() === filePlan.resource.uri.toLowerCase())
      );

      try {
        if (openDoc && globalDocumentEngine.hasDocument(openDoc.id)) {
          const matchEdits = filePlan.matches.map((m) => ({
            from: m.from,
            to: m.to,
            insertText: plan.replaceText,
          }));
          matchEdits.sort((a, b) => a.from - b.from);
          const txRes = await globalEditorCoordinationService.applyTransaction({
            documentId: openDoc.id,
            expectedRevision: openDoc.contentRevision,
            source: 'replace',
            changes: matchEdits,
            description: 'Multi-file replace',
          });

          if (txRes.status !== 'applied') {
            throw new Error(txRes.error || `Transaction failed with status ${txRes.status}`);
          }
          if (updateText) {
            updateText(openDoc.id, filePlan.newContent);
          }
        } else if (openDoc && updateText) {
          // Synchronize open document tab in-memory fallback
          updateText(openDoc.id, filePlan.newContent);
        } else {
          // Write directly to disk for closed files
          const target = filePlan.resource.handle || filePlan.resource.uri;
          await fileService.writeFile(target as any, filePlan.newContent);
        }

        replacedFilesCount += 1;
        totalReplacedMatchesCount += filePlan.matches.length;
      } catch (err) {
        const msg = (err as Error).message || 'Failed to write replacement';
        logger.error('Failed to apply replacement to file', { file: filePlan.resource.relativePath, error: msg });
        errors.push(`${filePlan.resource.relativePath}: ${msg}`);
        skippedFilesCount += 1;
      }
    }

    logger.info('Workspace multi-file replace plan executed', {
      replacedFilesCount,
      totalReplacedMatchesCount,
      skippedFilesCount,
    });

    return {
      replacedFilesCount,
      totalReplacedMatchesCount,
      skippedFilesCount,
      errors,
    };
  }
}
