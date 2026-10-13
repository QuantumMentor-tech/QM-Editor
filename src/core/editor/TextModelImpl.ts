/**
 * QM Editor Canonical Text Model Implementation
 * Phase 04, Step 37 — Core Application Engine
 */

import { TextModel, Position, OffsetRange } from './EditorTypes';
import { DocumentRecord } from '../documents/DocumentTypes';
import { InvalidEditRangeError } from './EditorErrors';

export class TextModelImpl implements TextModel {
  constructor(private documentRecord: DocumentRecord) {}

  public get documentId(): string {
    return this.documentRecord.id;
  }

  public get resourceUri(): string {
    return this.documentRecord.resourceUri;
  }

  public get revision(): number {
    return this.documentRecord.contentRevision;
  }

  public get isReadOnly(): boolean {
    return this.documentRecord.metadata.isReadOnly;
  }

  public getText(): string {
    return this.documentRecord.content;
  }

  public getLineCount(): number {
    const text = this.documentRecord.content;
    if (text.length === 0) return 1;
    let count = 1;
    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) === 10) {
        count++;
      }
    }
    return count;
  }

  public getLineContent(lineNumber: number): string {
    const lines = this.documentRecord.content.split('\n');
    if (lineNumber < 1 || lineNumber > lines.length) {
      return '';
    }
    return lines[lineNumber - 1];
  }

  public getLineLength(lineNumber: number): string['length'] {
    return this.getLineContent(lineNumber).length;
  }

  public positionToOffset(pos: Position): number {
    const text = this.documentRecord.content;
    const targetLine = Math.max(1, pos.line);
    let currentLine = 1;
    let offset = 0;

    while (currentLine < targetLine && offset < text.length) {
      if (text.charCodeAt(offset) === 10) {
        currentLine++;
      }
      offset++;
    }

    const colOffset = Math.max(0, pos.column - 1);
    return Math.min(offset + colOffset, text.length);
  }

  public offsetToPosition(offset: number): Position {
    const text = this.documentRecord.content;
    const safeOffset = Math.max(0, Math.min(offset, text.length));

    let line = 1;
    let col = 1;

    for (let i = 0; i < safeOffset; i++) {
      if (text.charCodeAt(i) === 10) {
        line++;
        col = 1;
      } else {
        col++;
      }
    }

    return { line, column: col };
  }

  public validateOffsetRange(range: OffsetRange): OffsetRange {
    const maxLen = this.documentRecord.content.length;
    if (range.from < 0 || range.to > maxLen || range.from > range.to) {
      throw new InvalidEditRangeError(range.from, range.to, maxLen);
    }
    return { from: range.from, to: range.to };
  }
}
