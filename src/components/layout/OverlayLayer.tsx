import React from 'react';
import { Dialog } from '../common/Dialog';
import { useShellState } from '../../state/ShellContext';

export const OverlayLayer: React.FC = () => {
  const { state, closeDialog } = useShellState();

  return (
    <Dialog isOpen={state.dialogOpen} onClose={closeDialog} title={state.dialogTitle}>
      {state.dialogContent || <p>Modal Overlay Layer initialized.</p>}
    </Dialog>
  );
};
