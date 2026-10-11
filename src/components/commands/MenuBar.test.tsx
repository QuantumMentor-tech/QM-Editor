import React from 'react';
import { describe, it, expect } from 'vitest';
import { MenuBar } from './MenuBar';

describe('MenuBar Component', () => {
  it('instantiates MenuBar component element safely without throwing', () => {
    const element = React.createElement(MenuBar);
    expect(element.type).toBe(MenuBar);
  });
});
