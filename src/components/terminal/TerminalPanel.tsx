/**
 * QM Editor Terminal Panel Component
 * Phase 1, Step 19 — Integrated Terminal & Safe Process Execution Foundation
 */

import React, { useEffect } from 'react';
import { useTerminal } from '../../state/TerminalContext';
import { useExplorer } from '../../state/ExplorerContext';
import { TerminalView } from './TerminalView';

export const TerminalPanel: React.FC = () => {
  const { sessions, createTerminal } = useTerminal();
  const { workspaceRoot } = useExplorer();

  useEffect(() => {
    if (sessions.length === 0) {
      createTerminal({
        cwd: workspaceRoot ? workspaceRoot.name : undefined,
      });
    }
  }, [sessions.length, createTerminal, workspaceRoot]);

  return <TerminalView />;
};
