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
  changeDocLanguage: (documentId: string, languageId: string) => void;
  saveDoc: (documentId: string) => Promise<void>;
  saveDocAs: (documentId: string) => Promise<void>;
  cancelDirtyClose: () => void;
  confirmDiscardDirty: () => void;
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
  }, [openDocs, activeDoc]);

  const openDoc = (doc: DocumentModel) => {
    setRegistry((prev) => registerOpenDocument(prev, doc));
  };

  const createDoc = (title?: string, content: string = '', language: string = 'plaintext') => {
    const docTitle = title || (untitledCountRef.current === 1 ? 'Untitled.txt' : `Untitled ${untitledCountRef.current}.txt`);
    if (!title) {
      untitledCountRef.current += 1;
    }
    const newDoc = createNewDocument(docTitle, content, language);
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

      const newDoc = createNewDocument(
        filename,
        '',
        'plaintext',
        normalizedPath,
        resource
      );

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

    setRegistry((prev) => closeDocument(prev, documentId));
  };

  const updateText = (documentId: string, content: string) => {
    setRegistry((prev) => updateDocumentText(prev, documentId, content));
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
      setRegistry((prev) => closeDocument(prev, dirtyCloseTarget.id));
      setDirtyCloseTarget(null);
    }
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
        changeDocLanguage,
        saveDoc,
        saveDocAs,
        cancelDirtyClose,
        confirmDiscardDirty,
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
