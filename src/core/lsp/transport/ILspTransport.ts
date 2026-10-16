/**
 * QM Editor Canonical LSP Transport Abstraction Interface
 * Phase 06, Step 56 — Language Server Protocol Foundation, Server Lifecycle & Client Architecture
 */

export interface ILspTransport {
  /**
   * Starts the underlying communication channel (e.g. spawns process or connects socket).
   */
  start(): Promise<void>;

  /**
   * Sends raw serialized protocol data to the language server.
   */
  send(data: string): Promise<void>;

  /**
   * Subscribes to incoming protocol data chunks received from the language server.
   */
  onMessage(listener: (chunk: string) => void): () => void;

  /**
   * Subscribes to transport errors.
   */
  onError(listener: (error: Error) => void): () => void;

  /**
   * Subscribes to transport termination / process close events.
   */
  onClose(listener: (exitCode?: number) => void): () => void;

  /**
   * Subscribes to stderr diagnostic logs from the process.
   */
  onStderr?(listener: (logLine: string) => void): () => void;

  /**
   * Gracefully or forcefully terminates the transport.
   */
  close(): Promise<void>;

  /**
   * Returns whether the transport channel is currently alive and active.
   */
  isAlive(): boolean;
}
