# QM EDITOR — COMMAND SYSTEM ARCHITECTURE

**Version:** 1.0.0  
**Status:** Approved Command Architecture  
**Last Updated:** October 10, 2026  

---

## 1. ARCHITECTURE OVERVIEW

The **QM Editor Command System** acts as the central traffic controller for all user, keyboard, menu, and future extension actions across the application. It prevents scattered, direct calls to underlying editor engines or UI state mutators by routing actions through a single, authoritative Command Registry.

### Action Invocation Flow

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   ACTION SOURCES (UI, Keyboard, Menu)                  │
│   (Header Save Button, Sidebar Toggle, Keyboard Shortcut `Mod+S`)      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Invokes Command ID (e.g. `document.save`)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        QM EDITOR COMMAND REGISTRY                      │
│   (`src/core/commands/CommandRegistry.ts`)                             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Validates `canExecute(context)`
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        COMMAND HANDLER EXECUTION                       │
│   (Invokes WorkspaceContext / ShellContext / EditorAdapter)            │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. COMMAND CONTRACT (`src/core/commands/CommandTypes.ts`)

```typescript
export type CommandCategory = 'editor' | 'document' | 'shell' | 'workspace';

export interface CommandContext {
  activeDoc: DocumentModel | null;
  shellState: ShellState;
  workspaceActions: {
    saveDoc: (id: string) => void;
    createDoc: (title: string, content?: string) => void;
    closeDoc: (id: string) => void;
  };
  shellActions: {
    toggleSidebar: () => void;
    togglePanel: () => void;
    toggleTheme: () => void;
  };
}

export interface Command {
  id: string;                          // Unique ID (e.g. 'document.save')
  label: string;                       // Human-readable title
  category: CommandCategory;           // Category grouping
  shortcut?: string;                   // Optional platform shortcut (e.g. 'Mod+S')
  canExecute?: (ctx: CommandContext) => boolean;
  execute: (ctx: CommandContext) => void | Promise<void>;
}
```

---

## 4. COMMAND PALETTE CONSUMER INTEGRATION

The **Command Palette** (`src/components/palette/CommandPaletteModal.tsx`) acts as an authoritative consumer of the Command Registry:
- Queries metadata directly from `CommandRegistry.getAll()`.
- Uses `CommandSearchService` for fuzzy/prefix match filtering.
- Formats shortcuts using `ShortcutManager.formatShortcut(...)`.
- Revalidates command availability via `canExecute(id, context)` before executing commands.
- Triggers execution exclusively through `globalCommandRegistry.execute(id, context)`.
