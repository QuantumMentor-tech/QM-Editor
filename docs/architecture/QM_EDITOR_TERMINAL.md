# QM EDITOR — INTEGRATED TERMINAL ARCHITECTURE
**Phase 1, Step 19 — Integrated Terminal & Safe Process Execution Foundation**

---

## 1. ARCHITECTURAL OVERVIEW

The **Integrated Terminal Subsystem** introduces a professional, real-time, interactive terminal surface into QM Editor. It allows developers to run command-line tools, build scripts, package managers, and development utilities within the project workspace while preserving application security and architectural integrity.

### Core Architectural Principles:
1. **Strict Process Isolation:** UI components never directly invoke operating system process APIs. All interactions route through `TerminalService` -> `TerminalSession` -> `PtyProcessAdapter`.
2. **Controlled User-Facing Boundary:** The terminal is strictly a human-facing interactive surface. It is **never** an arbitrary execution backdoor for UI components, AI agents, Git subsystems, or plugins.
3. **No Silent Command Execution:** Application features (such as Git, Search, or Language services) cannot silently inject commands or execute background shell scripts via the terminal.
4. **Independent Domain Separation:** `Terminal Buffer` ≠ `Document Model` ≠ `Source Control State`. Terminal output is transient console text and is never treated as editable document buffer or file storage.
5. **Session Lifecycle Management:** Every terminal session has an explicit lifecycle state (`starting`, `running`, `exited`, `failed`, `terminating`, `disposed`) and independent process resources that are cleanly released upon session termination.

---

## 2. SUBSYSTEM ARCHITECTURE & DATA FLOW

```text
┌────────────────────────────────────────────────────────┐
│                        USER                            │
│                         │ (Keyboard input)             │
│                         ▼                              │
│ ┌────────────────────────────────────────────────────┐ │
│ │                  TerminalView UI                   │ │
│ │   - Terminal Tabs & Session Switcher               │ │
│ │   - Interactive Command Prompt & Screen            │ │
│ │   - Real-time ANSI/VT Sequence Renderer            │ │
│ └───────────────────────┬────────────────────────────┘ │
└─────────────────────────┼──────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────┐
│                   TerminalContext                      │
└─────────────────────────┬──────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────┐
│                   TerminalService                      │
│   - Multi-Session Registry & Active Session Focus      │
│   - Bounded Session Limits (Max 8 concurrent)          │
│   - Lifecycle Management & Resource Cleanup            │
└─────────────────────────┬──────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────┐
│                   TerminalSession                      │
│   - Bounded Output Scrollback Buffer (5,000 lines)     │
│   - Session Dimensions & Resize Signaling              │
│   - Command Line History & Navigation                  │
└─────────────────────────┬──────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────┐
│                 PtyProcessAdapter                      │
│   - OS Shell Detection (PowerShell, CMD, Bash, Zsh)   │
│   - Real-time Output Streaming & Line Batching         │
│   - Safe Interactive Execution & Signal Handling       │
└────────────────────────────────────────────────────────┘
```

---

## 3. DOMAIN MODEL & INTERFACES

### `TerminalSessionStatus`
- `starting`: Process is initializing.
- `running`: Interactive shell is running and accepting input.
- `exited`: Process has terminated normally or with exit code.
- `failed`: Process failed to spawn or encountered fatal error.
- `terminating`: Termination signal sent, awaiting process exit.
- `disposed`: Resources, PTY handles, and listeners released.

### `TerminalSessionModel`
```typescript
export interface TerminalSessionModel {
  id: string;
  title: string;
  shell: ShellInfo;
  cwd: string;
  workspaceId?: string;
  status: TerminalSessionStatus;
  dimensions: TerminalDimensions;
  createdAt: number;
  exitCode?: number;
}
```

### `PtyProcessAdapter`
```typescript
export interface PtyProcessAdapter {
  createSession(options: CreateSessionOptions): Promise<void>;
  write(sessionId: string, data: string): Promise<void>;
  resize(sessionId: string, columns: number, rows: number): Promise<void>;
  terminate(sessionId: string): Promise<void>;
  dispose(sessionId: string): Promise<void>;
  onOutput(callback: (sessionId: string, chunk: TerminalOutputChunk) => void): () => void;
  onExit(callback: (sessionId: string, exitCode: number) => void): () => void;
}
```

---

## 4. SHELL DETECTION & WORKING DIRECTORY
1. **Operating System Detection:**
   - **Windows:** Defaults to PowerShell (`powershell.exe`) with Command Prompt (`cmd.exe`) fallback.
   - **macOS:** Defaults to Zsh (`/bin/zsh`) with Bash (`/bin/bash`) fallback.
   - **Linux:** Defaults to Bash (`/bin/bash`) with sh (`/bin/sh`) fallback.
2. **Initial Working Directory:**
   - Defaults to the active workspace folder path (`workspaceRoot.uri` or `workspaceRoot.name`).
   - If no workspace is open, defaults to `~` (user home directory).

---

## 5. STREAMING OUTPUT & SCROLLBACK SAFETY
- **Chunked Output Streaming:** Output chunks are batched and streamed incrementally to prevent UI freezing during large output bursts (e.g. `npm install`, `git log`, build scripts).
- **Bounded Scrollback:** Terminal session buffers are capped at 5,000 lines. Excess lines are safely evicted from memory to prevent memory leaks.
- **ANSI / VT Sequence Formatting:** Supports standard ANSI 16-color codes, bold, underline, clear line, and carriage returns.

---

## 6. SECURITY & PRIVACY
- **Zero Raw Shell Injection:** UI components cannot execute arbitrary commands without explicit user keyboard interaction.
- **No Background Shells:** No invisible or automated background shells exist. All sessions are visible in the terminal tabs list.
- **Local Privacy Guarantee:** Terminal output is never persisted to disk, uploaded to cloud servers, or transmitted to analytics/AI systems.
- **Safe Process Termination:** Closing a terminal tab guarantees full termination of the underlying process and release of event listeners.

---

## 7. FUTURE EXTENSION BOUNDARY
The following capabilities are deliberately **out of scope** for Step 19 and deferred to future dedicated phases:
- Task runner & build profile manager
- Debugger adapters & breakpoints
- AI command generation / auto-fixing
- Remote SSH / Cloud terminal tunneling
- Docker / Container orchestration
