/**
 * QM Editor — LSP Call Hierarchy Coordinator
 * Phase 06, Step 70 — LSP Call Hierarchy, Callers, Callees & Safe Cross-File Code Relationship Navigation
 *
 * Coordinates call hierarchy preparation, tree expansion, lazy child loading,
 * cycle detection, and centralized navigation via NavigationCoordinator.
 */

import { DocumentEngine, globalDocumentEngine } from '../../documents/DocumentEngine';
import { WorkspaceEngine, globalWorkspaceEngine } from '../../workspace/WorkspaceEngine';
import { NavigationCoordinator } from '../../navigation/NavigationCoordinator';
import { Range } from '../../navigation/LocationTypes';
import { LspPosition } from '../LspTypes';
import { LspCallHierarchyProvider, globalCallHierarchyProvider } from './LspCallHierarchyProvider';
import {
  CallHierarchyContext,
  CallHierarchyDirection,
  CallHierarchyTreeNode,
  QmCallHierarchyItem,
} from './LspCallHierarchyTypes';
import { LspCallHierarchyValidator } from './LspCallHierarchyValidator';
import { LspCallHierarchyMapper } from './LspCallHierarchyMapper';

export class LspCallHierarchyCoordinator {
  private static instance: LspCallHierarchyCoordinator | null = null;
  private activeContext: CallHierarchyContext | null = null;
  private readonly unsubscribers: Array<() => void> = [];
  private isDisposed = false;

  constructor(
    private readonly provider: LspCallHierarchyProvider = globalCallHierarchyProvider,
    private readonly documentEngine: DocumentEngine = globalDocumentEngine,
    private readonly workspaceEngine: WorkspaceEngine = globalWorkspaceEngine,
    private readonly navigationCoordinator: NavigationCoordinator = NavigationCoordinator.getInstance()
  ) {
    this.bindDocumentEvents();
  }

  public static getInstance(): LspCallHierarchyCoordinator {
    if (!LspCallHierarchyCoordinator.instance) {
      LspCallHierarchyCoordinator.instance = new LspCallHierarchyCoordinator();
    }
    return LspCallHierarchyCoordinator.instance;
  }

  private bindDocumentEvents(): void {
    const unsubClose = this.documentEngine.on('document.closed', (e: any) => {
      if (this.activeContext && e.documentId === this.activeContext.documentId) {
        this.clearSession();
      }
    });

    const unsubChange = this.documentEngine.on('document.changed', (e) => {
      if (this.activeContext && e.documentId === this.activeContext.documentId) {
        // Active root document modified; mark session stale
        this.activeContext = null;
      }
    });

    this.unsubscribers.push(unsubClose, unsubChange);
  }

  public getActiveContext(): CallHierarchyContext | null {
    return this.activeContext;
  }

  public clearSession(): void {
    this.activeContext = null;
  }

  public dispose(): void {
    this.isDisposed = true;
    this.unsubscribers.forEach((u) => u());
    this.unsubscribers.length = 0;
    this.clearSession();
  }

  /**
   * Prepares call hierarchy items at the specified cursor position.
   */
  public async prepareHierarchy(
    documentUri: string,
    position: LspPosition
  ): Promise<QmCallHierarchyItem[] | null> {
    if (this.isDisposed) return null;

    const items = await this.provider.prepareCallHierarchy(documentUri, position);
    if (!items || items.length === 0) return null;

    const root = items[0];
    const doc = this.documentEngine.getByResource(documentUri);
    const workspaceId = this.workspaceEngine.getWorkspaceId() || doc?.workspaceId || 'default-workspace';

    this.activeContext = {
      rootItem: root,
      workspaceId,
      documentId: doc ? doc.id : root.id,
      sessionId: root.providerId,
      providerGeneration: root.providerGeneration,
      documentRevision: root.documentRevision,
      createdAt: Date.now(),
    };

    return items;
  }

  /**
   * Creates a root tree node for UI rendering.
   */
  public createRootTreeNode(
    item: QmCallHierarchyItem,
    direction: CallHierarchyDirection = 'incoming'
  ): CallHierarchyTreeNode {
    const rootFingerprint = LspCallHierarchyValidator.getItemFingerprint(item);
    return {
      id: `root:${item.id}:${direction}`,
      item,
      direction,
      callSiteRanges: [item.selectionRange],
      state: 'unloaded',
      depth: 0,
      ancestorFingerprints: new Set([rootFingerprint]),
    };
  }

  /**
   * Lazily expands a tree node, fetching incoming or outgoing calls and detecting cycles.
   */
  public async expandNode(
    node: CallHierarchyTreeNode,
    direction?: CallHierarchyDirection
  ): Promise<CallHierarchyTreeNode[]> {
    if (this.isDisposed) return [];

    const effectiveDir = direction || node.direction;

    // If already loaded or cyclic, return existing children
    if (node.state === 'loaded' && node.children) {
      return node.children;
    }

    if (node.isCycle) {
      node.state = 'cycle';
      return [];
    }

    // Depth safety check
    const maxDepth = this.provider.getMaxDepth();
    if (node.depth >= maxDepth) {
      node.state = 'empty';
      node.errorMessage = `Maximum depth (${maxDepth}) reached.`;
      return [];
    }

    node.state = 'loading';

    try {
      const currentFingerprint = LspCallHierarchyValidator.getItemFingerprint(node.item);
      const childAncestorSet = new Set(node.ancestorFingerprints);
      childAncestorSet.add(currentFingerprint);

      let children: CallHierarchyTreeNode[] = [];

      if (effectiveDir === 'incoming') {
        const incomingCalls = await this.provider.getIncomingCalls(node.item);
        if (!incomingCalls || incomingCalls.length === 0) {
          node.state = 'empty';
          node.children = [];
          return [];
        }

        children = incomingCalls.map((call) => {
          const childFingerprint = LspCallHierarchyValidator.getItemFingerprint(call.from);
          const isCyclic = LspCallHierarchyValidator.isCycle(childFingerprint, childAncestorSet);

          return {
            id: `node:${call.id}:${effectiveDir}`,
            item: call.from,
            direction: effectiveDir,
            callSiteRanges: call.fromRanges,
            state: isCyclic ? 'cycle' : 'unloaded',
            isCycle: isCyclic,
            depth: node.depth + 1,
            ancestorFingerprints: childAncestorSet,
          };
        });
      } else {
        const outgoingCalls = await this.provider.getOutgoingCalls(node.item);
        if (!outgoingCalls || outgoingCalls.length === 0) {
          node.state = 'empty';
          node.children = [];
          return [];
        }

        children = outgoingCalls.map((call) => {
          const childFingerprint = LspCallHierarchyValidator.getItemFingerprint(call.to);
          const isCyclic = LspCallHierarchyValidator.isCycle(childFingerprint, childAncestorSet);

          return {
            id: `node:${call.id}:${effectiveDir}`,
            item: call.to,
            direction: effectiveDir,
            callSiteRanges: call.fromRanges,
            state: isCyclic ? 'cycle' : 'unloaded',
            isCycle: isCyclic,
            depth: node.depth + 1,
            ancestorFingerprints: childAncestorSet,
          };
        });
      }

      node.children = children;
      node.state = children.length === 0 ? 'empty' : 'loaded';
      return children;
    } catch (err: any) {
      node.state = 'failed';
      node.errorMessage = err?.message || 'Failed to load calls';
      return [];
    }
  }

  /**
   * Navigates to a symbol definition location via NavigationCoordinator.
   */
  public async navigateToItem(item: QmCallHierarchyItem): Promise<boolean> {
    const location = LspCallHierarchyMapper.itemToLocation(item);
    const result = await this.navigationCoordinator.navigateToLocation(location, {
      origin: 'lsp-call-hierarchy',
    });
    return result.success;
  }

  /**
   * Navigates to a specific call-site range within the caller/callee document.
   */
  public async navigateToCallSite(item: QmCallHierarchyItem, range: Range): Promise<boolean> {
    const location = LspCallHierarchyMapper.callSiteToLocation(item, range);
    const result = await this.navigationCoordinator.navigateToLocation(location, {
      origin: 'lsp-call-hierarchy-callsite',
    });
    return result.success;
  }
}

export const globalCallHierarchyCoordinator = LspCallHierarchyCoordinator.getInstance();
