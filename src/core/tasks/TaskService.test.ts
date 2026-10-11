import { describe, it, expect, beforeEach } from 'vitest';
import { TaskService } from './TaskService';

describe('TaskService', () => {
  let service: TaskService;

  beforeEach(() => {
    service = TaskService.getInstance();
    service.setTrustState('trusted');
    service.clearProblems();
  });

  it('provides standard built-in tasks', () => {
    const tasks = service.getTasks();
    expect(tasks.length).toBeGreaterThanOrEqual(4);

    const buildTask = tasks.find((t) => t.id === 'task-build');
    expect(buildTask).toBeDefined();
    expect(buildTask?.type).toBe('build');
    expect(buildTask?.isDefault).toBe(true);

    const testTask = tasks.find((t) => t.id === 'task-test');
    expect(testTask).toBeDefined();
    expect(testTask?.type).toBe('test');
  });

  it('registers and validates custom tasks', () => {
    const res = service.registerTask({
      id: 'custom-package',
      label: 'Package App',
      type: 'package',
      command: 'npm',
      args: ['pack'],
      source: 'user',
    });

    expect(res.success).toBe(true);
    expect(service.getTask('custom-package')).toBeDefined();
  });

  it('executes a build task and collects problems', async () => {
    // Register a failing build task with $tsc matcher
    service.registerTask({
      id: 'task-build-fail',
      label: 'Build With Errors',
      type: 'build',
      command: 'tsc',
      args: ['--fail'],
      source: 'user',
      problemMatcher: '$tsc',
    });

    const session = await service.runTask('task-build-fail', 'test-workspace');
    expect(session).not.toBeNull();
    expect(session?.status).toBe('failed');
    expect(session?.exitCode).toBe(1);
    expect(session?.problems.length).toBeGreaterThanOrEqual(2);

    const allProblems = service.getAllProblems();
    expect(allProblems.length).toBeGreaterThanOrEqual(2);
    expect(allProblems.some((p) => p.code === 'TS2322')).toBe(true);
  });

  it('blocks task execution in untrusted workspaces', async () => {
    service.setTrustState('untrusted');
    const session = await service.runTask('task-build', 'test-workspace');

    expect(session).not.toBeNull();
    expect(session?.status).toBe('blocked');
    expect(session?.error).toContain('untrusted');
  });

  it('prevents duplicate concurrent execution of the same task', async () => {
    // Launch task
    const promise1 = service.runTask('task-build');
    // Try launching again while running
    const promise2 = service.runTask('task-build');

    const [s1, s2] = await Promise.all([promise1, promise2]);
    expect(s1?.taskId).toBe('task-build');
    expect(s2?.taskId).toBe('task-build');
    expect(s1?.sessionId).toBe(s2?.sessionId);
  });
});
