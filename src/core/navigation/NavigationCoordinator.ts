/**
 * QM Editor Canonical Navigation Coordinator
 * Phase 04, Step 41 — Code Navigation, Symbols, Locations & Outline Engine
 */

import {
  Location,
  Range,
  NavigationOptions,
  NavigationResult,
  NavigationEventKey,
  NavigationEventMap,
  NavigationEventListener,
} from './LocationTypes';
import {
  normalizeLocationUri,
  createLocation,
  clampRangeToDocument,
} from './LocationValidation';
import { globalDocumentEngine, DocumentEngine } from '../documents/DocumentEngine';
import { globalEditorCoordinationService, EditorCoordinationService } from '../editor/EditorCoordinationService';
import { globalNavigationService, NavigationService } from '../../services/NavigationService';
import { globalWorkspaceEngine } from '../workspace';
import { globalFeedbackService } from '../feedback/FeedbackService';
import { fileService } from '../../services/FileService';
import { logger } from '../../utils/logger';

export interface DocumentOpenerHandler {
  openDocument: (uri: string) => Promise<string | null>; // Returns documentId or null
  activateDocument: (documentId: string) => void;
  getActiveDocumentId?: () => string | null;
}

export class NavigationCoordinator {
  private static instance: NavigationCoordinator | null = null;

  private currentSequence: number = 0;
  private isDisposed: boolean = false;
  private openerHandler: DocumentOpenerHandler | null = null;
  private readonly listeners = new Map<
    NavigationEventKey,
    Set<NavigationEventListener<any>>
  >();

  constructor(
    private readonly documentEngine: DocumentEngine = globalDocumentEngine,
    private readonly editorCoordination: EditorCoordinationService = globalEditorCoordinationService,
    private readonly navigationService: NavigationService = globalNavigationService
  ) {}

  public static getInstance(): NavigationCoordinator {
    if (!NavigationCoordinator.instance) {
      NavigationCoordinator.instance = new NavigationCoordinator();
    }
    return NavigationCoordinator.instance;
  }

  /**
   * Registers a UI-level document opener/activator hook (e.g. from WorkspaceContext).
   */
  public registerDocumentOpener(handler: DocumentOpenerHandler): () => void {
    this.openerHandler = handler;
    return () => {
      if (this.openerHandler === handler) {
        this.openerHandler = null;
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Event System
  // ---------------------------------------------------------------------------

  public on<K extends NavigationEventKey>(
    event: K,
    listener: NavigationEventListener<K>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    return () => {
      this.listeners.get(event)?.delete(listener);
    };
  }

  private async emit<K extends NavigationEventKey>(
    event: K,
    payload: NavigationEventMap[K]
  ): Promise<void> {
    const handlers = this.listeners.get(event);
    if (!handlers || handlers.size === 0) return;

    for (const handler of Array.from(handlers)) {
      try {
        await handler(payload);
      } catch (err) {
        logger.error(`NavigationCoordinator: error in ${event} listener`, {
          error: (err as Error).message,
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Core Navigation Method
  // ---------------------------------------------------------------------------

  /**
   * Primary entry point: navigates to a canonical Location.
   * Resolves resources, opens closed documents, reveals ranges, and logs history safely.
   */
  public async navigateToLocation(
    target: Location,
    options: NavigationOptions = {}
  ): Promise<NavigationResult> {
    if (this.isDisposed) {
      return {
        success: false,
        location: target,
        errorCode: 'DISPOSED',
        error: 'NavigationCoordinator has been disposed.',
      };
    }

    const seq = ++this.currentSequence;
    const startTime = Date.now();
    const normalizedUri = normalizeLocationUri(target.uri);

    if (!normalizedUri) {
      const err = 'Invalid navigation target: URI is empty.';
      await this.emit('navigation.failed', {
        sequenceId: seq,
        location: target,
        error: err,
        errorCode: 'INVALID_LOCATION',
      });
      return {
        success: false,
        location: target,
        errorCode: 'INVALID_LOCATION',
        error: err,
      };
    }

    const initialWorkspaceId = globalWorkspaceEngine.getWorkspaceId();

    const normalizedLocation = createLocation(
      normalizedUri,
      target.range,
      target.selectionRange || options.selectionRange,
      target.workspaceId || options.workspaceId || initialWorkspaceId || undefined,
      target.resourceId
    );

    await this.emit('navigation.started', {
      sequenceId: seq,
      location: normalizedLocation,
      options,
    });

    try {
      // 1. Resolve Document (Check if already open in DocumentEngine or UI)
      let docRecord = this.documentEngine.getByResource(normalizedUri);
      let alreadyOpen = Boolean(docRecord);
      let resolvedDocId: string | null = docRecord ? docRecord.id : null;

      // Check UI handler if docRecord not yet found or needs activation
      if (this.openerHandler) {
        if (!docRecord) {
          // Open closed document
          resolvedDocId = await this.openerHandler.openDocument(normalizedUri);
          if (resolvedDocId) {
            docRecord = this.documentEngine.getDocument(resolvedDocId);
          }
        } else {
          // Activate already open document in UI
          this.openerHandler.activateDocument(docRecord.id);
        }
      } else if (!docRecord) {
        // Fallback to opening directly through DocumentEngine if openerHandler not set
        const exists = await fileService.fileExists(normalizedUri);
        if (!exists && !normalizedUri.startsWith('untitled:')) {
          const err = `Resource not found: ${normalizedUri}`;
          await this.emit('navigation.failed', {
            sequenceId: seq,
            location: normalizedLocation,
            error: err,
            errorCode: 'RESOURCE_NOT_FOUND',
          });
          return {
            success: false,
            location: normalizedLocation,
            errorCode: 'RESOURCE_NOT_FOUND',
            error: err,
          };
        }

        const openRes = await this.documentEngine.openResource(normalizedUri, {
          workspaceId: normalizedLocation.workspaceId,
        });
        docRecord = openRes.document;
        alreadyOpen = openRes.alreadyOpen;
        resolvedDocId = docRecord.id;
      }

      // 2. Race Condition & Stale Request Protection
      if (seq !== this.currentSequence) {
        await this.emit('navigation.cancelled', {
          sequenceId: seq,
          location: normalizedLocation,
          reason: 'A newer navigation request has superseded this request.',
        });
        return {
          success: false,
          location: normalizedLocation,
          errorCode: 'STALE_REQUEST',
          error: 'Navigation cancelled due to subsequent navigation request.',
        };
      }

      // 3. Workspace Generation / Switch Check
      const currentWorkspaceId = globalWorkspaceEngine.getWorkspaceId();
      if (
        normalizedLocation.workspaceId &&
        currentWorkspaceId &&
        normalizedLocation.workspaceId !== currentWorkspaceId
      ) {
        const err = 'Navigation aborted: workspace changed during operation.';
        await this.emit('navigation.failed', {
          sequenceId: seq,
          location: normalizedLocation,
          error: err,
          errorCode: 'WORKSPACE_MISMATCH',
        });
        return {
          success: false,
          location: normalizedLocation,
          errorCode: 'WORKSPACE_MISMATCH',
          error: err,
        };
      }

      // If document still could not be resolved
      if (!docRecord && !resolvedDocId) {
        const err = `Failed to open or resolve document for: ${normalizedUri}`;
        await this.emit('navigation.failed', {
          sequenceId: seq,
          location: normalizedLocation,
          error: err,
          errorCode: 'DOCUMENT_OPEN_FAILED',
        });
        return {
          success: false,
          location: normalizedLocation,
          errorCode: 'DOCUMENT_OPEN_FAILED',
          error: err,
        };
      }

      // 4. Content Range Clamping & Validation
      let targetRange = normalizedLocation.range || {
        startLine: 1,
        startColumn: 1,
        endLine: 1,
        endColumn: 1,
      };

      let wasClamped = false;
      const content = docRecord?.content ?? '';
      if (content) {
        const clampResult = clampRangeToDocument(targetRange, content);
        targetRange = clampResult.clampedRange;
        wasClamped = clampResult.wasClamped;
      }

      // 5. Apply Editor Navigation & Range Reveal
      const effectiveDocId = resolvedDocId || docRecord?.id || '';
      this.applyEditorJump(effectiveDocId, targetRange, options);

      // 6. Record Navigation History
      if (options.recordHistory !== false && effectiveDocId) {
        this.navigationService.pushLocation({
          documentId: effectiveDocId,
          filePath: normalizedUri,
          documentTitle: docRecord?.title || normalizedUri.split('/').pop() || 'Document',
          line: targetRange.startLine,
          column: targetRange.startColumn,
        });
      }

      // 7. Emit Completed Event
      await this.emit('navigation.completed', {
        sequenceId: seq,
        location: {
          ...normalizedLocation,
          range: targetRange,
        },
        documentId: effectiveDocId,
        alreadyOpen,
        clamped: wasClamped,
        durationMs: Date.now() - startTime,
      });

      return {
        success: true,
        location: {
          ...normalizedLocation,
          range: targetRange,
        },
        documentId: effectiveDocId,
        alreadyOpen,
        clamped: wasClamped,
      };
    } catch (err: unknown) {
      const errMsg = (err as Error).message || 'Unexpected navigation error.';
      logger.error('NavigationCoordinator: navigation failed', {
        uri: normalizedUri,
        error: errMsg,
      });

      await this.emit('navigation.failed', {
        sequenceId: seq,
        location: normalizedLocation,
        error: errMsg,
        errorCode: 'DOCUMENT_OPEN_FAILED',
      });

      globalFeedbackService.showError(`Navigation failed: ${errMsg}`, {
        source: 'navigation.coordinator',
        scope: 'workspace',
      });

      return {
        success: false,
        location: normalizedLocation,
        errorCode: 'DOCUMENT_OPEN_FAILED',
        error: errMsg,
      };
    }
  }

  /**
   * Applies the cursor move and range reveal across both EditorCoordinationService and window events.
   */
  private applyEditorJump(
    documentId: string,
    range: Range,
    options: NavigationOptions
  ): void {
    // 1. Direct adapter call if editor instance is already registered for this document
    const instance = this.editorCoordination.getEditorInstanceForDocument(documentId);
    if (instance) {
      try {
        instance.adapter.goToLine(range.startLine, range.startColumn);
        if (!options.preserveFocus) {
          instance.adapter.focus();
        }
      } catch (err) {
        logger.debug('EditorCoordination instance goToLine failed, falling back to event', {
          error: (err as Error).message,
        });
      }
    }

    // 2. Broadcast canonical editor event for CodeMirror views and active editor components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('qm:editor:gotoline', {
          detail: {
            line: range.startLine,
            column: range.startColumn,
            preserveFocus: options.preserveFocus,
          },
        })
      );
    }
  }

  // ---------------------------------------------------------------------------
  // History Convenience Methods
  // ---------------------------------------------------------------------------

  public canNavigateBack(): boolean {
    return this.navigationService.canNavigateBack();
  }

  public canNavigateForward(): boolean {
    return this.navigationService.canNavigateForward();
  }

  public async navigateBack(): Promise<NavigationResult | null> {
    const loc = this.navigationService.navigateBack();
    if (!loc) return null;

    const uri = loc.filePath || loc.documentId;
    return this.navigateToLocation(
      {
        uri,
        range: {
          startLine: loc.line,
          startColumn: loc.column,
          endLine: loc.line,
          endColumn: loc.column,
        },
      },
      { recordHistory: false, origin: 'history' }
    );
  }

  public async navigateForward(): Promise<NavigationResult | null> {
    const loc = this.navigationService.navigateForward();
    if (!loc) return null;

    const uri = loc.filePath || loc.documentId;
    return this.navigateToLocation(
      {
        uri,
        range: {
          startLine: loc.line,
          startColumn: loc.column,
          endLine: loc.line,
          endColumn: loc.column,
        },
      },
      { recordHistory: false, origin: 'history' }
    );
  }

  public clearHistory(): void {
    this.navigationService.clearHistory();
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.openerHandler = null;
    this.listeners.clear();
  }

  public reset(): void {
    this.isDisposed = false;
    this.openerHandler = null;
    this.listeners.clear();
  }
}

export const globalNavigationCoordinator = NavigationCoordinator.getInstance();
