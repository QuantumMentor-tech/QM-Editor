/**
 * QM Editor Deterministic Mock LSP Transport
 * Phase 06, Step 56 — Language Server Protocol Foundation, Server Lifecycle & Client Architecture
 *
 * Provides a fully controllable, in-memory transport test double for protocol,
 * lifecycle, and document synchronization verification.
 */

import { ILspTransport } from './ILspTransport';
import { LspJsonRpc } from '../LspJsonRpc';
import { JsonRpcMessage } from '../LspTypes';

export type MockMessageHandler = (message: JsonRpcMessage) => JsonRpcMessage | null | Promise<JsonRpcMessage | null>;

export class MockLspTransport implements ILspTransport {
  private messageListeners = new Set<(chunk: string) => void>();
  private errorListeners = new Set<(error: Error) => void>();
  private closeListeners = new Set<(exitCode?: number) => void>();
  private stderrListeners = new Set<(log: string) => void>();

  private alive: boolean = false;
  private readonly sentRawChunks: string[] = [];
  private readonly sentMessages: JsonRpcMessage[] = [];
  private readonly jsonRpc = new LspJsonRpc();

  public messageHandler?: MockMessageHandler;

  public async start(): Promise<void> {
    this.alive = true;
  }

  public async send(data: string): Promise<void> {
    if (!this.alive) {
      throw new Error('Cannot send on closed MockLspTransport.');
    }

    this.sentRawChunks.push(data);
    const parsed = this.jsonRpc.append(data);

    for (const msg of parsed) {
      this.sentMessages.push(msg);

      if (this.messageHandler) {
        Promise.resolve(this.messageHandler(msg))
          .then((reply) => {
            if (reply && this.alive) {
              this.simulateIncomingMessage(reply);
            }
          })
          .catch((err) => {
            this.emitError(err);
          });
      }
    }
  }

  public onMessage(listener: (chunk: string) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  public onError(listener: (error: Error) => void): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  public onClose(listener: (exitCode?: number) => void): () => void {
    this.closeListeners.add(listener);
    return () => this.closeListeners.delete(listener);
  }

  public onStderr(listener: (log: string) => void): () => void {
    this.stderrListeners.add(listener);
    return () => this.stderrListeners.delete(listener);
  }

  public async close(): Promise<void> {
    if (!this.alive) return;
    this.alive = false;
    for (const listener of this.closeListeners) {
      listener(0);
    }
  }

  public isAlive(): boolean {
    return this.alive;
  }

  // ---------------------------------------------------------------------------
  // Test Instrumentation Methods
  // ---------------------------------------------------------------------------

  /**
   * Simulates incoming raw chunk data from the language server.
   */
  public simulateIncomingChunk(chunk: string): void {
    if (!this.alive) return;
    for (const listener of this.messageListeners) {
      listener(chunk);
    }
  }

  /**
   * Serializes and emits a JSON-RPC message as framed wire data to the client.
   */
  public simulateIncomingMessage(msg: JsonRpcMessage): void {
    const serialized = LspJsonRpc.serialize(msg);
    this.simulateIncomingChunk(serialized);
  }

  /**
   * Simulates an unexpected server process crash or failure.
   */
  public simulateCrash(exitCode: number = 1): void {
    if (!this.alive) return;
    this.alive = false;
    for (const listener of this.closeListeners) {
      listener(exitCode);
    }
  }

  /**
   * Simulates a transport-level error.
   */
  public emitError(error: Error): void {
    for (const listener of this.errorListeners) {
      listener(error);
    }
  }

  /**
   * Simulates stderr log line from server.
   */
  public simulateStderr(logLine: string): void {
    for (const listener of this.stderrListeners) {
      listener(logLine);
    }
  }

  public getSentMessages(): readonly JsonRpcMessage[] {
    return this.sentMessages;
  }

  public getSentRawChunks(): readonly string[] {
    return this.sentRawChunks;
  }

  public clearSentHistory(): void {
    this.sentMessages.length = 0;
    this.sentRawChunks.length = 0;
  }
}
