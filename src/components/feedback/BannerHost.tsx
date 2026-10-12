import React from 'react';
import { useFeedback } from '../../state/FeedbackContext';
import { AlertTriangle, AlertCircle, Info, CheckCircle2, X } from 'lucide-react';
import { FeedbackSeverity } from '../../core/feedback/FeedbackTypes';

const BANNER_ICONS: Record<FeedbackSeverity, React.ReactNode> = {
  success: <CheckCircle2 size={16} color="var(--success, #2ea043)" />,
  info: <Info size={16} color="var(--accent-primary, #58a6ff)" />,
  warning: <AlertTriangle size={16} color="var(--warning, #d29922)" />,
  error: <AlertCircle size={16} color="var(--error, #f85149)" />,
};

const BANNER_BG: Record<FeedbackSeverity, string> = {
  success: 'rgba(46, 160, 67, 0.12)',
  info: 'rgba(56, 139, 253, 0.12)',
  warning: 'rgba(210, 153, 34, 0.15)',
  error: 'rgba(248, 81, 73, 0.15)',
};

export const BannerHost: React.FC = () => {
  const { banners, dismiss } = useFeedback();

  if (banners.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', zIndex: 'var(--z-banner, 3000)' as unknown as number }}>
      {banners.map((banner) => (
        <div
          key={banner.id}
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 16px',
            backgroundColor: BANNER_BG[banner.severity],
            borderBottom: '1px solid var(--border-color)',
            fontSize: '0.8rem',
            color: 'var(--text-primary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
            {BANNER_ICONS[banner.severity]}
            {banner.title && <span style={{ fontWeight: 600 }}>{banner.title}:</span>}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {banner.message}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {banner.actions &&
              banner.actions.map((act) => (
                <button
                  key={act.id}
                  onClick={async () => {
                    await act.run();
                  }}
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '2px 8px',
                    fontSize: '0.75rem',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  {act.label}
                </button>
              ))}

            {banner.dismissible !== false && (
              <button
                onClick={() => dismiss(banner.id)}
                aria-label="Dismiss banner"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
