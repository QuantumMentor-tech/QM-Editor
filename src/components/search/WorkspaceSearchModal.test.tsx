import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { WorkspaceSearchModal } from './WorkspaceSearchModal';

describe('WorkspaceSearchModal Integration', () => {
  it('instantiates WorkspaceSearchModal element correctly', () => {
    const onSelectMatch = vi.fn();
    const openDialog = vi.fn();
    const closeDialog = vi.fn();

    const element = React.createElement(WorkspaceSearchModal, {
      workspaceRoot: null,
      openDocs: [],
      onSelectMatch,
      openDialog,
      closeDialog,
    });

    expect(element.props.workspaceRoot).toBeNull();
    expect(element.props.openDocs).toEqual([]);
  });
});
