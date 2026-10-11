/**
 * QM Editor Terminal Screen & ANSI Renderer
 * Phase 1, Step 19 — Integrated Terminal & Safe Process Execution Foundation
 */

import React, { useEffect, useRef, useState } from 'react';
import { TerminalSession } from '../../core/terminal/TerminalSession';
import { useContextMenu } from '../../state/ContextMenuContext';
import { globalFocusManager } from '../../core/accessibility/FocusManager';

export interface TerminalScreenProps {
  session: TerminalSession;
  onUserInput: (data: string) => void;
}

const ANSI_COLOR_MAP: Record<string, string> = {
  '30': 'var(--text-muted)',
  '31': 'var(--error, #f85149)',
  '32': 'var(--success, #2ea043)',
  '33': 'var(--warning, #e3b341)',
  '34': 'var(--accent-primary, #58a6ff)',
  '35': 'var(--accent-secondary, #bc8cff)',
  '36': '#39c5bb',
  '37': 'var(--text-primary)',
  '90': 'var(--text-muted)',
  '91': '#ff7b72',
  '92': '#56d364',
  '93': '#e3b341',
  '94': '#79c0ff',
  '95': '#d2a8ff',
  '96': '#56d4dd',
  '97': '#f0f6fc',
};

export const parseAnsiText = (text: string): React.ReactNode[] => {
  // Simple regex matching ANSI escape sequences: \x1b[...m
  const regex = /\x1b\[([0-9;]+)m/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let currentColor: string | undefined = undefined;
  let isBold = false;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const part = text.substring(lastIndex, match.index);
      nodes.push(
        <span
          key={`${lastIndex}-${match.index}`}
          style={{
            color: currentColor,
            fontWeight: isBold ? 700 : 400,
          }}
        >
          {part}
        </span>
      );
    }

    const code = match[1];
    if (code === '0') {
      currentColor = undefined;
      isBold = false;
    } else if (code === '1') {
      isBold = true;
    } else if (code.includes(';')) {
      const parts = code.split(';');
      for (const p of parts) {
        if (p === '1') isBold = true;
        if (ANSI_COLOR_MAP[p]) currentColor = ANSI_COLOR_MAP[p];
      }
    } else if (ANSI_COLOR_MAP[code]) {
      currentColor = ANSI_COLOR_MAP[code];
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    const part = text.substring(lastIndex);
    nodes.push(
      <span
        key={`tail-${lastIndex}`}
        style={{
          color: currentColor,
          fontWeight: isBold ? 700 : 400,
        }}
      >
        {part}
      </span>
    );
  }

  return nodes;
};

export const TerminalScreen: React.FC<TerminalScreenProps> = ({ session, onUserInput }) => {
  const [lines, setLines] = useState<string[]>(session.getLines());
  const [inputValue, setInputValue] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = session.subscribe((s) => {
      setLines(s.getLines());
    });
    setLines(session.getLines());
    return unsubscribe;
  }, [session]);

  // Auto-scroll to bottom on line updates
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = inputValue;
      if (trimmed.length > 0) {
        setHistory((prev) => [...prev, trimmed]);
        setHistoryIndex(-1);
      }
      onUserInput(`${inputValue}\r`);
      setInputValue('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const nextIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(nextIndex);
        setInputValue(history[nextIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex !== -1) {
        const nextIndex = historyIndex + 1;
        if (nextIndex < history.length) {
          setHistoryIndex(nextIndex);
          setInputValue(history[nextIndex]);
        } else {
          setHistoryIndex(-1);
          setInputValue('');
        }
      }
    } else if (e.key === 'c' && e.ctrlKey) {
      e.preventDefault();
      onUserInput('\x03');
      setInputValue('');
    }
  };

  const handleScreenClick = () => {
    inputRef.current?.focus();
  };

  const { openContextMenu } = useContextMenu();

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    openContextMenu(
      'contextmenu:terminal',
      { x: e.clientX, y: e.clientY },
      { sessionId: session.getId(), session }
    );
  };

  const isExited = session.getStatus() === 'exited';

  useEffect(() => {
    const unregister = globalFocusManager.registerRegion('terminal', () => {
      return inputRef.current || containerRef.current;
    });
    return unregister;
  }, []);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Terminal Output"
      tabIndex={0}
      onClick={handleScreenClick}
      onContextMenu={handleContextMenu}
      style={{
        flex: 1,
        overflowY: 'auto',
        fontFamily: 'var(--font-code, monospace)',
        fontSize: '0.82rem',
        lineHeight: '1.45',
        backgroundColor: 'var(--bg-panel)',
        color: 'var(--text-primary)',
        padding: '8px 12px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        cursor: 'text',
      }}
    >
      {/* Scrollback Lines */}
      {lines.map((line, idx) => (
        <div key={idx} style={{ minHeight: '18px' }}>
          {parseAnsiText(line)}
        </div>
      ))}

      {/* Interactive Input Prompt Line */}
      {!isExited && (
        <div style={{ display: 'flex', alignItems: 'center', marginTop: '2px' }}>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Terminal Command Input"
            autoFocus
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontFamily: 'inherit',
              fontSize: 'inherit',
              padding: 0,
              margin: 0,
            }}
          />
        </div>
      )}

      {isExited && (
        <div style={{ marginTop: '8px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
          [Process exited with code {session.getModel().exitCode ?? 0}. Click '+' to open a new session.]
        </div>
      )}
    </div>
  );
};
