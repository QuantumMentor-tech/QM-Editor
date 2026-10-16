/**
 * QM Editor LSP Formatting Adapter & Coordinate Mapper
 * Phase 06, Step 63 — LSP Document Formatting, Range Formatting & Safe Formatting Edit Integration
 */

import { FormattingOptions, LspRange, LspTextEdit } from '../LspTypes';
import { Range } from '../../navigation/LocationTypes';
import { TextEdit } from '../../language-intelligence/CodeActionTypes';
import { LspLocationMapper } from '../navigation/LspLocationMapper';
import { SettingsService } from '../../settings/SettingsService';
import { SingleTextEdit } from '../../edit/EditTypes';
import { LspFormattingValidator } from './LspFormattingValidator';

export class LspFormattingMapper {
  /**
   * Resolves authoritative formatting options from the settings service,
   * merging any explicit user or caller overrides.
   */
  public static resolveFormattingOptions(overrides?: Partial<FormattingOptions>): FormattingOptions {
    const settings = SettingsService.getInstance();
    const tabSize = Number(settings.get('editor.tabSize')) || 2;
    const insertSpaces = settings.get('editor.insertSpaces') !== false;
    const trimTrailingWhitespace = Boolean(
      settings.get('lsp.formatting.trimTrailingWhitespace')
    );
    const insertFinalNewline = Boolean(
      settings.get('lsp.formatting.insertFinalNewline')
    );
    const trimFinalNewlines = Boolean(
      settings.get('lsp.formatting.trimFinalNewlines')
    );

    return {
      tabSize,
      insertSpaces,
      trimTrailingWhitespace,
      insertFinalNewline,
      trimFinalNewlines,
      ...overrides,
    };
  }

  /**
   * Maps a canonical 1-based QM Editor Range to a 0-based LSP Range.
   */
  public static mapToLspRange(canonical: Range): LspRange {
    return {
      start: {
        line: Math.max(0, canonical.startLine - 1),
        character: Math.max(0, canonical.startColumn - 1),
      },
      end: {
        line: Math.max(0, canonical.endLine - 1),
        character: Math.max(0, canonical.endColumn - 1),
      },
    };
  }

  /**
   * Maps an LSP TextEdit (0-based) into a canonical QM Editor TextEdit (1-based).
   */
  public static mapToCanonicalEdit(edit: LspTextEdit, resourceUri: string): TextEdit {
    const canonicalRange = LspLocationMapper.mapLspRange(edit.range);
    return {
      resourceUri,
      range: canonicalRange,
      newText: edit.newText,
    };
  }

  /**
   * Maps an array of LSP TextEdits into canonical QM Editor TextEdits.
   */
  public static mapToCanonicalEdits(edits: LspTextEdit[], resourceUri: string): TextEdit[] {
    return edits.map((e) => this.mapToCanonicalEdit(e, resourceUri));
  }

  /**
   * Converts an array of LSP TextEdits directly into SingleTextEdits ({ from, to, insertText })
   * with accurate character offsets on the given document content, sorted in ascending offset order
   * for transaction execution.
   */
  public static mapToTransactionEdits(
    edits: LspTextEdit[],
    content: string
  ): SingleTextEdit[] {
    const singleEdits: SingleTextEdit[] = edits.map((e) => {
      const from = LspFormattingValidator.lspPositionToOffset(
        content,
        e.range.start.line,
        e.range.start.character
      );
      const to = LspFormattingValidator.lspPositionToOffset(
        content,
        e.range.end.line,
        e.range.end.character
      );
      return {
        from,
        to,
        insertText: e.newText,
      };
    });

    // Ascending order for transaction application
    return singleEdits.sort((a, b) => a.from - b.from || a.to - b.to);
  }
}
