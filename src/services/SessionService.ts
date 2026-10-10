import { ApplicationSession } from '../types';
import { logger } from '../utils/logger';

const SESSION_KEY = 'qm_editor_session_v1';
const CURRENT_SESSION_VERSION = 1;

const DEFAULT_SESSION: ApplicationSession = {
  version: CURRENT_SESSION_VERSION,
  openFilePaths: [],
  lastLocations: {},
  timestamp: Date.now(),
};

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

export class SessionService {
  public static loadSession(): ApplicationSession {
    try {
      const stored = getStorageItem(SESSION_KEY);
      if (!stored) return DEFAULT_SESSION;

      const parsed = JSON.parse(stored);
      return this.validateSession(parsed);
    } catch (err) {
      logger.warn('Failed to load application session from storage; using defaults.', err);
      return DEFAULT_SESSION;
    }
  }

  public static saveSession(
    openFilePaths: string[],
    activeFilePath?: string,
    lastLocations?: Record<string, { line: number; column: number }>
  ): void {
    try {
      const sanitizedPaths = openFilePaths
        .filter((p) => typeof p === 'string' && p.trim().length > 0)
        .map((p) => p.trim());

      const sanitizedActive =
        activeFilePath && sanitizedPaths.includes(activeFilePath.trim())
          ? activeFilePath.trim()
          : sanitizedPaths[0];

      const sanitizedLocations: Record<string, { line: number; column: number }> = {};
      if (lastLocations && typeof lastLocations === 'object') {
        for (const [path, loc] of Object.entries(lastLocations)) {
          if (loc && typeof loc.line === 'number' && typeof loc.column === 'number') {
            sanitizedLocations[path] = {
              line: Math.max(1, Math.round(loc.line)),
              column: Math.max(1, Math.round(loc.column)),
            };
          }
        }
      }

      const session: ApplicationSession = {
        version: CURRENT_SESSION_VERSION,
        openFilePaths: sanitizedPaths,
        activeFilePath: sanitizedActive,
        lastLocations: sanitizedLocations,
        timestamp: Date.now(),
      };

      setStorageItem(SESSION_KEY, JSON.stringify(session));
    } catch (err) {
      logger.warn('Failed to save session metadata.', err);
    }
  }

  public static clearSession(): void {
    try {
      setStorageItem(SESSION_KEY, JSON.stringify(DEFAULT_SESSION));
    } catch (err) {
      logger.warn('Failed to clear session metadata.', err);
    }
  }

  public static validateSession(data: unknown): ApplicationSession {
    if (!data || typeof data !== 'object') {
      return DEFAULT_SESSION;
    }

    const obj = data as Record<string, unknown>;

    if (obj.version !== CURRENT_SESSION_VERSION) {
      return DEFAULT_SESSION;
    }

    const openFilePaths: string[] = [];
    if (Array.isArray(obj.openFilePaths)) {
      for (const p of obj.openFilePaths) {
        if (typeof p === 'string' && p.trim().length > 0) {
          openFilePaths.push(p.trim());
        }
      }
    }

    const activeFilePath =
      typeof obj.activeFilePath === 'string' && openFilePaths.includes(obj.activeFilePath.trim())
        ? obj.activeFilePath.trim()
        : openFilePaths[0];

    const lastLocations: Record<string, { line: number; column: number }> = {};
    if (obj.lastLocations && typeof obj.lastLocations === 'object') {
      for (const [path, loc] of Object.entries(obj.lastLocations as Record<string, unknown>)) {
        if (
          loc &&
          typeof loc === 'object' &&
          typeof (loc as any).line === 'number' &&
          typeof (loc as any).column === 'number'
        ) {
          lastLocations[path] = {
            line: Math.max(1, Math.round((loc as any).line)),
            column: Math.max(1, Math.round((loc as any).column)),
          };
        }
      }
    }

    return {
      version: CURRENT_SESSION_VERSION,
      openFilePaths,
      activeFilePath,
      lastLocations,
      timestamp: typeof obj.timestamp === 'number' ? obj.timestamp : Date.now(),
    };
  }
}
