/**
 * QM Editor Centralized Logger Service
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

class LoggerService {
  private currentLevel: LogLevel = 'INFO';

  public setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.currentLevel];
  }

  private formatMessage(level: LogLevel, message: string): string {
    const time = new Date().toISOString();
    return `[${time}] [QM-EDITOR] [${level}]: ${message}`;
  }

  public debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('DEBUG')) {
      console.debug(this.formatMessage('DEBUG', message), ...args);
    }
  }

  public info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('INFO')) {
      console.info(this.formatMessage('INFO', message), ...args);
    }
  }

  public warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('WARN')) {
      console.warn(this.formatMessage('WARN', message), ...args);
    }
  }

  public error(message: string, error?: unknown): void {
    if (this.shouldLog('ERROR')) {
      console.error(this.formatMessage('ERROR', message), error || '');
    }
  }
}

export const logger = new LoggerService();
export const Logger = logger;
export { LoggerService };
