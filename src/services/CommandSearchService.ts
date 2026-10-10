import { Command, CommandContext } from '../core/commands/CommandTypes';

export interface CommandSearchResult {
  command: Command;
  score: number;
  labelHighlights: [number, number][];
  isAvailable: boolean;
}

export class CommandSearchService {
  /**
   * Search commands given a query string and optional context.
   */
  public static search(
    commands: Command[],
    query: string,
    ctx?: CommandContext
  ): CommandSearchResult[] {
    const trimmed = query.trim().toLowerCase();
    const results: CommandSearchResult[] = [];

    for (const cmd of commands) {
      const isAvailable = ctx && cmd.canExecute ? cmd.canExecute(ctx) : true;

      if (!trimmed) {
        // Empty query: return all commands
        results.push({
          command: cmd,
          score: 0,
          labelHighlights: [],
          isAvailable,
        });
        continue;
      }

      const labelLower = cmd.label.toLowerCase();
      const descLower = (cmd.description || '').toLowerCase();
      const catLower = cmd.category.toLowerCase();
      const aliasesLower = (cmd.aliases || []).map((a) => a.toLowerCase());

      let score = -1;
      let highlights: [number, number][] = [];

      // 1. Exact match on label
      if (labelLower === trimmed) {
        score = 1000;
        highlights = [[0, cmd.label.length]];
      }
      // 2. Starts with query (prefix)
      else if (labelLower.startsWith(trimmed)) {
        score = 800;
        highlights = [[0, trimmed.length]];
      }
      // 3. Word start match (e.g. "line" -> "Go to Line")
      else {
        const wordMatchIndex = this.findWordStartMatch(labelLower, trimmed);
        if (wordMatchIndex !== -1) {
          score = 600;
          highlights = [[wordMatchIndex, wordMatchIndex + trimmed.length]];
        }
        // 4. Substring match on label
        else {
          const subIdx = labelLower.indexOf(trimmed);
          if (subIdx !== -1) {
            score = 400;
            highlights = [[subIdx, subIdx + trimmed.length]];
          }
          // 5. Fuzzy match on label characters in sequence
          else {
            const fuzzy = this.scoreFuzzy(labelLower, trimmed);
            if (fuzzy.score > 0) {
              score = 200 + fuzzy.score;
              highlights = fuzzy.highlights;
            }
            // 6. Category, Description, or Alias match
            else if (
              catLower.startsWith(trimmed) ||
              descLower.includes(trimmed) ||
              aliasesLower.some((a) => a.includes(trimmed))
            ) {
              score = 100;
              highlights = [];
            }
          }
        }
      }

      if (score >= 0) {
        results.push({
          command: cmd,
          score,
          labelHighlights: highlights,
          isAvailable,
        });
      }
    }

    // Sort deterministically:
    // 1. Available commands first (when searching)
    // 2. Score descending
    // 3. Category alphabetical
    // 4. Label alphabetical
    results.sort((a, b) => {
      if (a.isAvailable !== b.isAvailable) {
        return a.isAvailable ? -1 : 1;
      }
      if (trimmed && b.score !== a.score) {
        return b.score - a.score;
      }
      if (a.command.category !== b.command.category) {
        return a.command.category.localeCompare(b.command.category);
      }
      return a.command.label.localeCompare(b.command.label);
    });

    return results;
  }

  private static findWordStartMatch(text: string, query: string): number {
    const regex = new RegExp(`\\b${this.escapeRegExp(query)}`, 'i');
    const match = regex.exec(text);
    return match ? match.index : -1;
  }

  private static scoreFuzzy(text: string, query: string): { score: number; highlights: [number, number][] } {
    let tIdx = 0;
    let qIdx = 0;
    const highlights: [number, number][] = [];
    let matchScore = 0;

    while (tIdx < text.length && qIdx < query.length) {
      if (text[tIdx] === query[qIdx]) {
        highlights.push([tIdx, tIdx + 1]);
        matchScore += 10;
        qIdx++;
      }
      tIdx++;
    }

    if (qIdx === query.length) {
      return { score: matchScore, highlights };
    }
    return { score: 0, highlights: [] };
  }

  private static escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
