/**
 * QM Editor Canonical Location & Navigation Types
 * Phase 04, Step 41 — Code Navigation, Symbols, Locations & Outline Engine
 */

/**
 * 1-based text coordinates for canonical range representation.
 * Standardized across Diagnostics, Symbols, Search, and Navigation.
 */
export interface Range {
  startLine: number; // 1-based line number (>= 1)
  startColumn: number; // 1-based column number (>= 1)
  endLine: number; // 1-based line number (>= startLine)
  endColumn: number; // 1-based column number (>= 1)
}

/**
 * 1-based text position.
 */
export interface Position {
  line: number; // 1-based line number (>= 1)
  column: number; // 1-based column number (>= 1)
}

/**
 * Canonical Application-Level Location.
 * Represents where a resource exists, with optional content range and preferred selection.
 */
export interface Location {
  /** Normalized resource URI / file path */
  uri: string;
  /** Optional target range within the document (1-based) */
  range?: Range;
  /** Optional preferred selection range within the target range (e.g. identifier symbol) */
  selectionRange?: Range;
  /** Workspace ownership identifier if bound to a specific workspace */
  workspaceId?: string;
  /** Resource identity key if known */
  resourceId?: string;
}

/**
 * Options configuring a navigation operation.
 */
export interface NavigationOptions {
  /** If true, do not steal focus from the originating surface */
  preserveFocus?: boolean;
  /** How to reveal the target range in the editor view */
  revealType?: 'center' | 'top' | 'default';
  /** Whether to record this jump into the NavigationService history (defaults to true) */
  recordHistory?: boolean;
  /** Explicit preferred selection range override */
  selectionRange?: Range;
  /** Target workspace identity for cross-workspace validation */
  workspaceId?: string;
  /** Originating subsystem or feature tag (e.g. 'outline', 'goto-symbol', 'diagnostics', 'search', 'problems', 'quick-open') */
  origin?: string;
}

/**
 * Error codes for navigation failure.
 */
export type NavigationErrorCode =
  | 'INVALID_LOCATION'
  | 'RESOURCE_NOT_FOUND'
  | 'DOCUMENT_OPEN_FAILED'
  | 'STALE_REQUEST'
  | 'WORKSPACE_MISMATCH'
  | 'DISPOSED';

/**
 * Structured result returned by NavigationCoordinator.
 */
export interface NavigationResult {
  /** Whether navigation succeeded and the editor was positioned */
  success: boolean;
  /** The normalized canonical target location */
  location: Location;
  /** ID of the document activated or opened */
  documentId?: string;
  /** Whether the target document was already open before navigation */
  alreadyOpen?: boolean;
  /** Whether the range had to be clamped to document content boundaries */
  clamped?: boolean;
  /** Error message if navigation failed */
  error?: string;
  /** Structured error code if navigation failed */
  errorCode?: NavigationErrorCode;
}

/**
 * Navigation lifecycle events.
 */
export interface NavigationEventMap {
  'navigation.started': {
    sequenceId: number;
    location: Location;
    options?: NavigationOptions;
  };
  'navigation.completed': {
    sequenceId: number;
    location: Location;
    documentId: string;
    alreadyOpen: boolean;
    clamped: boolean;
    durationMs: number;
  };
  'navigation.failed': {
    sequenceId: number;
    location: Location;
    error: string;
    errorCode: NavigationErrorCode;
  };
  'navigation.cancelled': {
    sequenceId: number;
    location: Location;
    reason: string;
  };
}

export type NavigationEventKey = keyof NavigationEventMap;
export type NavigationEventListener<K extends NavigationEventKey> = (
  payload: NavigationEventMap[K]
) => void | Promise<void>;
