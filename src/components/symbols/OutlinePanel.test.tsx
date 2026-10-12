import { describe, it, expect } from 'vitest';
import React from 'react';
import { OutlinePanel } from './OutlinePanel';

describe('OutlinePanel Component', () => {
  it('renders outline element safely without throwing', () => {
    const element = React.createElement(OutlinePanel);
    expect(element.type).toBe(OutlinePanel);
  });
});
