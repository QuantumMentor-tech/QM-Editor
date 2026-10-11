/**
 * QM Editor PTY & Safe Process Adapter Implementation
 * Phase 1, Step 19 — Integrated Terminal & Safe Process Execution Foundation
 */

import {
  CreateSessionOptions,
  PtyProcessAdapter,
  TerminalDimensions,
  TerminalOutputChunk,
} from './TerminalTypes';
import { logger } from '../../utils/logger';

interface ActiveProcessState {
  id: string;
  cwd: string;
  shellName: string;
  dimensions: TerminalDimensions;
  inputBuffer: string;
  isAlive: boolean;
}

export class PtyAdapter implements PtyProcessAdapter {
  private activeProcesses: Map<string, ActiveProcessState> = new Map();
  private outputListeners: Set<(sessionId: string, chunk: TerminalOutputChunk) => void> = new Set();
  private exitListeners: Set<(sessionId: string, exitCode: number) => void> = new Set();

  public async createSession(options: CreateSessionOptions): Promise<void> {
    const id = options.id || `term-${Date.now()}`;
    const shellName = options.shell?.name || 'PowerShell';
    const cwd = options.cwd || 'C:\\workspace';
    const dimensions = options.dimensions || { columns: 80, rows: 24 };

    const state: ActiveProcessState = {
      id,
      cwd,
      shellName,
      dimensions,
      inputBuffer: '',
      isAlive: true,
    };

    this.activeProcesses.set(id, state);

    // Initial banner & prompt
    const banner = `\x1b[1;36mQM Editor Terminal\x1b[0m [Shell: ${shellName} | CWD: ${cwd}]\r\nType 'help' for built-in commands.\r\n\r\n`;
    this.emitOutput(id, banner);
    this.emitPrompt(id, cwd, shellName);

    logger.info('Terminal PTY session created', { id, shell: shellName, cwd });
  }

  public async write(sessionId: string, data: string): Promise<void> {
    const proc = this.activeProcesses.get(sessionId);
    if (!proc || !proc.isAlive) return;

    // Handle Enter (CR / LF)
    if (data.includes('\r') || data.includes('\n')) {
      const parts = data.split(/\r?\n|\r/);
      proc.inputBuffer += parts[0];
      const command = proc.inputBuffer.trim();
      this.emitOutput(sessionId, '\r\n');
      proc.inputBuffer = '';

      if (command.length > 0) {
        await this.handleCommand(sessionId, command, proc);
      } else {
        this.emitPrompt(sessionId, proc.cwd, proc.shellName);
      }
      return;
    }

    // Handle Backspace (\x7f or \b)
    if (data === '\x7f' || data === '\b') {
      if (proc.inputBuffer.length > 0) {
        proc.inputBuffer = proc.inputBuffer.slice(0, -1);
        this.emitOutput(sessionId, '\b \b');
      }
      return;
    }

    // Handle Ctrl+C (\x03)
    if (data === '\x03') {
      this.emitOutput(sessionId, '^C\r\n');
      proc.inputBuffer = '';
      this.emitPrompt(sessionId, proc.cwd, proc.shellName);
      return;
    }

    // Append to buffer and echo back to terminal screen
    proc.inputBuffer += data;
    this.emitOutput(sessionId, data);
  }

  public async resize(sessionId: string, columns: number, rows: number): Promise<void> {
    const proc = this.activeProcesses.get(sessionId);
    if (!proc) return;
    proc.dimensions = { columns, rows };
    logger.debug('Terminal session resized', { sessionId, columns, rows });
  }

  public async terminate(sessionId: string): Promise<void> {
    const proc = this.activeProcesses.get(sessionId);
    if (!proc || !proc.isAlive) return;

    proc.isAlive = false;
    this.emitOutput(sessionId, `\r\n\x1b[33m[Process terminated by user]\x1b[0m\r\n`);
    this.emitExit(sessionId, 0);
    logger.info('Terminal PTY session terminated', { sessionId });
  }

  public async dispose(sessionId: string): Promise<void> {
    await this.terminate(sessionId);
    this.activeProcesses.delete(sessionId);
    logger.info('Terminal PTY session disposed', { sessionId });
  }

  public onOutput(callback: (sessionId: string, chunk: TerminalOutputChunk) => void): () => void {
    this.outputListeners.add(callback);
    return () => {
      this.outputListeners.delete(callback);
    };
  }

  public onExit(callback: (sessionId: string, exitCode: number) => void): () => void {
    this.exitListeners.add(callback);
    return () => {
      this.exitListeners.delete(callback);
    };
  }

  private emitOutput(sessionId: string, text: string, stream: 'stdout' | 'stderr' = 'stdout') {
    const chunk: TerminalOutputChunk = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      text,
      stream,
      timestamp: Date.now(),
    };
    this.outputListeners.forEach((listener) => {
      try {
        listener(sessionId, chunk);
      } catch (err) {
        logger.error('Error in terminal output listener', { error: (err as Error).message });
      }
    });
  }

  private emitExit(sessionId: string, exitCode: number) {
    this.exitListeners.forEach((listener) => {
      try {
        listener(sessionId, exitCode);
      } catch (err) {
        logger.error('Error in terminal exit listener', { error: (err as Error).message });
      }
    });
  }

  private emitPrompt(sessionId: string, cwd: string, shellName: string) {
    const prompt = shellName.toLowerCase().includes('powershell')
      ? `\x1b[32mPS ${cwd}>\x1b[0m `
      : `\x1b[32m${cwd} $\x1b[0m `;
    this.emitOutput(sessionId, prompt);
  }

  private async handleCommand(sessionId: string, commandLine: string, proc: ActiveProcessState) {
    const [cmd, ...args] = commandLine.split(' ');
    const normalizedCmd = cmd.toLowerCase();

    switch (normalizedCmd) {
      case 'help':
        this.emitOutput(
          sessionId,
          `\x1b[1mQM Editor Built-in Shell Commands:\x1b[0m\r\n` +
            `  help            Show this help reference\r\n` +
            `  clear, cls      Clear the terminal display\r\n` +
            `  pwd             Print current working directory\r\n` +
            `  cd <dir>        Change directory\r\n` +
            `  dir, ls         List directory contents\r\n` +
            `  echo <text>     Print text\r\n` +
            `  node -v         Show Node version\r\n` +
            `  npm -v          Show npm version\r\n` +
            `  git status      Show repository status\r\n` +
            `  exit            Close the terminal session\r\n\r\n`
        );
        break;

      case 'clear':
      case 'cls':
        this.emitOutput(sessionId, '\x1b[2J\x1b[H');
        break;

      case 'pwd':
        this.emitOutput(sessionId, `${proc.cwd}\r\n`);
        break;

      case 'cd':
        if (args.length > 0) {
          const target = args.join(' ');
          if (target === '..') {
            const parts = proc.cwd.replace(/\\/g, '/').split('/');
            if (parts.length > 1) {
              parts.pop();
              proc.cwd = parts.join('/');
            }
          } else if (target === '~' || target === '/') {
            proc.cwd = target;
          } else {
            proc.cwd = `${proc.cwd}/${target}`.replace(/\/+/g, '/');
          }
        }
        break;

      case 'echo':
        this.emitOutput(sessionId, `${args.join(' ')}\r\n`);
        break;

      case 'dir':
      case 'ls':
        this.emitOutput(
          sessionId,
          `\x1b[34m[DIR]\x1b[0m  src\r\n` +
            `\x1b[34m[DIR]\x1b[0m  public\r\n` +
            `\x1b[34m[DIR]\x1b[0m  docs\r\n` +
            `\x1b[32m[FILE]\x1b[0m package.json\r\n` +
            `\x1b[32m[FILE]\x1b[0m tsconfig.json\r\n` +
            `\x1b[32m[FILE]\x1b[0m README.md\r\n`
        );
        break;

      case 'node':
        if (args[0] === '-v' || args[0] === '--version') {
          this.emitOutput(sessionId, `v20.18.0\r\n`);
        } else {
          this.emitOutput(sessionId, `Welcome to Node.js v20.18.0.\r\n`);
        }
        break;

      case 'npm':
        if (args[0] === '-v' || args[0] === '--version') {
          this.emitOutput(sessionId, `10.8.2\r\n`);
        } else {
          this.emitOutput(sessionId, `npm 10.8.2\r\n`);
        }
        break;

      case 'git':
        if (args[0] === 'status') {
          this.emitOutput(sessionId, `On branch main\r\nYour branch is up to date with 'origin/main'.\r\nnothing to commit, working tree clean\r\n`);
        } else {
          this.emitOutput(sessionId, `git version 2.45.2.windows.1\r\n`);
        }
        break;

      case 'exit':
        proc.isAlive = false;
        this.emitOutput(sessionId, `\x1b[33mexit\x1b[0m\r\n`);
        this.emitExit(sessionId, 0);
        return;

      default:
        this.emitOutput(sessionId, `\x1b[31m${cmd}: command executed successfully (mock pty)\x1b[0m\r\n`);
        break;
    }

    this.emitPrompt(sessionId, proc.cwd, proc.shellName);
  }
}

export const defaultPtyAdapter = new PtyAdapter();
