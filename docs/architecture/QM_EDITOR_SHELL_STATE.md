# QM EDITOR — SHELL STATE & NAVIGATION ARCHITECTURE

**Version:** 1.1.0  
**Status:** Approved Shell State Architecture  
**Last Updated:** October 10, 2026  

---

## 1. ARCHITECTURE OVERVIEW

QM Editor shell state is managed through a centralized, single-owner React Context (`ShellContext`) backed by an isolated preferences persistence service (`PreferencesService`).

### State Ownership Diagram

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          SHELL CONTEXT PROVIDER                        │
│   (Authoritative owner of Navigation, Layout, and Theme State)         │
└───────┬────────────────────────────────────────────────┬───────────────┘
        │ Read / Dispatch Actions                        │ Read / Persist Preferences
        ▼                                                ▼
┌────────────────────────────────┐            ┌────────────────────────────────┐
│      UI SHELL COMPONENTS       │            │      PREFERENCES SERVICE       │
│  (Header, Sidebar, Workspace,  │            │  (Validated LocalStorage Sync  │
│   SecondaryPanel, StatusBar)   │            │   with Fallback Protections)   │
└────────────────────────────────┘            └────────────────────────────────┘
```

---

## 2. STATE DOMAIN SEPARATION

To preserve architectural integrity, **Shell State** is strictly separated from **Document Workspace State**:

| Domain | Responsible Module | Owned State Values |
|---|---|---|
| **Shell State** | `ShellContext` / `ShellProvider` | Theme mode, sidebar visibility, sidebar width, secondary panel state, active panel view, active shell view, modal overlay state |
| **Document Workspace State** | `WorkspaceContext` / `DocumentRegistry` | Open document collection, tab ordering array (`openDocIds`), active document ID, dirty tracking, unsaved close target |
| **Preferences** | `PreferencesService` | Validated local storage persistence for user shell options (theme, sidebar open, panel defaults) |

---

## 3. SHELL STATE CONTRACT (`src/types/index.ts`)

```typescript
export type ThemeMode = 'dark' | 'light';
export type ShellView = 'editor' | 'settings' | 'extensions';
export type PanelView = 'output' | 'problems' | 'terminal';

export interface ShellState {
  theme: ThemeMode;
  sidebarOpen: boolean;
  sidebarWidth: number;
  panelOpen: boolean;
  activePanelView: PanelView;
  activeView: ShellView;
  dialogOpen: boolean;
  dialogTitle: string;
  dialogContent: React.ReactNode | null;
}
```

---

## 4. PERSISTENCE BOUNDARY & SAFEGUARDS

1. **Transient vs. Persisted State:** Transient states (modal visibility, active dropdowns) are kept strictly in memory. Only validated user options (theme, sidebar visibility, sidebar width) are stored in `localStorage`.
2. **Data Validation & Fallbacks:** `PreferencesService` validates all parsed JSON entries. If a stored value is invalid or corrupted, it falls back to safe defaults without crashing the application.
3. **Storage Errors:** Storage access failures (e.g. restricted browser privacy modes) are caught gracefully and logged via `logger`, allowing in-memory defaults to function seamlessly.
