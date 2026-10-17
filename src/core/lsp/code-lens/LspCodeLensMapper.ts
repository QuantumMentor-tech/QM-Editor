/**
 * QM Editor - LSP Code Lens Mapper
 * Phase 06, Step 66 — LSP Code Lens, Inline Actions & Safe Command Integration
 * 
 * Maps raw language server CodeLens responses into canonical models, verifies document bounds,
 * groups lenses by document line, and generates line offsets for CodeMirror block widgets.
 */

import { Logger } from '../../../utils/logger';
import { globalCommandRegistry, CommandRegistry } from '../../commands/CommandRegistry';
import { LspCodeLens } from '../LspTypes';
import {
  CanonicalCodeLens,
  CanonicalCodeLensCommand,
  EditorCodeLensLine,
} from './LspCodeLensTypes';
import { LspCodeLensSecurityValidator } from './LspCodeLensSecurityValidator';

export class LspCodeLensMapper {
  /** Maximum number of code lenses accepted per document to prevent memory DoS */
  public static readonly MAX_LENSES_PER_DOCUMENT = 500;

  /**
   * Maps a raw LSP CodeLens array into canonical code lenses and line groupings.
   */
  public static mapToLines(
    uri: string,
    documentRevision: number,
    providerId: string,
    sessionId: string,
    rawLenses: unknown,
    documentText: string,
    commandRegistry: CommandRegistry = globalCommandRegistry
  ): { lenses: CanonicalCodeLens[]; lines: EditorCodeLensLine[] } {
    if (!Array.isArray(rawLenses)) {
      if (rawLenses !== null && rawLenses !== undefined) {
        Logger.warn('LspCodeLensMapper: Expected array of code lenses, received non-array', {
          type: typeof rawLenses,
        });
      }
      return { lenses: [], lines: [] };
    }

    const lines = documentText.split('\n');
    const lineStarts = this.computeLineStarts(documentText);
    const count = Math.min(rawLenses.length, this.MAX_LENSES_PER_DOCUMENT);

    if (rawLenses.length > this.MAX_LENSES_PER_DOCUMENT) {
      Logger.warn(
        `LspCodeLensMapper: Response contained ${rawLenses.length} lenses, capped at ${this.MAX_LENSES_PER_DOCUMENT}`
      );
    }

    const validLenses: CanonicalCodeLens[] = [];
    const lensesByLine = new Map<number, CanonicalCodeLens[]>();

    for (let i = 0; i < count; i++) {
      const raw = rawLenses[i] as Partial<LspCodeLens>;
      if (!raw || typeof raw !== 'object') continue;

      if (!LspCodeLensSecurityValidator.validateRange(raw.range, lines)) {
        continue;
      }

      const range = raw.range!;
      const lineIndex = range.start.line;

      // Validate command if present
      let command: CanonicalCodeLensCommand | undefined;
      let isResolved = false;

      if (raw.command) {
        const cmdValidation = LspCodeLensSecurityValidator.validateCommand(raw.command, commandRegistry);
        if (cmdValidation.isValid && cmdValidation.sanitizedCommand) {
          command = cmdValidation.sanitizedCommand;
          isResolved = true;
        } else if (typeof raw.command.title === 'string' && raw.command.title.trim().length > 0) {
          command = {
            title: LspCodeLensSecurityValidator.sanitizeText(raw.command.title, LspCodeLensSecurityValidator.MAX_TITLE_LENGTH),
            command: typeof raw.command.command === 'string' ? raw.command.command.trim() : 'unknown',
            arguments: Array.isArray(raw.command.arguments) ? raw.command.arguments : undefined,
            source: 'lsp',
            isTrusted: false,
          };
          isResolved = true;
          Logger.debug('LspCodeLensMapper: Code lens command marked as untrusted', {
            reason: cmdValidation.reason,
            command: raw.command.command,
          });
        }
      }

      const id = `${uri}:${lineIndex}:${range.start.character}:${providerId}:${i}`;

      const canonical: CanonicalCodeLens = {
        id,
        uri,
        documentRevision,
        range,
        command,
        data: raw.data,
        isResolved,
        providerId,
        sessionId,
      };

      validLenses.push(canonical);

      let lineLenses = lensesByLine.get(lineIndex);
      if (!lineLenses) {
        lineLenses = [];
        lensesByLine.set(lineIndex, lineLenses);
      }
      lineLenses.push(canonical);
    }

    // Build sorted EditorCodeLensLine array
    const sortedLineIndices = Array.from(lensesByLine.keys()).sort((a, b) => a - b);
    const editorLines: EditorCodeLensLine[] = [];

    for (const lineIndex of sortedLineIndices) {
      const lineLenses = lensesByLine.get(lineIndex) || [];
      // Sort lenses on the same line by start character, then title
      lineLenses.sort((a, b) => {
        if (a.range.start.character !== b.range.start.character) {
          return a.range.start.character - b.range.start.character;
        }
        return (a.command?.title || '').localeCompare(b.command?.title || '');
      });

      const lineStartOffset = lineStarts[lineIndex] ?? 0;

      editorLines.push({
        line: lineIndex,
        from: lineStartOffset,
        lenses: lineLenses,
      });
    }

    return {
      lenses: validLenses,
      lines: editorLines,
    };
  }

  /**
   * Precomputes line start offsets for fast index-to-offset conversion.
   */
  public static computeLineStarts(text: string): number[] {
    const starts: number[] = [0];
    const len = text.length;

    for (let i = 0; i < len; i++) {
      if (text.charCodeAt(i) === 10 /* '\n' */) {
        starts.push(i + 1);
      }
    }

    return starts;
  }
}
