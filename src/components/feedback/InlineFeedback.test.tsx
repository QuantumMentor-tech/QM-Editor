import React from 'react';
import { describe, it, expect } from 'vitest';
import { InlineFeedback } from './InlineFeedback';

describe('InlineFeedback Component', () => {
  it('instantiates InlineFeedback with error message safely', () => {
    const element = React.createElement(InlineFeedback, {
      severity: 'error',
      message: 'Port must be between 1 and 65535',
    });

    expect(element.type).toBe(InlineFeedback);
    expect(element.props.message).toBe('Port must be between 1 and 65535');
    expect(element.props.severity).toBe('error');
  });

  it('instantiates InlineFeedback with warning message and compact mode', () => {
    const element = React.createElement(InlineFeedback, {
      severity: 'warning',
      message: 'High font size may cause line wrapping',
      compact: true,
    });

    expect(element.props.severity).toBe('warning');
    expect(element.props.compact).toBe(true);
  });
});
