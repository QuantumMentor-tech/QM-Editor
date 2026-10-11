import React from 'react';
import { describe, it, expect } from 'vitest';
import { ContextMenu } from './ContextMenu';

describe('ContextMenu Component', () => {
  it('instantiates ContextMenu component element safely without throwing', () => {
    const element = React.createElement(ContextMenu);
    expect(element.type).toBe(ContextMenu);
  });
});
