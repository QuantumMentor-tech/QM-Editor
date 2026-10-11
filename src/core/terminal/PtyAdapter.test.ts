import { describe, it, expect, vi } from 'vitest';
import { PtyAdapter } from './PtyAdapter';

describe('PtyAdapter', () => {
  it('creates session and emits initial banner and prompt', async () => {
    const pty = new PtyAdapter();
    const outputSpy = vi.fn();
    pty.onOutput(outputSpy);

    await pty.createSession({
      id: 'test-1',
      shell: { id: 'powershell', name: 'PowerShell', executable: 'powershell.exe' },
      cwd: 'C:\\test',
    });

    expect(outputSpy).toHaveBeenCalled();
    const emittedTexts = outputSpy.mock.calls.map((call) => call[1].text).join('');
    expect(emittedTexts).toContain('QM Editor Terminal');
    expect(emittedTexts).toContain('PS C:\\test>');
  });

  it('handles help and echo commands and emits output', async () => {
    const pty = new PtyAdapter();
    const outputSpy = vi.fn();
    pty.onOutput(outputSpy);

    await pty.createSession({ id: 'test-2' });

    // Send echo command
    await pty.write('test-2', 'echo hello world\r');

    const emittedTexts = outputSpy.mock.calls.map((call) => call[1].text).join('');
    expect(emittedTexts).toContain('hello world');
  });

  it('handles exit command and fires onExit listener', async () => {
    const pty = new PtyAdapter();
    const exitSpy = vi.fn();
    pty.onExit(exitSpy);

    await pty.createSession({ id: 'test-3' });
    await pty.write('test-3', 'exit\r');

    expect(exitSpy).toHaveBeenCalledWith('test-3', 0);
  });

  it('handles resize without errors', async () => {
    const pty = new PtyAdapter();
    await pty.createSession({ id: 'test-4' });
    await expect(pty.resize('test-4', 120, 30)).resolves.not.toThrow();
  });
});
