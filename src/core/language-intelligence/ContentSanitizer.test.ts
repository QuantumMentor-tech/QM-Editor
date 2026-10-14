/**
 * QM Editor Content Sanitizer Unit Tests
 * Phase 04, Step 43 — Hover Information, Signature Help & Contextual Language Intelligence
 */

import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  isSafeUrl,
  sanitizeHtml,
  renderMarkdownToSafeHtml,
  renderHoverContent,
} from './ContentSanitizer';

describe('ContentSanitizer', () => {
  describe('escapeHtml', () => {
    it('escapes special HTML characters', () => {
      expect(escapeHtml('<script>alert("xss & \'test\'")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss &amp; &#39;test&#39;&quot;)&lt;/script&gt;'
      );
    });

    it('handles empty or null string gracefully', () => {
      expect(escapeHtml('')).toBe('');
    });
  });

  describe('isSafeUrl', () => {
    it('accepts safe http, https, mailto, and relative links', () => {
      expect(isSafeUrl('https://example.com')).toBe(true);
      expect(isSafeUrl('http://localhost:3000')).toBe(true);
      expect(isSafeUrl('mailto:dev@example.com')).toBe(true);
      expect(isSafeUrl('#section-2')).toBe(true);
      expect(isSafeUrl('/docs/api')).toBe(true);
    });

    it('rejects dangerous protocols (javascript, vbscript, data, file)', () => {
      expect(isSafeUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeUrl('JAVASCRIPT:alert(document.cookie)')).toBe(false);
      expect(isSafeUrl('vbscript:msgbox(1)')).toBe(false);
      expect(isSafeUrl('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==')).toBe(false);
      expect(isSafeUrl('file:///etc/passwd')).toBe(false);
    });
  });

  describe('sanitizeHtml', () => {
    it('strips script tags and their content completely', () => {
      const malicious = '<div>Safe text<script>alert("hacked!");</script></div>';
      const result = sanitizeHtml(malicious);
      expect(result).not.toContain('<script');
      expect(result).not.toContain('alert');
      expect(result).toContain('<div>Safe text</div>');
    });

    it('strips iframes, objects, embeds, and style tags', () => {
      const malicious = '<iframe src="https://evil.com"></iframe><object data="test"></object><style>body { display: none; }</style><p>Visible</p>';
      const result = sanitizeHtml(malicious);
      expect(result).not.toContain('<iframe');
      expect(result).not.toContain('<object');
      expect(result).not.toContain('<style');
      expect(result).toContain('<p>Visible</p>');
    });

    it('removes inline on* event handler attributes (onerror, onload, onclick)', () => {
      const malicious = '<img src="x" onerror="alert(1)" /><p onclick="evil()">Click</p>';
      const result = sanitizeHtml(malicious);
      expect(result).not.toContain('onerror');
      expect(result).not.toContain('onclick');
      expect(result).toContain('<p>Click</p>');
    });

    it('enforces rel="noopener noreferrer" and target="_blank" on safe links', () => {
      const html = '<a href="https://example.com">Documentation</a>';
      const result = sanitizeHtml(html);
      expect(result).toContain('href="https://example.com"');
      expect(result).toContain('target="_blank"');
      expect(result).toContain('rel="noopener noreferrer"');
    });

    it('strips javascript: URLs from href attributes', () => {
      const html = '<a href="javascript:alert(1)">Exploit</a>';
      const result = sanitizeHtml(html);
      expect(result).not.toContain('javascript');
      expect(result).not.toContain('href');
    });
  });

  describe('renderMarkdownToSafeHtml', () => {
    it('renders code blocks with language classes', () => {
      const markdown = '```typescript\nconst x: number = 42;\n```';
      const html = renderMarkdownToSafeHtml(markdown);
      expect(html).toContain('<pre><code class="language-typescript">const x: number = 42;</code></pre>');
    });

    it('renders inline code, bold, italic, and safe links', () => {
      const markdown = 'Type `string` is **immutable** and *fast*. Read [Docs](https://typescriptlang.org).';
      const html = renderMarkdownToSafeHtml(markdown);
      expect(html).toContain('<code>string</code>');
      expect(html).toContain('<strong>immutable</strong>');
      expect(html).toContain('<em>fast</em>');
      expect(html).toContain('<a href="https://typescriptlang.org" target="_blank" rel="noopener noreferrer">Docs</a>');
    });

    it('strips malicious script injected via markdown', () => {
      const markdown = 'Normal text <script>alert("pwned")</script> more text';
      const html = renderMarkdownToSafeHtml(markdown);
      expect(html).not.toContain('<script');
      expect(html).not.toContain('alert');
    });
  });

  describe('renderHoverContent', () => {
    it('combines strings, code blocks, and structured markup safely', () => {
      const parts = [
        { language: 'typescript', value: 'function calculate(x: number): number' },
        'Calculates total value **securely**.',
        { kind: 'plaintext' as const, value: 'Additional plain info & notes <not-a-tag>' },
      ];

      const html = renderHoverContent(parts);
      expect(html).toContain('<pre><code class="language-typescript">function calculate(x: number): number</code></pre>');
      expect(html).toContain('<strong>securely</strong>');
      expect(html).toContain('&lt;not-a-tag&gt;');
      expect(html).toContain('class="qm-hover-separator"');
    });
  });
});
