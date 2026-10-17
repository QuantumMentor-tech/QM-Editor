/**
 * QM Editor - LSP Inlay Hints Mapper Tests
 * Phase 06, Step 65 — LSP Inlay Hints, Parameter Names, Type Information & Inline Semantic Annotations
 */

import { describe, it, expect } from 'vitest';
import { LspInlayHintMapper } from './LspInlayHintMapper';
import { ValidatedInlayHint } from './LspInlayHintValidator';

describe('LspInlayHintMapper', () => {
  const sampleDoc = 'line 0\nsecond line\nthird line of text';
  const uri = 'file:///workspace/test.ts';

  it('computes line starts accurately', () => {
    const starts = LspInlayHintMapper.computeLineStarts(sampleDoc);
    expect(starts).toEqual([0, 7, 19]);
    expect(sampleDoc.slice(starts[0], starts[0] + 6)).toBe('line 0');
    expect(sampleDoc.slice(starts[1], starts[1] + 11)).toBe('second line');
    expect(sampleDoc.slice(starts[2])).toBe('third line of text');
  });

  it('maps validated hints to editor decorations with correct offsets', () => {
    const hints: ValidatedInlayHint[] = [
      {
        line: 1,
        character: 6,
        label: 'param: ',
        kind: 'parameter',
        paddingLeft: false,
        paddingRight: false,
      },
      {
        line: 0,
        character: 4,
        label: ': int',
        kind: 'type',
        paddingLeft: true,
        paddingRight: false,
      },
    ];

    const decos = LspInlayHintMapper.mapToDecorations(uri, hints, sampleDoc);
    expect(decos).toHaveLength(2);

    // CodeMirror invariant: decorations must be sorted by `from` ascending
    expect(decos[0].from).toBe(4); // line 0 start (0) + 4
    expect(decos[0].kind).toBe('type');
    expect(decos[0].label).toBe(' : int'); // paddingLeft formatted
    expect(decos[0].className).toContain('cm-inlay-hint-type');
    expect(decos[0].className).toContain('cm-inlay-hint-pad-left');

    expect(decos[1].from).toBe(13); // line 1 start (7) + 6 = 13
    expect(decos[1].kind).toBe('parameter');
    expect(decos[1].label).toBe('param: ');
    expect(decos[1].className).toContain('cm-inlay-hint-parameter');
  });

  it('filters parameter hints when includeParameters is false', () => {
    const hints: ValidatedInlayHint[] = [
      {
        line: 0,
        character: 2,
        label: 'p1:',
        kind: 'parameter',
        paddingLeft: false,
        paddingRight: false,
      },
      {
        line: 0,
        character: 5,
        label: ': string',
        kind: 'type',
        paddingLeft: false,
        paddingRight: false,
      },
    ];

    const decos = LspInlayHintMapper.mapToDecorations(uri, hints, sampleDoc, {
      includeParameters: false,
      includeTypes: true,
    });

    expect(decos).toHaveLength(1);
    expect(decos[0].kind).toBe('type');
    expect(decos[0].label).toBe(': string');
  });

  it('filters type hints when includeTypes is false', () => {
    const hints: ValidatedInlayHint[] = [
      {
        line: 0,
        character: 2,
        label: 'p1:',
        kind: 'parameter',
        paddingLeft: false,
        paddingRight: false,
      },
      {
        line: 0,
        character: 5,
        label: ': string',
        kind: 'type',
        paddingLeft: false,
        paddingRight: false,
      },
    ];

    const decos = LspInlayHintMapper.mapToDecorations(uri, hints, sampleDoc, {
      includeParameters: true,
      includeTypes: false,
    });

    expect(decos).toHaveLength(1);
    expect(decos[0].kind).toBe('parameter');
    expect(decos[0].label).toBe('p1:');
  });
});
