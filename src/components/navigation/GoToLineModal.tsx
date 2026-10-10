import React, { useState } from 'react';
import { useShellState } from '../../state/ShellContext';
import { Button } from '../common/Button';
import { Navigation, ArrowRight } from 'lucide-react';

export interface GoToLineModalProps {
  currentLine: number;
  maxLines: number;
  onGoToLine: (line: number, column?: number) => void;
}

export const GoToLineModal: React.FC<GoToLineModalProps> = ({ currentLine, maxLines, onGoToLine }) => {
  const { closeDialog } = useShellState();
  const [inputValue, setInputValue] = useState<string>(String(currentLine));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmed = inputValue.trim();
    if (!trimmed) {
      setErrorMsg('Please enter a line number.');
      return;
    }

    const parts = trimmed.split(':');
    const lineNum = Number(parts[0]);
    const colNum = parts.length > 1 ? Number(parts[1]) : 1;

    if (isNaN(lineNum) || lineNum < 1) {
      setErrorMsg('Line number must be a positive integer.');
      return;
    }

    if (parts.length > 1 && (isNaN(colNum) || colNum < 1)) {
      setErrorMsg('Column number must be a positive integer.');
      return;
    }

    const clampedLine = Math.min(lineNum, Math.max(1, maxLines));
    onGoToLine(clampedLine, colNum);
    closeDialog();
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '360px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600 }}>
        <Navigation size={18} /> Go to Line / Column
      </div>

      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
        Type line number or <code style={{ backgroundColor: 'var(--bg-header)', padding: '2px 4px', borderRadius: '4px' }}>Line:Column</code> (Current total: {maxLines} lines)
      </div>

      <input
        type="text"
        autoFocus
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          setErrorMsg(null);
        }}
        placeholder="e.g. 42 or 42:10"
        style={{
          padding: '8px 12px',
          borderRadius: 'var(--radius-sm)',
          border: errorMsg ? '1px solid #ef4444' : '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-editor)',
          color: 'var(--text-primary)',
          fontSize: '0.95rem',
          fontFamily: 'var(--font-code)',
          outline: 'none',
        }}
      />

      {errorMsg && (
        <div style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 500 }}>
          {errorMsg}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
        <Button variant="secondary" onClick={closeDialog} type="button">
          Cancel
        </Button>
        <Button variant="primary" type="submit" icon={<ArrowRight size={16} />}>
          Go to Line
        </Button>
      </div>
    </form>
  );
};
