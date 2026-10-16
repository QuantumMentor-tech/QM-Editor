import React, { useEffect, useRef, useState, useCallback } from 'react';
import { DocumentModel } from '../../types';
import { CodeMirrorEditorAdapter } from './EditorAdapter';
import { useShellState } from '../../state/ShellContext';
import { useSearch } from '../../state/SearchContext';
import { SearchPanel } from '../search/SearchPanel';
import { SuggestWidget } from './SuggestWidget';
import { HoverWidget } from './HoverWidget';
import { SignatureHelpWidget } from './SignatureHelpWidget';
import { CodeActionWidget } from './CodeActionWidget';
import { CodeActionPreviewModal } from './CodeActionPreviewModal';
import { ReferencesModal } from '../navigation/ReferencesModal';
import { RenameModal } from '../rename/RenameModal';
import { useNavigation } from '../../state/NavigationContext';
import { useContextMenu } from '../../state/ContextMenuContext';
import { globalFocusManager } from '../../core/accessibility/FocusManager';
import { globalDiagnosticService, normalizeDiagnosticUri } from '../../core/diagnostics';
import { globalEditorCoordinationService } from '../../core/editor';
import { globalCompletionCoordinator } from '../../core/language-intelligence/CompletionCoordinator';
import { globalHoverCoordinator } from '../../core/language-intelligence/HoverCoordinator';
import { globalSignatureHelpCoordinator } from '../../core/language-intelligence/SignatureHelpCoordinator';
import { globalCodeActionCoordinator } from '../../core/language-intelligence/CodeActionCoordinator';
import { globalLspNavigationCoordinator } from '../../core/lsp/navigation/LspNavigationCoordinator';
import { globalLspRenameCoordinator } from '../../core/lsp/rename/LspRenameCoordinator';
import { globalLspFormattingCoordinator } from '../../core/lsp/formatting/LspFormattingCoordinator';
import { globalFeedbackService } from '../../core/feedback/FeedbackService';
import { ReferenceResult } from '../../core/lsp/navigation/LspNavigationTypes';
import { Location, Range } from '../../core/navigation/LocationTypes';
import { globalWorkspaceEngine } from '../../core/workspace';
import {
  CompletionItem,
  CompletionTriggerKind,
  HoverResult,
  SignatureHelpResult,
} from '../../core/language-intelligence/LanguageIntelligenceTypes';
import {
  CodeAction,
  CodeActionRequest,
  CodeActionPreview,
  CodeActionTriggerKind,
} from '../../core/language-intelligence/CodeActionTypes';

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

  // Completion Suggestion State
  const [isSuggestOpen, setIsSuggestOpen] = useState<boolean>(false);
  const [suggestItems, setSuggestItems] = useState<CompletionItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [suggestPos, setSuggestPos] = useState<{ x: number; y: number }>({ x: 100, y: 100 });

  // Hover Information State (Step 43)
  const [isHoverOpen, setIsHoverOpen] = useState<boolean>(false);
  const [hoverResult, setHoverResult] = useState<HoverResult | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number }>({ x: 100, y: 100 });
  const hoverTimerRef = useRef<any>(null);

  // Signature Help State (Step 43)
  const [isSigOpen, setIsSigOpen] = useState<boolean>(false);
  const [sigResult, setSigResult] = useState<SignatureHelpResult | null>(null);
  const [sigPos, setSigPos] = useState<{ x: number; y: number }>({ x: 100, y: 100 });

  // Code Actions & Quick Fixes State (Step 44)
  const [isCodeActionOpen, setIsCodeActionOpen] = useState<boolean>(false);
  const [codeActions, setCodeActions] = useState<CodeAction[]>([]);
  const [selectedActionIndex, setSelectedActionIndex] = useState<number>(0);
  const [codeActionPos, setCodeActionPos] = useState<{ x: number; y: number }>({ x: 100, y: 100 });
  const [previewData, setPreviewData] = useState<CodeActionPreview | null>(null);
  const [pendingActionToApply, setPendingActionToApply] = useState<CodeAction | null>(null);

  // Code Navigation & References State (Step 60)
  const [referencesModalData, setReferencesModalData] = useState<{
    title: string;
    result?: ReferenceResult | null;
    locations?: Location[];
  } | null>(null);

  // LSP Rename State (Step 62)
  const [renameModalData, setRenameModalData] = useState<{
    currentName: string;
    range: Range;
    line: number;
    column: number;
  } | null>(null);

  const docIdRef = useRef<string>(document.id);
  docIdRef.current = document.id;

  const docFilePathRef = useRef<string | undefined>(document.filePath);
  docFilePathRef.current = document.filePath;

  const docTitleRef = useRef<string>(document.title);
  docTitleRef.current = document.title;

  const onContentChangeRef = useRef(onContentChange);
  onContentChangeRef.current = onContentChange;

  const triggerCompletion = useCallback(
    async (triggerKind: CompletionTriggerKind = 'invoked', triggerChar?: string) => {
      if (!adapterRef.current || document.fileResource?.readOnly) {
        setIsSuggestOpen(false);
        return;
      }

      const cursor = adapterRef.current.getCursorPosition();
      const res = await globalCompletionCoordinator.requestCompletions(document.id, cursor, {
        triggerKind,
        triggerCharacter: triggerChar,
      });

      if (res.items.length > 0) {
        // Compute position from active cursor element if available
        if (containerRef.current) {
          const cursorEl = containerRef.current.querySelector<HTMLElement>('.cm-cursor');
          if (cursorEl) {
            const cRect = cursorEl.getBoundingClientRect();
            setSuggestPos({ x: cRect.left, y: cRect.bottom + 4 });
          } else {
            const rect = containerRef.current.getBoundingClientRect();
            const fontSize = shellState.editorSettings.fontSize || 14;
            setSuggestPos({
              x: Math.min(rect.right - 350, rect.left + 45 + (cursor.column - 1) * (fontSize * 0.6)),
              y: Math.min(rect.bottom - 200, rect.top + (cursor.line - 1) * (fontSize * 1.5) + 24),
            });
          }
        }

        setSuggestItems(res.items);
        setSelectedIndex(0);
        setIsSuggestOpen(true);
      } else {
        setIsSuggestOpen(false);
      }
    },
    [document.id, document.fileResource?.readOnly, shellState.editorSettings.fontSize]
  );

  const handleSelectCompletion = useCallback(
    async (item: CompletionItem) => {
      setIsSuggestOpen(false);
      await globalCompletionCoordinator.applyCompletion(
        document.id,
        item,
        document.contentRevision
      );
      adapterRef.current?.focus();
    },
    [document.id, document.contentRevision]
  );

  // Mount editor adapter instance
  useEffect(() => {
    if (!containerRef.current) return;

    const adapter = new CodeMirrorEditorAdapter();
    adapterRef.current = adapter;
    const instanceId = `editor-${document.id}`;

    adapter.mount(containerRef.current, document.content, {
      theme: shellState.theme,
      readOnly: Boolean(document.fileResource?.readOnly),
      settings: shellState.editorSettings,
      onChange: (newContent) => {
        if (onContentChangeRef.current) {
          onContentChangeRef.current(newContent);
        }

        // Close suggestions if open and user types space or newline
        if (isSuggestOpen) {
          const cursor = adapter.getCursorPosition();
          const lineText = newContent.split('\n')[cursor.line - 1] || '';
          const lastChar = lineText[cursor.column - 2];
          if (!lastChar || lastChar === ' ' || lastChar === '\t') {
            setIsSuggestOpen(false);
          }
        }

        // Close hover on content edit
        setIsHoverOpen(false);

        // Check for signature help trigger characters '(' or ',' (Step 43)
        const cursor = adapter.getCursorPosition();
        const lineText = newContent.split('\n')[cursor.line - 1] || '';
        const lastChar = lineText[cursor.column - 2];
        if (lastChar === '(' || lastChar === ',') {
          globalSignatureHelpCoordinator
            .requestSignatureHelp(docIdRef.current, cursor, {
              triggerKind: 'triggerCharacter',
              triggerCharacter: lastChar,
            })
            .then((res) => {
              if (res && res.signatures.length > 0) {
                const coords = adapter.coordsAtPos();
                if (coords) {
                  setSigPos({ x: coords.left, y: coords.top });
                }
                setSigResult(res);
                setIsSigOpen(true);
              } else {
                setIsSigOpen(false);
              }
            });
        } else if (lastChar === ')' || lastChar === ';') {
          setIsSigOpen(false);
        }
      },
      onCursorActivity: (pos) => {
        setIsHoverOpen(false);
        setCurrentPos(pos);
        pushLocation({
          documentId: docIdRef.current,
          filePath: docFilePathRef.current,
          documentTitle: docTitleRef.current,
          line: pos.line,
          column: pos.column,
        });
        globalEditorCoordinationService.saveViewStateForInstance(instanceId, docIdRef.current);
      },
    });

    globalEditorCoordinationService.registerEditorInstance(instanceId, document.id, adapter);
    globalEditorCoordinationService.restoreViewStateForInstance(instanceId, document.id);

    return () => {
      globalEditorCoordinationService.unregisterEditorInstance(instanceId);
      adapter.dispose();
      adapterRef.current = null;
    };
    // Re-mount only if active document ID changes
  }, [document.id, pushLocation, setCurrentPos, isSuggestOpen]);

  // Mouse hover event listener on container (Step 43)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }

      const clientX = e.clientX;
      const clientY = e.clientY;

      hoverTimerRef.current = setTimeout(async () => {
        if (!adapterRef.current) return;
        const pos = adapterRef.current.posAtCoords({ x: clientX, y: clientY });
        if (!pos) {
          setIsHoverOpen(false);
          return;
        }

        const res = await globalHoverCoordinator.requestHover(docIdRef.current, pos, {
          triggerKind: 'mouse',
        });

        if (res && res.contents.length > 0) {
          setHoverPos({ x: clientX, y: clientY + 16 });
          setHoverResult(res);
          setIsHoverOpen(true);
        } else {
          setIsHoverOpen(false);
        }
      }, 300);
    };

    const handleMouseLeave = () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
      setIsHoverOpen(false);
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
    };
  }, []);

  // Intercept keyboard controls when SuggestWidget or SignatureHelpWidget is active
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isSuggestOpen) {
          e.preventDefault();
          e.stopPropagation();
          setIsSuggestOpen(false);
        }
        if (isHoverOpen) {
          e.preventDefault();
          e.stopPropagation();
          setIsHoverOpen(false);
        }
        if (isSigOpen) {
          e.preventDefault();
          e.stopPropagation();
          setIsSigOpen(false);
        }
        if (isCodeActionOpen) {
          e.preventDefault();
          e.stopPropagation();
          setIsCodeActionOpen(false);
        }
        if (previewData) {
          e.preventDefault();
          e.stopPropagation();
          setPreviewData(null);
          setPendingActionToApply(null);
        }
        return;
      }

      if (!isSuggestOpen || suggestItems.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => (prev + 1) % suggestItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => (prev - 1 + suggestItems.length) % suggestItems.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        const selected = suggestItems[selectedIndex] || suggestItems[0];
        if (selected) {
          handleSelectCompletion(selected);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isSuggestOpen, isHoverOpen, isSigOpen, suggestItems, selectedIndex, handleSelectCompletion]);

  // Listen for manual trigger suggestion command event
  useEffect(() => {
    const handleTriggerEvent = () => {
      triggerCompletion('invoked');
    };

    window.addEventListener('qm:editor:triggersuggest', handleTriggerEvent);
    return () => {
      window.removeEventListener('qm:editor:triggersuggest', handleTriggerEvent);
    };
  }, [triggerCompletion]);

  // Listen for manual show hover command event (Step 43)
  useEffect(() => {
    const handleShowHover = async () => {
      if (!adapterRef.current) return;
      const cursor = adapterRef.current.getCursorPosition();
      const coords = adapterRef.current.coordsAtPos();

      const res = await globalHoverCoordinator.requestHover(docIdRef.current, cursor, {
        triggerKind: 'manual',
      });

      if (res && res.contents.length > 0) {
        setHoverPos(coords ? { x: coords.left, y: coords.bottom + 8 } : { x: 200, y: 200 });
        setHoverResult(res);
        setIsHoverOpen(true);
      }
    };

    window.addEventListener('qm:editor:showhover', handleShowHover);
    return () => {
      window.removeEventListener('qm:editor:showhover', handleShowHover);
    };
  }, []);

  // Listen for manual trigger parameter hints command event (Step 43)
  useEffect(() => {
    const handleTriggerSig = async () => {
      if (!adapterRef.current) return;
      const cursor = adapterRef.current.getCursorPosition();
      const coords = adapterRef.current.coordsAtPos();

      const res = await globalSignatureHelpCoordinator.requestSignatureHelp(docIdRef.current, cursor, {
        triggerKind: 'invoked',
      });

      if (res && res.signatures.length > 0) {
        setSigPos(coords ? { x: coords.left, y: coords.top } : { x: 200, y: 200 });
        setSigResult(res);
        setIsSigOpen(true);
      }
    };

    window.addEventListener('qm:editor:triggerparameterhints', handleTriggerSig);
    return () => {
      window.removeEventListener('qm:editor:triggerparameterhints', handleTriggerSig);
    };
  }, []);

  // Listen for Code Navigation command events (Step 60)
  useEffect(() => {
    const handleGoToDefinition = async () => {
      if (!adapterRef.current) return;
      const cursor = adapterRef.current.getCursorPosition();
      const docUri = docFilePathRef.current || `untitled:${docIdRef.current}`;
      const lang = document.language || 'plaintext';
      const wsId = globalWorkspaceEngine.getWorkspaceId() || undefined;

      await globalLspNavigationCoordinator.goToDefinition(
        docIdRef.current,
        cursor,
        docUri,
        lang,
        document.contentRevision,
        wsId
      );
    };

    const handleGoToDeclaration = async () => {
      if (!adapterRef.current) return;
      const cursor = adapterRef.current.getCursorPosition();
      const docUri = docFilePathRef.current || `untitled:${docIdRef.current}`;
      const lang = document.language || 'plaintext';
      const wsId = globalWorkspaceEngine.getWorkspaceId() || undefined;

      await globalLspNavigationCoordinator.goToDeclaration(
        docIdRef.current,
        cursor,
        docUri,
        lang,
        document.contentRevision,
        wsId
      );
    };

    const handleGoToTypeDefinition = async () => {
      if (!adapterRef.current) return;
      const cursor = adapterRef.current.getCursorPosition();
      const docUri = docFilePathRef.current || `untitled:${docIdRef.current}`;
      const lang = document.language || 'plaintext';
      const wsId = globalWorkspaceEngine.getWorkspaceId() || undefined;

      await globalLspNavigationCoordinator.goToTypeDefinition(
        docIdRef.current,
        cursor,
        docUri,
        lang,
        document.contentRevision,
        wsId
      );
    };

    const handleFindReferences = async () => {
      if (!adapterRef.current) return;
      const cursor = adapterRef.current.getCursorPosition();
      const docUri = docFilePathRef.current || `untitled:${docIdRef.current}`;
      const lang = document.language || 'plaintext';
      const wsId = globalWorkspaceEngine.getWorkspaceId() || undefined;

      await globalLspNavigationCoordinator.findReferences(
        docIdRef.current,
        cursor,
        docUri,
        lang,
        document.contentRevision,
        wsId,
        true
      );
    };

    const handleMultiTargets = (e: Event) => {
      const customEvent = e as CustomEvent;
      setReferencesModalData({
        title: customEvent.detail.title || 'Multiple Definitions',
        locations: customEvent.detail.locations,
      });
    };

    const handleRefs = (e: Event) => {
      const customEvent = e as CustomEvent;
      setReferencesModalData({
        title: `References (${customEvent.detail.totalCount})`,
        result: customEvent.detail,
      });
    };

    const handleRename = async () => {
      if (!adapterRef.current) return;
      const cursor = adapterRef.current.getCursorPosition();
      const docUri = docFilePathRef.current || `untitled:${docIdRef.current}`;

      const prepRes = await globalLspRenameCoordinator.prepareRename({
        requestId: `prep-${Date.now()}`,
        workspaceId: globalWorkspaceEngine.getWorkspaceId() || 'default-workspace',
        workspaceGeneration: globalWorkspaceEngine.getGeneration(),
        documentId: docIdRef.current,
        resourceUri: docUri,
        documentRevision: document.contentRevision,
        line: cursor.line,
        column: cursor.column,
        languageId: document.language || 'plaintext',
      });

      if (!prepRes.valid || !prepRes.value) {
        globalFeedbackService.showInfo(prepRes.error || 'You cannot rename this element.');
        return;
      }

      setRenameModalData({
        currentName: prepRes.value.placeholder,
        range: prepRes.value.range,
        line: cursor.line,
        column: cursor.column,
      });
    };

    const handleFormatDocument = async () => {
      if (!adapterRef.current) return;
      await globalLspFormattingCoordinator.formatDocument(docIdRef.current);
    };

    const handleFormatSelection = async () => {
      if (!adapterRef.current) return;
      const selRange = adapterRef.current.getSelectionRange();
      if (!selRange) {
        globalFeedbackService.showInfo('No text selected to format. Select code or use Format Document.');
        return;
      }
      await globalLspFormattingCoordinator.formatRange(docIdRef.current, selRange);
    };

    window.addEventListener('qm:editor:gotodefinition', handleGoToDefinition);
    window.addEventListener('qm:editor:gotodeclaration', handleGoToDeclaration);
    window.addEventListener('qm:editor:gototypedefinition', handleGoToTypeDefinition);
    window.addEventListener('qm:editor:findreferences', handleFindReferences);
    window.addEventListener('qm:editor:rename', handleRename);
    window.addEventListener('qm:editor:formatdocument', handleFormatDocument);
    window.addEventListener('qm:editor:formatselection', handleFormatSelection);
    window.addEventListener('qm:navigation:multiple-targets', handleMultiTargets);
    window.addEventListener('qm:navigation:references', handleRefs);

    return () => {
      window.removeEventListener('qm:editor:gotodefinition', handleGoToDefinition);
      window.removeEventListener('qm:editor:gotodeclaration', handleGoToDeclaration);
      window.removeEventListener('qm:editor:gototypedefinition', handleGoToTypeDefinition);
      window.removeEventListener('qm:editor:findreferences', handleFindReferences);
      window.removeEventListener('qm:editor:rename', handleRename);
      window.removeEventListener('qm:editor:formatdocument', handleFormatDocument);
      window.removeEventListener('qm:editor:formatselection', handleFormatSelection);
      window.removeEventListener('qm:navigation:multiple-targets', handleMultiTargets);
      window.removeEventListener('qm:navigation:references', handleRefs);
    };
  }, [document.language, document.contentRevision]);

  // Code Action Execution & Preview Handlers (Step 44)
  const triggerCodeActions = useCallback(
    async (triggerKind: CodeActionTriggerKind = 'invoked') => {
      if (!adapterRef.current) return;
      const cursor = adapterRef.current.getCursorPosition();
      const coords = adapterRef.current.coordsAtPos();

      const docUri = docFilePathRef.current || `untitled:${docIdRef.current}`;
      const allDiagnostics = globalDiagnosticService.getDiagnostics(docUri);
      const overlapping = allDiagnostics.filter(
        (d: any) => !d.range || (d.range.startLine <= cursor.line && d.range.endLine >= cursor.line)
      );

      const request: CodeActionRequest = {
        requestId: `ca-${Date.now()}`,
        workspaceId: globalWorkspaceEngine.getWorkspaceId() || 'default',
        workspaceGeneration: globalWorkspaceEngine.getGeneration(),
        documentId: docIdRef.current,
        resourceUri: docUri,
        editorModelId: docIdRef.current,
        documentRevision: document.contentRevision,
        range: {
          startLine: cursor.line,
          startColumn: cursor.column,
          endLine: cursor.line,
          endColumn: cursor.column,
        },
        diagnostics: overlapping,
        languageId: document.language || 'plaintext',
        triggerKind,
      };

      const actions = await globalCodeActionCoordinator.provideCodeActions(request);
      if (actions.length > 0) {
        setCodeActionPos(coords ? { x: coords.left, y: coords.bottom + 8 } : { x: 200, y: 200 });
        setCodeActions(actions);
        setSelectedActionIndex(0);
        setIsCodeActionOpen(true);
      }
    },
    [document.contentRevision, document.language]
  );

  const handleApplyCodeAction = useCallback(
    async (action: CodeAction) => {
      setIsCodeActionOpen(false);
      await globalCodeActionCoordinator.applyCodeAction(action, {
        documentId: docIdRef.current,
        expectedRevision: document.contentRevision,
      });
    },
    [document.contentRevision]
  );

  const handlePreviewCodeAction = useCallback(async (action: CodeAction) => {
    setIsCodeActionOpen(false);
    const preview = await globalCodeActionCoordinator.previewCodeAction(action);
    setPreviewData(preview);
    setPendingActionToApply(action);
  }, []);

  const handleConfirmPreview = useCallback(async () => {
    if (pendingActionToApply) {
      const action = pendingActionToApply;
      setPreviewData(null);
      setPendingActionToApply(null);
      await globalCodeActionCoordinator.applyCodeAction(action, {
        documentId: docIdRef.current,
        expectedRevision: document.contentRevision,
      });
    }
  }, [pendingActionToApply, document.contentRevision]);

  const handleExecuteRename = useCallback(
    async (newName: string) => {
      if (!renameModalData) return;
      const docUri = docFilePathRef.current || `untitled:${docIdRef.current}`;

      await globalLspRenameCoordinator.executeRename(
        {
          requestId: `rename-${Date.now()}`,
          workspaceId: globalWorkspaceEngine.getWorkspaceId() || 'default-workspace',
          workspaceGeneration: globalWorkspaceEngine.getGeneration(),
          documentId: docIdRef.current,
          resourceUri: docUri,
          documentRevision: document.contentRevision,
          line: renameModalData.line,
          column: renameModalData.column,
          newName,
          languageId: document.language || 'plaintext',
        },
        renameModalData.currentName
      );
    },
    [renameModalData, document.contentRevision, document.language]
  );

  // Listen for manual trigger code action / quick fix command event (Step 44)
  useEffect(() => {
    const handleQuickFixEvent = () => {
      triggerCodeActions('invoked');
    };

    window.addEventListener('qm:editor:quickfix', handleQuickFixEvent);
    return () => {
      window.removeEventListener('qm:editor:quickfix', handleQuickFixEvent);
    };
  }, [triggerCodeActions]);

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
    const handleUndo = () => {
      if (document.fileResource?.readOnly) return;
      adapterRef.current?.undo();
    };
    const handleRedo = () => {
      if (document.fileResource?.readOnly) return;
      adapterRef.current?.redo();
    };
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

  // Sync document diagnostics with editor squiggles and annotations
  useEffect(() => {
    if (!adapterRef.current) return;

    const uri = document.filePath || document.title || document.id;

    const syncDiagnostics = () => {
      if (!adapterRef.current) return;
      const diags = globalDiagnosticService.getDiagnostics(uri);
      adapterRef.current.setDiagnostics(diags);
    };

    // Initial sync
    syncDiagnostics();

    // Subscribe to diagnostic updates
    const unsubscribe = globalDiagnosticService.subscribe((event) => {
      const normalizedTarget = normalizeDiagnosticUri(uri);
      if (
        event.type === 'cleared' ||
        event.uris.length === 0 ||
        event.uris.some((u) => normalizeDiagnosticUri(u) === normalizedTarget)
      ) {
        syncDiagnostics();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [document.id, document.filePath, document.title, document.content]);

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

      {/* Suggestion Completion Widget */}
      {isSuggestOpen && suggestItems.length > 0 && (
        <SuggestWidget
          items={suggestItems}
          selectedIndex={selectedIndex}
          position={suggestPos}
          onSelect={handleSelectCompletion}
          onClose={() => setIsSuggestOpen(false)}
        />
      )}

      {/* Contextual Hover Widget (Step 43) */}
      {isHoverOpen && hoverResult && (
        <HoverWidget
          result={hoverResult}
          position={hoverPos}
          onClose={() => setIsHoverOpen(false)}
        />
      )}

      {/* Signature Help Parameter Hints Widget (Step 43) */}
      {isSigOpen && sigResult && (
        <SignatureHelpWidget
          result={sigResult}
          position={sigPos}
          onClose={() => setIsSigOpen(false)}
        />
      )}

      {/* Code Action & Quick Fix Widget (Step 44) */}
      {isCodeActionOpen && codeActions.length > 0 && (
        <CodeActionWidget
          actions={codeActions}
          selectedIndex={selectedActionIndex}
          position={codeActionPos}
          onSelectIndex={setSelectedActionIndex}
          onApply={handleApplyCodeAction}
          onPreview={handlePreviewCodeAction}
          onClose={() => setIsCodeActionOpen(false)}
        />
      )}

      {/* Code Action Preview Modal (Step 44) */}
      {previewData && (
        <CodeActionPreviewModal
          preview={previewData}
          onApply={handleConfirmPreview}
          onCancel={() => {
            setPreviewData(null);
            setPendingActionToApply(null);
          }}
        />
      )}

      {/* Code Navigation & References Modal (Step 60) */}
      {referencesModalData && (
        <ReferencesModal
          title={referencesModalData.title}
          result={referencesModalData.result}
          locations={referencesModalData.locations}
          onClose={() => setReferencesModalData(null)}
        />
      )}

      {/* LSP Rename Modal (Step 62) */}
      {renameModalData && (
        <RenameModal
          isOpen={Boolean(renameModalData)}
          currentName={renameModalData.currentName}
          range={renameModalData.range}
          onRename={handleExecuteRename}
          onClose={() => setRenameModalData(null)}
        />
      )}

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
