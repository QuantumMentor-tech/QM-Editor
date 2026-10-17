/**
 * QM Editor - LSP Code Lens Security Validator Tests
 * Phase 06, Step 66 — LSP Code Lens, Inline Actions & Safe Command Integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LspCodeLensSecurityValidator } from './LspCodeLensSecurityValidator';
import { CommandRegistry } from '../../commands/CommandRegistry';

describe('LspCodeLensSecurityValidator', () => {
  let registry: CommandRegistry;

  beforeEach(() => {
    registry = new CommandRegistry();
    registry.register({
      id: 'workbench.action.customTrusted',
      label: 'Trusted Custom Command',
      category: 'editor',
      execute: () => {},
    });
  });

  describe('validateCommand', () => {
    it('accepts allowlisted built-in commands', () => {
      const cmd = {
        title: '3 references',
        command: 'editor.showReferences',
        arguments: ['file:///test.ts', { line: 1, character: 5 }, []],
      };

      const result = LspCodeLensSecurityValidator.validateCommand(cmd, registry);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedCommand).toBeDefined();
      expect(result.sanitizedCommand?.title).toBe('3 references');
      expect(result.sanitizedCommand?.command).toBe('editor.showReferences');
      expect(result.sanitizedCommand?.isTrusted).toBe(true);
    });

    it('accepts registered commands in CommandRegistry', () => {
      const cmd = {
        title: 'Run Trusted Action',
        command: 'workbench.action.customTrusted',
      };

      const result = LspCodeLensSecurityValidator.validateCommand(cmd, registry);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedCommand?.command).toBe('workbench.action.customTrusted');
    });

    it('rejects unknown commands not in allowlist or registry', () => {
      const cmd = {
        title: 'Run Unknown Extension',
        command: 'unregistered.custom.action',
      };

      const result = LspCodeLensSecurityValidator.validateCommand(cmd, registry);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('not permitted');
    });

    it('blocks dangerous shell, terminal, and process commands', () => {
      const dangerousCommands = [
        'shell.execute',
        'terminal.run',
        'terminal.spawn',
        'process.exec',
        'eval.payload',
        'javascript:void(0)',
        'powershell.exe',
        'cmd.exe /c calc',
        'bash -c "rm -rf /"',
        'sh',
        'rm -rf',
        'unlink.file',
      ];

      for (const dangerousCmd of dangerousCommands) {
        const cmd = {
          title: 'Exploit Test',
          command: dangerousCmd,
        };
        const result = LspCodeLensSecurityValidator.validateCommand(cmd, registry);
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('prohibited pattern');
      }
    });

    it('sanitizes malicious script tags and dangerous HTML in title', () => {
      const cmd = {
        title: 'Ref<script>alert("xss")</script>erences',
        command: 'editor.showReferences',
      };

      const result = LspCodeLensSecurityValidator.validateCommand(cmd, registry);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedCommand?.title).toBe('References');
      expect(result.sanitizedCommand?.title).not.toContain('<script>');
    });

    it('rejects empty or whitespace-only titles', () => {
      const cmd1 = { title: '', command: 'editor.showReferences' };
      const cmd2 = { title: '   \u0000  ', command: 'editor.showReferences' };

      expect(LspCodeLensSecurityValidator.validateCommand(cmd1, registry).isValid).toBe(false);
      expect(LspCodeLensSecurityValidator.validateCommand(cmd2, registry).isValid).toBe(false);
    });
  });

  describe('validateArguments', () => {
    it('validates and allows normal primitive arguments', () => {
      const args = ['file:///app.ts', 42, true, { line: 10 }];
      const result = LspCodeLensSecurityValidator.validateArguments(args);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedArgs).toEqual(args);
    });

    it('rejects argument arrays exceeding MAX_ARGUMENT_COUNT', () => {
      const excessiveArgs = new Array(25).fill(1);
      const result = LspCodeLensSecurityValidator.validateArguments(excessiveArgs);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('exceeds maximum limit');
    });

    it('rejects oversized payload JSON strings', () => {
      const hugeString = 'a'.repeat(60 * 1024);
      const result = LspCodeLensSecurityValidator.validateArguments([hugeString]);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('exceeds maximum limit');
    });

    it('rejects arguments containing directory traversal sequences (..)', () => {
      const badPaths = [
        ['../../etc/passwd'],
        ['C:\\workspace\\..\\..\\Windows\\System32'],
        ['src/../secret.env'],
      ];

      for (const bad of badPaths) {
        const result = LspCodeLensSecurityValidator.validateArguments(bad);
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('path traversal sequence');
      }
    });
  });

  describe('validateRange', () => {
    const docLines = ['const a = 1;', 'function test() {', '  return a;', '}'];

    it('accepts valid range within document bounds', () => {
      const range = {
        start: { line: 1, character: 0 },
        end: { line: 1, character: 15 },
      };
      expect(LspCodeLensSecurityValidator.validateRange(range, docLines)).toBe(true);
    });

    it('rejects range with negative or non-integer coordinates', () => {
      expect(LspCodeLensSecurityValidator.validateRange({ start: { line: -1, character: 0 }, end: { line: 0, character: 1 } }, docLines)).toBe(false);
      expect(LspCodeLensSecurityValidator.validateRange({ start: { line: 1.5, character: 0 }, end: { line: 2, character: 1 } }, docLines)).toBe(false);
    });

    it('rejects inverted range where start > end', () => {
      const inverted = {
        start: { line: 3, character: 0 },
        end: { line: 1, character: 0 },
      };
      expect(LspCodeLensSecurityValidator.validateRange(inverted, docLines)).toBe(false);
    });

    it('rejects range exceeding document line count', () => {
      const outOfBounds = {
        start: { line: 10, character: 0 },
        end: { line: 10, character: 5 },
      };
      expect(LspCodeLensSecurityValidator.validateRange(outOfBounds, docLines)).toBe(false);
    });
  });
});
