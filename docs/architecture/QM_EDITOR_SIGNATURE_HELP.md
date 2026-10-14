# QM Editor — Signature Help & Parameter Information Architecture

## Phase 04 — Core Application Engine | Step 43

---

## 1. Executive Architectural Summary

The **Signature Help Engine** in QM Editor establishes an asynchronous, provider-driven, revision-aware, and editor-integrated architecture for displaying function signatures, parameter hints, and contextual call documentation while typing.

It extends the Step 42 **Language Intelligence Provider Architecture**, ensuring that language providers can supply rich call signatures without coupling the core editor to specific compiler or LSP implementations.

```
+----------------------------------------------------------------------------------+
|                                    Editor View                                   |
| (Triggered by '(', ',', or manual command Mod+Shift+Space / triggerParameterHints) |
+----------------------------------------------------------------------------------+
                                         |
                                         v
+----------------------------------------------------------------------------------+
|                             SignatureHelpCoordinator                             |
|  - Manages monotonic request generations to prevent stale overwrites             |
|  - Cancels in-flight requests on cursor movement (CancellationTokenSource)       |
|  - Validates document revision, model ID, and workspace boundary                 |
|  - Resolves compatible signature providers from LanguageIntelligenceRegistry     |
|  - Queries providers concurrently within isolated error shields                  |
|  - Selects authoritative result by provider priority descending                  |
|  - Safely clamps activeSignature and activeParameter indices within bounds       |
+----------------------------------------------------------------------------------+
                                         |
                                         v
+----------------------------------------------------------------------------------+
|                                SignatureHelpWidget                               |
|  - Floating accessible overlay positioned directly above/below the call cursor   |
|  - Renders active signature label with bolded/highlighted active parameter       |
|  - Overload navigation (Previous/Next) with keyboard cycling (Up/Down)           |
|  - Shows active parameter documentation sanitized through ContentSanitizer       |
|  - Dismisses automatically on ')', ';', Escape, or document blur                 |
+----------------------------------------------------------------------------------+
```

---

## 2. Core Principles & Design Invariants

1. **Informational & Non-Mutating:** Signature Help provides contextual parameter guidance. It MUST NEVER mutate document content, edit buffers, or push transactions onto the undo/redo stack.
2. **Provider Driven:** The coordinator does not implement language-specific AST parsers. Providers declare signature capabilities, trigger characters, and retrigger characters.
3. **Monotonic Generation Guards:** Each signature request increments a monotonic `requestGeneration`. If a user types additional characters and triggers a newer request, older pending responses are discarded immediately.
4. **Stale Revision Protection:** Results returned from slower asynchronous providers are checked against `documentRevision`. If the document text changed while the provider was computing signatures, the stale result is rejected.
5. **Safe Index Clamping:** Providers may return arbitrary `activeSignature` or `activeParameter` indices. The coordinator validates and safely clamps both indices within valid array bounds `[0, length - 1]` to prevent runtime exceptions or index-out-of-bounds UI glitches.
6. **Provider Isolation:** Provider execution is wrapped in isolated try/catch boundaries. A syntax parsing failure or unhandled exception in one provider never impacts the host editor or other providers.

---

## 3. Data Models & Contracts

### 3.1 `SignatureHelpRequest`
```typescript
export interface SignatureHelpRequest {
  readonly requestId: string;
  readonly workspaceId: string;
  readonly workspaceGeneration: number;
  readonly documentId: string;
  readonly editorModelId: string;
  readonly documentRevision: number;
  readonly position: Position; // 1-based line & column
  readonly languageId: string;
  readonly triggerKind: SignatureHelpTriggerKind; // 'invoked' | 'triggerCharacter' | 'contentChange'
  readonly triggerCharacter?: string;
}
```

### 3.2 `SignatureHelpResult`, `SignatureInformation` & `ParameterInformation`
```typescript
export interface ParameterInformation {
  readonly label: string | [number, number]; // string label or [start, end] offsets in signature label
  readonly documentation?: string | MarkupContent;
}

export interface SignatureInformation {
  readonly label: string;
  readonly documentation?: string | MarkupContent;
  readonly parameters: ParameterInformation[];
  readonly activeParameter?: number;
}

export interface SignatureHelpResult {
  readonly signatures: SignatureInformation[];
  readonly activeSignature: number;
  readonly activeParameter: number;
  readonly providerId: string;
  readonly requestId: string;
  readonly generation: number;
}
```

---

## 4. Trigger & Retrigger Semantics

- **Trigger Characters:** Providers declare characters that naturally initiate signature help, such as `(` or `<` (for generics).
- **Retrigger Characters:** Characters such as `,` advance active parameter tracking within the existing call signature.
- **Auto-Dismissal:** The widget automatically dismisses when the user finishes the call expression by typing `)` or `;`, presses `Escape`, clicks outside, or navigates away.

---

## 5. UI Presentation & Overload Navigation

When a function possesses multiple overloaded signatures:
- The widget displays pagination: `(1 of 3)` with up/down controls (`ChevronUp` / `ChevronDown`).
- The user can cycle overloads via `ArrowUp` and `ArrowDown` keys without moving the editor text cursor.
- The active parameter label is highlighted with high-contrast accent styling.
- Any parameter documentation is rendered safely with `ContentSanitizer`.

---

## 6. Accessibility & Keyboard Controls

- **Screen Reader Support:** Full ARIA role (`role="tooltip"`, `aria-live="polite"`).
- **Non-Intrusive:** Focus remains in the editor text area for uninterrupted typing.
- **Escape Key:** Pressing `Escape` immediately dismisses the signature widget and returns focus strictly to the text cursor.
