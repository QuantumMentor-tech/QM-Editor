/**
 * QM Editor Canonical Stdio Process Transport
 * Phase 06, Step 56 — Language Server Protocol Foundation, Server Lifecycle & Client Architecture
 *
 * Implements standard stdio process execution for external language servers.
 * Dynamically resolves Node.js child_process in desktop/test runtimes while protecting
 * browser environments from bundle breakage.
 */

import { ILspTransport } from './ILspTransport';
import { logger } from '../../../utils/logger';

export interface StdioProcessOptions {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export class StdioProcessTransport implements ILspTransport {
  private childProcess: any = null;
  private alive: boolean = false;
  private messageListeners = new Set<(chunk: string) => void>();
  private errorListeners = new Set<(error: Error) => void>();
  private closeListeners = new Set<(exitCode?: number) => void>();
  private stderrListeners = new Set<(log: string) => void>();

  constructor(private readonly options: StdioProcessOptions) {}

  public async start(): Promise<void> {
    if (this.alive) return;

    // Check if running in a Node.js / Electron environment with process spawning capability
    const isNode =
      typeof process !== 'undefined' &&
      process.versions != null &&
      process.versions.node != null;

    if (!isNode) {
      throw new Error(
        'StdioProcessTransport requires a Node.js/Electron runtime to spawn external processes.'
      );
    }

    try {
      // Dynamic import to prevent bundler errors in browser targets
      const cp = await import('child_process');

      const spawn = cp.spawn;
      if (typeof spawn !== 'function') {
        throw new Error('child_process.spawn is not available in current runtime.');
      }

      const args = this.options.args || [];
      const cwd = this.options.cwd;
      const env = this.options.env ? { ...process.env, ...this.options.env } : process.env;

      logger.info('StdioProcessTransport: Spawning language server process', {
        command: this.options.command,
        args,
        cwd,
      });

      this.childProcess = spawn(this.options.command, args, {
        cwd,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false, // Explicitly avoid shell to prevent command injection
      });

      this.alive = true;

      // Handle stdout
      this.childProcess.stdout?.on('data', (chunk: Buffer | string) => {
        const text = typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
        for (const listener of this.messageListeners) {
          listener(text);
        }
      });

      // Handle stderr
      this.childProcess.stderr?.on('data', (chunk: Buffer | string) => {
        const text = typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
        for (const listener of this.stderrListeners) {
          listener(text);
        }
      });

      // Handle error
      this.childProcess.on('error', (err: Error) => {
        logger.error('StdioProcessTransport: Process error', { error: err.message });
        for (const listener of this.errorListeners) {
          listener(err);
        }
      });

      // Handle close
      this.childProcess.on('close', (code: number | null) => {
        const exitCode = code ?? 0;
        logger.info('StdioProcessTransport: Process exited', { exitCode });
        this.alive = false;
        this.childProcess = null;
        for (const listener of this.closeListeners) {
          listener(exitCode);
        }
      });
    } catch (err) {
      this.alive = false;
      this.childProcess = null;
      throw new Error(
        `Failed to spawn language server process "${this.options.command}": ${(err as Error).message}`
      );
    }
  }

  public async send(data: string): Promise<void> {
    if (!this.alive || !this.childProcess || !this.childProcess.stdin) {
      throw new Error('Cannot send data: language server process is not running or stdin is closed.');
    }

    return new Promise<void>((resolve, reject) => {
      this.childProcess.stdin.write(data, 'utf-8', (err?: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  public onMessage(listener: (chunk: string) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  public onError(listener: (error: Error) => void): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  public onClose(listener: (exitCode?: number) => void): () => void {
    this.closeListeners.add(listener);
    return () => this.closeListeners.delete(listener);
  }

  public onStderr(listener: (log: string) => void): () => void {
    this.stderrListeners.add(listener);
    return () => this.stderrListeners.delete(listener);
  }

  public async close(): Promise<void> {
    if (!this.alive || !this.childProcess) {
      return;
    }

    return new Promise<void>((resolve) => {
      const proc = this.childProcess;
      this.alive = false;

      let killTimeout: any = null;

      const onExit = () => {
        if (killTimeout) clearTimeout(killTimeout);
        this.childProcess = null;
        resolve();
      };

      proc.once('close', onExit);

      try {
        // Send SIGTERM first for graceful termination
        proc.kill('SIGTERM');
      } catch {
        // Fallback
      }

      // If process hasn't exited within 2000ms, force SIGKILL
      killTimeout = setTimeout(() => {
        try {
          proc.kill('SIGKILL');
        } catch {
          // Process already ended
        }
        this.childProcess = null;
        resolve();
      }, 2000);
    });
  }

  public isAlive(): boolean {
    return this.alive;
  }
}
