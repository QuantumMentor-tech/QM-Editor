import { DocumentModel } from '../types';
import { QMEditorError, ErrorCode } from '../utils/errors';

export const createNewDocument = (
  title: string,
  content: string = '',
  language: string = 'plaintext'
): DocumentModel => {
  if (!title || title.trim() === '') {
    throw new QMEditorError('Document title cannot be empty', ErrorCode.DOCUMENT_VALIDATION_ERROR, 'warning');
  }

  return {
    id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    title: title.trim(),
    content,
    language,
    isDirty: false,
    lastSavedTimestamp: Date.now(),
  };
};

export const updateDocumentContent = (
  document: DocumentModel,
  newContent: string
): DocumentModel => {
  return {
    ...document,
    content: newContent,
    isDirty: document.content !== newContent,
  };
};

export const markDocumentSaved = (document: DocumentModel): DocumentModel => {
  return {
    ...document,
    isDirty: false,
    lastSavedTimestamp: Date.now(),
  };
};
