import { describe, it, expect } from 'vitest';
import { ProblemParser } from './ProblemParser';

describe('ProblemParser', () => {
  it('parses TypeScript compiler errors correctly in parenthesis format', () => {
    const parser = new ProblemParser('$tsc', 'task-build', '/workspace');
    const line = 'src/components/App.tsx(42,12): error TS2322: Type "string" is not assignable to type "number".';
    const problem = parser.parseLine(line);

    expect(problem).not.toBeNull();
    expect(problem?.file).toBe('src/components/App.tsx');
    expect(problem?.line).toBe(42);
    expect(problem?.column).toBe(12);
    expect(problem?.severity).toBe('error');
    expect(problem?.code).toBe('TS2322');
    expect(problem?.message).toContain('Type "string" is not assignable');
  });

  it('parses TypeScript compiler errors in colon format', () => {
    const parser = new ProblemParser('$tsc', 'task-build', '/workspace');
    const line = 'src/index.ts:15:3 - error TS1005: ";" expected.';
    const problem = parser.parseLine(line);

    expect(problem).not.toBeNull();
    expect(problem?.file).toBe('src/index.ts');
    expect(problem?.line).toBe(15);
    expect(problem?.column).toBe(3);
    expect(problem?.severity).toBe('error');
    expect(problem?.code).toBe('TS1005');
  });

  it('parses ESLint errors and warnings', () => {
    const parser = new ProblemParser('$eslint', 'task-lint', '/workspace');
    const line = 'src/utils.ts:10:5: warning: Unexpected console statement [no-console]';
    const problem = parser.parseLine(line);

    expect(problem).not.toBeNull();
    expect(problem?.file).toBe('src/utils.ts');
    expect(problem?.line).toBe(10);
    expect(problem?.column).toBe(5);
    expect(problem?.severity).toBe('warning');
    expect(problem?.code).toBe('no-console');
  });

  it('parses General compiler errors (GCC/Clang)', () => {
    const parser = new ProblemParser('$general', 'task-c', '/workspace');
    const line = 'main.c:18:4: error: unknown type name "size_t"';
    const problem = parser.parseLine(line);

    expect(problem).not.toBeNull();
    expect(problem?.file).toBe('main.c');
    expect(problem?.line).toBe(18);
    expect(problem?.column).toBe(4);
    expect(problem?.severity).toBe('error');
    expect(problem?.message).toBe('unknown type name "size_t"');
  });

  it('parses MSBuild / DotNet errors', () => {
    const parser = new ProblemParser('$dotnet', 'task-dotnet', '/workspace');
    const line = 'Program.cs(50,20): error CS0103: The name "ctx" does not exist in the current context';
    const problem = parser.parseLine(line);

    expect(problem).not.toBeNull();
    expect(problem?.file).toBe('Program.cs');
    expect(problem?.line).toBe(50);
    expect(problem?.column).toBe(20);
    expect(problem?.severity).toBe('error');
    expect(problem?.code).toBe('CS0103');
  });

  it('deduplicates identical problem lines', () => {
    const parser = new ProblemParser('$tsc', 'task-build', '/workspace');
    const line = 'src/test.ts:1:1 - error TS2304: Cannot find name "abc".';
    const p1 = parser.parseLine(line);
    const p2 = parser.parseLine(line);

    expect(p1).not.toBeNull();
    expect(p2).toBeNull();
    expect(parser.getProblems().length).toBe(1);
  });

  it('gracefully ignores malformed or non-diagnostic lines', () => {
    const parser = new ProblemParser('$tsc', 'task-build', '/workspace');
    expect(parser.parseLine('Starting compilation...')).toBeNull();
    expect(parser.parseLine('Compilation complete with 1 error.')).toBeNull();
    expect(parser.parseLine('')).toBeNull();
  });
});
