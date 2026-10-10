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

## 3. REGISTRY SAFETY & DUPLICATE ID PROTECTION

1. **Unique Command IDs:** Every command must register a unique dot-notated string ID (e.g., `document.save`, `shell.toggleSidebar`).
2. **Duplicate Detection:** Re-registering an existing command ID throws a `QMEditorError` in development to prevent subtle collision bugs.
3. **Safe Fallback:** Executing an unregistered command logs a warning via `logger` and returns a non-crashing result.
