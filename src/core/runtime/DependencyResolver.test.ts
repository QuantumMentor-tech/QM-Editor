import { describe, it, expect } from 'vitest';
import { DependencyResolver } from './DependencyResolver';
import { ServiceRecord } from './RuntimeTypes';
import { DependencyCycleError, MissingDependencyError } from './RuntimeErrors';

describe('DependencyResolver', () => {
  const createRecord = (id: string, dependencies: string[]): [string, ServiceRecord] => [
    id,
    {
      id,
      name: id,
      dependencies,
      scope: 'application',
      criticality: 'critical',
      lifecycleState: 'uninitialized',
    },
  ];

  it('resolves deterministic topological order for linear dependencies', () => {
    const services = new Map<string, ServiceRecord>([
      createRecord('serviceC', ['serviceB']),
      createRecord('serviceB', ['serviceA']),
      createRecord('serviceA', []),
    ]);

    const result = DependencyResolver.resolve(services);
    expect(result.isValid).toBe(true);
    expect(result.order).toEqual(['serviceA', 'serviceB', 'serviceC']);
    expect(result.shutdownOrder).toEqual(['serviceC', 'serviceB', 'serviceA']);
  });

  it('resolves multi-branch DAG dependencies with deterministic tie-breaking', () => {
    // Both B and C depend on A; D depends on B and C
    const services = new Map<string, ServiceRecord>([
      createRecord('D', ['B', 'C']),
      createRecord('C', ['A']),
      createRecord('B', ['A']),
      createRecord('A', []),
    ]);

    const result = DependencyResolver.resolve(services);
    expect(result.isValid).toBe(true);
    expect(result.order).toEqual(['A', 'B', 'C', 'D']);
    expect(result.shutdownOrder).toEqual(['D', 'C', 'B', 'A']);
  });

  it('detects missing dependencies and rejects resolution', () => {
    const services = new Map<string, ServiceRecord>([
      createRecord('app', ['database']),
    ]);

    const result = DependencyResolver.resolve(services);
    expect(result.isValid).toBe(false);
    expect(result.missingDependencies).toEqual([{ serviceId: 'app', missing: 'database' }]);

    expect(() => DependencyResolver.assertValid(services)).toThrowError(MissingDependencyError);
  });

  it('detects circular dependencies and identifies the exact cycle path', () => {
    // A -> B -> C -> A
    const services = new Map<string, ServiceRecord>([
      createRecord('A', ['B']),
      createRecord('B', ['C']),
      createRecord('C', ['A']),
    ]);

    const result = DependencyResolver.resolve(services);
    expect(result.isValid).toBe(false);
    expect(result.cyclePath).toEqual(['A', 'B', 'C', 'A']);

    expect(() => DependencyResolver.assertValid(services)).toThrowError(DependencyCycleError);
  });

  it('detects self-referencing circular dependency', () => {
    const services = new Map<string, ServiceRecord>([
      createRecord('self', ['self']),
    ]);

    const result = DependencyResolver.resolve(services);
    expect(result.isValid).toBe(false);
    expect(result.cyclePath).toEqual(['self', 'self']);
  });
});
