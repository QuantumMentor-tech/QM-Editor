import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventCoalescer } from './EventCoalescer';

describe('EventCoalescer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces and flushes events within configured windowMs', () => {
    const onFlush = vi.fn();
    const coalescer = new EventCoalescer({ windowMs: 50, onFlush });

    coalescer.push({
      uri: 'file:///workspace/src/app.ts',
      type: 'modify',
      timestamp: Date.now(),
    });

    expect(onFlush).not.toHaveBeenCalled();

    vi.advanceTimersByTime(49);
    expect(onFlush).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2);
    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush).toHaveBeenCalledWith([
      expect.objectContaining({
        uri: 'file:///workspace/src/app.ts',
        type: 'modify',
      }),
    ]);
  });

  it('coalesces create followed by modify into a single create event', () => {
    const onFlush = vi.fn();
    const coalescer = new EventCoalescer({ windowMs: 50, onFlush });

    coalescer.push({
      uri: 'file:///workspace/src/new.ts',
      type: 'create',
      timestamp: Date.now(),
    });

    coalescer.push({
      uri: 'file:///workspace/src/new.ts',
      type: 'modify',
      timestamp: Date.now() + 5,
    });

    vi.advanceTimersByTime(60);

    expect(onFlush).toHaveBeenCalledTimes(1);
    const events = onFlush.mock.calls[0][0];
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('create');
    expect(events[0].uri).toBe('file:///workspace/src/new.ts');
  });

  it('cancels create followed by delete (ephemeral file created and removed)', () => {
    const onFlush = vi.fn();
    const coalescer = new EventCoalescer({ windowMs: 50, onFlush });

    coalescer.push({
      uri: 'file:///workspace/temp.tmp',
      type: 'create',
      timestamp: Date.now(),
    });

    coalescer.push({
      uri: 'file:///workspace/temp.tmp',
      type: 'delete',
      timestamp: Date.now() + 10,
    });

    vi.advanceTimersByTime(60);

    // Ephemeral file absorbed: nothing dispatched
    expect(onFlush).not.toHaveBeenCalled();
  });

  it('coalesces delete followed by create into modify', () => {
    const onFlush = vi.fn();
    const coalescer = new EventCoalescer({ windowMs: 50, onFlush });

    coalescer.push({
      uri: 'file:///workspace/replaced.ts',
      type: 'delete',
      timestamp: Date.now(),
    });

    coalescer.push({
      uri: 'file:///workspace/replaced.ts',
      type: 'create',
      timestamp: Date.now() + 10,
    });

    vi.advanceTimersByTime(60);

    expect(onFlush).toHaveBeenCalledTimes(1);
    const events = onFlush.mock.calls[0][0];
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('modify');
  });

  it('suppresses internal self-writes to avoid echo events', () => {
    const onFlush = vi.fn();
    const coalescer = new EventCoalescer({
      windowMs: 50,
      writeSuppressionMs: 500,
      onFlush,
    });

    coalescer.markInternalWrite('file:///workspace/saved.ts', 500);

    // Incoming filesystem event from the editor's own save
    coalescer.push({
      uri: 'file:///workspace/saved.ts',
      type: 'modify',
      timestamp: Date.now(),
    });

    vi.advanceTimersByTime(60);
    expect(onFlush).not.toHaveBeenCalled();

    // After expiration window, new external events are no longer suppressed
    vi.advanceTimersByTime(600);

    coalescer.push({
      uri: 'file:///workspace/saved.ts',
      type: 'modify',
      timestamp: Date.now(),
    });

    vi.advanceTimersByTime(60);
    expect(onFlush).toHaveBeenCalledTimes(1);
  });

  it('ignores standard excluded directories (.git, node_modules, dist)', () => {
    const onFlush = vi.fn();
    const coalescer = new EventCoalescer({ windowMs: 50, onFlush });

    coalescer.push({
      uri: 'file:///workspace/.git/HEAD',
      type: 'modify',
      timestamp: Date.now(),
    });
    coalescer.push({
      uri: 'file:///workspace/node_modules/lodash/index.js',
      type: 'create',
      timestamp: Date.now(),
    });
    coalescer.push({
      uri: 'file:///workspace/dist/bundle.js',
      type: 'modify',
      timestamp: Date.now(),
    });

    vi.advanceTimersByTime(60);
    expect(onFlush).not.toHaveBeenCalled();
  });

  it('dispatches immediately on manual flush()', () => {
    const onFlush = vi.fn();
    const coalescer = new EventCoalescer({ windowMs: 1000, onFlush });

    coalescer.push({
      uri: 'file:///workspace/manual.ts',
      type: 'modify',
      timestamp: Date.now(),
    });

    expect(onFlush).not.toHaveBeenCalled();
    coalescer.flush();
    expect(onFlush).toHaveBeenCalledTimes(1);
  });

  it('cleans up resources on dispose()', () => {
    const onFlush = vi.fn();
    const coalescer = new EventCoalescer({ windowMs: 50, onFlush });

    coalescer.push({
      uri: 'file:///workspace/file.ts',
      type: 'modify',
      timestamp: Date.now(),
    });

    coalescer.dispose();
    vi.advanceTimersByTime(100);

    expect(onFlush).not.toHaveBeenCalled();
  });
});
