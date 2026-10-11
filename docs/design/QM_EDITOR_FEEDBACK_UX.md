# QM Editor — Feedback UX Design Guidelines

## 1. Visual Hierarchy & Design System Tokens

Feedback surfaces in QM Editor strictly conform to the unified dark/light theme tokens and typography standards.

### 1.1 Toast Notifications (`ToastHost.tsx`)
- **Position**: Fixed bottom-right corner (`bottom: 36px; right: 16px; z-index: 9990`).
- **Dimensions**: Min-width `300px`, max-width `440px`.
- **Styling**: `var(--bg-secondary)`, 1px border `var(--border-color)`, with a prominent 4px left border matching the severity color:
  - Success: `var(--success, #2ea043)`
  - Info: `var(--accent-primary, #58a6ff)`
  - Warning: `var(--warning, #d29922)`
  - Error: `var(--error, #f85149)`
- **Repeat Count**: Rendered as a pill badge (`×N`) when deduplicated.
- **Actions**: Styled buttons with primary (`var(--accent-primary)`) or secondary outline appearance.
- **Sanitized Details**: Collapsible drawer with `Copy` action.

### 1.2 Persistent Banners (`BannerHost.tsx`)
- **Position**: Spans horizontally directly beneath the application Header toolbar.
- **Styling**: Subtle translucent background tint (`rgba(...)`), thin bottom border.
- **Purpose**: Persistent system status such as missing Git runtime, workspace trust prompt, or restricted recovery mode.

### 1.3 Confirmation Dialogs (`ConfirmDialog.tsx`)
- **Position**: Centered modal overlay with semi-opaque backdrop blur (`rgba(0,0,0,0.65)`, `backdrop-filter: blur(3px)`).
- **Max-width**: `460px`.
- **Interaction Rules**:
  - Cancel button is auto-focused on open (safe destructive pattern).
  - Destructive action button is styled with `var(--error, #f85149)`.
  - Pressing `Escape` or clicking the backdrop triggers safe cancellation.

### 1.4 Floating Progress Tasks (`ProgressHost.tsx`)
- **Position**: Fixed bottom-left corner (`bottom: 36px; left: 16px; z-index: 9980`).
- **Width**: `280px`.
- **Track**: 4px track height, animated pulse for indeterminate mode, smoothed width transitions for determinate mode.
- **Controls**: Includes spinning spinner icon and cancellation button if cancellable.

### 1.5 Inline Feedback (`InlineFeedback.tsx`)
- **Usage**: Used under input fields, settings items, and forms.
- **Layout**: Inline flex with severity icon and concise descriptive text.
- **Compact mode**: 12px icon with 0.72rem text for space-constrained forms.

---

## 2. Accessibility & Screen Reader Guidelines

1. **Live Regions**: Assertive live region for critical errors; polite live region for information and warnings.
2. **Focus Preservation**: Modals save the currently focused element upon opening and restore focus upon dismissal.
3. **No Unintended Confirmations**: Destructive actions must never be preselected as the initial keyboard target.
