import { logger } from '../utils/logger';

export interface RecentWorkspace {
  path: string;
  name: string;
  lastOpened: number;
}

const RECENT_WORKSPACES_KEY = 'qm_editor_recent_workspaces_v1';
const MAX_RECENT_WORKSPACES = 10;

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

export class RecentWorkspacesService {
  /**
   * Retrieves bounded list of validated recent workspaces
   */
  public static getRecentWorkspaces(): RecentWorkspace[] {
    try {
      const stored = getStorageItem(RECENT_WORKSPACES_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return this.validateRecentWorkspaces(parsed);
    } catch (err) {
      logger.warn('Failed to load recent workspaces from storage; returning empty list.', err);
      return [];
    }
  }

  /**
   * Adds or updates a recent workspace path in the history.
   * Deduplicates by normalized path and moves it to the top (MRU order).
   */
  public static addRecentWorkspace(path: string, name?: string): RecentWorkspace[] {
    if (!path || path.trim().length === 0) return this.getRecentWorkspaces();

    const normalizedPath = path.trim();
    const wsName = name && name.trim().length > 0 ? name.trim() : this.extractWorkspaceName(normalizedPath);

    const current = this.getRecentWorkspaces();
    const filtered = current.filter((item) => item.path !== normalizedPath);

    const newItem: RecentWorkspace = {
      path: normalizedPath,
      name: wsName,
      lastOpened: Date.now(),
    };

    const updated = [newItem, ...filtered].slice(0, MAX_RECENT_WORKSPACES);

    try {
      setStorageItem(RECENT_WORKSPACES_KEY, JSON.stringify(updated));
    } catch (err) {
      logger.warn('Failed to save recent workspaces list.', err);
    }

    return updated;
  }

  /**
   * Removes a workspace from history metadata only.
   * Invariant: Never deletes or touches physical files/directories.
   */
  public static removeRecentWorkspace(path: string): RecentWorkspace[] {
    if (!path) return this.getRecentWorkspaces();
    const normalizedPath = path.trim();

    const current = this.getRecentWorkspaces();
    const updated = current.filter((item) => item.path !== normalizedPath);

    try {
      setStorageItem(RECENT_WORKSPACES_KEY, JSON.stringify(updated));
    } catch (err) {
      logger.warn('Failed to update recent workspaces after removal.', err);
    }

    return updated;
  }

  /**
   * Clears the recent workspace history
   */
  public static clearRecentWorkspaces(): void {
    try {
      setStorageItem(RECENT_WORKSPACES_KEY, JSON.stringify([]));
    } catch (err) {
      logger.warn('Failed to clear recent workspaces list.', err);
    }
  }

  /**
   * Validates and sanitizes raw storage data against corrupted or malformed entries
   */
  public static validateRecentWorkspaces(data: unknown): RecentWorkspace[] {
    if (!Array.isArray(data)) return [];

    const valid: RecentWorkspace[] = [];
    for (const item of data) {
      if (
        item &&
        typeof item === 'object' &&
        typeof item.path === 'string' &&
        item.path.trim().length > 0
      ) {
        valid.push({
          path: item.path.trim(),
          name:
            typeof item.name === 'string' && item.name.trim().length > 0
              ? item.name.trim()
              : this.extractWorkspaceName(item.path.trim()),
          lastOpened:
            typeof item.lastOpened === 'number' && item.lastOpened > 0
              ? item.lastOpened
              : Date.now(),
        });
      }
    }

    return valid.slice(0, MAX_RECENT_WORKSPACES);
  }

  /**
   * Extracts clean display name from path or URI
   */
  public static extractWorkspaceName(path: string): string {
    const clean = path.replace(/browser-fs:\/\//, '').replace(/\\/g, '/');
    const segments = clean.split('/').filter(Boolean);
    return segments[segments.length - 1] || path;
  }
}
