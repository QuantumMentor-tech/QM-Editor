# QM Editor — LSP Completion Integration & Architecture

## Phase 06 — Advanced Features (Step 58 of 135)

---

# 1. Executive Summary

Step 58 extends QM Editor's Language Server Protocol (LSP) infrastructure from Steps 56–57 by integrating protocol-level code completions (`textDocument/completion` and `completionItem/resolve`) directly into QM Editor's established Step 42 Language Intelligence architecture.

External language servers supply suggestions and metadata. However, **QM Editor remains strictly authoritative** over:
- Document state and text buffer mutation
- Cursor and selection positions
- Suggestion ranking, deduplication, and display
- Document revision and stale-request protection
- Edit transaction validation, atomic application, and undo/redo history
- Read-only protection and workspace security boundaries

No raw LSP objects or unvalidated text mutations bypass the central `CompletionCoordinator` and `EditorCoordinationService`.

---

# 2. Completion Request & Acceptance Flow

The full request-to-acceptance pipeline is structured as follows:

```text
Editor Cursor / Trigger
        ↓
CompletionCoordinator (Step 42)
        ↓
LanguageIntelligenceRegistry
        ↓
LspProviderAdapter ('lsp.provider', priority 100)
        ↓ Validate Context & Position
LSP Request ('textDocument/completion')
        ↓
Active LspServerSession / LspClient
        ↓
Language Server Process (Stdio / Mock)
        ↓
LSP Completion Response (CompletionList | CompletionItem[])
        ↓ Validate Payload & Defensive Bounds
LspCompletionValidator & LspCompletionMapper
        ↓
Canonical QM Editor CompletionItem[] (1-based coordinates)
        ↓ Merge, Deduplicate & Rank
Editor Suggestion UI Popup
        ↓ User Accepts Item
CompletionCoordinator.applyCompletion()
        ↓ Check Read-Only, Verify Document Revision, Validate Range
ProgrammaticEditTransaction
        ↓
EditorCoordinationService.applyTransaction()
        ↓ Atomic Buffer Update & DocumentEngine Revision Advance
Document Buffer Mutated + Undo/Redo Entry Created + Editor Cursor Positioned
```

---

# 3. Request Context & Trigger Handling

`LspProviderAdapter` evaluates the completion invocation context before dispatching requests:

| Trigger Source | QM Editor Trigger Kind | LSP Protocol Trigger Kind (`context.triggerKind`) | Description |
| :--- | :--- | :--- | :--- |
| Explicit Shortcut | `'invoked'` | `1` (`Invoked`) | User pressed `Ctrl+Space` / `Cmd+Space` or invoked completion via palette. |
| Advertised Trigger | `'triggerCharacter'` | `2` (`TriggerCharacter`) | User typed a character declared in server capabilities (`.` `:` `>` `@` etc.). |
| Automatic Typing | `'automatic'` | `1` or `2` | Normal typing; converted to `2` if typed character matches trigger character list. |

Requests include the 0-based LSP position (`line: qmLine - 1`, `character: qmColumn - 1`) and text document URI derived from canonical resource mappers.

---

# 4. Multi-Provider Coexistence & Priority

QM Editor's `CompletionCoordinator` queries all registered providers concurrently:

```text
CompletionCoordinator
       ├── LspProviderAdapter (Priority: 100)
       └── WordCompletionProvider (Priority: 5)
```

1. **Ranking**: Results are sorted deterministically by provider priority (`100` for LSP vs `5` for fallback word completion), and within identical priorities by `sortText` or `label`.
2. **Deduplication**: When an LSP provider and a built-in provider suggest the same label and insert text, the higher-priority provider's item is retained.
3. **Failure Isolation**: If the language server is down, crashes, or times out, `LspProviderAdapter` catches the error, logs a debug message, and returns an empty list. The editor remains completely responsive and fallback providers continue without interruption.

---

# 5. Stale-Result Protection & Cancellation

Completion is an interactive subsystem with millisecond-scale latency requirements:
- **Active Cancellation**: When a user types while a request is in flight, `CompletionCoordinator` cancels its active `CancellationTokenSource`.
- **Protocol Cancellation**: `LspClient` and `LspRequestManager` transmit `$/cancelRequest` with the corresponding request ID over JSON-RPC.
- **Generation & Revision Validation**: If an obsolete response arrives after the user has typed or switched tabs, the generation counter and document content revision check discard it immediately.

---

# 6. Lazy Item Resolution (`completionItem/resolve`)

For servers declaring `completionProvider.resolveProvider: true`:
- The primary completion list contains lean items (labels, kinds, basic detail).
- When a user highlights or navigates to an item in the suggestion UI, `CompletionCoordinator.resolveCompletionItem()` invokes the adapter.
- The adapter sends `completionItem/resolve` containing the item's raw server payload.
- The server enriches documentation and detail lazily without slowing down the initial suggestion list presentation.
- All resolved documentation is sanitized against malicious markup before being rendered.
