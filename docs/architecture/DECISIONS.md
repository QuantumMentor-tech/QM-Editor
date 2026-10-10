# QM EDITOR — ARCHITECTURE DECISION RECORDS (ADR)

---

## ADR 001: Selection of React + Vite + TypeScript as Core Framework Stack

**Date:** October 10, 2026  
**Status:** Approved  

### Context
QM Editor required a modern, performant, type-safe, and modular web/desktop framework foundation to support rich text and code editing, fast live reloading, and responsive UI components.

### Problem
Starting from an empty baseline requires picking a technology stack that is lightweight, highly maintainable, type-safe, and free from excessive build configuration overhead.

### Options Considered
1. **Plain Vanilla JS:** Lightweight, but lacks structured component state management for a complex multi-tab editor.
2. **React + Vite + TypeScript:** High performance, instant HMR, strong ecosystem, strict compile-time type checking, component modularity.
3. **Next.js SSR:** Overkill for a client-side document/code editor application; adds unnecessary server overhead.

### Decision
Adopt **React 19 + Vite 6 + TypeScript 5**.

### Consequences & Compatibility Impact
- Instant development server startup and build times.
- Type safety across document models, workspace state, and UI props.
- Compatible with all target environments (Browser and future Electron/desktop wrappers).

---

## ADR 002: Vanilla CSS with Design System Tokens over External Framework Overhead

**Date:** October 10, 2026  
**Status:** Approved  

### Context
The application interface requires high performance, custom dark/light theme tokens, fluid animations, and tight layout control.

### Decision
Use **Vanilla CSS with native CSS variables** defined in `src/index.css`.

### Reason & Benefits
- Zero runtime CSS-in-JS parsing overhead.
- Total control over layout spacing, scrollbar styling, editor selection highlighting, and theme switches.
- Easy integration of branding assets (`QM Editor Logo.png`).

---

## ADR 003: Unsaved Data Protection and Local Storage Auto-Draft Architecture

**Date:** October 10, 2026  
**Status:** Approved  

### Context
Users working with document editors risk data loss during accidental navigation, browser tab closure, or unexpected system reboots.

### Decision
Implement a dual-tier protection strategy:
1. Active dirty tracking on document instances (`isDirty` flag).
2. Asynchronous auto-draft persistence in local storage every 5 seconds for dirty documents.

### Impact
Protects user content without blocking the main UI rendering thread.
