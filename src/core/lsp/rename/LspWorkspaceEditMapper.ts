/**
 * QM Editor LSP WorkspaceEdit Mapper
 * Phase 06, Step 62 — LSP Rename, Prepare Rename & Safe Multi-File Workspace Edit Integration
 */

import { LspWorkspaceEdit, LspTextEdit, LspResourceOperation } from '../LspTypes';
import { WorkspaceEdit, TextEdit, ResourceEditOperation } from '../../language-intelligence/CodeActionTypes';
import { LspUriMapper } from '../LspUriMapper';
import { LspLocationMapper } from '../navigation/LspLocationMapper';

export class LspWorkspaceEditMapper {
  /**
   * Maps an LSP TextEdit to a canonical QM Editor TextEdit.
   */
  public static mapTextEdit(edit: LspTextEdit, resourceUri: string): TextEdit {
    const canonicalUri = LspUriMapper.uriToPath(resourceUri);
    const canonicalRange = LspLocationMapper.mapLspRange(edit.range);

    return {
      resourceUri: canonicalUri,
      range: canonicalRange,
      newText: edit.newText,
    };
  }

  /**
   * Maps an LSP ResourceOperation to a canonical QM Editor ResourceEditOperation.
   */
  public static mapResourceOperation(op: LspResourceOperation): ResourceEditOperation | null {
    switch (op.kind) {
      case 'create':
        return {
          type: 'createFile',
          uri: LspUriMapper.uriToPath(op.uri),
          options: op.options,
        };
      case 'rename':
        return {
          type: 'renameFile',
          oldUri: LspUriMapper.uriToPath(op.oldUri),
          newUri: LspUriMapper.uriToPath(op.newUri),
          options: op.options,
        };
      case 'delete':
        return {
          type: 'deleteFile',
          uri: LspUriMapper.uriToPath(op.uri),
          options: op.options,
        };
      default:
        return null;
    }
  }

  /**
   * Maps an LSP WorkspaceEdit into QM Editor's canonical WorkspaceEdit model.
   * Seamlessly unifies both 'changes' dictionary and 'documentChanges' sequence.
   */
  public static mapWorkspaceEdit(lspEdit: LspWorkspaceEdit): WorkspaceEdit {
    const changesMap: Record<string, TextEdit[]> = {};
    const resourceOps: ResourceEditOperation[] = [];

    // 1. Process 'changes' map if present
    if (lspEdit.changes) {
      for (const [rawUri, edits] of Object.entries(lspEdit.changes)) {
        if (!Array.isArray(edits)) continue;
        const canonicalPath = LspUriMapper.uriToPath(rawUri);
        const mappedEdits = edits.map((e: LspTextEdit) => this.mapTextEdit(e, canonicalPath));
        if (!changesMap[canonicalPath]) {
          changesMap[canonicalPath] = [];
        }
        changesMap[canonicalPath].push(...mappedEdits);
      }
    }

    // 2. Process 'documentChanges' if present
    if (lspEdit.documentChanges) {
      for (const change of lspEdit.documentChanges) {
        if ('kind' in change) {
          const mappedOp = this.mapResourceOperation(change as LspResourceOperation);
          if (mappedOp) {
            resourceOps.push(mappedOp);
          }
        } else if ('textDocument' in change && 'edits' in change) {
          const docEdit = change as { textDocument: { uri: string }; edits: LspTextEdit[] };
          const canonicalPath = LspUriMapper.uriToPath(docEdit.textDocument.uri);
          const mappedEdits = (docEdit.edits || []).map((e: LspTextEdit) => this.mapTextEdit(e, canonicalPath));
          if (!changesMap[canonicalPath]) {
            changesMap[canonicalPath] = [];
          }
          changesMap[canonicalPath].push(...mappedEdits);
        }
      }
    }

    return {
      changes: Object.keys(changesMap).length > 0 ? changesMap : undefined,
      resourceOperations: resourceOps.length > 0 ? resourceOps : undefined,
    };
  }
}
