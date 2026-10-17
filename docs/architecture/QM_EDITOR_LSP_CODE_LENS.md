# QM Editor — LSP Code Lens Architecture
**Phase 06, Step 66 — LSP Code Lens, Inline Actions & Safe Command Integration**

---

## 1. Executive Summary

LSP Code Lens provides actionable inline metadata headers directly above source code symbols without modifying document text, content revisions, dirty states, or undo/redo stacks. This subsystem implements the LSP 3.17 `textDocument/codeLens` and `codeLens/resolve` protocols, safely integrating server-provided contextual actions (such as reference counts, test runners, implementation navigation, and symbol metadata) into QM Editor's existing command and navigation architectures.

---

## 2. Core Architectural Principles

1. **Strictly Non-Destructive Derived Visuals**:
   Code Lens elements are ephemeral presentation metadata. They never alter buffer content, document revision counts, dirty state, persistent storage, autosave snapshots, recovery journals, local history, or undo/redo stacks.
2. **Double Revision Guard & Stale Protection**:
   Every request records `contentRevision` and `workspaceGeneration` at dispatch time. Responses arriving after the document has been edited, closed, or switched are discarded immediately to prevent misaligned lenses.
3. **Strict Command Security Boundary**:
   External LSP command payloads are treated as untrusted input. Arbitrary shell, terminal, process execution, eval, or script injection attempts are unconditionally rejected. Actions are strictly routed through `CommandRegistry` or `LspNavigationCoordinator`.
4. **Lazy Resolution**:
   Where supported by `codeLensProvider.resolveProvider`, command metadata can be resolved on-demand via `codeLens/resolve`, preventing large payload transfers and resolution storms at document load.
5. **Single Line Block Widget Layering**:
   Code Lens actions are rendered above target source lines using CodeMirror 6 `Decoration.widget` with `block: true, side: -1`, grouping multiple actions per line to eliminate visual noise and DOM layout thrashing.

---

## 3. Subsystem Architecture

```text
Editor / Document
        │
        ▼ (document.opened / changed)
LspCodeLensCoordinator (debouncing, cancellation, lifecycle)
        │
        ▼
LspCodeLensProvider
        │
        ▼ (Capability check: codeLensProvider)
textDocument/codeLens
        │
        ▼
Language Server
        │
        ▼
LspCodeLensResponse
        │
        ▼
LspCodeLensSecurityValidator (bounds check, injection defense, size limits)
        │
        ▼
LspCodeLensMapper (canonical model, line grouping, start-char sorting)
        │
        ├────────────────────────┐
        ▼                        ▼
Inline Block Renderer    LspCodeLensResolver
(CodeMirror 6 StateField)         │ (codeLens/resolve)
        │                        ▼
        │               Resolved Canonical Lens
        └──────────────┬─────────┘
                       ▼
        User Action / Click / Keyboard
                       │
                       ▼
        CommandRegistry / LspNavigationCoordinator
```

---

## 4. Key Components

- **`LspCodeLensProvider`** (`src/core/lsp/code-lens/LspCodeLensProvider.ts`):
  Communicates with the active `LspServerSession` to dispatch `textDocument/codeLens` requests and caches responses indexed by document URI and revision.
- **`LspCodeLensResolver`** (`src/core/lsp/code-lens/LspCodeLensResolver.ts`):
  Handles lazy resolution of unresolved lenses via `codeLens/resolve`, validating returned command structures against security rules.
- **`LspCodeLensSecurityValidator`** (`src/core/lsp/code-lens/LspCodeLensSecurityValidator.ts`):
  Validates command IDs against allowlists and `CommandRegistry`, sanitizes titles, checks argument sizes and counts, and prohibits shell/terminal injection.
- **`LspCodeLensMapper`** (`src/core/lsp/code-lens/LspCodeLensMapper.ts`):
  Converts raw LSP responses to `CanonicalCodeLens`, verifies line/character document bounds, groups lenses onto `EditorCodeLensLine`, and clamps count to `MAX_LENSES_PER_DOCUMENT = 500`.
- **`LspCodeLensCoordinator`** (`src/core/lsp/code-lens/LspCodeLensCoordinator.ts`):
  Singleton managing document and settings lifecycle events, debouncing requests (default 250ms), and routing user clicks to safe command execution.
- **`LspCodeLensExtension` & `LspCodeLensWidget`** (`src/core/lsp/code-lens/`):
  CodeMirror 6 `StateField` and `WidgetType` rendering accessible inline action buttons with subtle styling and keyboard activation support.

---

## 5. Verification & Testing

The subsystem is validated by automated integration and unit tests covering:
- Standard Code Lens requests and canonical mapping
- Multi-lens line grouping and character sorting
- Lazy command resolution via `codeLens/resolve`
- Safe command execution through `CommandRegistry`
- Blocking of malicious shell/terminal commands and injection payloads
- Stale response discarding upon document edit
- Lifecycle cleanup on document close and workspace switch
- Empty response handling and graceful tolerance of malformed server outputs
