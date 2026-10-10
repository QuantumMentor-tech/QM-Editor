import React from 'react';
import { Dialog } from '../common/Dialog';

export interface OverlayLayerProps {
  dialogOpen: boolean;
  onCloseDialog: () => void;
  dialogTitle?: string;
  dialogContent?: React.ReactNode;
}

export const OverlayLayer: React.FC<OverlayLayerProps> = ({
  dialogOpen,
  onCloseDialog,
  dialogTitle = 'Dialog Title',
  dialogContent,
}) => {
  return (
    <Dialog isOpen={dialogOpen} onClose={onCloseDialog} title={dialogTitle}>
      {dialogContent || <p>Modal Overlay Layer initialized.</p>}
    </Dialog>
  );
};
