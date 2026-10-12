/**
 * QM Editor Application Runtime Errors
 * Phase 04, Step 29 — Core Application Runtime, Service Lifecycle & Dependency Orchestration
 */

export class RuntimeError extends Error {
  public readonly code: string;
  public readonly timestamp: number;

  constructor(message: string, code: string = 'ERR_RUNTIME') {
    super(message);
    this.name = 'RuntimeError';
    this.code = code;
    this.timestamp = Date.now();
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ServiceNotFoundError extends RuntimeError {
  public readonly serviceId: string;

  constructor(serviceId: string) {
    super(`Requested service "${serviceId}" was not found in the runtime registry.`, 'ERR_SERVICE_NOT_FOUND');
    this.name = 'ServiceNotFoundError';
    this.serviceId = serviceId;
  }
}

export class DuplicateServiceError extends RuntimeError {
  public readonly serviceId: string;

  constructor(serviceId: string) {
    super(`Service with identifier "${serviceId}" is already registered. Duplicate registration rejected.`, 'ERR_DUPLICATE_SERVICE');
    this.name = 'DuplicateServiceError';
    this.serviceId = serviceId;
  }
}

export class DependencyCycleError extends RuntimeError {
  public readonly cyclePath: string[];

  constructor(cyclePath: string[]) {
    super(`Circular service dependency detected: ${cyclePath.join(' -> ')}`, 'ERR_DEPENDENCY_CYCLE');
    this.name = 'DependencyCycleError';
    this.cyclePath = cyclePath;
  }
}

export class MissingDependencyError extends RuntimeError {
  public readonly serviceId: string;
  public readonly missingDependency: string;

  constructor(serviceId: string, missingDependency: string) {
    super(`Service "${serviceId}" depends on missing service "${missingDependency}".`, 'ERR_MISSING_DEPENDENCY');
    this.name = 'MissingDependencyError';
    this.serviceId = serviceId;
    this.missingDependency = missingDependency;
  }
}

export class ServiceInitializationError extends RuntimeError {
  public readonly serviceId: string;
  public readonly criticality: 'critical' | 'optional';
  public readonly originalError?: unknown;

  constructor(serviceId: string, criticality: 'critical' | 'optional', originalError?: unknown) {
    const errorMsg = originalError instanceof Error ? originalError.message : String(originalError);
    super(`Failed to initialize ${criticality} service "${serviceId}": ${errorMsg}`, 'ERR_SERVICE_INIT');
    this.name = 'ServiceInitializationError';
    this.serviceId = serviceId;
    this.criticality = criticality;
    this.originalError = originalError;
  }
}

export class InvalidLifecycleTransitionError extends RuntimeError {
  public readonly current: string;
  public readonly target: string;

  constructor(current: string, target: string) {
    super(`Invalid runtime lifecycle transition: cannot move from "${current}" to "${target}".`, 'ERR_INVALID_TRANSITION');
    this.name = 'InvalidLifecycleTransitionError';
    this.current = current;
    this.target = target;
  }
}

export class StartupCancelledError extends RuntimeError {
  constructor(reason: string = 'Application startup cancelled.') {
    super(reason, 'ERR_STARTUP_CANCELLED');
    this.name = 'StartupCancelledError';
  }
}

export class ShutdownTimeoutError extends RuntimeError {
  public readonly hangingServices: string[];

  constructor(hangingServices: string[]) {
    super(`Application shutdown exceeded safe timeout. Hanging services: ${hangingServices.join(', ')}`, 'ERR_SHUTDOWN_TIMEOUT');
    this.name = 'ShutdownTimeoutError';
    this.hangingServices = hangingServices;
  }
}
