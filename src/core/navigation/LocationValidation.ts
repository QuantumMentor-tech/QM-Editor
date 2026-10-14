/**
 * QM Editor Canonical Location Validation & Normalization
 * Phase 04, Step 41 — Code Navigation, Symbols, Locations & Outline Engine
 */

import { Range, Location, Position } from './LocationTypes';

/**
 * Normalizes a file path or URI into a canonical, cross-platform string.
 * Strips duplicate slashes, normalizes backslashes to forward slashes,
 * and ensures uppercase drive letters on Windows.
 */
export function normalizeLocationUri(uriOrPath: string): string {
  if (!uriOrPath || typeof uriOrPath !== 'string') {
    return '';
  }
  let normalized = uriOrPath.trim().replace(/\\/g, '/');
  // Normalize Windows drive letter: e.g. "c:/" -> "C:/"
  if (/^[a-zA-Z]:\//.test(normalized)) {
    normalized = normalized[0].toUpperCase() + normalized.slice(1);
  }
  // Remove trailing slashes (except root "C:/" or "/")
  if (normalized.length > 3 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

/**
 * Validates and normalizes a 1-based text coordinate range.
 * Coordinates are strictly 1-based (>= 1).
 */
export function validateAndNormalizeRange(range?: Partial<Range> | null): Range {
  if (!range) {
    return { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 };
  }

  const startLine =
    typeof range.startLine === 'number' && !Number.isNaN(range.startLine)
      ? Math.max(1, Math.floor(range.startLine))
      : 1;

  const startColumn =
    typeof range.startColumn === 'number' && !Number.isNaN(range.startColumn)
      ? Math.max(1, Math.floor(range.startColumn))
      : 1;

  const endLine =
    typeof range.endLine === 'number' && !Number.isNaN(range.endLine)
      ? Math.max(startLine, Math.floor(range.endLine))
      : startLine;

  let endColumn =
    typeof range.endColumn === 'number' && !Number.isNaN(range.endColumn)
      ? Math.max(1, Math.floor(range.endColumn))
      : startColumn;

  if (endLine === startLine && endColumn < startColumn) {
    endColumn = startColumn;
  }

  return {
    startLine,
    startColumn,
    endLine,
    endColumn,
  };
}

/**
 * Validates and normalizes a 1-based position.
 */
export function validateAndNormalizePosition(pos?: Partial<Position> | null): Position {
  if (!pos) {
    return { line: 1, column: 1 };
  }
  return {
    line: typeof pos.line === 'number' && !Number.isNaN(pos.line) ? Math.max(1, Math.floor(pos.line)) : 1,
    column: typeof pos.column === 'number' && !Number.isNaN(pos.column) ? Math.max(1, Math.floor(pos.column)) : 1,
  };
}

/**
 * Creates a canonical Location object.
 */
export function createLocation(
  uri: string,
  range?: Partial<Range> | null,
  selectionRange?: Partial<Range> | null,
  workspaceId?: string,
  resourceId?: string
): Location {
  const normalizedUri = normalizeLocationUri(uri);
  const normalizedRange = range ? validateAndNormalizeRange(range) : undefined;
  const normalizedSel = selectionRange ? validateAndNormalizeRange(selectionRange) : undefined;

  return {
    uri: normalizedUri,
    range: normalizedRange,
    selectionRange: normalizedSel,
    workspaceId,
    resourceId,
  };
}

/**
 * Checks whether two locations are equal, with optional line delta tolerance.
 */
export function areLocationsEqual(
  a: Location | null | undefined,
  b: Location | null | undefined,
  lineTolerance: number = 0
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;

  if (normalizeLocationUri(a.uri).toLowerCase() !== normalizeLocationUri(b.uri).toLowerCase()) {
    return false;
  }

  if (a.workspaceId && b.workspaceId && a.workspaceId !== b.workspaceId) {
    return false;
  }

  const aRange = a.range;
  const bRange = b.range;

  if (!aRange && !bRange) return true;
  if (!aRange || !bRange) return false;

  if (lineTolerance > 0) {
    return Math.abs(aRange.startLine - bRange.startLine) <= lineTolerance;
  }

  return (
    aRange.startLine === bRange.startLine &&
    aRange.startColumn === bRange.startColumn &&
    aRange.endLine === bRange.endLine &&
    aRange.endColumn === bRange.endColumn
  );
}

/**
 * Clamps a 1-based Range against the real document content string to ensure safe navigation.
 * Prevents editor crashes when lines or columns exceed document boundaries.
 */
export function clampRangeToDocument(
  range: Range,
  docContent: string
): { clampedRange: Range; wasClamped: boolean } {
  if (docContent === undefined || docContent === null) {
    return { clampedRange: validateAndNormalizeRange(range), wasClamped: false };
  }

  const lines = docContent.split('\n');
  const lineCount = Math.max(1, lines.length);

  let wasClamped = false;

  let startLine = range.startLine;
  if (startLine > lineCount) {
    startLine = lineCount;
    wasClamped = true;
  }
  if (startLine < 1) {
    startLine = 1;
    wasClamped = true;
  }

  const startLineText = lines[startLine - 1] || '';
  const maxStartCol = Math.max(1, startLineText.length + 1);
  let startCol = range.startColumn;
  if (startCol > maxStartCol) {
    startCol = maxStartCol;
    wasClamped = true;
  }
  if (startCol < 1) {
    startCol = 1;
    wasClamped = true;
  }

  let endLine = range.endLine;
  if (endLine > lineCount) {
    endLine = lineCount;
    wasClamped = true;
  }
  if (endLine < startLine) {
    endLine = startLine;
    wasClamped = true;
  }

  const endLineText = lines[endLine - 1] || '';
  const maxEndCol = Math.max(1, endLineText.length + 1);
  let endCol = range.endColumn;
  if (endCol > maxEndCol) {
    endCol = maxEndCol;
    wasClamped = true;
  }
  if (endLine === startLine && endCol < startCol) {
    endCol = startCol;
    wasClamped = true;
  }

  return {
    clampedRange: {
      startLine,
      startColumn: startCol,
      endLine,
      endColumn: endCol,
    },
    wasClamped,
  };
}
