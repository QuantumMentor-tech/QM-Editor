import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { DocumentModel, FileResource } from '../types';
import { createNewDocument } from '../core/document';
import {
  DocumentRegistryState,
  createInitialRegistry,
  registerOpenDocument,
  activateDocument,
  closeDocument,
  updateDocumentText,
  saveDocumentState,
} from '../core/documentRegistry';
import { fileService } from '../services/FileService';
import { RecentDocumentsService } from '../services/RecentDocumentsService';
import { SessionService } from '../services/SessionService';
import { logger } from '../utils/logger';
import { globalFeedbackService } from '../core/feedback/FeedbackService';
import { globalWorkspaceEngine, globalWorkspacePersistenceCoordinator } from '../core/workspace';
import { EditTransaction, CommittedEditTransaction, globalEditTransactionManager } from '../core/edit';
import { globalFileSystemWatcherService } from '../core/watcher';
import { globalDocumentHistoryService } from '../core/history';
import { globalDiagnosticService } from '../core/diagnostics';
import { globalDocumentEngine } from '../core/documents';
import { globalEditorCoordinationService } from '../core/editor';
import { globalNavigationCoordinator } from '../core/navigation';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface WorkspaceContextType {
  registry: DocumentRegistryState;
  openDocs: DocumentModel[];
  activeDoc: DocumentModel | null;
  dirtyCloseTarget: DocumentModel | null;
  saveStatus: SaveStatus;
  lastErrorMessage: string | null;
  openDoc: (doc: DocumentModel) => void;
  createDoc: (title?: string, content?: string, language?: string) => void;
  openFile: () => Promise<void>;
  openFilePath?: (filePath: string) => Promise<void>;
  activateDoc: (documentId: string) => void;
  closeDoc: (documentId: string, force?: boolean) => void;
  updateText: (documentId: string, content: string) => void;
  applyTransaction?: (documentId: string, transaction: EditTransaction) => Promise<CommittedEditTransaction | null>;
  changeDocLanguage: (documentId: string, languageId: string) => void;
  saveDoc: (documentId: string) => Promise<void>;
  saveDocAs: (documentId: string) => Promise<void>;
  cancelDirtyClose: () => void;
  confirmDiscardDirty: () => void;
  resolveConflict?: (documentId: string, resolution: 'keep_local' | 'revert_disk') => Promise<void>;
  undoDoc?: (documentId: string) => Promise<boolean>;
  redoDoc?: (documentId: string) => Promise<boolean>;
  canUndoDoc?: (documentId: string) => boolean;
  canRedoDoc?: (documentId: string) => boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

const initialWelcomeDoc = createNewDocument(
  'Welcome.md',
  '# Welcome to QM Editor\n\nQM Editor is a high-performance document and code editor.\n\n- Phase 01 Step 14: Advanced Editor Navigation, Location History & Session Continuity Foundation Established.\n- Bounded back/forward location history, Go-to-Line/Column modal, recent files tracking, and safe session restoration active.\n\nUse Ctrl+N for New Document, Ctrl+O to Open, Ctrl+G for Go to Line, and Ctrl+Shift+R for Recent Files.',
  'markdown'
);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [registry, setRegistry] = useState<DocumentRegistryState>(() =>
    createInitialRegistry([initialWelcomeDoc])
  );

  const [dirtyCloseTarget, setDirtyCloseTarget] = useState<DocumentModel | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastErrorMessage, setLastErrorMessage] = useState<string | null>(null);

  const untitledCountRef = useRef(1);
  const openDocs = registry.openDocIds
    .map((id) => registry.documents[id])
    .filter((doc): doc is DocumentModel => Boolean(doc));
  const activeDoc = registry.activeDocId ? registry.documents[registry.activeDocId] || null : null;

  // Sync session metadata automatically when open documents change
  useEffect(() => {
    const openPaths = openDocs
      .map((d) => d.filePath || d.fileResource?.uri)
      .filter((p): p is string => Boolean(p));

    const activePath = activeDoc?.filePath || activeDoc?.fileResource?.uri;
    SessionService.saveSession(openPaths, activePath);
    globalWorkspacePersistenceCoordinator.scheduleSessionSave();
  }, [openDocs, activeDoc]);

  // Register unsaved document protection with the Workspace Engine
  useEffect(() => {
    const unregister = globalWorkspaceEngine.registerUnsavedChangesChecker(() => {
      return openDocs.some((d) => d.isDirty);
    });
    return unregister;
  }, [openDocs]);

  // Register live document hooks with FileSystemWatcherService for external change reconciliation
  useEffect(() => {
    const unregisterHooks = globalFileSystemWatcherService.registerDocumentHooks(
      () => openDocs,
      (documentId: string, newContent: string) => {
        setRegistry((prev) => {
          const doc = prev.documents[documentId];
          if (!doc) return prev;
          return {
            ...prev,
            documents: {
              ...prev.documents,
              [documentId]: {
                ...doc,
                content: newContent,
                savedContent: newContent,
                isDirty: false,
                contentRevision: doc.contentRevision + 1,
                savedRevision: doc.contentRevision + 1,
              },
            },
          };
        });
      }
    );

    const unregisterConflictListener = globalFileSystemWatcherService.on(
      'watcher.conflictDetected',
      (payload) => {
        const doc = registry.documents[payload.documentId];
        const title = doc?.title || payload.uri;
        globalFeedbackService.showWarning(
          `File "${title}" was modified externally on disk, but has unsaved local changes.`,
          {
            source: 'watcher.conflict',
            scope: 'document',
            scopeId: payload.documentId,
          }
        );
      }
    );

    return () => {
      unregisterHooks();
      unregisterConflictListener();
    };
  }, [openDocs, registry.documents]);

  // Wire centralized NavigationCoordinator to Workspace document activation & opener
  useEffect(() => {
    const unregisterOpener = globalNavigationCoordinator.registerDocumentOpener({
      openDocument: async (uri: string) => {
        await openFilePath(uri);
        const norm = uri.replace(/\\/g, '/').toLowerCase();
        const found = openDocs.find(
          (d) =>
            (d.filePath && d.filePath.replace(/\\/g, '/').toLowerCase() === norm) ||
            (d.fileResource?.uri && d.fileResource.uri.replace(/\\/g, '/').toLowerCase() === norm) ||
            d.title.toLowerCase() === norm
        );
        return found ? found.id : null;
      },
      activateDocument: (documentId: string) => {
        activateDoc(documentId);
      },
      getActiveDocumentId: () => activeDoc?.id || null,
    });

    return unregisterOpener;
  }, [openDocs, activeDoc?.id]);

  const openDoc = (doc: DocumentModel) => {
    if (!globalDocumentEngine.hasDocument(doc.id)) {
      const uri = doc.fileResource?.uri || doc.filePath || doc.title;
      globalDocumentEngine.openResource(uri, {
        initialContent: doc.content,
        languageId: doc.language,
      }).catch(() => {});
    }
    setRegistry((prev) => registerOpenDocument(prev, doc));
  };

  const createDoc = (title?: string, content: string = '', language: string = 'plaintext') => {
    const docTitle = title || (untitledCountRef.current === 1 ? 'Untitled.txt' : `Untitled ${untitledCountRef.current}.txt`);
    if (!title) {
      untitledCountRef.current += 1;
    }
    const newDoc = createNewDocument(docTitle, content, language);
    globalDocumentEngine.openResource(newDoc.filePath || newDoc.title, {
      initialContent: newDoc.content,
      languageId: newDoc.language,
    }).catch(() => {});
    setRegistry((prev) => registerOpenDocument(prev, newDoc));
  };

  const openFilePath = async (filePath: string) => {
    try {
      setLastErrorMessage(null);
      const normalizedPath = filePath.trim();

      // If already open, activate existing tab
      const existing = openDocs.find(
        (d) => d.filePath === normalizedPath || d.fileResource?.uri === normalizedPath
      );
      if (existing) {
        setRegistry((prev) => activateDocument(prev, existing.id));
        RecentDocumentsService.addRecentDocument(normalizedPath, existing.title);
        return;
      }

      const filename = normalizedPath.replace(/\\/g, '/').split('/').pop() || normalizedPath;
      const parts = filename.split('.');
      const extension = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';

      const resource: FileResource = {
        uri: normalizedPath,
        name: filename,
        extension,
        readOnly: false,
        exists: true,
      };

      // Check if document already exists in authoritative DocumentEngine
      const engineDoc = globalDocumentEngine.getByResource(normalizedPath);
      const initialContent = engineDoc ? engineDoc.content : '';
      const initialLanguage = engineDoc ? engineDoc.languageId : 'plaintext';

      const newDoc = createNewDocument(
        filename,
        initialContent,
        initialLanguage,
        normalizedPath,
        resource
      );

      if (!engineDoc) {
        await globalDocumentEngine.openResource(normalizedPath, {
          initialContent,
          languageId: initialLanguage,
        }).catch(() => {});
      }

      setRegistry((prev) => registerOpenDocument(prev, newDoc));
      RecentDocumentsService.addRecentDocument(normalizedPath, filename);
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to open file from path.';
      logger.error('Workspace openFilePath error', { filePath, error: msg });
      setLastErrorMessage(msg);
      globalFeedbackService.showError(`Could not open file: ${msg}`, {
        source: 'workspace.open',
        scope: 'workspace',
      });
    }
  };

  const openFile = async () => {
    try {
      setLastErrorMessage(null);
      const result = await fileService.showOpenPicker();
      if (!result) return;

      const newDoc = createNewDocument(
        result.resource.name,
        result.content,
        'plaintext',
        result.resource.uri,
        result.resource
      );

      setRegistry((prev) => registerOpenDocument(prev, newDoc));
      RecentDocumentsService.addRecentDocument(result.resource.uri, result.resource.name);
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to open file.';
      logger.error('Workspace openFile error', { error: msg });
      setLastErrorMessage(msg);
      globalFeedbackService.showError(`Could not open file: ${msg}`, {
        source: 'workspace.open',
        scope: 'workspace',
      });
    }
  };

  const activateDoc = (documentId: string) => {
    setRegistry((prev) => activateDocument(prev, documentId));
  };

  const closeDoc = (documentId: string, force: boolean = false) => {
    const doc = registry.documents[documentId];
    if (!doc) return;

    if (doc.isDirty && !force) {
      setDirtyCloseTarget(doc);
      return;
    }

    if (globalDocumentEngine.hasDocument(documentId)) {
      globalDocumentEngine.close(documentId, true).catch(() => {});
    }
    globalDocumentHistoryService.disposeDocument(documentId);
    if (!doc.filePath) {
      globalDiagnosticService.clearDocument(doc.title || documentId);
    }
    setRegistry((prev) => closeDocument(prev, documentId));
  };

  const updateText = (documentId: string, content: string) => {
    if (globalDocumentEngine.hasDocument(documentId)) {
      globalDocumentEngine.updateText(documentId, content).catch(() => {});
    }
    setRegistry((prev) => updateDocumentText(prev, documentId, content));
  };

  const applyTransaction = async (
    documentId: string,
    transaction: EditTransaction
  ): Promise<CommittedEditTransaction | null> => {
    const doc = registry.documents[documentId];
    if (!doc) return null;

    try {
      const result = await globalEditTransactionManager.applyTransaction(doc, transaction);
      setRegistry((prev) => {
        if (!prev.documents[documentId]) return prev;
        return {
          ...prev,
          documents: {
            ...prev.documents,
            [documentId]: result.document,
          },
        };
      });
      return result.transaction;
    } catch (err) {
      logger.error('Failed to apply edit transaction', {
        documentId,
        error: (err as Error).message,
      });
      throw err;
    }
  };

  const changeDocLanguage = (documentId: string, languageId: string) => {
    setRegistry((prev) => {
      const doc = prev.documents[documentId];
      if (!doc) return prev;
      return {
        ...prev,
        documents: {
          ...prev.documents,
          [documentId]: {
            ...doc,
            language: languageId,
          },
        },
      };
    });
  };

  const saveDocAs = async (documentId: string) => {
    const doc = registry.documents[documentId];
    if (!doc) return;

    try {
      setSaveStatus('saving');
      setLastErrorMessage(null);

      const handle = await fileService.showSavePicker({ suggestedName: doc.title });
      if (!handle) {
        setSaveStatus('idle');
        return;
      }

      const targetRevision = doc.contentRevision;
      const contentSnapshot = doc.content;

      const updatedResource = await fileService.writeFile(handle, contentSnapshot);

      globalDocumentHistoryService.markSaved(documentId, targetRevision);

      setRegistry((prev) =>
        saveDocumentState(prev, documentId, targetRevision, updatedResource)
      );

      RecentDocumentsService.addRecentDocument(updatedResource.uri, updatedResource.name);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
      globalFeedbackService.showSuccess(`Saved ${updatedResource.name}`, {
        source: 'document.save',
        scope: 'document',
        scopeId: documentId,
        duration: 'brief',
      });
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to save document.';
      logger.error('Workspace saveDocAs error', { error: msg });
      setLastErrorMessage(msg);
      setSaveStatus('error');
      globalFeedbackService.showError(`Could not save ${doc.title}: ${msg}`, {
        source: 'document.save',
        scope: 'document',
        scopeId: documentId,
        actions: [{ id: 'retry', label: 'Retry', isPrimary: true, run: () => saveDocAs(documentId) }],
      });
    }
  };

  const saveDoc = async (documentId: string) => {
    const doc = registry.documents[documentId];
    if (!doc) return;

    if (!doc.fileResource?.handle) {
      await saveDocAs(documentId);
      return;
    }

    try {
      setSaveStatus('saving');
      setLastErrorMessage(null);

      const targetRevision = doc.contentRevision;
      const contentSnapshot = doc.content;

      const updatedResource = await fileService.writeFile(doc.fileResource, contentSnapshot);

      globalDocumentHistoryService.markSaved(documentId, targetRevision);

      setRegistry((prev) =>
        saveDocumentState(prev, documentId, targetRevision, updatedResource)
      );

      RecentDocumentsService.addRecentDocument(updatedResource.uri, updatedResource.name);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
      globalFeedbackService.showSuccess(`Saved ${updatedResource.name}`, {
        source: 'document.save',
        scope: 'document',
        scopeId: documentId,
        duration: 'brief',
      });
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to save document.';
      logger.error('Workspace saveDoc error', { error: msg });
      setLastErrorMessage(msg);
      setSaveStatus('error');
      globalFeedbackService.showError(`Could not save ${doc.title}: ${msg}`, {
        source: 'document.save',
        scope: 'document',
        scopeId: documentId,
        actions: [{ id: 'retry', label: 'Retry', isPrimary: true, run: () => saveDoc(documentId) }],
      });
    }
  };

  const cancelDirtyClose = () => {
    setDirtyCloseTarget(null);
  };

  const confirmDiscardDirty = () => {
    if (dirtyCloseTarget) {
      if (globalDocumentEngine.hasDocument(dirtyCloseTarget.id)) {
        globalDocumentEngine.close(dirtyCloseTarget.id, true).catch(() => {});
      }
      globalDocumentHistoryService.disposeDocument(dirtyCloseTarget.id);
      if (!dirtyCloseTarget.filePath) {
        globalDiagnosticService.clearDocument(dirtyCloseTarget.title || dirtyCloseTarget.id);
      }
      setRegistry((prev) => closeDocument(prev, dirtyCloseTarget.id));
      setDirtyCloseTarget(null);
    }
  };

  const resolveConflict = async (
    documentId: string,
    resolution: 'keep_local' | 'revert_disk'
  ): Promise<void> => {
    const doc = registry.documents[documentId];
    if (!doc) return;

    if (resolution === 'keep_local') {
      globalFileSystemWatcherService.resolveConflict(doc, 'keep_local');
      globalFeedbackService.showInfo(`Preserved local changes for "${doc.title}".`, {
        source: 'watcher.conflict',
        scope: 'document',
        scopeId: documentId,
      });
      return;
    }

    if (resolution === 'revert_disk') {
      try {
        let diskContent = '';
        if (doc.fileResource?.handle) {
          const readResult = await fileService.readFile(doc.fileResource.handle);
          diskContent = readResult.content;
        }
        globalFileSystemWatcherService.resolveConflict(doc, 'revert_disk', diskContent);
        setRegistry((prev) => {
          const currentDoc = prev.documents[documentId];
          if (!currentDoc) return prev;
          return {
            ...prev,
            documents: {
              ...prev.documents,
              [documentId]: {
                ...currentDoc,
                content: diskContent,
                savedContent: diskContent,
                isDirty: false,
                contentRevision: currentDoc.contentRevision + 1,
                savedRevision: currentDoc.contentRevision + 1,
              },
            },
          };
        });
        globalFeedbackService.showSuccess(`Reverted "${doc.title}" to disk state.`, {
          source: 'watcher.conflict',
          scope: 'document',
          scopeId: documentId,
        });
      } catch (err) {
        logger.error('Failed to revert document to disk', {
          documentId,
          error: (err as Error).message,
        });
      }
    }
  };

  const undoDoc = async (documentId: string): Promise<boolean> => {
    if (globalEditorCoordinationService.canUndo(documentId)) {
      return await globalEditorCoordinationService.undo(documentId);
    }
    const doc = registry.documents[documentId];
    if (!doc || !globalDocumentHistoryService.canUndo(documentId)) return false;
    try {
      const result = await globalDocumentHistoryService.undo(doc);
      setRegistry((prev) => {
        if (!prev.documents[documentId]) return prev;
        return {
          ...prev,
          documents: {
            ...prev.documents,
            [documentId]: result.document,
          },
        };
      });
      return true;
    } catch (err) {
      logger.warn('Failed to undo document edit', {
        documentId,
        error: (err as Error).message,
      });
      return false;
    }
  };

  const redoDoc = async (documentId: string): Promise<boolean> => {
    if (globalEditorCoordinationService.canRedo(documentId)) {
      return await globalEditorCoordinationService.redo(documentId);
    }
    const doc = registry.documents[documentId];
    if (!doc || !globalDocumentHistoryService.canRedo(documentId)) return false;
    try {
      const result = await globalDocumentHistoryService.redo(doc);
      setRegistry((prev) => {
        if (!prev.documents[documentId]) return prev;
        return {
          ...prev,
          documents: {
            ...prev.documents,
            [documentId]: result.document,
          },
        };
      });
      return true;
    } catch (err) {
      logger.warn('Failed to redo document edit', {
        documentId,
        error: (err as Error).message,
      });
      return false;
    }
  };

  const canUndoDoc = (documentId: string): boolean => {
    return (
      globalEditorCoordinationService.canUndo(documentId) ||
      globalDocumentHistoryService.canUndo(documentId)
    );
  };

  const canRedoDoc = (documentId: string): boolean => {
    return (
      globalEditorCoordinationService.canRedo(documentId) ||
      globalDocumentHistoryService.canRedo(documentId)
    );
  };

  return (
    <WorkspaceContext.Provider
      value={{
        registry,
        openDocs,
        activeDoc,
        dirtyCloseTarget,
        saveStatus,
        lastErrorMessage,
        openDoc,
        createDoc,
        openFile,
        openFilePath,
        activateDoc,
        closeDoc,
        updateText,
        applyTransaction,
        changeDocLanguage,
        saveDoc,
        saveDocAs,
        cancelDirtyClose,
        confirmDiscardDirty,
        resolveConflict,
        undoDoc,
        redoDoc,
        canUndoDoc,
        canRedoDoc,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = (): WorkspaceContextType => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};
