# QM Editor — Unified Feedback, Notifications, Confirmations & Progress Architecture

## 1. Overview & Objective

The **Unified Feedback System** in QM Editor establishes a centralized, predictable, accessible, and privacy-conscious interaction feedback pipeline across all subsystems. 

Prior to Step 23, separate features managed ad-hoc alerts, modals, and status flags. The feedback architecture unifies these into one centralized architecture:

```
Application Event / Command Result
              ↓
       Feedback Service
              ↓
     Normalized Feedback Model
              ↓
     Presentation Resolver
  ┌───────────┼─────────────┐
  ↓           ↓             ↓
Toast      Banner        Dialog / Confirm / Progress
  ↓           ↓             ↓
ToastHost  BannerHost    ConfirmDialog / ProgressHost
```

---

## 2. Core Feedback Model & Types

### 2.1 Severities
- `success`: Successful, completed actions (e.g. file saved, task succeeded).
- `info`: Non-critical informational notices and diagnostic context.
- `warning`: Conditions requiring user awareness without blocking work (e.g. workspace restricted mode, high tab count).
- `error`: Failed operations or unrecoverable states requiring user remediation.

### 2.2 Presentation Modes
- `toast`: Transient, non-blocking notification floating at the bottom-right corner.
- `banner`: Persistent notice spanning across the application workspace (e.g. workspace trust required, Git unavailable).
- `dialog`: Modal or non-modal surface requiring focused attention.
- `confirmation`: Interactive modal gate returning explicit `'confirmed' | 'cancelled' | 'dismissed'` results.
- `progress`: Floating active task progress tracker supporting determinate percentages and indeterminate progress bars.
- `inline`: Scoped field/form validation messages attached directly to inputs.
- `status`: Low-priority footer indicators on the status bar.

### 2.3 Normalized Feedback Message Contract
```typescript
export interface FeedbackMessage {
  id: string;
  severity: FeedbackSeverity;
  presentation: PresentationType;
  title?: string;
  message: string;
  details?: string;
  actions?: FeedbackAction[];
  dismissible?: boolean;
  duration?: number; // Duration in ms; undefined = persistent until dismissed
  priority?: FeedbackPriority;
  source?: string;
  scope?: FeedbackScope;
  scopeId?: string;
  operationId?: string;
  timestamp: number;
  repeatCount?: number;
}
```

---

## 3. Centralized Feedback Service

`FeedbackService` (`src/core/feedback/FeedbackService.ts`) acts as the single source of truth for all notifications and dialogs:

- **Singleton & Dependency Injection**: Exposed globally via `globalFeedbackService` and injected via React Context `FeedbackProvider`.
- **Deduplication Strategy**: Duplicate toasts from the same subsystem with identical messages and severity within 3,000ms increment a `repeatCount` badge rather than stacking redundant toast cards.
- **Auto-Dismiss Durations**:
  - `brief`: 2,500ms (lightweight confirmations)
  - `normal`: 5,000ms (standard informative messages)
  - `persistent`: Indefinite until manual user dismissal (error banners, critical issues).
- **Queue Bounds**: Bounded queue prevents notification storms from covering the editor.
- **Sensitive Detail Sanitization**: Automatically scrubs passwords, authorization tokens (`Bearer ...`), API keys, and PEM private keys (`-----BEGIN PRIVATE KEY-----`) from technical details before rendering or copying to clipboard.

---

## 4. Confirmations & Destructive Action Guards

Confirmations return explicit typed promises:
```typescript
const result = await globalFeedbackService.confirm({
  title: 'Delete Resource',
  message: 'Are you sure you want to delete script.ts?',
  confirmLabel: 'Delete Forever',
  cancelLabel: 'Keep File',
  isDestructive: true,
});
if (result === 'confirmed') {
  // execute delete
}
```

### Safety Features:
1. **Safe Default Focus**: Initial keyboard focus is set to the **Cancel button** rather than the destructive button to avoid accidental submission on Enter/Space.
2. **Focus Trap**: Keyboard `Tab` and `Shift+Tab` navigate strictly within the modal action buttons.
3. **Escape Behavior**: Pressing `Escape` cancels the confirmation cleanly and restores focus to the previously active element.
4. **Supersede Protection**: When a new confirmation is requested before an active one resolves, the prior confirmation is cleanly resolved as `'dismissed'`.

---

## 5. Progress Tracking Architecture

The progress system distinguishes measurable advancement from indeterminate activity:

- **Determinate Progress**: Used when `current` and `total` are known (e.g. multi-file replace, workspace indexing). Displays quantitative progress percentage (`aria-valuenow`).
- **Indeterminate Progress**: Used when percentage is unmeasurable (e.g. connecting to daemon, remote Git handshake).
- **Cancellability**: Exposes an accessible cancel button wired to the operation's cancellation token.
- **Lifecycle Transitions**: Tasks cleanly transition to `completed` (auto-dismissed after brief pause) or `error` (which generates an actionable error toast).

```typescript
const handle = globalFeedbackService.startProgress({
  title: 'Replacing occurrences in 50 files',
  mode: 'determinate',
  total: 50,
  cancellable: true,
  onCancel: () => abortController.abort(),
});

handle.update({ current: 25, message: 'Updated 25 of 50 files' });
handle.complete('All files successfully updated');
```

---

## 6. Scope Isolation & Stale Protection

Feedback messages and progress tasks support scoped tagging:
- `global`: Application-wide feedback.
- `workspace`: Bound to a specific workspace directory (`scopeId = workspaceUri`).
- `document`: Bound to an open document tab (`scopeId = docId`).
- `operation`: Linked to an active async operation ID (`operationId = opId`).

When a workspace is closed or switched, `clearScope('workspace', workspaceUri)` eliminates any pending background toasts or tasks belonging to the previous workspace, preventing stale leaks across projects.

---

## 7. Accessibility & Motion

- **ARIA Semantics**:
  - Errors: `role="alert"` and `aria-live="assertive"`.
  - Warnings and Info: `role="status"` and `aria-live="polite"`.
  - Confirmations: `role="dialog"` with `aria-modal="true"`.
  - Progress: `role="progressbar"` with `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`.
- **Keyboard Navigation**: Full keyboard accessibility (`Tab`, `Shift+Tab`, `Space`, `Enter`, `Escape`).
- **Reduced Motion**: All animations use subtle `fadeIn` transitions without disruptive screen jumping.
