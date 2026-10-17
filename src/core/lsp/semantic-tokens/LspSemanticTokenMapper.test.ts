/**
 * QM Editor - LSP Semantic Tokens Mapper Test Suite
 * Phase 06, Step 64 — LSP Semantic Tokens, Semantic Highlighting & Incremental Token Synchronization
 */

import { describe, it, expect } from 'vitest';
import { LspSemanticTokenMapper } from './LspSemanticTokenMapper';
import { DecodedSemanticToken } from './LspSemanticTokenTypes';

describe('LspSemanticTokenMapper', () => {
  it('converts 0-based decoded tokens to 1-based canonical tokens accurately', () => {
    const decoded: DecodedSemanticToken[] = [
      {
        line: 0,
        startChar: 4,
        length: 8,
        tokenTypeIndex: 0,
        tokenType: 'function',
        tokenModifiersMask: 1,
        tokenModifiers: ['declaration'],
      },
      {
        line: 3,
        startChar: 2,
        length: 5,
        tokenTypeIndex: 1,
        tokenType: 'variable',
        tokenModifiersMask: 4,
        tokenModifiers: ['readonly'],
      },
    ];

    const canonical = LspSemanticTokenMapper.toCanonicalTokens(decoded);
    expect(canonical).toHaveLength(2);

    expect(canonical[0]).toEqual({
      line: 1,
      startColumn: 5,
      endLine: 1,
      endColumn: 13,
      length: 8,
      tokenType: 'function',
      modifiers: ['declaration'],
    });

    expect(canonical[1]).toEqual({
      line: 4,
      startColumn: 3,
      endLine: 4,
      endColumn: 8,
      length: 5,
      tokenType: 'variable',
      modifiers: ['readonly'],
    });
  });

  it('computes line start offsets correctly for Unix and Windows line breaks', () => {
    const text = 'abc\ndefgh\nij';
    const offsets = LspSemanticTokenMapper.computeLineOffsets(text);

    // Line 0 starts at 0
    // Line 1 starts at 4 ('abc\n'.length)
    // Line 2 starts at 10 ('abc\ndefgh\n'.length)
    expect(offsets).toEqual([0, 4, 10]);
  });

  it('maps decoded tokens to CodeMirror 6 editor decorations with character offsets', () => {
    const docText = 'const x = 42;\nfunction foo() {}';
    const decoded: DecodedSemanticToken[] = [
      {
        line: 0,
        startChar: 6,
        length: 1,
        tokenTypeIndex: 8,
        tokenType: 'variable',
        tokenModifiersMask: 4,
        tokenModifiers: ['readonly'],
      },
      {
        line: 1,
        startChar: 9,
        length: 3,
        tokenTypeIndex: 12,
        tokenType: 'function',
        tokenModifiersMask: 1,
        tokenModifiers: ['declaration'],
      },
    ];

    const decorations = LspSemanticTokenMapper.toEditorDecorations(decoded, docText);
    expect(decorations).toHaveLength(2);

    // Token 1: line 0 offset 0 + char 6 => from 6, to 7
    expect(decorations[0].from).toBe(6);
    expect(decorations[0].to).toBe(7);
    expect(decorations[0].tokenType).toBe('variable');
    expect(decorations[0].className).toContain('cm-semantic-type-variable');
    expect(decorations[0].className).toContain('cm-semantic-mod-readonly');

    // Token 2: line 1 offset 14 + char 9 => from 23, to 26
    expect(decorations[1].from).toBe(23);
    expect(decorations[1].to).toBe(26);
    expect(decorations[1].tokenType).toBe('function');
    expect(decorations[1].className).toContain('cm-semantic-type-function');
    expect(decorations[1].className).toContain('cm-semantic-mod-declaration');
  });

  it('gracefully handles empty inputs or out-of-range lines', () => {
    expect(LspSemanticTokenMapper.toEditorDecorations([], 'some text')).toEqual([]);
    expect(LspSemanticTokenMapper.toEditorDecorations([{ line: 10, startChar: 0, length: 5, tokenTypeIndex: 0, tokenType: 'var', tokenModifiersMask: 0, tokenModifiers: [] }], 'short')).toEqual([]);
  });
});
