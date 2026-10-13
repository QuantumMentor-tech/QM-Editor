/**
 * QM Editor Diagnostic Range, URI & Version Validation
 * Phase 04, Step 34 & Step 40 — Core Engine Diagnostics Model, Aggregation & Editor Integration
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
export function validateAndNormalizeRange(range?: Partial<DiagnosticRange> | null): DiagnosticRange {
  if (!range) {
    return { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 };
  }

  const startLine = typeof range.startLine === 'number' && !Number.isNaN(range.startLine)
    ? Math.max(1, Math.floor(range.startLine))
    : 1;

  const startColumn = typeof range.startColumn === 'number' && !Number.isNaN(range.startColumn)
    ? Math.max(1, Math.floor(range.startColumn))
    : 1;

  const endLine = typeof range.endLine === 'number' && !Number.isNaN(range.endLine)
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
 * Generates a deterministic stable ID for a diagnostic.
 */
export function generateDiagnosticId(
  source: string,
  uri: string,
  range: DiagnosticRange | undefined,
  message: string,
  code?: string | number
): string {
  const rangeKey = range ? `${range.startLine}:${range.startColumn}-${range.endLine}:${range.endColumn}` : 'res';
  let hash = 0;
  for (let i = 0; i < message.length; i++) {
    hash = ((hash << 5) - hash) + message.charCodeAt(i);
    hash |= 0;
  }
  const codePart = code !== undefined ? `-${code}` : '';
  const sanitizedUri = uri.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `diag-${source}-${sanitizedUri}-${rangeKey}${codePart}-${Math.abs(hash).toString(36)}`;
}

export interface ValidateDiagnosticOptions {
  /** If true, allows range to remain undefined for resource/workspace-level issues */
  allowResourceLevel?: boolean;
}

/**
 * Validates and sanitizes an incoming diagnostic object.
 */
export function validateDiagnostic(
  diag: Partial<Diagnostic>,
  fallbackOwner: string = 'editor',
  options?: ValidateDiagnosticOptions
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

  // Range resolution:
  // 1. Explicit resource-level (range === null or option allowResourceLevel with no range or line coords)
  // 2. Point diagnostics: (diag as any).line without range
  // 3. Structured range: diag.range
  let range: DiagnosticRange | undefined;
  const isExplicitResourceLevel =
    (diag as any).range === null ||
    (diag as any).isResourceLevel === true ||
    (options?.allowResourceLevel && diag.range === undefined && (diag as any).line === undefined && (diag as any).startLine === undefined);

  if (isExplicitResourceLevel) {
    range = undefined;
  } else if (diag.range) {
    range = validateAndNormalizeRange(diag.range);
  } else if (typeof (diag as any).line === 'number') {
    // Point diagnostic normalization
    const line = (diag as any).line;
    const col = typeof (diag as any).column === 'number' ? (diag as any).column : 1;
    const endLine = typeof (diag as any).endLine === 'number' ? (diag as any).endLine : line;
    const endCol = typeof (diag as any).endColumn === 'number' ? (diag as any).endColumn : col;
    range = validateAndNormalizeRange({
      startLine: line,
      startColumn: col,
      endLine,
      endColumn: endCol,
    });
  } else {
    // Default fallback to 1:1:1:1
    range = validateAndNormalizeRange(undefined);
  }

  const id = diag.id && typeof diag.id === 'string' && diag.id.trim()
    ? diag.id.trim()
    : generateDiagnosticId(source, uri, range, diag.message, diag.code);

  return {
    id,
    uri,
    range,
    severity,
    message: diag.message.trim(),
    detail: diag.detail,
    source,
    providerId: diag.providerId || fallbackOwner,
    workspaceId: diag.workspaceId,
    generation: diag.generation,
    code: diag.code,
    tags: Array.isArray(diag.tags) ? [...diag.tags] : undefined,
    relatedInformation: Array.isArray(diag.relatedInformation) ? [...diag.relatedInformation] : undefined,
    documentRevision: typeof diag.documentRevision === 'number' ? diag.documentRevision : undefined,
    data: diag.data,
    createdAt: typeof diag.createdAt === 'number' ? diag.createdAt : Date.now(),
  };
}

/**
 * Checks whether two diagnostics are functionally identical.
 */
export function areDiagnosticsEqual(a: Diagnostic, b: Diagnostic): boolean {
  if (a === b) return true;
  if (
    a.id !== b.id ||
    a.uri !== b.uri ||
    a.severity !== b.severity ||
    a.message !== b.message ||
    a.source !== b.source ||
    a.code !== b.code ||
    a.detail !== b.detail ||
    a.documentRevision !== b.documentRevision
  ) {
    return false;
  }

  if ((a.range === undefined) !== (b.range === undefined)) {
    return false;
  }
  if (a.range && b.range) {
    if (
      a.range.startLine !== b.range.startLine ||
      a.range.startColumn !== b.range.startColumn ||
      a.range.endLine !== b.range.endLine ||
      a.range.endColumn !== b.range.endColumn
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Checks whether two arrays of diagnostics are functionally identical.
 */
export function areDiagnosticArraysEqual(
  a: readonly Diagnostic[],
  b: readonly Diagnostic[]
): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!areDiagnosticsEqual(a[i], b[i])) {
      return false;
    }
  }
  return true;
}

/**
 * Converts line/column 1-based range into 0-based character offsets for editor surface.
 */
export function rangeToCharacterOffsets(
  range: DiagnosticRange | undefined,
  docContent: string
): { from: number; to: number } {
  if (!range || !docContent || docContent.length === 0) {
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
 * 1. URI ascending
 * 2. Resource-level first (line 0), then Line number ascending
 * 3. Column number ascending
 * 4. Severity precedence: error (0) > warning (1) > info (2) > hint (3)
 * 5. Message ascending
 */
export function sortDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  const severityRank: Record<DiagnosticSeverity, number> = {
    error: 0,
    warning: 1,
    info: 2,
    hint: 3,
  };

  return [...diagnostics].sort((a, b) => {
    if (a.uri !== b.uri) {
      return a.uri.localeCompare(b.uri);
    }
    const aLine = a.range ? a.range.startLine : 0;
    const bLine = b.range ? b.range.startLine : 0;
    if (aLine !== bLine) {
      return aLine - bLine;
    }
    const aColumn = a.range ? a.range.startColumn : 0;
    const bColumn = b.range ? b.range.startColumn : 0;
    if (aColumn !== bColumn) {
      return aColumn - bColumn;
    }
    const rankDiff = severityRank[a.severity] - severityRank[b.severity];
    if (rankDiff !== 0) return rankDiff;
    return a.message.localeCompare(b.message);
  });
}
