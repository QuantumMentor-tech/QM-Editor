/**
 * QM Editor - LSP Code Lens Resolver
 * Phase 06, Step 66 — LSP Code Lens, Inline Actions & Safe Command Integration
 * 
 * Resolves lazy Code Lens command metadata via `codeLens/resolve` with capability checks,
 * cancellation, security validation, and stale protection.
 */

import { Logger } from '../../../utils/logger';
import { LspServerManager, globalLspServerManager } from '../LspServerManager';
import { CancellationToken } from '../../symbols/SymbolTypes';
import { LspCodeLens } from '../LspTypes';
import { CanonicalCodeLens } from './LspCodeLensTypes';
import { LspCodeLensSecurityValidator } from './LspCodeLensSecurityValidator';
import { globalCommandRegistry, CommandRegistry } from '../../commands/CommandRegistry';

export class LspCodeLensResolver {
  constructor(
    private readonly serverManager: LspServerManager = globalLspServerManager,
    private readonly commandRegistry: CommandRegistry = globalCommandRegistry
  ) {}

  /**
   * Resolves a canonical code lens, fetching its command metadata from the server if unresolved.
   */
  public async resolveCodeLens(
    lens: CanonicalCodeLens,
    token?: CancellationToken
  ): Promise<CanonicalCodeLens> {
    if (lens.isResolved && lens.command) {
      return lens;
    }

    const session = this.serverManager.getAllSessions().find((s) => s.sessionId === lens.sessionId);
    if (!session) {
      Logger.debug('LspCodeLensResolver: Server session not found for resolve request', {
        sessionId: lens.sessionId,
      });
      return lens;
    }

    const caps = session.getCapabilities();
    const resolveSupported = Boolean(
      caps?.codeLensProvider &&
      typeof caps.codeLensProvider === 'object' &&
      caps.codeLensProvider.resolveProvider
    );

    if (!resolveSupported) {
      return lens;
    }

    const payload: LspCodeLens = {
      range: lens.range,
      data: lens.data,
      command: lens.command
        ? {
            title: lens.command.title,
            command: lens.command.command,
            arguments: lens.command.arguments,
          }
        : undefined,
    };

    try {
      const resolved = await session.getClient().sendRequest<LspCodeLens>(
        'codeLens/resolve',
        payload,
        {
          category: 'interactive',
          cancellationToken: token,
          timeoutMs: 4000,
        }
      );

      if (token?.isCancellationRequested || !resolved) {
        return lens;
      }

      // Validate the newly resolved command
      let command = lens.command;
      if (resolved.command) {
        const cmdValidation = LspCodeLensSecurityValidator.validateCommand(
          resolved.command,
          this.commandRegistry
        );
        if (cmdValidation.isValid && cmdValidation.sanitizedCommand) {
          command = cmdValidation.sanitizedCommand;
        } else {
          Logger.warn('LspCodeLensResolver: Resolved command failed security validation', {
            reason: cmdValidation.reason,
            command: resolved.command.command,
          });
        }
      }

      return {
        ...lens,
        command,
        data: resolved.data ?? lens.data,
        isResolved: true,
      };
    } catch (err: unknown) {
      const isCancelled =
        token?.isCancellationRequested ||
        (err instanceof Error &&
          (err.name === 'LspCancelledError' ||
            err.message.includes('cancelled') ||
            err.message.includes('canceled')));

      if (!isCancelled) {
        Logger.warn('LspCodeLensResolver: codeLens/resolve request failed', err);
      }

      return lens;
    }
  }
}
