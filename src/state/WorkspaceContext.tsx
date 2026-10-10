import React, { createContext, useContext, useState, useRef } from 'react';
import { DocumentModel } from '../types';
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
import { logger } from '../utils/logger';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface WorkspaceContextType {
  registry: DocumentRegistryState;
  activeDoc: DocumentModel | null;
  dirtyCloseTarget: DocumentModel | null;
  saveStatus: SaveStatus;
  lastErrorMessage: string | null;
  openDoc: (doc: DocumentModel) => void;
  createDoc: (title?: string, content?: string, language?: string) => void;
  openFile: () => Promise<void>;
  activateDoc: (documentId: string) => void;
  closeDoc: (documentId: string, force?: boolean) => void;
  updateText: (documentId: string, content: string) => void;
  saveDoc: (documentId: string) => Promise<void>;
  saveDocAs: (documentId: string) => Promise<void>;
  cancelDirtyClose: () => void;
  confirmDiscardDirty: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

const initialWelcomeDoc = createNewDocument(
  'Welcome.md',
  '# Welcome to QM Editor\n\nQM Editor is a high-performance document and code editor.\n\n- Phase 01 Step 09: File System Service, Document I/O & Safe Save Architecture Established.\n- Safe atomic file writing, revision snapshot algorithm preventing save races, and path normalization active.\n\nUse Ctrl+N for New Document, Ctrl+O to Open, and Ctrl+S to Save.',
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
  const activeDoc = registry.activeDocId ? registry.documents[registry.activeDocId] || null : null;

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
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to open file.';
      logger.error('Workspace openFile error', { error: msg });
      setLastErrorMessage(msg);
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

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to save document.';
      logger.error('Workspace saveDocAs error', { error: msg });
      setLastErrorMessage(msg);
      setSaveStatus('error');
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

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to save document.';
      logger.error('Workspace saveDoc error', { error: msg });
      setLastErrorMessage(msg);
      setSaveStatus('error');
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
        activeDoc,
        dirtyCloseTarget,
        saveStatus,
        lastErrorMessage,
        openDoc,
        createDoc,
        openFile,
        activateDoc,
        closeDoc,
        updateText,
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
