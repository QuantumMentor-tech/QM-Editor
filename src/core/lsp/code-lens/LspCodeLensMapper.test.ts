/**
 * QM Editor - LSP Code Lens Mapper Tests
 * Phase 06, Step 66 — LSP Code Lens, Inline Actions & Safe Command Integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LspCodeLensMapper } from './LspCodeLensMapper';
import { CommandRegistry } from '../../commands/CommandRegistry';
import { LspCodeLens } from '../LspTypes';

describe('LspCodeLensMapper', () => {
  const sampleDoc = 'line 0\nfunction calculate() {\n  return 42;\n}\nclass Runner {}';
  const uri = 'file:///workspace/test.ts';
  let registry: CommandRegistry;

  beforeEach(() => {
    registry = new CommandRegistry();
  });

  it('computes line starts accurately', () => {
    const starts = LspCodeLensMapper.computeLineStarts(sampleDoc);
    expect(starts).toEqual([0, 7, 30, 43, 45]);
    expect(sampleDoc.slice(starts[0], starts[0] + 6)).toBe('line 0');
    expect(sampleDoc.slice(starts[1], starts[1] + 20)).toBe('function calculate()');
  });

  it('groups multiple code lenses on the same line into a single EditorCodeLensLine', () => {
    const rawLenses: LspCodeLens[] = [
      {
        range: { start: { line: 1, character: 0 }, end: { line: 1, character: 18 } },
        command: { title: 'Run Test', command: 'tasks.runTest' },
      },
      {
        range: { start: { line: 1, character: 9 }, end: { line: 1, character: 18 } },
        command: { title: '5 references', command: 'editor.showReferences' },
      },
    ];

    const result = LspCodeLensMapper.mapToLines(
      uri,
      1,
      'test-provider',
      'test-session',
      rawLenses,
      sampleDoc,
      registry
    );

    expect(result.lenses).toHaveLength(2);
    expect(result.lines).toHaveLength(1);

    const lineGroup = result.lines[0];
    expect(lineGroup.line).toBe(1);
    expect(lineGroup.from).toBe(7); // line 1 starts at 7
    expect(lineGroup.lenses).toHaveLength(2);

    // Sorted by start character: char 0 comes before char 9
    expect(lineGroup.lenses[0].command?.title).toBe('Run Test');
    expect(lineGroup.lenses[1].command?.title).toBe('5 references');
  });

  it('distributes code lenses across distinct lines in sorted order', () => {
    const rawLenses: LspCodeLens[] = [
      {
        range: { start: { line: 4, character: 0 }, end: { line: 4, character: 12 } },
        command: { title: '1 implementation', command: 'editor.action.goToImplementation' },
      },
      {
        range: { start: { line: 1, character: 0 }, end: { line: 1, character: 18 } },
        command: { title: '3 references', command: 'editor.showReferences' },
      },
    ];

    const result = LspCodeLensMapper.mapToLines(
      uri,
      1,
      'test-provider',
      'test-session',
      rawLenses,
      sampleDoc,
      registry
    );

    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].line).toBe(1);
    expect(result.lines[1].line).toBe(4);
  });

  it('preserves unresolved code lenses without a command', () => {
    const rawLenses: LspCodeLens[] = [
      {
        range: { start: { line: 1, character: 0 }, end: { line: 1, character: 10 } },
        data: { symbolId: '123' },
      },
    ];

    const result = LspCodeLensMapper.mapToLines(
      uri,
      1,
      'test-provider',
      'test-session',
      rawLenses,
      sampleDoc,
      registry
    );

    expect(result.lenses).toHaveLength(1);
    expect(result.lenses[0].isResolved).toBe(false);
    expect(result.lenses[0].command).toBeUndefined();
    expect(result.lenses[0].data).toEqual({ symbolId: '123' });
  });

  it('drops lenses with out-of-bounds ranges', () => {
    const rawLenses: LspCodeLens[] = [
      {
        range: { start: { line: 99, character: 0 }, end: { line: 99, character: 10 } },
        command: { title: 'Invalid', command: 'editor.showReferences' },
      },
    ];

    const result = LspCodeLensMapper.mapToLines(
      uri,
      1,
      'test-provider',
      'test-session',
      rawLenses,
      sampleDoc,
      registry
    );

    expect(result.lenses).toHaveLength(0);
    expect(result.lines).toHaveLength(0);
  });

  it('caps maximum lenses per document to MAX_LENSES_PER_DOCUMENT', () => {
    const manyLenses: LspCodeLens[] = [];
    for (let i = 0; i < 700; i++) {
      manyLenses.push({
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
        command: { title: `Ref ${i}`, command: 'editor.showReferences' },
      });
    }

    const result = LspCodeLensMapper.mapToLines(
      uri,
      1,
      'test-provider',
      'test-session',
      manyLenses,
      sampleDoc,
      registry
    );

    expect(result.lenses.length).toBe(LspCodeLensMapper.MAX_LENSES_PER_DOCUMENT);
  });
});
