/**
 * QM Editor Shell Detector
 * Phase 1, Step 19 — Integrated Terminal & Safe Process Execution Foundation
 */

import { ShellInfo, TerminalShellType } from './TerminalTypes';

export class ShellDetector {
  /**
   * Detects the host platform
   */
  public static detectPlatform(): 'windows' | 'macos' | 'linux' {
    if (typeof process !== 'undefined' && process.platform) {
      if (process.platform === 'win32') return 'windows';
      if (process.platform === 'darwin') return 'macos';
      return 'linux';
    }

    if (typeof navigator !== 'undefined') {
      const userAgent = (navigator.userAgent || '').toLowerCase();
      const platform = (navigator.platform || '').toLowerCase();

      if (platform.includes('win') || userAgent.includes('windows')) {
        return 'windows';
      }
      if (platform.includes('mac') || userAgent.includes('macintosh')) {
        return 'macos';
      }
    }

    return 'linux';
  }

  /**
   * Returns available shells for the detected platform
   */
  public static getAvailableShells(): ShellInfo[] {
    const platform = this.detectPlatform();

    if (platform === 'windows') {
      return [
        {
          id: 'powershell',
          name: 'PowerShell',
          executable: 'powershell.exe',
          args: ['-NoLogo'],
        },
        {
          id: 'cmd',
          name: 'Command Prompt',
          executable: 'cmd.exe',
          args: [],
        },
      ];
    }

    if (platform === 'macos') {
      return [
        {
          id: 'zsh',
          name: 'Zsh',
          executable: '/bin/zsh',
          args: ['-l'],
        },
        {
          id: 'bash',
          name: 'Bash',
          executable: '/bin/bash',
          args: ['-l'],
        },
      ];
    }

    return [
      {
        id: 'bash',
        name: 'Bash',
        executable: '/bin/bash',
        args: ['-l'],
      },
      {
        id: 'sh',
        name: 'sh',
        executable: '/bin/sh',
        args: [],
      },
    ];
  }

  /**
   * Returns default shell for platform
   */
  public static getDefaultShell(): ShellInfo {
    const shells = this.getAvailableShells();
    return shells[0];
  }

  /**
   * Resolves shell by ID or falls back to default
   */
  public static getShellById(id?: TerminalShellType): ShellInfo {
    const shells = this.getAvailableShells();
    if (!id) return shells[0];
    const found = shells.find((s) => s.id === id);
    return found || shells[0];
  }
}
