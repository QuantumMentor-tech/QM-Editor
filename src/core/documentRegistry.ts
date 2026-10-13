import { DocumentModel, FileResource } from '../types';
import { updateDocumentContent, markDocumentSaved } from './document';
import { areResourcesEqual } from './documents/ResourceIdentity';

export interface DocumentRegistryState {
  documents: Record<string, DocumentModel>;
  openDocIds: string[];
  activeDocId: string | null;
}

export const createInitialRegistry = (initialDocs: DocumentModel[] = []): DocumentRegistryState => {
  const documents: Record<string, DocumentModel> = {};
  const openDocIds: string[] = [];

  initialDocs.forEach((doc) => {
    documents[doc.id] = doc;
    openDocIds.push(doc.id);
  });

  return {
    documents,
    openDocIds,
    activeDocId: openDocIds.length > 0 ? openDocIds[0] : null,
  };
};

export const findExistingDocumentByResource = (
  state: DocumentRegistryState,
  uriOrPath: string
): DocumentModel | undefined => {
  if (!uriOrPath) return undefined;
  return Object.values(state.documents).find(
    (doc) => {
      const docUri = doc.fileResource?.uri || doc.filePath || '';
      return (
        doc.filePath === uriOrPath ||
        doc.fileResource?.uri === uriOrPath ||
        areResourcesEqual(docUri, uriOrPath)
      );
    }
  );
};

export const registerOpenDocument = (
  state: DocumentRegistryState,
  doc: DocumentModel
): DocumentRegistryState => {
  // If document with same ID is already open, activate it
  if (state.documents[doc.id]) {
    return {
      ...state,
      activeDocId: doc.id,
    };
  }

  // If document with same file path/resource is already open, activate existing tab
  const resourceUri = doc.fileResource?.uri || doc.filePath;
  if (resourceUri) {
    const existing = findExistingDocumentByResource(state, resourceUri);
    if (existing) {
      return {
        ...state,
        activeDocId: existing.id,
      };
    }
  }

  return {
    documents: {
      ...state.documents,
      [doc.id]: doc,
    },
    openDocIds: [...state.openDocIds, doc.id],
    activeDocId: doc.id,
  };
};

export const activateDocument = (
  state: DocumentRegistryState,
  documentId: string
): DocumentRegistryState => {
  if (!state.documents[documentId]) {
    return state; // Safe no-op if document ID doesn't exist
  }

  return {
    ...state,
    activeDocId: documentId,
  };
};

export const closeDocument = (
  state: DocumentRegistryState,
  documentId: string
): DocumentRegistryState => {
  if (!state.documents[documentId]) {
    return state;
  }

  const index = state.openDocIds.indexOf(documentId);
  const updatedOpenIds = state.openDocIds.filter((id) => id !== documentId);

  const updatedDocs = { ...state.documents };
  delete updatedDocs[documentId];

  let nextActiveId = state.activeDocId;

  // Determine next active document if the closed document was active
  if (state.activeDocId === documentId) {
    if (updatedOpenIds.length === 0) {
      nextActiveId = null;
    } else if (index < updatedOpenIds.length) {
      nextActiveId = updatedOpenIds[index]; // Next adjacent right tab
    } else {
      nextActiveId = updatedOpenIds[updatedOpenIds.length - 1]; // Left tab if was rightmost
    }
  }

  return {
    documents: updatedDocs,
    openDocIds: updatedOpenIds,
    activeDocId: nextActiveId,
  };
};

export const updateDocumentText = (
  state: DocumentRegistryState,
  documentId: string,
  newContent: string
): DocumentRegistryState => {
  const targetDoc = state.documents[documentId];
  if (!targetDoc) return state;

  const updated = updateDocumentContent(targetDoc, newContent);
  return {
    ...state,
    documents: {
      ...state.documents,
      [documentId]: updated,
    },
  };
};

export const saveDocumentState = (
  state: DocumentRegistryState,
  documentId: string,
  savedRevisionTarget?: number,
  newFileResource?: FileResource,
  newFilePath?: string
): DocumentRegistryState => {
  const targetDoc = state.documents[documentId];
  if (!targetDoc) return state;

  const saved = markDocumentSaved(targetDoc, savedRevisionTarget, newFileResource, newFilePath);
  return {
    ...state,
    documents: {
      ...state.documents,
      [documentId]: saved,
    },
  };
};

export const applyCommittedTransactionToRegistry = (
  state: DocumentRegistryState,
  updatedDoc: DocumentModel
): DocumentRegistryState => {
  if (!state.documents[updatedDoc.id]) return state;
  return {
    ...state,
    documents: {
      ...state.documents,
      [updatedDoc.id]: updatedDoc,
    },
  };
};
