# QM EDITOR — EDITOR ENGINE INTEGRATION ARCHITECTURE

**Version:** 1.0.0  
**Status:** Approved Specification  
**Last Updated:** October 10, 2026  

---

## 1. INTEGRATION ARCHITECTURE

The editing surface is isolated behind an explicit multi-tier abstraction layer:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        MAIN WORKSPACE CONTAINER                        │
│   (Consumes `useWorkspace()` active document & tab list)               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Binds Active Document Model
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     EDITOR SURFACE REACT COMPONENT                     │
│   (`src/components/editor/EditorSurface.tsx`)                          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Controls Mounting & Lifecycle
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      QM EDITOR ADAPTER INTERFACE                       │
│   (`src/components/editor/EditorAdapter.ts`)                           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Encapsulates Native API
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         CODEMIRROR 6 ENGINE                            │
│   (`EditorView`, `EditorState`, `oneDark`, `history`, `keymap`)        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. PREVENTING DOCUMENT CROSS-CONTAMINATION

When switching active document tabs (e.g. `Document A` → `Document B` → `Document A`):
1. **Model Isolation:** Each document maintains its own text state in `WorkspaceContext`.
2. **Re-binding Guard:** When the active document ID changes, `EditorSurface` updates the CodeMirror `EditorView` content using transaction dispatching without re-instantiating duplicate event listeners.
3. **Loop Prevention:** Programmatic content sync sets an `isProgrammatic` flag to prevent echo feedback loops where programmatic updates mark the document dirty.

---

## 3. ADAPTER CONTRACT (`EditorAdapterInterface`)

```typescript
export interface EditorAdapterOptions {
  readOnly?: boolean;
  theme?: ThemeMode;
  onChange?: (newContent: string) => void;
}

export interface EditorAdapterInterface {
  mount(container: HTMLElement, initialContent: string, options?: EditorAdapterOptions): void;
  setContent(content: string): void;
  getContent(): string;
  setReadOnly(readOnly: boolean): void;
  setTheme(theme: ThemeMode): void;
  dispose(): void;
}
```
