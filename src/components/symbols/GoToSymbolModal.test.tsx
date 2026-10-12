import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { GoToSymbolModal } from './GoToSymbolModal';
import { DocumentModel } from '../../types';

describe('GoToSymbolModal Component', () => {
  const mockDoc: DocumentModel = {
    id: 'test-doc',
    title: 'test.ts',
    filePath: 'src/test.ts',
    language: 'typescript',
    content: 'export class TestService {\n  run() {}\n}',
    contentRevision: 1,
    savedRevision: 1,
    isDirty: false,
    lastSavedTimestamp: Date.now(),
  };

  it('renders without throwing', () => {
    const onNavigate = vi.fn();
    const onClose = vi.fn();

    const element = React.createElement(GoToSymbolModal, {
      initialMode: 'document',
      activeDoc: mockDoc,
      onNavigate,
      onClose,
    });

    expect(element.type).toBe(GoToSymbolModal);
  });
});
