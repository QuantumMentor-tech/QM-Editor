import { describe, it, expect, beforeEach } from 'vitest';
import { RecentDocumentsService } from './RecentDocumentsService';

describe('RecentDocumentsService', () => {
  beforeEach(() => {
    RecentDocumentsService.clearRecentDocuments();
  });

  it('adds recent documents and deduplicates normalized URIs', () => {
    RecentDocumentsService.addRecentDocument('/path/to/file1.ts', 'file1.ts');
    RecentDocumentsService.addRecentDocument('/path/to/file2.ts', 'file2.ts');
    RecentDocumentsService.addRecentDocument('/path/to/file1.ts', 'file1.ts');

    const recent = RecentDocumentsService.getRecentDocuments();
    expect(recent.length).toBe(2);
    expect(recent[0].uri).toBe('/path/to/file1.ts');
    expect(recent[1].uri).toBe('/path/to/file2.ts');
  });

  it('bounds list to maximum limit', () => {
    for (let i = 1; i <= 25; i++) {
      RecentDocumentsService.addRecentDocument(`/path/file${i}.ts`);
    }

    const recent = RecentDocumentsService.getRecentDocuments();
    expect(recent.length).toBe(20);
    expect(recent[0].uri).toBe('/path/file25.ts');
  });

  it('validates corrupted storage data gracefully', () => {
    const validated = RecentDocumentsService.validateRecentDocuments(['invalid', { uri: 123 }, { uri: '/valid.ts', name: 'valid.ts' }]);
    expect(validated.length).toBe(1);
    expect(validated[0].uri).toBe('/valid.ts');
  });
});
