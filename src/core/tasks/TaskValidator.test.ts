import { describe, it, expect } from 'vitest';
import { TaskValidator } from './TaskValidator';
import { TaskDefinition } from './TaskTypes';

describe('TaskValidator', () => {
  it('validates a valid task definition', () => {
    const task: TaskDefinition = {
      id: 'task-build',
      label: 'Build',
      type: 'build',
      command: 'npm',
      args: ['run', 'build'],
      source: 'workspace',
      problemMatcher: '$tsc',
    };

    const res = TaskValidator.validate(task);
    expect(res.isValid).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  it('rejects tasks with missing required fields', () => {
    const invalidTask = {
      id: '',
      label: '',
      type: 'build' as const,
      command: '',
      source: 'workspace' as const,
    };

    const res = TaskValidator.validate(invalidTask);
    expect(res.isValid).toBe(false);
    expect(res.errors.length).toBeGreaterThanOrEqual(3);
  });

  it('rejects unknown problem matchers', () => {
    const task: TaskDefinition = {
      id: 'task-1',
      label: 'Test',
      type: 'custom',
      command: 'echo',
      source: 'user',
      problemMatcher: '$unknown-matcher-xyz',
    };

    const res = TaskValidator.validate(task);
    expect(res.isValid).toBe(false);
    expect(res.errors[0]).toContain('Unknown problem matcher reference');
  });

  it('resolves deterministic dependency order', () => {
    const tA: TaskDefinition = { id: 'A', label: 'A', type: 'build', command: 'echo', source: 'builtin' };
    const tB: TaskDefinition = { id: 'B', label: 'B', type: 'build', command: 'echo', source: 'builtin', dependsOn: ['A'] };
    const tC: TaskDefinition = { id: 'C', label: 'C', type: 'build', command: 'echo', source: 'builtin', dependsOn: ['B'] };

    const map = new Map<string, TaskDefinition>([
      ['A', tA],
      ['B', tB],
      ['C', tC],
    ]);

    const res = TaskValidator.resolveExecutionOrder('C', map);
    expect(res.error).toBeUndefined();
    expect(res.order.map((t) => t.id)).toEqual(['A', 'B', 'C']);
  });

  it('detects and prevents dependency cycles', () => {
    const tA: TaskDefinition = { id: 'A', label: 'A', type: 'build', command: 'echo', source: 'builtin', dependsOn: ['B'] };
    const tB: TaskDefinition = { id: 'B', label: 'B', type: 'build', command: 'echo', source: 'builtin', dependsOn: ['C'] };
    const tC: TaskDefinition = { id: 'C', label: 'C', type: 'build', command: 'echo', source: 'builtin', dependsOn: ['A'] };

    const map = new Map<string, TaskDefinition>([
      ['A', tA],
      ['B', tB],
      ['C', tC],
    ]);

    const res = TaskValidator.resolveExecutionOrder('A', map);
    expect(res.error).toBeDefined();
    expect(res.error).toContain('Task dependency cycle detected');
    expect(res.order).toHaveLength(0);
  });

  it('detects missing dependencies', () => {
    const tA: TaskDefinition = { id: 'A', label: 'A', type: 'build', command: 'echo', source: 'builtin', dependsOn: ['Missing'] };
    const map = new Map<string, TaskDefinition>([['A', tA]]);

    const res = TaskValidator.resolveExecutionOrder('A', map);
    expect(res.error).toBeDefined();
    expect(res.error).toContain('Missing dependency task "Missing"');
  });
});
