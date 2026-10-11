/**
 * QM Editor Problem Matcher Definitions & Types
 * Phase 1, Step 20 — Tasks, Build, Run & Problem Matcher Foundation
 */

import { ProblemSeverity } from '../TaskTypes';

export interface ProblemPattern {
  regexp: RegExp;
  fileGroup: number;
  lineGroup: number;
  columnGroup?: number;
  severityGroup?: number;
  codeGroup?: number;
  messageGroup: number;
}

export interface ProblemMatcherDefinition {
  name: string;
  owner: string;
  source?: string;
  pattern: ProblemPattern;
  severityFallback?: ProblemSeverity;
}
