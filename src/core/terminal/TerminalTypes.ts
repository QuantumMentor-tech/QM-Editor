/**
 * QM Editor Terminal Core Types & Interfaces
 * Phase 1, Step 19 — Integrated Terminal & Safe Process Execution Foundation
 */

export type TerminalSessionStatus =
  | 'starting'
  | 'running'
  | 'exited'
  | 'failed'
  | 'terminating'
  | 'disposed';

export type TerminalShellType = 'powershell' | 'cmd' | 'bash' | 'zsh' | 'sh' | 'custom';

export interface ShellInfo {
  id: TerminalShellType;
  name: string;
  executable: string;
  args?: string[];
}

export interface TerminalDimensions {
  columns: number;
  rows: number;
}

export interface TerminalOutputChunk {
  id: string;
  text: string;
  stream: 'stdout' | 'stderr';
  timestamp: number;
}

export interface TerminalSessionModel {
  id: string;
  title: string;
  shell: ShellInfo;
  cwd: string;
  workspaceId?: string;
  status: TerminalSessionStatus;
  dimensions: TerminalDimensions;
  createdAt: number;
  exitCode?: number;
}

export interface CreateSessionOptions {
  id?: string;
  title?: string;
  shell?: ShellInfo;
  cwd?: string;
  workspaceId?: string;
  dimensions?: TerminalDimensions;
}

export interface PtyProcessAdapter {
  createSession(options: CreateSessionOptions): Promise<void>;
  write(sessionId: string, data: string): Promise<void>;
  resize(sessionId: string, columns: number, rows: number): Promise<void>;
  terminate(sessionId: string): Promise<void>;
  dispose(sessionId: string): Promise<void>;
  onOutput(callback: (sessionId: string, chunk: TerminalOutputChunk) => void): () => void;
  onExit(callback: (sessionId: string, exitCode: number) => void): () => void;
}
