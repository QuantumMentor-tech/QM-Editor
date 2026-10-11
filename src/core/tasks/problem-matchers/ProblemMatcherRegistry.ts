/**
 * QM Editor Built-in Problem Matcher Registry
 * Phase 1, Step 20 — Tasks, Build, Run & Problem Matcher Foundation
 */

import { ProblemMatcherDefinition } from './ProblemMatcherTypes';

export class ProblemMatcherRegistry {
  private static instance: ProblemMatcherRegistry;
  private matchers: Map<string, ProblemMatcherDefinition> = new Map();

  private constructor() {
    this.registerBuiltIns();
  }

  public static getInstance(): ProblemMatcherRegistry {
    if (!ProblemMatcherRegistry.instance) {
      ProblemMatcherRegistry.instance = new ProblemMatcherRegistry();
    }
    return ProblemMatcherRegistry.instance;
  }

  public register(definition: ProblemMatcherDefinition): void {
    this.matchers.set(definition.name, definition);
  }

  public get(name: string): ProblemMatcherDefinition | undefined {
    return this.matchers.get(name);
  }

  public getAll(): ProblemMatcherDefinition[] {
    return Array.from(this.matchers.values());
  }

  private registerBuiltIns(): void {
    // 1. TypeScript Compiler ($tsc)
    // Matches: src/App.tsx(14,5): error TS2322: Type 'string' is not assignable...
    // Also matches: src/App.tsx:14:5 - error TS2322: Type 'string'...
    this.register({
      name: '$tsc',
      owner: 'typescript',
      source: 'tsc',
      pattern: {
        regexp: /^([^\s(:]+)(?:(?:\((\d+),(\d+)\))|(?::(\d+):(\d+)(?:\s*-\s*|\s+)))(?:(?:error|warning|info)\s+)?(TS\d+)?:?\s*(error|warning|info)?:?\s*(.*)$/i,
        fileGroup: 1,
        lineGroup: 2, // handled dynamically in parser for either parentheses or colon format
        columnGroup: 3,
        severityGroup: 7,
        codeGroup: 6,
        messageGroup: 8,
      },
      severityFallback: 'error',
    });

    // 2. ESLint ($eslint)
    // Matches: src/App.tsx:14:5: error: 'unused' is defined [no-unused-vars]
    // or: src/App.tsx:14:5: Unexpected token (error)
    this.register({
      name: '$eslint',
      owner: 'eslint',
      source: 'eslint',
      pattern: {
        regexp: /^([^\s:]+):(\d+):(\d+):\s*(?:(error|warning|info):\s*)?(.*?)(?:\s+\[(.*?)\])?$/i,
        fileGroup: 1,
        lineGroup: 2,
        columnGroup: 3,
        severityGroup: 4,
        codeGroup: 6,
        messageGroup: 5,
      },
      severityFallback: 'warning',
    });

    // 3. General compiler / GCC / Clang / Python ($general)
    // Matches: src/main.c:42:15: error: expected ';' before 'return'
    this.register({
      name: '$general',
      owner: 'compiler',
      source: 'build',
      pattern: {
        regexp: /^([^\s:]+):(\d+)(?::(\d+))?:\s*(?:(error|warning|info|note):\s*)?(.*)$/i,
        fileGroup: 1,
        lineGroup: 2,
        columnGroup: 3,
        severityGroup: 4,
        messageGroup: 5,
      },
      severityFallback: 'error',
    });

    // 4. DotNet / MSBuild ($dotnet)
    // Matches: Program.cs(12,9): error CS0103: The name 'x' does not exist in the current context
    this.register({
      name: '$dotnet',
      owner: 'msbuild',
      source: 'dotnet',
      pattern: {
        regexp: /^([^\s(]+)\((\d+),(\d+)\):\s*(error|warning|info)\s+([A-Z0-9]+):\s*(.*)$/i,
        fileGroup: 1,
        lineGroup: 2,
        columnGroup: 3,
        severityGroup: 4,
        codeGroup: 5,
        messageGroup: 6,
      },
      severityFallback: 'error',
    });
  }
}

export const problemMatcherRegistry = ProblemMatcherRegistry.getInstance();
