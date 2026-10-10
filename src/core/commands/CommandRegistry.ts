import { Command, CommandContext, CommandRegistryInterface } from './CommandTypes';
import { QMEditorError, ErrorCode } from '../../utils/errors';
import { logger } from '../../utils/logger';

export class CommandRegistry implements CommandRegistryInterface {
  private commands = new Map<string, Command>();

  public register(command: Command): void {
    if (this.commands.has(command.id)) {
      throw new QMEditorError(
        `Command with ID '${command.id}' is already registered`,
        ErrorCode.INVALID_WORKSPACE_STATE,
        'error'
      );
    }
    this.commands.set(command.id, command);
  }

  public get(id: string): Command | undefined {
    return this.commands.get(id);
  }

  public getAll(): Command[] {
    return Array.from(this.commands.values());
  }

  public canExecute(id: string, ctx: CommandContext): boolean {
    const command = this.commands.get(id);
    if (!command) return false;
    if (!command.canExecute) return true;
    return command.canExecute(ctx);
  }

  public async execute(id: string, ctx: CommandContext): Promise<void> {
    const command = this.commands.get(id);
    if (!command) {
      logger.warn(`Attempted to execute unregistered command: '${id}'`);
      return;
    }

    if (!this.canExecute(id, ctx)) {
      logger.warn(`Command '${id}' is not currently available for execution.`);
      return;
    }

    try {
      await command.execute(ctx);
    } catch (err) {
      logger.error(`Error executing command '${id}'`, err);
    }
  }
}

export const globalCommandRegistry = new CommandRegistry();
