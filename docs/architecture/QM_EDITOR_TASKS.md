# QM Editor — Task & Problem Matcher Architecture
## Phase 1, Step 20 — Tasks, Build, Run & Problem Matcher Foundation

---

### 1. Architectural Overview

The Task Subsystem in QM Editor provides structured, project-scoped process management and compiler/linter diagnostics interpretation. Built on top of the Integrated Terminal and safe process execution foundation established in Step 19, the Task subsystem separates user-facing interactive shell sessions from structured, observable development commands.

```text
User / Command Palette / Shortcut (Ctrl+Shift+B)
                     ↓
             TaskContext / React
                     ↓
             TaskService (Singleton)
                     ↓
   ┌─────────────────┴──────────────────┐
   ↓                                    ↓
TaskValidator                     TaskExecutor
(Validation & Cycles)             (Safe Process Execution)
                                        ↓
                                  Process Output
                                        ↓
                                  ProblemParser
                                  ($tsc, $eslint, $general, $dotnet)
                                        ↓
                              Problems / Diagnostics Store
                                        ↓
                              ProblemsPanel / Editor Jump Navigation
```

---

### 2. Core Concepts & Separation of Concerns

1. **Terminal vs. Task Distinction**:
   - **Terminal**: Interactive, open-ended shell session directly controlled by keystrokes.
   - **Task**: Explicit, application-managed process execution with a known command, arguments, working directory, lifecycle state, output streaming, and optional problem matching.
2. **Process Isolation**:
   - Tasks execute through structured adapters (`TaskExecutor`) and cannot be repurposed as an arbitrary process runner by UI components or plugins.
   - Background AI agents, Git commands, and file operations are strictly prohibited from automating or running tasks silently.
3. **Workspace Trust Model**:
   - Every workspace possesses a trust state: `trusted` | `untrusted` | `unknown`.
   - Untrusted workspaces immediately block task executions, requiring explicit developer trust acknowledgment before any external executable runs.

---

### 3. Task Definitions & Lifecycle

```ts
export interface TaskDefinition {
  id: string;
  label: string;
  type: 'build' | 'test' | 'run' | 'lint' | 'package' | 'custom';
  group?: 'build' | 'test' | 'run' | 'none';
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  problemMatcher?: string | string[];
  dependsOn?: string[];
  isDefault?: boolean;
  source: 'workspace' | 'project' | 'detected' | 'builtin' | 'user';
  workspaceId?: string;
}
```

#### Lifecycle State Machine
- `queued`: Awaiting execution.
- `starting`: Initializing process environment and buffers.
- `running`: Actively executing, streaming output chunks, and feeding lines to problem matchers.
- `completed`: Process finished with exit code `0`.
- `failed`: Process terminated with non-zero exit code or encountered runtime failure.
- `cancelling`: User clicked cancel; termination signal dispatched to process handle.
- `cancelled`: Process stopped by user cancellation request.
- `blocked`: Execution prevented due to untrusted workspace state.

---

### 4. Dependency Resolution & Cycle Detection

- Tasks support prerequisite task dependencies via `dependsOn: string[]`.
- `TaskValidator.resolveExecutionOrder()` executes a depth-first search (DFS) with recursion stack tracking.
- If a circular dependency is detected (e.g. `A -> B -> C -> A`), the execution halts before launching any process with an explicit diagnostic:
  `Task dependency cycle detected: A -> B -> C -> A`.
- Dependencies execute in strict topological order; if any prerequisite fails or is cancelled, execution of subsequent tasks in the chain aborts.

---

### 5. Problem Matcher Architecture

The Problem Matcher foundation extracts actionable compiler and linter diagnostics from raw tool output:
- **Registry**: Built-in matchers registered in `ProblemMatcherRegistry`:
  - `$tsc`: TypeScript compiler (parses both `file(line,col): error TS...` and `file:line:col - error TS...`).
  - `$eslint`: ESLint (parses `file:line:col: [error|warning] message [rule]`).
  - `$general`: Standard GCC/Clang/Unix compiler output (`file:line:col: error: message`).
  - `$dotnet`: MSBuild/C# compiler output (`file(line,col): error CS...: message`).
- **Safety Protections**:
  - Max line length capped at 2,048 characters to eliminate catastrophic regex backtracking.
  - ANSI color sequences stripped prior to matching.
  - Safe deduplication per `taskId:file:line:column:code:message`.
  - Max 1,000 diagnostics per task session to avoid memory overflow.
  - Stale diagnostics automatically cleared when a task is rerun.

---

### 6. Navigation Integration

When a user clicks a diagnostic in the Problems panel:
1. `workspaceContext.openFilePath(problem.file)` opens or activates the target file.
2. An event `qm:editor:gotoline` is dispatched with `{ line: problem.line, column: problem.column }`.
3. The editor adapter positions the cursor and scrolls the view to reveal the exact line and column.

---

### 7. Security, Privacy & Compliance

- **Zero Silent Automation**: Tasks can only be launched by direct user intent (button click, Command Palette, or dedicated shortcut).
- **No Secret Logging**: Environment variables are never dumped to persistent storage or unredacted console logs.
- **Diagnostics Isolation**: Diagnostics remain in transient memory and are never transmitted to external analytics or telemetry services.
