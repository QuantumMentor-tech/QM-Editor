import { CommandRegistry, globalCommandRegistry } from './CommandRegistry';
import { CommandContext } from './CommandTypes';

export class ShortcutManager {
  public static isMac(): boolean {
    return typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  }

  public static isEditableElement(target: EventTarget | null): boolean {
    if (!target || !(target instanceof HTMLElement)) return false;
    const tagName = target.tagName.toLowerCase();
    if (tagName === 'input' || tagName === 'textarea') {
      const type = (target as HTMLInputElement).type?.toLowerCase();
      return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color'].includes(type);
    }
    return Boolean(target.isContentEditable || target.contentEditable === 'true');
  }

  public static handleKeyDown(
    e: KeyboardEvent,
    ctx: CommandContext,
    registry: CommandRegistry = globalCommandRegistry
  ): boolean {
    const isMod = this.isMac() ? e.metaKey : e.ctrlKey;
    const inEditable = this.isEditableElement(e.target);

    // Protect standard browser text editing inside input fields (Rule 43)
    if (inEditable) {
      const key = e.key.toLowerCase();
      const isSelectAll = isMod && key === 'a' && !e.shiftKey && !e.altKey;
      const isCopy = isMod && key === 'c' && !e.shiftKey && !e.altKey;
      const isPaste = isMod && key === 'v' && !e.shiftKey && !e.altKey;
      const isCut = isMod && key === 'x' && !e.shiftKey && !e.altKey;
      const isUndo = isMod && key === 'z' && !e.shiftKey && !e.altKey;
      const isRedo = isMod && (key === 'y' || (key === 'z' && e.shiftKey)) && !e.altKey;

      if (isSelectAll || isCopy || isPaste || isCut || isUndo || isRedo) {
        return false;
      }
    }

    for (const command of registry.getAll()) {
      if (!command.shortcut) continue;

      if (this.matchesShortcut(e, command.shortcut, isMod)) {
        // Prevent editor buffer commands from stealing input typing
        if (
          inEditable &&
          (command.category === 'editor' ||
            command.id.startsWith('editor.') ||
            command.id.startsWith('document.'))
        ) {
          continue;
        }

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
    const requiresAlt = parts.includes('alt');
    const targetKey = parts[parts.length - 1];
    const normalizedTarget =
      targetKey === 'right' ? 'arrowright' :
      targetKey === 'left' ? 'arrowleft' :
      targetKey === 'up' ? 'arrowup' :
      targetKey === 'down' ? 'arrowdown' :
      targetKey;

    if (requiresMod && !isMod) return false;
    if (!requiresMod && isMod) return false;
    if (requiresShift && !e.shiftKey) return false;
    if (!requiresShift && e.shiftKey) return false;
    if (requiresAlt && !e.altKey) return false;
    if (!requiresAlt && e.altKey) return false;

    return key === normalizedTarget || key === targetKey;
  }

  public static formatShortcut(shortcutPattern: string): string {
    if (!shortcutPattern) return '';
    const mac = this.isMac();
    return shortcutPattern
      .split('+')
      .map((part) => {
        const p = part.trim();
        if (p.toLowerCase() === 'mod') return mac ? '⌘' : 'Ctrl';
        if (p.toLowerCase() === 'shift') return mac ? '⇧' : 'Shift';
        if (p.toLowerCase() === 'alt') return mac ? '⌥' : 'Alt';
        return p.toUpperCase();
      })
      .join(mac ? '' : '+');
  }
}
