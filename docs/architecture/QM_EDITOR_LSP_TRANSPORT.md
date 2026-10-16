# QM Editor — Language Server Transport & JSON-RPC Layer

**Phase 06 — Advanced Features**  
**Step 56 of 135: Language Server Protocol Foundation, Server Lifecycle & Client Architecture**

---

## 1. Transport Abstraction (`ILspTransport`)

The transport layer abstracts low-level I/O from protocol logic:

```typescript
export interface ILspTransport {
  start(): Promise<void>;
  send(message: string): Promise<void>;
  onMessage(listener: (message: string) => void): () => void;
  onError(listener: (error: Error) => void): () => void;
  onClose(listener: (exitCode?: number) => void): () => void;
  close(): Promise<void>;
  isAlive(): boolean;
}
```

Implementations include:
- `StdioProcessTransport`: Spawns native Node/OS child processes with direct stdin/stdout piping.
- `MockLspTransport`: In-memory transport double for deterministic unit and integration tests.

---

## 2. Base Protocol Framing (`LspJsonRpc`)

LSP uses HTTP-like header framing over UTF-8 encoded text streams:

```
Content-Length: 124\r\n
\r\n
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{...}}
```

### Framing & Parsing Features
1. **Streaming Chunk Reassembly:** Accumulates partial byte chunks until full headers and payloads arrive.
2. **Multibyte UTF-8 Character Safety:** Computes payload size using `Buffer.byteLength(content, 'utf-8')` (character length does not equal byte length).
3. **Malformed Message Tolerance:** Discards invalid headers or truncated bodies without crashing the parser or throwing uncaught errors.
4. **Out-of-Order Message Dispatch:** Correlates responses strictly by `message.id` rather than arrival sequence.

---

## 3. Request Correlation & Timeout Categories (`LspRequestManager`)

Requests are categorized into distinct timeout budgets:
- **Interactive:** 5,000 ms (`textDocument/completion`, `textDocument/hover`, `textDocument/signatureHelp`)
- **Background:** 15,000 ms (symbols, folding, code actions)
- **Initialization:** 10,000 ms (`initialize`)
- **Shutdown:** 3,000 ms (`shutdown`)

### Cancellation & Unhandled Rejection Safety
When a request times out, is cancelled via a `CancellationToken`, or the manager is disposed:
- Protocol cancellation notification `$/cancelRequest` is sent to the server.
- The pending promise is safely rejected with `LspTimeoutError`, `LspCancelledError`, or `LspDisposedError`.
- Promise handles are shielded with `.catch(() => {})` internally to eliminate unhandled rejection crashes.
