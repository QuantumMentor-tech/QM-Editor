/**
 * QM Editor - LSP Code Lens Security Validator
 * Phase 06, Step 66 — LSP Code Lens, Inline Actions & Safe Command Integration
 * 
 * Strict security boundary validating untrusted language server command metadata,
 * preventing arbitrary shell execution, argument injection, path traversal, and XSS.
 */

import { Logger } from '../../../utils/logger';
import { globalCommandRegistry, CommandRegistry } from '../../commands/CommandRegistry';
import { LspRange, LspCommand } from '../LspTypes';
import { CanonicalCodeLensCommand } from './LspCodeLensTypes';

export interface CommandValidationResult {
  readonly isValid: boolean;
  readonly sanitizedCommand?: CanonicalCodeLensCommand;
  readonly reason?: string;
}

export class LspCodeLensSecurityValidator {
  /** Maximum length allowed for a Code Lens title */
  public static readonly MAX_TITLE_LENGTH = 200;

  /** Maximum arguments count */
  public static readonly MAX_ARGUMENT_COUNT = 20;

  /** Maximum serialized JSON size for arguments (50KB) */
  public static readonly MAX_ARGUMENTS_SIZE = 50 * 1024;

  /**
   * Built-in allowlist of safe LSP / editor commands permitted for Code Lens activation.
   */
  public static readonly SAFE_COMMAND_ALLOWLIST: readonly string[] = [
    'editor.showReferences',
    'editor.action.showReferences',
    'editor.action.goToImplementation',
    'editor.action.peekImplementation',
    'editor.action.goToDeclaration',
    'editor.action.goToTypeDefinition',
    'workbench.action.gotoSymbol',
    'workbench.action.showAllSymbols',
    'tasks.runTest',
    'tasks.run',
  ];

  /**
   * Prohibited command substrings indicating potential shell, process, or script injection.
   */
  private static readonly DANGEROUS_COMMAND_PATTERNS: readonly RegExp[] = [
    /shell/i,
    /terminal/i,
    /exec/i,
    /spawn/i,
    /eval/i,
    /javascript:/i,
    /vbscript:/i,
    /data:/i,
    /powershell/i,
    /cmd(\.exe)?/i,
    /bash/i,
    /\bsh\b/i,
    /rm\s+-/i,
    /unlink/i,
  ];

  /**
   * Validates a raw LSP command payload against the security boundary.
   */
  public static validateCommand(
    rawCommand: unknown,
    commandRegistry: CommandRegistry = globalCommandRegistry
  ): CommandValidationResult {
    if (!rawCommand || typeof rawCommand !== 'object') {
      return { isValid: false, reason: 'Command payload is not an object' };
    }

    const cmd = rawCommand as Partial<LspCommand>;

    // 1. Title validation
    if (typeof cmd.title !== 'string') {
      return { isValid: false, reason: 'Command title must be a string' };
    }

    const sanitizedTitle = this.sanitizeText(cmd.title, this.MAX_TITLE_LENGTH);
    if (!sanitizedTitle || sanitizedTitle.trim().length === 0) {
      return { isValid: false, reason: 'Command title cannot be empty or whitespace only' };
    }

    // 2. Command ID validation
    if (typeof cmd.command !== 'string' || cmd.command.trim().length === 0) {
      return { isValid: false, reason: 'Command identifier must be a non-empty string' };
    }

    const commandId = cmd.command.trim();

    // Check for dangerous injection patterns in command ID
    for (const pattern of this.DANGEROUS_COMMAND_PATTERNS) {
      if (pattern.test(commandId)) {
        Logger.warn('LspCodeLensSecurityValidator: Command ID matched dangerous pattern', {
          commandId,
          pattern: pattern.toString(),
        });
        return { isValid: false, reason: `Command identifier matched prohibited pattern: ${pattern}` };
      }
    }

    // 3. Allowlist or registered command check
    const isAllowlisted = this.SAFE_COMMAND_ALLOWLIST.includes(commandId);
    const isRegistered = Boolean(commandRegistry.get(commandId));

    if (!isAllowlisted && !isRegistered) {
      Logger.warn('LspCodeLensSecurityValidator: Command ID not in allowlist or registry', { commandId });
      return {
        isValid: false,
        reason: `Command "${commandId}" is not permitted (not allowlisted or registered in CommandRegistry)`,
      };
    }

    // 4. Arguments validation
    const argsValidation = this.validateArguments(cmd.arguments);
    if (!argsValidation.isValid) {
      return { isValid: false, reason: argsValidation.reason };
    }

    return {
      isValid: true,
      sanitizedCommand: {
        title: sanitizedTitle,
        command: commandId,
        arguments: argsValidation.sanitizedArgs,
        source: 'lsp',
        isTrusted: true,
      },
    };
  }

  /**
   * Validates command argument array to prevent memory exhaustion, path traversal, or injection.
   */
  public static validateArguments(args: unknown): { isValid: boolean; sanitizedArgs?: unknown[]; reason?: string } {
    if (args === undefined || args === null) {
      return { isValid: true, sanitizedArgs: undefined };
    }

    if (!Array.isArray(args)) {
      return { isValid: false, reason: 'Command arguments must be an array' };
    }

    if (args.length > this.MAX_ARGUMENT_COUNT) {
      return {
        isValid: false,
        reason: `Command argument count ${args.length} exceeds maximum limit of ${this.MAX_ARGUMENT_COUNT}`,
      };
    }

    try {
      const serialized = JSON.stringify(args);
      if (serialized.length > this.MAX_ARGUMENTS_SIZE) {
        return {
          isValid: false,
          reason: `Command argument payload size (${serialized.length} bytes) exceeds maximum limit of ${this.MAX_ARGUMENTS_SIZE} bytes`,
        };
      }

      // Check for path traversal sequences in string arguments
      const traversalRegex = /(^|[\\/])\.\.([\\/]|$)/;
      for (const arg of args) {
        if (typeof arg === 'string' && traversalRegex.test(arg)) {
          return { isValid: false, reason: 'Command argument contained path traversal sequence (..)' };
        }
      }

      return { isValid: true, sanitizedArgs: JSON.parse(serialized) };
    } catch {
      return { isValid: false, reason: 'Command arguments could not be serialized safely' };
    }
  }

  /**
   * Validates document range coordinates.
   */
  public static validateRange(
    range: unknown,
    docLines?: readonly string[]
  ): range is LspRange {
    if (!range || typeof range !== 'object') {
      return false;
    }

    const r = range as Partial<LspRange>;
    if (!r.start || !r.end || typeof r.start !== 'object' || typeof r.end !== 'object') {
      return false;
    }

    const { line: sLine, character: sChar } = r.start;
    const { line: eLine, character: eChar } = r.end;

    if (
      typeof sLine !== 'number' ||
      typeof sChar !== 'number' ||
      typeof eLine !== 'number' ||
      typeof eChar !== 'number' ||
      !Number.isInteger(sLine) ||
      !Number.isInteger(sChar) ||
      !Number.isInteger(eLine) ||
      !Number.isInteger(eChar) ||
      sLine < 0 ||
      sChar < 0 ||
      eLine < 0 ||
      eChar < 0
    ) {
      return false;
    }

    if (sLine > eLine || (sLine === eLine && sChar > eChar)) {
      return false;
    }

    if (docLines) {
      if (sLine >= docLines.length || eLine >= docLines.length) {
        return false;
      }
    }

    return true;
  }

  /**
   * Strips dangerous script tags, iframes, and control characters from text.
   */
  public static sanitizeText(text: string, maxLength: number): string {
    if (!text) return '';

    // Remove null bytes and dangerous control characters except newlines/tabs
    let clean = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');

    // Strip script and iframe tags
    clean = clean.replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '');
    clean = clean.replace(/<\s*iframe[^>]*>[\s\S]*?<\s*\/\s*iframe\s*>/gi, '');
    clean = clean.replace(/<\s*object[^>]*>[\s\S]*?<\s*\/\s*object\s*>/gi, '');

    if (clean.length > maxLength) {
      clean = clean.slice(0, maxLength);
    }

    return clean;
  }
}
