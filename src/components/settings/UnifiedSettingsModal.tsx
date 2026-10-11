/**
 * QM Editor Unified Settings & Configuration Modal
 * Phase 03, Step 21 — Unified Settings, Preferences & Configuration System
 */

import React, { useState, useMemo } from 'react';
import { useSettings } from '../../state/SettingsContext';
import { useShellState } from '../../state/ShellContext';
import {
  SettingCategory,
  SettingDefinition,
} from '../../core/settings/SettingTypes';
import {
  Search,
  X,
  RotateCcw,
  Download,
  Upload,
  Palette,
  Code,
  Terminal,
  GitBranch,
  Play,
  FileText,
  Eye,
  Sliders,
} from 'lucide-react';
import { InlineFeedback } from '../feedback/InlineFeedback';
import { Button, Input, Select, Toggle, Textarea } from '../common';

const CATEGORIES: { id: SettingCategory | 'All'; label: string; icon: React.FC<{ size: number }> }[] = [
  { id: 'All', label: 'All Settings', icon: Sliders },
  { id: 'Appearance', label: 'Appearance', icon: Palette },
  { id: 'Editor', label: 'Editor', icon: Code },
  { id: 'Terminal', label: 'Terminal', icon: Terminal },
  { id: 'Source Control', label: 'Source Control', icon: GitBranch },
  { id: 'Tasks', label: 'Tasks', icon: Play },
  { id: 'Files', label: 'Files', icon: FileText },
  { id: 'Search', label: 'Search', icon: Search },
  { id: 'Accessibility', label: 'Accessibility', icon: Eye },
];

export const UnifiedSettingsModal: React.FC = () => {
  const {
    activeScope,
    setActiveScope,
    getSetting,
    setSetting,
    resetSetting,
    resetCategory,
    hasOverride,
    searchSettings,
    exportSettingsJson,
    importSettingsJson,
  } = useSettings();

  const { closeDialog } = useShellState();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SettingCategory | 'All'>('All');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [errorFeedback, setErrorFeedback] = useState<Record<string, string>>({});

  const displayedSettings = useMemo(() => {
    let list: SettingDefinition[] = [];
    if (searchQuery.trim()) {
      list = searchSettings(searchQuery);
    } else if (selectedCategory === 'All') {
      list = searchSettings('');
    } else {
      list = searchSettings('').filter((s) => s.category === selectedCategory);
    }
    return list;
  }, [searchQuery, selectedCategory, searchSettings]);

  const handleValueChange = (def: SettingDefinition, newValue: any) => {
    const res = setSetting(def.key, newValue, activeScope);
    if (!res.success) {
      setErrorFeedback((prev) => ({ ...prev, [def.key]: res.error || 'Invalid value.' }));
    } else {
      setErrorFeedback((prev) => {
        const next = { ...prev };
        delete next[def.key];
        return next;
      });
    }
  };

  const handleExport = () => {
    const json = exportSettingsJson(true);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qm-editor-settings-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSubmit = () => {
    if (!importText.trim()) return;
    const res = importSettingsJson(importText);
    if (res.success) {
      setImportStatus(`Successfully imported ${res.importedCount} settings.`);
      setTimeout(() => {
        setImportModalOpen(false);
        setImportStatus(null);
        setImportText('');
      }, 1200);
    } else {
      setImportStatus(`Import failed: ${res.errors.join(', ')}`);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '740px',
        maxWidth: '90vw',
        height: '560px',
        maxHeight: '80vh',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        fontSize: '0.85rem',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      {/* Top Search & Scope Bar */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        {/* Search Input */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            padding: '4px 10px',
          }}
        >
          <Search size={14} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search all settings (e.g., font size, theme, tab size)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: '0.82rem',
              outline: 'none',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Scope Switcher */}
        <div style={{ display: 'flex', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
          <button
            onClick={() => setActiveScope('user')}
            style={{
              padding: '4px 10px',
              fontSize: '0.75rem',
              border: 'none',
              backgroundColor: activeScope === 'user' ? 'var(--accent-primary)' : 'var(--bg-primary)',
              color: activeScope === 'user' ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer',
              fontWeight: activeScope === 'user' ? 600 : 400,
            }}
          >
            User
          </button>
          <button
            onClick={() => setActiveScope('workspace')}
            style={{
              padding: '4px 10px',
              fontSize: '0.75rem',
              border: 'none',
              backgroundColor: activeScope === 'workspace' ? 'var(--accent-primary)' : 'var(--bg-primary)',
              color: activeScope === 'workspace' ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer',
              fontWeight: activeScope === 'workspace' ? 600 : 400,
            }}
          >
            Workspace
          </button>
        </div>
      </div>

      {/* Main Split Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Category Sidebar */}
        <div
          style={{
            width: '180px',
            borderRight: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-secondary)',
            overflowY: 'auto',
            padding: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setSearchQuery('');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 10px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: isSelected ? 'var(--bg-hover)' : 'transparent',
                  color: isSelected ? 'var(--text-accent)' : 'var(--text-primary)',
                  fontWeight: isSelected ? 600 : 400,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <Icon size={14} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Settings List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px' }}>
          {displayedSettings.length > 0 ? (
            displayedSettings.map((def) => {
              const currentValue = getSetting(def.key);
              const isOverridden = hasOverride(def.key, activeScope);
              const error = errorFeedback[def.key];

              return (
                <div
                  key={def.key}
                  style={{
                    padding: '12px 0',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  {/* Title & Key Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{def.title}</span>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontFamily: 'var(--font-code)',
                          color: 'var(--text-muted)',
                          padding: '1px 5px',
                          borderRadius: '3px',
                          backgroundColor: 'var(--bg-secondary)',
                        }}
                      >
                        {def.key}
                      </span>
                      {isOverridden && (
                        <span
                          style={{
                            fontSize: '0.65rem',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            backgroundColor: 'rgba(56, 139, 253, 0.15)',
                            color: '#58a6ff',
                            fontWeight: 600,
                          }}
                        >
                          Modified ({activeScope})
                        </span>
                      )}
                    </div>

                    {isOverridden && (
                      <button
                        onClick={() => resetSetting(def.key, activeScope)}
                        title="Reset to default value"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.72rem',
                          color: 'var(--text-muted)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <RotateCcw size={11} />
                        <span>Reset</span>
                      </button>
                    )}
                  </div>

                  {/* Description */}
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {def.description}
                  </div>

                  {/* Setting Control */}
                  <div style={{ marginTop: '4px' }}>
                    {renderSettingControl(def, currentValue, (val) => handleValueChange(def, val))}
                  </div>

                  {/* Inline Error Message */}
                  {error && <InlineFeedback severity="error" message={error} compact />}
                </div>
              );
            })
          ) : (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No settings found matching "{searchQuery}".
            </div>
          )}
        </div>
      </div>

      {/* Bottom Actions Bar */}
      <div
        style={{
          padding: '8px 16px',
          borderTop: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {selectedCategory !== 'All' && (
            <button
              onClick={() => resetCategory(selectedCategory as SettingCategory, activeScope)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                borderRadius: '3px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={12} />
              <span>Reset {selectedCategory}</span>
            </button>
          )}

          <Button
            variant="secondary"
            size="sm"
            icon={<Download size={12} />}
            onClick={handleExport}
            title="Export configuration to JSON file"
          >
            Export
          </Button>

          <Button
            variant="secondary"
            size="sm"
            icon={<Upload size={12} />}
            onClick={() => setImportModalOpen(true)}
            title="Import configuration from JSON"
          >
            Import
          </Button>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={closeDialog}
        >
          Done
        </Button>
      </div>

      {/* Import Modal Overlay */}
      {importModalOpen && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div
            style={{
              width: '460px',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Import Settings JSON</div>
            <Textarea
              placeholder="Paste settings JSON here..."
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={8}
              style={{
                fontFamily: 'var(--font-code)',
              }}
            />

            {importStatus && (
              <div style={{ fontSize: '0.75rem', color: importStatus.includes('failed') ? '#f85149' : '#3fb950' }}>
                {importStatus}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setImportModalOpen(false);
                  setImportStatus(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleImportSubmit}
              >
                Apply Import
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function renderSettingControl(
  def: SettingDefinition,
  value: any,
  onChange: (val: any) => void
): React.ReactNode {
  switch (def.type) {
    case 'boolean':
      return (
        <Toggle
          checked={Boolean(value)}
          onChange={onChange}
          label={value ? 'Enabled' : 'Disabled'}
          size="sm"
        />
      );

    case 'number':
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => onChange(Math.max(def.min ?? -Infinity, (value || 0) - (def.step ?? 1)))}
            style={{
              padding: '2px 8px',
              borderRadius: '3px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '0.8rem',
            }}
          >
            -
          </button>
          <input
            type="number"
            value={value ?? ''}
            min={def.min}
            max={def.max}
            step={def.step ?? 1}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            style={{
              width: '70px',
              padding: '3px 6px',
              borderRadius: '3px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '0.78rem',
              textAlign: 'center',
            }}
          />
          <button
            onClick={() => onChange(Math.min(def.max ?? Infinity, (value || 0) + (def.step ?? 1)))}
            style={{
              padding: '2px 8px',
              borderRadius: '3px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '0.8rem',
            }}
          >
            +
          </button>
          {def.min !== undefined && def.max !== undefined && (
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              ({def.min} - {def.max})
            </span>
          )}
        </div>
      );

    case 'enum':
      return (
        <Select
          options={def.options || []}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          selectSize="sm"
          style={{ minWidth: '160px' }}
        />
      );

    case 'string':
      return (
        <Input
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          inputSize="sm"
          style={{
            maxWidth: '380px',
            fontFamily: def.key.includes('font') ? 'var(--font-code)' : 'inherit',
          }}
        />
      );

    default:
      return null;
  }
}

