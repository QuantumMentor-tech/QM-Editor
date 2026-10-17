# QM Editor — Selection Expansion UX & Accessibility

## 1. User Experience Principles

Selection expansion is designed to feel instantaneous, predictable, and seamless:
- **Instant Response:** Cached structural hierarchies and synchronous native fallback eliminate perceived latency.
- **Progressive Selection:** Each press of **Expand Selection** widens the selection to the next logical language boundary.
- **No Stutter or Duplicate States:** Adjacent hierarchy levels containing identical character offsets are automatically collapsed so the user never encounters a "no-op" expansion step before reaching the next boundary.
- **Non-Destructive Shrink:** Pressing **Shrink Selection** walks backwards down the exact path the user expanded.
- **Preserved Direction:** The `editor.selectionExpansion.preserveAnchor` setting preserves the active cursor head and anchor orientation during multi-step expansions.

## 2. Command Architecture & Keybindings

The feature is exposed through both standard VS Code command identifiers and clean semantic aliases:

| Command ID | Display Label | Default Shortcut | Description |
|:---|:---|:---|:---|
| `editor.action.smartSelect.expand` | Selection: Expand Selection | `Shift+Alt+Right` / `Shift+Alt+ArrowRight` | Expands selection to structural boundaries |
| `editor.action.smartSelect.shrink` | Selection: Shrink Selection | `Shift+Alt+Left` / `Shift+Alt+ArrowLeft` | Shrinks selection to previously enclosing boundary |
| `selection.expand` | Expand Selection | — | Standard alias for Command Palette |
| `selection.shrink` | Shrink Selection | — | Standard alias for Command Palette |

## 3. Focus & Viewport Stability

- **Editor Focus:** Invocations keep focus pinned inside the editor surface. Focus is never diverted to panels, tree views, or status indicators.
- **Viewport Stability:** Selection changes reveal only what is necessary to keep the active cursor visible (`scrollIntoView: true`), avoiding jarring jumps or forced re-centering.

## 4. Accessibility & Screen Reader Integration

- **Semantic Selection Updates:** Changes are applied directly through the editor's native selection API, ensuring native browser accessibility trees and OS screen readers announce the newly selected text naturally.
- **Silent Protocol Telemetry:** Internal protocol operations (`textDocument/selectionRange`) remain completely silent to assistive technology.
- **High Contrast:** All visual selection highlights leverage the editor's existing high-contrast and theme-aware CSS custom properties.

## 5. Configuration Settings

| Setting Key | Type | Default | Description |
|:---|:---|:---|:---|
| `lsp.selectionRange.enabled` | `boolean` | `true` | Enables LSP structural selection range querying. |
| `editor.selectionExpansion.enabled` | `boolean` | `true` | Master toggle for context-aware selection expansion. |
| `editor.selectionExpansion.useLanguageServer` | `boolean` | `true` | Controls whether LSP is consulted before native fallback. |
| `editor.selectionExpansion.preserveAnchor` | `boolean` | `true` | Maintains head vs anchor direction during expansion. |
| `lsp.selectionRange.maxDepth` | `number` | `50` | Maximum hierarchy depth limit to protect performance. |
