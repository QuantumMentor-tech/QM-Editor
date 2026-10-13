/**
 * QM Editor Diagnostic Adapter & Bridge Utilities
 * Phase 04, Step 34 & Step 40 — Core Engine Diagnostics Model, Aggregation & Editor Integration
 */

import { Problem, ProblemSeverity } from '../tasks/TaskTypes';
import {
  Diagnostic,
  DiagnosticSeverity,
  DiagnosticProvider,
  DiagnosticProviderCapabilities,
  DiagnosticCollection as IDiagnosticCollection,
} from './DiagnosticTypes';
import { globalDiagnosticService } from './DiagnosticService';
import { taskService } from '../tasks/TaskService';
import { logger } from '../../utils/logger';

/**
 * Authoritative diagnostic provider connecting task and build problem matchers
 * to the centralized Diagnostics Engine with strict run generation isolation.
 */
export class TaskDiagnosticProvider implements DiagnosticProvider {
  public readonly providerId = 'tasks';
  public readonly displayName = 'Tasks & Build Problem Matchers';
  public readonly capabilities: DiagnosticProviderCapabilities = {
    supportsDocumentDiagnostics: true,
    supportsResourceMarkers: true,
    supportsWorkspaceDiagnostics: true,
    supportsRangeLocations: true,
    supportsCodes: true,
  };

  private _collection: IDiagnosticCollection | null = null;
  private taskGenerations: Map<string, number> = new Map();
  private activeRuns: Map<string, number> = new Map();

  private get collection(): IDiagnosticCollection {
    if (!this._collection) {
      this._collection = globalDiagnosticService.registerProvider(this);
    }
    return this._collection;
  }

  constructor() {}

  /**
   * Starts a new task execution run, returning a monotonic generation number.
   * Any slower prior runs with lower generation will be rejected on completion.
   */
  public startTaskRun(taskId: string, runId: string): number {
    const nextGen = (this.taskGenerations.get(taskId) ?? 0) + 1;
    this.taskGenerations.set(taskId, nextGen);
    this.activeRuns.set(runId, nextGen);
    return nextGen;
  }

  /**
   * Publishes problems from a task run into the Diagnostics Engine.
   * Rejects problems if the run generation is older than the current task generation.
   */
  public publishTaskProblems(
    taskId: string,
    runId: string,
    problems: Problem[],
    _workspaceId?: string
  ): boolean {
    const runGen = this.activeRuns.get(runId) ?? 0;
    const latestGen = this.taskGenerations.get(taskId) ?? 0;

    if (runGen < latestGen) {
      logger.warn('Stale task diagnostic output rejected', {
        taskId,
        runId,
        runGen,
        latestGen,
      });
      return false;
    }

    // Group problems by normalized file URI
    const byFile = new Map<string, Problem[]>();
    for (const prob of problems) {
      const file = prob.file;
      if (!byFile.has(file)) {
        byFile.set(file, []);
      }
      byFile.get(file)!.push(prob);
    }

    // Set diagnostics for each file
    for (const [file, fileProblems] of byFile.entries()) {
      const diags = fileProblems.map((p) => problemToDiagnostic(p, runGen));
      this.collection.set(file, diags, { generation: runGen });
    }

    return true;
  }

  /**
   * Clears diagnostics for a specific task.
   */
  public clearTask(taskId: string): void {
    const nextGen = (this.taskGenerations.get(taskId) ?? 0) + 1;
    this.taskGenerations.set(taskId, nextGen);

    this.collection.forEach((uri, diags) => {
      const remaining = diags.filter((d) => (d.data as any)?.taskId !== taskId);
      if (remaining.length !== diags.length) {
        this.collection.set(uri, [...remaining], { generation: nextGen });
      }
    });
  }

  /**
   * Clears all task diagnostics across all files.
   */
  public clearAll(): void {
    this.taskGenerations.clear();
    this.activeRuns.clear();
    this.collection.clear();
  }

  public getGeneration(taskId: string): number {
    return this.taskGenerations.get(taskId) ?? 0;
  }

  public dispose(): void {
    this.taskGenerations.clear();
    this.activeRuns.clear();
    this.collection.dispose();
  }
}

export const globalTaskDiagnosticProvider = new TaskDiagnosticProvider();

/**
 * Converts a legacy/task Problem into a canonical Diagnostic.
 */
export function problemToDiagnostic(problem: Problem, generation?: number): Diagnostic {
  const isResourceOnly = !problem.line || problem.line <= 0;
  return {
    id: problem.id,
    uri: problem.file,
    range: isResourceOnly
      ? undefined
      : {
          startLine: problem.line,
          startColumn: problem.column || 1,
          endLine: problem.endLine ?? problem.line,
          endColumn: problem.endColumn ?? problem.column ?? 1,
        },
    severity: problem.severity as DiagnosticSeverity,
    message: problem.message,
    source: problem.source || 'tasks',
    providerId: 'tasks',
    code: problem.code,
    generation,
    data: {
      taskId: problem.taskId,
      workspaceId: problem.workspaceId,
    },
    createdAt: Date.now(),
  };
}

/**
 * Converts a canonical Diagnostic into a Problem format for components expecting Problems.
 */
export function diagnosticToProblem(diagnostic: Diagnostic): Problem {
  return {
    id: diagnostic.id,
    source: diagnostic.source,
    severity: diagnostic.severity as ProblemSeverity,
    message: diagnostic.message,
    file: diagnostic.uri,
    line: diagnostic.range ? diagnostic.range.startLine : 1,
    column: diagnostic.range ? diagnostic.range.startColumn : 1,
    endLine: diagnostic.range ? diagnostic.range.endLine : undefined,
    endColumn: diagnostic.range ? diagnostic.range.endColumn : undefined,
    code: diagnostic.code !== undefined ? String(diagnostic.code) : undefined,
    taskId: (diagnostic.data as any)?.taskId || 'diagnostic',
    workspaceId: (diagnostic.data as any)?.workspaceId,
  };
}

/**
 * Bridges TaskService problem updates to the canonical DiagnosticService under the 'tasks' collection.
 */
export function setupTaskProblemsBridge(): () => void {
  const sync = () => {
    const problems = taskService.getAllProblems();
    const byFile = new Map<string, Problem[]>();
    for (const prob of problems) {
      const file = prob.file;
      if (!byFile.has(file)) {
        byFile.set(file, []);
      }
      byFile.get(file)!.push(prob);
    }

    // Replace all diagnostics owned by 'tasks'
    globalTaskDiagnosticProvider.clearAll();
    for (const [file, fileProblems] of byFile.entries()) {
      const diags = fileProblems.map((p) => problemToDiagnostic(p));
      const col = globalDiagnosticService.getCollection('tasks');
      if (col) {
        col.set(file, diags);
      }
    }
  };

  // Perform initial sync
  sync();

  // Listen to granular execution lifecycle with generation isolation
  const unsubscribeLifecycle = taskService.addLifecycleListener({
    onTaskStarted(taskId, sessionId) {
      globalTaskDiagnosticProvider.startTaskRun(taskId, sessionId);
      globalTaskDiagnosticProvider.clearTask(taskId);
    },
    onTaskFinished(taskId, sessionId, problems, workspaceId) {
      globalTaskDiagnosticProvider.publishTaskProblems(taskId, sessionId, problems, workspaceId);
    },
    onProblemsCleared() {
      globalTaskDiagnosticProvider.clearAll();
    },
  });

  // Subscribe to general task updates
  const unsubscribeTask = taskService.subscribe(sync);

  return () => {
    unsubscribeLifecycle();
    unsubscribeTask();
    globalTaskDiagnosticProvider.dispose();
  };
}
