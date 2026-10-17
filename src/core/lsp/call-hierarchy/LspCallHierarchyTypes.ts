/**
 * QM Editor — LSP Call Hierarchy Types
 * Phase 06, Step 70 — LSP Call Hierarchy, Callers, Callees & Safe Cross-File Code Relationship Navigation
 */

import { Range } from '../../navigation/LocationTypes';
import { SymbolKind, SymbolTag } from '../../symbols/SymbolTypes';
import {
  LspCallHierarchyItem,
  LspCallHierarchyIncomingCall,
  LspCallHierarchyOutgoingCall,
  LspPosition,
  LspRange,
} from '../LspTypes';

export type {
  LspCallHierarchyItem,
  LspCallHierarchyIncomingCall,
  LspCallHierarchyOutgoingCall,
  LspPosition,
  LspRange,
};

/**
 * Canonical representation of a call hierarchy item in QM Editor.
 * Wraps language server symbol metadata with verified 1-based canonical locations.
 */
export interface QmCallHierarchyItem {
  id: string;
  name: string;
  kind: SymbolKind;
  tags?: SymbolTag[];
  detail?: string;
  uri: string; // Canonical file path or URI
  displayUri: string; // Relative or shortened display path
  range: Range; // 1-based enclosing range
  selectionRange: Range; // 1-based identifier/symbol range
  providerId: string;
  providerGeneration: number;
  documentRevision: number;
  rawItem: LspCallHierarchyItem;
}

/**
 * Canonical incoming call representation (Caller -> Target).
 */
export interface QmIncomingCall {
  id: string;
  from: QmCallHierarchyItem;
  fromRanges: Range[];
  parentItemId: string;
  providerId: string;
  providerGeneration: number;
}

/**
 * Canonical outgoing call representation (Target -> Callee).
 */
export interface QmOutgoingCall {
  id: string;
  to: QmCallHierarchyItem;
  fromRanges: Range[];
  parentItemId: string;
  providerId: string;
  providerGeneration: number;
}

/**
 * Server session capability state for call hierarchy.
 */
export interface CallHierarchyCapabilityState {
  supported: boolean;
  sessionId?: string;
  workspaceId?: string;
  languageId?: string;
  generation: number;
}

/**
 * Hierarchy expansion direction.
 */
export type CallHierarchyDirection = 'incoming' | 'outgoing';

/**
 * Runtime state of a call hierarchy tree node.
 */
export type CallHierarchyNodeState =
  | 'unloaded'
  | 'loading'
  | 'loaded'
  | 'empty'
  | 'failed'
  | 'stale'
  | 'cycle';

/**
 * Hierarchical tree node model for UI presentation.
 */
export interface CallHierarchyTreeNode {
  id: string;
  item: QmCallHierarchyItem;
  direction: CallHierarchyDirection;
  callSiteRanges: Range[];
  state: CallHierarchyNodeState;
  errorMessage?: string;
  children?: CallHierarchyTreeNode[];
  isCycle?: boolean;
  depth: number;
  ancestorFingerprints: Set<string>;
}

/**
 * Active call hierarchy session context.
 */
export interface CallHierarchyContext {
  rootItem: QmCallHierarchyItem;
  workspaceId: string;
  documentId: string;
  sessionId: string;
  providerGeneration: number;
  documentRevision: number;
  createdAt: number;
}
