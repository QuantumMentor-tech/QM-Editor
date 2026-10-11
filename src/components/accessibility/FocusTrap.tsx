import React, { useEffect, useRef } from 'react';
import { useAccessibility } from '../../state/AccessibilityContext';
import { FocusScope } from '../../core/accessibility/AccessibilityTypes';

export interface FocusTrapProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  active?: boolean;
  scope?: FocusScope;
  onEscape?: () => void;
  className?: string;
  style?: React.CSSProperties;
  role?: string;
  'aria-modal'?: boolean | 'true' | 'false';
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

export const FocusTrap: React.FC<FocusTrapProps> = ({
  children,
  active = true,
  scope = 'dialog',
  onEscape,
  className,
  style,
  role,
  'aria-modal': ariaModal,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  ...rest
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { focusManager, pushScope } = useAccessibility();

  useEffect(() => {
    if (!active || !containerRef.current) return undefined;

    const unpush = pushScope(scope);
    const untrap = focusManager.trapFocus(containerRef.current, {
      onEscape,
      autoFocus: true,
    });

    return () => {
      untrap();
      unpush();
    };
  }, [active, scope, onEscape, focusManager, pushScope]);

  return (
    <div
      ref={containerRef}
      className={className}
      role={role}
      aria-modal={ariaModal}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledby}
      style={style}
      {...rest}
    >
      {children}
    </div>
  );
};
