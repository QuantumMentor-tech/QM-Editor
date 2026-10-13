/**
 * QM Editor Document Engine & Resource Lifecycle Types
 * Phase 04, Step 36 — Core Application Engine
 */

import { FileResource } from '../../types';

// ---------------------------------------------------------------------------
// 1. Lifecycle & Content States
// ---------------------------------------------------------------------------

export type DocumentLifecycleState =
  | 'created'
  | 'loading'
  | 'ready'
  | 'saving'
  | 'saveFailed'
  | 'closing'
  | 'closed'
  | 'error';

export type DocumentContentState =
  | 'clean'
  | 'dirty'
  | 'saving'
  | 'saveFailed';

export type LineEnding = 'LF' | 'CRLF' | 'CR' | 'mixed' | 'unknown';

export type ReadOnlyReason =
  | 'filesystem'
  | 'permission'
  | 'policy'
  | 'virtual'
  | 'userMode';

export type ResourceScheme = 'file' | 'browser-fs' | 'untitled' | 'virtual';

// ---------------------------------------------------------------------------
// 2. Resource Representation
// ---------------------------------------------------------------------------

export interface NormalizedResource {
  /** Canonical normalized resource URI, e.g. "file:///C:/project/app.ts" or "untitled:1" */
  readonly uri: string;
  /** Resource scheme: "file" | "browser-fs" | "untitled" | "virtual" */
  readonly scheme: ResourceScheme;
  /** Basename of the resource, e.g. "app.ts" or "Untitled-1" */
  readonly name: string;
  /** Lowercase file extension without dot, e.g. "ts", or empty string */
  readonly extension: string;
  /** Whether the underlying resource exists on physical disk / storage */
  readonly exists: boolean;
  /** Whether resource is marked read-only */
  readonly readOnly: boolean;
  /** Optional file size in bytes */
  readonly size?: number;
  /** Optional last modified timestamp */
  readonly modifiedTime?: number;
  /** Optional native FileSystemFileHandle if backed by File System Access API */
  readonly handle?: FileSystemFileHandle;
}

// ---------------------------------------------------------------------------
// 3. Document Metadata & Capabilities
// ---------------------------------------------------------------------------

export interface DocumentMetadata {
  readonly languageId: string;
  readonly encoding: string;
  readonly lineEnding: LineEnding;
  readonly fileSize: number;
  readonly modifiedTime?: number;
  readonly isReadOnly: boolean;
  readonly readOnlyReason?: ReadOnlyReason;
  readonly missingResource: boolean;
  readonly externallyModified: boolean;
  readonly hasConflict: boolean;
}

export interface DocumentCapabilities {
  readonly canWrite: boolean;
  readonly canSaveAs: boolean;
  readonly canReload: boolean;
  readonly canClose: boolean;
  readonly writeBlockedReason?: string;
}

// ---------------------------------------------------------------------------
// 4. Core Document Record & Model
// ---------------------------------------------------------------------------

export interface DocumentRecord {
  /** Unique stable runtime document ID ("doc-1728...-abcde") */
  readonly id: string;
  /** Display title ("app.ts", "Untitled-1") */
  title: string;
  /** Authoritative in-memory content buffer */
  content: string;
  /** Normalized resource identifier */
  resourceUri: string;
  /** Normalized resource model */
  resource: NormalizedResource;
  /** Raw file path if filesystem-backed */
  filePath?: string;
  /** Associated workspace ID if owned by a workspace */
  workspaceId?: string;
  /** Language identifier ("typescript", "markdown", etc.) */
  languageId: string;
  /** Monotonic revision counter incremented on every accepted content mutation */
  contentRevision: number;
  /** Revision corresponding to the last confirmed saved baseline on storage */
  savedRevision: number;
  /** Derived dirty flag: contentRevision !== savedRevision */
  isDirty: boolean;
  /** High-level lifecycle state */
  lifecycleState: DocumentLifecycleState;
  /** Content state */
  contentState: DocumentContentState;
  /** Normalized metadata */
  metadata: DocumentMetadata;
  /** Capabilities */
  capabilities: DocumentCapabilities;
  /** Timestamp when document was created in runtime */
  createdAt: number;
  /** Timestamp of last confirmed save */
  lastSavedTimestamp: number;
  /** Saved baseline content snapshot (for accurate dirty state comparison across undo/redo) */
  savedBaselineContent?: string;
  /** Optional error message if in error or saveFailed state */
  lastError?: string;
}

// ---------------------------------------------------------------------------
// 5. Document Open & Save Options
// ---------------------------------------------------------------------------

export interface OpenDocumentOptions {
  /** Optional suggested language override */
  languageId?: string;
  /** Associated workspace ID */
  workspaceId?: string;
  /** Mark document as read-only */
  readOnly?: boolean;
  /** Reason for read-only status */
  readOnlyReason?: ReadOnlyReason;
  /** Initial content if creating or seeding */
  initialContent?: string;
  /** Whether to immediately activate the document in the UI */
  activate?: boolean;
}

export interface CreateUntitledOptions {
  /** Optional title (defaults to "Untitled-N") */
  title?: string;
  /** Initial content (defaults to "") */
  content?: string;
  /** Language ID (defaults to "plaintext") */
  languageId?: string;
  /** Associated workspace ID */
  workspaceId?: string;
  /** Whether to immediately activate */
  activate?: boolean;
}

export interface SaveDocumentOptions {
  /** Strict target revision to persist (defaults to current contentRevision) */
  targetRevision?: number;
}

export interface SaveAsOptions {
  /** New resource handle or target URI */
  target?: FileSystemFileHandle | FileResource | string;
  /** Suggested name for picker */
  suggestedName?: string;
}

// ---------------------------------------------------------------------------
// 6. Canonical Document Events
// ---------------------------------------------------------------------------

export interface DocumentEventPayload {
  documentId: string;
  resourceUri: string;
  workspaceId?: string;
}

export interface DocumentCreatedEventPayload extends DocumentEventPayload {
  title: string;
  isUntitled: boolean;
}

export interface DocumentOpeningEventPayload extends DocumentEventPayload {}

export interface DocumentOpenedEventPayload extends DocumentEventPayload {
  title: string;
  contentRevision: number;
}

export interface DocumentChangedEventPayload extends DocumentEventPayload {
  previousRevision: number;
  newRevision: number;
  origin: string;
  isDirty: boolean;
}

export interface DocumentDirtyChangedEventPayload extends DocumentEventPayload {
  isDirty: boolean;
  contentRevision: number;
  savedRevision: number;
}

export interface DocumentSavingEventPayload extends DocumentEventPayload {
  persistingRevision: number;
}

export interface DocumentSavedEventPayload extends DocumentEventPayload {
  savedRevision: number;
  isStillDirty: boolean;
  timestamp: number;
}

export interface DocumentSaveFailedEventPayload extends DocumentEventPayload {
  persistingRevision: number;
  error: string;
}

export interface DocumentExternalChangedEventPayload extends DocumentEventPayload {
  type: 'modify' | 'delete' | 'rename';
  reloaded: boolean;
}

export interface DocumentConflictDetectedEventPayload extends DocumentEventPayload {
  localRevision: number;
  reason: string;
}

export interface DocumentResourceChangedEventPayload extends DocumentEventPayload {
  oldResourceUri: string;
  newResourceUri: string;
  newTitle: string;
}

export interface DocumentReadOnlyChangedEventPayload extends DocumentEventPayload {
  isReadOnly: boolean;
  reason?: ReadOnlyReason;
}

export interface DocumentClosingEventPayload extends DocumentEventPayload {
  isDirty: boolean;
}

export interface DocumentClosedEventPayload extends DocumentEventPayload {
  title: string;
}

export interface DocumentEventMap {
  'document.created': DocumentCreatedEventPayload;
  'document.opening': DocumentOpeningEventPayload;
  'document.opened': DocumentOpenedEventPayload;
  'document.changed': DocumentChangedEventPayload;
  'document.dirtyChanged': DocumentDirtyChangedEventPayload;
  'document.saving': DocumentSavingEventPayload;
  'document.saved': DocumentSavedEventPayload;
  'document.saveFailed': DocumentSaveFailedEventPayload;
  'document.externalChanged': DocumentExternalChangedEventPayload;
  'document.conflictDetected': DocumentConflictDetectedEventPayload;
  'document.resourceChanged': DocumentResourceChangedEventPayload;
  'document.readOnlyChanged': DocumentReadOnlyChangedEventPayload;
  'document.closing': DocumentClosingEventPayload;
  'document.closed': DocumentClosedEventPayload;
}

export type DocumentEventKey = keyof DocumentEventMap;
export type DocumentEventListener<K extends DocumentEventKey> = (
  payload: DocumentEventMap[K]
) => void | Promise<void>;
