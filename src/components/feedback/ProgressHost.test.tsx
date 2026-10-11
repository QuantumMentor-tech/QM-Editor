import React from 'react';
import { describe, it, expect } from 'vitest';
import { ProgressHost, ProgressItem } from './ProgressHost';
import { ProgressTaskState } from '../../core/feedback/FeedbackTypes';

describe('ProgressHost and ProgressItem Component', () => {
  it('instantiates ProgressHost safely', () => {
    const element = React.createElement(ProgressHost);
    expect(element.type).toBe(ProgressHost);
  });

  it('instantiates ProgressItem with determinate progress state', () => {
    const task: ProgressTaskState = {
      id: 'task-prog-1',
      title: 'Replacing 100 occurrences',
      mode: 'determinate',
      status: 'running',
      current: 40,
      total: 100,
      cancellable: true,
      timestamp: Date.now(),
    };

    const element = React.createElement(ProgressItem, {
      task,
      onCancel: () => {},
    });

    expect(element.props.task.id).toBe('task-prog-1');
    expect(element.props.task.mode).toBe('determinate');
    expect(element.props.task.current).toBe(40);
  });

  it('instantiates ProgressItem with indeterminate progress state', () => {
    const task: ProgressTaskState = {
      id: 'task-prog-2',
      title: 'Connecting to daemon',
      mode: 'indeterminate',
      status: 'running',
      cancellable: false,
      timestamp: Date.now(),
    };

    const element = React.createElement(ProgressItem, {
      task,
      onCancel: () => {},
    });

    expect(element.props.task.id).toBe('task-prog-2');
    expect(element.props.task.mode).toBe('indeterminate');
  });
});
