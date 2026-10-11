import React from 'react';
import { useCommand } from '../../state/CommandContext';
import { Button } from '../common/Button';
import { FolderOpen, Plus, FileText } from 'lucide-react';

export const WelcomePrimaryActions: React.FC = () => {
  const { executeCommand } = useCommand();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        width: '100%',
        boxSizing: 'border-box',
      }}
      className="qm-welcome-primary-actions"
    >
      <h2
        style={{
          margin: 0,
          fontSize: '0.85rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.8px',
          color: 'var(--text-muted)',
        }}
      >
        Start New Workflow
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '10px',
          width: '100%',
        }}
      >
        <Button
          variant="primary"
          size="md"
          icon={<FolderOpen size={16} />}
          onClick={() => executeCommand('workspace.open')}
          style={{ justifyContent: 'flex-start', padding: '10px 14px' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
            <span style={{ fontWeight: 600, fontSize: '0.86rem' }}>Open Folder...</span>
            <span style={{ fontSize: '0.72rem', opacity: 0.85 }}>Open local project directory</span>
          </div>
        </Button>

        <Button
          variant="secondary"
          size="md"
          icon={<Plus size={16} />}
          onClick={() => executeCommand('file.new')}
          style={{ justifyContent: 'flex-start', padding: '10px 14px' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
            <span style={{ fontWeight: 600, fontSize: '0.86rem' }}>New File</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Create an empty document</span>
          </div>
        </Button>

        <Button
          variant="secondary"
          size="md"
          icon={<FileText size={16} />}
          onClick={() => executeCommand('file.open')}
          style={{ justifyContent: 'flex-start', padding: '10px 14px' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
            <span style={{ fontWeight: 600, fontSize: '0.86rem' }}>Open File...</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Open individual file from disk</span>
          </div>
        </Button>
      </div>
    </div>
  );
};
