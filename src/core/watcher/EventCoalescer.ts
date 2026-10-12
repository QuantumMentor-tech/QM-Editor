/**
 * QM Editor Filesystem Event Coalescer & Write Suppression
 * Phase 04, Step 32 — Core Engine Subsystem
 */

import {
  RawFileSystemEvent,
  CoalescedFileSystemEvent,
} from './WatcherTypes';
import { normalizeWorkspacePath } from '../workspace/WorkspaceResourceBoundary';

export const DEFAULT_COALESCE_WINDOW_MS = 50;
export const DEFAULT_WRITE_SUPPRESSION_WINDOW_MS = 1000;

export const DEFAULT_WATCHER_EXCLUDES = new Set([
  '.git',
  'node_modules',
  '.DS_Store',
  'dist',
  '.cache',
  'coverage',
]);

export interface EventCoalescerOptions {
  windowMs?: number;
  writeSuppressionMs?: number;
  onFlush?: (events: CoalescedFileSystemEvent[]) => void;
}

export class EventCoalescer {
  private windowMs: number;
  private writeSuppressionMs: number;
  private onFlush?: (events: CoalescedFileSystemEvent[]) => void;

  // Pending events keyed by normalized URI
  private pendingEvents = new Map<string, CoalescedFileSystemEvent>();

  // Internal self-write timestamps keyed by normalized URI
  private internalWrites = new Map<string, number>();

  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: EventCoalescerOptions = {}) {
    this.windowMs = options.windowMs ?? DEFAULT_COALESCE_WINDOW_MS;
    this.writeSuppressionMs = options.writeSuppressionMs ?? DEFAULT_WRITE_SUPPRESSION_WINDOW_MS;
    this.onFlush = options.onFlush;
  }

  /**
   * Records an internal application write to suppress echoing external change notifications.
   */
  public markInternalWrite(rawUri: string, durationMs?: number): void {
    const uri = normalizeWorkspacePath(rawUri);
    const expireAt = Date.now() + (durationMs ?? this.writeSuppressionMs);
    this.internalWrites.set(uri, expireAt);
  }

  /**
   * Checks whether a path currently has an active internal write suppression.
   */
  public isInternalWrite(rawUri: string): boolean {
    const uri = normalizeWorkspacePath(rawUri);
    const expireAt = this.internalWrites.get(uri);
    if (!expireAt) return false;

    if (Date.now() <= expireAt) {
      return true;
    }

    this.internalWrites.delete(uri);
    return false;
  }

  /**
   * Cleans up expired internal write entries.
   */
  public cleanExpiredInternalWrites(): void {
    const now = Date.now();
    for (const [uri, expireAt] of this.internalWrites.entries()) {
      if (now > expireAt) {
        this.internalWrites.delete(uri);
      }
    }
  }

  /**
   * Queues a raw filesystem event for coalescing and debounced dispatch.
   */
  public push(rawEvent: RawFileSystemEvent): void {
    const uri = normalizeWorkspacePath(rawEvent.uri);

    // 1. Check if path matches common ignored patterns
    const segments = uri.split('/');
    if (segments.some((seg) => DEFAULT_WATCHER_EXCLUDES.has(seg))) {
      return;
    }

    // 2. Check internal write suppression
    if (this.isInternalWrite(uri)) {
      return;
    }

    const event: CoalescedFileSystemEvent = {
      ...rawEvent,
      uri,
      oldUri: rawEvent.oldUri ? normalizeWorkspacePath(rawEvent.oldUri) : undefined,
    };

    // 3. Coalesce with any pending event for the same URI
    const existing = this.pendingEvents.get(uri);
    if (!existing) {
      this.pendingEvents.set(uri, event);
    } else {
      const merged = this.mergeEvents(existing, event);
      if (merged) {
        this.pendingEvents.set(uri, merged);
      } else {
        this.pendingEvents.delete(uri); // Event absorbed / cancelled out
      }
    }

    // 4. Schedule flush
    if (this.windowMs <= 0) {
      this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => {
        this.timer = null;
        this.flush();
      }, this.windowMs);
    }
  }

  /**
   * Merges two consecutive events on the same URI into a single coalesced event.
   * Returns null if the events cancel each other out (e.g. create followed by delete).
   */
  private mergeEvents(
    prev: CoalescedFileSystemEvent,
    curr: CoalescedFileSystemEvent
  ): CoalescedFileSystemEvent | null {
    if (prev.type === 'create') {
      if (curr.type === 'delete') {
        // Created and deleted within the debounce window -> no-op
        return null;
      }
      if (curr.type === 'modify') {
        // Created and modified -> final state is created
        return { ...prev, timestamp: curr.timestamp };
      }
      return curr;
    }

    if (prev.type === 'modify') {
      if (curr.type === 'delete') {
        return curr;
      }
      if (curr.type === 'modify') {
        return { ...curr, timestamp: curr.timestamp };
      }
      return curr;
    }

    if (prev.type === 'delete') {
      if (curr.type === 'create') {
        // Deleted then recreated -> modify
        return {
          uri: curr.uri,
          type: 'modify',
          timestamp: curr.timestamp,
          handle: curr.handle,
          workspaceGeneration: curr.workspaceGeneration,
        };
      }
      return curr;
    }

    // If rename followed by modify, keep rename with updated timestamp
    if (prev.type === 'rename' && curr.type === 'modify') {
      return { ...prev, timestamp: curr.timestamp };
    }

    return curr;
  }

  /**
   * Flushes all currently pending coalesced events.
   */
  public flush(): CoalescedFileSystemEvent[] {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.pendingEvents.size === 0) {
      return [];
    }

    const events = Array.from(this.pendingEvents.values());
    this.pendingEvents.clear();

    if (this.onFlush) {
      this.onFlush(events);
    }

    return events;
  }

  /**
   * Disposes timer and clears all buffers.
   */
  public dispose(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pendingEvents.clear();
    this.internalWrites.clear();
  }
}
