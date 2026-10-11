import React from 'react';
import { describe, it, expect } from 'vitest';
import { VisuallyHidden } from './VisuallyHidden';
import { LiveRegion } from './LiveRegion';
import { FocusTrap } from './FocusTrap';

describe('Accessibility Components Foundation', () => {
  it('instantiates VisuallyHidden component with proper defaults', () => {
    const element = React.createElement(VisuallyHidden, { id: 'sr-test', children: 'Screen Reader Only' });
    expect(element.props.id).toBe('sr-test');
    expect(element.props.children).toBe('Screen Reader Only');
  });

  it('instantiates LiveRegion component with ARIA defaults', () => {
    const element = React.createElement(LiveRegion, {});
    expect(element.type).toBe(LiveRegion);
  });

  it('instantiates FocusTrap component with modal role and scope', () => {
    const element = React.createElement(FocusTrap, {
      role: 'dialog',
      'aria-modal': 'true',
      scope: 'dialog',
      children: React.createElement('button', {}, 'Close'),
    });
    expect(element.props.role).toBe('dialog');
    expect(element.props['aria-modal']).toBe('true');
    expect(element.props.scope).toBe('dialog');
  });
});
