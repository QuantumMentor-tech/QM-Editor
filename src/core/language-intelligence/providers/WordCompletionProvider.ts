/**
 * QM Editor Built-in Word-Based Completion Provider
 * Phase 04, Step 42 — Language Intelligence Provider Architecture & Completion Framework
 */

import {
  LanguageIntelligenceProvider,
  CompletionRequest,
  CompletionItem,
} from '../LanguageIntelligenceTypes';
import { CancellationToken } from '../../symbols/SymbolTypes';
import { globalDocumentEngine } from '../../documents/DocumentEngine';
import { Range } from '../../navigation/LocationTypes';

export class WordCompletionProvider implements LanguageIntelligenceProvider {
  public readonly providerId = 'builtin.words';
  public readonly displayName = 'Word-Based Buffer Completion';
  public readonly supportedLanguages = ['*'];
  public readonly priority = 5; // Low fallback priority

  public readonly capabilities = {
    completion: {
      triggerCharacters: [],
      supportsResolveDetails: false,
      priority: 5,
    },
  };

  public async provideCompletions(
    request: CompletionRequest,
    token?: CancellationToken
  ): Promise<CompletionItem[]> {
    if (token?.isCancellationRequested) return [];

    const doc = globalDocumentEngine.getDocument(request.documentId);
    if (!doc) return [];

    // Extract prefix word before cursor
    const linePrefix = request.linePrefix || '';
    const prefixMatch = linePrefix.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)$/);
    const prefix = prefixMatch ? prefixMatch[1] : '';

    if (!prefix && request.triggerKind === 'automatic') {
      return [];
    }

    const words = new Set<string>();
    const wordRegex = /[a-zA-Z_$][a-zA-Z0-9_$]{2,}/g;
    let match: RegExpExecArray | null;

    // Scan words in document
    while ((match = wordRegex.exec(doc.content)) !== null) {
      if (token?.isCancellationRequested) return [];

      const word = match[0];
      if (word !== prefix) {
        if (!prefix || word.toLowerCase().startsWith(prefix.toLowerCase())) {
          words.add(word);
          if (words.size >= 50) break;
        }
      }
    }

    // Determine replacement range for current prefix
    let range: Range | undefined;
    if (prefix) {
      range = {
        startLine: request.position.line,
        startColumn: Math.max(1, request.position.column - prefix.length),
        endLine: request.position.line,
        endColumn: request.position.column,
      };
    }

    const items: CompletionItem[] = [];
    for (const w of Array.from(words)) {
      items.push({
        id: `word:${w}`,
        label: w,
        kind: 'text',
        insertText: w,
        detail: 'Document Word',
        filterText: w,
        sortText: `~${w}`, // Sort after keywords
        range,
        providerId: this.providerId,
        priority: this.priority,
      });
    }

    return items;
  }
}
