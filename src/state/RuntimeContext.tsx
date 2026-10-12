/**
 * QM Editor Application Runtime React Context & Hook
 * Phase 04, Step 29 — Core Application Runtime, Service Lifecycle & Dependency Orchestration
 */

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import {
  ApplicationLifecycleState,
  RuntimeHealthReport,
  ApplicationRuntime,
  globalApplicationRuntime,
  registerDefaultServices,
  ShutdownOptions,
} from '../core/runtime';
import { logger } from '../utils/logger';

export interface RuntimeContextType {
  runtime: ApplicationRuntime;
  lifecycleState: ApplicationLifecycleState;
  healthReport: RuntimeHealthReport;
  isReady: boolean;
  workspaceGeneration: number;
  activeWorkspaceUri: string | null;
  openWorkspace: (uri: string, name?: string) => Promise<number>;
  closeWorkspace: () => Promise<number>;
  shutdown: (options?: ShutdownOptions) => Promise<void>;
  restartService: (serviceId: string) => Promise<boolean>;
  getService: <T = unknown>(serviceId: string) => T;
  tryGetService: <T = unknown>(serviceId: string) => T | undefined;
}

const RuntimeContext = createContext<RuntimeContextType | undefined>(undefined);

let servicesRegistered = false;

export const RuntimeProvider: React.FC<{
  runtime?: ApplicationRuntime;
  autoStart?: boolean;
  children: React.ReactNode;
}> = ({ runtime = globalApplicationRuntime, autoStart = true, children }) => {
  const [lifecycleState, setLifecycleState] = useState<ApplicationLifecycleState>(() =>
    runtime.getState()
  );
  const [healthReport, setHealthReport] = useState<RuntimeHealthReport>(() =>
    runtime.getHealthReport()
  );
  const [workspaceGeneration, setWorkspaceGeneration] = useState<number>(() =>
    runtime.currentWorkspaceGeneration
  );
  const [activeWorkspaceUri, setActiveWorkspaceUri] = useState<string | null>(() =>
    runtime.currentWorkspaceUri
  );

  useEffect(() => {
    // 1. Register default built-in services if not already registered on global singleton
    if (runtime === globalApplicationRuntime && !servicesRegistered) {
      registerDefaultServices(runtime);
      servicesRegistered = true;
    }

    // 2. Subscribe to runtime events to keep React state synchronized
    const d1 = runtime.on('application.started', () => {
      setLifecycleState(runtime.getState());
      setHealthReport(runtime.getHealthReport());
    });
    const d2 = runtime.on('application.ready', () => {
      setLifecycleState(runtime.getState());
      setHealthReport(runtime.getHealthReport());
    });
    const d3 = runtime.on('application.degraded', () => {
      setLifecycleState(runtime.getState());
      setHealthReport(runtime.getHealthReport());
    });
    const d4 = runtime.on('application.shutdownRequested', () => {
      setLifecycleState(runtime.getState());
      setHealthReport(runtime.getHealthReport());
    });
    const d5 = runtime.on('application.shutdown', () => {
      setLifecycleState(runtime.getState());
      setHealthReport(runtime.getHealthReport());
    });
    const d6 = runtime.on('workspace.opened', (e) => {
      setWorkspaceGeneration(e.generation);
      setActiveWorkspaceUri(e.uri);
    });
    const d7 = runtime.on('workspace.closed', (e) => {
      setWorkspaceGeneration(e.generation);
      setActiveWorkspaceUri(null);
    });
    const d8 = runtime.on('service.ready', () => {
      setHealthReport(runtime.getHealthReport());
    });
    const d9 = runtime.on('service.failed', () => {
      setHealthReport(runtime.getHealthReport());
    });

    // 3. Auto-start runtime if requested and not yet started
    if (autoStart && runtime.getState() === 'created') {
      runtime.start().catch((err) => {
        logger.error('Runtime auto-start failed', { error: (err as Error).message });
        setLifecycleState(runtime.getState());
        setHealthReport(runtime.getHealthReport());
      });
    }

    return () => {
      d1.dispose();
      d2.dispose();
      d3.dispose();
      d4.dispose();
      d5.dispose();
      d6.dispose();
      d7.dispose();
      d8.dispose();
      d9.dispose();
    };
  }, [runtime, autoStart]);

  const value = useMemo<RuntimeContextType>(
    () => ({
      runtime,
      lifecycleState,
      healthReport,
      isReady: lifecycleState === 'ready' || lifecycleState === 'degraded',
      workspaceGeneration,
      activeWorkspaceUri,
      openWorkspace: (uri: string, name?: string) => runtime.openWorkspace(uri, name),
      closeWorkspace: () => runtime.closeWorkspace(),
      shutdown: (options?: ShutdownOptions) => runtime.shutdown(options),
      restartService: (serviceId: string) => runtime.restartService(serviceId),
      getService: <T = unknown>(id: string) => runtime.getService<T>(id),
      tryGetService: <T = unknown>(id: string) => runtime.tryGetService<T>(id),
    }),
    [runtime, lifecycleState, healthReport, workspaceGeneration, activeWorkspaceUri]
  );

  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>;
};

export const useRuntime = (): RuntimeContextType => {
  const context = useContext(RuntimeContext);
  if (!context) {
    throw new Error('useRuntime must be used within a RuntimeProvider');
  }
  return context;
};
