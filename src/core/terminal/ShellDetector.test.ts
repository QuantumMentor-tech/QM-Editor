import { describe, it, expect } from 'vitest';
import { ShellDetector } from './ShellDetector';

describe('ShellDetector', () => {
  it('detects a valid platform', () => {
    const platform = ShellDetector.detectPlatform();
    expect(['windows', 'macos', 'linux']).toContain(platform);
  });

  it('provides available shells with valid executables', () => {
    const shells = ShellDetector.getAvailableShells();
    expect(shells.length).toBeGreaterThan(0);
    expect(shells[0].executable).toBeDefined();
    expect(shells[0].name).toBeDefined();
  });

  it('provides a default shell', () => {
    const defaultShell = ShellDetector.getDefaultShell();
    expect(defaultShell).toBeDefined();
    expect(defaultShell.id).toBeDefined();
  });

  it('resolves shell by ID or falls back gracefully', () => {
    const shell = ShellDetector.getShellById('powershell');
    expect(shell).toBeDefined();

    const fallback = ShellDetector.getShellById('nonexistent' as any);
    expect(fallback).toBeDefined();
  });
});
