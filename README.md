# QM Editor (QuantumMentor Editor)

<p align="center">
  <img src="public/QM Editor Logo.png" alt="QM Editor Logo" width="120" />
</p>

<p align="center">
  <strong>A Next-Generation, High-Performance Developer Code Editor</strong><br />
  Built with React, TypeScript, CodeMirror 6, and Vite.
</p>

---

## 🚀 Project Overview

**QM Editor** is a modern, lightweight, keyboard-first desktop-class code editor designed for maximum responsiveness, security, and developer productivity. Built on top of a modular architecture, QM Editor cleanly separates document content buffers, editor view states, location history, session metadata, and physical filesystem storage.

---

## 🌟 Key Features Completed (Phase 01)

### 🎨 1. Core Shell & UI Layout (Steps 1–5)
- **Glassmorphism Theme System:** Sleek Dark (`dark`) and Light (`light`) theme modes powered by CSS variable design tokens.
- **Flexible Layout Shell:** Header navbar, resizable sidebar Explorer, multi-tab editor workspace, bottom console panel, and status bar footer.
- **Overlay Layer System:** Accessible modal dialog infrastructure supporting overlay stacking and z-index ordering.

### 📝 2. Editor Surface & Engine Integration (Steps 6–8)
- **CodeMirror 6 Adapter (`EditorAdapter.ts`):** Direct abstraction layer isolating the UI from underlying editor engine details.
- **Document Workspace Model:** Multi-tab document management, dirty-state indicators, unsaved changes warnings, and tab switching.
- **Central Command System:** Dot-notated command registry (`src/core/commands/CommandRegistry.ts`) with keyboard shortcut routing (`ShortcutManager.ts`).

### 📁 3. File System & File Explorer (Steps 9–10)
- **File System Access API Integration:** Native OS file reading and safe save mechanisms via browser storage handles (`FileService.ts`).
- **Workspace Tree Explorer:** Folder expansion with lazy loading, deterministic sorting (folders first), and async request token protection.

### 🔍 4. Search & Replace Engine (Step 11)
- **Regex & String Matching:** Case-sensitive, whole-word, and regular expression document matching.
- **Atomic Operations:** Find Next/Previous navigation and reverse-offset atomic Replace All operations.

### 🔤 5. Language System & Editor Preferences (Steps 12–13)
- **Language Intelligence:** Auto-detection by file extension and CodeMirror language extensions (TypeScript, JavaScript, HTML, CSS, JSON, Markdown, Python).
- **Editor Productivity Preferences:** Live presentation configuration for font size zooming (`Ctrl+`/`Ctrl-`), word wrapping (`Alt+Z`), line numbers, whitespace rendering, bracket matching, active line highlighting, and code folding.
- **Zero-Dirty Guarantee:** View preferences update presentation live without modifying document text or marking files dirty.

### 📍 6. Navigation, Location History & Session Continuity (Step 14)
- **Go to Line / Column (`Ctrl+G`):** Modal dialog with input validation and line-clamping safety.
- **Location History Stack:** Bounded back (`Alt+Left`) and forward (`Alt+Right`) navigation history.
- **Recent Documents:** Metadata tracking for recently accessed files (`Ctrl+Shift+R`).
- **Lightweight Session Continuity:** Schema-versioned session persistence (`version: 1`) restoring open file tabs and cursor positions safely upon app restart.

### ⚡ 7. Command Palette & Action Discovery (Step 15)
- **Command Palette (`Ctrl+Shift+P`):** Keyboard-first action discovery dialog consuming the central `CommandRegistry`.
- **Fuzzy Search Engine:** Multi-tier deterministic search scoring matching command labels, categories, descriptions, and aliases with text match highlighting.
- **Runtime Revalidation:** Verifies command `canExecute` availability at the moment of execution.

### 🚀 8. Quick Open & Fast Resource Navigation (Step 16)
- **Quick Open (`Ctrl+P`):** Instant workspace file search dialog filtering filename and relative path metadata.
- **Workspace Resource Indexing:** Async in-memory indexing (`WorkspaceIndexService.ts`) skipping excluded directories (`node_modules`, `.git`, `dist`, etc.) with zero full-text content reading overhead.
- **Existing Tab Reuse:** Automatically activates existing open tabs (`activateDoc`) when selected instead of creating duplicate tabs.
- **Explorer Sync:** Automatically reveals and highlights the selected file node in the File Explorer tree.

### 🔍 9. Workspace Content Search & Safe Multi-File Replace (Step 17)
- **Find in Files (`Ctrl+Shift+F`):** Full workspace text content search (`WorkspaceSearchService.ts`) with match line/column previews, match counts, and collapsible file grouping.
- **Advanced Search Options:** Case sensitivity, whole word matching, regular expression evaluation, and glob inclusion/exclusion patterns (`*.ts`, `dist/**`).
- **Performance & Safety Guardrails:** Non-blocking asynchronous batch file scanning (bounded concurrency), 5MB file size limits, binary NUL-byte detection, and request generation ID cancellation protection.
- **Safe Multi-File Replace (`Ctrl+Shift+H`):** Controlled previewable replacement planning (`WorkspaceReplaceService.ts`) requiring explicit user review (`WorkspaceReplaceModal.tsx`).
- **Dirty Tab & Read-Only Protection:** Open dirty files (`isDirty === true`) and read-only targets are flagged and protected from automated batch overwrite, avoiding data loss.

### 🌿 10. Git Integration & Source Control Foundation (Step 18)
- **Source Control Abstraction:** Provider-agnostic abstraction (`SourceControlProvider`, `SourceControlService`, `GitProvider`) for repository detection and working tree status inspection.
- **Source Control View Panel (`Ctrl+Shift+G`):** Sidebar panel listing working tree changes (`M`, `D`), untracked files (`U`), staged changes (`S`), and conflicts (`C`).
- **File Explorer Status Badges:** Visual status decorations next to tree node names in the File Explorer (`FileExplorerTree.tsx`).
- **Status Bar Branch Indicator:** Live branch indicator button in status bar footer showing active branch (e.g. `main` or `HEAD (a1b2c3d)`).
- **Read-Only Diff Inspection:** Line-by-line text comparison viewer (`SourceControlDiffModal.tsx`) with binary file guard protection.

---

## 📋 Phase 01 Progress Roadmap

- [x] **Step 1:** Complete Project Audit & Technical Baseline
- [x] **Step 2:** Technical Architecture & Development Foundation
- [x] **Step 3:** Project Foundation, Scaffolding & Engineering Guardrails
- [x] **Step 4:** Core Application Shell, Layout System & UI Foundation
- [x] **Step 5:** Navigation, Shell State Management & Workspace Interaction
- [x] **Step 6:** Document Workspace Model, Tabs & Editor Surface Foundation
- [x] **Step 7:** Editor Engine Evaluation, Integration Architecture & Core Editing Surface
- [x] **Step 8:** Editor Command System, Keyboard Architecture & Core Editing Actions
- [x] **Step 9:** File System Service, Document I/O & Safe Save Architecture
- [x] **Step 10:** File Explorer, Workspace Tree & Resource Navigation
- [x] **Step 11:** Search & Replace Engine, UI, Commands and Editor Integration
- [x] **Step 12:** Language System, Syntax Highlighting & Editor Language Intelligence Foundation
- [x] **Step 13:** Professional Editor Behavior, Editing Preferences & Productivity Foundation
- [x] **Step 14:** Advanced Editor Navigation, Location History & Session Continuity Foundation
- [x] **Step 15:** Command Palette, Action Discovery & Intelligent Command Execution
- [x] **Step 16:** Quick Open, Workspace File Search & Fast Resource Navigation
- [x] **Step 17:** Workspace Search, Find in Files & Safe Multi-File Replace
- [x] **Step 18:** Git Integration & Source Control Foundation

---

## 🛠️ Technology Stack

- **Framework:** React 18, Vite 6
- **Language:** TypeScript 5.7 (Strict Mode)
- **Editor Engine:** CodeMirror 6 (`@codemirror/state`, `@codemirror/view`, `@codemirror/language`)
- **Iconography:** Lucide React
- **Testing:** Vitest
- **Styling:** Vanilla CSS Tokens (Dark Glassmorphism UI)

---

## 💻 Development & Build Scripts

```bash
# Install dependencies
npm install

# Run local development server
npm run dev

# Run TypeScript type check
npm run type-check

# Run Vitest unit & component test suite
npm test

# Build production bundle
npm run build
```

---

## 🛡️ Architecture & Security Principles

1. **Domain Separation:** `Document Content` ≠ `Editor View State` ≠ `Navigation History` ≠ `Session Metadata` ≠ `Recent Files`. Document text content is **never** persisted in session storage.
2. **Metadata-Only Search:** Quick Open and Command Palette perform string filtering on local metadata. Zero `eval()` or dynamic script execution is performed.
3. **Workspace Scope Boundary:** Quick Open search is strictly bounded inside the active workspace folder. Queries cannot escape the workspace root.
