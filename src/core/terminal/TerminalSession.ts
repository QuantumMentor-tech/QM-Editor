/**
 * QM Editor Terminal Session Implementation
 * Phase 1, Step 19 — Integrated Terminal & Safe Process Execution Foundation
 */

import {
  CreateSessionOptions,
  PtyProcessAdapter,
  TerminalDimensions,
  TerminalOutputChunk,
  TerminalSessionModel,
  TerminalSessionStatus,
} from './TerminalTypes';
import { defaultPtyAdapter } from './PtyAdapter';
import { ShellDetector } from './ShellDetector';

export const MAX_SCROLLBACK_LINES = 5000;

export class TerminalSession {
  private model: TerminalSessionModel;
  private buffer: string[] = [''];
  private pty: PtyProcessAdapter;
  private listeners: Set<(session: TerminalSession) => void> = new Set();
  private cleanups: Array<() => void> = [];

  constructor(options: CreateSessionOptions, ptyAdapter: PtyProcessAdapter = defaultPtyAdapter) {
    const id = options.id || `term-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const shell = options.shell || ShellDetector.getDefaultShell();
    const title = options.title || shell.name;
    const cwd = options.cwd || (ShellDetector.detectPlatform() === 'windows' ? 'C:\\workspace' : '/workspace');
    const dimensions: TerminalDimensions = options.dimensions || { columns: 80, rows: 24 };

    this.model = {
      id,
      title,
      shell,
      cwd,
      workspaceId: options.workspaceId,
      status: 'starting',
      dimensions,
      createdAt: Date.now(),
    };

    this.pty = ptyAdapter;

    // Subscribe to PTY output
    const outputCleanup = this.pty.onOutput((sessionId, chunk) => {
      if (sessionId === this.model.id) {
        this.appendOutput(chunk);
      }
    });

    // Subscribe to PTY exit
    const exitCleanup = this.pty.onExit((sessionId, exitCode) => {
      if (sessionId === this.model.id) {
        this.model.status = 'exited';
        this.model.exitCode = exitCode;
        this.notifyListeners();
      }
    });

    this.cleanups.push(outputCleanup, exitCleanup);
  }

  public async start(): Promise<void> {
    this.model.status = 'running';
    await this.pty.createSession({
      id: this.model.id,
      title: this.model.title,
      shell: this.model.shell,
      cwd: this.model.cwd,
      dimensions: this.model.dimensions,
    });
    this.notifyListeners();
  }

  public getModel(): TerminalSessionModel {
    return { ...this.model };
  }

  public getId(): string {
    return this.model.id;
  }

  public getTitle(): string {
    return this.model.title;
  }

  public setTitle(title: string): void {
    this.model.title = title;
    this.notifyListeners();
  }

  public getStatus(): TerminalSessionStatus {
    return this.model.status;
  }

  public getLines(): string[] {
    return [...this.buffer];
  }

  public async write(data: string): Promise<void> {
    if (this.model.status !== 'running') return;
    await this.pty.write(this.model.id, data);
  }

  public async resize(columns: number, rows: number): Promise<void> {
    this.model.dimensions = { columns, rows };
    await this.pty.resize(this.model.id, columns, rows);
    this.notifyListeners();
  }

  public clear(): void {
    this.buffer = [''];
    this.notifyListeners();
  }

  public async terminate(): Promise<void> {
    if (this.model.status === 'exited' || this.model.status === 'disposed') return;
    this.model.status = 'terminating';
    this.notifyListeners();

    await this.pty.terminate(this.model.id);
    this.model.status = 'exited';
    this.notifyListeners();
  }

  public async dispose(): Promise<void> {
    await this.terminate();
    this.model.status = 'disposed';
    this.cleanups.forEach((cleanup) => cleanup());
    this.cleanups = [];
    await this.pty.dispose(this.model.id);
    this.notifyListeners();
  }

  public subscribe(listener: (session: TerminalSession) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener(this));
  }

  private appendOutput(chunk: TerminalOutputChunk) {
    const text = chunk.text;

    // Handle clear screen sequence \x1b[2J
    if (text.includes('\x1b[2J')) {
      this.buffer = [''];
      return;
    }

    // Split text into line tokens preserving CR/LF
    const parts = text.split(/\r?\n/);
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === 0) {
        // Append to current last line
        this.buffer[this.buffer.length - 1] += part;
      } else {
        // New line
        this.buffer.push(part);
      }
    }

    // Enforce max scrollback lines limit
    if (this.buffer.length > MAX_SCROLLBACK_LINES) {
      this.buffer = this.buffer.slice(this.buffer.length - MAX_SCROLLBACK_LINES);
    }

    this.notifyListeners();
  }
}
