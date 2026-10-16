/**
 * QM Editor LSP JSON-RPC 2.0 Framing & Protocol Unit Tests
 * Phase 06, Step 56 — Language Server Protocol Foundation, Server Lifecycle & Client Architecture
 */

import { describe, it, expect } from 'vitest';
import { LspJsonRpc } from './LspJsonRpc';
import { RequestMessage, NotificationMessage, ResponseMessage } from './LspTypes';

describe('LspJsonRpc', () => {
  it('serializes request message with exact Content-Length header', () => {
    const msg: RequestMessage = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { processId: null },
    };

    const wire = LspJsonRpc.serialize(msg);
    expect(wire).toMatch(/^Content-Length: \d+\r\n\r\n/);

    const body = wire.slice(wire.indexOf('\r\n\r\n') + 4);
    const byteLength = new TextEncoder().encode(body).length;
    expect(wire).toContain(`Content-Length: ${byteLength}\r\n\r\n`);
    expect(JSON.parse(body)).toEqual(msg);
  });

  it('correctly parses a single complete JSON-RPC message in one chunk', () => {
    const parser = new LspJsonRpc();
    const msg: NotificationMessage = {
      jsonrpc: '2.0',
      method: 'initialized',
      params: {},
    };

    const wire = LspJsonRpc.serialize(msg);
    const parsed = parser.append(wire);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual(msg);
  });

  it('correctly buffers and reassembles a message split across multiple chunks', () => {
    const parser = new LspJsonRpc();
    const msg: RequestMessage = {
      jsonrpc: '2.0',
      id: 42,
      method: 'textDocument/completion',
      params: { textDocument: { uri: 'file:///test.ts' }, position: { line: 10, character: 5 } },
    };

    const wire = LspJsonRpc.serialize(msg);
    // Split into 3 arbitrary chunks
    const chunk1 = wire.slice(0, 15);
    const chunk2 = wire.slice(15, 45);
    const chunk3 = wire.slice(45);

    expect(parser.append(chunk1)).toHaveLength(0);
    expect(parser.append(chunk2)).toHaveLength(0);

    const parsed = parser.append(chunk3);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual(msg);
  });

  it('correctly extracts multiple concatenated messages from a single chunk', () => {
    const parser = new LspJsonRpc();
    const msg1: NotificationMessage = {
      jsonrpc: '2.0',
      method: 'window/logMessage',
      params: { message: 'Server started' },
    };
    const msg2: ResponseMessage = {
      jsonrpc: '2.0',
      id: 100,
      result: { capabilities: {} },
    };

    const wire1 = LspJsonRpc.serialize(msg1);
    const wire2 = LspJsonRpc.serialize(msg2);
    const combined = wire1 + wire2;

    const parsed = parser.append(combined);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual(msg1);
    expect(parsed[1]).toEqual(msg2);
  });

  it('handles multibyte UTF-8 characters where byte length exceeds character length', () => {
    const parser = new LspJsonRpc();
    const msg: NotificationMessage = {
      jsonrpc: '2.0',
      method: 'window/showMessage',
      params: { message: 'Успешный запуск! 🚀 한국어' },
    };

    const wire = LspJsonRpc.serialize(msg);
    const parsed = parser.append(wire);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual(msg);
  });

  it('tolerates malformed headers and recovers synchronization', () => {
    const parser = new LspJsonRpc();
    const malformed = 'Corrupt-Header: invalid\r\n\r\n';
    const validMsg: NotificationMessage = {
      jsonrpc: '2.0',
      method: 'valid/method',
      params: {},
    };
    const validWire = LspJsonRpc.serialize(validMsg);

    const parsed = parser.append(malformed + validWire);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual(validMsg);
  });

  it('tolerates malformed JSON payloads without throwing uncaught exceptions', () => {
    const parser = new LspJsonRpc();
    const badJson = 'Content-Length: 15\r\n\r\n{ invalid json ';
    const validMsg: NotificationMessage = {
      jsonrpc: '2.0',
      method: 'valid/afterBad',
      params: {},
    };
    const validWire = LspJsonRpc.serialize(validMsg);

    const parsed = parser.append(badJson + validWire);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual(validMsg);
  });

  it('identifies message kinds using static type guards', () => {
    const req: RequestMessage = { jsonrpc: '2.0', id: 1, method: 'test' };
    const res: ResponseMessage = { jsonrpc: '2.0', id: 1, result: 'ok' };
    const notif: NotificationMessage = { jsonrpc: '2.0', method: 'notify' };

    expect(LspJsonRpc.isRequest(req)).toBe(true);
    expect(LspJsonRpc.isRequest(notif)).toBe(false);

    expect(LspJsonRpc.isResponse(res)).toBe(true);
    expect(LspJsonRpc.isResponse(req)).toBe(false);

    expect(LspJsonRpc.isNotification(notif)).toBe(true);
    expect(LspJsonRpc.isNotification(req)).toBe(false);
  });
});
