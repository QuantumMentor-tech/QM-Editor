# QM EDITOR — ARCHITECTURAL DECISION RECORD (ADR): EDITOR ENGINE SELECTION

**Document Version:** 1.0.0  
**Date:** October 10, 2026  
**Status:** Approved  
**Decision Title:** Selection of CodeMirror 6 as the Core Editor Engine Adapter  

---

## 1. CONTEXT & PROBLEM STATEMENT

QM Editor requires a production-grade, highly performant code and text editing engine. The engine must integrate cleanly into React 19 + Vite 6 + TypeScript 5 without introducing complex web-worker bundler hacks, excessive bundle bloat, or tight coupling between the UI components and third-party engine APIs.

---

## 2. EVALUATION OF CANDIDATE ENGINES

| Criteria | CodeMirror 6 | Monaco Editor | Plain Textarea |
|---|---|---|---|
| **Architecture & Bundling** | Modern, ESM-native functional architecture. Zero worker setup required. | Requires complex web-worker bundler plugins (`monaco-editor-webpack-plugin` or Vite web worker config). | Native DOM node, but lacks line numbers, selection extensions, syntax highlighting, and undo/redo stacks. |
| **Performance & Bundle Size** | Extremely lightweight (~120KB gzipped). Instant HMR. | Heavy (~3MB+ gzipped core + workers). Slow initial load. | Zero bundle footprint. |
| **React Integration** | Clean adapter lifecycle through React refs and state hooks. | Requires heavy wrapper lifecycle management (`@monaco-editor/react`). | Native React input component. |
| **Accessibility & Semantics** | Built-in screen reader support, keyboard navigation, and ARIA attributes. | Good accessibility, but heavy canvas/DOM overlays. | Native browser accessibility. |
| **Extensibility & AST Support** | Lezer AST parser integration, modular extensions, custom themes. | Monarch/LSP protocol integration. | None. |
| **Licensing** | MIT License. | MIT License. | N/A. |

---

## 3. DECISION & RATIONALE

We select **CodeMirror 6** (`@codemirror/view`, `@codemirror/state`, `@codemirror/language`, `@codemirror/commands`, `@codemirror/theme-one-dark`) as the primary underlying editor engine for QM Editor.

### Key Reasons:
1. **Lightweight & Fast:** Instant initial rendering and smooth performance even with multi-megabyte files.
2. **ESM-Native & Vite Compatibility:** Builds effortlessly out of the box without requiring web-worker compilation plugins.
3. **Decoupled Adapter Architecture:** All CodeMirror APIs are contained strictly inside [`src/components/editor/EditorAdapter.ts`](file:///d:/App%20Winrar%20Files/QM%20Editor%20%28working%29/src/components/editor/EditorAdapter.ts). The rest of QM Editor communicates exclusively through the standard `EditorAdapterInterface`.

---

## 4. CONSEQUENCES & COMPATIBILITY IMPACT

- Clean separation between document state (`DocumentModel`) and CodeMirror editor state (`EditorState` / `EditorView`).
- No vendor lock-in: The application shell and `WorkspaceContext` remain completely engine-agnostic.
