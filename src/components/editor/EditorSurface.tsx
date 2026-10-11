import React, { useEffect, useRef } from 'react';
import { DocumentModel } from '../../types';
import { CodeMirrorEditorAdapter } from './EditorAdapter';
import { useShellState } from '../../state/ShellContext';
import { useSearch } from '../../state/SearchContext';
import { SearchPanel } from '../search/SearchPanel';

import { useNavigation } from '../../state/NavigationContext';
import { useContextMenu } from '../../state/ContextMenuContext';
import { globalFocusManager } from '../../core/accessibility/FocusManager';

export interface EditorSurfaceProps {
  document: DocumentModel;
  onContentChange: (newContent: string) => void;
}

export const EditorSurface: React.FC<EditorSurfaceProps> = ({ document, onContentChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<CodeMirrorEditorAdapter | null>(null);
  const { state: shellState } = useShellState();
  const { matches, currentMatchIndex, currentMatch, isOpen } = useSearch();
  const { setCurrentPos, pushLocation } = useNavigation();
  const { openContextMenu } = useContextMenu();

  const docIdRef = useRef<string>(document.id);
  docIdRef.current = document.id;

  const docFilePathRef = useRef<string | undefined>(document.filePath);
  docFilePathRef.current = document.filePath;

  const docTitleRef = useRef<string>(document.title);
  docTitleRef.current = document.title;

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
      settings: shellState.editorSettings,
      onChange: (newContent) => {
        if (onContentChangeRef.current) {
          onContentChangeRef.current(newContent);
        }
      },
      onCursorActivity: (pos) => {
        setCurrentPos(pos);
        pushLocation({
          documentId: docIdRef.current,
          filePath: docFilePathRef.current,
          documentTitle: docTitleRef.current,
          line: pos.line,
          column: pos.column,
        });
      },
    });

    return () => {
      adapter.dispose();
      adapterRef.current = null;
    };
    // Re-mount only if active document ID changes
  }, [document.id, pushLocation, setCurrentPos]);

  // Register editor region with global focus manager (Rule 41)
  useEffect(() => {
    const unregister = globalFocusManager.registerRegion('editor', () => {
      return (
        containerRef.current?.querySelector<HTMLElement>('.cm-content') ||
        containerRef.current
      );
    });
    return unregister;
  }, []);

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

  // Sync editor presentation settings live
  useEffect(() => {
    if (adapterRef.current) {
      adapterRef.current.setSettings(shellState.editorSettings);
    }
  }, [shellState.editorSettings]);

  // Sync read-only state
  useEffect(() => {
    if (adapterRef.current) {
      adapterRef.current.setReadOnly(Boolean(document.fileResource?.readOnly));
    }
  }, [document.fileResource?.readOnly]);

  // Handle custom Go To Line events
  useEffect(() => {
    const handleGoToLineEvent = (e: CustomEvent<{ line: number; column?: number }>) => {
      if (adapterRef.current && e.detail) {
        adapterRef.current.goToLine(e.detail.line, e.detail.column || 1);
      }
    };

    window.addEventListener('qm:editor:gotoline' as any, handleGoToLineEvent as any);
    return () => {
      window.removeEventListener('qm:editor:gotoline' as any, handleGoToLineEvent as any);
    };
  }, []);

  // Handle editor command events (undo, redo, selectAll, copy, cut, paste)
  useEffect(() => {
    const handleUndo = () => adapterRef.current?.undo();
    const handleRedo = () => adapterRef.current?.redo();
    const handleSelectAll = () => adapterRef.current?.selectAll();
    const handleCopy = () => {
      const text = adapterRef.current?.getSelectedText();
      if (text && navigator.clipboard) {
        navigator.clipboard.writeText(text);
      }
    };

    window.addEventListener('qm:editor:undo', handleUndo);
    window.addEventListener('qm:editor:redo', handleRedo);
    window.addEventListener('qm:editor:selectall', handleSelectAll);
    window.addEventListener('qm:editor:copy', handleCopy);

    return () => {
      window.removeEventListener('qm:editor:undo', handleUndo);
      window.removeEventListener('qm:editor:redo', handleRedo);
      window.removeEventListener('qm:editor:selectall', handleSelectAll);
      window.removeEventListener('qm:editor:copy', handleCopy);
    };
  }, []);

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

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    openContextMenu(
      'contextmenu:editor',
      { x: e.clientX, y: e.clientY },
      { documentId: document.id, doc: document }
    );
  };

  return (
    <div
      onContextMenu={handleContextMenu}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
    >
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
