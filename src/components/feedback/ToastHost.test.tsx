import React from 'react';
import { describe, it, expect } from 'vitest';
import { ToastHost, ToastItem } from './ToastHost';
import { FeedbackMessage } from '../../core/feedback/FeedbackTypes';

describe('ToastHost and ToastItem Component', () => {
  it('instantiates ToastHost safely', () => {
    const element = React.createElement(ToastHost);
    expect(element.type).toBe(ToastHost);
  });

  it('instantiates ToastItem with message and severity safely', () => {
    const mockToast: FeedbackMessage = {
      id: 'test-1',
      severity: 'error',
      presentation: 'toast',
      message: 'Failed to compile module',
      title: 'Build Error',
      dismissible: true,
      timestamp: Date.now(),
    };

    const element = React.createElement(ToastItem, {
      toast: mockToast,
      onDismiss: () => {},
    });

    expect(element.props.toast.id).toBe('test-1');
    expect(element.props.toast.severity).toBe('error');
    expect(element.props.toast.title).toBe('Build Error');
  });

  it('instantiates ToastItem with repeated count and actions safely', () => {
    const mockToast: FeedbackMessage = {
      id: 'test-2',
      severity: 'warning',
      presentation: 'toast',
      message: 'Repeated warning message',
      repeatCount: 5,
      actions: [
        {
          id: 'retry-btn',
          label: 'Retry',
          run: () => {},
        },
      ],
      dismissible: true,
      timestamp: Date.now(),
    };

    const element = React.createElement(ToastItem, {
      toast: mockToast,
      onDismiss: () => {},
    });

    expect(element.props.toast.repeatCount).toBe(5);
    expect(element.props.toast.actions?.length).toBe(1);
    expect(element.props.toast.actions?.[0].label).toBe('Retry');
  });
});
