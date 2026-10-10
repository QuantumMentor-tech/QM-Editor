# QM EDITOR — TECHNICAL ARCHITECTURE SPECIFICATION

**Document Version:** 1.0.0  
**Status:** Approved Architecture Foundation  
**Last Updated:** October 10, 2026  
**Target Application:** QM Editor (Modern High-Performance Document & Code Editor)

---

## 1. ARCHITECTURE OVERVIEW

QM Editor is designed around a clean, decoupled, layered architecture prioritizing performance, type safety, unsaved data protection, and seamless user experience.

### Layer Diagram

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                              │
│   (UI Shell, Workspace Layout, Editor Component, Modals, Panels)      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Commands & User Interactions
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        APPLICATION LAYER                               │
│   (State Orchestration, Action Handlers, Shortcuts, Layout Manager)   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Invokes Domain Operations
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          DOMAIN / CORE LAYER                           │
│   (Document Model, Workspace Model, Tab Model, Selection Rules)       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Data Operations
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        INFRASTRUCTURE & SERVICES                       │
│   (Filesystem Bridge, Local Storage, Export/Import, AI Abstractions)   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. OFFICIAL TECHNOLOGY STACK

| Component | Technology Selected | Rationale |
|---|---|---|
| **Language** | TypeScript (v5+) | Strict type safety, refactoring safety, and runtime contract enforcement. |
| **Frontend Framework** | React (v19) | Declarative UI rendering, robust ecosystem, component modularity. |
| **Build Pipeline & Dev Server** | Vite (v6) | Instant HMR, fast bundling, ESM-native dev server. |
| **Styling & Visual System** | Vanilla CSS + CSS Variables | Maximum performance, zero runtime overhead, rich design tokens (dark/light themes). |
| **State Management** | React Context + Custom Hooks + Local Storage | Lightweight, predictable unidirectional state flow without excessive boilerplate. |
| **Persistence** | File System API / Local Storage | Client-side persistent workspace configuration, unsaved document protection. |
| **Iconography** | Lucide React | Lightweight, customizable, accessible icon set. |

---

## 3. LAYER RESPONSIBILITIES & DEPENDENCY RULES

### 3.1 Presentation Layer (`src/components/`, `src/app/`)
- **Responsibilities:** Renders UI components, captures user gestures, displays layout panels and document content.
- **Allowed Dependencies:** Application Hooks, Shared Types, Design Tokens (`index.css`).
- **Forbidden Dependencies:** Direct raw filesystem calls, uncontrolled global window state mutations, external model APIs.

### 3.2 Application Layer (`src/features/`, `src/state/`)
- **Responsibilities:** Orchestrates workspace state, tab management, command execution, keyboard shortcut handling.
- **Allowed Dependencies:** Domain Models, Service Interfaces, Utility Modules.
- **Forbidden Dependencies:** Direct DOM manipulation outside React lifecycles.

### 3.3 Domain / Core Layer (`src/core/`, `src/types/`)
- **Responsibilities:** Core data structures (Document, Tab, Workspace), document modification contracts, validation logic.
- **Allowed Dependencies:** Pure JavaScript/TypeScript utilities only.
- **Forbidden Dependencies:** React, DOM elements, external APIs, UI components.

### 3.4 Infrastructure & Service Layer (`src/services/`)
- **Responsibilities:** File persistence, local storage serialization, settings export/import, AI service abstraction interfaces.
- **Allowed Dependencies:** Core types, browser APIs, file system handlers.
- **Forbidden Dependencies:** React component layout logic.

---

## 4. RUNTIME BOUNDARIES & ENVIRONMENT SAFETY

- **Execution Shell:** Modern Browser / Web Container runtime.
- **Command Invocation Rule (Windows):** CLI commands and scripts are invoked via `cmd /c npm` to circumvent PowerShell script execution policy restrictions.
- **Asset Boundaries:** Project branding assets (e.g. `./QM Editor Logo.png`) are located in project root and served via relative path assets.

---

## 5. STATE MANAGEMENT ARCHITECTURE

State is categorized into three distinct, non-overlapping domains:

```text
               ┌───────────────────────────────────────┐
               │           WORKSPACE STATE             │
               │ (Open Tabs, Active Doc, Unsaved Flags)│
               └───────────────────┬───────────────────┘
                                   │
         ┌─────────────────────────┴─────────────────────────┐
         ▼                                                   ▼
┌─────────────────────────┐                         ┌─────────────────────────┐
│        UI STATE         │                         │    PERSISTENT STATE     │
│ (Sidebar toggle, theme, │                         │ (User preferences,      │
│  active view, modals)   │                         │  recent files list)     │
└─────────────────────────┘                         └─────────────────────────┘
```

1. **Workspace State:** Managed centrally via `WorkspaceContext`. Controls open documents, active document ID, dirty flags, and tab ordering.
2. **UI State:** Local component state (`useState`) for transient interactions (collapsible panels, active tab dropdowns, search inputs).
3. **Persistent State:** Synchronized with `localStorage` for application preferences (dark mode, auto-save interval, font scale).

---

## 6. DOCUMENT LIFECYCLE & UNSAVED DATA PROTECTION

### Document State Machine

```text
[ Closed ] ──( Open / Create )──> [ Loaded / Clean ] ──( User Edit )──> [ Modified / Dirty ]
                                         ▲                                    │
                                         │                                    ▼
                                   ( Save Success ) <──( Exec Save )─── [ Saving ]
```

### Unsaved Data Safeguards
- **Dirty Flag Tracking:** Every document model maintains `isDirty: boolean` and `lastSavedTimestamp: number`.
- **Auto-Draft Backup:** Unsaved document changes are automatically cached to local storage session drafts every 5 seconds.
- **Unload Warning:** Before tab close or window unload, unsaved documents trigger browser warning confirmation.

---

## 7. ERROR HANDLING & LOGGING STRATEGY

- **Unified Error Boundary:** React Error Boundaries wrap main application panels to prevent full UI crashes.
- **Standardized Error Types:** Application errors extend custom `QMEditorError` base class with clear categories (`FILE_READ_ERROR`, `SAVE_FAILED`, `PARSE_ERROR`, `INVALID_STATE`).
- **Sanitized Logging:** Console logging is routed through `LoggerService` which strips sensitive file paths and user content in production modes.

---

## 8. CONFIGURATION & SECURITY ARCHITECTURE

- **Environment Isolation:** App parameters configured via `.env` / `import.meta.env`.
- **XSS Prevention:** Content rendering strictly sanitizes raw markup; code/text editing uses text content nodes.
- **No Unsafe Code Evaluation:** `eval()` and dynamic code injection are strictly prohibited.

---

## 9. AI INTEGRATION BOUNDARY (PREPARATION FOR FUTURE ENHANCEMENT)

- **Service Abstraction:** AI assistant features interact exclusively via `AIServiceInterface`.
- **Decoupled Provider Layer:** UI components request completion/analysis without knowledge of backend AI provider (OpenAI, Anthropic, Gemini, local SLM).
- **Non-Blocking Execution:** All AI requests run asynchronously on non-blocking background workers or async promises.

---

## 10. UI DESIGN SYSTEM FOUNDATION

### Design Tokens (`src/index.css`)
- **Theme Variables:**
  - Dark Theme: `--bg-primary: #0f172a`, `--bg-secondary: #1e293b`, `--text-primary: #f8fafc`, `--accent: #38bdf8`.
  - Light Theme: `--bg-primary: #ffffff`, `--bg-secondary: #f1f5f9`, `--text-primary: #0f172a`, `--accent: #0284c7`.
- **Typography:** System UI Font Stack (`Inter`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `monospace` for editor code).
- **Branding Component:** `QM Editor Logo.png` rendered cleanly in header navbar and welcome splash.

---

## 11. DIRECTORY STRUCTURE CONVENTION

```text
QM Editor (working)/
├── docs/
│   └── architecture/
│       ├── QM_EDITOR_ARCHITECTURE.md
│       └── DECISIONS.md
├── public/
├── src/
│   ├── app/                # Main application shell & entry point
│   ├── components/         # Reusable presentation components
│   │   ├── common/         # Buttons, modals, inputs, tabs
│   │   └── layout/         # Header, Sidebar, StatusBar, EditorView
│   ├── core/               # Domain models & pure business logic
│   ├── features/           # Feature-specific modules (editor, search, settings)
│   ├── services/           # External service integration & storage API
│   ├── state/              # Global state contexts & hooks
│   ├── types/              # TypeScript type definitions
│   └── index.css           # Global design system & theme tokens
├── QM Editor Logo.png       # Primary branding logo
├── QM_EDITOR_PROJECT_BASELINE.md
├── QM_EDITOR_AGENT_RULES.md
├── package.json
├── tsconfig.json
└── vite.config.ts
```
