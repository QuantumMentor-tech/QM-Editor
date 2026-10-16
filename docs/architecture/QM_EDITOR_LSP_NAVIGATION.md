# QM Editor LSP Code Navigation Integration

## Phase 06, Step 60 — Architecture Specification

---

## 1. Executive Summary

This document specifies the integration of Language Server Protocol (LSP) code navigation into QM Editor's authoritative navigation system.

Under this architecture:
- External language servers supply navigation intelligence (`textDocument/definition`, `textDocument/declaration`, `textDocument/typeDefinition`, `textDocument/references`).
- QM Editor's **NavigationCoordinator** and **DocumentEngine** remain strictly authoritative for resolving documents, opening tabs, recording navigation history, clamping ranges, revealing viewports, and handling focus.
- The language server does not own files, paths, tabs, or navigation history.

---

## 2. Architecture & Pipeline

```text
Editor Cursor / Command
           │
           ▼
   Navigation Coordinator
           │
           ▼
   LSP Navigation Provider
           │
           ▼
        LSP Client
           │
           ▼
    Language Server
           │
           ▼
    Raw LSP Response (Location | Location[] | LocationLink[] | null)
           │
           ▼
   LspLocationValidator (URI sanity, range normalization, security check)
           │
           ▼
    LspLocationMapper (0-based to 1-based, canonical Location[])
           │
     ┌─────┴──────────┐
     ▼                ▼
Definitions (1 or >1) References (Canonical Result Model)
     │                │
     ▼                ▼
Direct Jump / Picker  ReferencesModal UI
     │                │
     └─────────┬──────┘
               ▼
   NavigationCoordinator.navigateToLocation()
               │
               ├─► DocumentEngine (open/activate target file)
               ├─► Range Clamping & Editor Reveal
               └─► NavigationService (push to Back/Forward history)
```

---

## 3. Supported Operations

| Operation | LSP Method | Server Capability | Client Shortcut | Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **Go to Definition** | `textDocument/definition` | `definitionProvider` | `F12` | Single target jumps directly; multiple targets open picker |
| **Go to Declaration** | `textDocument/declaration` | `declarationProvider` | Command palette | Navigates to interface / header / d.ts declaration |
| **Go to Type Definition** | `textDocument/typeDefinition` | `typeDefinitionProvider` | Command palette | Navigates to type declaration of identifier |
| **Find References** | `textDocument/references` | `referencesProvider` | `Shift+F12` | Collects all usages grouped by file in `ReferencesModal` |

---

## 4. Capability Negotiation & Fallback

Before dispatching an LSP navigation request:
1. `LspNavigationProvider` verifies `lsp.navigation.enabled` (default: `true`).
2. Checks whether an active, ready session exists for the document language.
3. Inspects server capabilities (`definitionProvider`, `declarationProvider`, `typeDefinitionProvider`, `referencesProvider`).
4. If unsupported or uninitialized, falls back gracefully without showing disruptive error dialogs.
5. Emits controlled, user-friendly feedback via `FeedbackService` only when appropriate.
