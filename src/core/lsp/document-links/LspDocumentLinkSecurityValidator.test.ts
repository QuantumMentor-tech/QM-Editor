/**
 * QM Editor - LSP Document Link Security Validator Unit Tests
 * Phase 06, Step 67 — LSP Document Links, Clickable Resource References & Safe URI Navigation
 */

import { describe, it, expect } from 'vitest';
import { LspDocumentLinkSecurityValidator } from './LspDocumentLinkSecurityValidator';

describe('LspDocumentLinkSecurityValidator', () => {
  const docUri = 'file:///C:/project/src/index.ts';
  const workspaceRoots = ['C:/project'];

  describe('validateRange', () => {
    const lines = ['import { foo } from "./utils";', 'const x = 10;', 'export default x;'];

    it('accepts valid range within document bounds', () => {
      const range = {
        start: { line: 0, character: 20 },
        end: { line: 0, character: 29 },
      };
      expect(LspDocumentLinkSecurityValidator.validateRange(range, lines)).toBe(true);
    });

    it('rejects range with zero length (start === end)', () => {
      const range = {
        start: { line: 0, character: 5 },
        end: { line: 0, character: 5 },
      };
      expect(LspDocumentLinkSecurityValidator.validateRange(range, lines)).toBe(false);
    });

    it('rejects inverted range (start > end)', () => {
      const range = {
        start: { line: 1, character: 5 },
        end: { line: 0, character: 5 },
      };
      expect(LspDocumentLinkSecurityValidator.validateRange(range, lines)).toBe(false);
    });

    it('rejects range with negative or non-integer coordinates', () => {
      expect(
        LspDocumentLinkSecurityValidator.validateRange(
          { start: { line: -1, character: 0 }, end: { line: 0, character: 5 } },
          lines
        )
      ).toBe(false);
      expect(
        LspDocumentLinkSecurityValidator.validateRange(
          { start: { line: 0.5, character: 0 }, end: { line: 1, character: 5 } },
          lines
        )
      ).toBe(false);
    });

    it('rejects range with line or character exceeding document bounds', () => {
      expect(
        LspDocumentLinkSecurityValidator.validateRange(
          { start: { line: 10, character: 0 }, end: { line: 10, character: 5 } },
          lines
        )
      ).toBe(false);
      expect(
        LspDocumentLinkSecurityValidator.validateRange(
          { start: { line: 0, character: 0 }, end: { line: 0, character: 100 } },
          lines
        )
      ).toBe(false);
    });
  });

  describe('classifyAndValidateUri', () => {
    it('classifies same-document fragment targets', () => {
      const res1 = LspDocumentLinkSecurityValidator.classifyAndValidateUri('#L15', docUri, workspaceRoots);
      expect(res1.isValid).toBe(true);
      expect(res1.classification).toBe('same-document');
      expect(res1.fragment).toBe('L15');

      const res2 = LspDocumentLinkSecurityValidator.classifyAndValidateUri(
        'file:///C:/project/src/index.ts#section-3',
        docUri,
        workspaceRoots
      );
      expect(res2.isValid).toBe(true);
      expect(res2.classification).toBe('same-document');
      expect(res2.fragment).toBe('section-3');
    });

    it('classifies approved external web URLs', () => {
      const resHttps = LspDocumentLinkSecurityValidator.classifyAndValidateUri(
        'https://developer.mozilla.org/en-US/docs/Web',
        docUri,
        workspaceRoots
      );
      expect(resHttps.isValid).toBe(true);
      expect(resHttps.classification).toBe('external-web');
      expect(resHttps.normalizedUri).toBe('https://developer.mozilla.org/en-US/docs/Web');

      const resMailto = LspDocumentLinkSecurityValidator.classifyAndValidateUri(
        'mailto:developer@example.com',
        docUri,
        workspaceRoots
      );
      expect(resMailto.isValid).toBe(true);
      expect(resMailto.classification).toBe('external-web');
    });

    it('classifies workspace-local file references', () => {
      const resRelative = LspDocumentLinkSecurityValidator.classifyAndValidateUri(
        './utils.ts',
        docUri,
        workspaceRoots
      );
      expect(resRelative.isValid).toBe(true);
      expect(resRelative.classification).toBe('workspace-local');
      expect(resRelative.normalizedUri).toContain('project/src/utils.ts');

      const resAbsolute = LspDocumentLinkSecurityValidator.classifyAndValidateUri(
        'file:///C:/project/src/models/user.ts',
        docUri,
        workspaceRoots
      );
      expect(resAbsolute.isValid).toBe(true);
      expect(resAbsolute.classification).toBe('workspace-local');
    });

    it('classifies files outside workspace roots', () => {
      const resOutside = LspDocumentLinkSecurityValidator.classifyAndValidateUri(
        'file:///D:/other-workspace/config.json',
        docUri,
        workspaceRoots
      );
      expect(resOutside.isValid).toBe(true);
      expect(resOutside.classification).toBe('outside-workspace');
    });

    it('unconditionally blocks prohibited dangerous schemes', () => {
      const dangerousSchemes = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'vbscript:MsgBox("PWNED")',
        'shell:runCommand',
        'powershell:Invoke-Expression',
        'cmd:calc.exe',
        'exec:rm -rf /',
        'node:process.exit()',
        'eval:2+2',
        'file+ssh://evil.server/repo',
      ];

      for (const scheme of dangerousSchemes) {
        const res = LspDocumentLinkSecurityValidator.classifyAndValidateUri(scheme, docUri, workspaceRoots);
        expect(res.isValid).toBe(false);
        expect(res.classification).toBe('unsupported');
        expect(res.reason).toContain('prohibited scheme');
      }
    });

    it('unconditionally blocks path traversal sequences', () => {
      const traversalTargets = [
        '../../etc/passwd',
        '..\\..\\Windows\\System32\\calc.exe',
        './sub/%2e%2e/%2e%2e/secret.key',
        'path/with/\0/nullbyte',
        'path/%00/nullbyte',
      ];

      for (const target of traversalTargets) {
        const res = LspDocumentLinkSecurityValidator.classifyAndValidateUri(target, docUri, workspaceRoots);
        expect(res.isValid).toBe(false);
        expect(res.classification).toBe('unsupported');
        expect(res.reason).toContain('path traversal');
      }
    });

    it('rejects oversized URIs', () => {
      const hugeUri = 'https://example.com/' + 'a'.repeat(2500);
      const res = LspDocumentLinkSecurityValidator.classifyAndValidateUri(hugeUri, docUri, workspaceRoots);
      expect(res.isValid).toBe(false);
      expect(res.classification).toBe('malformed');
      expect(res.reason).toContain('maximum length');
    });

    it('rejects empty or whitespace-only targets', () => {
      expect(LspDocumentLinkSecurityValidator.classifyAndValidateUri('', docUri, workspaceRoots).isValid).toBe(false);
      expect(LspDocumentLinkSecurityValidator.classifyAndValidateUri('   ', docUri, workspaceRoots).isValid).toBe(false);
      expect(LspDocumentLinkSecurityValidator.classifyAndValidateUri(null, docUri, workspaceRoots).isValid).toBe(false);
    });
  });

  describe('sanitizeTooltip', () => {
    it('returns clean string unchanged', () => {
      expect(LspDocumentLinkSecurityValidator.sanitizeTooltip('Follow link to documentation')).toBe(
        'Follow link to documentation'
      );
    });

    it('strips script and iframe injection tags', () => {
      const malicious = 'Documentation <script>alert("xss")</script><iframe src="evil.com"></iframe>link';
      const sanitized = LspDocumentLinkSecurityValidator.sanitizeTooltip(malicious);
      expect(sanitized).toBe('Documentation link');
    });

    it('truncates tooltip exceeding maximum length', () => {
      const longText = 'A'.repeat(600);
      const sanitized = LspDocumentLinkSecurityValidator.sanitizeTooltip(longText);
      expect(sanitized).toBeDefined();
      expect(sanitized!.length).toBe(LspDocumentLinkSecurityValidator.MAX_TOOLTIP_LENGTH);
      expect(sanitized!.endsWith('...')).toBe(true);
    });

    it('returns undefined for non-strings or empty strings', () => {
      expect(LspDocumentLinkSecurityValidator.sanitizeTooltip(undefined)).toBeUndefined();
      expect(LspDocumentLinkSecurityValidator.sanitizeTooltip(null)).toBeUndefined();
      expect(LspDocumentLinkSecurityValidator.sanitizeTooltip('   ')).toBeUndefined();
    });
  });
});
