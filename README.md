# QM Editor (QuantumMentor Editor)

<p align="center">
  <img src="public/QM Editor Logo.png" alt="QM Editor Logo" width="120" />
</p>

<p align="center">
  <strong>A Next-Generation, High-Performance, Keyboard-First Developer Code Editor</strong><br />
  Built with React, TypeScript, CodeMirror 6, and Vite.
</p>

---

## 🚀 Quick Start — How to Run QM Editor

QM Editor can be run easily using **three primary methods** (plus an automated one-click Windows launcher).

### 🛠️ Prerequisites
- **Node.js**: Version 18.0.0 or higher (v20 or v22 LTS recommended). [Download Node.js](https://nodejs.org/)
- **npm**: Version 8.0.0 or higher (included with Node.js).
- **Modern Browser**: Google Chrome, Microsoft Edge, Brave, or Mozilla Firefox.

---

### 🌟 Method 1: One-Click Windows Batch File (`run.bat`) — Easiest for Windows
If you are running on Windows, an automated batch script `run.bat` is included in the project root:

1. **Double-click `run.bat`** in the project folder (or execute `.\run.bat` from Command Prompt / PowerShell).
2. The script will automatically:
   - Verify that Node.js and npm are installed.
   - Check if dependencies (`node_modules`) exist and automatically run `npm install` if missing.
   - Start the Vite development server on `http://localhost:3000`.
   - Automatically launch your default browser to `http://localhost:3000`.

---

### 💻 Method 2: Standard Command Line (Developer Mode) — Recommended for Development
Use this method for active development with instant Hot Module Replacement (HMR):

1. **Open your terminal** (PowerShell, Command Prompt, or Bash) in the project root folder.
2. **Install dependencies** (first time only):
   ```bash
   npm install
   ```
3. **Start the development server**:
   ```bash
   npm run dev
   ```
4. **Open your browser** and navigate to:
   ```
   http://localhost:3000
   ```
   *(If port 3000 is occupied, Vite will assign the next available port, e.g. `http://localhost:5173`)*.

---

### ⚡ Method 3: Production Build & Local Preview — Recommended for Maximum Performance
Use this method to compile the fully optimized, minified bundle and test production performance:

1. **Build the production bundle**:
   ```bash
   npm run build
   ```
   *This runs `tsc` for complete type verification and bundles optimized assets via Vite.*
2. **Preview the production build**:
   ```bash
   npm run preview
   ```
3. **Open your browser** and navigate to the preview URL displayed in your terminal (typically `http://localhost:4173`).

---

### 📦 Method 4 (Alternative): Standalone Static Server
To test the production build using a standalone HTTP server without Vite:

```bash
# Build the project
npm run build

# Serve the static 'dist' directory using npx serve
npx serve dist -l 3000
```
Then navigate to `http://localhost:3000`.

---

## 🌟 App Functions & Core Features

QM Editor provides desktop-class IDE capabilities inside a clean, modern web interface.

```
┌────────────────────────────────────────────────────────────────────────┐
│  Header Bar: Workspace Title | Breadcrumbs | Window Controls           │
├──────┬─────────────────────────────────────────────────────────────────┤
│ A    │ File Tabs: [ App.tsx ● ] [ main.ts ] [ styles.css ]            │
│ C    ├─────────────────────────────────────────────────────────────────┤
│ T    │                                                                 │
│ I    │  CodeMirror 6 Editor Surface                                    │
│ V    │  • Syntax Highlighting & Bracket Matching                       │
│ I    │  • Multi-cursor & Line Numbers                                  │
│ T    │  • LSP Hover, Signatures, Navigation & Rename                   │
│ Y    │                                                                 │
│      ├─────────────────────────────────────────────────────────────────┤
│ B    │ Bottom Console Panel:                                           │
│ A    │ [Problems (2)]  [Terminal]  [Tasks]                             │
│ R    │                                                                 │
├──────┴─────────────────────────────────────────────────────────────────┤
│  Status Bar: Ln 12, Col 8 | UTF-8 | Spaces: 2 | TypeScript | LSP: Ready│
└────────────────────────────────────────────────────────────────────────┘
```

### 1. 🎨 Modern Glassmorphic Shell & Theme System
- **Dark & Light Modes**: Seamless switching between curated high-contrast dark and light themes with CSS custom properties.
- **Collapsible Activity Bar**: Fast navigation between File Explorer, Workspace Search, Source Control, Tasks, and Settings.
- **Multi-Tab Document Workspace**: Visual tab management, dirty file indicators (`●`), tab closing, and unsaved changes confirmation safeguards.
- **Bottom Tool Panels**: Dockable and resizable console hosting Problems/Diagnostics, Terminal, and Output channels.
- **Dynamic Status Bar**: Live coordinates (`Ln X, Col Y`), character encoding (`UTF-8`), line-endings (`LF`/`CRLF`), indentation (`Spaces: 2/4`), language mode, and language server status.

### 2. 📝 High-Performance Code Editor (CodeMirror 6)
- **Multi-Language Syntax Highlighting**: Native syntax support for TypeScript, JavaScript, HTML, CSS, JSON, Markdown, Python, and more.
- **Editor Productivity Features**:
  - Code folding and indentation guides.
  - Bracket pair colorization and auto-closing.
  - Active line highlighting and multiple cursor selections.
  - Quick zoom: `Ctrl+=` to zoom in, `Ctrl+-` to zoom out, `Ctrl+0` to reset.
  - Word wrap toggle: `Alt+Z`.
- **Zero-Dirty Guarantee**: Zooming, theme switching, and presentation preference changes never mark documents as dirty.

### 3. 📁 File System & Workspace Management
- **Native File System Access**: Open local directories and files using the native browser File System Access API with safe OS handles.
- **Recursive Tree Explorer**: Lazy-loaded directory tree with file/folder creation, renaming, deletion, and duplicate detection.
- **Session Continuity**: Automatically restores open tabs, active document, and cursor locations upon restart.
- **Buffer Recovery**: In-memory dirty buffers and unsaved changes are preserved against accidental tab closures or refreshes.

### 4. 🔍 Search & Replace Engine
- **Single Document Find & Replace (`Ctrl+F` / `Ctrl+H`)**:
  - Regular expression matching (`.*`), Match Case (`Aa`), and Whole Word (`\b`).
  - Instant match counts and highlighted occurrences.
- **Cross-Workspace Search (`Ctrl+Shift+F`)**:
  - Multi-threaded workspace indexing filtering files by wildcard include/exclude patterns.
  - Search result tree with expandable match contexts.
- **Atomic Replace All**:
  - Reverse-offset slicing algorithm ensuring text replacements do not invalidate downstream buffer offsets.

### 5. 🧠 Language Server Protocol (LSP) Intelligence (Steps 56–63)
QM Editor features a robust, secure LSP client implementing Language Server Protocol 3.17:

- **Hover Information (`textDocument/hover`)**: Hover over symbols to view rich documentation, type signatures, and docstrings.
- **Signature Help (`textDocument/signatureHelp`)**: Active parameter cues and overload browsing while typing function calls.
- **Code Navigation (`Steps 60`)**:
  - **Go to Definition (`F12` / `Ctrl+Click`)**: Jump directly to symbol definitions across documents.
  - **Go to Declaration**: Locate symbol declarations.
  - **Go to Type Definition**: Navigate to the type model of any variable or parameter.
  - **Find References (`Shift+F12`)**: Search all symbol references across the workspace, grouped by file in an accessible modal.
- **Workspace Symbol Search (`Ctrl+T` or `#` in Quick Open)**:
  - Query functions, classes, interfaces, methods, and constants across the entire workspace via `workspace/symbol`.
- **Safe Symbol Rename (`F2`)**:
  - Two-phase `textDocument/prepareRename` validation.
  - Safe multi-file `WorkspaceEdit` execution through QM Editor's Edit Transaction system with full single-step Undo/Redo (`Ctrl+Z` / `Ctrl+Y`).
- **Code Formatting (`Shift+Alt+F`)**:
  - **Document Formatting (`textDocument/formatting`)**: Automatic whole-file aesthetic alignment according to project indentation and whitespace rules.
  - **Range / Selection Formatting (`textDocument/rangeFormatting`)**: Format highlighted selections without disturbing surrounding code.
  - **Format on Save**: Automatic document formatting before persistence with timeout protection (`editor.formatOnSave`).
  - **Safety & Overlap Validation**: Guaranteed non-overlapping transactional edit application, in-flight stale revision rejection, and read-only protection.
- **Live Diagnostics & Problems Panel**:
  - Real-time syntax errors and warning squiggles updated on buffer changes.
  - Filterable Problems Panel with one-click jump to error coordinates.

### 6. ⚡ Command Palette & Fast Navigation
- **Command Palette (`Ctrl+Shift+P` or `F1`)**: Fuzzy search over 100+ commands with instant shortcut reminders and execution revalidation.
- **Quick Open (`Ctrl+P`)**: Search and jump to any workspace file instantly with metadata indexing.
- **Go to Line / Column (`Ctrl+G`)**: Direct navigation with boundary clamping.
- **Navigation History (`Alt+Left` / `Alt+Right`)**: Jump back and forward through your navigation stack.

### 7. 💻 Terminal & Task System
- **Integrated Terminal**: Built-in terminal panel with shell detection and command history.
- **Task Runner**: Execute and monitor build tasks, test scripts, and background commands.

### 8. 🌿 Source Control (Git Integration)
- **Repository Inspection**: Visual indicator of current branch, unstaged modifications, staged files, and untracked resources.
- **Commit & Diff Workflow**: Stage/unstage changes and inspect side-by-side file diffs.

---

## ⌨️ Essential Keyboard Shortcuts

| Shortcut | Command / Action |
|:---|:---|
| **`Ctrl+P`** | Quick Open (Search and open workspace files) |
| **`Ctrl+Shift+P`** / **`F1`** | Open Command Palette |
| **`Ctrl+S`** | Save Current Document |
| **`Ctrl+Shift+S`** | Save As... |
| **`Shift+Alt+F`** | Format Document (LSP) |
| **`Ctrl+F`** | Find in Document |
| **`Ctrl+H`** | Replace in Document |
| **`Ctrl+Shift+F`** | Search Across Workspace |
| **`Ctrl+G`** | Go to Line / Column |
| **`Ctrl+T`** | Go to Symbol in Workspace |
| **`F2`** | Rename Symbol (LSP) |
| **`F12`** | Go to Definition |
| **`Shift+F12`** | Find All References |
| **`Alt+Left`** | Navigate Back |
| **`Alt+Right`** | Navigate Forward |
| **`Alt+Z`** | Toggle Word Wrap |
| **`Ctrl+=`** / **`Ctrl+-`** | Zoom In / Zoom Out |
| **`Ctrl+0`** | Reset Zoom |
| **`Ctrl+Z`** | Undo |
| **`Ctrl+Y`** / **`Ctrl+Shift+Z`** | Redo |
| **`Ctrl+\``** | Toggle Terminal Panel |
| **`Ctrl+Shift+M`** | Toggle Problems Panel |

*(Note: On macOS, use `Cmd` instead of `Ctrl` and `Option` instead of `Alt`)*.

---

## 🛠️ Available NPM Scripts

| Script | Command | Purpose |
|:---|:---|:---|
| **Development** | `npm run dev` | Launches local Vite development server with HMR on port 3000 |
| **Build** | `npm run build` | Runs TypeScript compilation (`tsc`) and builds production bundle in `dist/` |
| **Preview** | `npm run preview` | Serves the production build locally for verification |
| **Type Check** | `npm run type-check` | Runs `tsc --noEmit` across all workspace files |
| **Tests** | `npm test` | Runs the full Vitest suite (117 test files, 920+ tests) |

---

## 🛡️ Architecture & Security Principles

1. **Domain Separation**: Document Content ≠ Editor View State ≠ Navigation History ≠ Session Metadata. Document text is never leaked into session storage.
2. **Untrusted Language Server Boundary**: All LSP responses (`WorkspaceEdit`, `Location`, `SymbolInformation`) are treated as untrusted. They pass through double-validation (`LspWorkspaceEditValidator` and `CodeActionCoordinator.validateCodeAction()`) before any buffer mutation.
3. **Path Traversal & Scheme Quarantine**: Only `file:`, `untitled:`, and `qm:` resource schemes within the active workspace are allowed. Traversal sequences (`..`), shell commands, and executable URI schemes (`javascript:`, `command:`, `data:`) are strictly blocked.
4. **Zero-Eval Guarantee**: Command discovery, Quick Open, and search filters operate purely on metadata strings with zero dynamic `eval()` or script injection.
5. **Atomic Edit Transactions**: Multi-file transformations are grouped into atomic transactions with reverse-offset application and native undo/redo safety.

---

## 📄 License & Attribution
Developed as part of the QuantumMentor (QM) developer tooling suite.
Built with React 19, TypeScript, CodeMirror 6, Lucide Icons, and Vite.
