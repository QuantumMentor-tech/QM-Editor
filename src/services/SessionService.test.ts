import { describe, it, expect, beforeEach } from 'vitest';
import { SessionService } from './SessionService';

describe('SessionService', () => {
  beforeEach(() => {
    SessionService.clearSession();
  });

  it('saves and loads session metadata accurately without document content', () => {
    SessionService.saveSession(['/path/file1.ts', '/path/file2.ts'], '/path/file2.ts', {
      '/path/file2.ts': { line: 42, column: 10 },
    });

    const session = SessionService.loadSession();
    expect(session.version).toBe(1);
    expect(session.openFilePaths).toEqual(['/path/file1.ts', '/path/file2.ts']);
    expect(session.activeFilePath).toBe('/path/file2.ts');
    expect(session.lastLocations['/path/file2.ts']).toEqual({ line: 42, column: 10 });
  });

  it('validates corrupted or mismatched session version data gracefully', () => {
    const invalid = SessionService.validateSession({ version: 99, openFilePaths: ['/invalid'] });
    expect(invalid.openFilePaths).toEqual([]);

    const malformed = SessionService.validateSession('not an object');
    expect(malformed.openFilePaths).toEqual([]);
  });
});
