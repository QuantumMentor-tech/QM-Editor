/**
 * QM Editor — LSP Folding Mapper Tests
 * Phase 06, Step 68 — LSP Folding Ranges, Smart Code Folding & Safe Document Structure Navigation
 */

import { describe, it, expect } from 'vitest';
import { LspFoldingMapper, DocumentLineInfo } from './LspFoldingMapper';
import { ValidatedFoldingRange } from './LspFoldingValidator';

function createMockDoc(lines: string[]): DocumentLineInfo {
  const lineOffsets: number[] = [0];
  for (let i = 0; i < lines.length; i++) {
    lineOffsets.push(lineOffsets[i] + lines[i].length + 1);
  }

  const totalLength = lines.join('\n').length;

  return {
    lines: lines.length,
    length: totalLength,
    line: (n: number) => {
      const idx = n - 1;
      const from = lineOffsets[idx];
      const len = lines[idx].length;
      return {
        from,
        to: from + len,
        length: len,
        number: n,
      };
    },
  };
}

describe('LspFoldingMapper', () => {
  const sampleDoc = createMockDoc([
    'import { a } from "./a";', // Line 1 (idx 0), len 24
    'import { b } from "./b";', // Line 2 (idx 1), len 24
    '// Comment start',        // Line 3 (idx 2), len 16
    '// Comment end',          // Line 4 (idx 3), len 14
    'function test() {',       // Line 5 (idx 4), len 17
    '  const x = 1;',          // Line 6 (idx 5), len 14
    '}',                       // Line 7 (idx 6), len 1
  ]);

  const options = {
    documentUri: 'file:///project/src/index.ts',
    documentRevision: 1,
    providerId: 'typescript-lsp',
    providerGeneration: 1,
  };

  it('maps multiline folding ranges into canonical and editor contracts', () => {
    const raw: ValidatedFoldingRange[] = [
      { startLine: 0, endLine: 1, kind: 'imports' },
      { startLine: 2, endLine: 3, kind: 'comment', collapsedText: '/* comments */' },
      { startLine: 4, endLine: 6, kind: 'region' },
    ];

    const canonical = LspFoldingMapper.mapToCanonicalRanges(raw, sampleDoc, options);
    expect(canonical).toHaveLength(3);

    // Imports fold: from line 1 end to line 2 end
    expect(canonical[0].startLine).toBe(0);
    expect(canonical[0].endLine).toBe(1);
    expect(canonical[0].kind).toBe('imports');
    expect(canonical[0].from).toBe(24); // end of line 1
    expect(canonical[0].to).toBe(49); // end of line 2

    // Comment fold with collapsedText
    expect(canonical[1].kind).toBe('comment');
    expect(canonical[1].collapsedText).toBe('/* comments */');

    // Region fold
    expect(canonical[2].startLine).toBe(4);
    expect(canonical[2].endLine).toBe(6);

    // Map to editor ranges for CodeMirror
    const editorRanges = LspFoldingMapper.mapToEditorRanges(canonical);
    expect(editorRanges).toHaveLength(3);
    expect(editorRanges[0].startLine).toBe(1); // 1-based
    expect(editorRanges[0].endLine).toBe(2);
    expect(editorRanges[1].collapsedText).toBe('/* comments */');
  });

  it('filters out imports when importsEnabled is false', () => {
    const raw: ValidatedFoldingRange[] = [
      { startLine: 0, endLine: 1, kind: 'imports' },
      { startLine: 4, endLine: 6, kind: 'region' },
    ];

    const canonical = LspFoldingMapper.mapToCanonicalRanges(raw, sampleDoc, {
      ...options,
      importsEnabled: false,
    });

    expect(canonical).toHaveLength(1);
    expect(canonical[0].kind).toBe('region');
  });

  it('filters out comments when commentsEnabled is false', () => {
    const raw: ValidatedFoldingRange[] = [
      { startLine: 2, endLine: 3, kind: 'comment' },
      { startLine: 4, endLine: 6, kind: 'region' },
    ];

    const canonical = LspFoldingMapper.mapToCanonicalRanges(raw, sampleDoc, {
      ...options,
      commentsEnabled: false,
    });

    expect(canonical).toHaveLength(1);
    expect(canonical[0].kind).toBe('region');
  });
});
