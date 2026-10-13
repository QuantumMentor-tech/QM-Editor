/**
 * QM Editor Filesystem Watcher Adapter Abstraction
 * Phase 04, Step 38 — Core Application Engine
 */

import {
  FileWatchAdapter,
  WatchHandle,
  RawFileSystemEvent,
  WatcherSubscriptionOptions,
} from './WatcherTypes';
import { normalizeWorkspacePath, isResourceInRoot } from '../workspace/WorkspaceResourceBoundary';
import { logger } from '../../utils/logger';

/**
 * Production-ready Virtual/In-Memory Watch Adapter.
 * Provides the canonical watch boundary for local simulation, test suites,
 * and environments where native OS hooks are abstracted or polyfilled.
 */
export class VirtualWatchAdapter implements FileWatchAdapter {
  public readonly name = 'VirtualWatchAdapter';
  private handles = new Map<
    string,
    {
      rootUri: string;
      recursive: boolean;
      onEvent: (event: RawFileSystemEvent) => void;
    }
  >();
  private handleCounter = 0;
  private isDisposed = false;

  public isAvailable(): boolean {
    return !this.isDisposed;
  }

  public async watch(
    rootUri: string,
    onEvent: (event: RawFileSystemEvent) => void,
    options: WatcherSubscriptionOptions = {}
  ): Promise<WatchHandle> {
    if (this.isDisposed) {
      throw new Error('VirtualWatchAdapter is disposed');
    }

    const normalizedRoot = normalizeWorkspacePath(rootUri);
    const id = `watch-${++this.handleCounter}-${Date.now()}`;
    const recursive = options.recursive ?? true;

    this.handles.set(id, {
      rootUri: normalizedRoot,
      recursive,
      onEvent,
    });

    logger.info('VirtualWatchAdapter: started watching root', {
      handleId: id,
      rootUri: normalizedRoot,
      recursive,
    });

    const handle: WatchHandle = {
      id,
      rootUri: normalizedRoot,
      recursive,
      stop: async () => {
        this.handles.delete(id);
        logger.info('VirtualWatchAdapter: stopped watching root', {
          handleId: id,
          rootUri: normalizedRoot,
        });
      },
    };

    return handle;
  }

  /**
   * Dispatches a raw filesystem change event to all matching active watch handles.
   */
  public emitRawEvent(event: RawFileSystemEvent): void {
    if (this.isDisposed) return;

    const normalizedUri = normalizeWorkspacePath(event.uri);
    const normalizedOldUri = event.oldUri ? normalizeWorkspacePath(event.oldUri) : undefined;

    for (const [id, record] of this.handles.entries()) {
      let matched = false;

      // Exact match
      if (record.rootUri === normalizedUri) {
        matched = true;
      } else if (record.recursive && isResourceInRoot(record.rootUri, normalizedUri)) {
        matched = true;
      } else if (
        normalizedOldUri &&
        (record.rootUri === normalizedOldUri ||
          (record.recursive && isResourceInRoot(record.rootUri, normalizedOldUri)))
      ) {
        matched = true;
      }

      if (matched) {
        try {
          record.onEvent({
            ...event,
            uri: normalizedUri,
            oldUri: normalizedOldUri,
          });
        } catch (err) {
          logger.error('VirtualWatchAdapter: error in handle onEvent callback', {
            handleId: id,
            error: (err as Error).message,
          });
        }
      }
    }
  }

  public getActiveHandleCount(): number {
    return this.handles.size;
  }

  public getActiveWatchersCount(): number {
    return this.handles.size;
  }

  public getWatchedRoots(): string[] {
    return Array.from(this.handles.values()).map((h) => h.rootUri);
  }

  public async dispose(): Promise<void> {
    this.isDisposed = true;
    this.handles.clear();
    logger.info('VirtualWatchAdapter: disposed');
  }
}
