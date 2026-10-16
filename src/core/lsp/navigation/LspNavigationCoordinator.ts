/**
 * QM Editor LSP Navigation Coordinator
 * Phase 06, Step 60 — LSP Code Navigation, Definitions, Declarations, Type Definitions & References
 *
 * Coordinates editor commands with LspNavigationProvider, multi-target disambiguation,
 * reference result dispatching, and routes target locations strictly through the authoritative
 * QM Editor NavigationCoordinator and DocumentEngine.
 */

import { Location, Position } from '../../navigation/LocationTypes';
import { globalNavigationCoordinator, NavigationCoordinator } from '../../navigation/NavigationCoordinator';
import { LspNavigationProvider, globalLspNavigationProvider } from './LspNavigationProvider';
import { LspNavigationRequest, LspReferenceRequest, ReferenceResult } from './LspNavigationTypes';
import { globalFeedbackService, FeedbackService } from '../../feedback/FeedbackService';
import { CancellationToken } from '../../symbols/SymbolTypes';

export class LspNavigationCoordinator {
  private static instance: LspNavigationCoordinator | null = null;
  private currentRequestId: number = 0;
  private activeCancellationToken: { cancel: () => void; token: CancellationToken } | null = null;

  constructor(
    private readonly provider: LspNavigationProvider = globalLspNavigationProvider,
    private readonly navigationCoordinator: NavigationCoordinator = globalNavigationCoordinator,
    private readonly feedbackService: FeedbackService = globalFeedbackService
  ) {}

  public static getInstance(): LspNavigationCoordinator {
    if (!LspNavigationCoordinator.instance) {
      LspNavigationCoordinator.instance = new LspNavigationCoordinator();
    }
    return LspNavigationCoordinator.instance;
  }

  /**
   * Creates a cancellable token for new interactive operations, cancelling any pending ones.
   */
  private createCancellationToken(): CancellationToken {
    if (this.activeCancellationToken) {
      this.activeCancellationToken.cancel();
      this.activeCancellationToken = null;
    }

    let isCancelled = false;
    const listeners: (() => void)[] = [];

    const token: CancellationToken = {
      get isCancellationRequested() {
        return isCancelled;
      },
      onCancellationRequested(listener: () => void) {
        listeners.push(listener);
        return () => {
          const idx = listeners.indexOf(listener);
          if (idx >= 0) listeners.splice(idx, 1);
        };
      },
    };

    const cancel = () => {
      if (!isCancelled) {
        isCancelled = true;
        for (const l of listeners) l();
      }
    };

    this.activeCancellationToken = { cancel, token };
    return token;
  }

  public cancelActiveRequest(): void {
    if (this.activeCancellationToken) {
      this.activeCancellationToken.cancel();
      this.activeCancellationToken = null;
    }
  }

  // ---------------------------------------------------------------------------
  // 1. Go to Definition
  // ---------------------------------------------------------------------------

  public async goToDefinition(
    documentId: string,
    position: Position,
    uri: string,
    languageId: string,
    revision: number,
    workspaceId?: string
  ): Promise<boolean> {
    const requestId = `def-${++this.currentRequestId}`;
    const token = this.createCancellationToken();

    const request: LspNavigationRequest = {
      requestId,
      documentId,
      uri,
      languageId,
      revision,
      position,
      workspaceId,
    };

    const locations = await this.provider.provideDefinition(request, token);
    if (token.isCancellationRequested) return false;

    return this.handleNavigationLocations(locations, 'Definition');
  }

  // ---------------------------------------------------------------------------
  // 2. Go to Declaration
  // ---------------------------------------------------------------------------

  public async goToDeclaration(
    documentId: string,
    position: Position,
    uri: string,
    languageId: string,
    revision: number,
    workspaceId?: string
  ): Promise<boolean> {
    const requestId = `decl-${++this.currentRequestId}`;
    const token = this.createCancellationToken();

    const request: LspNavigationRequest = {
      requestId,
      documentId,
      uri,
      languageId,
      revision,
      position,
      workspaceId,
    };

    const locations = await this.provider.provideDeclaration(request, token);
    if (token.isCancellationRequested) return false;

    return this.handleNavigationLocations(locations, 'Declaration');
  }

  // ---------------------------------------------------------------------------
  // 3. Go to Type Definition
  // ---------------------------------------------------------------------------

  public async goToTypeDefinition(
    documentId: string,
    position: Position,
    uri: string,
    languageId: string,
    revision: number,
    workspaceId?: string
  ): Promise<boolean> {
    const requestId = `typedef-${++this.currentRequestId}`;
    const token = this.createCancellationToken();

    const request: LspNavigationRequest = {
      requestId,
      documentId,
      uri,
      languageId,
      revision,
      position,
      workspaceId,
    };

    const locations = await this.provider.provideTypeDefinition(request, token);
    if (token.isCancellationRequested) return false;

    return this.handleNavigationLocations(locations, 'Type Definition');
  }

  // ---------------------------------------------------------------------------
  // 4. Find References
  // ---------------------------------------------------------------------------

  public async findReferences(
    documentId: string,
    position: Position,
    uri: string,
    languageId: string,
    revision: number,
    workspaceId?: string,
    includeDeclaration: boolean = true
  ): Promise<ReferenceResult | null> {
    const requestId = `refs-${++this.currentRequestId}`;
    const token = this.createCancellationToken();

    const request: LspReferenceRequest = {
      requestId,
      documentId,
      uri,
      languageId,
      revision,
      position,
      workspaceId,
      includeDeclaration,
    };

    const result = await this.provider.provideReferences(request, token);
    if (token.isCancellationRequested) return null;

    if (!result || result.totalCount === 0) {
      this.feedbackService.show({
        severity: 'info',
        message: 'No references found for current symbol.',
      });
      return result;
    }

    // Broadcast references event for Reference UI / Modal / Panel
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('qm:navigation:references', {
          detail: result,
        })
      );
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // 5. Target Location Resolution
  // ---------------------------------------------------------------------------

  private async handleNavigationLocations(
    locations: Location[],
    kindName: string
  ): Promise<boolean> {
    if (locations.length === 0) {
      this.feedbackService.show({
        severity: 'info',
        message: `No ${kindName.toLowerCase()} found.`,
      });
      return false;
    }

    if (locations.length === 1) {
      // Exactly one location: navigate directly through authoritative NavigationCoordinator
      const result = await this.navigationCoordinator.navigateToLocation(locations[0], {
        origin: `lsp-${kindName.toLowerCase().replace(/\s+/g, '-')}`,
      });
      return result.success;
    }

    // Multiple locations: broadcast event for multi-target picker modal
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('qm:navigation:multiple-targets', {
          detail: {
            title: `${kindName}s (${locations.length})`,
            locations,
          },
        })
      );
    }

    return true;
  }
}

export const globalLspNavigationCoordinator = LspNavigationCoordinator.getInstance();
