import React, { useEffect, useRef } from 'react';
import { DocumentModel } from '../../types';
import { CodeMirrorEditorAdapter } from './EditorAdapter';
import { useShellState } from '../../state/ShellContext';

export interface EditorSurfaceProps {
  document: DocumentModel;
  onContentChange: (newContent: string) => void;
}

export const EditorSurface: React.FC<EditorSurfaceProps> = ({ document, onContentChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<CodeMirrorEditorAdapter | null>(null);
  const { state: shellState } = useShellState();

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

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: 'var(--bg-editor)',
        overflow: 'hidden',
      }}
    />
  );
};
