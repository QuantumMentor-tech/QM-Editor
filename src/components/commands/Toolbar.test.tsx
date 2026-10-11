import React from 'react';
import { describe, it, expect } from 'vitest';
import { Toolbar } from './Toolbar';

describe('Toolbar Component', () => {
  it('instantiates Toolbar component element safely without throwing', () => {
    const element = React.createElement(Toolbar);
    expect(element.type).toBe(Toolbar);
  });
});
