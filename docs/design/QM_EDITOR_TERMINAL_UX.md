# QM EDITOR — INTEGRATED TERMINAL UX & DESIGN SYSTEM
**Phase 1, Step 19 — Integrated Terminal & Safe Process Execution Foundation**

---

## 1. UI COMPONENTS & LAYOUT

### A. Secondary Bottom Panel Integration
- Integrated cleanly into `SecondaryPanel.tsx` under the **Terminal** tab header alongside **Console / Output** and **Problems**.
- The tab header displays the count of active sessions (e.g. `Terminal (1)`).
- Resizable panel height with a draggable top resizer bar clamped between 120px and 600px.

### B. Terminal View (`TerminalView.tsx`)
- **Top Control Bar:**
  - Session tab buttons with title, status icon, and close button.
  - Action buttons:
    - `+` (New Terminal Session)
    - `Trash2` (Kill Terminal Process)
    - `Ban` (Clear Terminal Display Buffer)
    - `Edit2` (Rename Terminal Tab)
- **Terminal Screen:**
  - High-performance, monospace font (`var(--font-code)`).
  - ANSI color-coded text rendering adhering to dark and light mode tokens.
  - Interactive prompt line with cursor blinking and auto-scroll to bottom.
  - Keyboard history navigation (Arrow Up / Arrow Down to recall past commands).

### C. Status Indicators & Badges
- Lifecycle states displayed with accessible text and icons:
  - **Running:** Active cursor and running status dot (`var(--success)`).
  - **Exited:** Process exited badge showing exit code (e.g. `Exited (0)` or `Exited (1)`).
  - **Failed:** Warning indicator (`var(--error)`) with user-friendly error message.

---

## 2. THEME SUPPORT & ACCESSIBILITY

- **Theme Consistency:** Consumes CSS design tokens (`--bg-panel`, `--text-primary`, `--border-color`, `--accent-primary`).
- **ANSI Color Palette:** Maps standard 16 ANSI colors to theme-safe accessible colors with guaranteed contrast ratios:
  - Black, Red, Green, Yellow, Blue, Magenta, Cyan, White, and high-intensity variants.
- **Keyboard Shortcuts:**
  - `Ctrl+\`` / `Mod+\``: Toggle Terminal Panel.
  - `Ctrl+Shift+\`` / `Mod+Shift+\``: Create New Terminal Session.
  - Arrow Up / Down: Recall command history.
  - `Ctrl+C`: Send interrupt signal.
