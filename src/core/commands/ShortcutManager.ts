import { CommandRegistry, globalCommandRegistry } from './CommandRegistry';
import { CommandContext } from './CommandTypes';

export class ShortcutManager {
  public static isMac(): boolean {
    return typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  }

  public static handleKeyDown(
    e: KeyboardEvent,
    ctx: CommandContext,
    registry: CommandRegistry = globalCommandRegistry
  ): boolean {
    const isMod = this.isMac() ? e.metaKey : e.ctrlKey;

    for (const command of registry.getAll()) {
      if (!command.shortcut) continue;

      if (this.matchesShortcut(e, command.shortcut, isMod)) {
        e.preventDefault();
        e.stopPropagation();
        registry.execute(command.id, ctx);
        return true;
      }
    }

    return false;
  }

  public static matchesShortcut(e: KeyboardEvent, shortcutPattern: string, isMod: boolean): boolean {
    const parts = shortcutPattern.split('+').map((p) => p.trim().toLowerCase());
    const key = e.key.toLowerCase();

    const requiresMod = parts.includes('mod');
    const requiresShift = parts.includes('shift');
    const targetKey = parts[parts.length - 1];

    if (requiresMod && !isMod) return false;
    if (requiresShift && !e.shiftKey) return false;

    return key === targetKey;
  }
}
