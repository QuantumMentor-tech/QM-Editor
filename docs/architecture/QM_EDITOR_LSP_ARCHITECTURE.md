# QM Editor — Language Server Protocol Architecture

**Phase 06 — Advanced Features**  
**Step 56 of 135: Language Server Protocol Foundation, Server Lifecycle & Client Architecture**

---

## 1. Executive Architectural Summary

QM Editor integrates the Language Server Protocol (LSP) strictly as an implementation provider behind the existing Phase 04 language intelligence contracts (`LanguageIntelligenceRegistry`, `LanguageIntelligenceProvider`, `DiagnosticService`, and `DocumentEngine`).

LSP in QM Editor does **not** replace the editor's existing intelligence architecture, nor does it become an authority over document text, document identity, workspace state, or diagnostics persistence.

```
Editor / Document Engine
          │
          ▼
Language Intelligence Registry
          │
          ▼
Provider Routing
          │
          ├──────────────► Native / Built-in Providers (priority 10-50)
          │
          └──────────────► LSP Provider Adapter (priority 100)
                               │
                               ▼
                         LSP Coordinator
                               │
              ┌────────────────┴────────────────┐
              ▼                                 ▼
      LSP Server Manager               LSP Document Sync
              │                                 │
              ▼                                 ▼
      LSP Server Session               LSP Request Manager
              │                                 │
              ▼                                 ▼
         LSP Client                     JSON-RPC Framing
              │
              ▼
     Transport Abstraction (Stdio / Process)
              │
              ▼
    External Language Server (Isolated Subprocess)
```

---

## 2. Structural Layering & Responsibility Boundaries

### What LSP Owns
- External JSON-RPC 2.0 communication framing with language server binaries.
- Session lifecycle negotiation (`initialize`, `initialized`, `shutdown`, `exit`).
- Client capability announcements and server capability parsing.
- Forwarding authoritative document text via standard notifications (`didOpen`, `didChange`, `didSave`, `didClose`).
- Monotonic request/response correlation with timeout enforcement and cancellation tokens.
- Stale response rejection (checking workspace generation, document revision, and model version).
- Mapping external diagnostics (`textDocument/publishDiagnostics`) into the canonical `DiagnosticService`.
- Delegating completion and hover queries through `LspProviderAdapter`.

### What LSP Does NOT Own
- **Document Authority:** The `DocumentEngine` remains the sole single source of truth for text content, revisions, and dirty states.
- **Filesystem Authority:** Language servers cannot directly persist or alter application workspace files.
- **Diagnostics Authority:** Diagnostics flow into `DiagnosticService.createCollection('lsp')`; no second problems model exists.
- **Direct UI Access:** UI components and renderers have no direct access to child processes or raw LSP payloads.
- **Terminal UI:** Language server stdout/stderr streams are isolated and never multiplexed into interactive user terminals.

---

## 3. Core Component Manifest

| Component | Class / Service | File Path | Primary Responsibility |
|---|---|---|---|
| **LSP Coordinator** | `LspCoordinator` | `src/core/lsp/LspCoordinator.ts` | Orchestrates all LSP subsystems and registers providers. |
| **Server Manager** | `LspServerManager` | `src/core/lsp/LspServerManager.ts` | Manages server session creation, reuse, and disposal. |
| **Server Session** | `LspServerSession` | `src/core/lsp/LspServerSession.ts` | Governs the lifecycle state machine of an active server instance. |
| **Server Registry** | `LspServerRegistry` | `src/core/lsp/LspServerRegistry.ts` | Stores approved server configurations and validates commands. |
| **LSP Client** | `LspClient` | `src/core/lsp/LspClient.ts` | Protocol handshake, request/notification dispatch, tracing. |
| **Request Manager** | `LspRequestManager` | `src/core/lsp/LspRequestManager.ts` | Pending request tracking, cancellation, and stale protection. |
| **Document Sync** | `LspDocumentSync` | `src/core/lsp/LspDocumentSync.ts` | Bridges `DocumentEngine` events to LSP sync notifications. |
| **Diagnostics Bridge** | `LspDiagnosticsBridge` | `src/core/lsp/LspDiagnosticsBridge.ts` | Translates 0-based LSP diagnostics to 1-based editor diagnostics. |
| **Provider Adapter** | `LspProviderAdapter` | `src/core/lsp/LspProviderAdapter.ts` | Implements `LanguageIntelligenceProvider` for completion/hover. |
| **URI Mapper** | `LspUriMapper` | `src/core/lsp/LspUriMapper.ts` | Standards-compliant bidirectional file path ↔ URI mapping. |
| **JSON-RPC Framer** | `LspJsonRpc` | `src/core/lsp/LspJsonRpc.ts` | Base protocol framing (`Content-Length`) and streaming parsing. |
| **Transport Layer** | `ILspTransport` | `src/core/lsp/transport/` | Process abstraction (`StdioProcessTransport`, `MockLspTransport`). |

---

## 4. Capability Negotiation & Routing

1. **Client Capabilities:** Announced during `initialize` via `LspClient.getSupportedClientCapabilities()`. False capabilities are never advertised.
2. **Server Capabilities:** Captured from the `initialize` response (`ServerCapabilities`).
3. **Provider Delegation:** `LspProviderAdapter` checks `session.getCapabilities()` before sending requests:
   - Completion queries are skipped if `!capabilities.completionProvider`.
   - Hover queries are skipped if `!capabilities.hoverProvider`.
4. **Fallback Behavior:** If an LSP server does not support a feature or is offline, the query resolves to `null`, allowing lower-priority built-in providers to satisfy the request seamlessly.
