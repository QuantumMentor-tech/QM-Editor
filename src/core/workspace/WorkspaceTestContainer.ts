/**
 * QM Editor Workspace Test Container
 * Phase 04, Step 30 — Core Workspace Subsystem
 */

import { WorkspaceEngine } from './WorkspaceEngine';
import { WorkspaceEventKey, WorkspaceEventMap } from './WorkspaceTypes';

export interface RecordedWorkspaceEvent<K extends WorkspaceEventKey = WorkspaceEventKey> {
  event: K;
  payload: WorkspaceEventMap[K];
  timestamp: number;
}

export class WorkspaceTestContainer {
  public readonly engine: WorkspaceEngine;
  public readonly recordedEvents: RecordedWorkspaceEvent[] = [];
  private hasDirtyDocuments: boolean = false;

  constructor(initialGeneration: number = 1) {
    this.engine = new WorkspaceEngine({ initialGeneration });
    this.hookAllEvents();

    this.engine.registerUnsavedChangesChecker(() => {
      return this.hasDirtyDocuments;
    });
  }

  public setHasDirtyDocuments(dirty: boolean): void {
    this.hasDirtyDocuments = dirty;
  }

  public getEventNames(): WorkspaceEventKey[] {
    return this.recordedEvents.map((r) => r.event);
  }

  public getEventsByName<K extends WorkspaceEventKey>(event: K): Array<RecordedWorkspaceEvent<K>> {
    return this.recordedEvents.filter((r) => r.event === event) as Array<RecordedWorkspaceEvent<K>>;
  }

  public clearRecordedEvents(): void {
    this.recordedEvents.length = 0;
  }

  private hookAllEvents(): void {
    const allKeys: WorkspaceEventKey[] = [
      'workspace.opening',
      'workspace.opened',
      'workspace.changeRequested',
      'workspace.changing',
      'workspace.changed',
      'workspace.closeRequested',
      'workspace.closing',
      'workspace.closed',
      'workspace.degraded',
      'workspace.failed',
    ];

    for (const key of allKeys) {
      this.engine.on(key, (payload) => {
        this.recordedEvents.push({
          event: key,
          payload,
          timestamp: Date.now(),
        });
      });
    }
  }
}
