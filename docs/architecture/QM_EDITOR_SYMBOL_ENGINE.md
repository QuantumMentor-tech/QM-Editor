# QM Editor — Symbol Engine Architecture
**Phase 04 — Core Application Engine (Step 41 of 135)**

---

## 1. Executive Summary

The **Symbol Engine** establishes QM Editor's authoritative infrastructure for extracting, storing, caching, querying, and normalizing structured code symbols. Rather than hardcoding language-specific AST parsers or embedding UI state inside data models, the Symbol Engine implements a decoupled, provider-based architecture.

This layer serves as the foundation for:
- Document Outline views
- Document-scoped symbol navigation ("Go to Symbol in Editor" `@`)
- Workspace-scoped symbol search ("Go to Symbol in Workspace" `#`)
- Future language services and LSP providers
- Future AI/SLM code intelligence analyzers

---

## 2. Symbol Model Contracts

### 2.1. Canonical Symbol
```typescript
export interface Symbol {
  id: string;
  name: string;
  kind: SymbolKind;
  location: Location;
  selectionRange?: Range;
  containerName?: string;
  detail?: string;
  tags?: SymbolTag[];
  children?: Symbol[];
  sourceProviderId: string;
  workspaceId?: string;
}
```

Key characteristics:
- **UI-Agnostic**: Contains no CSS classes, icon components, tree expansion state, or selection flags.
- **Hierarchical**: Supports optional recursive `children` arrays without requiring language providers to produce hierarchies.
- **Stable Identity**: Uses deterministic IDs combining provider ID, URI, symbol name, and declaration start line.

### 2.2. Normalized Symbol Kinds
The symbol system normalizes symbols into standardized categories:
`file`, `module`, `namespace`, `package`, `class`, `method`, `property`, `field`, `constructor`, `enum`, `interface`, `function`, `variable`, `constant`, `string`, `number`, `boolean`, `array`, `object`, `key`, `null`, `enumMember`, `struct`, `event`, `operator`, `typeParameter`, `heading`, `type`.

---

## 3. Provider Architecture & Isolation

Producers register with the engine via the `SymbolProvider` interface:

```typescript
export interface SymbolProvider {
  readonly providerId: string;
  readonly displayName?: string;
  readonly capabilities?: SymbolProviderCapabilities;
  provideDocumentSymbols?(
    document: DocumentSymbolInput,
    token?: CancellationToken
  ): Promise<Symbol[] | DocumentSymbol[]>;
  provideWorkspaceSymbols?(
    query: string,
    token?: CancellationToken
  ): Promise<Symbol[] | WorkspaceSymbol[]>;
  dispose?(): void;
}
```

### Provider Isolation Rules
1. **Independent Caches**: Symbol results are keyed by `${uri}:${providerId}`. Evicting or unregistering Provider A never affects Provider B.
2. **Priority-Based Dispatch**: Providers declare capability priorities (`capabilities.priority`). The highest priority capable provider handles document analysis for a matching language.
3. **Built-in Regex Fallback**: A default `BuiltinRegexSymbolProvider` (priority: 10) provides fast out-of-the-box outlining for common languages (TypeScript, JavaScript, Python, Markdown, JSON, Go, Rust, C/C++). Future LSP or compiler providers can register with higher priority (e.g. 100) to transparently override built-in regex without breaking the architecture.

---

## 4. Revision & Generation Lifecycle Safety

### 4.1. Document Content Revision Awareness
Document symbols are inextricably tied to the exact text revision from which they were extracted.
- When `getDocumentSymbols(doc)` is called, the current `document.contentRevision` is recorded.
- If the cache holds an entry for that exact revision, results return synchronously without re-parsing.
- If the document's revision advances while an asynchronous provider is running, the returned result is recognized as stale and rejected.

### 4.2. Workspace Generation Awareness
Workspace symbol queries are bound to the active workspace ID and generation counter. If the user switches workspaces while a background symbol search is running, results destined for the previous workspace are immediately discarded.

---

## 5. Memory Management & Cache Invalidation

The Symbol Engine maintains an in-memory bounded cache. Cache invalidation occurs automatically when:
- A document's content is modified (`contentRevision` changes).
- A document is closed or deleted (`invalidateDocument(uri)`).
- A provider is unregistered (provider-scoped entries purged).
- A workspace is switched (`clearCache()`).
- The application or engine is disposed (`dispose()`).
