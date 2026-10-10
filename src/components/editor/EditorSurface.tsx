import React, { useEffect, useRef } from 'react';
import { DocumentModel } from '../../types';
import { CodeMirrorEditorAdapter } from './EditorAdapter';
import { useShellState } from '../../state/ShellContext';
import { useSearch } from '../../state/SearchContext';
import { SearchPanel } from '../search/SearchPanel';

export interface EditorSurfaceProps {
  document: DocumentModel;
  onContentChange: (newContent: string) => void;
}

export const EditorSurface: React.FC<EditorSurfaceProps> = ({ document, onContentChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<CodeMirrorEditorAdapter | null>(null);
  const { state: shellState } = useShellState();
  const { matches, currentMatchIndex, currentMatch, isOpen } = useSearch();

  const docIdRef = useRef<string>(document.id);
  docIdRef.current = document.id;

  const onContentChangeRef = useRef(onContentChange);
  onContentChangeRef.current = onContentChange;

  // Mount editor adapter instance
  useEffect(() => {
    if (!containerRef.current) return;

    const adapter = new CodeMirrorEditorAdapter();
    adapterRef.current = adapter;

    adapter.mount(containerRef.current, document.content, {
      theme: shellState.theme,
      readOnly: Boolean(document.fileResource?.readOnly),
      onChange: (newContent) => {
        if (onContentChangeRef.current) {
          onContentChangeRef.current(newContent);
        }
      },
    });

    return () => {
      adapter.dispose();
      adapterRef.current = null;
    };
    // Re-mount only if active document ID changes
  }, [document.id]);

  // Sync content programmatically when active document content changes from outside
  useEffect(() => {
    if (adapterRef.current) {
      adapterRef.current.setContent(document.content);
    }
  }, [document.content]);

  // Sync theme
  useEffect(() => {
    if (adapterRef.current) {
      adapterRef.current.setTheme(shellState.theme);
    }
  }, [shellState.theme]);

  // Sync read-only state
  useEffect(() => {
    if (adapterRef.current) {
      adapterRef.current.setReadOnly(Boolean(document.fileResource?.readOnly));
    }
  }, [document.fileResource?.readOnly]);

  // Highlight search matches in editor view
  useEffect(() => {
    if (!adapterRef.current) return;
    if (isOpen && matches.length > 0) {
      adapterRef.current.highlightMatches(
        matches.map((m) => ({ from: m.from, to: m.to })),
        currentMatchIndex
      );
    } else {
      adapterRef.current.clearSearchHighlights();
    }
  }, [matches, currentMatchIndex, isOpen]);

  // Scroll to active search match and select text
  useEffect(() => {
    if (adapterRef.current && isOpen && currentMatch) {
      adapterRef.current.selectAndRevealRange(currentMatch.from, currentMatch.to);
    }
  }, [currentMatch, isOpen]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Search & Replace Panel Overlay */}
      <SearchPanel />

      {/* CodeMirror Surface Container */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: 'var(--bg-editor)',
          overflow: 'hidden',
        }}
      />
    </div>
  );
};
