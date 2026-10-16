/**
 * QM Editor LSP Completion Mapper
 * Phase 06, Step 58 — LSP Completion Integration, Suggestion Intelligence & Safe Completion Acceptance
 *
 * Converts validated 0-based LSP completion items and protocol structures into canonical 1-based
 * QM Editor CompletionItem and CompletionResult models. Preserves provider identity, edit ranges,
 * sort hints, commit characters, and resolve metadata.
 */

import {
  LspCompletionItem,
  LspCompletionResponse,
  LspTextEdit,
  LspInsertReplaceEdit,
} from '../LspTypes';
import {
  CompletionItem,
  CompletionItemKind,
  CompletionResult,
  CompletionRequest,
} from '../../language-intelligence/LanguageIntelligenceTypes';
import { Range } from '../../navigation/LocationTypes';
import { LspCompletionValidator } from './LspCompletionValidator';

export class LspCompletionMapper {
  /**
   * Translates LSP numeric CompletionItemKind (1..25) to QM Editor's canonical CompletionItemKind.
   */
  public static mapCompletionKind(lspKind?: number): CompletionItemKind {
    switch (lspKind) {
      case 1:
        return 'text';
      case 2:
        return 'method';
      case 3:
        return 'function';
      case 4:
        return 'constructor';
      case 5:
        return 'field';
      case 6:
        return 'variable';
      case 7:
        return 'class';
      case 8:
        return 'interface';
      case 9:
        return 'module';
      case 10:
        return 'property';
      case 11:
      case 12:
        return 'value';
      case 13:
        return 'enum';
      case 14:
        return 'keyword';
      case 15:
        return 'snippet';
      case 16:
        return 'value';
      case 17:
        return 'file';
      case 18:
        return 'reference';
      case 19:
        return 'file';
      case 20:
        return 'enum';
      case 21:
        return 'constant';
      case 22:
        return 'class';
      case 23:
        return 'method';
      case 24:
        return 'keyword';
      case 25:
        return 'type';
      default:
        return 'text';
    }
  }

  /**
   * Converts a single validated LspCompletionItem into a canonical QM Editor CompletionItem.
   */
  public static toCanonicalCompletionItem(
    lspItem: LspCompletionItem,
    providerId: string,
    index: number,
    priority: number = 100
  ): CompletionItem {
    const kind = LspCompletionMapper.mapCompletionKind(lspItem.kind);

    // Primary insert text selection
    let insertText: string;
    let range: Range | undefined;

    if (lspItem.textEdit) {
      if ('range' in lspItem.textEdit && lspItem.textEdit.range) {
        const standardEdit = lspItem.textEdit as LspTextEdit;
        insertText = standardEdit.newText;
        range = {
          startLine: standardEdit.range.start.line + 1,
          startColumn: standardEdit.range.start.character + 1,
          endLine: standardEdit.range.end.line + 1,
          endColumn: standardEdit.range.end.character + 1,
        };
      } else if ('insert' in lspItem.textEdit && lspItem.textEdit.insert) {
        const irEdit = lspItem.textEdit as LspInsertReplaceEdit;
        insertText = irEdit.newText;
        range = {
          startLine: irEdit.insert.start.line + 1,
          startColumn: irEdit.insert.start.character + 1,
          endLine: irEdit.insert.end.line + 1,
          endColumn: irEdit.insert.end.character + 1,
        };
      } else {
        insertText = lspItem.insertText || lspItem.label;
      }
    } else {
      insertText = lspItem.insertText || lspItem.label;
    }

    // Additional text edits (e.g. imports or secondary changes)
    let additionalTextEdits: Array<{ range: Range; newText: string }> | undefined;
    if (lspItem.additionalTextEdits && lspItem.additionalTextEdits.length > 0) {
      additionalTextEdits = lspItem.additionalTextEdits.map((edit) => ({
        range: {
          startLine: edit.range.start.line + 1,
          startColumn: edit.range.start.character + 1,
          endLine: edit.range.end.line + 1,
          endColumn: edit.range.end.character + 1,
        },
        newText: edit.newText,
      }));
    }

    // Documentation
    const documentation = typeof lspItem.documentation === 'string'
      ? lspItem.documentation
      : lspItem.documentation?.value;

    return {
      id: `${providerId}:${lspItem.label}-${index}`,
      label: lspItem.label,
      kind,
      insertText,
      detail: lspItem.detail,
      documentation,
      filterText: lspItem.filterText,
      sortText: lspItem.sortText,
      range,
      additionalTextEdits,
      providerId,
      priority,
      commitCharacters: lspItem.commitCharacters,
      data: {
        rawItem: lspItem,
        serverData: lspItem.data,
      },
    };
  }

  /**
   * Converts a full LSP completion response into a canonical CompletionResult.
   */
  public static toCanonicalCompletionResult(
    lspResponse: LspCompletionResponse,
    request: CompletionRequest,
    providerId: string,
    priority: number = 100,
    maxItems: number = LspCompletionValidator.DEFAULT_MAX_ITEMS
  ): CompletionResult {
    const validated = LspCompletionValidator.validatePayload(lspResponse, maxItems);

    const items: CompletionItem[] = validated.items.map((lspItem, idx) =>
      LspCompletionMapper.toCanonicalCompletionItem(lspItem, providerId, idx, priority)
    );

    return {
      items,
      isIncomplete: validated.isIncomplete,
      providerId,
      requestId: request.requestId,
      revision: request.revision,
      generation: 1,
    };
  }
}
