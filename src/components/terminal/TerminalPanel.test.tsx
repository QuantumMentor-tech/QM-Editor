import React from 'react';
import { describe, it, expect } from 'vitest';
import { TerminalPanel } from './TerminalPanel';

describe('TerminalPanel', () => {
  it('instantiates TerminalPanel element without throwing', () => {
    const element = React.createElement(TerminalPanel);
    expect(element.type).toBe(TerminalPanel);
  });
});
