import { RecentDocument } from '../types';
import { logger } from '../utils/logger';

const RECENT_DOCUMENTS_KEY = 'qm_editor_recent_documents_v1';
const MAX_RECENT_DOCUMENTS = 20;

const memoryStorage: Record<string, string> = {};

const getStorageItem = (key: string): string | null => {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem) {
      return localStorage.getItem(key);
    }
  } catch {
    // Fallback to memory
  }
  return memoryStorage[key] || null;
};

const setStorageItem = (key: string, value: string): void => {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.setItem) {
      localStorage.setItem(key, value);
      return;
    }
  } catch {
    // Fallback to memory
  }
  memoryStorage[key] = value;
};

export class RecentDocumentsService {
  public static getRecentDocuments(): RecentDocument[] {
    try {
      const stored = getStorageItem(RECENT_DOCUMENTS_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return this.validateRecentDocuments(parsed);
    } catch (err) {
      logger.warn('Failed to load recent documents from storage; returning empty list.', err);
      return [];
    }
  }

  public static addRecentDocument(uri: string, name?: string): RecentDocument[] {
    if (!uri || uri.trim().length === 0) return this.getRecentDocuments();

    const normalizedUri = uri.trim();
    const docName = name && name.trim().length > 0 ? name.trim() : this.extractFilename(normalizedUri);

    const current = this.getRecentDocuments();
    const filtered = current.filter((item) => item.uri !== normalizedUri);

    const newItem: RecentDocument = {
      uri: normalizedUri,
      name: docName,
      lastOpened: Date.now(),
    };

    const updated = [newItem, ...filtered].slice(0, MAX_RECENT_DOCUMENTS);

    try {
      setStorageItem(RECENT_DOCUMENTS_KEY, JSON.stringify(updated));
    } catch (err) {
      logger.warn('Failed to save recent documents list.', err);
    }

    return updated;
  }

  public static clearRecentDocuments(): void {
    try {
      setStorageItem(RECENT_DOCUMENTS_KEY, JSON.stringify([]));
    } catch (err) {
      logger.warn('Failed to clear recent documents list.', err);
    }
  }

  public static validateRecentDocuments(data: unknown): RecentDocument[] {
    if (!Array.isArray(data)) return [];

    const valid: RecentDocument[] = [];
    for (const item of data) {
      if (
        item &&
        typeof item === 'object' &&
        typeof item.uri === 'string' &&
        item.uri.trim().length > 0
      ) {
        valid.push({
          uri: item.uri.trim(),
          name:
            typeof item.name === 'string' && item.name.trim().length > 0
              ? item.name.trim()
              : this.extractFilename(item.uri.trim()),
          lastOpened:
            typeof item.lastOpened === 'number' && item.lastOpened > 0
              ? item.lastOpened
              : Date.now(),
        });
      }
    }

    return valid.slice(0, MAX_RECENT_DOCUMENTS);
  }

  private static extractFilename(uri: string): string {
    const parts = uri.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1] || uri;
  }
}
