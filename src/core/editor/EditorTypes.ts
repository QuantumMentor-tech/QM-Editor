/**
 * QM Editor Engine Coordination & Text Model Types
 * Phase 04, Step 37 — Core Application Engine
 */

import { SingleTextEdit, TransactionOrigin } from '../edit/EditTypes';
import { EditorAdapterInterface } from '../../components/editor/EditorAdapter';

// ---------------------------------------------------------------------------
// 1. Ranges & Coordinates
// ---------------------------------------------------------------------------

export interface DocumentRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface OffsetRange {
  from: number;
  to: number;
}

export interface Position {
  line: number;
  column: number;
}

export interface EditorSelectionRange {
  anchor: number;
  head: number;
}

// ---------------------------------------------------------------------------
// 2. View State
// ---------------------------------------------------------------------------

export interface EditorViewState {
  documentId: string;
  cursorPosition: Position;
  selections: EditorSelectionRange[];
  scrollPosition?: { top: number; left: number };
  lastUpdated: number;
}

// ---------------------------------------------------------------------------
// 3. Text Model Contract
// ---------------------------------------------------------------------------

export interface TextModel {
  readonly documentId: string;
  readonly resourceUri: string;
  readonly revision: number;
  readonly isReadOnly: boolean;
  getText(): string;
  getLineCount(): number;
  getLineContent(line: number): string;
  getLineLength(line: number): number;
  positionToOffset(pos: Position): number;
  offsetToPosition(offset: number): Position;
  validateOffsetRange(range: OffsetRange): OffsetRange;
}

// ---------------------------------------------------------------------------
// 4. Programmatic Edit Transactions
// ---------------------------------------------------------------------------

export interface ProgrammaticEditTransaction {
  documentId: string;
  changes: SingleTextEdit[];
  expectedRevision?: number;
  source?: TransactionOrigin;
  description?: string;
  undoGroup?: string;
}

export type TransactionStatus =
  | 'applied'
  | 'stale'
  | 'rejected'
  | 'invalid_range'
  | 'read_only'
  | 'conflict'
  | 'failed';

export interface TransactionApplyResult {
  status: TransactionStatus;
  documentId: string;
  newRevision?: number;
  appliedOperationsCount: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// 5. Editor Instance Record
// ---------------------------------------------------------------------------

export interface EditorInstanceRecord {
  id: string;
  documentId: string;
  adapter: EditorAdapterInterface;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// 6. Editor Coordination Events
// ---------------------------------------------------------------------------

export interface EditorCoordinationEventMap {
  'editor.instanceRegistered': {
    instanceId: string;
    documentId: string;
  };
  'editor.instanceUnregistered': {
    instanceId: string;
    documentId: string;
  };
  'editor.transactionApplied': {
    documentId: string;
    source: TransactionOrigin;
    newRevision: number;
    operationsCount: number;
  };
  'editor.transactionRejected': {
    documentId: string;
    reason: string;
    expectedRevision?: number;
    currentRevision?: number;
  };
  'editor.viewStateSaved': {
    documentId: string;
    cursorPosition: Position;
  };
  'editor.viewStateRestored': {
    documentId: string;
    cursorPosition: Position;
  };
  'editor.undoExecuted': {
    documentId: string;
    newRevision?: number;
    isDirty?: boolean;
  };
  'editor.redoExecuted': {
    documentId: string;
    newRevision?: number;
    isDirty?: boolean;
  };
  'editor.historyCleared': {
    documentId: string;
  };
}

export type EditorCoordinationEventKey = keyof EditorCoordinationEventMap;
export type EditorCoordinationEventListener<K extends EditorCoordinationEventKey> = (
  payload: EditorCoordinationEventMap[K]
) => void | Promise<void>;
