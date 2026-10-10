import { QuickOpenResource } from './WorkspaceIndexService';
import { searchService } from './SearchService';
import { fileService } from './FileService';
import { logger } from '../utils/logger';

export interface WorkspaceSearchQuery {
  query: string;
  replaceText?: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  isRegex: boolean;
  includePattern?: string;
  excludePattern?: string;
}

export interface WorkspaceMatchItem {
  id: string;
  line: number;
  column: number;
  from: number;
  to: number;
  lineText: string;
  matchText: string;
}

export interface WorkspaceFileSearchResult {
  resource: QuickOpenResource;
  matches: WorkspaceMatchItem[];
  error?: string | null;
  isSkipped?: boolean;
  skipReason?: string;
}

export interface WorkspaceSearchProgress {
  scannedFiles: number;
  totalFiles: number;
  matchedFiles: number;
  totalMatches: number;
  isComplete: boolean;
  isCancelled: boolean;
}

const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'ico', 'svg',
  'pdf', 'zip', 'tar', 'gz', '7z', 'rar', 'exe', 'dll', 'so', 'dylib', 'wasm',
  'ttf', 'woff', 'woff2', 'eot', 'mp3', 'mp4', 'avi', 'mov', 'wav', 'flac',
  'iso', 'img', 'bin'
]);

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB max file size cap

export class WorkspaceSearchService {
  private activeSearchId: number = 0;
  private isCancelled: boolean = false;

  public getSearchId(): number {
    return this.activeSearchId;
  }

  public cancelSearch(): void {
    this.isCancelled = true;
    this.activeSearchId += 1;
    logger.info('Workspace search cancelled', { searchId: this.activeSearchId });
  }

  /**
   * Helper to convert wildcard glob patterns (*, **) into Regular Expressions
   */
  public static globToRegExp(pattern: string): RegExp {
    const trimmed = pattern.trim();
    let regexStr = '^';
    let i = 0;

    while (i < trimmed.length) {
      const c = trimmed[i];
      if (c === '*') {
        if (i + 1 < trimmed.length && trimmed[i + 1] === '*') {
          regexStr += '.*';
          i += 2;
          if (i < trimmed.length && trimmed[i] === '/') i++;
          continue;
        } else {
          regexStr += '[^/]*';
        }
      } else if (c === '?') {
        regexStr += '[^/]';
      } else if (c === '.') {
        regexStr += '\\.';
      } else if (c === '/' || c === '\\') {
        regexStr += '[/\\\\]';
      } else if ('+^$({[]|'.includes(c)) {
        regexStr += `\\${c}`;
      } else {
        regexStr += c;
      }
      i++;
    }

    regexStr += '$';
    return new RegExp(regexStr, 'i');
  }

  /**
   * Checks if a relative path or filename matches comma-separated glob patterns
   */
  public static matchesGlobPatterns(pathOrName: string, patterns?: string): boolean {
    if (!patterns || patterns.trim().length === 0) return true;

    const rawPatterns = patterns.split(',').map((p) => p.trim()).filter((p) => p.length > 0);
    if (rawPatterns.length === 0) return true;

    const normalized = pathOrName.replace(/\\/g, '/');
    return rawPatterns.some((p) => {
      try {
        const regex = this.globToRegExp(p);
        return regex.test(normalized) || regex.test(normalized.split('/').pop() || '');
      } catch {
        return false;
      }
    });
  }

  /**
   * Checks if file extension indicates a binary resource
   */
  public static isBinaryFile(filename: string): boolean {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    return BINARY_EXTENSIONS.has(ext);
  }

  /**
   * Executes workspace content search across candidate resources
   */
  public async searchWorkspace(
    resources: QuickOpenResource[],
    query: WorkspaceSearchQuery,
    onProgress?: (progress: WorkspaceSearchProgress) => void
  ): Promise<{ results: WorkspaceFileSearchResult[]; totalMatches: number; isCancelled: boolean }> {
    const searchId = ++this.activeSearchId;
    this.isCancelled = false;

    if (!query.query || query.query.trim().length === 0) {
      return { results: [], totalMatches: 0, isCancelled: false };
    }

    // Filter candidate resources using binary checks and include/exclude glob rules
    const candidates = resources.filter((res) => {
      if (res.isFolder) return false;
      if (WorkspaceSearchService.isBinaryFile(res.name)) return false;

      if (query.excludePattern && WorkspaceSearchService.matchesGlobPatterns(res.relativePath, query.excludePattern)) {
        return false;
      }
      if (query.includePattern && !WorkspaceSearchService.matchesGlobPatterns(res.relativePath, query.includePattern)) {
        return false;
      }
      return true;
    });

    const results: WorkspaceFileSearchResult[] = [];
    let totalMatches = 0;
    let scannedFiles = 0;

    const batchSize = 5; // Process 5 files per async batch to avoid freezing UI
    for (let i = 0; i < candidates.length; i += batchSize) {
      if (this.isCancelled || searchId !== this.activeSearchId) {
        logger.info('Workspace search aborted due to cancellation or newer search request');
        return { results, totalMatches, isCancelled: true };
      }

      const batch = candidates.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (res) => {
          if (this.isCancelled || searchId !== this.activeSearchId) return;

          try {
            let content = '';

            if (res.handle && res.handle.kind === 'file') {
              const fileData = await fileService.readFile(res.handle as FileSystemFileHandle);
              content = fileData.content;
            } else {
              return;
            }

            // Quick check for binary NUL bytes
            if (content.slice(0, 1024).includes('\0')) {
              return;
            }

            // Check file size cap
            if (content.length > MAX_FILE_SIZE_BYTES) {
              results.push({
                resource: res,
                matches: [],
                isSkipped: true,
                skipReason: 'File size exceeds maximum safe limit of 5MB',
              });
              return;
            }

            const { matches, error } = searchService.executeSearch(content, {
              text: query.query,
              caseSensitive: query.caseSensitive,
              wholeWord: query.wholeWord,
              regex: query.isRegex,
            });

            if (error) {
              results.push({
                resource: res,
                matches: [],
                error,
              });
              return;
            }

            if (matches.length > 0) {
              const matchItems: WorkspaceMatchItem[] = matches.map((m) => ({
                id: `${res.id}:${m.from}-${m.to}`,
                line: m.line,
                column: m.column,
                from: m.from,
                to: m.to,
                lineText: m.preview,
                matchText: content.substring(m.from, m.to),
              }));

              totalMatches += matchItems.length;
              results.push({
                resource: res,
                matches: matchItems,
              });
            }
          } catch (err) {
            logger.warn('Error scanning workspace file during search', { file: res.relativePath, error: (err as Error).message });
          } finally {
            scannedFiles += 1;
          }
        })
      );

      if (onProgress) {
        onProgress({
          scannedFiles,
          totalFiles: candidates.length,
          matchedFiles: results.filter((r) => r.matches.length > 0).length,
          totalMatches,
          isComplete: false,
          isCancelled: false,
        });
      }
    }

    if (onProgress) {
      onProgress({
        scannedFiles: candidates.length,
        totalFiles: candidates.length,
        matchedFiles: results.filter((r) => r.matches.length > 0).length,
        totalMatches,
        isComplete: true,
        isCancelled: false,
      });
    }

    // Sort file results deterministically by relative path
    results.sort((a, b) => a.resource.relativePath.localeCompare(b.resource.relativePath));

    logger.info('Workspace search completed', { totalMatches, fileCount: results.length });
    return { results, totalMatches, isCancelled: false };
  }
}

export const workspaceSearchService = new WorkspaceSearchService();
