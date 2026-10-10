import { describe, it, expect } from 'vitest';
import { WorkspaceSearchService } from './WorkspaceSearchService';

describe('WorkspaceSearchService', () => {
  it('correctly tests glob patterns for include and exclude rules', () => {
    expect(WorkspaceSearchService.matchesGlobPatterns('src/services/app.ts', '*.ts')).toBe(true);
    expect(WorkspaceSearchService.matchesGlobPatterns('src/services/app.ts', '*.js')).toBe(false);
    expect(WorkspaceSearchService.matchesGlobPatterns('node_modules/express/index.js', 'node_modules/**')).toBe(true);
  });

  it('identifies binary file extensions correctly', () => {
    expect(WorkspaceSearchService.isBinaryFile('logo.png')).toBe(true);
    expect(WorkspaceSearchService.isBinaryFile('app.exe')).toBe(true);
    expect(WorkspaceSearchService.isBinaryFile('document.ts')).toBe(false);
  });

  it('converts glob wildcards into valid RegExp', () => {
    const regex = WorkspaceSearchService.globToRegExp('*.ts');
    expect(regex.test('main.ts')).toBe(true);
    expect(regex.test('main.js')).toBe(false);
  });
});
