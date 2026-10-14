# QM Editor — Language Intelligence Architecture
**Phase 04 — Core Application Engine (Step 42 of 135)**

---

## 1. Executive Summary

The **Language Intelligence Architecture** establishes QM Editor's authoritative framework for registering, managing, querying, and isolating language intelligence providers. It provides a decoupled, modular foundation through which language services, local parsers, fallback word completers, and future LSP (Language Server Protocol) or AI/SLM components provide intelligence to the editor without hardwiring the editor core to any specific engine.

The architecture strictly enforces:
- **Provider Boundary**: Language intelligence components generate data suggestions; they never mutate the editor model directly.
- **Provider Isolation**: Failures in one provider cannot compromise or crash other providers or the editor host.
- **Revision & Generation Awareness**: Every intelligence query carries request IDs, document revisions, and workspace generation tags to discard stale results.
- **Cancellation**: Full cooperative cancellation via `CancellationToken` ensures typing or navigation immediately aborts in-flight work.

---

## 2. Architecture Overview

```text
Editor Surface
      │
      ▼
Completion Coordinator
      │
      ▼
Language Intelligence Registry
      │
      ├──────────────────┬──────────────────┐
      ▼                  ▼                  ▼
Word Fallback      Language Provider    Future LSP Provider
      │                  │                  │
      └──────────────────┴──────────────────┘
                         │
                         ▼
             Normalized Intelligence Result
                         │
                         ▼
             Deduplication & Ranking
                         │
                         ▼
             Suggest Widget / UI Adapter
                         │
                         ▼
               Accepted Completion
                         │
                         ▼
                 Edit Transaction
                         │
                         ▼
                  Document Engine
```

---

## 3. Provider Contracts & Capabilities

Producers register with the centralized `LanguageIntelligenceRegistry` via the `LanguageIntelligenceProvider` interface:

```typescript
export interface LanguageIntelligenceProvider {
  readonly providerId: string;
  readonly displayName?: string;
  readonly supportedLanguages: string[]; // ['*'] for all languages
  readonly capabilities: LanguageIntelligenceCapabilities;
  readonly priority?: number; // Base priority score (default: 50)
  provideCompletions?(
    request: CompletionRequest,
    token?: CancellationToken
  ): Promise<CompletionResult | CompletionItem[]>;
  resolveCompletionItem?(
    item: CompletionItem,
    token?: CancellationToken
  ): Promise<CompletionItem>;
  dispose?(): void;
}
```

### 3.1. Capability Declaration
Providers declare capability flags:
- `completion`: Trigger characters (e.g. `['.', ':', '>', '@']`), lazy detail resolution, and provider priority.
- `hover`: Future hover tooltip documentation.
- `signatureHelp`: Future parameter hint support.
- `definition`: Future jump-to-definition integration.

---

## 4. Provider Lifecycle & Registry

The `LanguageIntelligenceRegistry` acts as the single source of truth for provider lifecycles:
1. **Registration**: Validates non-empty string `providerId`, disallows duplicates, and records supported languages and capabilities.
2. **Deterministic Querying**: Providers are retrieved filtered by language (supporting explicit IDs, lowercase matching, or wildcard `'*'`) and capability. Providers are sorted deterministically by priority descending, then alphabetically by provider ID.
3. **Disposal**: When unregistering or disposing the registry, providers receive safe `dispose()` lifecycle invocations wrapped in exception shields.

---

## 5. Request Lifecycle, Stale Protection & Cancellation

1. **Request Creation**:
   A monotonic `currentGeneration` and unique `requestId` are assigned. The active document's `contentRevision`, cursor line prefix, character offset, and current `workspaceId` are recorded.
2. **Cooperative Cancellation**:
   Any new request automatically cancels the previous in-flight request's `CancellationTokenSource`.
3. **Stale Generation & Revision Validation**:
   When provider promises settle, results are discarded if:
   - Cancellation was requested.
   - The coordinator generation has advanced.
   - The active workspace switched during request processing.
   - The document's `contentRevision` advanced (e.g. user typed another character).

---

## 6. Future LSP & External Engine Compatibility

The provider boundary is designed for seamless future LSP integration:
- An LSP Client will implement `LanguageIntelligenceProvider` with `providerId: 'lsp.<language>'`.
- LSP trigger characters map directly to `CompletionProviderCapabilities.triggerCharacters`.
- Cancellation tokens map directly to JSON-RPC `$/cancelRequest`.
- LSP Completion Items map directly to QM Editor's canonical `CompletionItem` without exposing raw protocol types.
