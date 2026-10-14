/**
 * QM Editor Language Intelligence Content Sanitizer
 * Phase 04, Step 43 — Hover Information, Signature Help & Contextual Language Intelligence
 */

import { HoverContentPart } from './LanguageIntelligenceTypes';

/**
 * HTML entities escaping for untrusted plain text.
 */
export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Validates whether a URL scheme is safe (http, https, mailto, internal anchor).
 */
export function isSafeUrl(url: string): boolean {
  if (!url) return false;
  const trimmed = url.trim().toLowerCase();
  if (
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('vbscript:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('file:')
  ) {
    return false;
  }
  return (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('/')
  );
}

const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'code',
  'pre',
  'blockquote',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'a',
  'span',
  'div',
  'hr',
]);

const DANGEROUS_TAGS_REGEX = /<\s*(script|style|iframe|object|embed|form|input|button|meta|link|svg|math|applet)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>|<\s*(script|style|iframe|object|embed|form|input|button|meta|link|svg|math|applet)[^>]*\/?>/gi;

/**
 * Sanitizes untrusted HTML by removing dangerous tags, on* event handlers, and unsafe protocols.
 */
export function sanitizeHtml(rawHtml: string): string {
  if (!rawHtml) return '';

  // 1. Strip outright dangerous tags with their contents
  let sanitized = rawHtml.replace(DANGEROUS_TAGS_REGEX, '');

  // 2. Process all remaining HTML tags
  sanitized = sanitized.replace(/<\/?([a-zA-Z0-9]+)(\s+[^>]*)?\/?>/g, (fullMatch, tagName, attrString) => {
    const tag = tagName.toLowerCase();
    const isClosing = fullMatch.startsWith('</');

    if (!ALLOWED_TAGS.has(tag)) {
      // Disallowed tag: return empty or escaped
      return '';
    }

    if (isClosing) {
      return `</${tag}>`;
    }

    if (!attrString) {
      return `<${tag}>`;
    }

    // Filter attributes
    const cleanAttrs: string[] = [];
    const attrRegex = /([a-zA-Z0-9_-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
    let match: RegExpExecArray | null;

    while ((match = attrRegex.exec(attrString)) !== null) {
      const attrName = match[1].toLowerCase();
      const attrVal = match[2] ?? match[3] ?? match[4] ?? '';

      // Block any on* event handler (e.g. onload, onclick, onerror)
      if (attrName.startsWith('on')) {
        continue;
      }

      // Check safe href
      if (attrName === 'href' && tag === 'a') {
        if (isSafeUrl(attrVal)) {
          cleanAttrs.push(`href="${escapeHtml(attrVal)}"`);
        }
      } else if (attrName === 'title') {
        cleanAttrs.push(`title="${escapeHtml(attrVal)}"`);
      } else if (attrName === 'class') {
        // Only allow safe CSS classes (alphanumeric, dashes, underscores)
        const safeClass = attrVal.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim();
        if (safeClass) {
          cleanAttrs.push(`class="${safeClass}"`);
        }
      }
    }

    // For links, enforce security attributes
    if (tag === 'a') {
      cleanAttrs.push('target="_blank"');
      cleanAttrs.push('rel="noopener noreferrer"');
    }

    const attrsFormatted = cleanAttrs.length > 0 ? ` ${cleanAttrs.join(' ')}` : '';
    return `<${tag}${attrsFormatted}>`;
  });

  return sanitized;
}

/**
 * Lightweight, safe Markdown renderer for documentation text and code blocks.
 */
export function renderMarkdownToSafeHtml(markdown: string): string {
  if (!markdown) return '';

  // 1. Code blocks (```language\ncode\n```)
  const codeBlocks: string[] = [];
  let processed = markdown.replace(/```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)```/g, (_, lang, code) => {
    const placeholder = `%%QMCODEBLOCK${codeBlocks.length}%%`;
    const langClass = lang ? ` class="language-${escapeHtml(lang)}"` : '';
    codeBlocks.push(`<pre><code${langClass}>${escapeHtml(code.trim())}</code></pre>`);
    return placeholder;
  });

  // 2. Inline code (`code`)
  const inlineCodes: string[] = [];
  processed = processed.replace(/`([^`]+)`/g, (_, code) => {
    const placeholder = `%%QMINLINECODE${inlineCodes.length}%%`;
    inlineCodes.push(`<code>${escapeHtml(code)}</code>`);
    return placeholder;
  });

  // 3. Headers
  processed = processed.replace(/^### (.*$)/gim, '<h4>$1</h4>');
  processed = processed.replace(/^## (.*$)/gim, '<h3>$1</h3>');
  processed = processed.replace(/^# (.*$)/gim, '<h2>$1</h2>');

  // 4. Bold & Italic
  processed = processed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  processed = processed.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  processed = processed.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  processed = processed.replace(/_([^_]+)_/g, '<em>$1</em>');

  // 5. Links [label](url)
  processed = processed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
    if (isSafeUrl(url)) {
      return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
    }
    return escapeHtml(label);
  });

  // 6. Restore code blocks & inline code
  for (let i = 0; i < codeBlocks.length; i++) {
    processed = processed.replace(`%%QMCODEBLOCK${i}%%`, () => codeBlocks[i]);
  }
  for (let i = 0; i < inlineCodes.length; i++) {
    processed = processed.replace(`%%QMINLINECODE${i}%%`, () => inlineCodes[i]);
  }

  // 7. Sanitize final result to eliminate any nested injections
  return sanitizeHtml(processed);
}

/**
 * Normalizes a single content part to a safe HTML string.
 */
export function renderContentPart(part: HoverContentPart): string {
  if (typeof part === 'string') {
    return renderMarkdownToSafeHtml(part);
  }

  if ('language' in part && 'value' in part) {
    const langClass = part.language ? ` class="language-${escapeHtml(part.language)}"` : '';
    return `<pre><code${langClass}>${escapeHtml(part.value.trim())}</code></pre>`;
  }

  if ('kind' in part && 'value' in part) {
    if (part.kind === 'plaintext') {
      return `<p>${escapeHtml(part.value)}</p>`;
    }
    return renderMarkdownToSafeHtml(part.value);
  }

  return '';
}

/**
 * Renders multiple hover content parts into combined, sanitized HTML.
 */
export function renderHoverContent(contents: HoverContentPart[]): string {
  if (!contents || contents.length === 0) return '';
  return contents
    .map((c) => renderContentPart(c))
    .filter(Boolean)
    .join('<div class="qm-hover-separator"></div>');
}
