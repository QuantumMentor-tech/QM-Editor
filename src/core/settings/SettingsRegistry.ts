/**
 * QM Editor Unified Settings Registry
 * Phase 03, Step 21 — Unified Settings, Preferences & Configuration System
 */

import { SettingCategory, SettingDefinition } from './SettingTypes';

export class SettingsRegistry {
  private static instance: SettingsRegistry;
  private definitions: Map<string, SettingDefinition> = new Map();

  private constructor() {
    this.registerBuiltIns();
  }

  public static getInstance(): SettingsRegistry {
    if (!SettingsRegistry.instance) {
      SettingsRegistry.instance = new SettingsRegistry();
    }
    return SettingsRegistry.instance;
  }

  public register<T>(definition: SettingDefinition<T>): void {
    if (!definition.key || typeof definition.key !== 'string' || definition.key.trim() === '') {
      throw new Error('Setting definition key is required.');
    }

    if (this.definitions.has(definition.key)) {
      throw new Error(`Duplicate setting key registration: "${definition.key}".`);
    }

    this.definitions.set(definition.key, definition);
  }

  public get(key: string): SettingDefinition | undefined {
    return this.definitions.get(key);
  }

  public getAll(): SettingDefinition[] {
    return Array.from(this.definitions.values());
  }

  public getByCategory(category: SettingCategory): SettingDefinition[] {
    return this.getAll().filter((s) => s.category === category);
  }

  public isSensitive(key: string): boolean {
    const def = this.get(key);
    if (def?.sensitive === true) return true;
    const lower = key.toLowerCase();
    return (
      lower.includes('secret') ||
      lower.includes('token') ||
      lower.includes('password') ||
      lower.includes('apikey') ||
      lower.includes('api_key') ||
      lower.includes('credential')
    );
  }

  public search(query: string): SettingDefinition[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.getAll();

    const scored: { setting: SettingDefinition; score: number }[] = [];

    for (const s of this.definitions.values()) {
      const key = s.key.toLowerCase();
      const title = s.title.toLowerCase();
      const desc = s.description.toLowerCase();
      const cat = s.category.toLowerCase();

      let score = 0;
      if (key === q) {
        score = 100;
      } else if (title === q) {
        score = 90;
      } else if (title.startsWith(q)) {
        score = 80;
      } else if (title.includes(q)) {
        score = 70;
      } else if (key.includes(q)) {
        score = 60;
      } else if (desc.includes(q)) {
        score = 40;
      } else if (cat.includes(q)) {
        score = 20;
      }

      if (score > 0) {
        scored.push({ setting: s, score });
      }
    }

    return scored.sort((a, b) => b.score - a.score).map((item) => item.setting);
  }

  private registerBuiltIns(): void {
    // -------------------------------------------------------------
    // 1. APPEARANCE
    // -------------------------------------------------------------
    this.register({
      key: 'appearance.theme',
      title: 'Color Theme',
      description: 'Specifies the active visual theme applied across all windows and panels.',
      category: 'Appearance',
      type: 'enum',
      defaultValue: 'dark',
      scope: 'user',
      options: [
        { label: 'Dark Mode (Default)', value: 'dark' },
        { label: 'Light Mode', value: 'light' },
      ],
      validate: (v) => ({ valid: v === 'dark' || v === 'light', error: 'Theme must be "dark" or "light"' }),
    });

    this.register({
      key: 'appearance.sidebarWidth',
      title: 'Sidebar Width',
      description: 'Default width of the primary sidebar in pixels.',
      category: 'Appearance',
      type: 'number',
      defaultValue: 260,
      scope: 'user',
      min: 160,
      max: 500,
      step: 10,
      validate: (v) => ({ valid: typeof v === 'number' && v >= 160 && v <= 500, error: 'Width must be between 160 and 500' }),
    });

    this.register({
      key: 'appearance.activePanelView',
      title: 'Default Bottom Panel',
      description: 'Controls which view is displayed when opening the secondary bottom panel.',
      category: 'Appearance',
      type: 'enum',
      defaultValue: 'output',
      scope: 'user',
      options: [
        { label: 'Terminal', value: 'terminal' },
        { label: 'Tasks', value: 'tasks' },
        { label: 'Problems', value: 'problems' },
        { label: 'Console / Output', value: 'output' },
      ],
    });

    this.register({
      key: 'appearance.uiDensity',
      title: 'User Interface Density',
      description: 'Controls spacing, padding, and height density across tabs, toolbars, and panels.',
      category: 'Appearance',
      type: 'enum',
      defaultValue: 'comfortable',
      scope: 'user',
      options: [
        { label: 'Comfortable (Default)', value: 'comfortable' },
        { label: 'Compact', value: 'compact' },
      ],
      validate: (v) => ({ valid: v === 'comfortable' || v === 'compact', error: 'Density must be "comfortable" or "compact"' }),
    });

    this.register({
      key: 'appearance.panelHeight',
      title: 'Bottom Panel Height',
      description: 'Default height of the secondary console panel in pixels.',
      category: 'Appearance',
      type: 'number',
      defaultValue: 240,
      scope: 'user',
      min: 120,
      max: 600,
      step: 20,
      validate: (v) => ({ valid: typeof v === 'number' && v >= 120 && v <= 600, error: 'Height must be between 120 and 600' }),
    });

    // -------------------------------------------------------------
    // 2. EDITOR
    // -------------------------------------------------------------
    this.register({
      key: 'editor.fontSize',
      title: 'Font Size',
      description: 'Controls the font size of the code editor in pixels.',
      category: 'Editor',
      type: 'number',
      defaultValue: 14,
      scope: 'user',
      min: 8,
      max: 32,
      step: 1,
      validate: (v) => ({ valid: typeof v === 'number' && v >= 8 && v <= 32, error: 'Font size must be between 8 and 32' }),
    });

    this.register({
      key: 'editor.fontFamily',
      title: 'Font Family',
      description: 'Controls the font family stack used in the code editor.',
      category: 'Editor',
      type: 'string',
      defaultValue: "'Fira Code', 'Cascadia Code', Consolas, monospace",
      scope: 'user',
      validate: (v) => ({ valid: typeof v === 'string' && v.trim().length > 0, error: 'Font family cannot be empty' }),
    });

    this.register({
      key: 'editor.tabSize',
      title: 'Tab Size',
      description: 'The number of spaces equal to a single tab indentation.',
      category: 'Editor',
      type: 'number',
      defaultValue: 2,
      scope: 'user',
      min: 1,
      max: 8,
      step: 1,
      validate: (v) => ({ valid: typeof v === 'number' && v >= 1 && v <= 8, error: 'Tab size must be between 1 and 8' }),
    });

    this.register({
      key: 'editor.insertSpaces',
      title: 'Insert Spaces',
      description: 'Insert spaces when pressing Tab instead of tab characters.',
      category: 'Editor',
      type: 'boolean',
      defaultValue: true,
      scope: 'user',
    });

    this.register({
      key: 'editor.wordWrap',
      title: 'Word Wrap',
      description: 'Controls how lines should wrap in the editor surface.',
      category: 'Editor',
      type: 'enum',
      defaultValue: 'on',
      scope: 'user',
      options: [
        { label: 'On (Wrap lines to viewport)', value: 'on' },
        { label: 'Off (Do not wrap lines)', value: 'off' },
      ],
    });

    this.register({
      key: 'editor.lineNumbers',
      title: 'Line Numbers',
      description: 'Controls the display of line numbers in the editor margin.',
      category: 'Editor',
      type: 'boolean',
      defaultValue: true,
      scope: 'user',
    });

    this.register({
      key: 'editor.bracketMatching',
      title: 'Bracket Matching',
      description: 'Highlights matching brackets and parentheses when the cursor is next to them.',
      category: 'Editor',
      type: 'boolean',
      defaultValue: true,
      scope: 'user',
    });

    this.register({
      key: 'editor.autoClosingBrackets',
      title: 'Auto Closing Brackets',
      description: 'Automatically close brackets and quotes as they are typed.',
      category: 'Editor',
      type: 'boolean',
      defaultValue: true,
      scope: 'user',
    });

    this.register({
      key: 'editor.highlightActiveLine',
      title: 'Highlight Active Line',
      description: 'Controls whether the current active cursor line is highlighted.',
      category: 'Editor',
      type: 'boolean',
      defaultValue: true,
      scope: 'user',
    });

    this.register({
      key: 'editor.whitespace',
      title: 'Render Whitespace',
      description: 'Controls how whitespace characters are rendered in the editor.',
      category: 'Editor',
      type: 'enum',
      defaultValue: 'none',
      scope: 'user',
      options: [
        { label: 'None', value: 'none' },
        { label: 'Trailing', value: 'trailing' },
        { label: 'All', value: 'all' },
      ],
    });

    this.register({
      key: 'editor.folding',
      title: 'Code Folding',
      description: 'Controls whether code folding indicators are enabled in the gutter.',
      category: 'Editor',
      type: 'boolean',
      defaultValue: true,
      scope: 'user',
    });

    this.register({
      key: 'editor.minimap',
      title: 'Minimap Preview',
      description: 'Controls whether a code overview minimap is shown on the editor side.',
      category: 'Editor',
      type: 'boolean',
      defaultValue: false,
      scope: 'user',
    });

    this.register({
      key: 'editor.suggest.enabled',
      title: 'Enable Suggestions',
      description: 'Controls whether automatic and on-demand code completion suggestions are enabled.',
      category: 'Editor',
      type: 'boolean',
      defaultValue: true,
      scope: 'user',
    });

    this.register({
      key: 'editor.suggest.triggerCharacters',
      title: 'Accept Trigger Characters',
      description: 'Controls whether typing trigger characters automatically invokes completion.',
      category: 'Editor',
      type: 'boolean',
      defaultValue: true,
      scope: 'user',
    });

    this.register({
      key: 'editor.suggest.wordBasedSuggestions',
      title: 'Word Based Suggestions',
      description: 'Controls whether buffer words are provided as fallback completion suggestions.',
      category: 'Editor',
      type: 'boolean',
      defaultValue: true,
      scope: 'user',
    });

    this.register({
      key: 'editor.suggest.showDetails',
      title: 'Show Suggestion Details',
      description: 'Controls whether documentation and signatures are displayed in the suggestion widget.',
      category: 'Editor',
      type: 'boolean',
      defaultValue: true,
      scope: 'user',
    });

    this.register({
      key: 'editor.hover.enabled',
      title: 'Enable Editor Hover',
      description: 'Controls whether hovering over code symbols displays contextual documentation and types.',
      category: 'Editor',
      type: 'boolean',
      defaultValue: true,
      scope: 'user',
    });

    this.register({
      key: 'editor.hover.delay',
      title: 'Hover Delay',
      description: 'Controls the delay in milliseconds before hover documentation is requested.',
      category: 'Editor',
      type: 'number',
      defaultValue: 300,
      scope: 'user',
      min: 100,
      max: 2000,
    });

    this.register({
      key: 'editor.parameterHints.enabled',
      title: 'Enable Parameter Hints',
      description: 'Controls whether parameter hints and signature help are shown while typing function calls.',
      category: 'Editor',
      type: 'boolean',
      defaultValue: true,
      scope: 'user',
    });

    this.register({
      key: 'editor.parameterHints.cycle',
      title: 'Cycle Parameter Hints',
      description: 'Controls whether parameter hints cycle through overloads when reaching the end.',
      category: 'Editor',
      type: 'boolean',
      defaultValue: true,
      scope: 'user',
    });

    this.register({
      key: 'editor.codeActions.enabled',
      title: 'Enable Code Actions & Quick Fixes',
      description: 'Controls whether quick fixes and code actions are available in the editor.',
      category: 'Editor',
      type: 'boolean',
      defaultValue: true,
      scope: 'user',
    });

    this.register({
      key: 'editor.codeActions.confirmMultiFile',
      title: 'Confirm Multi-File Code Actions',
      description: 'Controls whether a preview modal is displayed before applying code actions affecting multiple files.',
      category: 'Editor',
      type: 'boolean',
      defaultValue: true,
      scope: 'user',
    });

    // -------------------------------------------------------------
    // 3. TERMINAL
    // -------------------------------------------------------------
    this.register({
      key: 'terminal.fontSize',
      title: 'Terminal Font Size',
      description: 'Controls the font size in the integrated terminal in pixels.',
      category: 'Terminal',
      type: 'number',
      defaultValue: 13,
      scope: 'user',
      min: 9,
      max: 24,
      step: 1,
      validate: (v) => ({ valid: typeof v === 'number' && v >= 9 && v <= 24, error: 'Font size must be between 9 and 24' }),
    });

    this.register({
      key: 'terminal.scrollback',
      title: 'Terminal Scrollback Lines',
      description: 'The maximum number of output lines retained in terminal memory.',
      category: 'Terminal',
      type: 'number',
      defaultValue: 5000,
      scope: 'user',
      min: 500,
      max: 20000,
      step: 500,
      validate: (v) => ({ valid: typeof v === 'number' && v >= 500 && v <= 20000, error: 'Scrollback must be between 500 and 20000' }),
    });

    this.register({
      key: 'terminal.cursorStyle',
      title: 'Terminal Cursor Style',
      description: 'Controls the visual style of the terminal cursor.',
      category: 'Terminal',
      type: 'enum',
      defaultValue: 'block',
      scope: 'user',
      options: [
        { label: 'Block', value: 'block' },
        { label: 'Line', value: 'line' },
        { label: 'Underline', value: 'underline' },
      ],
    });

    this.register({
      key: 'terminal.cursorBlink',
      title: 'Terminal Cursor Blink',
      description: 'Controls whether the terminal cursor blinks.',
      category: 'Terminal',
      type: 'boolean',
      defaultValue: true,
      scope: 'user',
    });

    // -------------------------------------------------------------
    // 4. SOURCE CONTROL
    // -------------------------------------------------------------
    this.register({
      key: 'sourceControl.showDecorations',
      title: 'Show Git Badges & Decorations',
      description: 'Displays status badges (M, U, A, D) on files in the File Explorer tree.',
      category: 'Source Control',
      type: 'boolean',
      defaultValue: true,
      scope: 'user',
    });

    this.register({
      key: 'sourceControl.autoRefresh',
      title: 'Auto Refresh Status',
      description: 'Periodically polls repository status to detect external changes.',
      category: 'Source Control',
      type: 'boolean',
      defaultValue: true,
      scope: 'user',
    });

    // -------------------------------------------------------------
    // 5. TASKS
    // -------------------------------------------------------------
    this.register({
      key: 'tasks.showConsoleOnRun',
      title: 'Focus Console on Task Run',
      description: 'Automatically opens and focuses the Tasks panel when executing a task.',
      category: 'Tasks',
      type: 'boolean',
      defaultValue: true,
      scope: 'user',
    });

    this.register({
      key: 'tasks.maxOutputLines',
      title: 'Task Output Buffer Limit',
      description: 'Maximum lines of build/test process output retained in the task log.',
      category: 'Tasks',
      type: 'number',
      defaultValue: 5000,
      scope: 'user',
      min: 1000,
      max: 20000,
      step: 1000,
    });

    // -------------------------------------------------------------
    // 6. FILES & WORKSPACE
    // -------------------------------------------------------------
    this.register({
      key: 'files.autoSave',
      title: 'Auto Save Mode',
      description: 'Controls how open dirty documents are automatically saved.',
      category: 'Files',
      type: 'enum',
      defaultValue: 'off',
      scope: 'user',
      options: [
        { label: 'Off', value: 'off' },
        { label: 'After Delay', value: 'afterDelay' },
      ],
    });

    this.register({
      key: 'files.trimTrailingWhitespace',
      title: 'Trim Trailing Whitespace',
      description: 'Automatically trim trailing whitespace on line endings upon saving.',
      category: 'Files',
      type: 'boolean',
      defaultValue: false,
      scope: 'user',
    });

    // -------------------------------------------------------------
    // 7. SEARCH
    // -------------------------------------------------------------
    this.register({
      key: 'search.maxResults',
      title: 'Max Search Results Limit',
      description: 'Maximum number of file search matches returned per query.',
      category: 'Search',
      type: 'number',
      defaultValue: 1000,
      scope: 'user',
      min: 100,
      max: 10000,
      step: 100,
    });

    // -------------------------------------------------------------
    // 8. ACCESSIBILITY
    // -------------------------------------------------------------
    this.register({
      key: 'accessibility.reduceMotion',
      title: 'Reduce UI Animations',
      description: 'Minimizes motion and transitions for smoother and accessible rendering.',
      category: 'Accessibility',
      type: 'boolean',
      defaultValue: false,
      scope: 'user',
    });

    this.register({
      key: 'accessibility.screenReaderOptimized',
      title: 'Screen Reader Optimizations',
      description: 'Provides expanded aria labels and textual descriptions across controls.',
      category: 'Accessibility',
      type: 'boolean',
      defaultValue: false,
      scope: 'user',
    });
  }
}

export const settingsRegistry = SettingsRegistry.getInstance();
