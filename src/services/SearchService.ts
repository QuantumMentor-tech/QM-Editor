import { SearchQuery, SearchMatch } from '../types';
import { logger } from '../utils/logger';

export class SearchService {
  /**
   * Helper to escape special regex characters for plain text whole-word search
   */
  public escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Builds an array of line start character offsets for fast line/column resolution
   */
  private getLineStarts(content: string): number[] {
    const starts = [0];
    for (let i = 0; i < content.length; i++) {
      if (content[i] === '\n') {
        starts.push(i + 1);
      }
    }
    return starts;
  }

  /**
   * Resolves 1-indexed line and column for a character offset position
   */
  private getLineAndColumn(lineStarts: number[], offset: number): { line: number; column: number } {
    let low = 0;
    let high = lineStarts.length - 1;
    let lineIndex = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (lineStarts[mid] <= offset) {
        lineIndex = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const line = lineIndex + 1;
    const column = offset - lineStarts[lineIndex] + 1;
    return { line, column };
  }

  /**
   * Executes search on document text content using SearchQuery options
   */
  public executeSearch(
    content: string,
    query: SearchQuery
  ): { matches: SearchMatch[]; error: string | null } {
    if (!query.text) {
      return { matches: [], error: null };
    }

    const lineStarts = this.getLineStarts(content);
    const matches: SearchMatch[] = [];

    try {
      let regExp: RegExp;
      const flags = `g${query.caseSensitive ? '' : 'i'}`;

      if (query.regex) {
        let pattern = query.text;
        if (query.wholeWord) {
          pattern = `\\b(?:${pattern})\\b`;
        }
        regExp = new RegExp(pattern, flags);
      } else if (query.wholeWord) {
        const escaped = this.escapeRegExp(query.text);
        regExp = new RegExp(`\\b${escaped}\\b`, flags);
      } else {
        const escaped = this.escapeRegExp(query.text);
        regExp = new RegExp(escaped, flags);
      }

      let matchExec: RegExpExecArray | null;
      let count = 0;
      const maxMatches = 10000; // Safety cap to prevent UI thread lock on massive matches

      while ((matchExec = regExp.exec(content)) !== null) {
        const from = matchExec.index;
        const matchedText = matchExec[0];
        const to = from + matchedText.length;

        // Zero-length match protection
        if (matchedText.length === 0) {
          regExp.lastIndex += 1;
          if (regExp.lastIndex > content.length) break;
        }

        const { line, column } = this.getLineAndColumn(lineStarts, from);

        // Extract line preview snippet
        const lineStartPos = lineStarts[line - 1];
        const lineEndPos = content.indexOf('\n', lineStartPos);
        const preview = content.substring(lineStartPos, lineEndPos !== -1 ? lineEndPos : content.length).trim();

        matches.push({
          id: `match-${from}-${to}`,
          from,
          to,
          line,
          column,
          preview,
        });

        count += 1;
        if (count >= maxMatches) {
          logger.warn('Search match count exceeded maximum safe threshold of 10,000 matches');
          break;
        }
      }

      return { matches, error: null };
    } catch (err: unknown) {
      const errorObj = err as Error;
      const errorMsg = errorObj.message || 'Invalid regular expression';
      logger.info('Search query regex syntax warning', { pattern: query.text, error: errorMsg });
      return { matches: [], error: `Invalid regular expression: ${errorMsg}` };
    }
  }

  /**
   * Replaces a single active match occurrence in document content
   */
  public replaceMatch(
    content: string,
    match: SearchMatch,
    replacement: string
  ): { newContent: string; newOffset: number } {
    if (match.from < 0 || match.to > content.length || match.from > match.to) {
      return { newContent: content, newOffset: match.from };
    }

    const before = content.substring(0, match.from);
    const after = content.substring(match.to);
    const newContent = before + replacement + after;
    const newOffset = match.from + replacement.length;

    return { newContent, newOffset };
  }

  /**
   * Atomically replaces all matches in document content in reverse offset order
   */
  public replaceAllMatches(
    content: string,
    matches: SearchMatch[],
    replacement: string
  ): { newContent: string; replaceCount: number } {
    if (!matches || matches.length === 0) {
      return { newContent: content, replaceCount: 0 };
    }

    // Sort matches in descending order of starting offset
    const sortedMatches = [...matches].sort((a, b) => b.from - a.from);
    let result = content;

    for (const match of sortedMatches) {
      if (match.from >= 0 && match.to <= result.length && match.from <= match.to) {
        const before = result.substring(0, match.from);
        const after = result.substring(match.to);
        result = before + replacement + after;
      }
    }

    logger.info('Replace all completed successfully', { totalReplaced: matches.length });
    return { newContent: result, replaceCount: matches.length };
  }
}

export const searchService = new SearchService();
