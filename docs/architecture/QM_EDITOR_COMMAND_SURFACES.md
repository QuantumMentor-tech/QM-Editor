# QM Editor — Unified Command Surfaces Architecture
**Phase 03, Step 22 — Architecture Specification**

---

## 1. System Overview & Core Principle

In QM Editor, the user interface must never become a secondary command registry or duplicate action execution pipeline. The architecture enforces one immutable relationship:

```text
                    ┌── Command Palette
                    │
                    ├── Application Menu Bar (File, Edit, Selection, View, Go, Terminal, Tasks, SCM, Help)
                    │
                    ├── Primary Toolbar
                    │
Command Registry ────┼── Context Menus (Explorer, Editor, Tab, Terminal, Task, Problem)
                    │
                    ├── Overflow Menu
                    │
                    ├── Document Tab Context Menu
                    │
                    └── Keyboard Shortcuts
```

- **Command Registry (`CommandRegistry`):** Owns *what* the command does and its canonical metadata (ID, category, description, execution handler).
- **Command Context (`CommandContext`):** Represents the normalized current application and focus state (active document, open tabs, workspace explorer, terminal, tasks, problems, clipboard).
- **Command Availability:** Decides *if* the command is enabled or temporarily unavailable in the current context (`canExecute`).
- **Command Surface Registry (`CommandSurfaceRegistry`):** Decides *where and how* the command is presented (placement, ordering, grouping separators, visibility `when`, toggle checkmarks `isChecked`, icons, formatted shortcuts).

---

## 2. Architectural Layers

### 2.1 Command Surface Registry (`CommandSurfaceRegistry`)
Located in `src/core/commands/CommandSurfaceRegistry.ts`, the registry manages surface registrations for:
1. **Application Menu Bar (`menubar`):** Structured into 9 standard categories:
   - `File`: New, Open, Workspace, Open Recent, Save, Save As, Close, Close Others, Close Saved, Settings.
   - `Edit`: Undo, Redo, Cut, Copy, Paste, Find, Replace, Find in Files, Replace in Files.
   - `Selection`: Select All.
   - `View`: Toggle Sidebar, Toggle Panel, Toggle Theme Mode, Zoom In, Zoom Out, Reset Zoom, Word Wrap, Line Numbers, Whitespace, Code Folding, Command Palette.
   - `Go`: Quick Open (Go to File), Go to Line, Navigate Back, Navigate Forward.
   - `Terminal`: New Terminal, Toggle Panel, Clear Buffer, Kill Process, Next Terminal, Previous Terminal.
   - `Tasks`: Run Task, Run Build, Run Test, Cancel Task, Show Tasks Panel, Show Problems Panel.
   - `Source Control`: Focus Source Control, Refresh Status, Inspect Diff.
   - `Help`: Command Palette, About QM Editor.
2. **Primary Toolbar (`toolbar`):** Curated set of high-frequency actions (`Plus`, `FolderOpen`, `Save`, `Undo`, `Redo`, `Search`, `FileCode`, `Terminal`, `Settings`).
3. **Context Menus:**
   - `contextmenu:explorer`: File/Folder actions (Open, Reveal, Copy Path, Copy Relative Path, Refresh).
   - `contextmenu:editor`: Text editing (Undo, Redo, Cut, Copy, Paste, Select All, Find, Replace, Go to Line).
   - `contextmenu:tab`: Tab management (Close, Close Others, Close to the Right, Close Saved, Copy Path).
   - `contextmenu:terminal`: Terminal buffer (Copy, Paste, Clear, Kill, New Terminal).
   - `contextmenu:task`: Task execution (Run/Rerun, Cancel, Show Output, Show Problems).
   - `contextmenu:problem`: Diagnostics (Go to Source, Copy Problem Message).

### 2.2 Intelligent Grouping & Separator Management
Menu items define a logical `group` identifier. The registry groups items into `ResolvedMenuGroup[]`:
- Items with the same group belong to the same section.
- Empty groups are pruned.
- Separators are rendered strictly *between* consecutive non-empty groups.
- No consecutive, leading, or trailing separators are ever rendered.

---

## 3. Stale Context Protection

In desktop applications, application state may change while a menu or context menu remains open on the screen:
- A document tab may be closed.
- A file in the explorer may be modified or deleted externally.
- A terminal process may exit.
- A background task may complete.

To prevent executing stale commands blindly, `CommandSurfaceRegistry.revalidateAndExecute` enforces a 4-step guard before execution:
```typescript
public async revalidateAndExecute(
  commandId: string,
  ctx: CommandContext,
  targetValidator?: () => boolean
): Promise<boolean> {
  // 1. Verify command existence
  const cmd = this.commandRegistry.get(commandId);
  if (!cmd) return false;

  // 2. Validate target still exists
  if (targetValidator && !targetValidator()) return false;

  // 3. Re-evaluate availability against current context
  const canRun = this.commandRegistry.canExecute(commandId, ctx);
  if (!canRun) return false;

  // 4. Safely execute through Command Registry
  await this.commandRegistry.execute(commandId, ctx);
  return true;
}
```

---

## 4. Progressive Reduction & Responsive Toolbar

The Primary Toolbar uses a `ResizeObserver` to monitor available container width. When window space is constrained:
- Window width > 460px: All 9 curated primary actions are directly visible.
- Window width 350px - 460px: High-frequency actions (New, Open, Save, Undo, Redo) stay visible, secondary actions fold into an `OverflowMenu`.
- Window width < 350px: Core actions (New, Open, Save) remain visible, remaining actions fold into `OverflowMenu`.
- The overflow menu renders items backed by the exact same command registry entries, preserving shortcuts, icons, and disabled states.

---

## 5. Security & Safety Model

1. **Context is Not Authorization:** The presence of a target in a context menu (e.g. `selectedFile`) does not bypass command authorization. All workspace permissions, read-only checks, and safety rules remain enforced at the command execution layer.
2. **Text Input Safety:** Menus and global shortcuts respect input focus; shortcuts that conflict with normal text entry inside inputs (like typing in settings or rename inputs) do not trigger destructive operations.
3. **Telemetry & Privacy:** No contextual metadata (file paths, terminal contents, code excerpts) is logged or leaked outside the local application boundary.

---

## 6. Performance Guarantees

- **Instant Opening:** Menus and context menus resolve from pre-registered descriptors and current reactive state. No disk I/O, Git status scans, or workspace re-indexing occurs upon opening a menu.
- **Sub-16ms Frame Budgets:** Context menu positioning and viewport bounding are computed with layout effects in a single animation frame.
- **Resource Cleanup:** Context menus unmount upon closing, releasing event listeners and temporary DOM elements.
