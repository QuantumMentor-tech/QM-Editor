import { CommandRegistry, globalCommandRegistry } from './CommandRegistry';
import { CommandContext } from './CommandTypes';
import { ShortcutManager } from './ShortcutManager';
import {
  SurfaceId,
  MenuBarCategory,
  SurfaceItem,
  MenuBarDefinition,
  ResolvedSurfaceItem,
  ResolvedMenuGroup,
} from './CommandSurfaceTypes';

export class CommandSurfaceRegistry {
  private surfaceItems = new Map<string, SurfaceItem[]>();
  private menuBarCategories: MenuBarDefinition[] = [];
  private commandRegistry: CommandRegistry;

  constructor(commandRegistry: CommandRegistry = globalCommandRegistry) {
    this.commandRegistry = commandRegistry;
    this.registerDefaultSurfaces();
  }

  public registerSurfaceItem(surfaceId: SurfaceId | string, item: SurfaceItem): void {
    const items = this.surfaceItems.get(surfaceId) || [];
    items.push(item);
    this.surfaceItems.set(surfaceId, items);
  }

  public registerMenuBarCategory(category: MenuBarDefinition): void {
    const existingIndex = this.menuBarCategories.findIndex((c) => c.id === category.id);
    if (existingIndex >= 0) {
      this.menuBarCategories[existingIndex] = category;
    } else {
      this.menuBarCategories.push(category);
    }
  }

  public getMenuBarCategories(): MenuBarDefinition[] {
    return this.menuBarCategories;
  }

  /**
   * Resolves items for a specific surface based on availability, visibility rules, and current context.
   */
  public getSurfaceItems(surfaceId: string, ctx: CommandContext): ResolvedSurfaceItem[] {
    const rawItems = this.surfaceItems.get(surfaceId) || [];
    const resolved: ResolvedSurfaceItem[] = [];

    for (const item of rawItems) {
      // 1. Check visibility rule ('when')
      if (item.when && !item.when(ctx)) {
        continue; // Hidden from this surface in current context
      }

      const cmd = this.commandRegistry.get(item.commandId);
      if (!cmd) {
        continue;
      }

      // 2. Check enabled state through command registry
      const enabled = this.commandRegistry.canExecute(item.commandId, ctx);

      // 3. Check toggled / checked state
      const checked = item.isChecked ? item.isChecked(ctx) : undefined;

      // 4. Resolve submenu if present
      let resolvedSubmenu: ResolvedSurfaceItem[] | undefined;
      if (item.submenu && item.submenu.length > 0) {
        resolvedSubmenu = item.submenu
          .filter((sub) => (sub.when ? sub.when(ctx) : true))
          .map((sub, idx) => {
            const subCmd = this.commandRegistry.get(sub.commandId);
            return {
              commandId: sub.commandId,
              label: sub.labelOverride || subCmd?.label || sub.commandId,
              shortcut: subCmd?.shortcut,
              formattedShortcut: subCmd?.shortcut ? ShortcutManager.formatShortcut(subCmd.shortcut) : undefined,
              group: sub.group,
              order: sub.order ?? idx,
              icon: sub.icon,
              enabled: this.commandRegistry.canExecute(sub.commandId, ctx),
              checked: sub.isChecked ? sub.isChecked(ctx) : undefined,
            };
          });
      }

      resolved.push({
        commandId: item.commandId,
        label: item.labelOverride || cmd.label,
        shortcut: cmd.shortcut,
        formattedShortcut: cmd.shortcut ? ShortcutManager.formatShortcut(cmd.shortcut) : undefined,
        group: item.group,
        order: item.order ?? 0,
        icon: item.icon,
        enabled,
        checked,
        submenu: resolvedSubmenu,
      });
    }

    return resolved.sort((a, b) => a.order - b.order);
  }

  /**
   * Groups resolved items by their group identifier into clean, non-empty groups.
   * This guarantees that menu renderers never display top/bottom separators or duplicate separators.
   */
  public getSurfaceGroups(surfaceId: string, ctx: CommandContext): ResolvedMenuGroup[] {
    const items = this.getSurfaceItems(surfaceId, ctx);
    return this.groupResolvedItems(items);
  }

  /**
   * Resolves the entire MenuBar structure with groups for each category.
   */
  public getResolvedMenuBar(
    ctx: CommandContext
  ): { id: MenuBarCategory; label: string; groups: ResolvedMenuGroup[] }[] {
    return this.menuBarCategories.map((cat) => {
      const items = (cat.items || [])
        .filter((item) => (item.when ? item.when(ctx) : true))
        .map((item, idx) => {
          const cmd = this.commandRegistry.get(item.commandId);
          const enabled = this.commandRegistry.canExecute(item.commandId, ctx);
          const checked = item.isChecked ? item.isChecked(ctx) : undefined;

          let resolvedSubmenu: ResolvedSurfaceItem[] | undefined;
          if (item.submenu && item.submenu.length > 0) {
            resolvedSubmenu = item.submenu
              .filter((sub) => (sub.when ? sub.when(ctx) : true))
              .map((sub, subIdx) => {
                const subCmd = this.commandRegistry.get(sub.commandId);
                return {
                  commandId: sub.commandId,
                  label: sub.labelOverride || subCmd?.label || sub.commandId,
                  shortcut: subCmd?.shortcut,
                  formattedShortcut: subCmd?.shortcut ? ShortcutManager.formatShortcut(subCmd.shortcut) : undefined,
                  group: sub.group,
                  order: sub.order ?? subIdx,
                  icon: sub.icon,
                  enabled: this.commandRegistry.canExecute(sub.commandId, ctx),
                  checked: sub.isChecked ? sub.isChecked(ctx) : undefined,
                };
              });
          }

          return {
            commandId: item.commandId,
            label: item.labelOverride || cmd?.label || item.commandId,
            shortcut: cmd?.shortcut,
            formattedShortcut: cmd?.shortcut ? ShortcutManager.formatShortcut(cmd.shortcut) : undefined,
            group: item.group || 'default',
            order: item.order ?? idx,
            icon: item.icon,
            enabled,
            checked,
            submenu: resolvedSubmenu,
          };
        });

      return {
        id: cat.id,
        label: cat.label,
        groups: this.groupResolvedItems(items),
      };
    });
  }

  /**
   * Stale Context Protection: Revalidates availability and safety rules immediately before execution.
   */
  public async revalidateAndExecute(
    commandId: string,
    ctx: CommandContext,
    targetValidator?: () => boolean
  ): Promise<boolean> {
    // 1. Verify command existence
    const cmd = this.commandRegistry.get(commandId);
    if (!cmd) {
      console.warn(`[QM-EDITOR] [WARN]: Command '${commandId}' not found in registry`);
      return false;
    }

    // 2. Validate target still exists (e.g., active doc or target file didn't close while menu was open)
    if (targetValidator && !targetValidator()) {
      console.warn(`[QM-EDITOR] [WARN]: Command '${commandId}' target invalidated by stale context`);
      return false;
    }

    // 3. Re-evaluate availability against current context
    const canRun = this.commandRegistry.canExecute(commandId, ctx);
    if (!canRun) {
      console.warn(`[QM-EDITOR] [WARN]: Command '${commandId}' cannot execute in current context`);
      return false;
    }

    // 4. Safely execute through Command Registry
    await this.commandRegistry.execute(commandId, ctx);
    return true;
  }

  private groupResolvedItems(items: ResolvedSurfaceItem[]): ResolvedMenuGroup[] {
    const groupMap = new Map<string, ResolvedSurfaceItem[]>();

    for (const item of items) {
      const gid = item.group || 'default';
      const list = groupMap.get(gid) || [];
      list.push(item);
      groupMap.set(gid, list);
    }

    const groups: ResolvedMenuGroup[] = [];
    for (const [groupId, groupItems] of groupMap.entries()) {
      if (groupItems.length > 0) {
        groups.push({
          groupId,
          items: groupItems.sort((a, b) => a.order - b.order),
        });
      }
    }

    return groups;
  }

  private registerDefaultSurfaces(): void {
    // -------------------------------------------------------------
    // 1. APPLICATION MENU BAR CATEGORIES
    // -------------------------------------------------------------
    this.registerMenuBarCategory({
      id: 'file',
      label: 'File',
      items: [
        { commandId: 'file.new', group: 'new', order: 10 },
        { commandId: 'file.open', group: 'open', order: 20 },
        { commandId: 'workspace.open', group: 'open', order: 30 },
        { commandId: 'file.openRecent', group: 'open', order: 40 },
        { commandId: 'file.save', group: 'save', order: 50 },
        { commandId: 'file.saveAs', group: 'save', order: 60 },
        { commandId: 'document.close', group: 'close', order: 70 },
        { commandId: 'tabs.closeOthers', group: 'close', order: 80 },
        { commandId: 'tabs.closeSaved', group: 'close', order: 90 },
        { commandId: 'workbench.action.openSettings', group: 'prefs', order: 100 },
      ],
    });

    this.registerMenuBarCategory({
      id: 'edit',
      label: 'Edit',
      items: [
        { commandId: 'editor.undo', group: 'undo', order: 10 },
        { commandId: 'editor.redo', group: 'undo', order: 20 },
        { commandId: 'editor.cut', group: 'clipboard', order: 30 },
        { commandId: 'editor.copy', group: 'clipboard', order: 40 },
        { commandId: 'editor.paste', group: 'clipboard', order: 50 },
        { commandId: 'search.open', group: 'find', order: 60 },
        { commandId: 'search.replace', group: 'find', order: 70 },
        { commandId: 'workbench.action.findInFiles', group: 'find', order: 80 },
        { commandId: 'search.workspaceReplace', group: 'find', order: 90 },
      ],
    });

    this.registerMenuBarCategory({
      id: 'selection',
      label: 'Selection',
      items: [
        { commandId: 'editor.selectAll', group: 'select', order: 10 },
      ],
    });

    this.registerMenuBarCategory({
      id: 'view',
      label: 'View',
      items: [
        { commandId: 'shell.toggleSidebar', group: 'layout', order: 10 },
        { commandId: 'shell.togglePanel', group: 'layout', order: 20 },
        { commandId: 'shell.toggleTheme', group: 'layout', order: 30 },
        { commandId: 'editor.zoomIn', group: 'zoom', order: 40 },
        { commandId: 'editor.zoomOut', group: 'zoom', order: 50 },
        { commandId: 'editor.zoomReset', group: 'zoom', order: 60 },
        {
          commandId: 'editor.toggleWordWrap',
          group: 'editor',
          order: 70,
          isChecked: (ctx) => ctx.shellState.editorSettings.wordWrap === 'on',
        },
        {
          commandId: 'editor.toggleLineNumbers',
          group: 'editor',
          order: 80,
          isChecked: (ctx) => ctx.shellState.editorSettings.lineNumbers,
        },
        {
          commandId: 'editor.toggleWhitespace',
          group: 'editor',
          order: 90,
          isChecked: (ctx) => ctx.shellState.editorSettings.whitespace !== 'none',
        },
        {
          commandId: 'editor.toggleFolding',
          group: 'editor',
          order: 100,
          isChecked: (ctx) => ctx.shellState.editorSettings.folding,
        },
        { commandId: 'workbench.action.showCommands', group: 'palette', order: 110 },
      ],
    });

    this.registerMenuBarCategory({
      id: 'go',
      label: 'Go',
      items: [
        { commandId: 'workbench.action.quickOpen', group: 'jump', order: 10 },
        { commandId: 'navigation.goToLine', group: 'jump', order: 20 },
        { commandId: 'navigation.back', group: 'nav', order: 30 },
        { commandId: 'navigation.forward', group: 'nav', order: 40 },
      ],
    });

    this.registerMenuBarCategory({
      id: 'terminal',
      label: 'Terminal',
      items: [
        { commandId: 'terminal.new', group: 'session', order: 10 },
        { commandId: 'terminal.togglePanel', group: 'session', order: 20 },
        { commandId: 'terminal.clear', group: 'control', order: 30 },
        { commandId: 'terminal.kill', group: 'control', order: 40 },
        { commandId: 'terminal.next', group: 'switch', order: 50 },
        { commandId: 'terminal.previous', group: 'switch', order: 60 },
      ],
    });

    this.registerMenuBarCategory({
      id: 'tasks',
      label: 'Tasks',
      items: [
        { commandId: 'task.run', group: 'run', order: 10 },
        { commandId: 'task.build', group: 'run', order: 20 },
        { commandId: 'task.test', group: 'run', order: 30 },
        { commandId: 'task.cancel', group: 'control', order: 40 },
        { commandId: 'task.showTasks', group: 'view', order: 50 },
        { commandId: 'task.showProblems', group: 'view', order: 60 },
      ],
    });

    this.registerMenuBarCategory({
      id: 'sourcecontrol',
      label: 'Source Control',
      items: [
        { commandId: 'sourceControl.openPanel', group: 'view', order: 10 },
        { commandId: 'sourceControl.refresh', group: 'actions', order: 20 },
        { commandId: 'sourceControl.openDiff', group: 'actions', order: 30 },
      ],
    });

    this.registerMenuBarCategory({
      id: 'help',
      label: 'Help',
      items: [
        { commandId: 'workbench.action.openWelcome', group: 'help', order: 5 },
        { commandId: 'workbench.action.showCommands', group: 'help', order: 10 },
        { commandId: 'help.about', group: 'help', order: 20 },
      ],
    });

    // -------------------------------------------------------------
    // 2. PRIMARY TOOLBAR ITEMS
    // -------------------------------------------------------------
    const primaryToolbarItems: SurfaceItem[] = [
      { commandId: 'file.new', group: 'file', order: 10, icon: 'Plus' },
      { commandId: 'file.open', group: 'file', order: 20, icon: 'FolderOpen' },
      { commandId: 'file.save', group: 'file', order: 30, icon: 'Save' },
      { commandId: 'editor.undo', group: 'edit', order: 40, icon: 'Undo' },
      { commandId: 'editor.redo', group: 'edit', order: 50, icon: 'Redo' },
      { commandId: 'workbench.action.findInFiles', group: 'search', order: 60, icon: 'Search' },
      { commandId: 'workbench.action.quickOpen', group: 'nav', order: 70, icon: 'FileCode' },
      { commandId: 'workbench.action.showCommands', group: 'command', order: 80, icon: 'Terminal' },
      { commandId: 'workbench.action.openSettings', group: 'settings', order: 90, icon: 'Settings' },
    ];
    for (const it of primaryToolbarItems) {
      this.registerSurfaceItem('toolbar', it);
    }

    // -------------------------------------------------------------
    // 3. CONTEXT MENUS
    // -------------------------------------------------------------
    // A. File Explorer Context Menu
    const explorerContextMenuItems: SurfaceItem[] = [
      { commandId: 'file.open', group: 'open', order: 10 },
      { commandId: 'explorer.revealActiveFile', group: 'open', order: 20 },
      { commandId: 'explorer.copyPath', group: 'clipboard', order: 30 },
      { commandId: 'explorer.copyRelativePath', group: 'clipboard', order: 40 },
      { commandId: 'explorer.refresh', group: 'manage', order: 50 },
    ];
    for (const it of explorerContextMenuItems) {
      this.registerSurfaceItem('contextmenu:explorer', it);
    }

    // B. Editor Surface Context Menu
    const editorContextMenuItems: SurfaceItem[] = [
      { commandId: 'editor.undo', group: 'undo', order: 10 },
      { commandId: 'editor.redo', group: 'undo', order: 20 },
      { commandId: 'editor.cut', group: 'clipboard', order: 30 },
      { commandId: 'editor.copy', group: 'clipboard', order: 40 },
      { commandId: 'editor.paste', group: 'clipboard', order: 50 },
      { commandId: 'editor.selectAll', group: 'select', order: 60 },
      { commandId: 'search.open', group: 'search', order: 70 },
      { commandId: 'search.replace', group: 'search', order: 80 },
      { commandId: 'navigation.goToLine', group: 'nav', order: 90 },
    ];
    for (const it of editorContextMenuItems) {
      this.registerSurfaceItem('contextmenu:editor', it);
    }

    // C. Document Tab Context Menu
    const tabContextMenuItems: SurfaceItem[] = [
      { commandId: 'document.close', group: 'close', order: 10 },
      { commandId: 'tabs.closeOthers', group: 'close', order: 20 },
      { commandId: 'tabs.closeToRight', group: 'close', order: 30 },
      { commandId: 'tabs.closeSaved', group: 'close', order: 40 },
      { commandId: 'tabs.copyPath', group: 'clipboard', order: 50 },
    ];
    for (const it of tabContextMenuItems) {
      this.registerSurfaceItem('contextmenu:tab', it);
    }

    // D. Terminal Context Menu
    const terminalContextMenuItems: SurfaceItem[] = [
      { commandId: 'terminal.copy', group: 'clipboard', order: 10 },
      { commandId: 'terminal.paste', group: 'clipboard', order: 20 },
      { commandId: 'terminal.clear', group: 'control', order: 30 },
      { commandId: 'terminal.kill', group: 'control', order: 40 },
      { commandId: 'terminal.new', group: 'session', order: 50 },
    ];
    for (const it of terminalContextMenuItems) {
      this.registerSurfaceItem('contextmenu:terminal', it);
    }

    // E. Tasks Context Menu
    const taskContextMenuItems: SurfaceItem[] = [
      { commandId: 'task.run', group: 'exec', order: 10 },
      { commandId: 'task.cancel', group: 'exec', order: 20 },
      { commandId: 'task.showTasks', group: 'view', order: 30 },
      { commandId: 'task.showProblems', group: 'view', order: 40 },
    ];
    for (const it of taskContextMenuItems) {
      this.registerSurfaceItem('contextmenu:task', it);
    }

    // F. Problems Context Menu
    const problemContextMenuItems: SurfaceItem[] = [
      { commandId: 'problems.goToSource', group: 'action', order: 10 },
      { commandId: 'problems.copyMessage', group: 'clipboard', order: 20 },
    ];
    for (const it of problemContextMenuItems) {
      this.registerSurfaceItem('contextmenu:problem', it);
    }
  }
}

export const globalCommandSurfaceRegistry = new CommandSurfaceRegistry(globalCommandRegistry);
