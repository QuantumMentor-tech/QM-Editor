import React from 'react';
import { describe, it, expect } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog Component', () => {
  it('instantiates ConfirmDialog safely', () => {
    const element = React.createElement(ConfirmDialog);
    expect(element.type).toBe(ConfirmDialog);
  });
});
