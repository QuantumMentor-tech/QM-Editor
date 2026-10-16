/**
 * QM Editor LSP Server Registry & Executable Trust Unit Tests
 * Phase 06, Step 56 — Language Server Protocol Foundation, Server Lifecycle & Client Architecture
 */

import { describe, it, expect } from 'vitest';
import { LspServerRegistry } from './LspServerRegistry';
import { LspTrustError } from './LspErrors';

describe('LspServerRegistry', () => {
  it('has built-in approved language servers registered', () => {
    const registry = LspServerRegistry.getInstance();
    const tsServer = registry.getServer('typescript-lsp');
    expect(tsServer).toBeDefined();
    expect(tsServer?.displayName).toContain('TypeScript');
    expect(tsServer?.command).toBe('typescript-language-server');

    const pyServer = registry.getServer('pyright-lsp');
    expect(pyServer).toBeDefined();
    expect(pyServer?.command).toBe('pyright-langserver');
  });

  it('resolves server definition by language ID or file extension', () => {
    const registry = LspServerRegistry.getInstance();

    const byLang = registry.findServerForLanguage('typescript');
    expect(byLang?.serverDefinitionId).toBe('typescript-lsp');

    const byExt = registry.findServerForLanguage('unknown-lang', '.py');
    expect(byExt?.serverDefinitionId).toBe('pyright-lsp');
  });

  it('validates and accepts trusted executable commands', () => {
    const registry = LspServerRegistry.getInstance();
    const result = registry.validateExecutable('typescript-language-server', ['--stdio']);
    expect(result.valid).toBe(true);
    expect(result.trustLevel).toBe('trusted');
  });

  it('rejects commands containing shell injection characters', () => {
    const registry = LspServerRegistry.getInstance();

    const bad1 = registry.validateExecutable('pyright-langserver; rm -rf /');
    expect(bad1.valid).toBe(false);
    expect(bad1.error).toContain('prohibited shell metacharacters');

    const bad2 = registry.validateExecutable('vtsls & calc.exe');
    expect(bad2.valid).toBe(false);

    const bad3 = registry.validateExecutable('gopls `whoami`');
    expect(bad3.valid).toBe(false);
  });

  it('rejects arguments containing shell injection characters', () => {
    const registry = LspServerRegistry.getInstance();

    const badArg = registry.validateExecutable('typescript-language-server', ['--stdio', '$(evil_cmd)']);
    expect(badArg.valid).toBe(false);
    expect(badArg.error).toContain('prohibited shell metacharacters');
  });

  it('throws LspTrustError when registering dangerous server command', () => {
    const registry = LspServerRegistry.getInstance();

    expect(() => {
      registry.registerServer({
        serverDefinitionId: 'malicious-server',
        displayName: 'Malicious Server',
        languageIds: ['evil'],
        fileExtensions: ['evil'],
        command: 'sh -c "evil code"',
        transportType: 'stdio',
      });
    }).toThrow(LspTrustError);
  });

  it('allows registering and unregistering safe custom server definitions', () => {
    const registry = LspServerRegistry.getInstance();

    const unreg = registry.registerServer({
      serverDefinitionId: 'custom-lua-lsp',
      displayName: 'Lua Language Server',
      languageIds: ['lua'],
      fileExtensions: ['lua'],
      command: 'lua-language-server',
      args: ['--stdio'],
      transportType: 'stdio',
      enabled: true,
    });

    expect(registry.getServer('custom-lua-lsp')).toBeDefined();
    expect(registry.findServerForLanguage('lua')?.serverDefinitionId).toBe('custom-lua-lsp');

    unreg();
    expect(registry.getServer('custom-lua-lsp')).toBeUndefined();
  });
});
