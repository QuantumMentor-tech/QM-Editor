/**
 * QM Editor Task & Problem Matcher Types
 * Phase 1, Step 20 — Tasks, Build, Run & Problem Matcher Foundation
 */

export type TaskType = 'build' | 'test' | 'run' | 'lint' | 'package' | 'custom';
export type TaskGroup = 'build' | 'test' | 'run' | 'none';

export type TaskStatus =
  | 'queued'
  | 'starting'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelling'
  | 'cancelled'
  | 'blocked';

export type ProblemSeverity = 'error' | 'warning' | 'info' | 'hint';

export type WorkspaceTrustState = 'trusted' | 'untrusted' | 'unknown';

export interface TaskDefinition {
  id: string;
  label: string;
  type: TaskType;
  group?: TaskGroup;
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  problemMatcher?: string | string[];
  dependsOn?: string[];
  isDefault?: boolean;
  source: 'workspace' | 'project' | 'detected' | 'builtin' | 'user';
  workspaceId?: string;
}

export interface Problem {
  id: string;
  source: string;
  severity: ProblemSeverity;
  message: string;
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  code?: string;
  taskId: string;
  workspaceId?: string;
}

export interface TaskSession {
  sessionId: string;
  taskId: string;
  taskLabel: string;
  workspaceId: string;
  status: TaskStatus;
  startedAt: number;
  endedAt?: number;
  exitCode?: number;
  output: string[];
  problems: Problem[];
  error?: string;
}

export interface TaskResult {
  sessionId: string;
  taskId: string;
  status: TaskStatus;
  exitCode?: number;
  durationMs: number;
  problemCount: number;
  startedAt: number;
  endedAt: number;
}
