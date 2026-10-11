import React from 'react';

export interface VisuallyHiddenProps {
  children: React.ReactNode;
  as?: React.ElementType;
  id?: string;
}

export const VisuallyHidden: React.FC<VisuallyHiddenProps> = ({
  children,
  as: Component = 'span',
  id,
}) => {
  return (
    <Component
      id={id}
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
    >
      {children}
    </Component>
  );
};
