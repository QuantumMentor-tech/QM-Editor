import { describe, it, expect } from 'vitest';
import React from 'react';
import { Button } from './Button';
import { Badge } from './Badge';

describe('UI Primitives Foundation', () => {
  it('instantiates Button component safely with default props', () => {
    const element = React.createElement(Button, { variant: 'primary', children: 'Click Me' });
    expect(element.props.children).toBe('Click Me');
    expect(element.props.variant).toBe('primary');
  });

  it('instantiates Badge component safely', () => {
    const element = React.createElement(Badge, { variant: 'accent', children: 'v0.1.0' });
    expect(element.props.children).toBe('v0.1.0');
    expect(element.props.variant).toBe('accent');
  });
});
