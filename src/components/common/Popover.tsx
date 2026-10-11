import React, { useEffect, useRef } from 'react';

export interface PopoverProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  anchorEl?: HTMLElement | null;
  style?: React.CSSProperties;
  'aria-label'?: string;
}

export const Popover: React.FC<PopoverProps> = ({
  isOpen,
  onClose,
  children,
  style,
  'aria-label': ariaLabel,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    const handlePointerDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={popoverRef}
      role="region"
      aria-label={ariaLabel || 'Contextual popup'}
      style={{
        position: 'absolute',
        zIndex: 'var(--z-popover, 50)',
        backgroundColor: 'var(--bg-panel, #1e293b)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-md)',
        padding: '12px',
        color: 'var(--text-primary)',
        ...style,
      }}
      className="qm-popover"
    >
      {children}
    </div>
  );
};
