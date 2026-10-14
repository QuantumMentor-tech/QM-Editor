/**
 * QM Editor Canonical Code Action & Code Transformation Types
 * Phase 04, Step 44 — Code Actions, Quick Fixes & Safe Code Transformation Foundation
 */

import { Range } from '../navigation/LocationTypes';
import { Diagnostic } from '../diagnostics/DiagnosticTypes';

/**
 * Normalized categories of Code Actions.
 */
export type CodeActionKind =
  | 'quickfix'
  | 'refactor'
  | 'refactor.extract'
  | 'refactor.inline'
  | 'refactor.rewrite'
  | 'source'
  | 'source.organizeImports'
  | 'source.fixAll'
  | 'format';

/**
 * Trigger reason for code action invocation.
 */
export type CodeActionTriggerKind =
  | 'invoked' // Explicit manual shortcut (Mod+. or Alt+Enter) or menu
  | 'automatic'; // Diagnostic cursor alignment or lightbulb

/**
 * Canonical 1-based text edit representing a localized document mutation.
 */
export interface TextEdit {
  /** Target resource URI or file path (e.g. 'file:///src/App.tsx' or 'untitled:1') */
  readonly resourceUri: string;
  /** Replacement range in canonical 1-based line & column coordinates */
  readonly range: Range;
  /** Replacement text string */
  readonly newText: string;
}

/**
 * Structured resource lifecycle operations (future-compatible file operations).
 */
export type ResourceEditOperation =
  | {
      readonly type: 'createFile';
      readonly uri: string;
      readonly options?: { readonly overwrite?: boolean; readonly ignoreIfExists?: boolean };
    }
  | {
      readonly type: 'renameFile';
      readonly oldUri: string;
      readonly newUri: string;
      readonly options?: { readonly overwrite?: boolean; readonly ignoreIfExists?: boolean };
    }
  | {
      readonly type: 'deleteFile';
      readonly uri: string;
      readonly options?: { readonly recursive?: boolean; readonly ignoreIfNotExists?: boolean };
    };

/**
 * Structured Workspace Edit representing a set of proposed changes across one or more resources.
 */
export interface WorkspaceEdit {
  /** Map of resource URI to text edits affecting that resource */
  readonly changes?: { readonly [uri: string]: TextEdit[] };
  /** Optional sequence of structured resource lifecycle operations */
  readonly resourceOperations?: ResourceEditOperation[];
}

/**
 * Canonical Code Action Model.
 * Represents a proposed code transformation that must be validated before execution.
 */
export interface CodeAction {
  /** Stable action identifier (e.g. 'ts.quickfix.addImport:React') */
  readonly id: string;
  /** Owning provider identifier (e.g. 'builtin.ts', 'eslint') */
  readonly providerId: string;
  /** Human-readable action title displayed to the user */
  readonly title: string;
  /** Normalized category */
  readonly kind: CodeActionKind;
  /** Associated diagnostics (from Step 40 Diagnostic model) */
  readonly diagnostics?: Diagnostic[];
  /** Proposed workspace edit (optional if resolved lazily) */
  readonly edit?: WorkspaceEdit;
  /** Whether this is the preferred / default action */
  readonly isPreferred?: boolean;
  /** Reason why the action is disabled (if inapplicable at current context) */
  readonly disabledReason?: string;
  /** Document content revision at the time this action was formulated */
  readonly documentRevision?: number;
  /** Workspace generation at the time this action was formulated */
  readonly workspaceGeneration?: number;
  /** Optional arbitrary metadata payload */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Context passed when requesting code actions from providers.
 */
export interface CodeActionRequest {
  readonly requestId: string;
  readonly workspaceId: string;
  readonly workspaceGeneration: number;
  readonly documentId: string;
  readonly resourceUri: string;
  readonly editorModelId: string;
  readonly documentRevision: number;
  readonly range: Range; // Selection or cursor position
  readonly diagnostics: Diagnostic[]; // Diagnostics overlapping the range
  readonly languageId: string;
  readonly triggerKind: CodeActionTriggerKind;
}

/**
 * Capabilities declared by a Code Action provider.
 */
export interface CodeActionProviderCapabilities {
  /** Supported kinds of code actions provided (e.g. ['quickfix', 'source.organizeImports']) */
  readonly providedCodeActionKinds?: CodeActionKind[];
  /** Whether the provider supports resolving edit details lazily */
  readonly supportsResolve?: boolean;
  /** Custom priority score for ranking (higher = higher precedence, default: 50) */
  readonly priority?: number;
}

/**
 * Preview summary for a single affected file.
 */
export interface FileEditPreview {
  readonly resourceUri: string;
  readonly documentId?: string;
  readonly isOpen: boolean;
  readonly isReadOnly: boolean;
  readonly isDirty: boolean;
  readonly originalContent?: string;
  readonly proposedContent: string;
  readonly editsCount: number;
}

/**
 * Preview model for a Code Action before execution.
 * Completely read-only and non-mutating.
 */
export interface CodeActionPreview {
  readonly actionId: string;
  readonly actionTitle: string;
  readonly providerId: string;
  readonly affectedFiles: FileEditPreview[];
  readonly resourceOperations: ResourceEditOperation[];
  readonly totalEditsCount: number;
  readonly requiresConfirmation: boolean;
  readonly confirmationReason?: string;
}

/**
 * Result status of code action validation.
 */
export interface CodeActionValidationResult {
  readonly valid: boolean;
  readonly error?: string;
  readonly status?: 'stale' | 'read_only' | 'conflict' | 'workspace_mismatch' | 'invalid_range' | 'disabled';
}

/**
 * Execution status for Code Action application.
 */
export type CodeActionExecutionStatus =
  | 'applied'
  | 'rejected'
  | 'stale'
  | 'read_only'
  | 'conflict'
  | 'cancelled'
  | 'partial_failure'
  | 'failed';

/**
 * Structured result returned upon code action execution.
 */
export interface CodeActionExecutionResult {
  readonly status: CodeActionExecutionStatus;
  readonly actionId: string;
  readonly appliedEditsCount: number;
  readonly affectedDocuments: string[];
  readonly error?: string;
  readonly details?: string[];
}
