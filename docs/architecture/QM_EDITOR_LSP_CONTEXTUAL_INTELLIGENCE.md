# QM Editor LSP Contextual Intelligence Architecture

## Phase 06, Step 59 — LSP Hover, Signature Help & Contextual Documentation Integration

---

## 1. Unified Contextual Intelligence Foundation

QM Editor unifies contextual information across three primary pillars:
1. **LSP Hover (`textDocument/hover`):** Symbol definitions, markdown documentation, type signatures, and source ranges.
2. **LSP Signature Help (`textDocument/signatureHelp`):** Method declarations, active parameter indicators, overloads, and parameter descriptions.
3. **LSP Completion Resolve (`completionItem/resolve`):** Lazy contextual documentation for selected completion suggestions.

All three pillars feed through a **single shared sanitization and rendering pipeline** (`ContentSanitizer.ts`), preventing duplication and guaranteeing uniform security across the application.

```text
       LSP Hover                 LSP Signature Help         LSP Completion Resolve
           │                              │                            │
           ▼                              ▼                            ▼
  LspContextValidator            LspContextValidator          LspCompletionValidator
           │                              │                            │
           └──────────────────────────────┼────────────────────────────┘
                                          │
                                          ▼
                             ContentSanitizer.ts
                    (HTML Stripping, Safe Markdown, Link Filtering)
                                          │
                                          ▼
                                Canonical UI Widgets
                      (HoverWidget, SignatureHelpWidget, SuggestWidget)
```

---

## 2. Inviolable Architectural Boundaries

1. **Read-Only Intelligence:** Contextual language intelligence is strictly observational. Hover and Signature Help never mutate document content, never advance document revision, and never alter dirty state.
2. **No Command Execution:** Any command metadata or actionable URIs embedded in language server responses are treated as untrusted and never executed automatically.
3. **Provider Isolation:** LSP providers are registered with priority 100 in `LanguageIntelligenceRegistry`. If the LSP server crashes, returns an error, or lacks capabilities, built-in word providers or fallback linters continue functioning without interruption.
4. **Interactive Timeouts:** Requests are correlated with monotonic IDs and constrained by `lsp.interactiveTimeoutMs` (default 5,000ms), preventing UI thread starvation on slow remote or local servers.
