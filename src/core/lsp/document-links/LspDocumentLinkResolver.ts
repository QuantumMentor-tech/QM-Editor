/**
 * QM Editor - LSP Document Link Resolver
 * Phase 06, Step 67 — LSP Document Links, Clickable Resource References & Safe URI Navigation
 * 
 * Resolves lazy Document Link target URIs via `documentLink/resolve` with capability checks,
 * cancellation, security validation, and stale protection.
 */

import { Logger } from '../../../utils/logger';
import { LspServerManager, globalLspServerManager } from '../LspServerManager';
import { CancellationToken } from '../../symbols/SymbolTypes';
import { LspDocumentLink } from '../LspTypes';
import { CanonicalDocumentLink } from './LspDocumentLinkTypes';
import { LspDocumentLinkSecurityValidator } from './LspDocumentLinkSecurityValidator';

export class LspDocumentLinkResolver {
  constructor(
    private readonly serverManager: LspServerManager = globalLspServerManager
  ) {}

  /**
   * Resolves a canonical document link, fetching target URI from the server if unresolved.
   */
  public async resolveDocumentLink(
    link: CanonicalDocumentLink,
    workspaceRoots: string[] = [],
    token?: CancellationToken
  ): Promise<CanonicalDocumentLink> {
    if (link.isResolved && link.target) {
      return link;
    }

    const session = this.serverManager.getAllSessions().find((s) => s.sessionId === link.sessionId);
    if (!session) {
      Logger.debug('LspDocumentLinkResolver: Server session not found for resolve request', {
        sessionId: link.sessionId,
      });
      return link;
    }

    const caps = session.getCapabilities();
    const resolveSupported = Boolean(
      caps?.documentLinkProvider &&
      typeof caps.documentLinkProvider === 'object' &&
      caps.documentLinkProvider.resolveProvider
    );

    if (!resolveSupported) {
      return link;
    }

    const payload: LspDocumentLink = {
      range: link.range,
      target: link.target,
      tooltip: link.tooltip,
      data: link.data,
    };

    try {
      const resolved = await session.getClient().sendRequest<LspDocumentLink>(
        'documentLink/resolve',
        payload,
        {
          category: 'interactive',
          cancellationToken: token,
          timeoutMs: 4000,
        }
      );

      if (token?.isCancellationRequested || !resolved) {
        return link;
      }

      let target = link.target;
      let classification = link.classification;

      if (resolved.target) {
        const valRes = LspDocumentLinkSecurityValidator.classifyAndValidateUri(
          resolved.target,
          link.uri,
          workspaceRoots
        );
        target = valRes.normalizedUri ?? resolved.target;
        classification = valRes.classification;
      }

      const tooltip = resolved.tooltip
        ? LspDocumentLinkSecurityValidator.sanitizeTooltip(resolved.tooltip)
        : link.tooltip;

      return {
        ...link,
        target,
        tooltip,
        data: resolved.data ?? link.data,
        isResolved: Boolean(target),
        classification,
      };
    } catch (err: unknown) {
      const isCancelled =
        token?.isCancellationRequested ||
        (err instanceof Error &&
          (err.name === 'LspCancelledError' ||
            err.message.includes('cancelled') ||
            err.message.includes('canceled')));

      if (!isCancelled) {
        Logger.warn('LspDocumentLinkResolver: documentLink/resolve request failed', err);
      }

      return link;
    }
  }
}
