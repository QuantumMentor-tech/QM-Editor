import { describe, it, expect, beforeEach } from 'vitest';
import { TerminalService } from './TerminalService';

describe('TerminalService', () => {
  let service: TerminalService;

  beforeEach(() => {
    service = new TerminalService();
  });

  it('initializes with zero sessions and no active session', () => {
    expect(service.getAllSessions()).toHaveLength(0);
    expect(service.getActiveSessionId()).toBeNull();
    expect(service.getActiveSession()).toBeUndefined();
  });

  it('creates and starts a new terminal session', async () => {
    const session = await service.createSession({ title: 'Test Shell' });
    expect(session).toBeDefined();
    expect(session.getTitle()).toBe('Test Shell');
    expect(session.getStatus()).toBe('running');
    expect(service.getAllSessions()).toHaveLength(1);
    expect(service.getActiveSessionId()).toBe(session.getId());
  });

  it('switches between multiple terminal sessions', async () => {
    const s1 = await service.createSession({ title: 'Shell 1' });
    const s2 = await service.createSession({ title: 'Shell 2' });

    expect(service.getAllSessions()).toHaveLength(2);
    expect(service.getActiveSessionId()).toBe(s2.getId());

    service.setActiveSession(s1.getId());
    expect(service.getActiveSessionId()).toBe(s1.getId());

    service.nextSession();
    expect(service.getActiveSessionId()).toBe(s2.getId());

    service.previousSession();
    expect(service.getActiveSessionId()).toBe(s1.getId());
  });

  it('closes a terminal session and updates active session cleanly', async () => {
    const s1 = await service.createSession({ title: 'Shell 1' });
    const s2 = await service.createSession({ title: 'Shell 2' });

    await service.closeSession(s2.getId());
    expect(service.getAllSessions()).toHaveLength(1);
    expect(service.getActiveSessionId()).toBe(s1.getId());

    await service.closeSession(s1.getId());
    expect(service.getAllSessions()).toHaveLength(0);
    expect(service.getActiveSessionId()).toBeNull();
  });

  it('clears active terminal output buffer without closing session', async () => {
    const session = await service.createSession({ title: 'Shell' });
    await session.write('echo hello\r\n');

    expect(session.getLines().length).toBeGreaterThan(0);
    service.clearActiveSession();
    expect(session.getLines()).toEqual(['']);
  });
});
