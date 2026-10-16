# QM Editor — Language Server Security & Process Isolation

**Phase 06 — Advanced Features**  
**Step 56 of 135: Language Server Protocol Foundation, Server Lifecycle & Client Architecture**

---

## 1. Process Isolation Boundaries

1. **Renderer Isolation:** The renderer UI never directly executes child processes or arbitrary commands.
2. **No Generic Command API:** No generic `execute(commandString)` API is exposed across IPC or to client UI components.
3. **Dedicated Transport Service:** Process spawning is encapsulated inside `StdioProcessTransport` in the application backend/service boundary.
4. **No Terminal Multiplexing:** Stdin and stdout belong strictly to the JSON-RPC framing parser; server output is never piped directly into an interactive user terminal session.

---

## 2. Command & Argument Injection Protection

### Structural Argument Passing
All language servers are spawned with strict `executable + argv[]` separation:
```typescript
const child = spawn(this.command, this.args, {
  shell: false, // Prevents cmd.exe / sh command chaining injection
  stdio: ['pipe', 'pipe', 'pipe'],
});
```

### Server Command Validation (`LspServerRegistry`)
Approved and custom server definitions are validated against command injection:
- Commands containing shell metacharacters (`&`, `|`, `;`, `>`, `<`, `$`, `` ` ``, `\n`, `\r`) are immediately rejected with `LspTrustError`.
- Unquoted spaces in command paths are rejected to prevent path hijacking.

---

## 3. Environment Sanitization & Secret Isolation

1. **Policy Enforcement:** Server definitions configure an `environmentPolicy`:
   - `'inherit'`: Inherits standard non-sensitive OS environment variables (`PATH`, `SYSTEMROOT`, `HOME`, etc.).
   - `'clean'`: Uses a minimal whitelist of required runtime paths.
   - `'custom'`: Explicitly merges approved environment keys without leaking application secret keys.
2. **No Secret Leaks:** Application API keys, user tokens, and internal configurations are excluded from child process environments.

---

## 4. Trace & Logging Safety

- **Safe Defaults:** `lsp.trace` defaults to `'off'`.
- **Payload Redaction:** When set to `'verbose'`, large document buffers (`textDocument.text` > 200 characters) and sensitive configuration values are automatically truncated to `<truncated N chars>`.
- Tracing data is logged solely to the local application diagnostic log and is never transmitted to cloud services or external telemetry.
