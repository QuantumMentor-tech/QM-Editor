/**
 * QM Editor Navigation Coordinator Tests
 * Phase 04, Step 41 — Code Navigation, Symbols, Locations & Outline Engine
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  normalizeLocationUri,
  validateAndNormalizeRange,
  createLocation,
  areLocationsEqual,
  clampRangeToDocument,
} from './LocationValidation';
import {
  NavigationCoordinator,
} from './NavigationCoordinator';
import { DocumentEngine } from '../documents/DocumentEngine';
import { EditorCoordinationService } from '../editor/EditorCoordinationService';
import { NavigationService } from '../../services/NavigationService';
import { globalWorkspaceEngine } from '../workspace';

describe('LocationValidation & Utilities', () => {
  it('normalizes cross-platform URIs and Windows drive letters', () => {
    expect(normalizeLocationUri('c:\\project\\src\\index.ts')).toBe('C:/project/src/index.ts');
    expect(normalizeLocationUri('D:/repo/file.txt/')).toBe('D:/repo/file.txt');
    expect(normalizeLocationUri('   file:///app/main.js   ')).toBe('file:///app/main.js');
    expect(normalizeLocationUri('')).toBe('');
  });

  it('validates and normalizes 1-based text coordinates', () => {
    const range = validateAndNormalizeRange({
      startLine: -5,
      startColumn: 0,
      endLine: -1,
      endColumn: -10,
    });
    expect(range).toEqual({
      startLine: 1,
      startColumn: 1,
      endLine: 1,
      endColumn: 1,
    });

    const validRange = validateAndNormalizeRange({
      startLine: 10,
      startColumn: 5,
      endLine: 8, // Less than startLine
      endColumn: 2,
    });
    expect(validRange.endLine).toBe(10);
    expect(validRange.endColumn).toBe(5);
  });

  it('creates canonical Location structures', () => {
    const loc = createLocation('C:/test/file.ts', { startLine: 12, startColumn: 4, endLine: 12, endColumn: 20 }, undefined, 'ws-1');
    expect(loc.uri).toBe('C:/test/file.ts');
    expect(loc.range?.startLine).toBe(12);
    expect(loc.workspaceId).toBe('ws-1');
  });

  it('evaluates location equality with jitter tolerance', () => {
    const locA = createLocation('file.ts', { startLine: 10, startColumn: 1, endLine: 10, endColumn: 1 });
    const locB = createLocation('file.ts', { startLine: 12, startColumn: 1, endLine: 12, endColumn: 1 });
    const locC = createLocation('other.ts', { startLine: 10, startColumn: 1, endLine: 10, endColumn: 1 });

    expect(areLocationsEqual(locA, locB, 0)).toBe(false);
    expect(areLocationsEqual(locA, locB, 3)).toBe(true);
    expect(areLocationsEqual(locA, locC, 5)).toBe(false);
  });

  it('clamps ranges safely against real document content', () => {
    const content = 'line 1\nline 2 with extra text\nline 3';
    const { clampedRange, wasClamped } = clampRangeToDocument(
      { startLine: 50, startColumn: 100, endLine: 80, endColumn: 200 },
      content
    );

    expect(wasClamped).toBe(true);
    expect(clampedRange.startLine).toBe(3);
    expect(clampedRange.endLine).toBe(3);
    expect(clampedRange.startColumn).toBe(content.split('\n')[2].length + 1);
  });
});

describe('NavigationCoordinator', () => {
  let docEngine: DocumentEngine;
  let editorCoord: EditorCoordinationService;
  let navService: NavigationService;
  let coordinator: NavigationCoordinator;

  beforeEach(() => {
    docEngine = new DocumentEngine();
    editorCoord = new EditorCoordinationService();
    navService = new NavigationService();
    coordinator = new NavigationCoordinator(docEngine, editorCoord, navService);
  });

  afterEach(() => {
    coordinator.dispose();
    docEngine.dispose();
    editorCoord.dispose();
  });

  it('rejects empty location URI with INVALID_LOCATION', async () => {
    const res = await coordinator.navigateToLocation({ uri: '' });
    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('INVALID_LOCATION');
  });

  it('navigates to already-open resource without creating duplicate document', async () => {
    // Pre-populate document in DocumentEngine
    const opened = await docEngine.openResource('C:/project/app.ts', {
      initialContent: 'function test() {\n  return 42;\n}',
    });

    const startedSpy = vi.fn();
    const completedSpy = vi.fn();
    coordinator.on('navigation.started', startedSpy);
    coordinator.on('navigation.completed', completedSpy);

    const res = await coordinator.navigateToLocation({
      uri: 'C:/project/app.ts',
      range: { startLine: 2, startColumn: 3, endLine: 2, endColumn: 12 },
    });

    expect(res.success).toBe(true);
    expect(res.alreadyOpen).toBe(true);
    expect(res.documentId).toBe(opened.document.id);
    expect(startedSpy).toHaveBeenCalledTimes(1);
    expect(completedSpy).toHaveBeenCalledTimes(1);

    // Verify history was recorded
    expect(navService.getState().currentLocation?.documentId).toBe(opened.document.id);
    expect(navService.getState().currentLocation?.line).toBe(2);
  });

  it('navigates to closed resource via registered document opener handler', async () => {
    let openerCalledWith = '';
    coordinator.registerDocumentOpener({
      openDocument: async (uri: string) => {
        openerCalledWith = uri;
        const record = await docEngine.openResource(uri, {
          initialContent: 'hello world from file',
        });
        return record.document.id;
      },
      activateDocument: vi.fn(),
    });

    const res = await coordinator.navigateToLocation({
      uri: 'C:/repo/readme.md',
      range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 5 },
    });

    expect(openerCalledWith).toBe('C:/repo/readme.md');
    expect(res.success).toBe(true);
    expect(res.clamped).toBe(false);
  });

  it('safely clamps out-of-bounds ranges and reports clamped flag', async () => {
    await docEngine.openResource('C:/repo/short.txt', {
      initialContent: 'alpha\nbeta',
    });

    const res = await coordinator.navigateToLocation({
      uri: 'C:/repo/short.txt',
      range: { startLine: 50, startColumn: 99, endLine: 60, endColumn: 99 },
    });

    expect(res.success).toBe(true);
    expect(res.clamped).toBe(true);
    expect(res.location.range?.startLine).toBe(2);
  });

  it('protects against stale navigation callbacks and race conditions', async () => {
    // Mock slow opener for Navigation A
    let resolveSlowOpener: (id: string) => void;
    const slowOpenerPromise = new Promise<string>((resolve) => {
      resolveSlowOpener = resolve;
    });

    let openerCalls = 0;
    coordinator.registerDocumentOpener({
      openDocument: async () => {
        openerCalls++;
        if (openerCalls === 1) {
          return slowOpenerPromise;
        }
        const doc = await docEngine.openResource('C:/fast.ts', { initialContent: 'fast' });
        return doc.document.id;
      },
      activateDocument: vi.fn(),
    });

    // Start slow Navigation A
    const navAPromise = coordinator.navigateToLocation({ uri: 'C:/slow.ts' });

    // Start fast Navigation B immediately afterwards
    const navBPromise = coordinator.navigateToLocation({ uri: 'C:/fast.ts' });

    // B completes
    const resB = await navBPromise;
    expect(resB.success).toBe(true);

    // Now let slow A complete afterwards
    const slowDoc = await docEngine.openResource('C:/slow.ts', { initialContent: 'slow' });
    resolveSlowOpener!(slowDoc.document.id);

    const resA = await navAPromise;
    expect(resA.success).toBe(false);
    expect(resA.errorCode).toBe('STALE_REQUEST');
  });

  it('aborts navigation if workspace changes mid-flight', async () => {
    vi.spyOn(globalWorkspaceEngine, 'getWorkspaceId').mockReturnValueOnce('ws-initial').mockReturnValue('ws-switched');

    coordinator.registerDocumentOpener({
      openDocument: async () => {
        // Workspace switches while reading
        return 'doc-1';
      },
      activateDocument: vi.fn(),
    });

    const res = await coordinator.navigateToLocation({
      uri: 'C:/file.ts',
      workspaceId: 'ws-initial',
    });

    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('WORKSPACE_MISMATCH');
  });

  it('integrates with history and supports back/forward navigation', async () => {
    await docEngine.openResource('C:/file1.ts', { initialContent: 'line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nline9\nline10' });
    await docEngine.openResource('C:/file2.ts', { initialContent: 'content file 2' });

    await coordinator.navigateToLocation({ uri: 'C:/file1.ts', range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 } });
    await coordinator.navigateToLocation({ uri: 'C:/file1.ts', range: { startLine: 8, startColumn: 1, endLine: 8, endColumn: 1 } });

    expect(coordinator.canNavigateBack()).toBe(true);
    const backRes = await coordinator.navigateBack();
    expect(backRes?.success).toBe(true);
    expect(backRes?.location.range?.startLine).toBe(1);

    expect(coordinator.canNavigateForward()).toBe(true);
    const forwardRes = await coordinator.navigateForward();
    expect(forwardRes?.success).toBe(true);
    expect(forwardRes?.location.range?.startLine).toBe(8);
  });

  it('returns DISPOSED error when calling navigateToLocation after disposal', async () => {
    coordinator.dispose();
    const res = await coordinator.navigateToLocation({ uri: 'C:/file.ts' });
    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('DISPOSED');
  });
});
