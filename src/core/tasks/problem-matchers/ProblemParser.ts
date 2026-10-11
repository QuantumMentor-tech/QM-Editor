/**
 * QM Editor Problem Parser
 * Phase 1, Step 20 — Tasks, Build, Run & Problem Matcher Foundation
 */

import { Problem, ProblemSeverity } from '../TaskTypes';
import { ProblemMatcherDefinition } from './ProblemMatcherTypes';
import { problemMatcherRegistry } from './ProblemMatcherRegistry';

const MAX_PARSED_LINE_LENGTH = 2048;
const MAX_PROBLEMS_PER_SESSION = 1000;
const ANSI_REGEX = /\x1b\[[0-9;]*[a-zA-Z]/g;

export class ProblemParser {
  private deduplicationSet: Set<string> = new Set();
  private collectedProblems: Problem[] = [];
  private matchers: ProblemMatcherDefinition[] = [];
  private cwd: string;
  private taskId: string;
  private workspaceId?: string;

  constructor(
    matcherNames: string[] | string | undefined,
    taskId: string,
    cwd: string = '',
    workspaceId?: string
  ) {
    this.taskId = taskId;
    this.cwd = cwd;
    this.workspaceId = workspaceId;

    const names = Array.isArray(matcherNames)
      ? matcherNames
      : matcherNames
        ? [matcherNames]
        : ['$general', '$tsc', '$eslint'];

    for (const name of names) {
      const matcher = problemMatcherRegistry.get(name);
      if (matcher) {
        this.matchers.push(matcher);
      }
    }
  }

  public parseLine(rawLine: string): Problem | null {
    if (!rawLine || rawLine.length > MAX_PARSED_LINE_LENGTH) {
      return null;
    }

    if (this.collectedProblems.length >= MAX_PROBLEMS_PER_SESSION) {
      return null;
    }

    // Clean ANSI codes and trim carriage return
    const cleanLine = rawLine.replace(ANSI_REGEX, '').replace(/\r$/, '').trim();
    if (!cleanLine) return null;

    for (const matcher of this.matchers) {
      try {
        const problem = this.testMatcher(cleanLine, matcher);
        if (problem) {
          const key = `${problem.taskId}:${problem.file}:${problem.line}:${problem.column}:${problem.code || ''}:${problem.message}`;
          if (!this.deduplicationSet.has(key)) {
            this.deduplicationSet.add(key);
            this.collectedProblems.push(problem);
            return problem;
          }
        }
      } catch {
        // Tolerant to malformed regex or unexpected group indices
        continue;
      }
    }

    return null;
  }

  public getProblems(): Problem[] {
    return [...this.collectedProblems];
  }

  public clear(): void {
    this.deduplicationSet.clear();
    this.collectedProblems = [];
  }

  private testMatcher(line: string, matcher: ProblemMatcherDefinition): Problem | null {
    // Custom handling for $tsc format differences (supports both file(line,col) and file:line:col)
    if (matcher.name === '$tsc') {
      const matchParen = /^([^\s(:]+)\((\d+),(\d+)\):\s*(?:(error|warning|info)\s+)?(TS\d+)?:\s*(.*)$/i.exec(line);
      if (matchParen) {
        return this.buildProblem(
          matchParen[1],
          parseInt(matchParen[2], 10),
          parseInt(matchParen[3], 10),
          matchParen[4],
          matchParen[5],
          matchParen[6],
          matcher
        );
      }

      const matchColon = /^([^\s:]+):(\d+):(\d+)\s*-\s*(error|warning|info)\s+(TS\d+)?:\s*(.*)$/i.exec(line);
      if (matchColon) {
        return this.buildProblem(
          matchColon[1],
          parseInt(matchColon[2], 10),
          parseInt(matchColon[3], 10),
          matchColon[4],
          matchColon[5],
          matchColon[6],
          matcher
        );
      }
    }

    const match = matcher.pattern.regexp.exec(line);
    if (!match) return null;

    const file = match[matcher.pattern.fileGroup];
    const lineNum = parseInt(match[matcher.pattern.lineGroup], 10);
    const colNum = matcher.pattern.columnGroup && match[matcher.pattern.columnGroup]
      ? parseInt(match[matcher.pattern.columnGroup], 10)
      : 1;

    const rawSeverity = matcher.pattern.severityGroup ? match[matcher.pattern.severityGroup] : undefined;
    const code = matcher.pattern.codeGroup ? match[matcher.pattern.codeGroup] : undefined;
    const message = match[matcher.pattern.messageGroup];

    return this.buildProblem(file, lineNum, colNum, rawSeverity, code, message, matcher);
  }

  private buildProblem(
    rawFile: string,
    line: number,
    column: number,
    rawSeverity: string | undefined,
    code: string | undefined,
    rawMessage: string,
    matcher: ProblemMatcherDefinition
  ): Problem | null {
    if (!rawFile || isNaN(line) || line < 1) return null;

    const validCol = isNaN(column) || column < 1 ? 1 : column;
    const severity = this.normalizeSeverity(rawSeverity, matcher.severityFallback);
    const message = (rawMessage || 'Diagnostic reported').trim();
    const normalizedFile = this.normalizeFilePath(rawFile.trim());

    return {
      id: `prob-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      source: matcher.source || matcher.owner,
      severity,
      message,
      file: normalizedFile,
      line,
      column: validCol,
      code: code ? code.trim() : undefined,
      taskId: this.taskId,
      workspaceId: this.workspaceId,
    };
  }

  private normalizeSeverity(raw?: string, fallback: ProblemSeverity = 'error'): ProblemSeverity {
    if (!raw) return fallback;
    const lower = raw.toLowerCase();
    if (lower.includes('error')) return 'error';
    if (lower.includes('warn')) return 'warning';
    if (lower.includes('info') || lower.includes('note')) return 'info';
    if (lower.includes('hint')) return 'hint';
    return fallback;
  }

  private normalizeFilePath(filePath: string): string {
    let clean = filePath.replace(/\\/g, '/');
    if (clean.startsWith('./')) {
      clean = clean.substring(2);
    }
    if (this.cwd && !clean.startsWith('/') && !clean.includes(':')) {
      const normalizedCwd = this.cwd.replace(/\\/g, '/').replace(/\/$/, '');
      if (normalizedCwd && !clean.startsWith(normalizedCwd)) {
        // Path is relative to cwd
        return clean;
      }
    }
    return clean;
  }
}
