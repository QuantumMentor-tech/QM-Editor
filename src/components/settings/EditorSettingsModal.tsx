import React from 'react';
import { useShellState } from '../../state/ShellContext';
import { Button } from '../common/Button';
import { DEFAULT_EDITOR_SETTINGS } from '../../services/PreferencesService';
import { Type, WrapText, AlignLeft, Hash, Layers, Eye, Code, RotateCcw } from 'lucide-react';

export const EditorSettingsModal: React.FC = () => {
  const { state, updateEditorSettings, closeDialog } = useShellState();
  const settings = state.editorSettings;

  const handleReset = () => {
    updateEditorSettings(DEFAULT_EDITOR_SETTINGS);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: '420px', padding: '4px' }}>
      {/* 1. Typography & Font Size */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Type size={16} /> Typography & Density
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'center' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Font Size (px)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Button
              variant="secondary"
              onClick={() => updateEditorSettings({ fontSize: Math.max(8, settings.fontSize - 1) })}
              aria-label="Decrease Font Size"
            >
              -
            </Button>
            <span style={{ minWidth: '32px', textAlign: 'center', fontWeight: 600 }}>{settings.fontSize}px</span>
            <Button
              variant="secondary"
              onClick={() => updateEditorSettings({ fontSize: Math.min(32, settings.fontSize + 1) })}
              aria-label="Increase Font Size"
            >
              +
            </Button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Font Family</label>
          <input
            type="text"
            value={settings.fontFamily}
            onChange={(e) => updateEditorSettings({ fontFamily: e.target.value })}
            style={{
              padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-editor)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-code)',
              fontSize: '0.85rem',
            }}
          />
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: 0 }} />

      {/* 2. Display & Line Presentation */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <WrapText size={16} /> Display & Line Behavior
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Word Wrap</label>
          <select
            value={settings.wordWrap}
            onChange={(e) => updateEditorSettings({ wordWrap: e.target.value as 'off' | 'on' })}
            style={{
              padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-editor)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
            }}
          >
            <option value="on">On (Wrap Long Lines)</option>
            <option value="off">Off (Horizontal Scroll)</option>
          </select>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Hash size={14} /> Line Numbers Gutter
          </label>
          <input
            type="checkbox"
            checked={settings.lineNumbers}
            onChange={(e) => updateEditorSettings({ lineNumbers: e.target.checked })}
            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Eye size={14} /> Highlight Active Line
          </label>
          <input
            type="checkbox"
            checked={settings.highlightActiveLine}
            onChange={(e) => updateEditorSettings({ highlightActiveLine: e.target.checked })}
            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={14} /> Code Folding Gutter
          </label>
          <input
            type="checkbox"
            checked={settings.folding}
            onChange={(e) => updateEditorSettings({ folding: e.target.checked })}
            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
          />
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: 0 }} />

      {/* 3. Indentation & Smart Typing */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Code size={16} /> Indentation & Smart Editing
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlignLeft size={14} /> Tab Size
          </label>
          <select
            value={settings.tabSize}
            onChange={(e) => updateEditorSettings({ tabSize: Number(e.target.value) })}
            style={{
              padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-editor)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
            }}
          >
            <option value={2}>2 Spaces</option>
            <option value={4}>4 Spaces</option>
            <option value={8}>8 Spaces</option>
          </select>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Insert Spaces Instead of Tabs</label>
          <input
            type="checkbox"
            checked={settings.insertSpaces}
            onChange={(e) => updateEditorSettings({ insertSpaces: e.target.checked })}
            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Bracket Matching Highlight</label>
          <input
            type="checkbox"
            checked={settings.bracketMatching}
            onChange={(e) => updateEditorSettings({ bracketMatching: e.target.checked })}
            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Auto-Closing Brackets & Quotes</label>
          <input
            type="checkbox"
            checked={settings.autoClosingBrackets}
            onChange={(e) => updateEditorSettings({ autoClosingBrackets: e.target.checked })}
            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Whitespace Visualization</label>
          <select
            value={settings.whitespace}
            onChange={(e) => updateEditorSettings({ whitespace: e.target.value as 'none' | 'all' | 'trailing' })}
            style={{
              padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-editor)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
            }}
          >
            <option value="none">None (Hidden)</option>
            <option value="all">All Whitespace</option>
            <option value="trailing">Trailing Only</option>
          </select>
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: 0 }} />

      {/* Footer Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button variant="secondary" onClick={handleReset} icon={<RotateCcw size={14} />}>
          Reset to Defaults
        </Button>
        <Button variant="primary" onClick={closeDialog}>
          Done
        </Button>
      </div>
    </div>
  );
};
