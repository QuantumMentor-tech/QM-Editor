/**
 * QM Editor Diagnostic Adapter & Bridge Utilities
 * Phase 04, Step 34 — Core Engine Diagnostics Model, Aggregation & Editor Integration
 */

import { Problem, ProblemSeverity } from '../tasks/TaskTypes';
import { Diagnostic, DiagnosticSeverity } from './DiagnosticTypes';
import { globalDiagnosticService } from './DiagnosticService';
import { taskService } from '../tasks/TaskService';

/**
 * Converts a legacy/task Problem into a canonical Diagnostic.
 */
export function problemToDiagnostic(problem: Problem): Diagnostic {
  return {
    id: problem.id,
    uri: problem.file,
    range: {
      startLine: problem.line,
      startColumn: problem.column,
      endLine: problem.endLine ?? problem.line,
      endColumn: problem.endColumn ?? problem.column,
    },
    severity: problem.severity as DiagnosticSeverity,
    message: problem.message,
    source: problem.source || 'tasks',
    code: problem.code,
    data: {
      taskId: problem.taskId,
      workspaceId: problem.workspaceId,
    },
    createdAt: Date.now(),
  };
}

/**
 * Converts a canonical Diagnostic into a Problem format for components expecting Problems.
 */
export function diagnosticToProblem(diagnostic: Diagnostic): Problem {
  return {
    id: diagnostic.id,
    source: diagnostic.source,
    severity: diagnostic.severity as ProblemSeverity,
    message: diagnostic.message,
    file: diagnostic.uri,
    line: diagnostic.range.startLine,
    column: diagnostic.range.startColumn,
    endLine: diagnostic.range.endLine,
    endColumn: diagnostic.range.endColumn,
    code: diagnostic.code !== undefined ? String(diagnostic.code) : undefined,
    taskId: (diagnostic.data as any)?.taskId || 'diagnostic',
    workspaceId: (diagnostic.data as any)?.workspaceId,
  };
}

/**
 * Bridges TaskService problem updates to the canonical DiagnosticService under the 'tasks' collection.
 */
export function setupTaskProblemsBridge(): () => void {
  const collection = globalDiagnosticService.createCollection('tasks');

  const sync = () => {
    const problems = taskService.getAllProblems();
    // Group problems by file/URI
    const byFile = new Map<string, Problem[]>();
    for (const prob of problems) {
      const file = prob.file;
      if (!byFile.has(file)) {
        byFile.set(file, []);
      }
      byFile.get(file)!.push(prob);
    }

    // Set diagnostics per file
    collection.clear();
    for (const [file, fileProblems] of byFile.entries()) {
      collection.set(
        file,
        fileProblems.map((p) => problemToDiagnostic(p))
      );
    }
  };

  // Perform initial sync
  sync();

  // Subscribe to task updates
  const unsubscribe = taskService.subscribe(sync);

  return () => {
    unsubscribe();
    collection.dispose();
  };
}
