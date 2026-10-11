/**
 * QM Editor Task Validation & Dependency Resolution Engine
 * Phase 1, Step 20 — Tasks, Build, Run & Problem Matcher Foundation
 */

import { TaskDefinition } from './TaskTypes';
import { problemMatcherRegistry } from './problem-matchers/ProblemMatcherRegistry';

export interface TaskValidationResult {
  isValid: boolean;
  errors: string[];
}

export class TaskValidator {
  /**
   * Validates a single task definition
   */
  public static validate(task: TaskDefinition): TaskValidationResult {
    const errors: string[] = [];

    if (!task.id || typeof task.id !== 'string' || task.id.trim() === '') {
      errors.push('Task ID is required and must be a non-empty string.');
    }

    if (!task.label || typeof task.label !== 'string' || task.label.trim() === '') {
      errors.push('Task label is required and must be a non-empty string.');
    }

    if (!task.command || typeof task.command !== 'string' || task.command.trim() === '') {
      errors.push('Task command is required and must be a non-empty string.');
    }

    if (task.args && !Array.isArray(task.args)) {
      errors.push('Task args must be an array of strings.');
    }

    if (task.cwd && typeof task.cwd !== 'string') {
      errors.push('Task cwd must be a string path.');
    }

    if (task.problemMatcher) {
      const matchers = Array.isArray(task.problemMatcher) ? task.problemMatcher : [task.problemMatcher];
      for (const m of matchers) {
        if (!problemMatcherRegistry.get(m)) {
          errors.push(`Unknown problem matcher reference: "${m}".`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validates task dependency relationships and checks for cycles or missing dependencies
   */
  public static resolveExecutionOrder(
    targetTaskId: string,
    allTasks: Map<string, TaskDefinition>
  ): { order: TaskDefinition[]; error?: string } {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const order: TaskDefinition[] = [];

    const target = allTasks.get(targetTaskId);
    if (!target) {
      return { order: [], error: `Target task "${targetTaskId}" not found.` };
    }

    const dfs = (currId: string, path: string[]): string | null => {
      if (recursionStack.has(currId)) {
        return `Task dependency cycle detected: ${[...path, currId].join(' -> ')}`;
      }

      if (visited.has(currId)) {
        return null;
      }

      const task = allTasks.get(currId);
      if (!task) {
        return `Missing dependency task "${currId}" referenced in dependency chain.`;
      }

      visited.add(currId);
      recursionStack.add(currId);

      if (task.dependsOn && task.dependsOn.length > 0) {
        for (const depId of task.dependsOn) {
          const err = dfs(depId, [...path, currId]);
          if (err) return err;
        }
      }

      recursionStack.delete(currId);
      order.push(task);
      return null;
    };

    const cycleError = dfs(targetTaskId, []);
    if (cycleError) {
      return { order: [], error: cycleError };
    }

    return { order };
  }
}
