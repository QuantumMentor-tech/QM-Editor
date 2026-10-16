/**
 * QM Editor Canonical LSP Server Registry & Executable Trust Validator
 * Phase 06, Step 56 — Language Server Protocol Foundation, Server Lifecycle & Client Architecture
 *
 * Maintains approved language server definitions, verifies executable trust boundaries,
 * prevents command injection, and routes language requests to matching server configurations.
 */

import {
  LspServerDefinition,
  ExecutableValidationResult,
  ExecutableTrustLevel,
} from './LspTypes';
import { LspTrustError } from './LspErrors';
import { logger } from '../../utils/logger';

export class LspServerRegistry {
  private static instance: LspServerRegistry | null = null;
  private readonly definitions = new Map<string, LspServerDefinition>();
  private readonly trustedCommands = new Set<string>([
    'typescript-language-server',
    'vtsls',
    'pyright',
    'pyright-langserver',
    'rust-analyzer',
    'clangd',
    'gopls',
    'vscode-html-language-server',
    'vscode-css-language-server',
    'vscode-json-language-server',
    'marksman',
  ]);

  private constructor() {
    this.registerBuiltInDefinitions();
  }

  public static getInstance(): LspServerRegistry {
    if (!LspServerRegistry.instance) {
      LspServerRegistry.instance = new LspServerRegistry();
    }
    return LspServerRegistry.instance;
  }

  /**
   * Registers a server definition into the registry after validating executable safety.
   */
  public registerServer(definition: LspServerDefinition): () => void {
    if (!definition.serverDefinitionId || typeof definition.serverDefinitionId !== 'string') {
      throw new Error('LspServerRegistry: Server definition must have a valid serverDefinitionId.');
    }

    if (this.definitions.has(definition.serverDefinitionId)) {
      throw new Error(
        `LspServerRegistry: Duplicate server definition ID "${definition.serverDefinitionId}".`
      );
    }

    const validation = this.validateExecutable(definition.command, definition.args ? [...definition.args] : []);
    if (!validation.valid) {
      throw new LspTrustError(definition.command, validation.error || 'Executable validation failed');
    }

    this.definitions.set(definition.serverDefinitionId, definition);
    logger.info(`LspServerRegistry: Registered server definition "${definition.serverDefinitionId}"`);

    return () => {
      this.definitions.delete(definition.serverDefinitionId);
    };
  }

  /**
   * Unregisters a server definition.
   */
  public unregisterServer(serverDefinitionId: string): void {
    if (this.definitions.has(serverDefinitionId)) {
      this.definitions.delete(serverDefinitionId);
      logger.info(`LspServerRegistry: Unregistered server definition "${serverDefinitionId}"`);
    }
  }

  /**
   * Finds the active server definition for a given language ID and optional file extension.
   */
  public findServerForLanguage(
    languageId: string,
    fileExtension?: string
  ): LspServerDefinition | undefined {
    const normalizedLang = languageId.toLowerCase();
    const normalizedExt = fileExtension ? fileExtension.replace(/^\./, '').toLowerCase() : undefined;

    for (const def of this.definitions.values()) {
      if (def.enabled === false) continue;

      if (def.languageIds.some((l) => l.toLowerCase() === normalizedLang)) {
        return def;
      }

      if (normalizedExt && def.fileExtensions.some((e) => e.toLowerCase() === normalizedExt)) {
        return def;
      }
    }

    return undefined;
  }

  /**
   * Gets a server definition by its unique identifier.
   */
  public getServer(serverDefinitionId: string): LspServerDefinition | undefined {
    return this.definitions.get(serverDefinitionId);
  }

  /**
   * Returns all registered server definitions.
   */
  public getAllServers(): LspServerDefinition[] {
    return Array.from(this.definitions.values());
  }

  /**
   * Validates command safety, ensuring no shell metacharacters or dangerous injection attempts exist.
   */
  public validateExecutable(command: string, args: string[] = []): ExecutableValidationResult {
    if (!command || typeof command !== 'string' || command.trim() === '') {
      return {
        valid: false,
        trustLevel: 'blocked',
        sanitizedCommand: '',
        sanitizedArgs: [],
        error: 'Command cannot be empty.',
      };
    }

    const trimmedCommand = command.trim();

    // Check for dangerous shell injection metacharacters or quotes in command
    const shellMetacharacters = /[;&|`$<>\r\n"']/;
    if (shellMetacharacters.test(trimmedCommand)) {
      return {
        valid: false,
        trustLevel: 'blocked',
        sanitizedCommand: '',
        sanitizedArgs: [],
        error: 'Command contains prohibited shell metacharacters or quotes (;&|`$<>\r\n"\').',
      };
    }

    // Check if command contains whitespace (command line string instead of discrete executable)
    if (/\s/.test(trimmedCommand)) {
      return {
        valid: false,
        trustLevel: 'blocked',
        sanitizedCommand: '',
        sanitizedArgs: [],
        error: 'Command cannot contain spaces; arguments must be specified structurally in the args array.',
      };
    }

    for (const arg of args) {
      if (shellMetacharacters.test(arg)) {
        return {
          valid: false,
          trustLevel: 'blocked',
          sanitizedCommand: '',
          sanitizedArgs: [],
          error: `Argument "${arg}" contains prohibited shell metacharacters.`,
        };
      }
    }

    // Check if command is in approved trusted set
    const baseCommand = trimmedCommand.split(/[/\\]/).pop()?.replace(/\.(exe|cmd|bat)$/i, '') || '';
    let trustLevel: ExecutableTrustLevel = 'allowed';

    if (this.trustedCommands.has(baseCommand.toLowerCase())) {
      trustLevel = 'trusted';
    }

    return {
      valid: true,
      trustLevel,
      sanitizedCommand: trimmedCommand,
      sanitizedArgs: [...args],
    };
  }

  // ---------------------------------------------------------------------------
  // Built-in Language Server Definitions
  // ---------------------------------------------------------------------------

  private registerBuiltInDefinitions(): void {
    // 1. TypeScript / JavaScript
    this.definitions.set('typescript-lsp', {
      serverDefinitionId: 'typescript-lsp',
      displayName: 'TypeScript / JavaScript Language Server',
      languageIds: ['typescript', 'javascript', 'typescriptreact', 'javascriptreact'],
      fileExtensions: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'],
      command: 'typescript-language-server',
      args: ['--stdio'],
      transportType: 'stdio',
      workspaceMode: 'singleRoot',
      enabled: true,
    });

    // 2. Python (Pyright)
    this.definitions.set('pyright-lsp', {
      serverDefinitionId: 'pyright-lsp',
      displayName: 'Python Language Server (Pyright)',
      languageIds: ['python'],
      fileExtensions: ['py', 'pyi', 'pyw'],
      command: 'pyright-langserver',
      args: ['--stdio'],
      transportType: 'stdio',
      workspaceMode: 'singleRoot',
      enabled: true,
    });

    // 3. JSON
    this.definitions.set('json-lsp', {
      serverDefinitionId: 'json-lsp',
      displayName: 'JSON Language Server',
      languageIds: ['json', 'jsonc'],
      fileExtensions: ['json', 'jsonc'],
      command: 'vscode-json-language-server',
      args: ['--stdio'],
      transportType: 'stdio',
      workspaceMode: 'singleRoot',
      enabled: true,
    });

    // 4. HTML
    this.definitions.set('html-lsp', {
      serverDefinitionId: 'html-lsp',
      displayName: 'HTML Language Server',
      languageIds: ['html'],
      fileExtensions: ['html', 'htm'],
      command: 'vscode-html-language-server',
      args: ['--stdio'],
      transportType: 'stdio',
      workspaceMode: 'singleRoot',
      enabled: true,
    });

    // 5. CSS
    this.definitions.set('css-lsp', {
      serverDefinitionId: 'css-lsp',
      displayName: 'CSS Language Server',
      languageIds: ['css', 'scss', 'less'],
      fileExtensions: ['css', 'scss', 'less'],
      command: 'vscode-css-language-server',
      args: ['--stdio'],
      transportType: 'stdio',
      workspaceMode: 'singleRoot',
      enabled: true,
    });

    // 6. Markdown
    this.definitions.set('markdown-lsp', {
      serverDefinitionId: 'markdown-lsp',
      displayName: 'Markdown Language Server (Marksman)',
      languageIds: ['markdown'],
      fileExtensions: ['md', 'markdown'],
      command: 'marksman',
      args: ['server'],
      transportType: 'stdio',
      workspaceMode: 'singleRoot',
      enabled: true,
    });
  }
}

export const globalLspServerRegistry = LspServerRegistry.getInstance();
