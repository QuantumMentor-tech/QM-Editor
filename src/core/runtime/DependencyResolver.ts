/**
 * QM Editor Dependency Resolver & Topological Sorter
 * Phase 04, Step 29 — Core Application Runtime, Service Lifecycle & Dependency Orchestration
 */

import { ServiceRecord } from './RuntimeTypes';
import { DependencyCycleError, MissingDependencyError } from './RuntimeErrors';

export interface DependencyValidationResult {
  isValid: boolean;
  order: string[];
  shutdownOrder: string[];
  missingDependencies: { serviceId: string; missing: string }[];
  cyclePath: string[] | null;
  errors: string[];
}

export class DependencyResolver {
  /**
   * Validates and resolves dependency ordering for the provided service map.
   * Produces a deterministic topological startup order and reverse shutdown order.
   */
  public static resolve(services: Map<string, ServiceRecord>): DependencyValidationResult {
    const missingDependencies: { serviceId: string; missing: string }[] = [];
    const errors: string[] = [];

    // 1. Validate that all referenced dependencies exist
    for (const [id, record] of services.entries()) {
      for (const depId of record.dependencies) {
        if (!services.has(depId)) {
          missingDependencies.push({ serviceId: id, missing: depId });
          errors.push(`Service "${id}" depends on unregistered service "${depId}".`);
        }
      }
    }

    if (missingDependencies.length > 0) {
      return {
        isValid: false,
        order: [],
        shutdownOrder: [],
        missingDependencies,
        cyclePath: null,
        errors,
      };
    }

    // 2. Deterministic cycle detection using DFS with path recursion stack
    // Visit states: 0 = unvisited, 1 = visiting (in recursion stack), 2 = visited
    const visitState = new Map<string, number>();
    const pathStack: string[] = [];
    let detectedCyclePath: string[] | null = null;

    // Sort service IDs alphabetically for reproducible traversal
    const sortedIds = Array.from(services.keys()).sort();

    const dfsCycle = (currentId: string): boolean => {
      visitState.set(currentId, 1); // visiting
      pathStack.push(currentId);

      const record = services.get(currentId);
      if (record) {
        // Sort dependencies alphabetically for deterministic order
        const sortedDeps = [...record.dependencies].sort();
        for (const depId of sortedDeps) {
          const state = visitState.get(depId) || 0;
          if (state === 1) {
            // Cycle detected! Extract cycle path from pathStack
            const cycleStartIdx = pathStack.indexOf(depId);
            detectedCyclePath = [...pathStack.slice(cycleStartIdx), depId];
            return true;
          }
          if (state === 0) {
            if (dfsCycle(depId)) {
              return true;
            }
          }
        }
      }

      pathStack.pop();
      visitState.set(currentId, 2); // visited
      return false;
    };

    for (const id of sortedIds) {
      if ((visitState.get(id) || 0) === 0) {
        if (dfsCycle(id)) {
          return {
            isValid: false,
            order: [],
            shutdownOrder: [],
            missingDependencies: [],
            cyclePath: detectedCyclePath,
            errors: [
              `Circular dependency detected: ${detectedCyclePath ? (detectedCyclePath as string[]).join(' -> ') : 'unknown'}`,
            ],
          };
        }
      }
    }

    // 3. Topological sort using Kahn's algorithm or post-order DFS
    // Here we use in-degree calculation with alphabetical tie-breaking for determinism
    // If B depends on A, edge is A -> B (A must initialize before B)
    const inDegree = new Map<string, number>();
    const dependentsMap = new Map<string, string[]>(); // dep -> list of services that depend on dep

    for (const id of sortedIds) {
      inDegree.set(id, 0);
      dependentsMap.set(id, []);
    }

    for (const [id, record] of services.entries()) {
      inDegree.set(id, record.dependencies.length);
      for (const depId of record.dependencies) {
        dependentsMap.get(depId)?.push(id);
      }
    }

    // Queue nodes with 0 in-degree (no prerequisites)
    const queue: string[] = sortedIds.filter((id) => (inDegree.get(id) || 0) === 0);
    const order: string[] = [];

    while (queue.length > 0) {
      // Sort queue for determinism at each level
      queue.sort();
      const current = queue.shift()!;
      order.push(current);

      const dependents = dependentsMap.get(current) || [];
      for (const dep of dependents) {
        const newDegree = (inDegree.get(dep) || 0) - 1;
        inDegree.set(dep, newDegree);
        if (newDegree === 0) {
          queue.push(dep);
        }
      }
    }

    if (order.length !== services.size) {
      // Fallback cycle check
      const remaining = sortedIds.filter((id) => !order.includes(id));
      return {
        isValid: false,
        order: [],
        shutdownOrder: [],
        missingDependencies: [],
        cyclePath: remaining,
        errors: [`Unresolved dependencies for services: ${remaining.join(', ')}`],
      };
    }

    const shutdownOrder = [...order].reverse();

    return {
      isValid: true,
      order,
      shutdownOrder,
      missingDependencies: [],
      cyclePath: null,
      errors: [],
    };
  }

  /**
   * Asserts that dependency resolution succeeds, throwing a structured RuntimeError if invalid.
   */
  public static assertValid(services: Map<string, ServiceRecord>): {
    order: string[];
    shutdownOrder: string[];
  } {
    const res = this.resolve(services);
    if (!res.isValid) {
      if (res.missingDependencies.length > 0) {
        const first = res.missingDependencies[0];
        throw new MissingDependencyError(first.serviceId, first.missing);
      }
      if (res.cyclePath) {
        throw new DependencyCycleError(res.cyclePath);
      }
      throw new Error(res.errors[0] || 'Invalid service dependency graph.');
    }
    return { order: res.order, shutdownOrder: res.shutdownOrder };
  }
}
