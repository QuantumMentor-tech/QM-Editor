/**
 * QM Editor Per-Document Undo/Redo History Stack
 * Phase 04, Step 33 — Core Document Lifecycle Subsystem
 */

import { CommittedEditTransaction } from '../edit/EditTypes';
import {
  HistoryEntry,
  EditGroup,
  HistoryItem,
  isEditGroup,
  DocumentHistoryOptions,
} from './HistoryTypes';
import { createInverseTransaction } from './HistoryInversion';
import { InvalidGroupStateError } from './HistoryErrors';

export const DEFAULT_MAX_HISTORY_DEPTH = 500;
export const DEFAULT_AUTO_GROUP_THRESHOLD_MS = 400;

export class DocumentHistoryStack {
  public readonly documentId: string;
  private maxDepth: number;
  private autoGroupThresholdMs: number;

  private undoStack: HistoryItem[] = [];
  private redoStack: HistoryItem[] = [];

  private activeGroup: EditGroup | null = null;
  private savedRevision?: number;

  constructor(documentId: string, options: DocumentHistoryOptions = {}) {
    this.documentId = documentId;
    this.maxDepth = options.maxDepth ?? DEFAULT_MAX_HISTORY_DEPTH;
    this.autoGroupThresholdMs = options.autoGroupThresholdMs ?? DEFAULT_AUTO_GROUP_THRESHOLD_MS;
  }

  // ---------------------------------------------------------------------------
  // 1. Transaction Ingestion & Stacking
  // ---------------------------------------------------------------------------

  /**
   * Pushes a committed transaction onto the history stack.
   * Clears the redo stack on fresh forward edits.
   */
  public push(committedTx: CommittedEditTransaction): HistoryEntry {
    const inverseTx = createInverseTransaction(committedTx);

    const entry: HistoryEntry = {
      id: `entry-${committedTx.id}`,
      documentId: this.documentId,
      groupId: this.activeGroup?.id || (committedTx.metadata?.groupId as string | undefined),
      groupLabel: this.activeGroup?.label || (committedTx.metadata?.groupLabel as string | undefined),
      forwardTransaction: committedTx,
      inverseTransaction: inverseTx,
      baseRevision: committedTx.baseRevision,
      targetRevision: committedTx.targetRevision,
      timestamp: committedTx.appliedAt || Date.now(),
      selectionsBefore: committedTx.selectionsBefore,
      selectionsAfter: committedTx.selectionsAfter,
    };

    // If an explicit group is active, append to the group
    if (this.activeGroup) {
      this.activeGroup.entries.push(entry);
      return entry;
    }

    // Auto-grouping check: consecutive single-character typing within threshold
    if (this.canAutoGroup(entry)) {
      const top = this.undoStack[this.undoStack.length - 1];
      if (isEditGroup(top)) {
        top.entries.push(entry);
        top.timestamp = entry.timestamp;
      } else {
        // Convert top entry into a new EditGroup
        const previousEntry = this.undoStack.pop() as HistoryEntry;
        const autoGroup: EditGroup = {
          id: `auto-group-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          documentId: this.documentId,
          label: 'Typing',
          entries: [previousEntry, entry],
          timestamp: entry.timestamp,
          isComplete: true,
        };
        this.undoStack.push(autoGroup);
      }
    } else {
      this.undoStack.push(entry);
    }

    // A fresh edit invalidates all redo branches
    this.redoStack = [];

    // Bound memory / stack depth
    this.enforceMaxDepth();

    return entry;
  }

  /**
   * Determines if a new entry should be coalesced into an auto-group with the top entry.
   */
  private canAutoGroup(newEntry: HistoryEntry): boolean {
    if (this.autoGroupThresholdMs <= 0) return false;
    if (this.undoStack.length === 0) return false;

    // Only auto-group typing actions
    if (newEntry.forwardTransaction.origin !== 'user') return false;
    if (newEntry.forwardTransaction.changes.length !== 1) return false;

    const newChange = newEntry.forwardTransaction.changes[0];
    // Simple 1-character typing / delete
    if (newChange.insertText.length > 2) return false;

    const top = this.undoStack[this.undoStack.length - 1];
    const topEntry = isEditGroup(top)
      ? top.entries[top.entries.length - 1]
      : top;

    if (!topEntry) return false;
    if (topEntry.forwardTransaction.origin !== 'user') return false;

    const timeDiff = newEntry.timestamp - topEntry.timestamp;
    return timeDiff <= this.autoGroupThresholdMs;
  }

  private enforceMaxDepth(): void {
    while (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Explicit Edit Grouping
  // ---------------------------------------------------------------------------

  public beginGroup(label?: string): string {
    if (this.activeGroup) {
      throw new InvalidGroupStateError(
        this.documentId,
        `Cannot start group "${label || 'unnamed'}": a group is already active ("${this.activeGroup.id}").`
      );
    }

    const groupId = `group-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    this.activeGroup = {
      id: groupId,
      documentId: this.documentId,
      label,
      entries: [],
      timestamp: Date.now(),
      isComplete: false,
    };

    return groupId;
  }

  public endGroup(): void {
    if (!this.activeGroup) {
      return;
    }

    const group = this.activeGroup;
    group.isComplete = true;
    this.activeGroup = null;

    if (group.entries.length > 0) {
      this.undoStack.push(group);
      this.redoStack = [];
      this.enforceMaxDepth();
    }
  }

  public isGroupActive(): boolean {
    return this.activeGroup !== null;
  }

  // ---------------------------------------------------------------------------
  // 3. Undo / Redo Pop & Push
  // ---------------------------------------------------------------------------

  public popUndo(): HistoryItem | undefined {
    return this.undoStack.pop();
  }

  public pushRedo(item: HistoryItem): void {
    this.redoStack.push(item);
  }

  public popRedo(): HistoryItem | undefined {
    return this.redoStack.pop();
  }

  public pushUndo(item: HistoryItem): void {
    this.undoStack.push(item);
    this.enforceMaxDepth();
  }

  // ---------------------------------------------------------------------------
  // 4. Query & Status Inspection
  // ---------------------------------------------------------------------------

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public getUndoCount(): number {
    return this.undoStack.length;
  }

  public getRedoCount(): number {
    return this.redoStack.length;
  }

  public markSaved(revision: number): void {
    this.savedRevision = revision;
  }

  public getSavedRevision(): number | undefined {
    return this.savedRevision;
  }

  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.activeGroup = null;
  }
}
