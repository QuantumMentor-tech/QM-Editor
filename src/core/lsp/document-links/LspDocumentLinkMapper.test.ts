/**
 * QM Editor - LSP Document Link Mapper Unit Tests
 * Phase 06, Step 67 — LSP Document Links, Clickable Resource References & Safe URI Navigation
 */

import { describe, it, expect } from 'vitest';
import { LspDocumentLinkMapper } from './LspDocumentLinkMapper';
import { LspDocumentLink } from '../LspTypes';

describe('LspDocumentLinkMapper', () => {
  const uri = 'file:///C:/project/src/app.ts';
  const text = 'import "./config.json";\nconst link = "https://example.com";\nconst other = "secret";\n';
  const roots = ['C:/project'];

  it('maps valid LSP document links to canonical models and editor decorations', () => {
    const rawLinks: LspDocumentLink[] = [
      {
        range: {
          start: { line: 0, character: 7 },
          end: { line: 0, character: 22 },
        },
        target: 'file:///C:/project/src/config.json',
        tooltip: 'Open configuration',
      },
      {
        range: {
          start: { line: 1, character: 14 },
          end: { line: 1, character: 33 },
        },
        target: 'https://example.com',
      },
    ];

    const result = LspDocumentLinkMapper.mapToDecorations(
      uri,
      1,
      'test-provider',
      'session-1',
      rawLinks,
      text,
      roots
    );

    expect(result.links).toHaveLength(2);
    expect(result.decorations).toHaveLength(2);

    // Link 0 (local file)
    const link0 = result.links[0];
    expect(link0.from).toBe(7);
    expect(link0.to).toBe(22);
    expect(link0.target).toBe('file:///C:/project/src/config.json');
    expect(link0.classification).toBe('workspace-local');
    expect(link0.tooltip).toBe('Open configuration');
    expect(link0.isResolved).toBe(true);

    // Link 1 (external web)
    const link1 = result.links[1];
    expect(link1.from).toBe(24 + 14); // line 0 length 24
    expect(link1.to).toBe(24 + 33);
    expect(link1.classification).toBe('external-web');
    expect(link1.target).toBe('https://example.com/');
  });

  it('handles unresolved links with data payloads', () => {
    const rawLinks: LspDocumentLink[] = [
      {
        range: {
          start: { line: 0, character: 7 },
          end: { line: 0, character: 22 },
        },
        data: { linkId: 42 },
      },
    ];

    const result = LspDocumentLinkMapper.mapToDecorations(
      uri,
      1,
      'test-provider',
      'session-1',
      rawLinks,
      text,
      roots
    );

    expect(result.links).toHaveLength(1);
    expect(result.links[0].isResolved).toBe(false);
    expect(result.links[0].target).toBeUndefined();
    expect(result.links[0].data).toEqual({ linkId: 42 });
  });

  it('sorts decorations strictly ascending by from offset for CodeMirror', () => {
    const rawLinks: LspDocumentLink[] = [
      {
        range: { start: { line: 1, character: 14 }, end: { line: 1, character: 33 } },
        target: 'https://example.com',
      },
      {
        range: { start: { line: 0, character: 7 }, end: { line: 0, character: 22 } },
        target: './config.json',
      },
    ];

    const result = LspDocumentLinkMapper.mapToDecorations(
      uri,
      1,
      'test-provider',
      'session-1',
      rawLinks,
      text,
      roots
    );

    expect(result.decorations).toHaveLength(2);
    expect(result.decorations[0].from).toBeLessThan(result.decorations[1].from);
  });

  it('discards out-of-bounds or invalid ranges safely', () => {
    const rawLinks: LspDocumentLink[] = [
      {
        range: { start: { line: 99, character: 0 }, end: { line: 99, character: 10 } },
        target: 'https://example.com',
      },
      {
        range: { start: { line: 0, character: 5 }, end: { line: 0, character: 5 } }, // zero length
        target: 'https://example.com',
      },
    ];

    const result = LspDocumentLinkMapper.mapToDecorations(
      uri,
      1,
      'test-provider',
      'session-1',
      rawLinks,
      text,
      roots
    );

    expect(result.links).toHaveLength(0);
    expect(result.decorations).toHaveLength(0);
  });

  it('caps maximum links per document to MAX_LINKS_PER_DOCUMENT', () => {
    const rawLinks: LspDocumentLink[] = [];
    for (let i = 0; i < 1200; i++) {
      rawLinks.push({
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
        target: 'https://example.com',
      });
    }

    const result = LspDocumentLinkMapper.mapToDecorations(
      uri,
      1,
      'test-provider',
      'session-1',
      rawLinks,
      text,
      roots
    );

    expect(result.links).toHaveLength(LspDocumentLinkMapper.MAX_LINKS_PER_DOCUMENT);
  });

  it('handles non-array inputs gracefully', () => {
    expect(
      LspDocumentLinkMapper.mapToDecorations(uri, 1, 'prov', 'sess', null, text, roots).links
    ).toEqual([]);
    expect(
      LspDocumentLinkMapper.mapToDecorations(uri, 1, 'prov', 'sess', 'invalid', text, roots).links
    ).toEqual([]);
  });
});
