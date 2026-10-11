import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { FeedbackService } from './FeedbackService';

describe('FeedbackService', () => {
  let service: FeedbackService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new FeedbackService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Toast Notifications', () => {
    it('creates success, info, warning, and error toasts', () => {
      const sId = service.showSuccess('Operation successful', { source: 'test' });
      const iId = service.showInfo('Informational update', { source: 'test' });
      const wId = service.showWarning('Potential issue detected', { source: 'test' });
      const eId = service.showError('Operation failed', { source: 'test' });

      const toasts = service.getVisibleToasts();
      expect(toasts.length).toBe(4);
      expect(toasts.find((t) => t.id === sId)?.severity).toBe('success');
      expect(toasts.find((t) => t.id === iId)?.severity).toBe('info');
      expect(toasts.find((t) => t.id === wId)?.severity).toBe('warning');
      expect(toasts.find((t) => t.id === eId)?.severity).toBe('error');
    });

    it('deduplicates identical messages within deduplication window', () => {
      const id1 = service.showSuccess('File saved', { source: 'doc.save' });
      const id2 = service.showSuccess('File saved', { source: 'doc.save' });

      expect(id1).toBe(id2);
      const toasts = service.getVisibleToasts();
      expect(toasts.length).toBe(1);
      expect(toasts[0].repeatCount).toBe(2);
    });

    it('does not deduplicate messages from different sources or severities', () => {
      service.showInfo('Operation completed', { source: 'sourceA' });
      service.showInfo('Operation completed', { source: 'sourceB' });
      service.showSuccess('Operation completed', { source: 'sourceA' });

      expect(service.getVisibleToasts().length).toBe(3);
    });

    it('auto-dismisses toasts based on duration class', () => {
      service.showSuccess('Brief message', { duration: 'brief' }); // 2500ms
      expect(service.getVisibleToasts().length).toBe(1);

      vi.advanceTimersByTime(2600);
      expect(service.getVisibleToasts().length).toBe(0);
    });

    it('keeps persistent error toasts visible until explicitly dismissed', () => {
      const id = service.showError('Critical failure', { duration: 'persistent' });
      expect(service.getVisibleToasts().length).toBe(1);

      vi.advanceTimersByTime(20000);
      expect(service.getVisibleToasts().length).toBe(1);

      service.dismiss(id);
      expect(service.getVisibleToasts().length).toBe(0);
    });
  });

  describe('Banner Notifications', () => {
    it('creates persistent banners and allows manual dismissal', () => {
      const bId = service.showBanner({
        message: 'Git is not installed on this system',
        severity: 'warning',
        source: 'scm',
      });

      expect(service.getBanners().length).toBe(1);
      expect(service.getBanners()[0].id).toBe(bId);

      service.dismiss(bId);
      expect(service.getBanners().length).toBe(0);
    });
  });

  describe('Confirmations', () => {
    it('resolves confirmation with confirmed result when user accepts', async () => {
      const confirmPromise = service.confirm({
        title: 'Delete Resource',
        message: 'Are you sure you want to delete file.txt?',
        isDestructive: true,
      });

      const active = service.getActiveConfirm();
      expect(active).not.toBeNull();
      expect(active?.title).toBe('Delete Resource');
      expect(active?.isDestructive).toBe(true);

      service.resolveActiveConfirm('confirmed');
      const result = await confirmPromise;
      expect(result).toBe('confirmed');
      expect(service.getActiveConfirm()).toBeNull();
    });

    it('resolves confirmation with cancelled result when user cancels', async () => {
      const confirmPromise = service.confirm({
        title: 'Discard Changes',
        message: 'Discard changes to draft?',
      });

      service.resolveActiveConfirm('cancelled');
      const result = await confirmPromise;
      expect(result).toBe('cancelled');
      expect(service.getActiveConfirm()).toBeNull();
    });

    it('auto-dismisses previous pending confirmation when a new one is requested', async () => {
      const firstPromise = service.confirm({ title: 'First Confirmation', message: 'First' });
      const secondPromise = service.confirm({ title: 'Second Confirmation', message: 'Second' });

      const firstResult = await firstPromise;
      expect(firstResult).toBe('dismissed');

      service.resolveActiveConfirm('confirmed');
      const secondResult = await secondPromise;
      expect(secondResult).toBe('confirmed');
    });
  });

  describe('Progress Tasks', () => {
    it('tracks determinate progress with updates and completes safely', () => {
      const handle = service.startProgress({
        title: 'Replacing in Files',
        mode: 'determinate',
        total: 100,
        cancellable: true,
      });

      let tasks = service.getActiveProgressTasks();
      expect(tasks.length).toBe(1);
      expect(tasks[0].id).toBe(handle.id);
      expect(tasks[0].current).toBe(0);

      handle.update({ current: 45, message: 'Processing file 45 of 100' });
      tasks = service.getActiveProgressTasks();
      expect(tasks[0].current).toBe(45);
      expect(tasks[0].message).toBe('Processing file 45 of 100');

      handle.complete();
      tasks = service.getActiveProgressTasks();
      expect(tasks.length).toBe(0);
    });

    it('handles progress cancellation and registers cancellation callback', () => {
      const onCancel = vi.fn();
      const handle = service.startProgress({
        title: 'Indexing Workspace',
        mode: 'indeterminate',
        cancellable: true,
        onCancel,
      });

      expect(service.getActiveProgressTasks().length).toBe(1);
      handle.cancel();

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(service.getActiveProgressTasks().length).toBe(0);
    });

    it('transitions progress task to error state when error is reported', () => {
      const handle = service.startProgress({
        title: 'Building Project',
        mode: 'indeterminate',
      });

      handle.error('Compilation failed with exit code 1');
      const toasts = service.getVisibleToasts();
      expect(toasts.some((t) => t.severity === 'error' && t.message.includes('Compilation failed'))).toBe(true);
      expect(service.getActiveProgressTasks().length).toBe(0);
    });
  });

  describe('Scope Scavenging & Stale Protection', () => {
    it('clears toasts, banners, and progress belonging to a scoped workspace', () => {
      service.showSuccess('Saved in workspace A', { scope: 'workspace', scopeId: 'ws-1' });
      service.showSuccess('Saved in workspace B', { scope: 'workspace', scopeId: 'ws-2' });
      service.startProgress({ title: 'Task in ws-1', scope: 'workspace', scopeId: 'ws-1' });
      service.startProgress({ title: 'Task in ws-2', scope: 'workspace', scopeId: 'ws-2' });

      expect(service.getVisibleToasts().length).toBe(2);
      expect(service.getActiveProgressTasks().length).toBe(2);

      service.clearScope('workspace', 'ws-1');

      expect(service.getVisibleToasts().length).toBe(1);
      expect(service.getVisibleToasts()[0].scopeId).toBe('ws-2');
      expect(service.getActiveProgressTasks().length).toBe(1);
      expect(service.getActiveProgressTasks()[0].scopeId).toBe('ws-2');
    });
  });

  describe('Sensitive Information Sanitization', () => {
    it('redacts tokens, passwords, bearer tokens, and private keys from technical details', () => {
      const sensitiveDetails = `
        Error in auth:
        Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token123
        password=SuperSecret123!
        api_token="abcdef1234567890abcdef"
        -----BEGIN PRIVATE KEY-----
        MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC3
        -----END PRIVATE KEY-----
      `;

      service.showError('Authentication failed', {
        details: sensitiveDetails,
      });

      const toast = service.getVisibleToasts()[0];
      expect(toast.details).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token123');
      expect(toast.details).not.toContain('SuperSecret123!');
      expect(toast.details).not.toContain('abcdef1234567890abcdef');
      expect(toast.details).not.toContain('MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC3');
      expect(toast.details).toContain('[REDACTED]');
    });
  });
});
