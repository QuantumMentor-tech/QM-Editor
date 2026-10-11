import React, { useState, useRef, useEffect } from 'react';

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  placement?: TooltipPlacement;
  delayMs?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  placement = 'top',
  delayMs = 300,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<any>(null);
  const tooltipId = useRef(`tooltip-${Math.random().toString(36).slice(2, 9)}`);

  const show = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delayMs);
  };

  const hide = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const getPlacementStyles = (): React.CSSProperties => {
    switch (placement) {
      case 'bottom':
        return {
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginTop: '6px',
        };
      case 'left':
        return {
          top: '50%',
          right: '100%',
          transform: 'translateY(-50%)',
          marginRight: '6px',
        };
      case 'right':
        return {
          top: '50%',
          left: '100%',
          transform: 'translateY(-50%)',
          marginLeft: '6px',
        };
      case 'top':
      default:
        return {
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: '6px',
        };
    }
  };

  if (!content) return children;

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      className="qm-tooltip-anchor"
    >
      {React.cloneElement(children as React.ReactElement<any>, {
        'aria-describedby': isVisible ? tooltipId.current : undefined,
      })}

      {isVisible && (
        <div
          id={tooltipId.current}
          role="tooltip"
          style={{
            position: 'absolute',
            zIndex: 'var(--z-tooltip, 4000)',
            backgroundColor: 'var(--bg-panel, #1e293b)',
            color: 'var(--text-primary, #f8fafc)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            padding: '4px 8px',
            fontSize: '0.74rem',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            boxShadow: 'var(--shadow-md)',
            lineHeight: 1.2,
            ...getPlacementStyles(),
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
};
