import React, { createContext, useContext, useState } from 'react';
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

export interface WorkspaceContextType {
  registry: DocumentRegistryState;
  activeDoc: DocumentModel | null;
  dirtyCloseTarget: DocumentModel | null;
  openDoc: (doc: DocumentModel) => void;
  createDoc: (title: string, content?: string, language?: string) => void;
  activateDoc: (documentId: string) => void;
  closeDoc: (documentId: string, force?: boolean) => void;
  updateText: (documentId: string, content: string) => void;
  saveDoc: (documentId: string) => void;
  cancelDirtyClose: () => void;
  confirmDiscardDirty: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

const initialWelcomeDoc = createNewDocument(
  'Welcome.md',
  '# Welcome to QM Editor\n\nQM Editor is a high-performance document and code editor.\n\n- Phase 01 Step 06: Document Workspace Model, Tabs & Editor Surface Foundation Established.\n- Centralized DocumentRegistry managing open document sessions, dirty state flags, and tab lifecycle.\n\nStart typing to edit your document.',
  'markdown'
);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [registry, setRegistry] = useState<DocumentRegistryState>(() =>
    createInitialRegistry([initialWelcomeDoc])
  );

  const [dirtyCloseTarget, setDirtyCloseTarget] = useState<DocumentModel | null>(null);

  const activeDoc = registry.activeDocId ? registry.documents[registry.activeDocId] || null : null;

  const openDoc = (doc: DocumentModel) => {
    setRegistry((prev) => registerOpenDocument(prev, doc));
  };

  const createDoc = (title: string, content: string = '', language: string = 'plaintext') => {
    const newDoc = createNewDocument(title, content, language);
    setRegistry((prev) => registerOpenDocument(prev, newDoc));
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

  const saveDoc = (documentId: string) => {
    setRegistry((prev) => saveDocumentState(prev, documentId));
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
        openDoc,
        createDoc,
        activateDoc,
        closeDoc,
        updateText,
        saveDoc,
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
