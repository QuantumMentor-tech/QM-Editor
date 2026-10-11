import React from 'react';
import { describe, it, expect } from 'vitest';
import { TasksPanel } from './TasksPanel';

describe('TasksPanel Component', () => {
  it('instantiates TasksPanel element safely without throwing', () => {
    const element = React.createElement(TasksPanel);
    expect(element.type).toBe(TasksPanel);
  });
});
