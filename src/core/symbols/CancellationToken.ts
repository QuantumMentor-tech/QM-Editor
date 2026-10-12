/**
 * QM Editor Cancellation Token Implementation
 * Phase 04, Step 35 — Symbol Infrastructure, Outline & Symbol Navigation
 */

import { CancellationToken } from './SymbolTypes';

export class CancellationTokenImpl implements CancellationToken {
  private _isCancelled: boolean = false;
  private readonly listeners: Set<() => void> = new Set();

  public get isCancellationRequested(): boolean {
    return this._isCancelled;
  }

  public onCancellationRequested(listener: () => void): () => void {
    if (this._isCancelled) {
      listener();
      return () => {};
    }
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public cancel(): void {
    if (this._isCancelled) return;
    this._isCancelled = true;
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        // Suppress listener errors during cancellation cascade
      }
    }
    this.listeners.clear();
  }

  public dispose(): void {
    this.listeners.clear();
  }
}

export class CancellationTokenSource {
  private readonly _token: CancellationTokenImpl = new CancellationTokenImpl();

  public get token(): CancellationToken {
    return this._token;
  }

  public cancel(): void {
    this._token.cancel();
  }

  public dispose(): void {
    this._token.dispose();
  }
}
