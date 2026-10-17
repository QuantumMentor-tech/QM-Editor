# QM Editor — Document Link Navigation & Coordinator Integration

## Phase 06 — Advanced Features (Step 67 of 135)

---

## 1. Overview & Navigation Dispatch

When a user clicks or presses Enter on a document link in QM Editor, the click handler does not open files directly from the DOM. Instead, it dispatches an execution request through `LspDocumentLinkCoordinator.executeLink(link)`.

The coordinator routes the validated link based on its classification:

```
                  User Click / Keyboard Activation
                                │
                                ▼
                   LspDocumentLinkCoordinator
                                │
          ┌─────────────────────┴─────────────────────┐
          ▼                                           ▼
   Internal Navigation                        External Navigation
(workspace-local / same-document)                (external-web)
          │                                           │
          ▼                                           ▼
  NavigationCoordinator                   External Link Policy / Browser
          │                                (Respects setting:
          ▼                                 lsp.documentLinks.externalLinks)
  DocumentEngine / Editor
```

---

## 2. Same-Document Navigation

Links targeting anchors, line references, or ranges in the active document (e.g. `#L42` or `#function-summary`):
- Parsed to extract target line and column.
- Routed to `NavigationCoordinator.navigateToLocation({ uri: docUri, range: { startLine: 42, startColumn: 1, endLine: 42, endColumn: 1 } })`.
- Highlights and scrolls the target range smoothly into view without reopening or reloading the document buffer.
- Pushes the previous position to `NavigationHistoryService` for seamless Back/Forward (`Alt+Left` / `Alt+Right`) navigation.

---

## 3. Cross-Document / Workspace-Local Navigation

Links referencing other workspace files (e.g. `./components/Header.tsx`, `../utils/format.ts`):
- Relative paths are resolved relative to the containing document's directory.
- Normalized and verified to exist within the active workspace roots.
- Dispatched via `NavigationCoordinator.navigateToLocation({ uri: targetUri, range: targetRange })`.
- Reuses open editor tabs where available or opens the file in a new tab via `DocumentEngine`.

---

## 4. Missing Resource & Directory Targets

- If a local target file does not exist, QM Editor surfaces a non-intrusive warning notification via `FeedbackService` rather than failing silently or crashing.
- Missing files are **never** auto-created or auto-downloaded on click.
- Directories are not forced into the document editor; if directory navigation is not applicable, controlled feedback is presented to the user.

---

## 5. External Web Navigation

- Supported schemes: `http:`, `https:`, `mailto:`.
- Governed by setting `lsp.documentLinks.externalLinks` (default: `true`).
- When disabled, external link clicks are ignored or surface a notification explaining that external link navigation is disabled.
- External links open with `noopener,noreferrer` security flags to prevent tab-napping or opener access.
