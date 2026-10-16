/**
 * QM Editor LSP Code Navigation Types
 * Phase 06, Step 60 — LSP Code Navigation, Definitions, Declarations, Type Definitions & References
 */

import { Location, Position } from '../../navigation/LocationTypes';

export type LspNavigationKind = 'definition' | 'declaration' | 'typeDefinition' | 'references';

/**
 * Normalized navigation request context passed to LSP Navigation Providers.
 */
export interface LspNavigationRequest {
  readonly requestId: string;
  readonly documentId: string;
  readonly uri: string;
  readonly languageId: string;
  readonly revision: number;
  readonly position: Position; // 1-based (line, column)
  readonly workspaceId?: string;
  readonly serverSessionId?: string;
  readonly serverGeneration?: number;
}

/**
 * References request context extending canonical navigation request.
 */
export interface LspReferenceRequest extends LspNavigationRequest {
  readonly includeDeclaration?: boolean;
}

/**
 * Group of reference locations belonging to a specific resource.
 */
export interface ReferenceGroup {
  readonly uri: string;
  readonly displayPath: string;
  readonly locations: readonly Location[];
}

/**
 * Canonical Reference Result model suitable for application-level navigation and UI.
 */
export interface ReferenceResult {
  readonly requestId: string;
  readonly locations: readonly Location[];
  readonly totalCount: number;
  readonly groups: readonly ReferenceGroup[];
  readonly isCancelled?: boolean;
  readonly durationMs?: number;
}

/**
 * Declared navigation capabilities of an LSP server or provider.
 */
export interface NavigationProviderCapabilities {
  readonly definition?: boolean;
  readonly declaration?: boolean;
  readonly typeDefinition?: boolean;
  readonly references?: boolean;
}

/**
 * Validation result for navigation coordinates and responses.
 */
export interface NavigationValidationResult<T> {
  readonly valid: boolean;
  readonly value?: T;
  readonly error?: string;
}
