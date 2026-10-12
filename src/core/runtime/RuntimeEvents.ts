/**
 * QM Editor Application Runtime Event Infrastructure
 * Phase 04, Step 29 — Core Application Runtime, Service Lifecycle & Dependency Orchestration
 */

import { RuntimeEventKey, RuntimeEventMap, RuntimeEventListener, Disposable } from './RuntimeTypes';
import { logger } from '../../utils/logger';

export class RuntimeEvents {
  private listeners: Map<RuntimeEventKey, Set<RuntimeEventListener<any>>> = new Map();

  /**
   * Subscribes to a runtime lifecycle event. Returns a Disposable handle.
   */
  public on<K extends RuntimeEventKey>(
    event: K,
    listener: RuntimeEventListener<K>
  ): Disposable {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener);

    let disposed = false;
    return {
      dispose: () => {
        if (disposed) return;
        disposed = true;
        const currentSet = this.listeners.get(event);
        if (currentSet) {
          currentSet.delete(listener);
          if (currentSet.size === 0) {
            this.listeners.delete(event);
          }
        }
      },
    };
  }

  /**
   * Subscribes to a runtime event for a single invocation.
   */
  public once<K extends RuntimeEventKey>(
    event: K,
    listener: RuntimeEventListener<K>
  ): Disposable {
    let subscription: Disposable | null = null;
    const wrapper: RuntimeEventListener<K> = (payload) => {
      subscription?.dispose();
      listener(payload);
    };
    subscription = this.on(event, wrapper);
    return subscription;
  }

  /**
   * Dispatches a runtime event with subscriber failure isolation.
   */
  public emit<K extends RuntimeEventKey>(event: K, payload: RuntimeEventMap[K]): void {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return;

    // Snapshot listeners to prevent modification during iteration
    const listeners = Array.from(set);
    for (const listener of listeners) {
      try {
        listener(payload);
      } catch (err) {
        logger.error(`Error in runtime event subscriber for "${event}"`, {
          error: (err as Error).message,
          event,
        });
      }
    }
  }

  /**
   * Returns active listener count for diagnostics.
   */
  public listenerCount(event?: RuntimeEventKey): number {
    if (event) {
      return this.listeners.get(event)?.size || 0;
    }
    let total = 0;
    for (const set of this.listeners.values()) {
      total += set.size;
    }
    return total;
  }

  /**
   * Removes all event listeners.
   */
  public clear(): void {
    this.listeners.clear();
  }
}
