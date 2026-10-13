/**
 * QM Editor Problems & Diagnostics Panel
 * Phase 1, Step 20 — Tasks, Build, Run & Problem Matcher Foundation
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTasks } from '../../state/TaskContext';
import { useWorkspace } from '../../state/WorkspaceContext';
import { useContextMenu } from '../../state/ContextMenuContext';
import { AlertCircle, AlertTriangle, Info, Trash2, Filter, FileText, CheckCircle2 } from 'lucide-react';
import { Problem, ProblemSeverity } from '../../core/tasks/TaskTypes';
import { globalFocusManager } from '../../core/accessibility/FocusManager';
import { EmptyState } from '../common/EmptyState';
import { globalDiagnosticService, diagnosticToProblem, Diagnostic } from '../../core/diagnostics';

export const ProblemsPanel: React.FC = () => {
  const { allProblems, clearProblems } = useTasks();
  const { openContextMenu } = useContextMenu();
  const workspaceContext = useWorkspace();
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [serviceDiagnostics, setServiceDiagnostics] = useState<Diagnostic[]>(() =>
    globalDiagnosticService.getDiagnostics()
  );

  useEffect(() => {
    const unsubscribe = globalDiagnosticService.subscribe(() => {
      setServiceDiagnostics(globalDiagnosticService.getDiagnostics());
    });
    return unsubscribe;
  }, []);

  // Merge task problems and diagnostics, deduplicating by ID
  const combinedProblems = useMemo(() => {
    const map = new Map<string, Problem>();
    for (const prob of allProblems) {
      map.set(prob.id, prob);
    }
    for (const diag of serviceDiagnostics) {
      if (!map.has(diag.id)) {
        map.set(diag.id, diagnosticToProblem(diag));
      }
    }
    return Array.from(map.values());
  }, [allProblems, serviceDiagnostics]);

  const availableSources = useMemo(() => {
    const set = new Set<string>();
    for (const p of combinedProblems) {
      if (p.source) set.add(p.source);
    }
    return Array.from(set).sort();
  }, [combinedProblems]);

  const errorCount = useMemo(() => {
    return combinedProblems.filter((p) => p.severity === 'error').length;
  }, [combinedProblems]);

  const warningCount = useMemo(() => {
    return combinedProblems.filter((p) => p.severity === 'warning').length;
  }, [combinedProblems]);

  const handleClearAll = () => {
    clearProblems();
    globalDiagnosticService.clear();
  };

  const filteredProblems = combinedProblems.filter((p) => {
    if (filterSeverity !== 'all' && p.severity !== filterSeverity) return false;
    if (filterSource !== 'all' && p.source !== filterSource) return false;
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      return (
        p.message.toLowerCase().includes(q) ||
        p.file.toLowerCase().includes(q) ||
        (p.code && p.code.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleProblemClick = async (problem: Problem) => {
    // 1. Look up original Diagnostic if present to validate against DocumentEngine buffer
    const originalDiag = serviceDiagnostics.find((d) => d.id === problem.id);
    const target = originalDiag
      ? globalDiagnosticService.validateNavigationTarget(originalDiag)
      : {
          valid: true,
          uri: problem.file,
          line: Math.max(1, problem.line || 1),
          column: Math.max(1, problem.column || 1),
          isResourceLevel: !problem.line || problem.line <= 0,
        };

    if (!target.valid) return;

    // 2. Open or activate the file
    if (workspaceContext.openFilePath) {
      await workspaceContext.openFilePath(target.uri);
    } else {
      const matching = workspaceContext.openDocs.find(
        (d) => d.filePath === target.uri || d.title === target.uri
      );
      if (matching) {
        workspaceContext.activateDoc(matching.id);
      }
    }

    // 3. Dispatch jump-to-line event if not resource-level only
    if (!target.isResourceLevel) {
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent('qm:editor:gotoline', {
            detail: { line: target.line, column: target.column },
          })
        );
      }, 50);
    }
  };

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unregister = globalFocusManager.registerRegion('problems', () => containerRef.current);
    return unregister;
  }, []);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Problems Diagnostics Panel"
      tabIndex={0}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        fontSize: '0.82rem',
        overflow: 'hidden',
      }}
    >
      {/* Problems Toolbar */}
      <div
        style={{
          height: '34px',
          padding: '0 12px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-secondary)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontWeight: 600 }}>Problems</span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                padding: '1px 6px',
                borderRadius: '10px',
                backgroundColor: errorCount > 0 ? 'rgba(218, 54, 51, 0.15)' : 'var(--bg-muted)',
                color: errorCount > 0 ? '#f85149' : 'var(--text-muted)',
                fontWeight: 600,
              }}
            >
              <AlertCircle size={11} />
              {errorCount} {errorCount === 1 ? 'Error' : 'Errors'}
            </span>

            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                padding: '1px 6px',
                borderRadius: '10px',
                backgroundColor: warningCount > 0 ? 'rgba(210, 153, 34, 0.15)' : 'var(--bg-muted)',
                color: warningCount > 0 ? '#d29922' : 'var(--text-muted)',
                fontWeight: 600,
              }}
            >
              <AlertTriangle size={11} />
              {warningCount} {warningCount === 1 ? 'Warning' : 'Warnings'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Severity Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Filter size={12} color="var(--text-muted)" />
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              aria-label="Filter problems by severity"
              style={{
                fontSize: '0.72rem',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '3px',
                padding: '2px 4px',
              }}
            >
              <option value="all">All Severities</option>
              <option value="error">Errors Only</option>
              <option value="warning">Warnings Only</option>
              <option value="info">Info Only</option>
            </select>
          </div>

          {/* Source / Provider Filter */}
          {availableSources.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <select
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value)}
                aria-label="Filter problems by source"
                style={{
                  fontSize: '0.72rem',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '3px',
                  padding: '2px 4px',
                }}
              >
                <option value="all">All Sources</option>
                {availableSources.map((src) => (
                  <option key={src} value={src}>
                    {src}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Search Filter */}
          <input
            type="text"
            placeholder="Filter problems..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            aria-label="Filter problems text search"
            style={{
              fontSize: '0.72rem',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '3px',
              padding: '2px 6px',
              width: '140px',
            }}
          />

          {combinedProblems.length > 0 && (
            <button
              onClick={handleClearAll}
              title="Clear All Problems"
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '3px 6px',
                borderRadius: '3px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-muted)',
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Problems List */}
      <div role="list" aria-label="Diagnostic Problems List" style={{ flex: 1, overflowY: 'auto' }}>
        {filteredProblems.length > 0 ? (
          filteredProblems.map((problem) => (
            <div
              key={problem.id}
              role="listitem"
              tabIndex={0}
              aria-label={`${problem.severity}, ${problem.file}, line ${problem.line}, column ${problem.column}: ${problem.message} (${problem.source})`}
              onClick={() => handleProblemClick(problem)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleProblemClick(problem);
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                openContextMenu(
                  'contextmenu:problem',
                  { x: e.clientX, y: e.clientY },
                  { file: problem.file, line: problem.line, column: problem.column, message: problem.message, problem }
                );
              }}
              title={`Jump to ${problem.file}:${problem.line}:${problem.column}`}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                padding: '6px 12px',
                borderBottom: '1px solid var(--border-color)',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <div style={{ marginTop: '2px', flexShrink: 0 }}>
                {renderSeverityIcon(problem.severity)}
              </div>

              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                    {problem.message}
                  </span>

                  {problem.code && (
                    <span
                      style={{
                        padding: '1px 5px',
                        borderRadius: '3px',
                        backgroundColor: 'var(--bg-secondary)',
                        fontSize: '0.68rem',
                        color: 'var(--text-accent)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      {problem.code}
                    </span>
                  )}

                  <span
                    style={{
                      fontSize: '0.68rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    [{problem.source}]
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.72rem',
                    color: 'var(--text-muted)',
                    marginTop: '2px',
                    fontFamily: 'var(--font-code, monospace)',
                  }}
                >
                  <FileText size={11} />
                  <span>
                    {problem.file}
                    {problem.line > 0 ? ` [${problem.line}, ${problem.column}]` : ' [Resource]'}
                  </span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div style={{ padding: '32px 16px' }}>
            {combinedProblems.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 size={32} style={{ color: 'var(--text-success, #2ea043)' }} />}
                title="No problems detected in workspace"
                description="No compiler, linter, or task diagnostic issues recorded in this session."
              />
            ) : (
              <EmptyState
                icon={<Filter size={32} style={{ color: 'var(--text-muted)' }} />}
                title="No matching problems"
                description="No diagnostic problems match the active severity or search filter."
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

function renderSeverityIcon(severity: ProblemSeverity) {
  switch (severity) {
    case 'error':
      return <AlertCircle size={14} color="#f85149" />;
    case 'warning':
      return <AlertTriangle size={14} color="#d29922" />;
    case 'info':
    case 'hint':
    default:
      return <Info size={14} color="#58a6ff" />;
  }
}
