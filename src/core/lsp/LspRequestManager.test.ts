/**
 * QM Editor LSP Request Manager Unit Tests
 * Phase 06, Step 56 — Language Server Protocol Foundation, Server Lifecycle & Client Architecture
 */

import { describe, it, expect } from 'vitest';
import { LspRequestManager } from './LspRequestManager';
import { LspTimeoutError, LspCancelledError, LspStaleResponseError } from './LspErrors';
import { CancellationTokenSource } from '../symbols/CancellationToken';
import { globalDocumentEngine } from '../documents/DocumentEngine';

describe('LspRequestManager', () => {
  it('generates strictly monotonic request IDs', () => {
    const manager = new LspRequestManager();
    const req1 = manager.createRequest('method1', {});
    const req2 = manager.createRequest('method2', {});
    const req3 = manager.createRequest('method3', {});

    expect(req1.requestMessage.id).toBe(1);
    expect(req2.requestMessage.id).toBe(2);
    expect(req3.requestMessage.id).toBe(3);
    manager.dispose();
  });

  it('resolves request promise when response arrives', async () => {
    const manager = new LspRequestManager();
    const { requestMessage, promise } = manager.createRequest<string>('testMethod', {});

    manager.handleResponse(requestMessage.id, 'success-payload');

    const result = await promise;
    expect(result).toBe('success-payload');
    expect(manager.getPendingCount()).toBe(0);
    manager.dispose();
  });

  it('rejects request promise when response error arrives', async () => {
    const manager = new LspRequestManager();
    const { requestMessage, promise } = manager.createRequest('testMethod', {});

    manager.handleResponse(requestMessage.id, null, {
      code: -32601,
      message: 'Method not found',
    });

    await expect(promise).rejects.toThrow('LSP Error [-32601]: Method not found');
    expect(manager.getPendingCount()).toBe(0);
    manager.dispose();
  });

  it('handles out-of-order responses correctly', async () => {
    const manager = new LspRequestManager();
    const req1 = manager.createRequest<string>('req1', {});
    const req2 = manager.createRequest<string>('req2', {});

    // Reply to req2 first, then req1
    manager.handleResponse(req2.requestMessage.id, 'result-2');
    manager.handleResponse(req1.requestMessage.id, 'result-1');

    expect(await req2.promise).toBe('result-2');
    expect(await req1.promise).toBe('result-1');
    manager.dispose();
  });

  it('rejects with LspTimeoutError when timeout expires', async () => {
    const manager = new LspRequestManager();
    const { promise } = manager.createRequest('slowMethod', {}, { timeoutMs: 50 });

    await expect(promise).rejects.toBeInstanceOf(LspTimeoutError);
    expect(manager.getPendingCount()).toBe(0);
    manager.dispose();
  });

  it('rejects with LspCancelledError when CancellationToken is triggered', async () => {
    const manager = new LspRequestManager();
    const cts = new CancellationTokenSource();
    let cancelNotificationSent = false;

    const { promise } = manager.createRequest(
      'cancellableMethod',
      {},
      { cancellationToken: cts.token },
      (msg) => {
        if (msg.method === '$/cancelRequest') {
          cancelNotificationSent = true;
        }
      }
    );

    cts.cancel();

    await expect(promise).rejects.toBeInstanceOf(LspCancelledError);
    expect(cancelNotificationSent).toBe(true);
    expect(manager.getPendingCount()).toBe(0);
    manager.dispose();
  });

  it('rejects stale response when document revision has advanced', async () => {
    const manager = new LspRequestManager();
    // Open a document in DocumentEngine
    const { document: doc } = await globalDocumentEngine.openResource('file:///C:/test/stale-req.ts', {
      initialContent: 'version 1',
    });

    const initialRevision = doc.contentRevision;

    const { requestMessage, promise } = manager.createRequest(
      'textDocument/completion',
      {},
      {
        documentId: doc.id,
        documentRevision: initialRevision,
      }
    );

    // Advance document revision before response arrives
    await globalDocumentEngine.updateText(doc.id, 'version 2 updated');

    manager.handleResponse(requestMessage.id, { items: [] });

    await expect(promise).rejects.toBeInstanceOf(LspStaleResponseError);

    await globalDocumentEngine.close(doc.id, true);
    manager.dispose();
  });

  it('cleans up and rejects all pending requests on disposal', async () => {
    const manager = new LspRequestManager();
    const req1 = manager.createRequest('method1', {});
    const req2 = manager.createRequest('method2', {});

    expect(manager.getPendingCount()).toBe(2);
    manager.dispose('Server crashed');

    await expect(req1.promise).rejects.toThrow('Server crashed');
    await expect(req2.promise).rejects.toThrow('Server crashed');
    expect(manager.getPendingCount()).toBe(0);
  });
});
