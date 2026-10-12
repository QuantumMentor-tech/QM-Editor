import { DocumentModel, FileResource } from '../types';
import { QMEditorError, ErrorCode } from '../utils/errors';
import { globalLanguageRegistry } from './languageRegistry';

export const detectLanguageFromExtension = (filename: string): string => {
  return globalLanguageRegistry.resolveLanguage(filename).id;
};

export const extractFileName = (pathOrUri: string): string => {
  const parts = pathOrUri.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || pathOrUri;
};

export const createNewDocument = (
  title: string,
  content: string = '',
  language: string = 'plaintext',
  filePath?: string,
  fileResource?: FileResource
): DocumentModel => {
  if (!title || title.trim() === '') {
    throw new QMEditorError('Document title cannot be empty', ErrorCode.DOCUMENT_VALIDATION_ERROR, 'warning');
  }

  const resolved = globalLanguageRegistry.resolveLanguage(filePath || title, language !== 'plaintext' ? language : undefined);

  return {
    id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    title: title.trim(),
    content,
    filePath,
    fileResource,
    language: resolved.id,
    contentRevision: 0,
    savedRevision: 0,
    isDirty: false,
    lastSavedTimestamp: Date.now(),
  };
};

export const updateDocumentContent = (
  document: DocumentModel,
  newContent: string
): DocumentModel => {
  if (document.content === newContent) {
    return document;
  }

  const nextContentRevision = document.contentRevision + 1;
  const isDirty = nextContentRevision !== document.savedRevision;

  return {
    ...document,
    content: newContent,
    contentRevision: nextContentRevision,
    isDirty,
  };
};

export const markDocumentSaved = (
  document: DocumentModel,
  savedRevisionTarget?: number,
  newFileResource?: FileResource,
  newFilePath?: string
): DocumentModel => {
  const targetSavedRevision = savedRevisionTarget !== undefined ? savedRevisionTarget : document.contentRevision;
  const isStillDirty = document.contentRevision !== targetSavedRevision;

  const resource = newFileResource || document.fileResource;
  const path = newFilePath || resource?.uri || document.filePath;
  const updatedTitle = resource?.name || (newFilePath ? extractFileName(newFilePath) : document.title);
  const resolved = globalLanguageRegistry.resolveLanguage(path || updatedTitle);

  return {
    ...document,
    title: updatedTitle,
    filePath: path,
    fileResource: resource,
    language: resolved.id !== 'plaintext' ? resolved.id : document.language,
    savedRevision: targetSavedRevision,
    isDirty: isStillDirty,
    lastSavedTimestamp: Date.now(),
  };
};

export const applyEditTransaction = (
  document: DocumentModel,
  transaction: import('./edit').EditTransaction,
  options?: import('./edit').ApplyTransactionOptions
): Promise<{ document: DocumentModel; transaction: import('./edit').CommittedEditTransaction }> => {
  return import('./edit').then((m) => m.globalEditTransactionManager.applyTransaction(document, transaction, options));
};

export const applySingleEdit = (
  document: DocumentModel,
  edit: import('./edit').SingleTextEdit,
  origin: import('./edit').TransactionOrigin = 'user'
): Promise<{ document: DocumentModel; transaction: import('./edit').CommittedEditTransaction }> => {
  return import('./edit').then((m) =>
    m.globalEditTransactionManager.applyTransaction(document, {
      documentId: document.id,
      baseRevision: document.contentRevision,
      changes: [edit],
      origin,
    })
  );
};
