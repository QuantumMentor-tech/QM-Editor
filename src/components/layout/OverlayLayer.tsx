import React from 'react';
import { Dialog } from '../common/Dialog';
import { Button } from '../common/Button';
import { useShellState } from '../../state/ShellContext';
import { useWorkspace } from '../../state/WorkspaceContext';

export const OverlayLayer: React.FC = () => {
  const { state, closeDialog } = useShellState();
  const { dirtyCloseTarget, cancelDirtyClose, confirmDiscardDirty } = useWorkspace();

  return (
    <>
      {/* Shell Level System Dialog */}
      <Dialog isOpen={state.dialogOpen} onClose={closeDialog} title={state.dialogTitle}>
        {state.dialogContent || <p>Modal Overlay Layer initialized.</p>}
      </Dialog>

      {/* Workspace Level Dirty Close Guard Dialog */}
      <Dialog
        isOpen={dirtyCloseTarget !== null}
        onClose={cancelDirtyClose}
        title="Unsaved Changes Warning"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.5', color: 'var(--text-primary)' }}>
            Do you want to close <strong>{dirtyCloseTarget?.title}</strong> without saving? Your unsaved changes will be lost.
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <Button onClick={cancelDirtyClose} variant="secondary">
              Cancel
            </Button>
            <Button onClick={confirmDiscardDirty} variant="destructive">
              Discard Changes
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
};
