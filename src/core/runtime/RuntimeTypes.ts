/**
 * QM Editor Application Runtime & Service Lifecycle Types
 * Phase 04, Step 29 — Core Application Runtime, Service Lifecycle & Dependency Orchestration
 */

import { logger } from '../../utils/logger';

export type ApplicationLifecycleState =
  | 'created'
  | 'initializing'
  | 'ready'
  | 'degraded'
  | 'shuttingDown'
  | 'terminated';

export type ServiceLifecycleState =
  | 'uninitialized'
  | 'initializing'
  | 'ready'
  | 'degraded'
  | 'failed'
  | 'stopping'
  | 'disposed';

export type ServiceScope = 'application' | 'workspace' | 'session';

export type ServiceCriticality = 'critical' | 'optional';

export type ServiceHealthStatus = 'healthy' | 'degraded' | 'unavailable' | 'failed';

export interface Disposable {
  dispose: () => void | Promise<void>;
}

export interface ServiceRecord<T = unknown> {
  id: string;
  name: string;
  dependencies: string[];
  scope: ServiceScope;
  criticality: ServiceCriticality;
  lifecycleState: ServiceLifecycleState;
  instance?: T;
  factory?: (context: ServiceInitializationContext) => Promise<T> | T;
  initialize?: (instance: T, context: ServiceInitializationContext) => Promise<void> | void;
  dispose?: (instance: T) => Promise<void> | void;
  reset?: (instance: T, context: ServiceInitializationContext) => Promise<void> | void;
  error?: string;
  initDurationMs?: number;
}

export interface ServiceDefinition<T = unknown> {
  id: string;
  name: string;
  dependencies?: string[];
  scope?: ServiceScope;
  criticality?: ServiceCriticality;
  instance?: T;
  factory?: (context: ServiceInitializationContext) => Promise<T> | T;
  initialize?: (instance: T, context: ServiceInitializationContext) => Promise<void> | void;
  dispose?: (instance: T) => Promise<void> | void;
  reset?: (instance: T, context: ServiceInitializationContext) => Promise<void> | void;
}

export interface ServiceInitializationContext {
  getService: <S = unknown>(serviceId: string) => S;
  tryGetService: <S = unknown>(serviceId: string) => S | undefined;
  workspaceGeneration: number;
  workspaceId: string;
  workspaceUri: string | null;
  signal?: AbortSignal;
  logger: typeof logger;
}

export interface RuntimeHealthReport {
  overall: ServiceHealthStatus;
  state: ApplicationLifecycleState;
  services: Record<
    string,
    {
      status: ServiceHealthStatus;
      state: ServiceLifecycleState;
      criticality: ServiceCriticality;
      scope: ServiceScope;
      error?: string;
      durationMs?: number;
    }
  >;
  degradedReasons: string[];
  timestamp: number;
}

export interface RuntimeEventMap {
  'application.started': { timestamp: number };
  'application.ready': { timestamp: number; startupDurationMs: number; health: ServiceHealthStatus };
  'application.degraded': { timestamp: number; reason: string; serviceId: string };
  'application.shutdownRequested': { timestamp: number; reason?: string };
  'application.shutdown': { timestamp: number; durationMs: number };
  'workspace.opening': { uri: string; generation: number };
  'workspace.opened': { uri: string; name: string; generation: number };
  'workspace.closing': { generation: number };
  'workspace.closed': { generation: number };
  'service.registered': { serviceId: string; criticality: ServiceCriticality; scope: ServiceScope };
  'service.initializing': { serviceId: string };
  'service.ready': { serviceId: string; durationMs: number };
  'service.failed': { serviceId: string; error: string; criticality: ServiceCriticality };
  'service.degraded': { serviceId: string; reason: string };
  'service.disposed': { serviceId: string };
}

export type RuntimeEventKey = keyof RuntimeEventMap;
export type RuntimeEventListener<K extends RuntimeEventKey> = (payload: RuntimeEventMap[K]) => void;

export interface ApplicationContextSnapshot {
  applicationId: string;
  sessionId: string;
  lifecycleState: ApplicationLifecycleState;
  workspaceGeneration: number;
  activeWorkspaceId: string;
  activeWorkspaceUri: string | null;
  healthy: boolean;
}
