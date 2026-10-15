/**
 * QM Editor Application Backup, Export, Import & Restore Modal
 * Phase 05, Step 54 — Backup, Export, Import & Safe Data Portability
 */

import React, { useState } from 'react';
import { useShellState } from '../../state/ShellContext';
import {
  globalBackupCoordinator,
  ImportPlanDTO,
  OperationResult,
  PackageEnvelopeDTO,
  PortabilityPackageType,
  PortabilityStrategy,
} from '../../core/portability';
import { Button } from '../common/Button';
import {
  Archive,
  Download,
  Upload,
  RotateCcw,
  CheckCircle,
  XCircle,
  Settings,
  History,
  ShieldCheck,
} from 'lucide-react';

export const BackupPortabilityModal: React.FC = () => {
  const { closeDialog } = useShellState();

  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');

  // Export State
  const [exportType, setExportType] = useState<PortabilityPackageType>('fullBackup');
  const [includeHistory, setIncludeHistory] = useState<boolean>(false);
  const [includeRecent, setIncludeRecent] = useState<boolean>(true);
  const [exportLabel, setExportLabel] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportedPackage, setExportedPackage] = useState<PackageEnvelopeDTO | null>(null);

  // Import State
  const [importJson, setImportJson] = useState<string>('');
  const [importPlan, setImportPlan] = useState<ImportPlanDTO | null>(null);
  const [stagedEnvelope, setStagedEnvelope] = useState<PackageEnvelopeDTO | null>(null);
  const [strategy, setStrategy] = useState<PortabilityStrategy>('merge');
  const [createSafetyBackup, setCreateSafetyBackup] = useState<boolean>(true);
  const [isPlanning, setIsPlanning] = useState<boolean>(false);
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [operationResult, setOperationResult] = useState<OperationResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Export Action
  // ---------------------------------------------------------------------------

  const handleGenerateExport = async () => {
    setIsExporting(true);
    setExportedPackage(null);
    try {
      let pkg: PackageEnvelopeDTO;
      if (exportType === 'settingsExport') {
        pkg = await globalBackupCoordinator.exportSettings({ label: exportLabel || undefined });
      } else if (exportType === 'historyExport') {
        pkg = await globalBackupCoordinator.exportHistory(undefined, {
          label: exportLabel || undefined,
        });
      } else {
        pkg = await globalBackupCoordinator.createBackup({
          type: exportType,
          includeHistory,
          includeRecent,
          label: exportLabel || undefined,
        });
      }
      setExportedPackage(pkg);
    } catch (err) {
      setImportError(`Failed to generate export: ${(err as Error).message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadFile = () => {
    if (!exportedPackage) return;
    const jsonStr = JSON.stringify(exportedPackage, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date(exportedPackage.manifest.createdAt)
      .toISOString()
      .replace(/[:.]/g, '-');
    a.download = `QM-Editor-${exportedPackage.manifest.packageType}-${dateStr}.qmexport`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ---------------------------------------------------------------------------
  // Import Action
  // ---------------------------------------------------------------------------

  const handleAnalyzePackage = async () => {
    if (!importJson.trim()) {
      setImportError('Please paste or upload package JSON content first.');
      return;
    }
    setIsPlanning(true);
    setImportError(null);
    setImportPlan(null);
    setOperationResult(null);

    try {
      const { plan, envelope } = await globalBackupCoordinator.generateImportPlan(importJson);
      setImportPlan(plan);
      setStagedEnvelope(envelope);
    } catch (err) {
      setImportError(`Package validation failed: ${(err as Error).message}`);
    } finally {
      setIsPlanning(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportJson(content);
      setImportError(null);
    };
    reader.onerror = () => {
      setImportError('Failed to read uploaded file.');
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    if (!stagedEnvelope || !importPlan) return;
    setIsApplying(true);
    setImportError(null);

    try {
      const result = await globalBackupCoordinator.applyImport(stagedEnvelope, {
        strategy,
        createSafetyBackup,
        rebuildIndexes: true,
      });
      setOperationResult(result);
    } catch (err) {
      setImportError(`Import execution failed: ${(err as Error).message}`);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="backup-modal-title"
    >
      <div
        style={{
          width: '760px',
          maxHeight: '85vh',
          backgroundColor: 'var(--bg-secondary, #1e1e1e)',
          borderRadius: 'var(--radius-lg, 8px)',
          border: '1px solid var(--border-color, #333)',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: 'var(--text-primary, #ccc)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid var(--border-color, #333)',
            backgroundColor: 'var(--bg-tertiary, #252526)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Archive size={18} style={{ color: 'var(--accent-color, #38bdf8)' }} />
            <h2 id="backup-modal-title" style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
              Backup, Export & Data Portability
            </h2>
          </div>
          <button
            onClick={closeDialog}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted, #888)',
              fontSize: '1.2rem',
              cursor: 'pointer',
              padding: '4px',
            }}
            aria-label="Close Backup Dialog"
          >
            ×
          </button>
        </div>

        {/* Tab Controls */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-color, #333)',
            backgroundColor: 'var(--bg-primary, #181818)',
          }}
        >
          <button
            onClick={() => setActiveTab('export')}
            style={{
              flex: 1,
              padding: '10px 16px',
              border: 'none',
              background: activeTab === 'export' ? 'var(--bg-secondary, #1e1e1e)' : 'transparent',
              color: activeTab === 'export' ? 'var(--accent-color, #38bdf8)' : 'var(--text-secondary, #999)',
              fontWeight: activeTab === 'export' ? 600 : 400,
              cursor: 'pointer',
              borderBottom: activeTab === 'export' ? '2px solid var(--accent-color, #38bdf8)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <Download size={14} /> Create Backup & Export
          </button>
          <button
            onClick={() => setActiveTab('import')}
            style={{
              flex: 1,
              padding: '10px 16px',
              border: 'none',
              background: activeTab === 'import' ? 'var(--bg-secondary, #1e1e1e)' : 'transparent',
              color: activeTab === 'import' ? 'var(--accent-color, #38bdf8)' : 'var(--text-secondary, #999)',
              fontWeight: activeTab === 'import' ? 600 : 400,
              cursor: 'pointer',
              borderBottom: activeTab === 'import' ? '2px solid var(--accent-color, #38bdf8)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <Upload size={14} /> Import & Restore
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {importError && (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '6px',
                color: '#ef4444',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <XCircle size={16} />
              <span>{importError}</span>
            </div>
          )}

          {activeTab === 'export' ? (
            /* =========================================================================
             * EXPORT & BACKUP TAB
             * ========================================================================= */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Package Type
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setExportType('fullBackup')}
                    style={{
                      padding: '12px',
                      borderRadius: '6px',
                      border: `1px solid ${exportType === 'fullBackup' ? 'var(--accent-color, #38bdf8)' : 'var(--border-color, #333)'}`,
                      backgroundColor: exportType === 'fullBackup' ? 'rgba(56, 189, 248, 0.1)' : 'var(--bg-tertiary, #252526)',
                      color: 'var(--text-primary, #eee)',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.88rem' }}>
                      <ShieldCheck size={16} color="#38bdf8" /> Full Backup
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #888)', marginTop: '4px' }}>
                      Complete preservation of settings, workspaces, and recent resources.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportType('settingsExport')}
                    style={{
                      padding: '12px',
                      borderRadius: '6px',
                      border: `1px solid ${exportType === 'settingsExport' ? 'var(--accent-color, #38bdf8)' : 'var(--border-color, #333)'}`,
                      backgroundColor: exportType === 'settingsExport' ? 'rgba(56, 189, 248, 0.1)' : 'var(--bg-tertiary, #252526)',
                      color: 'var(--text-primary, #eee)',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.88rem' }}>
                      <Settings size={16} color="#10b981" /> Settings Only
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #888)', marginTop: '4px' }}>
                      Portable preferences and editor configuration without workspace state.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportType('historyExport')}
                    style={{
                      padding: '12px',
                      borderRadius: '6px',
                      border: `1px solid ${exportType === 'historyExport' ? 'var(--accent-color, #38bdf8)' : 'var(--border-color, #333)'}`,
                      backgroundColor: exportType === 'historyExport' ? 'rgba(56, 189, 248, 0.1)' : 'var(--bg-tertiary, #252526)',
                      color: 'var(--text-primary, #eee)',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.88rem' }}>
                      <History size={16} color="#a855f7" /> Local History
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #888)', marginTop: '4px' }}>
                      Historical document versions and immutable content snapshots.
                    </div>
                  </button>
                </div>
              </div>

              {exportType === 'fullBackup' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', backgroundColor: 'var(--bg-primary, #181818)', borderRadius: '6px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={includeHistory}
                      onChange={(e) => setIncludeHistory(e.target.checked)}
                    />
                    Include Local History snapshots in backup
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={includeRecent}
                      onChange={(e) => setIncludeRecent(e.target.checked)}
                    />
                    Include Recent Resources & Workspaces
                  </label>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Optional Package Label
                </label>
                <input
                  type="text"
                  value={exportLabel}
                  onChange={(e) => setExportLabel(e.target.value)}
                  placeholder="e.g. Pre-Update Backup, Laptop Migration"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color, #333)',
                    backgroundColor: 'var(--bg-primary, #181818)',
                    color: 'var(--text-primary, #eee)',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <Button
                  variant="primary"
                  onClick={handleGenerateExport}
                  disabled={isExporting}
                  icon={<Download size={14} />}
                >
                  {isExporting ? 'Generating...' : 'Build Package'}
                </Button>
              </div>

              {exportedPackage && (
                <div
                  style={{
                    padding: '14px',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontWeight: 600, fontSize: '0.9rem' }}>
                      <CheckCircle size={16} /> Package Ready: {exportedPackage.manifest.packageId}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #888)', marginTop: '4px' }}>
                      Domains: {exportedPackage.manifest.domains.join(', ')} • Files: {Object.keys(exportedPackage.files).length} • Size: {(exportedPackage.manifest.integrity.totalBytes / 1024).toFixed(1)} KB
                    </div>
                  </div>
                  <Button variant="primary" onClick={handleDownloadFile} icon={<Download size={14} />}>
                    Download .qmexport
                  </Button>
                </div>
              )}
            </div>
          ) : (
            /* =========================================================================
             * IMPORT & RESTORE TAB
             * ========================================================================= */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {!importPlan ? (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                      Select Package File (.qmexport / .json)
                    </label>
                    <input
                      type="file"
                      accept=".json,.qmexport,.qmebackup"
                      onChange={handleFileUpload}
                      style={{ fontSize: '0.85rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                      Or Paste Package JSON Payload
                    </label>
                    <textarea
                      rows={6}
                      value={importJson}
                      onChange={(e) => setImportJson(e.target.value)}
                      placeholder='Paste {"manifest": {...}, "files": {...}} here...'
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color, #333)',
                        backgroundColor: 'var(--bg-primary, #181818)',
                        color: 'var(--text-primary, #eee)',
                        fontFamily: 'monospace',
                        fontSize: '0.8rem',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                      variant="primary"
                      onClick={handleAnalyzePackage}
                      disabled={isPlanning || !importJson.trim()}
                      icon={<ShieldCheck size={14} />}
                    >
                      {isPlanning ? 'Validating...' : 'Validate & Inspect Package'}
                    </Button>
                  </div>
                </>
              ) : (
                /* Import Plan Inspection */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                        Import Plan for Package: <code>{importPlan.packageId}</code>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #888)' }}>
                        Created: {new Date(importPlan.createdAt).toLocaleString()} • Type: {importPlan.packageType}
                      </div>
                    </div>
                    <Button variant="outline" onClick={() => setImportPlan(null)}>
                      Choose Different Package
                    </Button>
                  </div>

                  {/* Domain Summaries */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    {Object.entries(importPlan.domainPlans).map(([domain, plan]) => (
                      <div
                        key={domain}
                        style={{
                          padding: '10px',
                          backgroundColor: 'var(--bg-primary, #181818)',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color, #333)',
                        }}
                      >
                        <div style={{ textTransform: 'capitalize', fontWeight: 600, fontSize: '0.85rem' }}>
                          {domain}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #888)', marginTop: '4px' }}>
                          {plan?.count} record(s) • {plan?.conflicts} conflict(s)
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Conflict Resolution Strategy */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                      Conflict Resolution Strategy
                    </label>
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="strategy"
                          value="merge"
                          checked={strategy === 'merge'}
                          onChange={() => setStrategy('merge')}
                        />
                        Merge (Recommended)
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="strategy"
                          value="replace"
                          checked={strategy === 'replace'}
                          onChange={() => setStrategy('replace')}
                        />
                        Replace Existing
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="strategy"
                          value="skip"
                          checked={strategy === 'skip'}
                          onChange={() => setStrategy('skip')}
                        />
                        Skip Conflicts
                      </label>
                    </div>
                  </div>

                  {/* Safety Backup Checkbox */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={createSafetyBackup}
                      onChange={(e) => setCreateSafetyBackup(e.target.checked)}
                    />
                    Create safety backup of current application state before applying
                  </label>

                  {/* Actions */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <Button
                      variant="primary"
                      onClick={handleExecuteImport}
                      disabled={isApplying}
                      icon={<RotateCcw size={14} />}
                    >
                      {isApplying ? 'Applying...' : 'Apply Import / Restore'}
                    </Button>
                  </div>

                  {operationResult && (
                    <div
                      style={{
                        padding: '12px',
                        borderRadius: '6px',
                        backgroundColor: operationResult.status === 'completed' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        border: `1px solid ${operationResult.status === 'completed' ? '#10b981' : '#ef4444'}`,
                        fontSize: '0.85rem',
                      }}
                    >
                      <div style={{ fontWeight: 600, color: operationResult.status === 'completed' ? '#10b981' : '#ef4444' }}>
                        {operationResult.status === 'completed' ? 'Import Successful' : 'Import Partially Completed'}
                      </div>
                      <div style={{ marginTop: '4px', fontSize: '0.78rem', color: 'var(--text-secondary, #888)' }}>
                        Imported Domains: {operationResult.importedDomains.join(', ') || 'none'}
                        {operationResult.safetyBackupId && ` • Safety Backup ID: ${operationResult.safetyBackupId}`}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-color, #333)',
            backgroundColor: 'var(--bg-tertiary, #252526)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.75rem',
            color: 'var(--text-muted, #777)',
          }}
        >
          <span>All packages are stored locally. Sensitive credentials are never exported.</span>
          <Button variant="ghost" onClick={closeDialog}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
