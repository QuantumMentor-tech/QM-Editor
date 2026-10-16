# QM Editor — Language Server Lifecycle & Session Management

**Phase 06 — Advanced Features**  
**Step 56 of 135: Language Server Protocol Foundation, Server Lifecycle & Client Architecture**

---

## 1. Lifecycle State Machine

Each language server instance is encapsulated in an `LspServerSession`. The session strictly adheres to a deterministic finite state machine:

```
[created]
    │
    ▼ (start)
[starting]
    │
    ▼ (transport active)
[initializing]
    │
    ▼ (handshake complete)
  [ready]
    │
    ▼
 [running] ──► (stop) ──► [stopping] ──► [stopped]
    │                                        │
    ▼ (crash / exit)                         ▼ (restart)
 [crashed] ──────────────────────────► [starting]
    │
    ▼ (dispose)
[disposed] (terminal state)
```

### Valid Transition Table
- **created:** `starting`, `disposed`
- **starting:** `initializing`, `crashed`, `stopped`, `disposed`
- **initializing:** `ready`, `crashed`, `stopping`, `stopped`, `disposed`
- **ready:** `running`, `stopping`, `crashed`, `stopped`, `disposed`
- **running:** `stopping`, `crashed`, `stopped`, `disposed`
- **stopping:** `stopped`, `crashed`, `disposed`
- **stopped:** `starting`, `disposed`
- **crashed:** `starting`, `disposed`
- **disposed:** *terminal* (cannot transition out)

Attempting an invalid transition throws `LspLifecycleError`.

---

## 2. Server Discovery & Identity

### Session Identity
A server session is uniquely and canonically identified by:
```
sessionId = `${serverDefinitionId}::${workspaceId}`
```
This guarantees that:
- Sessions are never shared across incompatible workspaces.
- Duplicate server processes are never spawned for multiple files within the same workspace and language.

### Server Definition Model (`LspServerDefinition`)
```typescript
export interface LspServerDefinition {
  serverDefinitionId: string;
  displayName: string;
  languageIds: string[];
  fileExtensions: string[];
  command: string;
  args?: string[];
  transport: LspTransportType;
  environmentPolicy?: 'inherit' | 'clean' | 'custom';
  environmentVariables?: Record<string, string>;
  workspaceMode?: 'singleRoot' | 'multiRoot';
  initializationOptions?: Record<string, unknown>;
  enabled?: boolean;
}
```

---

## 3. Crash Loop Protection

To prevent runaway CPU consumption or endless restart loops:
1. **Windowed Tracking:** Crash counts are recorded with timestamps.
2. **Threshold:** If a session crashes more than 3 times within 60 seconds (`maxCrashCount = 3`, `crashWindowMs = 60000`), automatic restart is permanently suppressed and status transitions to `crashed`.
3. **Manual Override:** Invoking `session.restart()` or the `languageServer.restart` command resets the crash counter and forces a fresh launch attempt.

---

## 4. Controlled Shutdown & Disposal Sequence

1. **Stop Incoming Requests:** Session rejects new requests; interactive requests in flight are cancelled.
2. **Protocol Shutdown:** Client sends the standard JSON-RPC `shutdown` request and awaits confirmation (capped by a 1000ms safety timeout).
3. **Exit Notification:** Client transmits the `exit` notification to notify the server process to cleanly exit.
4. **Transport Teardown:** Stdin/stdout streams are unpiped, process handles are closed, and `kill()` is invoked if the process does not terminate within the grace period.
5. **Collection Cleanup:** Document tracking sets are cleared and diagnostics published by this session are safely unmapped.
