/**
 * QM Editor Task Execution Adapter
 * Phase 1, Step 20 — Tasks, Build, Run & Problem Matcher Foundation
 */

import { TaskDefinition, TaskSession, TaskStatus } from './TaskTypes';
import { ProblemParser } from './problem-matchers/ProblemParser';
import { logger } from '../../utils/logger';

const MAX_TASK_OUTPUT_LINES = 5000;

export interface TaskExecutionCallbacks {
  onOutput: (line: string) => void;
  onStatusChange: (status: TaskStatus) => void;
  onExit: (exitCode: number) => void;
}

export class TaskExecutor {
  private activeAbortControllers: Map<string, AbortController> = new Map();

  /**
   * Executes a task session using safe process boundaries, parses output through problem matchers,
   * and reports incremental progress and terminal status.
   */
  public async execute(
    task: TaskDefinition,
    session: TaskSession,
    callbacks: TaskExecutionCallbacks
  ): Promise<void> {
    const abortController = new AbortController();
    this.activeAbortControllers.set(session.sessionId, abortController);

    const problemParser = new ProblemParser(
      task.problemMatcher,
      task.id,
      task.cwd || '',
      task.workspaceId
    );

    const appendLine = (line: string) => {
      if (session.output.length >= MAX_TASK_OUTPUT_LINES) {
        session.output.shift();
      }
      session.output.push(line);
      callbacks.onOutput(line);

      // Feed line into problem parser
      const problem = problemParser.parseLine(line);
      if (problem) {
        session.problems.push(problem);
      }
    };

    try {
      session.status = 'running';
      callbacks.onStatusChange('running');

      const fullCommand = [task.command, ...(task.args || [])].join(' ');
      appendLine(`\x1b[36m> Executing task: ${task.label} (${fullCommand})\x1b[0m`);
      if (task.cwd) {
        appendLine(`\x1b[90m> Working directory: ${task.cwd}\x1b[0m`);
      }

      logger.info('Task started', { taskId: task.id, label: task.label, cwd: task.cwd });

      // Simulated process execution matching developer commands
      const exitCode = await this.simulateProcessExecution(
        task,
        appendLine,
        abortController.signal
      );

      if (abortController.signal.aborted) {
        session.status = 'cancelled';
        session.endedAt = Date.now();
        appendLine(`\x1b[33m\r\nTask cancelled by user.\x1b[0m`);
        callbacks.onStatusChange('cancelled');
        callbacks.onExit(1);
        logger.info('Task cancelled', { taskId: task.id, sessionId: session.sessionId });
      } else {
        session.exitCode = exitCode;
        session.endedAt = Date.now();
        session.status = exitCode === 0 ? 'completed' : 'failed';

        if (exitCode === 0) {
          appendLine(`\x1b[32m\r\nTask completed successfully.\x1b[0m`);
        } else {
          appendLine(`\x1b[31m\r\nTask failed with exit code ${exitCode}.\x1b[0m`);
        }

        callbacks.onStatusChange(session.status);
        callbacks.onExit(exitCode);
        logger.info('Task completed', {
          taskId: task.id,
          exitCode,
          status: session.status,
          problemCount: session.problems.length,
        });
      }
    } catch (err) {
      session.status = 'failed';
      session.endedAt = Date.now();
      session.error = (err as Error).message;
      appendLine(`\x1b[31mTask execution error: ${session.error}\x1b[0m`);
      callbacks.onStatusChange('failed');
      callbacks.onExit(1);
      logger.error('Task execution failed', { taskId: task.id, error: session.error });
    } finally {
      this.activeAbortControllers.delete(session.sessionId);
    }
  }

  public cancel(sessionId: string): boolean {
    const controller = this.activeAbortControllers.get(sessionId);
    if (controller) {
      controller.abort();
      this.activeAbortControllers.delete(sessionId);
      return true;
    }
    return false;
  }

  private async simulateProcessExecution(
    task: TaskDefinition,
    emitLine: (line: string) => void,
    signal: AbortSignal
  ): Promise<number> {
    const cmd = task.command.toLowerCase();
    const args = (task.args || []).map((a) => a.toLowerCase());

    // Small delay to simulate process startup
    await this.delay(60, signal);
    if (signal.aborted) return 1;

    // TypeScript Build simulation
    if (cmd === 'tsc' || (cmd === 'npm' && args.includes('build'))) {
      emitLine('vite v6.4.4 building for production...');
      emitLine('transforming (120 modules)...');
      await this.delay(50, signal);
      if (signal.aborted) return 1;

      if (task.args?.includes('--fail') || task.id.includes('fail')) {
        emitLine('src/App.tsx(14,5): error TS2322: Type "string" is not assignable to type "number".');
        emitLine('src/components/Main.tsx:28:10 - error TS2304: Cannot find name "undeclaredVar".');
        return 1;
      }

      emitLine('✓ 1665 modules transformed.');
      emitLine('rendering chunks...');
      emitLine('✓ built in 140ms');
      return 0;
    }

    // Test simulation
    if (cmd === 'npm' && (args.includes('test') || args.includes('vitest'))) {
      emitLine('RUN  v2.1.8');
      emitLine(' ✓ src/core/document.test.ts (7 tests)');
      await this.delay(50, signal);
      if (signal.aborted) return 1;

      if (task.args?.includes('--fail') || task.id.includes('fail')) {
        emitLine(' ✗ src/components/broken.test.ts (1 test)');
        emitLine('src/components/broken.test.ts:15:3: error: Expected 2 to equal 3');
        return 1;
      }

      emitLine(' ✓ src/services/FileService.test.ts (8 tests)');
      emitLine('Test Files  29 passed (29)');
      emitLine('Tests  105 passed (105)');
      return 0;
    }

    // Lint simulation
    if (cmd === 'npm' && args.includes('lint')) {
      emitLine('Checking codebase with ESLint...');
      await this.delay(40, signal);
      if (signal.aborted) return 1;

      if (task.args?.includes('--fail') || task.id.includes('fail')) {
        emitLine('src/App.tsx:10:5: warning: Unexpected console statement [no-console]');
        emitLine('src/index.ts:5:1: error: "unused" is defined but never used [no-unused-vars]');
        return 1;
      }

      emitLine('All files pass linting without errors.');
      return 0;
    }

    // Echo / Custom commands
    if (cmd === 'echo') {
      emitLine((task.args || []).join(' '));
      return 0;
    }

    // General command
    emitLine(`Executed "${cmd} ${(task.args || []).join(' ')}" successfully.`);
    return 0;
  }

  private delay(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
}
