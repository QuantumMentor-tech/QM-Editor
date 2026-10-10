# QM Editor — Command Palette Architecture

## 1. Overview
The Command Palette in QM Editor serves as a keyboard-first action discovery and execution surface. It connects directly to the central `CommandRegistry` (`src/core/commands/CommandRegistry.ts`) and enforces strict domain separation:

```text
COMMAND REGISTRY
       ↓
COMMAND METADATA (id, label, category, shortcut, description, aliases)
       ↓
COMMAND SEARCH SERVICE (fuzzy & deterministic scoring)
       ↓
COMMAND PALETTE MODAL (keyboard navigation & match highlighting)
       ↓
COMMAND REVALIDATION (canExecute check at runtime)
       ↓
COMMAND EXECUTOR (globalCommandRegistry.execute)
```

## 2. Core Architectural Principles
1. **Single Source of Truth:** The Command Palette consumes the existing `CommandRegistry`. It contains no custom action logic or duplicated command handlers.
2. **Revalidation at Execution:** Before executing a selected command via `Enter` or click, the system revalidates `canExecute(id, ctx)`. Unavailable commands cannot be executed even if the UI state was generated prior to a context change.
3. **Security & Privacy:** Search queries are pure strings matched locally. Zero `eval()` or dynamic string execution is performed. Untrusted search queries are never stored or transmitted externally.

## 3. Command Search Engine & Ranking
The `CommandSearchService` (`src/services/CommandSearchService.ts`) handles query normalization and deterministic scoring:
- **Exact Label Match (Score 1000):** Query matches full label exactly.
- **Prefix Match (Score 800):** Label starts with query.
- **Word Start Match (Score 600):** Query matches the beginning of a word within the label (e.g. `Line` -> `Go to Line`).
- **Substring Match (Score 400):** Query is contained within the label.
- **Fuzzy Sequence Match (Score 200+):** Characters of the query appear in order within the label.
- **Category / Description / Alias Match (Score 100):** Match found in metadata fields.

## 4. Keyboard Navigation & Accessibility
- `Ctrl+Shift+P` / `Cmd+Shift+P` opens the Command Palette.
- `ArrowUp` / `ArrowDown` navigates result items with automatic scroll-into-view.
- `Home` / `End` jumps to first/last result.
- `Enter` executes the selected command.
- `Escape` closes the palette and restores focus.
- Accessible ARIA attributes (`role="dialog"`, `role="combobox"`, `role="listbox"`, `role="option"`, `aria-selected`, `aria-disabled`).

## 5. Non-Goals / Deferred Boundaries
- Quick Open file picker (`Ctrl+P`).
- Symbol search & Go-to-Definition.
- Natural language / LLM command parsing.
- Macro recording or plugin script execution.
