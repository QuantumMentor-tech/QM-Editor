import { describe, it, expect, vi } from 'vitest';
import { RuntimeEvents } from './RuntimeEvents';

describe('RuntimeEvents', () => {
  it('subscribes and emits events with payload', () => {
    const events = new RuntimeEvents();
    const listener = vi.fn();

    events.on('application.started', listener);
    events.emit('application.started', { timestamp: 12345 });

    expect(listener).toHaveBeenCalledWith({ timestamp: 12345 });
  });

  it('unsubscribes when calling dispose() on subscription handle', () => {
    const events = new RuntimeEvents();
    const listener = vi.fn();

    const sub = events.on('service.ready', listener);
    events.emit('service.ready', { serviceId: 'test', durationMs: 10 });
    expect(listener).toHaveBeenCalledTimes(1);

    sub.dispose();
    events.emit('service.ready', { serviceId: 'test', durationMs: 20 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('isolates subscriber errors so one failure does not break other listeners', () => {
    const events = new RuntimeEvents();
    const badListener = vi.fn(() => {
      throw new Error('Subscriber exploded!');
    });
    const goodListener = vi.fn();

    events.on('workspace.opened', badListener);
    events.on('workspace.opened', goodListener);

    events.emit('workspace.opened', { uri: 'test://workspace', name: 'Test', generation: 1 });

    expect(badListener).toHaveBeenCalled();
    expect(goodListener).toHaveBeenCalledWith({
      uri: 'test://workspace',
      name: 'Test',
      generation: 1,
    });
  });

  it('once() triggers only on first event emission', () => {
    const events = new RuntimeEvents();
    const listener = vi.fn();

    events.once('application.shutdown', listener);
    events.emit('application.shutdown', { timestamp: 1, durationMs: 5 });
    events.emit('application.shutdown', { timestamp: 2, durationMs: 10 });

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
