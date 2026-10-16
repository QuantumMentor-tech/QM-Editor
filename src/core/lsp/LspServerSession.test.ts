/**
 * QM Editor LSP Server Session & Lifecycle Unit Tests
 * Phase 06, Step 56 — Language Server Protocol Foundation, Server Lifecycle & Client Architecture
 */

import { describe, it, expect } from 'vitest';
import { LspServerSession } from './LspServerSession';
import { MockLspTransport } from './transport/MockLspTransport';
import { LspServerDefinition, RequestMessage } from './LspTypes';
import { LspLifecycleError } from './LspErrors';

describe('LspServerSession', () => {
  const dummyDef: LspServerDefinition = {
    serverDefinitionId: 'test-server',
    displayName: 'Test LSP Server',
    languageIds: ['typescript'],
    fileExtensions: ['ts'],
    command: 'test-lsp',
    transportType: 'mock',
    enabled: true,
  };

  it('starts in created state with unavailable health', () => {
    const transport = new MockLspTransport();
    const session = new LspServerSession({
      serverDefinition: dummyDef,
      workspaceId: 'ws-test',
      transport,
    });

    expect(session.getState()).toBe('created');
    expect(session.getHealth()).toBe('unavailable');
  });

  it('successfully transitions created -> starting -> initializing -> ready -> running on start', async () => {
    const transport = new MockLspTransport();
    transport.messageHandler = (msg) => {
      if ('method' in msg && msg.method === 'initialize') {
        const req = msg as RequestMessage;
        return {
          jsonrpc: '2.0',
          id: req.id,
          result: {
            capabilities: {
              hoverProvider: true,
            },
          },
        };
      }
      return null;
    };

    const session = new LspServerSession({
      serverDefinition: dummyDef,
      workspaceId: 'ws-test',
      transport,
    });

    await session.start();

    expect(session.getState()).toBe('running');
    expect(session.getHealth()).toBe('ready');
    expect(session.getCapabilities()?.hoverProvider).toBe(true);

    await session.stop();
    expect(session.getState()).toBe('stopped');
    expect(session.getHealth()).toBe('stopped');
  });

  it('rejects invalid state machine transitions', () => {
    const transport = new MockLspTransport();
    const session = new LspServerSession({
      serverDefinition: dummyDef,
      workspaceId: 'ws-test',
      transport,
    });

    // Session is in 'created' state; attempting to stop or jump to ready directly should be rejected
    expect(() => {
      (session as any).transitionTo('ready', 'ready');
    }).toThrow(LspLifecycleError);
  });

  it('tracks and untracks document URIs', () => {
    const transport = new MockLspTransport();
    const session = new LspServerSession({
      serverDefinition: dummyDef,
      workspaceId: 'ws-test',
      transport,
    });

    session.trackDocument('file:///test1.ts');
    session.trackDocument('file:///test2.ts');
    expect(session.getTrackedDocumentCount()).toBe(2);
    expect(session.isDocumentTracked('file:///test1.ts')).toBe(true);

    session.untrackDocument('file:///test1.ts');
    expect(session.getTrackedDocumentCount()).toBe(1);
    expect(session.isDocumentTracked('file:///test1.ts')).toBe(false);
  });

  it('handles unexpected process exit and activates crash loop protection', async () => {
    const transport = new MockLspTransport();
    transport.messageHandler = (msg) => {
      if ('method' in msg && msg.method === 'initialize') {
        return {
          jsonrpc: '2.0',
          id: (msg as RequestMessage).id,
          result: { capabilities: {} },
        };
      }
      return null;
    };

    const session = new LspServerSession({
      serverDefinition: dummyDef,
      workspaceId: 'ws-test',
      transport,
      maxCrashCount: 2,
      crashWindowMs: 60000,
    });

    await session.start();
    expect(session.getState()).toBe('running');

    // Simulate crash 1
    transport.simulateCrash(1);
    expect(session.getState()).toBe('crashed');
    expect(session.getHealth()).toBe('crashed');
    expect(session.getStatus().crashCount).toBe(1);

    // Restart and simulate crash 2 (hitting max crash limit)
    await session.start();
    transport.simulateCrash(1);
    expect(session.getStatus().crashCount).toBe(2);

    // Attempting automatic start again should be suppressed by crash loop protection
    await expect(session.start()).rejects.toThrow('reached crash loop limit');
  });

  it('disposes cleanly and releases resources', async () => {
    const transport = new MockLspTransport();
    const session = new LspServerSession({
      serverDefinition: dummyDef,
      workspaceId: 'ws-test',
      transport,
    });

    await session.dispose();
    expect(session.getState()).toBe('disposed');
    expect(session.getHealth()).toBe('unavailable');
  });
});
