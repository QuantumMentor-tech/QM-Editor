/**
 * QM Editor Undo/Redo History & Edit Grouping — Types & Contracts
 * Phase 04, Step 33 — Core Document Lifecycle Subsystem
 */

import {
  CommittedEditTransaction,
  EditTransaction,
  CursorSelection,
} from '../edit/EditTypes';

export interface HistoryEntry {
  id: string;
  documentId: string;
  groupId?: string;
  groupLabel?: string;
  forwardTransaction: CommittedEditTransaction;
  inverseTransaction: EditTransaction;
  baseRevision: number;
  targetRevision: number;
  timestamp: number;
  selectionsBefore?: CursorSelection[];
  selectionsAfter?: CursorSelection[];
}

export interface EditGroup {
  id: string;
  documentId: string;
  label?: string;
  entries: HistoryEntry[];
  timestamp: number;
  isComplete: boolean;
}

export type HistoryItem = HistoryEntry | EditGroup;

export function isEditGroup(item: HistoryItem): item is EditGroup {
  return 'entries' in item && Array.isArray((item as EditGroup).entries);
}

export interface DocumentHistoryOptions {
  maxDepth?: number;
  autoGroupThresholdMs?: number;
}

export interface DocumentHistorySnapshot {
  documentId: string;
  undoCount: number;
  redoCount: number;
  savedRevision?: number;
  canUndo: boolean;
  canRedo: boolean;
}

export interface HistoryEventMap {
  'history.entryAdded': {
    documentId: string;
    entryId: string;
    groupId?: string;
    canUndo: boolean;
    canRedo: boolean;
  };
  'history.undone': {
    documentId: string;
    undoneRevision: number;
    newRevision: number;
    canUndo: boolean;
    canRedo: boolean;
  };
  'history.redone': {
    documentId: string;
    redoneRevision: number;
    newRevision: number;
    canUndo: boolean;
    canRedo: boolean;
  };
  'history.cleared': {
    documentId: string;
  };
  'history.savedRevisionSet': {
    documentId: string;
    savedRevision: number;
  };
  'history.groupStarted': {
    documentId: string;
    groupId: string;
    label?: string;
  };
  'history.groupEnded': {
    documentId: string;
    groupId: string;
  };
}

export type HistoryEventKey = keyof HistoryEventMap;
export type HistoryEventListener<K extends HistoryEventKey> = (
  payload: HistoryEventMap[K]
) => void | Promise<void>;
