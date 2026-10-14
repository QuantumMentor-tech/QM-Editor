/**
 * QM Editor Edit Transactions & Change Events — Types & Contracts
 * Phase 04, Step 31 — Core Document Lifecycle Subsystem
 */

export type TransactionOrigin =
  | 'user'
  | 'undo'
  | 'redo'
  | 'replace'
  | 'format'
  | 'snippet'
  | 'completion'
  | 'codeAction'
  | 'ime'
  | 'remote'
  | 'programmatic';

export interface SingleTextEdit {
  from: number;
  to: number;
  insertText: string;
  deletedText?: string;
}

export interface CursorSelection {
  anchor: number;
  head: number;
}

export interface EditTransaction {
  id?: string;
  documentId: string;
  baseRevision: number;
  targetRevision?: number;
  changes: SingleTextEdit[];
  origin?: TransactionOrigin;
  timestamp?: number;
  isComposition?: boolean;
  selectionsBefore?: CursorSelection[];
  selectionsAfter?: CursorSelection[];
  metadata?: Record<string, unknown>;
}

export interface CommittedEditTransaction {
  id: string;
  documentId: string;
  baseRevision: number;
  targetRevision: number;
  changes: SingleTextEdit[];
  origin: TransactionOrigin;
  timestamp: number;
  appliedAt: number;
  isComposition: boolean;
  contentBefore: string;
  contentAfter: string;
  isDirty: boolean;
  selectionsBefore?: CursorSelection[];
  selectionsAfter?: CursorSelection[];
  metadata?: Record<string, unknown>;
}

export interface DocumentChangeEventMap {
  'document.transactionWillApply': {
    documentId: string;
    transaction: EditTransaction;
    currentRevision: number;
  };
  'document.transactionApplied': {
    documentId: string;
    transaction: CommittedEditTransaction;
    previousRevision: number;
    newRevision: number;
    isDirty: boolean;
  };
  'document.transactionFailed': {
    documentId: string;
    transaction: EditTransaction;
    error: string;
  };
  'document.dirtyStateChanged': {
    documentId: string;
    isDirty: boolean;
    revision: number;
    savedRevision: number;
  };
  'document.compositionStarted': {
    documentId: string;
    timestamp: number;
  };
  'document.compositionEnded': {
    documentId: string;
    committedRevision: number;
    timestamp: number;
  };
}

export type DocumentChangeEventKey = keyof DocumentChangeEventMap;
export type DocumentChangeEventListener<K extends DocumentChangeEventKey> = (
  payload: DocumentChangeEventMap[K]
) => void | Promise<void>;
