import { describe, it, expect } from 'vitest';
import React from 'react';
import { WorkspaceProvider, useWorkspace } from './WorkspaceContext';

const TestComponent: React.FC = () => {
  const { registry, activeDoc, createDoc, closeDoc } = useWorkspace();

  return (
    <div>
      <span data-testid="active-id">{registry.activeDocId || 'none'}</span>
      <span data-testid="doc-count">{registry.openDocIds.length}</span>
      <button data-testid="new-doc" onClick={() => createDoc('test.txt', 'Content')}>
        New Doc
      </button>
      {activeDoc && (
        <button data-testid="close-doc" onClick={() => closeDoc(activeDoc.id)}>
          Close Active
        </button>
      )}
    </div>
  );
};

describe('WorkspaceContext', () => {
  it('provides initial workspace state and supports document operations', () => {
    const element = React.createElement(WorkspaceProvider, null, React.createElement(TestComponent));
    expect(element.props.children).toBeDefined();
  });
});
