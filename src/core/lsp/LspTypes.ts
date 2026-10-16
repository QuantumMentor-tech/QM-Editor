/**
 * QM Editor Canonical Language Server Protocol (LSP) Types & Contracts
 * Phase 06, Step 56 — Language Server Protocol Foundation, Server Lifecycle & Client Architecture
 */

// =============================================================================
// 1. JSON-RPC 2.0 Protocol Specifications
// =============================================================================

export type RequestId = number | string;

export interface RequestMessage {
  readonly jsonrpc: '2.0';
  readonly id: RequestId;
  readonly method: string;
  readonly params?: unknown;
}

export interface ResponseError<T = unknown> {
  readonly code: number;
  readonly message: string;
  readonly data?: T;
}

export interface ResponseMessage<T = unknown> {
  readonly jsonrpc: '2.0';
  readonly id: RequestId | null;
  readonly result?: T;
  readonly error?: ResponseError;
}

export interface NotificationMessage {
  readonly jsonrpc: '2.0';
  readonly method: string;
  readonly params?: unknown;
}

export type JsonRpcMessage = RequestMessage | ResponseMessage | NotificationMessage;

export const LspErrorCodes = {
  // Defined by JSON-RPC
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
  ServerNotInitialized: -32002,
  UnknownErrorCode: -32001,

  // Defined by the protocol
  RequestFailed: -32803,
  ServerCancelled: -32802,
  ContentModified: -32801,
  RequestCancelled: -32800,
} as const;

// =============================================================================
// 2. LSP Initialization & Capabilities
// =============================================================================

export interface ClientCapabilities {
  workspace?: {
    applyEdit?: boolean;
    workspaceEdit?: {
      documentChanges?: boolean;
      resourceOperations?: ('create' | 'rename' | 'delete')[];
      failureHandling?: 'abort' | 'transactional' | 'undo' | 'textOnlyTransactional';
    };
    didChangeConfiguration?: {
      dynamicRegistration?: boolean;
    };
    symbol?: {
      dynamicRegistration?: boolean;
      symbolKind?: {
        valueSet?: number[];
      };
      tagSupport?: {
        valueSet?: number[];
      };
    };
    workspaceFolders?: boolean;
  };
  textDocument?: {
    synchronization?: {
      dynamicRegistration?: boolean;
      willSave?: boolean;
      willSaveWaitUntil?: boolean;
      didSave?: boolean;
    };
    completion?: {
      dynamicRegistration?: boolean;
      completionItem?: {
        snippetSupport?: boolean;
        commitCharactersSupport?: boolean;
        documentationFormat?: ('plaintext' | 'markdown')[];
        deprecatedSupport?: boolean;
        preselectSupport?: boolean;
      };
    };
    hover?: {
      dynamicRegistration?: boolean;
      contentFormat?: ('plaintext' | 'markdown')[];
    };
    signatureHelp?: {
      dynamicRegistration?: boolean;
      signatureInformation?: {
        documentationFormat?: ('plaintext' | 'markdown')[];
      };
    };
    definition?: {
      dynamicRegistration?: boolean;
      linkSupport?: boolean;
    };
    declaration?: {
      dynamicRegistration?: boolean;
      linkSupport?: boolean;
    };
    typeDefinition?: {
      dynamicRegistration?: boolean;
      linkSupport?: boolean;
    };
    references?: {
      dynamicRegistration?: boolean;
    };
    documentSymbol?: {
      dynamicRegistration?: boolean;
      hierarchicalDocumentSymbolSupport?: boolean;
    };
    codeAction?: {
      dynamicRegistration?: boolean;
      codeActionLiteralSupport?: {
        codeActionKind?: {
          valueSet?: string[];
        };
      };
    };
    rename?: {
      dynamicRegistration?: boolean;
      prepareSupport?: boolean;
    };
    formatting?: {
      dynamicRegistration?: boolean;
    };
    rangeFormatting?: {
      dynamicRegistration?: boolean;
    };
    publishDiagnostics?: {
      relatedInformation?: boolean;
      tagSupport?: {
        valueSet?: number[];
      };
      versionSupport?: boolean;
    };
  };
  window?: {
    workDoneProgress?: boolean;
    showMessage?: boolean;
  };
  general?: {
    positionEncodings?: ('utf-8' | 'utf-16' | 'utf-32')[];
  };
}

export type TextDocumentSyncKind = 0 | 1 | 2; // 0: None, 1: Full, 2: Incremental

export interface TextDocumentSyncOptions {
  openClose?: boolean;
  change?: TextDocumentSyncKind;
  willSave?: boolean;
  willSaveWaitUntil?: boolean;
  save?: boolean | { includeText?: boolean };
}

export interface ServerCapabilities {
  positionEncoding?: 'utf-8' | 'utf-16' | 'utf-32';
  textDocumentSync?: TextDocumentSyncKind | TextDocumentSyncOptions;
  completionProvider?: {
    resolveProvider?: boolean;
    triggerCharacters?: string[];
    allCommitCharacters?: string[];
  };
  hoverProvider?: boolean | { workDoneProgress?: boolean };
  signatureHelpProvider?: {
    triggerCharacters?: string[];
    retriggerCharacters?: string[];
  };
  definitionProvider?: boolean | { workDoneProgress?: boolean };
  declarationProvider?: boolean | { workDoneProgress?: boolean };
  typeDefinitionProvider?: boolean | { workDoneProgress?: boolean };
  referencesProvider?: boolean | { workDoneProgress?: boolean };
  documentHighlightProvider?: boolean | { workDoneProgress?: boolean };
  documentSymbolProvider?: boolean | { workDoneProgress?: boolean };
  codeActionProvider?: boolean | { codeActionKinds?: string[] };
  documentFormattingProvider?: boolean | { workDoneProgress?: boolean };
  documentRangeFormattingProvider?: boolean | { workDoneProgress?: boolean };
  renameProvider?: boolean | { prepareProvider?: boolean };
  workspaceSymbolProvider?: boolean | { workDoneProgress?: boolean };
  executeCommandProvider?: { commands: string[] };
  workspace?: {
    workspaceFolders?: {
      supported?: boolean;
      changeNotifications?: string | boolean;
    };
  };
}

export interface WorkspaceFolder {
  uri: string;
  name: string;
}

export interface InitializeParams {
  processId: number | null;
  clientInfo?: {
    name: string;
    version?: string;
  };
  rootPath?: string | null;
  rootUri: string | null;
  capabilities: ClientCapabilities;
  initializationOptions?: unknown;
  workspaceFolders?: WorkspaceFolder[] | null;
  trace?: 'off' | 'messages' | 'verbose';
}

export interface InitializeResult {
  capabilities: ServerCapabilities;
  serverInfo?: {
    name: string;
    version?: string;
  };
}

export interface InitializedParams {}

// =============================================================================
// 3. Document Synchronization Protocols
// =============================================================================

export interface TextDocumentItem {
  uri: string;
  languageId: string;
  version: number;
  text: string;
}

export interface TextDocumentIdentifier {
  uri: string;
}

export interface VersionedTextDocumentIdentifier extends TextDocumentIdentifier {
  version: number;
}

export interface DidOpenTextDocumentParams {
  textDocument: TextDocumentItem;
}

export interface TextDocumentContentChangeEvent {
  range?: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  rangeLength?: number;
  text: string;
}

export interface DidChangeTextDocumentParams {
  textDocument: VersionedTextDocumentIdentifier;
  contentChanges: TextDocumentContentChangeEvent[];
}

export interface DidSaveTextDocumentParams {
  textDocument: TextDocumentIdentifier;
  text?: string;
}

export interface DidCloseTextDocumentParams {
  textDocument: TextDocumentIdentifier;
}

// =============================================================================
// 4. Diagnostics & Notification Protocols
// =============================================================================

export interface LspPosition {
  line: number; // 0-based
  character: number; // 0-based
}

export interface LspRange {
  start: LspPosition;
  end: LspPosition;
}

export type LspDiagnosticSeverity = 1 | 2 | 3 | 4; // 1: Error, 2: Warning, 3: Info, 4: Hint

export interface LspDiagnosticRelatedInformation {
  location: {
    uri: string;
    range: LspRange;
  };
  message: string;
}

export interface LspDiagnostic {
  range: LspRange;
  severity?: LspDiagnosticSeverity;
  code?: number | string;
  codeDescription?: { href: string };
  source?: string;
  message: string;
  tags?: number[];
  relatedInformation?: LspDiagnosticRelatedInformation[];
  data?: unknown;
}

export interface PublishDiagnosticsParams {
  uri: string;
  version?: number;
  diagnostics: LspDiagnostic[];
}

export interface LspDiagnosticSessionContext {
  sessionId: string;
  serverDefinitionId: string;
  displayName: string;
  workspaceId: string;
  generation: number;
  sessionState: ServerSessionState;
}

// =============================================================================
// 5. Completion Protocols
// =============================================================================

export type LspCompletionTriggerKind = 1 | 2 | 3; // 1: Invoked, 2: TriggerCharacter, 3: TriggerForIncompleteCompletions

export interface LspCompletionContext {
  triggerKind: LspCompletionTriggerKind;
  triggerCharacter?: string;
}

export interface LspCompletionParams {
  textDocument: TextDocumentIdentifier;
  position: LspPosition;
  context?: LspCompletionContext;
}

export type LspCompletionItemKind =
  | 1  // Text
  | 2  // Method
  | 3  // Function
  | 4  // Constructor
  | 5  // Field
  | 6  // Variable
  | 7  // Class
  | 8  // Interface
  | 9  // Module
  | 10 // Property
  | 11 // Unit
  | 12 // Value
  | 13 // Enum
  | 14 // Keyword
  | 15 // Snippet
  | 16 // Color
  | 17 // File
  | 18 // Reference
  | 19 // Folder
  | 20 // EnumMember
  | 21 // Constant
  | 22 // Struct
  | 23 // Event
  | 24 // Operator
  | 25; // TypeParameter

export type LspInsertTextFormat = 1 | 2; // 1: PlainText, 2: Snippet

export type LspCompletionItemTag = 1; // 1: Deprecated

export interface LspTextEdit {
  range: LspRange;
  newText: string;
}

export interface LspInsertReplaceEdit {
  newText: string;
  insert: LspRange;
  replace: LspRange;
}

export interface LspCompletionItemLabelDetails {
  detail?: string;
  description?: string;
}

export interface LspCompletionItem {
  label: string;
  labelDetails?: LspCompletionItemLabelDetails;
  kind?: LspCompletionItemKind;
  tags?: LspCompletionItemTag[];
  detail?: string;
  documentation?: string | { kind: 'plaintext' | 'markdown'; value: string };
  deprecated?: boolean;
  preselect?: boolean;
  sortText?: string;
  filterText?: string;
  insertText?: string;
  insertTextFormat?: LspInsertTextFormat;
  textEdit?: LspTextEdit | LspInsertReplaceEdit;
  additionalTextEdits?: LspTextEdit[];
  commitCharacters?: string[];
  command?: { title: string; command: string; arguments?: unknown[] };
  data?: unknown;
}

export interface LspCompletionList {
  isIncomplete: boolean;
  items: LspCompletionItem[];
}

export type LspCompletionResponse = LspCompletionItem[] | LspCompletionList | null;

// =============================================================================
// 6. Hover & Signature Help Protocols
// =============================================================================

export type LspMarkedString = string | { language: string; value: string };

export interface LspMarkupContent {
  kind: 'plaintext' | 'markdown';
  value: string;
}

export interface LspHoverParams {
  textDocument: TextDocumentIdentifier;
  position: LspPosition;
}

export interface LspHover {
  contents: LspMarkedString | LspMarkedString[] | LspMarkupContent;
  range?: LspRange;
}

export type LspHoverResponse = LspHover | null;

export interface LspParameterInformation {
  label: string | [number, number];
  documentation?: string | LspMarkupContent;
}

export interface LspSignatureInformation {
  label: string;
  documentation?: string | LspMarkupContent;
  parameters?: LspParameterInformation[];
  activeParameter?: number;
}

export type LspSignatureHelpTriggerKind = 1 | 2 | 3; // 1: Invoked, 2: TriggerCharacter, 3: ContentChange

export interface LspSignatureHelpContext {
  triggerKind: LspSignatureHelpTriggerKind;
  triggerCharacter?: string;
  isRetrigger: boolean;
  activeSignatureHelp?: LspSignatureHelp;
}

export interface LspSignatureHelpParams {
  textDocument: TextDocumentIdentifier;
  position: LspPosition;
  context?: LspSignatureHelpContext;
}

export interface LspSignatureHelp {
  signatures: LspSignatureInformation[];
  activeSignature?: number;
  activeParameter?: number;
}

export type LspSignatureHelpResponse = LspSignatureHelp | null;

// =============================================================================
// 7. Code Navigation & References Protocols
// =============================================================================

export interface LspLocation {
  uri: string;
  range: LspRange;
}

export interface LspLocationLink {
  originSelectionRange?: LspRange;
  targetUri: string;
  targetRange: LspRange;
  targetSelectionRange: LspRange;
}

export interface LspTextDocumentPositionParams {
  textDocument: TextDocumentIdentifier;
  position: LspPosition;
}

export type LspDefinitionParams = LspTextDocumentPositionParams;
export type LspDeclarationParams = LspTextDocumentPositionParams;
export type LspTypeDefinitionParams = LspTextDocumentPositionParams;

export type LspDefinitionResponse = LspLocation | LspLocation[] | LspLocationLink[] | null;
export type LspDeclarationResponse = LspLocation | LspLocation[] | LspLocationLink[] | null;
export type LspTypeDefinitionResponse = LspLocation | LspLocation[] | LspLocationLink[] | null;

export interface LspReferenceContext {
  includeDeclaration: boolean;
}

export interface LspReferenceParams extends LspTextDocumentPositionParams {
  context: LspReferenceContext;
}

export type LspReferencesResponse = LspLocation[] | null;

// =============================================================================
// 8. Workspace Symbol Protocols
// =============================================================================

export interface LspWorkspaceSymbolParams {
  query: string;
}

export const LspSymbolKind = {
  File: 1,
  Module: 2,
  Namespace: 3,
  Package: 4,
  Class: 5,
  Method: 6,
  Property: 7,
  Field: 8,
  Constructor: 9,
  Enum: 10,
  Interface: 11,
  Function: 12,
  Variable: 13,
  Constant: 14,
  String: 15,
  Number: 16,
  Boolean: 17,
  Array: 18,
  Object: 19,
  Key: 20,
  Null: 21,
  EnumMember: 22,
  Struct: 23,
  Event: 24,
  Operator: 25,
  TypeParameter: 26,
} as const;

export type LspSymbolKind = typeof LspSymbolKind[keyof typeof LspSymbolKind];

export const LspSymbolTag = {
  Deprecated: 1,
} as const;

export type LspSymbolTag = typeof LspSymbolTag[keyof typeof LspSymbolTag];

export interface LspSymbolInformation {
  name: string;
  kind: LspSymbolKind;
  tags?: LspSymbolTag[];
  deprecated?: boolean;
  location: LspLocation;
  containerName?: string;
}

export interface LspWorkspaceSymbolItem {
  name: string;
  kind: LspSymbolKind;
  tags?: LspSymbolTag[];
  containerName?: string;
  location: LspLocation | { uri: string };
  data?: unknown;
}

export type LspWorkspaceSymbolResponse =
  | LspSymbolInformation[]
  | LspWorkspaceSymbolItem[]
  | null;

// =============================================================================
// 9. Cancellation & Request Context
// =============================================================================

export interface CancelParams {
  id: RequestId;
}

export type RequestCategory = 'interactive' | 'background' | 'initialization' | 'shutdown';

export interface PendingRequest<T = unknown> {
  readonly id: RequestId;
  readonly method: string;
  readonly category: RequestCategory;
  readonly createdAt: number;
  readonly timeoutMs: number;
  readonly workspaceId?: string;
  readonly workspaceGeneration?: number;
  readonly documentId?: string;
  readonly documentRevision?: number;
  readonly resolve: (result: T) => void;
  readonly reject: (error: Error) => void;
  readonly timeoutHandle?: ReturnType<typeof setTimeout>;
  isCancelled: boolean;
}

// =============================================================================
// 8. Server Lifecycle, Session & Health Models
// =============================================================================

export type ServerSessionState =
  | 'created'
  | 'starting'
  | 'initializing'
  | 'ready'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'crashed'
  | 'disposed';

export type ServerHealth =
  | 'unavailable'
  | 'starting'
  | 'initializing'
  | 'ready'
  | 'degraded'
  | 'crashed'
  | 'stopping'
  | 'stopped';

export interface ServerSessionIdentity {
  serverDefinitionId: string;
  languageId: string;
  workspaceId: string;
  rootUri: string;
  sessionGeneration: number;
}

export interface ServerSessionStatus {
  sessionId: string;
  serverDefinitionId: string;
  displayName: string;
  languageId: string;
  workspaceId: string;
  rootUri: string;
  state: ServerSessionState;
  health: ServerHealth;
  capabilities: ServerCapabilities | null;
  trackedDocumentCount: number;
  crashCount: number;
  lastCrashTimestamp?: number;
  lastError?: string;
}

// =============================================================================
// 9. Server Definition, Transport & Executable Trust
// =============================================================================

export type LspTransportType = 'stdio' | 'ipc' | 'socket' | 'mock';

export type ExecutableTrustLevel = 'trusted' | 'allowed' | 'blocked' | 'unknown';

export interface LspServerDefinition {
  readonly serverDefinitionId: string;
  readonly displayName: string;
  readonly languageIds: readonly string[];
  readonly fileExtensions: readonly string[];
  readonly command: string;
  readonly args?: readonly string[];
  readonly transportType: LspTransportType;
  readonly environmentPolicy?: 'inherit' | 'clean' | 'custom';
  readonly customEnvironment?: Record<string, string>;
  readonly workspaceMode?: 'singleRoot' | 'multiRoot';
  readonly initializationOptions?: Record<string, unknown>;
  readonly enabled?: boolean;
}

export interface ExecutableValidationResult {
  valid: boolean;
  trustLevel: ExecutableTrustLevel;
  sanitizedCommand: string;
  sanitizedArgs: string[];
  error?: string;
}

// =============================================================================
// 10. Rename & WorkspaceEdit Protocols
// =============================================================================

export interface LspPrepareRenameParams {
  textDocument: TextDocumentIdentifier;
  position: LspPosition;
}

export type LspPrepareRenameResponse =
  | LspRange
  | { range: LspRange; placeholder: string }
  | { defaultBehavior: boolean }
  | null;

export interface LspRenameParams {
  textDocument: TextDocumentIdentifier;
  position: LspPosition;
  newName: string;
}

export interface LspTextEdit {
  range: LspRange;
  newText: string;
}

export interface LspTextDocumentEdit {
  textDocument: VersionedTextDocumentIdentifier | TextDocumentIdentifier;
  edits: LspTextEdit[];
}

export interface LspCreateFile {
  kind: 'create';
  uri: string;
  options?: { overwrite?: boolean; ignoreIfExists?: boolean };
}

export interface LspRenameFile {
  kind: 'rename';
  oldUri: string;
  newUri: string;
  options?: { overwrite?: boolean; ignoreIfExists?: boolean };
}

export interface LspDeleteFile {
  kind: 'delete';
  uri: string;
  options?: { recursive?: boolean; ignoreIfNotExists?: boolean };
}

export type LspResourceOperation = LspCreateFile | LspRenameFile | LspDeleteFile;

export interface LspWorkspaceEdit {
  changes?: { [uri: string]: LspTextEdit[] };
  documentChanges?: (LspTextDocumentEdit | LspResourceOperation)[];
}

export type LspRenameResponse = LspWorkspaceEdit | null;

// =============================================================================
// 11. Document Formatting Protocols
// =============================================================================

export interface FormattingOptions {
  tabSize: number;
  insertSpaces: boolean;
  trimTrailingWhitespace?: boolean;
  insertFinalNewline?: boolean;
  trimFinalNewlines?: boolean;
  [key: string]: boolean | number | string | undefined;
}

export type ProgressToken = number | string;

export interface DocumentFormattingParams {
  textDocument: TextDocumentIdentifier;
  options: FormattingOptions;
  workDoneToken?: ProgressToken;
}

export interface DocumentRangeFormattingParams {
  textDocument: TextDocumentIdentifier;
  range: LspRange;
  options: FormattingOptions;
  workDoneToken?: ProgressToken;
}

export type LspFormattingResponse = LspTextEdit[] | null;
