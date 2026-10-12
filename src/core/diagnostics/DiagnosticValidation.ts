/**
 * QM Editor Diagnostic Range, URI & Version Validation
 * Phase 04, Step 34 — Core Engine Diagnostics Model, Aggregation & Editor Integration
 */

import {
  Diagnostic,
  DiagnosticRange,
  DiagnosticSeverity,
} from './DiagnosticTypes';
import { DiagnosticValidationError } from './DiagnosticErrors';

/**
 * Normalizes a file path or URI into a canonical, cross-platform string.
 */
export function normalizeDiagnosticUri(uriOrPath: string): string {
  if (!uriOrPath || typeof uriOrPath !== 'string') {
    return '';
  }
  let normalized = uriOrPath.trim().replace(/\\/g, '/');
  // Normalize Windows drive letter to uppercase or consistent format: e.g. "c:/" -> "C:/"
  if (/^[a-zA-Z]:\//.test(normalized)) {
    normalized = normalized[0].toUpperCase() + normalized.slice(1);
  }
  return normalized;
}

/**
 * Validates and normalizes a diagnostic range.
 * Coordinates are 1-based.
 */
export function validateAndNormalizeRange(range: Partial<DiagnosticRange>): DiagnosticRange {
  if (!range) {
    return { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 };
  }

  let startLine = typeof range.startLine === 'number' && !Number.isNaN(range.startLine)
    ? Math.max(1, Math.floor(range.startLine))
    : 1;

  let startColumn = typeof range.startColumn === 'number' && !Number.isNaN(range.startColumn)
    ? Math.max(1, Math.floor(range.startColumn))
    : 1;

  let endLine = typeof range.endLine === 'number' && !Number.isNaN(range.endLine)
    ? Math.max(startLine, Math.floor(range.endLine))
    : startLine;

  let endColumn = typeof range.endColumn === 'number' && !Number.isNaN(range.endColumn)
    ? Math.max(1, Math.floor(range.endColumn))
    : startColumn;

  // If start and end are on the same line, ensure endColumn >= startColumn
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

const VALID_SEVERITIES = new Set<DiagnosticSeverity>(['error', 'warning', 'info', 'hint']);

/**
 * Validates and sanitizes an incoming diagnostic object.
 */
export function validateDiagnostic(
  diag: Partial<Diagnostic>,
  fallbackOwner: string = 'editor'
): Diagnostic {
  if (!diag || typeof diag !== 'object') {
    throw new DiagnosticValidationError('Diagnostic payload must be an object');
  }

  if (!diag.message || typeof diag.message !== 'string') {
    throw new DiagnosticValidationError('Diagnostic must contain a non-empty message string');
  }

  const uri = normalizeDiagnosticUri(diag.uri || '');
  if (!uri) {
    throw new DiagnosticValidationError('Diagnostic must specify a valid resource URI / file path');
  }

  const severity: DiagnosticSeverity =
    diag.severity && VALID_SEVERITIES.has(diag.severity)
      ? diag.severity
      : 'error';

  const source = (diag.source && typeof diag.source === 'string' && diag.source.trim())
    ? diag.source.trim()
    : fallbackOwner;

  const range = validateAndNormalizeRange(diag.range || {
    startLine: (diag as any).line,
    startColumn: (diag as any).column,
    endLine: (diag as any).endLine,
    endColumn: (diag as any).endColumn,
  });

  const id = diag.id && typeof diag.id === 'string'
    ? diag.id
    : `diag-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  return {
    id,
    uri,
    range,
    severity,
    message: diag.message.trim(),
    source,
    code: diag.code,
    tags: Array.isArray(diag.tags) ? [...diag.tags] : undefined,
    relatedInformation: Array.isArray(diag.relatedInformation) ? [...diag.relatedInformation] : undefined,
    documentRevision: typeof diag.documentRevision === 'number' ? diag.documentRevision : undefined,
    data: diag.data,
    createdAt: typeof diag.createdAt === 'number' ? diag.createdAt : Date.now(),
  };
}

/**
 * Converts line/column 1-based range into 0-based character offsets for editor surface.
 */
export function rangeToCharacterOffsets(
  range: DiagnosticRange,
  docContent: string
): { from: number; to: number } {
  if (!docContent || docContent.length === 0) {
    return { from: 0, to: 0 };
  }

  const lines = docContent.split('\n');
  const lineCount = lines.length;

  const safeStartLine = Math.min(range.startLine, lineCount);
  const safeEndLine = Math.min(range.endLine, lineCount);

  // Calculate start offset
  let from = 0;
  for (let i = 0; i < safeStartLine - 1; i++) {
    from += lines[i].length + 1; // +1 for '\n'
  }
  const startLineText = lines[safeStartLine - 1] || '';
  from += Math.min(range.startColumn - 1, startLineText.length);

  // Calculate end offset
  let to = 0;
  for (let i = 0; i < safeEndLine - 1; i++) {
    to += lines[i].length + 1;
  }
  const endLineText = lines[safeEndLine - 1] || '';
  to += Math.min(range.endColumn - 1, endLineText.length);

  // Clamp within bounds
  from = Math.max(0, Math.min(from, docContent.length));
  to = Math.max(from, Math.min(to, docContent.length));

  // If start and end offset are identical, expand to at least 1 character or word boundary
  if (from === to && from < docContent.length) {
    to = from + 1;
  }

  return { from, to };
}

/**
 * Sorts diagnostics logically:
 * 1. Line number ascending
 * 2. Column number ascending
 * 3. Severity precedence: error (0) > warning (1) > info (2) > hint (3)
 */
export function sortDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  const severityRank: Record<DiagnosticSeverity, number> = {
    error: 0,
    warning: 1,
    info: 2,
    hint: 3,
  };

  return [...diagnostics].sort((a, b) => {
    if (a.range.startLine !== b.range.startLine) {
      return a.range.startLine - b.range.startLine;
    }
    if (a.range.startColumn !== b.range.startColumn) {
      return a.range.startColumn - b.range.startColumn;
    }
    const rankDiff = severityRank[a.severity] - severityRank[b.severity];
    if (rankDiff !== 0) return rankDiff;
    return a.message.localeCompare(b.message);
  });
}
