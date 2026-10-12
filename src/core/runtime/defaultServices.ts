/**
 * QM Editor Built-in Service Registrations
 * Phase 04, Step 29 — Core Application Runtime, Service Lifecycle & Dependency Orchestration
 */

import { ApplicationRuntime } from './ApplicationRuntime';
import { SettingsService } from '../settings/SettingsService';
import { globalFeedbackService } from '../feedback/FeedbackService';
import { globalCommandRegistry } from '../commands/CommandRegistry';
import { fileService } from '../../services/FileService';
import { workspaceService } from '../../services/WorkspaceService';
import { SessionService } from '../../services/SessionService';
import { searchService } from '../../services/SearchService';
import { RecentWorkspacesService } from '../../services/RecentWorkspacesService';
import { RecentDocumentsService } from '../../services/RecentDocumentsService';
import { globalLayoutService } from '../layout/LayoutService';
import { terminalService } from '../terminal/TerminalService';
import { taskService } from '../tasks/TaskService';
import { sourceControlService } from '../source-control/SourceControlService';
import { workspaceSearchService } from '../../services/WorkspaceSearchService';
import { workspaceIndexService } from '../../services/WorkspaceIndexService';
import { globalWorkspaceEngine } from '../workspace';
import { globalEditTransactionManager } from '../edit';
import { globalFileSystemWatcherService } from '../watcher';
import { globalDocumentHistoryService } from '../history';
import { globalDiagnosticService, setupTaskProblemsBridge } from '../diagnostics';
import { globalSymbolService } from '../symbols';
import { logger } from '../../utils/logger';

/**
 * Registers standard QM Editor application and workspace services into the provided runtime.
 */
export function registerDefaultServices(runtime: ApplicationRuntime): void {
  // 1. Settings (Critical Infrastructure)
  runtime.registerService({
    id: 'settings',
    name: 'Settings Service',
    scope: 'application',
    criticality: 'critical',
    dependencies: [],
    instance: SettingsService.getInstance(),
    initialize: () => {
      logger.info('Runtime: Settings Service initialized');
    },
  });

  // 2. Feedback (Critical UI & Error Communication)
  runtime.registerService({
    id: 'feedback',
    name: 'Unified Feedback Service',
    scope: 'application',
    criticality: 'critical',
    dependencies: [],
    instance: globalFeedbackService,
    initialize: () => {
      logger.info('Runtime: Feedback Service initialized');
    },
    dispose: (service) => {
      service.clearAll();
    },
  });

  // 3. Command Registry (Critical Action Dispatcher)
  runtime.registerService({
    id: 'command',
    name: 'Command Registry',
    scope: 'application',
    criticality: 'critical',
    dependencies: [],
    instance: globalCommandRegistry,
    initialize: () => {
      logger.info('Runtime: Command Registry initialized');
    },
  });

  // 4. File Service (Critical Filesystem Abstraction)
  runtime.registerService({
    id: 'file',
    name: 'File Service',
    scope: 'application',
    criticality: 'critical',
    dependencies: [],
    instance: fileService,
    initialize: () => {
      logger.info('Runtime: File Service initialized');
    },
  });

  // 4b. Edit Transaction & Revision Consistency Engine
  runtime.registerService({
    id: 'editTransactionManager',
    name: 'Edit Transaction & Revision Manager',
    scope: 'application',
    criticality: 'critical',
    dependencies: [],
    instance: globalEditTransactionManager,
    initialize: () => {
      logger.info('Runtime: Edit Transaction Manager initialized');
    },
  });

  // 5. Layout Service (Critical Workspace Geometry)
  runtime.registerService({
    id: 'layout',
    name: 'Layout Service',
    scope: 'application',
    criticality: 'critical',
    dependencies: [],
    instance: globalLayoutService,
  });

  // 6. Recent Workspaces & Documents (Critical Metadata)
  runtime.registerService({
    id: 'recentWorkspaces',
    name: 'Recent Workspaces Service',
    scope: 'application',
    criticality: 'critical',
    dependencies: [],
    instance: RecentWorkspacesService,
  });

  runtime.registerService({
    id: 'recentDocuments',
    name: 'Recent Documents Service',
    scope: 'application',
    criticality: 'critical',
    dependencies: [],
    instance: RecentDocumentsService,
  });

  // 7. Session Service (Depends on Settings)
  runtime.registerService({
    id: 'session',
    name: 'Session Continuity Service',
    scope: 'application',
    criticality: 'critical',
    dependencies: ['settings'],
    instance: SessionService,
    initialize: () => {
      logger.info('Runtime: Session Service initialized');
    },
  });

  // 8. Workspace Service (Depends on File)
  runtime.registerService({
    id: 'workspace',
    name: 'Workspace Service',
    scope: 'application',
    criticality: 'critical',
    dependencies: ['file'],
    instance: workspaceService,
    initialize: () => {
      logger.info('Runtime: Workspace Service initialized');
    },
  });

  // 8b. Workspace & Project Context Engine (Authoritative Context & Boundary Subsystem)
  runtime.registerService({
    id: 'workspaceEngine',
    name: 'Workspace & Project Context Engine',
    scope: 'application',
    criticality: 'critical',
    dependencies: ['file'],
    instance: globalWorkspaceEngine,
    initialize: () => {
      logger.info('Runtime: Workspace Context Engine initialized');
    },
  });

  // 9. Single-File Search Service (Depends on Settings)
  runtime.registerService({
    id: 'search',
    name: 'Search & Replace Service',
    scope: 'application',
    criticality: 'critical',
    dependencies: ['settings'],
    instance: searchService,
  });

  // 10. Terminal Service (Optional Subsystem - Depends on Settings)
  runtime.registerService({
    id: 'terminal',
    name: 'Integrated Terminal Service',
    scope: 'application',
    criticality: 'optional',
    dependencies: ['settings'],
    instance: terminalService,
    initialize: () => {
      logger.info('Runtime: Terminal Service initialized');
    },
    dispose: async (service) => {
      await service.disposeAll();
      logger.info('Runtime: All terminal sessions terminated');
    },
  });

  // 11. Tasks Service (Optional Subsystem - Depends on Settings)
  runtime.registerService({
    id: 'tasks',
    name: 'Task Runner & Problems Service',
    scope: 'application',
    criticality: 'optional',
    dependencies: ['settings'],
    instance: taskService,
    initialize: () => {
      logger.info('Runtime: Task Service initialized');
    },
    dispose: async (service) => {
      const sessions = service.getSessions();
      for (const sess of sessions) {
        if (sess.status === 'running' || sess.status === 'starting') {
          await service.cancelTask(sess.sessionId);
        }
      }
      logger.info('Runtime: Running tasks cancelled and cleaned up');
    },
  });

  // 12. Workspace Search Service (Optional Workspace-Scoped)
  runtime.registerService({
    id: 'workspaceSearch',
    name: 'Workspace Search Service',
    scope: 'workspace',
    criticality: 'optional',
    dependencies: ['workspace', 'file'],
    instance: workspaceSearchService,
    reset: (service) => {
      service.cancelSearch();
      logger.info('Runtime: Active workspace search cancelled on workspace switch');
    },
  });

  // 13. Workspace Index Service (Optional Workspace-Scoped)
  runtime.registerService({
    id: 'workspaceIndex',
    name: 'Workspace Resource Index Service',
    scope: 'workspace',
    criticality: 'optional',
    dependencies: ['workspace'],
    instance: workspaceIndexService,
    reset: (service) => {
      service.clearIndex();
      logger.info('Runtime: Workspace index cleared on workspace switch');
    },
  });

  // 14. Source Control Service (Optional Workspace-Scoped - Depends on Workspace)
  runtime.registerService({
    id: 'sourceControl',
    name: 'Source Control & Git Service',
    scope: 'workspace',
    criticality: 'optional',
    dependencies: ['workspace'],
    instance: sourceControlService,
    initialize: () => {
      logger.info('Runtime: Source Control Service initialized');
    },
    reset: (service) => {
      // Refresh with null to reset working tree status
      service.refresh(null).catch((err) => {
        logger.warn('Error resetting source control state', { error: (err as Error).message });
      });
    },
  });

  // 15. Filesystem Watcher & External Change Reconciliation (Workspace-Scoped)
  runtime.registerService({
    id: 'watcher',
    name: 'Filesystem Watcher & Change Reconciliation Service',
    scope: 'workspace',
    criticality: 'optional',
    dependencies: ['workspaceEngine', 'file'],
    instance: globalFileSystemWatcherService,
    initialize: () => {
      logger.info('Runtime: Filesystem Watcher Service initialized');
    },
    reset: (service) => {
      service.flush();
      logger.info('Runtime: Filesystem Watcher flushed on workspace reset');
    },
    dispose: (service) => {
      service.dispose();
      logger.info('Runtime: Filesystem Watcher disposed');
    },
  });

  // 16. Document History & Undo/Redo Engine (Critical Document Lifecycle)
  runtime.registerService({
    id: 'history',
    name: 'Document History & Undo/Redo Service',
    scope: 'application',
    criticality: 'critical',
    dependencies: ['editTransactionManager'],
    instance: globalDocumentHistoryService,
    initialize: () => {
      logger.info('Runtime: Document History Service initialized');
    },
    dispose: (service) => {
      service.dispose();
      logger.info('Runtime: Document History Service disposed');
    },
  });

  // 17. Diagnostics Model & Aggregation Engine (Critical Document Lifecycle)
  runtime.registerService({
    id: 'diagnostics',
    name: 'Diagnostics & Aggregation Service',
    scope: 'application',
    criticality: 'critical',
    dependencies: [],
    instance: globalDiagnosticService,
    initialize: () => {
      setupTaskProblemsBridge();
      logger.info('Runtime: Diagnostics Service initialized with tasks bridge');
    },
    reset: (service) => {
      service.clear();
      logger.info('Runtime: Diagnostics cleared on workspace switch');
    },
    dispose: (service) => {
      service.dispose();
      logger.info('Runtime: Diagnostics Service disposed');
    },
  });

  // 18. Symbol Infrastructure & Outline Engine (Optional Application-Scoped)
  runtime.registerService({
    id: 'symbols',
    name: 'Symbol Infrastructure & Outline Service',
    scope: 'application',
    criticality: 'optional',
    dependencies: ['workspaceIndex'],
    instance: globalSymbolService,
    initialize: () => {
      logger.info('Runtime: Symbol Service initialized');
    },
    reset: (service) => {
      service.clearCache();
      logger.info('Runtime: Symbol cache cleared on workspace switch');
    },
    dispose: (service) => {
      service.dispose();
      logger.info('Runtime: Symbol Service disposed');
    },
  });
}
