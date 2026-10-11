/**
 * QM Editor Task Service
 * Phase 1, Step 20 — Tasks, Build, Run & Problem Matcher Foundation
 */

import {
  TaskDefinition,
  TaskSession,
  TaskStatus,
  Problem,
  WorkspaceTrustState,
} from './TaskTypes';
import { TaskValidator } from './TaskValidator';
import { TaskExecutor } from './TaskExecutor';
import { logger } from '../../utils/logger';

export type TaskServiceListener = () => void;

export class TaskService {
  private static instance: TaskService;
  private tasks: Map<string, TaskDefinition> = new Map();
  private sessions: Map<string, TaskSession> = new Map();
  private activeSessionId: string | null = null;
  private trustState: WorkspaceTrustState = 'trusted';
  private executor: TaskExecutor = new TaskExecutor();
  private listeners: Set<TaskServiceListener> = new Set();
  private problemsByTask: Map<string, Problem[]> = new Map();

  private constructor() {
    this.registerBuiltInTasks();
  }

  public static getInstance(): TaskService {
    if (!TaskService.instance) {
      TaskService.instance = new TaskService();
    }
    return TaskService.instance;
  }

  public getTasks(): TaskDefinition[] {
    return Array.from(this.tasks.values());
  }

  public getTask(id: string): TaskDefinition | undefined {
    return this.tasks.get(id);
  }

  public registerTask(task: TaskDefinition): { success: boolean; errors?: string[] } {
    const val = TaskValidator.validate(task);
    if (!val.isValid) {
      return { success: false, errors: val.errors };
    }
    this.tasks.set(task.id, { ...task });
    this.notify();
    return { success: true };
  }

  public unregisterTask(id: string): void {
    if (this.tasks.delete(id)) {
      this.notify();
    }
  }

  public getSessions(): TaskSession[] {
    return Array.from(this.sessions.values()).reverse();
  }

  public getActiveSession(): TaskSession | null {
    if (!this.activeSessionId) return null;
    return this.sessions.get(this.activeSessionId) || null;
  }

  public setActiveSession(sessionId: string): void {
    if (this.sessions.has(sessionId)) {
      this.activeSessionId = sessionId;
      this.notify();
    }
  }

  public getAllProblems(): Problem[] {
    const list: Problem[] = [];
    for (const problems of this.problemsByTask.values()) {
      list.push(...problems);
    }
    return list;
  }

  public getProblemsByTask(taskId: string): Problem[] {
    return this.problemsByTask.get(taskId) || [];
  }

  public getTrustState(): WorkspaceTrustState {
    return this.trustState;
  }

  public setTrustState(state: WorkspaceTrustState): void {
    this.trustState = state;
    logger.info('Workspace trust state changed', { trustState: state });
    this.notify();
  }

  /**
   * Executes a task by ID with dependency resolution, singleton concurrency, and trust verification.
   */
  public async runTask(taskId: string, workspaceId: string = 'default'): Promise<TaskSession | null> {
    const task = this.tasks.get(taskId);
    if (!task) {
      logger.error('Cannot run task: task definition not found', { taskId });
      return null;
    }

    // Check workspace trust
    if (this.trustState === 'untrusted') {
      const blockedSession: TaskSession = {
        sessionId: `session-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        taskId,
        taskLabel: task.label,
        workspaceId,
        status: 'blocked',
        startedAt: Date.now(),
        endedAt: Date.now(),
        output: ['\x1b[31mTask execution blocked: Workspace is untrusted.\x1b[0m'],
        problems: [],
        error: 'Workspace is untrusted.',
      };
      this.sessions.set(blockedSession.sessionId, blockedSession);
      this.activeSessionId = blockedSession.sessionId;
      this.notify();
      logger.warn('Task execution blocked due to untrusted workspace', { taskId });
      return blockedSession;
    }

    // Check singleton concurrency: cannot run if already running
    const runningSession = Array.from(this.sessions.values()).find(
      (s) => s.taskId === taskId && (s.status === 'running' || s.status === 'starting')
    );
    if (runningSession) {
      logger.warn('Task is already actively running', { taskId });
      return runningSession;
    }

    // Dependency resolution & cycle check
    const { order, error } = TaskValidator.resolveExecutionOrder(taskId, this.tasks);
    if (error) {
      const failedSession: TaskSession = {
        sessionId: `session-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        taskId,
        taskLabel: task.label,
        workspaceId,
        status: 'failed',
        startedAt: Date.now(),
        endedAt: Date.now(),
        output: [`\x1b[31m${error}\x1b[0m`],
        problems: [],
        error,
      };
      this.sessions.set(failedSession.sessionId, failedSession);
      this.activeSessionId = failedSession.sessionId;
      this.notify();
      return failedSession;
    }

    // Execute dependencies in resolved topological order
    let finalSession: TaskSession | null = null;
    for (const stepTask of order) {
      finalSession = await this.executeSingleTask(stepTask, workspaceId);
      if (finalSession.status !== 'completed') {
        // If prerequisite dependency failed or was cancelled, stop chain
        break;
      }
    }

    return finalSession;
  }

  public async cancelTask(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session || (session.status !== 'running' && session.status !== 'starting')) {
      return false;
    }

    session.status = 'cancelling';
    this.notify();
    return this.executor.cancel(sessionId);
  }

  public clearTaskOutput(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.output = [];
      this.notify();
    }
  }

  public clearProblems(): void {
    this.problemsByTask.clear();
    this.notify();
  }

  public subscribe(listener: TaskServiceListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private async executeSingleTask(
    task: TaskDefinition,
    workspaceId: string
  ): Promise<TaskSession> {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const session: TaskSession = {
      sessionId,
      taskId: task.id,
      taskLabel: task.label,
      workspaceId,
      status: 'starting',
      startedAt: Date.now(),
      output: [],
      problems: [],
    };

    this.sessions.set(sessionId, session);
    this.activeSessionId = sessionId;

    // Clear stale diagnostics for this task
    this.problemsByTask.delete(task.id);
    this.notify();

    await this.executor.execute(task, session, {
      onOutput: () => {
        this.notify();
      },
      onStatusChange: (status: TaskStatus) => {
        session.status = status;
        this.notify();
      },
      onExit: () => {
        // Update problem store
        this.problemsByTask.set(task.id, [...session.problems]);
        this.notify();
      },
    });

    return session;
  }

  private registerBuiltInTasks(): void {
    // 1. Build Task
    this.registerTask({
      id: 'task-build',
      label: 'Build Project',
      type: 'build',
      group: 'build',
      command: 'npm',
      args: ['run', 'build'],
      isDefault: true,
      source: 'builtin',
      problemMatcher: '$tsc',
    });

    // 2. Test Task
    this.registerTask({
      id: 'task-test',
      label: 'Run Tests',
      type: 'test',
      group: 'test',
      command: 'npm',
      args: ['test'],
      source: 'builtin',
      problemMatcher: '$general',
    });

    // 3. Lint Task
    this.registerTask({
      id: 'task-lint',
      label: 'Lint Codebase',
      type: 'lint',
      command: 'npm',
      args: ['run', 'lint'],
      source: 'builtin',
      problemMatcher: '$eslint',
    });

    // 4. Dev / Run Task
    this.registerTask({
      id: 'task-dev',
      label: 'Start Dev Server',
      type: 'run',
      group: 'run',
      command: 'npm',
      args: ['run', 'dev'],
      source: 'builtin',
    });
  }

  private notify(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        logger.error('Error in task service listener', { error: (err as Error).message });
      }
    });
  }
}

export const taskService = TaskService.getInstance();
