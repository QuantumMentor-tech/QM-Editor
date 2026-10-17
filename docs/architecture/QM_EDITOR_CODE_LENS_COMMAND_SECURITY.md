# QM Editor — Code Lens Command Security & Validation Boundary
**Phase 06, Step 66 — LSP Code Lens, Inline Actions & Safe Command Integration**

---

## 1. Threat Model & Security Boundaries

Language Server Protocol implementations represent an untrusted external process communicating via JSON-RPC. A compromised or hostile language server might attempt:

1. **Remote Code Execution (RCE)**: Returning command IDs such as `shell.exec`, `terminal.run`, or `process.spawn` containing arbitrary shell strings.
2. **Arbitrary IPC & Eval**: Injecting `eval(...)`, `javascript:...`, or unknown internal handler IDs.
3. **Path Traversal & Filesystem Abuse**: Supplying hostile path arguments (e.g. `../../etc/passwd` or `C:\Windows\System32`) to file commands.
4. **Denial of Service (DoS)**: Delivering megabyte-sized argument structures, deeply nested JSON trees, or millions of lens entries.

QM Editor enforces strict isolation: **an LSP server is an informational provider, never a privileged execution agent**.

---

## 2. Command Allowlist & Registry Verification

Before any Code Lens action can execute, it must pass validation in `LspCodeLensSecurityValidator.validateCommand()`:

1. **Dangerous Pattern Prohibition**:
   The command identifier is checked against regexes prohibiting hazardous terms:
   - `/shell/i`, `/terminal/i`, `/exec/i`, `/eval/i`
   - `/cmd(\.exe)?/i`, `/powershell/i`, `/bash/i`, `/\bsh\b/i`
   - `/rm\s+-/i`, `/unlink/i`, `/javascript:/i`
   Any match results in immediate rejection.
2. **Approved Command Allowlist**:
   A verified set of safe IDE commands is permit-listed by default:
   - `editor.showReferences` / `editor.action.showReferences`
   - `editor.goToImplementation`
   - `editor.action.peekDefinition`
   - `tasks.runTest` / `tasks.debugTest`
3. **CommandRegistry Validation**:
   Any command outside the allowlist must exist in `globalCommandRegistry`. Unregistered command IDs are never executed.

---

## 3. Argument Sanitization & Size Constraints

LSP command arguments are untrusted payloads validated according to these strict rules:

- **Argument Count**: At most `MAX_ARGUMENTS = 10`.
- **String Length**: Primitive strings are bounded to `MAX_ARG_STRING_LENGTH = 1,024` characters.
- **Path Traversal Defense**: Arguments containing `..` or null bytes `\0` are rejected immediately.
- **Primitive Allowlist**: Only strings, numbers, booleans, and shallow objects representing positions/URIs are permitted. Functions, buffers, or complex prototypes are dropped.
- **Deep Nesting Limit**: Argument object traversal is bounded to depth 3 and serialized length ≤ 8,192 bytes.

---

## 4. Execution Workflow

```text
User Clicks / Activates Code Lens
               │
               ▼
LspCodeLensCoordinator.executeLens(lensId)
               │
               ▼ (verify lens & document exist)
Lazy Resolution (if command not yet resolved)
               │
               ▼
LspCodeLensSecurityValidator.validateCommand(command, commandRegistry)
               │
       ┌───────┴───────┐
    Invalid         Valid
       │               │
       ▼               ▼
Feedback Warning    Is Reference Navigation?
& Block Action         │
                 ┌─────┴─────┐
                Yes          No
                 │           │
                 ▼           ▼
       NavigationCoordinator CommandRegistry.execute(cmd, ctx)
```

No external shell, process, or file mutation can be triggered without routing through the vetted, confirmation-guarded QM Editor command infrastructure.
