import React, { useState, useEffect, useRef } from 'react';
import { WorkspaceSearchQuery, WorkspaceFileSearchResult, WorkspaceMatchItem, workspaceSearchService, WorkspaceSearchProgress } from '../../services/WorkspaceSearchService';
import { QuickOpenResource, workspaceIndexService } from '../../services/WorkspaceIndexService';
import { WorkspaceReplaceService } from '../../services/WorkspaceReplaceService';
import { WorkspaceReplaceModal } from './WorkspaceReplaceModal';
import { DocumentModel, WorkspaceRootModel } from '../../types';
import { Search, Replace, FileCode, ChevronDown, ChevronRight, AlertCircle, Loader2, Filter } from 'lucide-react';
import { Button } from '../common/Button';

export interface WorkspaceSearchModalProps {
  workspaceRoot: WorkspaceRootModel | null;
  openDocs: DocumentModel[];
  onSelectMatch: (resource: QuickOpenResource, match: WorkspaceMatchItem) => void | Promise<void>;
  updateText?: (id: string, text: string) => void;
  openDialog: (title: string, content: React.ReactNode) => void;
  closeDialog: () => void;
}

export const WorkspaceSearchModal: React.FC<WorkspaceSearchModalProps> = ({
  workspaceRoot,
  openDocs,
  onSelectMatch,
  updateText,
  openDialog,
  closeDialog,
}) => {
  const [queryText, setQueryText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [isRegex, setIsRegex] = useState(false);
  const [includePattern, setIncludePattern] = useState('');
  const [excludePattern, setExcludePattern] = useState('');

  const [showFilters, setShowFilters] = useState(false);
  const [showReplace, setShowReplace] = useState(false);

  const [searchResults, setSearchResults] = useState<WorkspaceFileSearchResult[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [progress, setProgress] = useState<WorkspaceSearchProgress | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set());

  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus query input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Ensure workspace resources are indexed
  const resources = workspaceIndexService.getResources();
  useEffect(() => {
    if (workspaceRoot && resources.length === 0) {
      workspaceIndexService.indexFromTree(workspaceRoot);
    }
  }, [workspaceRoot, resources.length]);

  const runSearch = async () => {
    if (!queryText.trim()) {
      setSearchResults([]);
      setTotalMatches(0);
      setProgress(null);
      setIsSearching(false);
      return;
    }

    const searchQuery: WorkspaceSearchQuery = {
      query: queryText,
      replaceText,
      caseSensitive,
      wholeWord,
      isRegex,
      includePattern,
      excludePattern,
    };

    setIsSearching(true);
    workspaceSearchService.cancelSearch();

    const currentResources = workspaceIndexService.getResources();
    const { results, totalMatches: count } = await workspaceSearchService.searchWorkspace(
      currentResources,
      searchQuery,
      (p) => setProgress(p)
    );

    setSearchResults(results);
    setTotalMatches(count);
    setIsSearching(false);
  };

  // Trigger search on query or option changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      runSearch();
    }, 200);
    return () => clearTimeout(timer);
  }, [queryText, caseSensitive, wholeWord, isRegex, includePattern, excludePattern]);

  const toggleFileCollapse = (fileId: string) => {
    setCollapsedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  };

  const handleOpenReplaceModal = async () => {
    if (!queryText.trim() || searchResults.length === 0) return;

    const searchQuery: WorkspaceSearchQuery = {
      query: queryText,
      replaceText,
      caseSensitive,
      wholeWord,
      isRegex,
      includePattern,
      excludePattern,
    };

    const plan = await WorkspaceReplaceService.buildReplacePlan(
      searchResults,
      searchQuery,
      replaceText,
      openDocs
    );

    openDialog(
      'Confirm Multi-File Replacement',
      <WorkspaceReplaceModal
        plan={plan}
        onConfirm={async () => {
          closeDialog();
          await WorkspaceReplaceService.executeReplacePlan(plan, openDocs, updateText);
          runSearch(); // Refresh search after replace
        }}
        onClose={closeDialog}
      />
    );
  };

  return (
    <div
      role="dialog"
      aria-label="Workspace Search & Replace"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        width: '100%',
        maxWidth: '640px',
        maxHeight: '520px',
        margin: '0 auto',
      }}
    >
      {/* Search Input Controls Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Row 1: Search Query Input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 10px',
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--accent-color)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <Search size={16} style={{ color: 'var(--accent-color)' }} />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Search in workspace files... (Ctrl+Shift+F)"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '0.9rem',
              fontFamily: 'inherit',
            }}
          />

          {/* Search Toggles */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <button
              onClick={() => setCaseSensitive(!caseSensitive)}
              title="Match Case (Aa)"
              style={{
                backgroundColor: caseSensitive ? 'var(--accent-color)' : 'var(--bg-secondary)',
                color: caseSensitive ? '#000' : 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '3px',
                padding: '2px 6px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Aa
            </button>
            <button
              onClick={() => setWholeWord(!wholeWord)}
              title="Match Whole Word (\b)"
              style={{
                backgroundColor: wholeWord ? 'var(--accent-color)' : 'var(--bg-secondary)',
                color: wholeWord ? '#000' : 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '3px',
                padding: '2px 6px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              \b
            </button>
            <button
              onClick={() => setIsRegex(!isRegex)}
              title="Use Regular Expression (.*)"
              style={{
                backgroundColor: isRegex ? 'var(--accent-color)' : 'var(--bg-secondary)',
                color: isRegex ? '#000' : 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '3px',
                padding: '2px 6px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              .*
            </button>
            <button
              onClick={() => setShowReplace(!showReplace)}
              title="Toggle Replace Input"
              style={{
                backgroundColor: showReplace ? 'var(--bg-panel)' : 'transparent',
                color: 'var(--text-muted)',
                border: 'none',
                padding: '2px 4px',
                cursor: 'pointer',
              }}
            >
              <Replace size={15} />
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              title="Toggle Include/Exclude Filters"
              style={{
                backgroundColor: showFilters ? 'var(--bg-panel)' : 'transparent',
                color: 'var(--text-muted)',
                border: 'none',
                padding: '2px 4px',
                cursor: 'pointer',
              }}
            >
              <Filter size={15} />
            </button>
          </div>
        </div>

        {/* Row 2: Replace Input Bar (if open) */}
        {showReplace && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 10px',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <Replace size={16} style={{ color: '#00d2ff' }} />
            <input
              type="text"
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              placeholder="Replace with..."
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                fontFamily: 'inherit',
              }}
            />
            <Button
              onClick={handleOpenReplaceModal}
              disabled={!queryText.trim() || searchResults.length === 0}
              variant="secondary"
            >
              Replace All...
            </Button>
          </div>
        )}

        {/* Row 3: Include / Exclude Filters (if open) */}
        {showFilters && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={includePattern}
              onChange={(e) => setIncludePattern(e.target.value)}
              placeholder="files to include (e.g. *.ts, src/**)"
              style={{
                flex: 1,
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                padding: '4px 8px',
                color: 'var(--text-primary)',
                fontSize: '0.78rem',
              }}
            />
            <input
              type="text"
              value={excludePattern}
              onChange={(e) => setExcludePattern(e.target.value)}
              placeholder="files to exclude (e.g. dist/**, *.spec.ts)"
              style={{
                flex: 1,
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                padding: '4px 8px',
                color: 'var(--text-primary)',
                fontSize: '0.78rem',
              }}
            />
          </div>
        )}
      </div>

      {/* Progress & Stats Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 4px',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isSearching ? (
            <>
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
              <span>
                Searching workspace... {progress ? `(${progress.scannedFiles}/${progress.totalFiles} files)` : ''}
              </span>
            </>
          ) : (
            <span>
              {totalMatches} {totalMatches === 1 ? 'match' : 'matches'} in {searchResults.length}{' '}
              {searchResults.length === 1 ? 'file' : 'files'}
            </span>
          )}
        </div>

        {isSearching && (
          <button
            onClick={() => workspaceSearchService.cancelSearch()}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent-color)',
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
          >
            Cancel Search
          </button>
        )}
      </div>

      {/* Grouped Results List */}
      <div
        role="listbox"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          maxHeight: '320px',
          overflowY: 'auto',
          paddingRight: '4px',
        }}
      >
        {searchResults.length === 0 && !isSearching ? (
          <div
            style={{
              padding: '24px 16px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.88rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={24} style={{ opacity: 0.6 }} />
            <span>
              {queryText.trim()
                ? `No matches found for "${queryText}" in workspace`
                : 'Type a query above to search workspace files'}
            </span>
          </div>
        ) : (
          searchResults.map((res) => {
            const isCollapsed = collapsedFiles.has(res.resource.id);

            return (
              <div
                key={res.resource.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-panel)',
                  overflow: 'hidden',
                }}
              >
                {/* File Header Row */}
                <div
                  onClick={() => toggleFileCollapse(res.resource.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    backgroundColor: 'var(--bg-tertiary)',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    <FileCode size={14} style={{ color: 'var(--accent-color)' }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {res.resource.name}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {res.resource.relativePath}
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      padding: '1px 6px',
                      borderRadius: '3px',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    {res.matches.length}
                  </span>
                </div>

                {/* Match Lines */}
                {!isCollapsed && (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {res.matches.map((m) => (
                      <div
                        key={m.id}
                        onClick={() => {
                          onSelectMatch(res.resource, m);
                          closeDialog();
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '4px 12px 4px 28px',
                          fontSize: '0.78rem',
                          fontFamily: 'var(--font-code)',
                          cursor: 'pointer',
                          borderTop: '1px solid var(--border-color)',
                          backgroundColor: 'transparent',
                          transition: 'background-color 0.1s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <span style={{ color: 'var(--text-muted)', minWidth: '40px' }}>
                          {m.line}:{m.column}
                        </span>
                        <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.lineText}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
