# Phase 04 — Core Application Engine Architecture Index

This document provides a canonical, centralized navigation index for all architectural and design specifications established across **Phase 04 (Steps 29–45)** of QM Editor.

---

## 🏛️ Phase 04 Architectural Blueprint

Phase 04 establishes the authoritative core engine of QM Editor. It strictly enforces single authority per state domain, transaction-gated mutations, cooperative cancellation, asynchronous lifecycle protection, workspace boundary containment, and provider failure shielding.

```text
                         Application Runtime
                                │
                     ┌──────────┴──────────┐
                     ▼                     ▼
               Service Registry       Event System
                     │
                     ▼
               Workspace Engine
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
     File System   Resource   Workspace
      Service      Lifecycle   Context
          │
          ▼
     File Watch Service
          │
          ▼
 Resource Synchronization
          │
          ▼
     Document Engine
          │
          ▼
   Editor Coordination
          │
          ▼
     Edit Transactions
          │
     ┌────┼─────┬──────────┐
     ▼    ▼     ▼          ▼
 Undo/Redo  Commands   Diagnostics   Language Intelligence
                         │                 │
                         ▼                 ▼
                      Problems        Providers
                         │                 │
                         └────────┬────────┘
                                  ▼
                            Navigation
                                  │
                                  ▼
                               Editor/UI
```

---

## 📚 Canonical Specifications Index

| Step | Subsystem / Topic | Architecture Specification | Design / UX Specification |
| :--- | :--- | :--- | :--- |
| **Step 29** | Core Application Runtime, Lifecycle & Registry | [`QM_EDITOR_RUNTIME_ARCHITECTURE.md`](file:///d:/App%20Winrar%20Files/QM%20Editor%20(working)/docs/architecture/QM_EDITOR_RUNTIME_ARCHITECTURE.md) | — |
| **Step 30** | Workspace & Project Context Engine | [`QM_EDITOR_WORKSPACE_ENGINE.md`](file:///d:/App%20Winrar%20Files/QM%20Editor%20(working)/docs/architecture/QM_EDITOR_WORKSPACE_ENGINE.md) | — |
| **Step 31** | Edit Transactions, Revision & Change Consistency | [`QM_EDITOR_EDIT_TRANSACTIONS.md`](file:///d:/App%20Winrar%20Files/QM%20Editor%20(working)/docs/architecture/QM_EDITOR_EDIT_TRANSACTIONS.md) | — |
| **Step 32** | File System Watcher & Change Reconciliation | [`QM_EDITOR_FILE_WATCHING.md`](file:///d:/App%20Winrar%20Files/QM%20Editor%20(working)/docs/architecture/QM_EDITOR_FILE_WATCHING.md) | — |
| **Step 33** | Document History, Edit Grouping & Undo/Redo | [`QM_EDITOR_DOCUMENT_HISTORY.md`](file:///d:/App%20Winrar%20Files/QM%20Editor%20(working)/docs/architecture/QM_EDITOR_DOCUMENT_HISTORY.md) | — |
| **Step 34** | Diagnostics Model, Aggregation & Problems | [`QM_EDITOR_DIAGNOSTICS_ENGINE.md`](file:///d:/App%20Winrar%20Files/QM%20Editor%20(working)/docs/architecture/QM_EDITOR_DIAGNOSTICS_ENGINE.md) | — |
| **Step 35** | Symbol Infrastructure & Outline Engine | [`QM_EDITOR_SYMBOL_ENGINE.md`](file:///d:/App%20Winrar%20Files/QM%20Editor%20(working)/docs/architecture/QM_EDITOR_SYMBOL_ENGINE.md) | [`QM_EDITOR_OUTLINE_UX.md`](file:///d:/App%20Winrar%20Files/QM%20Editor%20(working)/docs/design/QM_EDITOR_OUTLINE_UX.md) |
| **Step 36** | Document Engine & Resource Lifecycle | [`QM_EDITOR_DOCUMENT_ENGINE.md`](file:///d:/App%20Winrar%20Files/QM%20Editor%20(working)/docs/architecture/QM_EDITOR_DOCUMENT_ENGINE.md) | — |
| **Step 37** | Editor Engine Coordination & Text Models | [`QM_EDITOR_ENGINE_COORDINATION.md`](file:///d:/App%20Winrar%20Files/QM%20Editor%20(working)/docs/architecture/QM_EDITOR_ENGINE_COORDINATION.md) | — |
| **Step 38** | Resource Synchronization & External Change Detection | [`QM_EDITOR_RESOURCE_SYNCHRONIZATION.md`](file:///d:/App%20Winrar%20Files/QM%20Editor%20(working)/docs/architecture/QM_EDITOR_RESOURCE_SYNCHRONIZATION.md) | — |
| **Step 39** | Undo/Redo Integration & History Integrity | [`QM_EDITOR_UNDO_REDO_INTEGRATION.md`](file:///d:/App%20Winrar%20Files/QM%20Editor%20(working)/docs/architecture/QM_EDITOR_UNDO_REDO_INTEGRATION.md) | — |
| **Step 40** | Diagnostics, Problems & Issue Lifecycle | [`QM_EDITOR_DIAGNOSTICS_PROBLEMS.md`](file:///d:/App%20Winrar%20Files/QM%20Editor%20(working)/docs/architecture/QM_EDITOR_DIAGNOSTICS_PROBLEMS.md) | — |
| **Step 41** | Code Navigation, Locations & Outline Engine | [`QM_EDITOR_NAVIGATION_COORDINATION.md`](file:///d:/App%20Winrar%20Files/QM%20Editor%20(working)/docs/architecture/QM_EDITOR_NAVIGATION_COORDINATION.md) | — |
| **Step 42** | Language Intelligence Provider Architecture & Completion | [`QM_EDITOR_LANGUAGE_INTELLIGENCE.md`](file:///d:/App%20Winrar%20Files/QM%20Editor%20(working)/docs/architecture/QM_EDITOR_LANGUAGE_INTELLIGENCE.md) <br/> [`QM_EDITOR_COMPLETION_ENGINE.md`](file:///d:/App%20Winrar%20Files/QM%20Editor%20(working)/docs/architecture/QM_EDITOR_COMPLETION_ENGINE.md) | [`QM_EDITOR_COMPLETION_UX.md`](file:///d:/App%20Winrar%20Files/QM%20Editor%20(working)/docs/design/QM_EDITOR_COMPLETION_UX.md) |
| **Step 43** | Hover Information, Signature Help & Sanitization | [`QM_EDITOR_HOVER_SYSTEM.md`](file:///d:/App%20Winrar%20Files/QM%20Editor%20(working)/docs/architecture/QM_EDITOR_HOVER_SYSTEM.md) <br/> [`QM_EDITOR_SIGNATURE_HELP.md`](file:///d:/App%20Winrar%20Files/QM%20Editor%20(working)/docs/architecture/QM_EDITOR_SIGNATURE_HELP.md) | [`QM_EDITOR_CONTEXTUAL_INTELLIGENCE_UX.md`](file:///d:/App%20Winrar%20Files/QM%20Editor%20(working)/docs/design/QM_EDITOR_CONTEXTUAL_INTELLIGENCE_UX.md) |
| **Step 44** | Code Actions, Quick Fixes & Safe Transformations | [`QM_EDITOR_CODE_ACTIONS.md`](file:///d:/App%20Winrar%20Files/QM%20Editor%20(working)/docs/architecture/QM_EDITOR_CODE_ACTIONS.md) <br/> [`QM_EDITOR_CODE_TRANSFORMATIONS.md`](file:///d:/App%20Winrar%20Files/QM%20Editor%20(working)/docs/architecture/QM_EDITOR_CODE_TRANSFORMATIONS.md) | [`QM_EDITOR_CODE_ACTIONS_UX.md`](file:///d:/App%20Winrar%20Files/QM%20Editor%20(working)/docs/design/QM_EDITOR_CODE_ACTIONS_UX.md) |
| **Step 45** | Core Engine Integration & Completion Audit | [`QM_EDITOR_CORE_ENGINE_INTEGRATION.md`](file:///d:/App%20Winrar%20Files/QM%20Editor%20(working)/docs/architecture/QM_EDITOR_CORE_ENGINE_INTEGRATION.md) | [`QM_EDITOR_PHASE_04_COMPLETION_AUDIT.md`](file:///d:/App%20Winrar%20Files/QM%20Editor%20(working)/docs/architecture/QM_EDITOR_PHASE_04_COMPLETION_AUDIT.md) |

---

## 🔒 Mandatory Core Invariants

1. **One Authority Per State Domain:**
   - Application Lifecycle → [`ApplicationRuntime`](file:///d:/App%20Winrar%20Files/QM%20Editor%20(working)/src/core/runtime/ApplicationRuntime.ts)
   - Workspace Context & Generation → [`WorkspaceEngine`](file:///d:/App%20Winrar%20Files/QM%20Editor%20(working)/src/core/workspace/WorkspaceEngine.ts)
   - Document Buffers, Revisions & Dirty State → [`DocumentEngine`](file:///d:/App%20Winrar%20Files/QM%20Editor%20(working)/src/core/documents/DocumentEngine.ts)
   - Text Mutation Transactions → [`EditTransactionManager`](file:///d:/App%20Winrar%20Files/QM%20Editor%20(working)/src/core/edit/EditTransactionManager.ts)
   - Filesystem I/O → [`FileService`](file:///d:/App%20Winrar%20Files/QM%20Editor%20(working)/src/services/FileService.ts)
   - Filesystem Observation → [`FileSystemWatcherService`](file:///d:/App%20Winrar%20Files/QM%20Editor%20(working)/src/core/watcher/FileSystemWatcherService.ts)
   - Undo/Redo Stacks → [`DocumentHistoryService`](file:///d:/App%20Winrar%20Files/QM%20Editor%20(working)/src/core/history/DocumentHistoryService.ts)
   - Diagnostic Issues → [`DiagnosticService`](file:///d:/App%20Winrar%20Files/QM%20Editor%20(working)/src/core/diagnostics/DiagnosticService.ts)
   - Navigation Jumps → [`NavigationCoordinator`](file:///d:/App%20Winrar%20Files/QM%20Editor%20(working)/src/core/navigation/NavigationCoordinator.ts)
   - Language Providers → [`LanguageIntelligenceRegistry`](file:///d:/App%20Winrar%20Files/QM%20Editor%20(working)/src/core/language-intelligence/LanguageIntelligenceRegistry.ts)
   - Actions & Commands → [`CommandRegistry`](file:///d:/App%20Winrar%20Files/QM%20Editor%20(working)/src/core/commands/CommandRegistry.ts)
   - User Alerts & Dialogs → [`FeedbackService`](file:///d:/App%20Winrar%20Files/QM%20Editor%20(working)/src/core/feedback/FeedbackService.ts)

2. **Controlled Mutation Gate:** No feature, completion item, or code action may directly mutate document text. All text changes route through `applyTransaction` with an explicit `TransactionOrigin`.
3. **Double Validation Rule:** Code actions are evaluated at presentation and strictly revalidated at execution against active revisions, workspace generation, and ranges.
4. **Non-Mutating Information & Previews:** Hover tooltips, signature help, symbol outlines, and code action diff previews never modify document buffers, dirty states, or undo histories.
5. **Zero Data Loss:** External disk changes to dirty documents raise non-destructive conflict alerts, preserving local user edits unconditionally.
