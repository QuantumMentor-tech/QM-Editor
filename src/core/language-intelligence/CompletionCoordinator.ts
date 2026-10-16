/**
 * QM Editor Canonical Completion Coordinator
 * Phase 04, Step 42 — Language Intelligence Provider Architecture & Completion Framework
 */

import {
  CompletionRequest,
  CompletionResult,
  CompletionItem,
  CompletionTriggerKind,
} from './LanguageIntelligenceTypes';
import {
  LanguageIntelligenceRegistry,
} from './LanguageIntelligenceRegistry';
import { WordCompletionProvider } from './providers/WordCompletionProvider';
import { globalDocumentEngine, DocumentEngine } from '../documents/DocumentEngine';
import { globalEditorCoordinationService, EditorCoordinationService } from '../editor/EditorCoordinationService';
import { globalLanguageRegistry } from '../languageRegistry';
import { globalWorkspaceEngine } from '../workspace';
import { CancellationTokenSource } from '../symbols/CancellationToken';
import { CancellationToken } from '../symbols/SymbolTypes';
import { Range, Position } from '../navigation/LocationTypes';
import { logger } from '../../utils/logger';

export interface CompletionInvocationOptions {
  triggerKind?: CompletionTriggerKind;
  triggerCharacter?: string;
}

export interface ApplyCompletionResult {
  success: boolean;
  documentId: string;
  appliedText: string;
  newRevision?: number;
  reason?: 'applied' | 'stale' | 'read_only' | 'invalid_range' | 'document_not_found' | 'error';
  error?: string;
}

export function rangeToOffsets(range: Range, docContent: string): { from: number; to: number } {
  const lines = docContent.split('\n');
  const lineCount = Math.max(1, lines.length);

  const safeStartLine = Math.max(1, Math.min(range.startLine, lineCount));
  const safeEndLine = Math.max(safeStartLine, Math.min(range.endLine, lineCount));

  let from = 0;
  for (let i = 0; i < safeStartLine - 1; i++) {
    from += lines[i].length + 1;
  }
  const startLineText = lines[safeStartLine - 1] || '';
  from += Math.max(0, Math.min(range.startColumn - 1, startLineText.length));

  let to = 0;
  for (let i = 0; i < safeEndLine - 1; i++) {
    to += lines[i].length + 1;
  }
  const endLineText = lines[safeEndLine - 1] || '';
  to += Math.max(0, Math.min(range.endColumn - 1, endLineText.length));

  from = Math.max(0, Math.min(from, docContent.length));
  to = Math.max(from, Math.min(to, docContent.length));

  return { from, to };
}

export class CompletionCoordinator {
  private static instance: CompletionCoordinator | null = null;
  private currentGeneration: number = 0;
  private activeCts: CancellationTokenSource | null = null;
  private isDisposed: boolean = false;

  constructor(
    private readonly registry: LanguageIntelligenceRegistry = LanguageIntelligenceRegistry.getInstance(),
    private readonly documentEngine: DocumentEngine = globalDocumentEngine,
    private readonly editorCoordination: EditorCoordinationService = globalEditorCoordinationService
  ) {
    // Register default word completion fallback provider
    this.registry.registerProvider(new WordCompletionProvider());
  }

  public static getInstance(): CompletionCoordinator {
    if (!CompletionCoordinator.instance) {
      CompletionCoordinator.instance = new CompletionCoordinator();
    }
    return CompletionCoordinator.instance;
  }

  // ---------------------------------------------------------------------------
  // 1. Completion Request Execution
  // ---------------------------------------------------------------------------

  /**
   * Primary entry point: queries all eligible providers for completions at a given position.
   */
  public async requestCompletions(
    documentId: string,
    position: Position,
    options: CompletionInvocationOptions = {}
  ): Promise<CompletionResult> {
    if (this.isDisposed) {
      return { items: [], requestId: '', revision: 0, generation: this.currentGeneration };
    }

    const doc = this.documentEngine.getDocument(documentId);
    if (!doc) {
      return { items: [], requestId: '', revision: 0, generation: this.currentGeneration };
    }

    // Cancel previous in-flight request
    this.activeCts?.cancel();
    const cts = new CancellationTokenSource();
    this.activeCts = cts;

    const generation = ++this.currentGeneration;
    const requestId = `req-${Date.now()}-${generation}`;
    const initialWorkspaceId = globalWorkspaceEngine.getWorkspaceId();

    const uri = doc.resourceUri || doc.filePath || doc.title;
    const resolvedLanguage = globalLanguageRegistry.resolveLanguage(uri, doc.languageId).id;

    // Calculate line prefix
    const lines = doc.content.split('\n');
    const safeLine = Math.max(1, Math.min(position.line, lines.length));
    const currentLineText = lines[safeLine - 1] || '';
    const safeCol = Math.max(1, Math.min(position.column, currentLineText.length + 1));
    const linePrefix = currentLineText.slice(0, safeCol - 1);

    // Calculate 0-based character offset
    let offset = 0;
    for (let i = 0; i < safeLine - 1; i++) {
      offset += lines[i].length + 1;
    }
    offset += safeCol - 1;

    const request: CompletionRequest = {
      requestId,
      documentId: doc.id,
      uri,
      languageId: resolvedLanguage,
      revision: doc.contentRevision,
      position: { line: safeLine, column: safeCol },
      offset,
      triggerKind: options.triggerKind || 'invoked',
      triggerCharacter: options.triggerCharacter,
      workspaceId: doc.workspaceId || initialWorkspaceId || undefined,
      linePrefix,
    };

    // Query compatible providers
    const providers = this.registry.getProviders(resolvedLanguage, 'completion');
    if (providers.length === 0) {
      return {
        items: [],
        requestId,
        revision: doc.contentRevision,
        generation,
      };
    }

    // Call providers in parallel with isolated failure handling
    const providerPromises = providers.map(async (provider) => {
      try {
        if (!provider.provideCompletions) return [];
        const result = await provider.provideCompletions(request, cts.token);
        if (cts.token.isCancellationRequested) return [];

        const rawItems = Array.isArray(result) ? result : result.items;
        return rawItems.map((item) => ({
          ...item,
          providerId: provider.providerId,
          priority: item.priority ?? provider.priority ?? 50,
        }));
      } catch (err) {
        logger.error('CompletionCoordinator: provider failed', {
          providerId: provider.providerId,
          error: (err as Error).message,
        });
        return [];
      }
    });

    const settledResults = await Promise.allSettled(providerPromises);

    // Stale generation check
    if (generation !== this.currentGeneration || cts.token.isCancellationRequested) {
      logger.debug('CompletionCoordinator: discarded stale completion results', {
        generation,
        currentGeneration: this.currentGeneration,
      });
      return { items: [], requestId, revision: doc.contentRevision, generation };
    }

    // Workspace switch check
    const currentWorkspaceId = globalWorkspaceEngine.getWorkspaceId();
    if (initialWorkspaceId && currentWorkspaceId && initialWorkspaceId !== currentWorkspaceId) {
      logger.debug('CompletionCoordinator: workspace switched during completion request, discarding');
      return { items: [], requestId, revision: doc.contentRevision, generation };
    }

    // Document revision check
    const freshDoc = this.documentEngine.getDocument(documentId);
    if (!freshDoc || freshDoc.contentRevision !== request.revision) {
      logger.debug('CompletionCoordinator: document revision advanced, discarding completion results');
      return { items: [], requestId, revision: freshDoc?.contentRevision ?? 0, generation };
    }

    // Merge and aggregate items
    const allItems: CompletionItem[] = [];
    for (const res of settledResults) {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        allItems.push(...res.value);
      }
    }

    // Deduplicate and rank items
    const rankedItems = this.rankAndDeduplicate(allItems);

    return {
      items: rankedItems,
      requestId,
      revision: freshDoc.contentRevision,
      generation,
    };
  }

  // ---------------------------------------------------------------------------
  // 2. Ranking & Deduplication
  // ---------------------------------------------------------------------------

  private rankAndDeduplicate(items: CompletionItem[]): CompletionItem[] {
    const seen = new Map<string, CompletionItem>();

    for (const item of items) {
      const key = `${item.label.toLowerCase()}:${(item.insertText || item.label).toLowerCase()}:${item.kind}`;
      const existing = seen.get(key);

      if (!existing) {
        seen.set(key, item);
      } else {
        // Keep the one with higher provider priority
        const existingPriority = existing.priority ?? 50;
        const currentPriority = item.priority ?? 50;
        if (currentPriority > existingPriority) {
          seen.set(key, item);
        }
      }
    }

    return Array.from(seen.values()).sort((a, b) => {
      const prioA = a.priority ?? 50;
      const prioB = b.priority ?? 50;
      if (prioA !== prioB) return prioB - prioA;

      const sortA = a.sortText || a.label;
      const sortB = b.sortText || b.label;
      return sortA.localeCompare(sortB);
    });
  }

  // ---------------------------------------------------------------------------
  // 3. Applying Completion Edits via EditTransactionManager
  // ---------------------------------------------------------------------------

  /**
   * Applies an accepted completion item into the editor model and DocumentEngine atomically.
   */
  public async applyCompletion(
    documentId: string,
    item: CompletionItem,
    expectedRevision?: number
  ): Promise<ApplyCompletionResult> {
    if (this.isDisposed) {
      return { success: false, documentId, appliedText: '', reason: 'error', error: 'Coordinator disposed.' };
    }

    const doc = this.documentEngine.getDocument(documentId);
    if (!doc) {
      return { success: false, documentId, appliedText: '', reason: 'document_not_found', error: 'Document not found.' };
    }

    // 1. Read-only validation
    if (doc.metadata.isReadOnly) {
      return { success: false, documentId, appliedText: '', reason: 'read_only', error: 'Document is read-only.' };
    }

    // 2. Revision validation
    if (expectedRevision !== undefined && doc.contentRevision !== expectedRevision) {
      return {
        success: false,
        documentId,
        appliedText: '',
        reason: 'stale',
        error: `Document revision advanced from ${expectedRevision} to ${doc.contentRevision}.`,
      };
    }

    const insertText = item.insertText || item.label;

    // 3. Calculate replacement range
    let from = 0;
    let to = 0;

    if (item.range) {
      const offsets = rangeToOffsets(item.range, doc.content);
      from = offsets.from;
      to = offsets.to;
    } else {
      // Default: insert at current cursor position
      const instance = this.editorCoordination.getEditorInstanceForDocument(documentId);
      if (instance) {
        const cursor = instance.adapter.getCursorPosition();
        const offsets = rangeToOffsets(
          { startLine: cursor.line, startColumn: cursor.column, endLine: cursor.line, endColumn: cursor.column },
          doc.content
        );
        from = offsets.from;
        to = offsets.to;
      } else {
        from = doc.content.length;
        to = doc.content.length;
      }
    }

    // 4. Build atomic transaction changes
    const changes: Array<{ from: number; to: number; insertText: string }> = [
      { from, to, insertText },
    ];

    // Optional additional text edits (e.g. imports)
    if (item.additionalTextEdits && item.additionalTextEdits.length > 0) {
      for (const edit of item.additionalTextEdits) {
        const editOffsets = rangeToOffsets(edit.range, doc.content);
        changes.push({
          from: editOffsets.from,
          to: editOffsets.to,
          insertText: edit.newText,
        });
      }
    }

    // 5. Apply via EditorCoordinationService (enforces undo/redo, dirty state, DocumentEngine sync)
    const result = await this.editorCoordination.applyTransaction({
      documentId,
      changes,
      expectedRevision,
      source: 'completion',
    });

    if (result.status !== 'applied') {
      return {
        success: false,
        documentId,
        appliedText: insertText,
        reason: result.status === 'read_only' ? 'read_only' : result.status === 'stale' ? 'stale' : 'invalid_range',
        error: result.error,
      };
    }

    // 6. Move cursor to end of inserted text in visual editor
    const instance = this.editorCoordination.getEditorInstanceForDocument(documentId);
    if (instance) {
      const newCursorOffset = from + insertText.length;
      const updatedDoc = this.documentEngine.getDocument(documentId);
      if (updatedDoc) {
        const lines = updatedDoc.content.slice(0, newCursorOffset).split('\n');
        const targetLine = lines.length;
        const targetCol = lines[lines.length - 1].length + 1;
        instance.adapter.goToLine(targetLine, targetCol);
      }
    }

    return {
      success: true,
      documentId,
      appliedText: insertText,
      newRevision: result.newRevision,
      reason: 'applied',
    };
  }

  /**
   * Resolves additional details/documentation for a completion item lazily from its provider.
   */
  public async resolveCompletionItem(
    item: CompletionItem,
    token?: CancellationToken
  ): Promise<CompletionItem> {
    if (this.isDisposed || !item || !item.providerId) {
      return item;
    }

    const provider = this.registry.getProvider(item.providerId);
    if (!provider || !provider.resolveCompletionItem) {
      return item;
    }

    try {
      return await provider.resolveCompletionItem(item, token);
    } catch (err) {
      logger.debug('CompletionCoordinator: resolveCompletionItem failed', {
        providerId: item.providerId,
        error: (err as Error).message,
      });
      return item;
    }
  }

  public cancelActiveRequest(): void {
    if (this.activeCts) {
      this.activeCts.cancel();
      this.activeCts = null;
    }
  }

  public static resetInstance(): void {
    if (CompletionCoordinator.instance) {
      CompletionCoordinator.instance.cancelActiveRequest();
      CompletionCoordinator.instance = null;
    }
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.cancelActiveRequest();
  }

  public reset(): void {
    this.isDisposed = false;
    this.cancelActiveRequest();
  }
}

export const globalCompletionCoordinator = CompletionCoordinator.getInstance();
