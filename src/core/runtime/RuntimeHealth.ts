/**
 * QM Editor Centralized Runtime Health System
 * Phase 04, Step 29 — Core Application Runtime, Service Lifecycle & Dependency Orchestration
 */

import {
  ApplicationLifecycleState,
  RuntimeHealthReport,
  ServiceHealthStatus,
} from './RuntimeTypes';
import { ServiceRegistry } from './ServiceRegistry';

export class RuntimeHealth {
  private customDegradedReasons: string[] = [];

  constructor(private registry: ServiceRegistry) {}

  /**
   * Generates a point-in-time runtime health report across all managed services.
   */
  public getHealthReport(appState: ApplicationLifecycleState): RuntimeHealthReport {
    const records = this.registry.getAllRecords();
    const servicesHealth: RuntimeHealthReport['services'] = {};
    const degradedReasons: string[] = [...this.customDegradedReasons];

    let hasCriticalFailure = false;
    let hasOptionalFailure = false;
    let hasDegradedService = false;

    for (const record of records) {
      let status: ServiceHealthStatus = 'healthy';

      if (record.lifecycleState === 'failed') {
        status = 'failed';
        if (record.criticality === 'critical') {
          hasCriticalFailure = true;
          degradedReasons.push(`Critical service "${record.id}" failed: ${record.error || 'Unknown error'}`);
        } else {
          hasOptionalFailure = true;
          degradedReasons.push(`Optional service "${record.id}" failed: ${record.error || 'Subsystem unavailable'}`);
        }
      } else if (record.lifecycleState === 'degraded') {
        status = 'degraded';
        hasDegradedService = true;
        degradedReasons.push(`Service "${record.id}" is operating in a degraded state.`);
      } else if (record.lifecycleState === 'uninitialized' || record.lifecycleState === 'disposed') {
        status = 'unavailable';
      } else if (record.lifecycleState === 'ready') {
        status = 'healthy';
      } else {
        // initializing or stopping
        status = 'unavailable';
      }

      servicesHealth[record.id] = {
        status,
        state: record.lifecycleState,
        criticality: record.criticality,
        scope: record.scope,
        error: record.error,
        durationMs: record.initDurationMs,
      };
    }

    let overall: ServiceHealthStatus = 'healthy';
    if (appState === 'terminated' || hasCriticalFailure) {
      overall = 'failed';
    } else if (appState === 'shuttingDown' || appState === 'created') {
      overall = 'unavailable';
    } else if (hasOptionalFailure || hasDegradedService || appState === 'degraded') {
      overall = 'degraded';
    } else if (appState === 'ready') {
      overall = 'healthy';
    }

    return {
      overall,
      state: appState,
      services: servicesHealth,
      degradedReasons,
      timestamp: Date.now(),
    };
  }

  /**
   * Adds an external or operational degraded reason.
   */
  public addDegradedReason(reason: string): void {
    if (!this.customDegradedReasons.includes(reason)) {
      this.customDegradedReasons.push(reason);
    }
  }

  /**
   * Clears external degraded reasons.
   */
  public clearDegradedReasons(): void {
    this.customDegradedReasons = [];
  }
}
