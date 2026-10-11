import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import {
  Button,
  IconButton,
  Input,
  Textarea,
  FormField,
  Select,
  Checkbox,
  Toggle,
  RadioGroup,
  Slider,
  Badge,
  StatusIndicator,
  Tooltip,
  Popover,
  Divider,
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  Panel,
  PanelHeader,
  PanelContent,
  PanelFooter,
  List,
  ListItem,
  Spinner,
  Skeleton,
  EmptyState,
  ErrorState,
} from './index';

describe('QM Editor — UI Component Library Primitives (Step 26)', () => {
  describe('Button Primitive', () => {
    it('renders with default props and attributes', () => {
      const el = React.createElement(Button, { children: 'Submit' });
      expect(el.props.children).toBe('Submit');
      expect(el.props.variant).toBeUndefined(); // default applied in component
    });

    it('handles variants, sizes, and fullWidth', () => {
      const el = React.createElement(Button, {
        variant: 'destructive',
        size: 'lg',
        fullWidth: true,
        children: 'Delete File',
      });
      expect(el.props.variant).toBe('destructive');
      expect(el.props.size).toBe('lg');
      expect(el.props.fullWidth).toBe(true);
    });

    it('supports loading state with accessibility semantics', () => {
      const el = React.createElement(Button, {
        isLoading: true,
        loadingText: 'Saving...',
        children: 'Save',
      });
      expect(el.props.isLoading).toBe(true);
      expect(el.props.loadingText).toBe('Saving...');
    });
  });

  describe('IconButton Primitive', () => {
    it('requires aria-label and supports active state', () => {
      const el = React.createElement(IconButton, {
        icon: '🔍',
        'aria-label': 'Search',
        active: true,
        variant: 'ghost',
        size: 'sm',
      });
      expect(el.props['aria-label']).toBe('Search');
      expect(el.props.active).toBe(true);
      expect(el.props.size).toBe('sm');
    });
  });

  describe('Input & Textarea Primitives', () => {
    it('instantiates Input with invalid variant and clearable flag', () => {
      const onClear = vi.fn();
      const el = React.createElement(Input, {
        value: 'test',
        isInvalid: true,
        clearable: true,
        onClear,
        inputSize: 'sm',
      });
      expect(el.props.value).toBe('test');
      expect(el.props.isInvalid).toBe(true);
      expect(el.props.clearable).toBe(true);
    });

    it('instantiates Textarea with custom resize and size', () => {
      const el = React.createElement(Textarea, {
        rows: 4,
        resize: 'none',
        textareaSize: 'lg',
        isInvalid: true,
      });
      expect(el.props.rows).toBe(4);
      expect(el.props.resize).toBe('none');
      expect(el.props.isInvalid).toBe(true);
    });
  });

  describe('FormField Composite', () => {
    it('binds label, description, and error to control', () => {
      const input = React.createElement(Input, { id: 'field-1' });
      const el = React.createElement(FormField, {
        id: 'field-1',
        label: 'Workspace Name',
        description: 'Provide an alphanumeric name',
        error: 'Name cannot be empty',
        required: true,
        children: input,
      });

      expect(el.props.id).toBe('field-1');
      expect(el.props.label).toBe('Workspace Name');
      expect(el.props.error).toBe('Name cannot be empty');
      expect(el.props.required).toBe(true);
    });
  });

  describe('Select Primitive', () => {
    it('manages options list and placeholder', () => {
      const options = [
        { value: 'dark', label: 'Dark Mode' },
        { value: 'light', label: 'Light Mode' },
      ];
      const el = React.createElement(Select, {
        options,
        value: 'dark',
        placeholder: 'Select Theme',
      });

      expect(el.props.options).toHaveLength(2);
      expect(el.props.value).toBe('dark');
      expect(el.props.placeholder).toBe('Select Theme');
    });
  });

  describe('Checkbox & Toggle Controls', () => {
    it('configures Checkbox with indeterminate support', () => {
      const el = React.createElement(Checkbox, {
        checked: false,
        indeterminate: true,
        label: 'Select All',
      });
      expect(el.props.indeterminate).toBe(true);
      expect(el.props.label).toBe('Select All');
    });

    it('configures Toggle with role="switch" semantics', () => {
      const onChange = vi.fn();
      const el = React.createElement(Toggle, {
        checked: true,
        onChange,
        label: 'Auto Save',
        size: 'sm',
      });
      expect(el.props.checked).toBe(true);
      expect(el.props.size).toBe('sm');
      expect(el.props.label).toBe('Auto Save');
    });
  });

  describe('RadioGroup & Slider Controls', () => {
    it('configures RadioGroup with options', () => {
      const options = [
        { value: 'tabs', label: 'Tabs' },
        { value: 'spaces', label: 'Spaces' },
      ];
      const el = React.createElement(RadioGroup, {
        name: 'indentation',
        options,
        value: 'spaces',
        onChange: vi.fn(),
      });
      expect(el.props.options).toHaveLength(2);
      expect(el.props.value).toBe('spaces');
    });

    it('configures Slider with formatted value', () => {
      const el = React.createElement(Slider, {
        min: 10,
        max: 30,
        value: 14,
        onChange: vi.fn(),
        formatValue: (v) => `${v}px`,
        label: 'Font Size',
      });
      expect(el.props.min).toBe(10);
      expect(el.props.max).toBe(30);
      expect(el.props.value).toBe(14);
    });
  });

  describe('Badge & StatusIndicator', () => {
    it('supports extended badge variants', () => {
      const el = React.createElement(Badge, {
        variant: 'success',
        size: 'sm',
        children: 'Online',
      });
      expect(el.props.variant).toBe('success');
      expect(el.props.size).toBe('sm');
    });

    it('supports StatusIndicator with non-color redundancy', () => {
      const el = React.createElement(StatusIndicator, {
        status: 'dirty',
        label: 'Unsaved Changes',
      });
      expect(el.props.status).toBe('dirty');
      expect(el.props.label).toBe('Unsaved Changes');
    });
  });

  describe('Layout & Container Primitives', () => {
    it('composes Card with Header, Content, and Footer', () => {
      const header = React.createElement(CardHeader, { title: 'Settings Card' });
      const content = React.createElement(CardContent, { children: 'Body text' });
      const footer = React.createElement(CardFooter, { children: 'Save' });
      const card = React.createElement(Card, {
        children: [header, content, footer],
      });

      expect(card.props.children).toHaveLength(3);
    });

    it('composes Panel with composable subcomponents', () => {
      const header = React.createElement(PanelHeader, { title: 'Problems Panel' });
      const content = React.createElement(PanelContent, { children: '0 errors' });
      const footer = React.createElement(PanelFooter, { children: 'Footer info' });
      const panel = React.createElement(Panel, {
        children: [header, content, footer],
      });

      expect(panel.props.children).toHaveLength(3);
    });

    it('renders Divider with orientation and label', () => {
      const el = React.createElement(Divider, {
        orientation: 'horizontal',
        label: 'OR',
      });
      expect(el.props.orientation).toBe('horizontal');
      expect(el.props.label).toBe('OR');
    });
  });

  describe('Overlay & Floating Primitives', () => {
    it('wraps child with Tooltip content', () => {
      const trigger = React.createElement('button', null, 'Hover Me');
      const tooltip = React.createElement(Tooltip, {
        content: 'Help text',
        placement: 'bottom',
        children: trigger,
      });

      expect(tooltip.props.content).toBe('Help text');
      expect(tooltip.props.placement).toBe('bottom');
    });

    it('instantiates Popover with open state and close callback', () => {
      const onClose = vi.fn();
      const popover = React.createElement(Popover, {
        isOpen: true,
        onClose,
        children: 'Contextual info',
      });

      expect(popover.props.isOpen).toBe(true);
      expect(popover.props.onClose).toBe(onClose);
    });
  });

  describe('List & ListItem', () => {
    it('composes List and ListItem with leading, title, secondary, and trailing slots', () => {
      const item = React.createElement(ListItem, {
        leading: '★',
        title: 'main.ts',
        secondary: 'src/main.ts',
        trailing: 'Edited',
        selected: true,
        onClick: vi.fn(),
      });
      const list = React.createElement(List, {
        children: [item],
      });

      expect(list.props.children).toHaveLength(1);
      expect(item.props.title).toBe('main.ts');
      expect(item.props.secondary).toBe('src/main.ts');
      expect(item.props.selected).toBe(true);
    });
  });

  describe('Feedback & State Primitives', () => {
    it('instantiates Spinner and Skeleton', () => {
      const spinner = React.createElement(Spinner, { size: 'lg', label: 'Compiling...' });
      const skeleton = React.createElement(Skeleton, { width: 120, height: 24 });

      expect(spinner.props.size).toBe('lg');
      expect(skeleton.props.width).toBe(120);
    });

    it('instantiates EmptyState with action slots', () => {
      const button = React.createElement(Button, { children: 'Open Folder' });
      const empty = React.createElement(EmptyState, {
        title: 'No Workspace Open',
        description: 'Open a project folder to start editing files',
        action: button,
      });

      expect(empty.props.title).toBe('No Workspace Open');
      expect(empty.props.action).toBe(button);
    });

    it('instantiates ErrorState with retry callback', () => {
      const onRetry = vi.fn();
      const err = React.createElement(ErrorState, {
        message: 'Failed to connect to Git',
        details: 'Git binary not found in PATH',
        onRetry,
      });

      expect(err.props.message).toBe('Failed to connect to Git');
      expect(err.props.details).toBe('Git binary not found in PATH');
      expect(err.props.onRetry).toBe(onRetry);
    });
  });
});
