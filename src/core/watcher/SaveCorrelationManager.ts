/**
 * QM Editor Internal Save Correlation Manager
 * Phase 04, Step 38 — Core Application Engine
 */

import { SaveCorrelationTicket } from './WatcherTypes';
import { normalizeWorkspacePath } from '../workspace/WorkspaceResourceBoundary';
import { logger } from '../../utils/logger';

export const DEFAULT_SAVE_CORRELATION_TTL_MS = 1500;

/**
 * Manages explicit save operation correlation to distinguish QM Editor's
 * own write activities from genuine external modifications.
 */
export class SaveCorrelationManager {
  private ticketsByUri = new Map<string, SaveCorrelationTicket>();
  private ticketsByOpId = new Map<string, SaveCorrelationTicket>();
  private opCounter = 0;

  /**
   * Registers a save operation in-flight.
   */
  public registerSave(
    rawUri: string,
    options: {
      workspaceId?: string;
      expectedRevision?: number;
      ttlMs?: number;
    } = {}
  ): string {
    const resourceUri = normalizeWorkspacePath(rawUri);
    const operationId = `save-${++this.opCounter}-${Date.now()}`;
    const ttl = options.ttlMs ?? DEFAULT_SAVE_CORRELATION_TTL_MS;
    const now = Date.now();

    const ticket: SaveCorrelationTicket = {
      operationId,
      workspaceId: options.workspaceId,
      resourceUri,
      expectedRevision: options.expectedRevision,
      timestamp: now,
      expiresAt: now + ttl,
    };

    this.ticketsByUri.set(resourceUri, ticket);
    this.ticketsByOpId.set(operationId, ticket);

    logger.info('SaveCorrelationManager: registered internal save operation', {
      operationId,
      resourceUri,
      expectedRevision: options.expectedRevision,
    });

    return operationId;
  }

  /**
   * Confirms a save write completed on storage, refreshing TTL to cover OS event latency.
   */
  public completeSave(operationId: string, ttlMs: number = DEFAULT_SAVE_CORRELATION_TTL_MS): void {
    const ticket = this.ticketsByOpId.get(operationId);
    if (!ticket) return;

    ticket.expiresAt = Date.now() + ttlMs;
  }

  /**
   * Checks if an incoming filesystem event matches an active internal save correlation.
   * If matched and unexpired, returns the ticket and cleans it up.
   */
  public correlateEvent(rawUri: string): SaveCorrelationTicket | null {
    this.cleanExpired();

    const uri = normalizeWorkspacePath(rawUri);
    const ticket = this.ticketsByUri.get(uri);
    if (!ticket) return null;

    if (Date.now() <= ticket.expiresAt) {
      // Correlated to internal save
      this.ticketsByUri.delete(uri);
      this.ticketsByOpId.delete(ticket.operationId);
      logger.info('SaveCorrelationManager: correlated event to internal write', {
        operationId: ticket.operationId,
        resourceUri: uri,
      });
      return ticket;
    }

    this.ticketsByUri.delete(uri);
    this.ticketsByOpId.delete(ticket.operationId);
    return null;
  }

  /**
   * Checks whether a URI currently has an active unexpired internal save ticket.
   */
  public hasActiveSave(rawUri: string): boolean {
    const uri = normalizeWorkspacePath(rawUri);
    const ticket = this.ticketsByUri.get(uri);
    if (!ticket) return false;

    if (Date.now() <= ticket.expiresAt) {
      return true;
    }

    this.ticketsByUri.delete(uri);
    this.ticketsByOpId.delete(ticket.operationId);
    return false;
  }

  /**
   * Cleans expired correlation entries.
   */
  public cleanExpired(): void {
    const now = Date.now();
    for (const [uri, ticket] of this.ticketsByUri.entries()) {
      if (now > ticket.expiresAt) {
        this.ticketsByUri.delete(uri);
        this.ticketsByOpId.delete(ticket.operationId);
      }
    }
  }

  public getActiveTicketCount(): number {
    this.cleanExpired();
    return this.ticketsByUri.size;
  }

  public clear(): void {
    this.ticketsByUri.clear();
    this.ticketsByOpId.clear();
  }
}
