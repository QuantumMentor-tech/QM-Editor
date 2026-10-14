/**
 * QM Editor Canonical Language Intelligence & Completion Types
 * Phase 04, Step 42 — Language Intelligence Provider Architecture & Completion Framework
 */

import { Range, Position, Location } from '../navigation/LocationTypes';
import { CancellationToken } from '../symbols/SymbolTypes';

export type LanguageIntelligenceCapability =
  | 'completion'
  | 'hover'
  | 'signatureHelp'
  | 'documentSymbols'
  | 'definition'
  | 'references'
  | 'diagnostics'
  | 'codeActions';

export interface CompletionProviderCapabilities {
  /** Trigger characters that automatically initiate completion (e.g. ['.', ':', '>', '@']) */
  triggerCharacters?: string[];
  /** Whether the provider supports resolving additional details lazily */
  supportsResolveDetails?: boolean;
  /** Custom priority score for ranking (higher = higher precedence, default: 50) */
  priority?: number;
}

export interface HoverProviderCapabilities {
  /** Custom priority score for ranking (higher = higher precedence, default: 50) */
  priority?: number;
}

export interface SignatureHelpProviderCapabilities {
  /** Trigger characters that initiate signature help (e.g. ['(', ',']) */
  triggerCharacters?: string[];
  /** Retrigger characters (e.g. [',', ')']) */
  retriggerCharacters?: string[];
  /** Custom priority score for ranking */
  priority?: number;
}

import {
  CodeAction,
  CodeActionRequest,
  CodeActionProviderCapabilities,
} from './CodeActionTypes';

export interface LanguageIntelligenceCapabilities {
  completion?: CompletionProviderCapabilities;
  hover?: boolean | HoverProviderCapabilities;
  signatureHelp?: boolean | SignatureHelpProviderCapabilities;
  definition?: boolean | Record<string, unknown>;
  codeActions?: boolean | CodeActionProviderCapabilities;
}

/**
 * Normalized Completion Item Categories
 */
export type CompletionItemKind =
  | 'text'
  | 'method'
  | 'function'
  | 'constructor'
  | 'field'
  | 'variable'
  | 'class'
  | 'interface'
  | 'module'
  | 'property'
  | 'keyword'
  | 'snippet'
  | 'constant'
  | 'enum'
  | 'value'
  | 'type'
  | 'file'
  | 'reference';

/**
 * Trigger reason for completion invocation.
 */
export type CompletionTriggerKind =
  | 'invoked' // Explicit manual shortcut (Mod+Space) or command palette
  | 'triggerCharacter' // Typed a declared trigger character (e.g. '.')
  | 'automatic'; // Continuous typing in editor

/**
 * Normalized Completion Request context passed to providers.
 */
export interface CompletionRequest {
  requestId: string;
  documentId: string;
  uri: string;
  languageId: string;
  revision: number;
  position: Position; // 1-based line & column
  offset: number; // 0-based character offset
  triggerKind: CompletionTriggerKind;
  triggerCharacter?: string;
  workspaceId?: string;
  linePrefix?: string; // Text on current line up to cursor
}

/**
 * Canonical Completion Item model.
 */
export interface CompletionItem {
  /** Unique item identifier */
  id: string;
  /** Primary display text */
  label: string;
  /** Normalized semantic kind */
  kind: CompletionItemKind;
  /** Inserted text if different from label */
  insertText?: string;
  /** Optional secondary detail / signature preview */
  detail?: string;
  /** Optional documentation string / markdown */
  documentation?: string;
  /** Optional filter string used for client-side prefix matching */
  filterText?: string;
  /** Optional sort priority string (ASCII sort order) */
  sortText?: string;
  /** Exact replacement range in document coordinates (1-based) */
  range?: Range;
  /** Secondary related edits (e.g. imports) */
  additionalTextEdits?: Array<{
    range: Range;
    newText: string;
  }>;
  /** Identifier of the originating provider */
  providerId?: string;
  /** Priority score derived from provider */
  priority?: number;
}

/**
 * Normalized result from completion providers or coordinator.
 */
export interface CompletionResult {
  items: CompletionItem[];
  isIncomplete?: boolean;
  providerId?: string;
  requestId: string;
  revision: number;
  generation: number;
}

/**
 * ---------------------------------------------------------------------------
 * Hover Request, Content & Result Models (Step 43)
 * ---------------------------------------------------------------------------
 */
export type HoverTriggerKind = 'mouse' | 'keyboard' | 'manual' | 'automatic';

export interface HoverRequest {
  requestId: string;
  workspaceId?: string;
  documentId: string;
  uri: string;
  languageId: string;
  revision: number;
  position: Position; // 1-based line & column
  offset: number;     // 0-based character offset
  triggerKind?: HoverTriggerKind;
}

export type MarkupKind = 'plaintext' | 'markdown';

export interface MarkupContent {
  kind: MarkupKind;
  value: string;
}

export type HoverContentPart =
  | string
  | MarkupContent
  | { language: string; value: string };

export interface HoverResult {
  contents: HoverContentPart[];
  range?: Range;
  location?: Location;
  providerId: string;
  requestId: string;
  generation: number;
  revision: number;
}

/**
 * ---------------------------------------------------------------------------
 * Signature Help Request, Information & Result Models (Step 43)
 * ---------------------------------------------------------------------------
 */
export type SignatureHelpTriggerKind = 'invoked' | 'triggerCharacter' | 'retrigger';

export interface SignatureHelpRequest {
  requestId: string;
  workspaceId?: string;
  documentId: string;
  uri: string;
  languageId: string;
  revision: number;
  position: Position;
  offset: number;
  triggerKind: SignatureHelpTriggerKind;
  triggerCharacter?: string;
  isRetrigger?: boolean;
}

export interface ParameterInformation {
  label: string | [number, number];
  documentation?: string | MarkupContent;
}

export interface SignatureInformation {
  label: string;
  documentation?: string | MarkupContent;
  parameters: ParameterInformation[];
  activeParameter?: number;
}

export interface SignatureHelpResult {
  signatures: SignatureInformation[];
  activeSignature: number;
  activeParameter: number;
  providerId: string;
  requestId: string;
  generation: number;
  revision: number;
}

/**
 * Provider interface for language intelligence (completion, hover, signature help, etc.).
 */
export interface LanguageIntelligenceProvider {
  /** Unique provider identifier (e.g. 'builtin.words', 'lsp.typescript') */
  readonly providerId: string;
  /** Human-readable provider display name */
  readonly displayName?: string;
  /** Supported language IDs (empty array or ['*'] means all languages) */
  readonly supportedLanguages: string[];
  /** Declared provider capabilities */
  readonly capabilities: LanguageIntelligenceCapabilities;
  /** Base priority ranking (higher = higher precedence) */
  readonly priority?: number;

  /**
   * Produces completion items for a given request.
   */
  provideCompletions?(
    request: CompletionRequest,
    token?: CancellationToken
  ): Promise<CompletionResult | CompletionItem[]>;

  /**
   * Resolves additional metadata for a selected completion item (documentation, detail).
   */
  resolveCompletionItem?(
    item: CompletionItem,
    token?: CancellationToken
  ): Promise<CompletionItem>;

  /**
   * Produces contextual hover information for a given request.
   */
  provideHover?(
    request: HoverRequest,
    token?: CancellationToken
  ): Promise<HoverResult | null>;

  /**
   * Produces signature help information for a given function call context.
   */
  provideSignatureHelp?(
    request: SignatureHelpRequest,
    token?: CancellationToken
  ): Promise<SignatureHelpResult | null>;

  /**
   * Produces code actions and quick fixes for a given document range and diagnostics.
   */
  provideCodeActions?(
    request: CodeActionRequest,
    token?: CancellationToken
  ): Promise<CodeAction[]>;

  /**
   * Resolves additional details or edits for a selected code action lazily.
   */
  resolveCodeAction?(
    action: CodeAction,
    token?: CancellationToken
  ): Promise<CodeAction>;

  /**
   * Disposes provider resources.
   */
  dispose?(): void;
}
