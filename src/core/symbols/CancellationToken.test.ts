import { describe, it, expect, vi } from 'vitest';
import { CancellationTokenSource, CancellationTokenImpl } from './CancellationToken';

describe('CancellationToken', () => {
  it('starts uncancelled', () => {
    const cts = new CancellationTokenSource();
    expect(cts.token.isCancellationRequested).toBe(false);
  });

  it('sets isCancellationRequested when cancelled', () => {
    const cts = new CancellationTokenSource();
    cts.cancel();
    expect(cts.token.isCancellationRequested).toBe(true);
  });

  it('notifies registered cancellation listeners', () => {
    const cts = new CancellationTokenSource();
    const listener = vi.fn();

    cts.token.onCancellationRequested(listener);
    expect(listener).not.toHaveBeenCalled();

    cts.cancel();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('immediately fires listener if already cancelled', () => {
    const cts = new CancellationTokenSource();
    cts.cancel();

    const listener = vi.fn();
    cts.token.onCancellationRequested(listener);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes listener before cancellation occurs', () => {
    const cts = new CancellationTokenSource();
    const listener = vi.fn();

    const unsubscribe = cts.token.onCancellationRequested(listener);
    unsubscribe();

    cts.cancel();
    expect(listener).not.toHaveBeenCalled();
  });

  it('disposes cleanly and suppresses errors in listeners', () => {
    const impl = new CancellationTokenImpl();
    impl.onCancellationRequested(() => {
      throw new Error('Explosion');
    });

    expect(() => impl.cancel()).not.toThrow();
    expect(() => impl.dispose()).not.toThrow();
  });
});
