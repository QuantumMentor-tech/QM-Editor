import { QuickOpenResource } from './WorkspaceIndexService';
import { RecentDocument, DocumentModel } from '../types';

export interface QuickOpenSearchResult {
  resource: QuickOpenResource;
  score: number;
  nameHighlights: [number, number][];
  pathHighlights: [number, number][];
  isOpen: boolean;
  isRecent: boolean;
}

export class QuickOpenSearchService {
  /**
   * Search workspace resources using fuzzy and deterministic scoring algorithms
   */
  public static search(
    resources: QuickOpenResource[],
    query: string,
    openDocs: DocumentModel[] = [],
    recentDocs: RecentDocument[] = []
  ): QuickOpenSearchResult[] {
    const trimmed = query.trim().toLowerCase();
    const openUris = new Set(openDocs.map((d) => (d.fileResource?.uri || d.filePath || '').toLowerCase()));
    const recentUris = new Set(recentDocs.map((r) => r.uri.toLowerCase()));

    const results: QuickOpenSearchResult[] = [];

    for (const res of resources) {
      const resUriLower = res.uri.toLowerCase();
      const isOpen = openUris.has(resUriLower) || openUris.has(res.id.toLowerCase());
      const isRecent = recentUris.has(resUriLower) || recentUris.has(res.id.toLowerCase());

      if (!trimmed) {
        // Empty query: prioritize open tabs and recent files
        let score = 0;
        if (isOpen) score += 100;
        if (isRecent) score += 50;

        results.push({
          resource: res,
          score,
          nameHighlights: [],
          pathHighlights: [],
          isOpen,
          isRecent,
        });
        continue;
      }

      const nameLower = res.name.toLowerCase();
      const pathLower = res.relativePath.toLowerCase();

      let score = -1;
      let nameHighlights: [number, number][] = [];
      let pathHighlights: [number, number][] = [];

      // 1. Exact match on filename
      if (nameLower === trimmed) {
        score = 1000;
        nameHighlights = [[0, res.name.length]];
      }
      // 2. Starts with query (prefix on filename)
      else if (nameLower.startsWith(trimmed)) {
        score = 800;
        nameHighlights = [[0, trimmed.length]];
      }
      // 3. Word start match on filename
      else {
        const wordMatchIndex = this.findWordStartMatch(nameLower, trimmed);
        if (wordMatchIndex !== -1) {
          score = 600;
          nameHighlights = [[wordMatchIndex, wordMatchIndex + trimmed.length]];
        }
        // 4. Substring match on filename
        else {
          const subIdx = nameLower.indexOf(trimmed);
          if (subIdx !== -1) {
            score = 400;
            nameHighlights = [[subIdx, subIdx + trimmed.length]];
          }
          // 5. Match on path substring
          else {
            const pathIdx = pathLower.indexOf(trimmed);
            if (pathIdx !== -1) {
              score = 300;
              pathHighlights = [[pathIdx, pathIdx + trimmed.length]];
            }
            // 6. Fuzzy match on filename or path
            else {
              const fuzzyName = this.scoreFuzzy(nameLower, trimmed);
              if (fuzzyName.score > 0) {
                score = 200 + fuzzyName.score;
                nameHighlights = fuzzyName.highlights;
              } else {
                const fuzzyPath = this.scoreFuzzy(pathLower, trimmed);
                if (fuzzyPath.score > 0) {
                  score = 150 + fuzzyPath.score;
                  pathHighlights = fuzzyPath.highlights;
                }
              }
            }
          }
        }
      }

      if (score >= 0) {
        if (isOpen) score += 50;
        if (isRecent) score += 25;

        results.push({
          resource: res,
          score,
          nameHighlights,
          pathHighlights,
          isOpen,
          isRecent,
        });
      }
    }

    // Sort deterministically:
    // 1. Score descending
    // 2. Shorter relative path length
    // 3. Name alphabetical
    results.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (a.resource.relativePath.length !== b.resource.relativePath.length) {
        return a.resource.relativePath.length - b.resource.relativePath.length;
      }
      return a.resource.name.localeCompare(b.resource.name);
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
