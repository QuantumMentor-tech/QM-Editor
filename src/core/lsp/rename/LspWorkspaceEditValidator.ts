/**
 * QM Editor LSP WorkspaceEdit & Rename Validator
 * Phase 06, Step 62 — LSP Rename, Prepare Rename & Safe Multi-File Workspace Edit Integration
 */

import { LspRange, LspWorkspaceEdit, LspTextEdit, LspResourceOperation } from '../LspTypes';
import { RenameValidationResult } from './LspRenameTypes';
import { LspLocationValidator } from '../navigation/LspLocationValidator';
import { LspUriMapper } from '../LspUriMapper';
import { globalDocumentEngine, DocumentEngine } from '../../documents/DocumentEngine';
import { codeActionRangeToOffsets } from '../../language-intelligence/CodeActionCoordinator';

export class LspWorkspaceEditValidator {
  public static readonly MAX_NAME_LENGTH = 256;

  /**
   * Validates a proposed new symbol name.
   */
  public static validateNewName(
    newName: unknown,
    currentName?: string
  ): RenameValidationResult<string> {
    if (typeof newName !== 'string') {
      return { valid: false, error: 'Symbol name must be a string.', status: 'invalid_name' };
    }

    const trimmed = newName.trim();
    if (!trimmed) {
      return { valid: false, error: 'Symbol name cannot be empty or whitespace.', status: 'invalid_name' };
    }

    if (/[\x00-\x1F\x7F]/.test(newName)) {
      return { valid: false, error: 'Symbol name cannot contain control characters.', status: 'invalid_name' };
    }

    if (/\r|\n/.test(newName)) {
      return { valid: false, error: 'Symbol name cannot span multiple lines.', status: 'invalid_name' };
    }

    if (trimmed.length > this.MAX_NAME_LENGTH) {
      return {
        valid: false,
        error: `Symbol name cannot exceed ${this.MAX_NAME_LENGTH} characters.`,
        status: 'invalid_name',
      };
    }

    if (currentName && trimmed === currentName.trim()) {
      return {
        valid: false,
        error: 'The new name must be different from the current name.',
        status: 'invalid_name',
      };
    }

    return { valid: true, value: trimmed, status: 'valid' };
  }

  /**
   * Validates a URI from a language server WorkspaceEdit.
   */
  public static validateEditUri(rawUri: unknown): RenameValidationResult<string> {
    const uriVal = LspLocationValidator.validateUri(rawUri);
    if (!uriVal.valid || !uriVal.value) {
      return {
        valid: false,
        error: uriVal.error || 'Invalid resource URI in WorkspaceEdit.',
        status: 'invalid_uri',
      };
    }

    // Check for directory traversal attempts
    if (uriVal.value.includes('../') || uriVal.value.includes('..\\')) {
      return {
        valid: false,
        error: `Unsafe path traversal detected in URI: ${uriVal.value}`,
        status: 'invalid_uri',
      };
    }

    return { valid: true, value: uriVal.value, status: 'valid' };
  }

  /**
   * Validates that an edit range is well-formed.
   */
  public static validateRange(range: unknown): RenameValidationResult<LspRange> {
    const rangeVal = LspLocationValidator.validateRange(range);
    if (!rangeVal.valid || !rangeVal.value) {
      return {
        valid: false,
        error: rangeVal.error || 'Invalid edit range in WorkspaceEdit.',
        status: 'invalid_range',
      };
    }

    return { valid: true, value: rangeVal.value, status: 'valid' };
  }

  /**
   * Validates an entire LSP WorkspaceEdit before conversion or execution.
   */
  public static validateWorkspaceEdit(
    edit: unknown,
    options?: {
      documentEngine?: DocumentEngine;
      expectedWorkspaceId?: string;
    }
  ): RenameValidationResult<void> {
    if (!edit || typeof edit !== 'object') {
      return { valid: false, error: 'WorkspaceEdit must be a non-null object.' };
    }

    const docEngine = options?.documentEngine ?? globalDocumentEngine;
    const lspEdit = edit as LspWorkspaceEdit;

    const hasChanges = Boolean(lspEdit.changes && Object.keys(lspEdit.changes).length > 0);
    const hasDocChanges = Boolean(lspEdit.documentChanges && lspEdit.documentChanges.length > 0);

    if (!hasChanges && !hasDocChanges) {
      return { valid: false, error: 'WorkspaceEdit contains no changes or documentChanges.' };
    }

    // Collect all text edits by canonical path
    const editsByPath = new Map<string, LspTextEdit[]>();

    // 1. Validate 'changes' map if present
    if (lspEdit.changes) {
      for (const [rawUri, edits] of Object.entries(lspEdit.changes)) {
        const uriVal = this.validateEditUri(rawUri);
        if (!uriVal.valid || !uriVal.value) {
          return { valid: false, error: uriVal.error, status: uriVal.status };
        }

        const canonicalPath = LspUriMapper.uriToPath(uriVal.value);
        if (!Array.isArray(edits)) {
          return { valid: false, error: `Edits for "${rawUri}" must be an array.`, status: 'invalid_range' };
        }

        for (const te of edits) {
          const rVal = this.validateRange(te?.range);
          if (!rVal.valid || !rVal.value) {
            return { valid: false, error: rVal.error, status: rVal.status };
          }
          if (typeof te.newText !== 'string') {
            return { valid: false, error: 'TextEdit newText must be a string.', status: 'invalid_name' };
          }
        }

        const list = editsByPath.get(canonicalPath) || [];
        list.push(...edits);
        editsByPath.set(canonicalPath, list);
      }
    }

    // 2. Validate 'documentChanges' if present
    if (lspEdit.documentChanges) {
      for (const change of lspEdit.documentChanges) {
        if ('kind' in change) {
          // Resource operation
          const resOp = change as LspResourceOperation;
          if (resOp.kind === 'create' || resOp.kind === 'delete') {
            const uriVal = this.validateEditUri(resOp.uri);
            if (!uriVal.valid || !uriVal.value) {
              return { valid: false, error: uriVal.error, status: uriVal.status };
            }
          } else if (resOp.kind === 'rename') {
            const oldVal = this.validateEditUri(resOp.oldUri);
            if (!oldVal.valid || !oldVal.value) {
              return { valid: false, error: oldVal.error, status: oldVal.status };
            }
            const newVal = this.validateEditUri(resOp.newUri);
            if (!newVal.valid || !newVal.value) {
              return { valid: false, error: newVal.error, status: newVal.status };
            }
          }
        } else if ('textDocument' in change && 'edits' in change) {
          // Versioned text document edit
          const uriVal = this.validateEditUri(change.textDocument?.uri);
          if (!uriVal.valid || !uriVal.value) {
            return { valid: false, error: uriVal.error, status: uriVal.status };
          }

          const canonicalPath = LspUriMapper.uriToPath(uriVal.value);
          if (!Array.isArray(change.edits)) {
            return { valid: false, error: `Edits for "${uriVal.value}" must be an array.`, status: 'invalid_range' };
          }

          for (const te of change.edits) {
            const rVal = this.validateRange(te?.range);
            if (!rVal.valid || !rVal.value) {
              return { valid: false, error: rVal.error, status: rVal.status };
            }
            if (typeof te.newText !== 'string') {
              return { valid: false, error: 'TextEdit newText must be a string.', status: 'invalid_name' };
            }
          }

          const list = editsByPath.get(canonicalPath) || [];
          list.push(...change.edits);
          editsByPath.set(canonicalPath, list);
        }
      }
    }

    // 3. Validate against open documents, read-only checks, and overlapping edits
    for (const [canonicalPath, edits] of editsByPath.entries()) {
      const openDoc =
        docEngine.getByResource(canonicalPath) ||
        docEngine.getAllDocuments().find(
          (d) =>
            d.resourceUri === canonicalPath ||
            d.filePath === canonicalPath ||
            LspUriMapper.uriToPath(d.resourceUri) === canonicalPath
        );

      if (openDoc) {
        if (openDoc.metadata.isReadOnly) {
          return {
            valid: false,
            error: `Target document "${openDoc.title}" is read-only.`,
            status: 'read_only',
          };
        }

        if (openDoc.metadata.hasConflict) {
          return {
            valid: false,
            error: `Target document "${openDoc.title}" has an unresolved disk conflict.`,
            status: 'conflict',
          };
        }

        const content = openDoc.content;
        const lines = content.split('\n');

        // Check for out-of-bounds line and column coordinates
        for (const e of edits) {
          const sLine = e.range.start.line + 1;
          const eLine = e.range.end.line + 1;
          const sCol = e.range.start.character + 1;
          const eCol = e.range.end.character + 1;

          if (
            sLine < 1 ||
            sLine > lines.length ||
            eLine < 1 ||
            eLine > lines.length ||
            sCol < 1 ||
            sCol > (lines[sLine - 1]?.length ?? 0) + 1 ||
            eCol < 1 ||
            eCol > (lines[eLine - 1]?.length ?? 0) + 1
          ) {
            return {
              valid: false,
              error: `Edit range is out of bounds for "${openDoc.title}".`,
              status: 'invalid_range',
            };
          }
        }

        const converted = edits.map((e) => {
          const canonicalRange = {
            startLine: e.range.start.line + 1,
            startColumn: e.range.start.character + 1,
            endLine: e.range.end.line + 1,
            endColumn: e.range.end.character + 1,
          };
          return codeActionRangeToOffsets(content, canonicalRange);
        });

        // Check for overlapping edits
        const sorted = [...converted].sort((a, b) => a.from - b.from);
        for (let i = 0; i < sorted.length - 1; i++) {
          if (sorted[i].to > sorted[i + 1].from) {
            return {
              valid: false,
              error: `Overlapping edit ranges detected for file "${openDoc.title}".`,
              status: 'overlapping_edits',
            };
          }
        }
      }
    }

    return { valid: true, status: 'valid' };
  }
}
