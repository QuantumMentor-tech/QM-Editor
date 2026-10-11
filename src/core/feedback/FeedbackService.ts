/**
 * QM Editor Unified Feedback Service
 * Phase 03, Step 23 — Unified Notifications, Dialogs, Confirmations, Progress & Feedback
 */

import {
  FeedbackMessage,
  FeedbackSeverity,
  PresentationType,
  FeedbackPriority,
  ConfirmOptions,
  ConfirmResult,
  ActiveConfirmRequest,
  ProgressOptions,
  ProgressTaskState,
  ProgressTaskHandle,
  FeedbackScope,
} from './FeedbackTypes';

export class FeedbackService {
  private messages = new Map<string, FeedbackMessage>();
  private progressTasks = new Map<string, ProgressTaskState>();
  private activeConfirmRequest: ActiveConfirmRequest | null = null;
  private listeners = new Set<() => void>();
  private autoDismissTimers = new Map<string, any>();

  // Configuration
  private readonly maxVisibleToasts = 4;
  private readonly deduplicationWindowMs = 3000;

  constructor() {}

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  // -------------------------------------------------------------
  // 1. MESSAGES & TOASTS
  // -------------------------------------------------------------

  public show(options: {
    severity: FeedbackSeverity;
    presentation?: PresentationType;
    title?: string;
    message: string;
    details?: string;
    actions?: FeedbackMessage['actions'];
    dismissible?: boolean;
    duration?: number | 'brief' | 'normal' | 'persistent';
    priority?: FeedbackPriority;
    source?: string;
    scope?: FeedbackScope;
    scopeId?: string;
    operationId?: string;
  }): string {
    const presentation = options.presentation || 'toast';
    const severity = options.severity;
    const now = Date.now();

    // 1. Check for deduplication (same source + message + severity within window)
    if (presentation === 'toast') {
      const existing = this.findDeduplicationCandidate(options.source, options.message, severity, now);
      if (existing) {
        existing.repeatCount = (existing.repeatCount || 1) + 1;
        existing.timestamp = now;
        this.resetAutoDismiss(existing.id, this.resolveDuration(options.duration, severity));
        this.notify();
        return existing.id;
      }
    }

    const id = `fb-${now}-${Math.random().toString(36).substring(2, 7)}`;
    const duration = this.resolveDuration(options.duration, severity);

    const messageObj: FeedbackMessage = {
      id,
      severity,
      presentation,
      title: options.title,
      message: options.message,
      details: options.details ? this.sanitizeTechnicalDetails(options.details) : undefined,
      actions: options.actions,
      dismissible: options.dismissible ?? true,
      duration,
      priority: options.priority || (severity === 'error' ? 'high' : 'normal'),
      source: options.source,
      scope: options.scope || 'global',
      scopeId: options.scopeId,
      operationId: options.operationId,
      timestamp: now,
      repeatCount: 1,
    };

    this.messages.set(id, messageObj);

    // Setup auto dismiss timer if duration is specified
    if (duration !== undefined && duration > 0) {
      this.setupAutoDismiss(id, duration);
    }

    this.notify();
    return id;
  }

  public showSuccess(message: string, options?: Partial<Parameters<FeedbackService['show']>[0]>): string {
    return this.show({ ...options, severity: 'success', message });
  }

  public showInfo(message: string, options?: Partial<Parameters<FeedbackService['show']>[0]>): string {
    return this.show({ ...options, severity: 'info', message });
  }

  public showWarning(message: string, options?: Partial<Parameters<FeedbackService['show']>[0]>): string {
    return this.show({ ...options, severity: 'warning', message });
  }

  public showError(message: string, options?: Partial<Parameters<FeedbackService['show']>[0]>): string {
    return this.show({
      ...options,
      severity: 'error',
      message,
      duration: options?.duration ?? (options?.actions && options.actions.length > 0 ? 'persistent' : 8000),
    });
  }

  public showBanner(options: {
    id?: string;
    severity: FeedbackSeverity;
    title?: string;
    message: string;
    details?: string;
    actions?: FeedbackMessage['actions'];
    dismissible?: boolean;
    source?: string;
    scope?: FeedbackScope;
    scopeId?: string;
  }): string {
    const bannerId = options.id || `banner-${options.source || 'sys'}`;
    const messageObj: FeedbackMessage = {
      id: bannerId,
      severity: options.severity,
      presentation: 'banner',
      title: options.title,
      message: options.message,
      details: options.details ? this.sanitizeTechnicalDetails(options.details) : undefined,
      actions: options.actions,
      dismissible: options.dismissible ?? true,
      priority: 'high',
      source: options.source,
      scope: options.scope || 'global',
      scopeId: options.scopeId,
      timestamp: Date.now(),
    };

    this.messages.set(bannerId, messageObj);
    this.notify();
    return bannerId;
  }

  public dismiss(id: string): void {
    if (this.autoDismissTimers.has(id)) {
      clearTimeout(this.autoDismissTimers.get(id));
      this.autoDismissTimers.delete(id);
    }

    if (this.messages.delete(id)) {
      this.notify();
    }
  }

  public clearAll(): void {
    for (const timer of this.autoDismissTimers.values()) {
      clearTimeout(timer);
    }
    this.autoDismissTimers.clear();
    this.messages.clear();
    this.notify();
  }

  public clearScope(scope: FeedbackScope, scopeId?: string): void {
    let changed = false;

    for (const [id, msg] of this.messages.entries()) {
      if (msg.scope === scope && (!scopeId || msg.scopeId === scopeId)) {
        if (this.autoDismissTimers.has(id)) {
          clearTimeout(this.autoDismissTimers.get(id));
          this.autoDismissTimers.delete(id);
        }
        this.messages.delete(id);
        changed = true;
      }
    }

    for (const [id, task] of this.progressTasks.entries()) {
      if (task.scope === scope && (!scopeId || task.scopeId === scopeId)) {
        this.progressTasks.delete(id);
        changed = true;
      }
    }

    if (changed) {
      this.notify();
    }
  }

  public getVisibleToasts(): FeedbackMessage[] {
    const toasts = Array.from(this.messages.values())
      .filter((m) => m.presentation === 'toast')
      .sort((a, b) => b.timestamp - a.timestamp);

    return toasts.slice(0, this.maxVisibleToasts);
  }

  public getBanners(): FeedbackMessage[] {
    return Array.from(this.messages.values()).filter((m) => m.presentation === 'banner');
  }

  // -------------------------------------------------------------
  // 2. CONFIRMATION SYSTEM
  // -------------------------------------------------------------

  public confirm(options: ConfirmOptions): Promise<ConfirmResult> {
    return new Promise<ConfirmResult>((resolve) => {
      // If another modal confirmation is currently active, resolve it as dismissed
      if (this.activeConfirmRequest) {
        this.activeConfirmRequest.resolve('dismissed');
      }

      const id = `confirm-${Date.now()}`;
      this.activeConfirmRequest = {
        ...options,
        id,
        timestamp: Date.now(),
        resolve: (result: ConfirmResult) => {
          // Stale Context Validation: verify target before returning 'confirmed'
          if (result === 'confirmed' && options.targetValidator && !options.targetValidator()) {
            this.activeConfirmRequest = null;
            this.notify();
            this.showWarning('Operation cancelled: the target resource is no longer active.');
            resolve('cancelled');
            return;
          }

          this.activeConfirmRequest = null;
          this.notify();
          resolve(result);
        },
      };

      this.notify();
    });
  }

  public getActiveConfirm(): ActiveConfirmRequest | null {
    return this.activeConfirmRequest;
  }

  public resolveActiveConfirm(result: ConfirmResult): void {
    if (this.activeConfirmRequest) {
      this.activeConfirmRequest.resolve(result);
    }
  }

  // -------------------------------------------------------------
  // 3. PROGRESS SYSTEM
  // -------------------------------------------------------------

  public startProgress(options: ProgressOptions): ProgressTaskHandle {
    const id = options.id || `prog-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const taskState: ProgressTaskState = {
      id,
      title: options.title,
      message: options.message,
      mode: options.mode || 'indeterminate',
      current: options.current ?? (options.mode === 'determinate' ? 0 : undefined),
      total: options.total,
      cancellable: Boolean(options.cancellable),
      status: 'running',
      source: options.source,
      scope: options.scope || 'global',
      scopeId: options.scopeId,
      operationId: options.operationId,
      timestamp: Date.now(),
    };

    this.progressTasks.set(id, taskState);
    this.notify();

    const handle: ProgressTaskHandle = {
      id,
      update: (progress) => {
        const current = this.progressTasks.get(id);
        if (!current || current.status !== 'running') return;

        if (progress.current !== undefined) current.current = progress.current;
        if (progress.total !== undefined) {
          current.total = progress.total;
          current.mode = 'determinate';
        }
        if (progress.message !== undefined) current.message = progress.message;

        this.notify();
      },
      complete: (completionMessage) => {
        const current = this.progressTasks.get(id);
        if (!current || current.status !== 'running') return;

        current.status = 'completed';
        if (completionMessage) current.message = completionMessage;

        // Auto remove completed progress after brief period
        setTimeout(() => {
          this.progressTasks.delete(id);
          this.notify();
        }, 1200);

        this.notify();
      },
      error: (errorMessage, details) => {
        const current = this.progressTasks.get(id);
        if (!current) return;

        current.status = 'error';
        current.errorMessage = errorMessage;

        this.showError(errorMessage, {
          title: current.title,
          details,
          source: current.source,
          scope: current.scope,
          scopeId: current.scopeId,
        });

        setTimeout(() => {
          this.progressTasks.delete(id);
          this.notify();
        }, 3000);

        this.notify();
      },
      cancel: () => {
        const current = this.progressTasks.get(id);
        if (!current || current.status !== 'running') return;

        current.status = 'cancelled';
        if (options.onCancel) {
          options.onCancel();
        }

        setTimeout(() => {
          this.progressTasks.delete(id);
          this.notify();
        }, 800);

        this.notify();
      },
    };

    return handle;
  }

  public getActiveProgressTasks(): ProgressTaskState[] {
    return Array.from(this.progressTasks.values()).filter((t) => t.status === 'running');
  }

  // -------------------------------------------------------------
  // 4. HELPER METHODS
  // -------------------------------------------------------------

  private resolveDuration(
    duration: number | 'brief' | 'normal' | 'persistent' | undefined,
    severity: FeedbackSeverity
  ): number | undefined {
    if (duration === 'persistent') return undefined;
    if (duration === 'brief') return 2500;
    if (duration === 'normal') return 5000;
    if (typeof duration === 'number') return duration;

    // Defaults by severity
    switch (severity) {
      case 'success':
        return 4000;
      case 'info':
        return 5000;
      case 'warning':
        return 7000;
      case 'error':
        return undefined; // Persistent by default until dismissed
    }
  }

  private setupAutoDismiss(id: string, duration: number): void {
    const timer = setTimeout(() => {
      this.dismiss(id);
    }, duration);
    this.autoDismissTimers.set(id, timer);
  }

  private resetAutoDismiss(id: string, duration?: number): void {
    if (this.autoDismissTimers.has(id)) {
      clearTimeout(this.autoDismissTimers.get(id));
      this.autoDismissTimers.delete(id);
    }
    if (duration !== undefined && duration > 0) {
      this.setupAutoDismiss(id, duration);
    }
  }

  private findDeduplicationCandidate(
    source: string | undefined,
    message: string,
    severity: FeedbackSeverity,
    now: number
  ): FeedbackMessage | undefined {
    for (const msg of this.messages.values()) {
      if (
        msg.presentation === 'toast' &&
        msg.source === source &&
        msg.message === message &&
        msg.severity === severity &&
        now - msg.timestamp <= this.deduplicationWindowMs
      ) {
        return msg;
      }
    }
    return undefined;
  }

  public sanitizeTechnicalDetails(raw: string): string {
    if (!raw) return '';

    // Strip out credentials, authorization tokens, passwords, private keys
    return raw
      .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]')
      .replace(/([a-zA-Z0-9_]*password|[a-zA-Z0-9_]*token|[a-zA-Z0-9_]*secret)\s*[:=]\s*["']?[^\s,"']+["']?/gi, '$1=[REDACTED]')
      .replace(/ghp_[A-Za-z0-9]+/g, 'ghp_[REDACTED]')
      .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/gi, '[PRIVATE KEY REDACTED]')
      .trim();
  }
}

export const globalFeedbackService = new FeedbackService();
