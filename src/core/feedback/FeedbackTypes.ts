/**
 * QM Editor Unified Feedback System Types
 * Phase 03, Step 23 — Unified Notifications, Dialogs, Confirmations, Progress & Feedback
 */

export type FeedbackSeverity = 'success' | 'info' | 'warning' | 'error';

export type PresentationType =
  | 'toast'
  | 'banner'
  | 'dialog'
  | 'confirmation'
  | 'progress'
  | 'inline'
  | 'status';

export type FeedbackPriority = 'low' | 'normal' | 'high' | 'critical';

export type FeedbackScope = 'global' | 'workspace' | 'document' | 'panel' | 'operation';

export interface FeedbackAction {
  id: string;
  label: string;
  run: () => void | Promise<void>;
  isDestructive?: boolean;
  isPrimary?: boolean;
}

export interface FeedbackMessage {
  id: string;
  severity: FeedbackSeverity;
  presentation: PresentationType;
  title?: string;
  message: string;
  details?: string;
  actions?: FeedbackAction[];
  dismissible?: boolean;
  duration?: number; // Duration in ms; undefined indicates persistent until dismissed
  priority?: FeedbackPriority;
  source?: string;
  scope?: FeedbackScope;
  scopeId?: string;
  operationId?: string;
  timestamp: number;
  repeatCount?: number;
}

export type ConfirmResult = 'confirmed' | 'cancelled' | 'dismissed';

export interface ConfirmOptions {
  title: string;
  message: string;
  details?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  severity?: FeedbackSeverity;
  isDestructive?: boolean;
  scope?: FeedbackScope;
  scopeId?: string;
  targetValidator?: () => boolean;
}

export interface ActiveConfirmRequest extends ConfirmOptions {
  id: string;
  timestamp: number;
  resolve: (result: ConfirmResult) => void;
}

export type ProgressMode = 'determinate' | 'indeterminate';
export type ProgressStatus = 'running' | 'completed' | 'cancelled' | 'error';

export interface ProgressOptions {
  id?: string;
  title: string;
  message?: string;
  mode?: ProgressMode;
  current?: number;
  total?: number;
  cancellable?: boolean;
  onCancel?: () => void;
  source?: string;
  scope?: FeedbackScope;
  scopeId?: string;
  operationId?: string;
}

export interface ProgressTaskState {
  id: string;
  title: string;
  message?: string;
  mode: ProgressMode;
  current?: number;
  total?: number;
  cancellable: boolean;
  status: ProgressStatus;
  errorMessage?: string;
  source?: string;
  scope?: FeedbackScope;
  scopeId?: string;
  operationId?: string;
  timestamp: number;
}

export interface ProgressTaskHandle {
  id: string;
  update: (progress: { current?: number; total?: number; message?: string }) => void;
  complete: (completionMessage?: string) => void;
  error: (errorMessage: string, details?: string) => void;
  cancel: () => void;
}

export interface FeedbackListener {
  onFeedbackChange: () => void;
}
