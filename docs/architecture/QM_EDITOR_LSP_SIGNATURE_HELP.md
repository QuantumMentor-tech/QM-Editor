# QM Editor LSP Signature Help Architecture

## Phase 06, Step 59 — LSP Hover, Signature Help & Contextual Documentation Integration

---

## 1. Overview & Architectural Role

LSP Signature Help integration connects external Language Server Protocol servers (`textDocument/signatureHelp`) directly to QM Editor's canonical `SignatureHelpCoordinator` established in Step 43.

Signature help provides parameter hints, active overload navigation, and parameter documentation during function and method call editing.

```text
Editor Trigger (Typed '(', ',', or Ctrl+Shift+Space)
          │
          ▼
SignatureHelpCoordinator (Step 43)
          │
          ▼
LanguageIntelligenceRegistry (Priority 100)
          │
          ▼
LspProviderAdapter (Step 59)
          │
          ├── Settings check: 'lsp.signatureHelp.enabled'
          ├── Session readiness check: 'ready' | 'running'
          ├── Capability check: caps.signatureHelpProvider !== undefined
          ├── Trigger context mapping: 'invoked' | 'triggerCharacter' | 'retrigger'
          │
          ▼
Language Server Process (JSON-RPC 2.0 textDocument/signatureHelp)
          │
          ▼
LspContextValidator (Defensive Bounds & Sanitization)
          │
          ▼
LspContextMapper (Canonical SignatureHelpResult & Parameter mapping)
          │
          ▼
SignatureHelpCoordinator (Stale generation & revision validation)
          │
          ▼
SignatureHelpWidget (Step 43 Accessible UI with parameter highlighting)
```

---

## 2. Protocol Specification (`textDocument/signatureHelp`)

### Request
```typescript
interface LspSignatureHelpParams {
  textDocument: { uri: string };
  position: { line: number; character: number };
  context?: {
    triggerKind: 1 | 2 | 3; // 1: Invoked, 2: TriggerCharacter, 3: ContentChange
    triggerCharacter?: string;
    isRetrigger: boolean;
    activeSignatureHelp?: LspSignatureHelp;
  };
}
```

### Response
```typescript
interface LspSignatureHelp {
  signatures: LspSignatureInformation[];
  activeSignature?: number;
  activeParameter?: number;
}
```

---

## 3. Trigger Context Mapping & Retriggering

- **Invoked (Kind 1):** Manual shortcut trigger (`Ctrl+Shift+Space`) without typed character.
- **TriggerCharacter (Kind 2):** Triggered when user types server-advertised trigger characters (typically `(`, `,`).
- **Retrigger (Kind 3):** Triggered when typing commas or navigating arguments inside an open function call.
- **Coexistence with Completion:** If completion is active, typing `(` dismisses completion and opens signature help cleanly without keyboard conflict.

---

## 4. Parameter Highlighting & Range Labels

Parameters support two canonical representation formats:
1. **String Label:** Plain text parameter name (e.g. `param: string`). The UI matches the substring inside the declaration label and highlights it.
2. **Range Label:** Integer tuple `[start, end]` (e.g. `[12, 25]`). `LspContextValidator` validates that `0 <= start <= end <= label.length`, enabling exact character highlighting.

---

## 5. Bounds Checking & Fallback Safety

`LspContextValidator` guarantees:
- `activeSignature` is clamped to `[0, signatures.length - 1]`.
- `activeParameter` is clamped to `[0, parameters.length - 1]`.
- Pathological overloads are bounded (`MAX_SIGNATURES = 50`, `MAX_PARAMETERS = 100`, `MAX_LABEL_LENGTH = 2000`).
- Documentation strings and markdown descriptions are sanitized through `ContentSanitizer`.
