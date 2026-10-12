import { describe, it, expect } from 'vitest';
import {
  extractTypeScriptSymbols,
  extractMarkdownSymbols,
  extractPythonSymbols,
  extractJsonSymbols,
  extractDocumentSymbols,
} from './SymbolExtractors';

describe('SymbolExtractors', () => {
  describe('extractTypeScriptSymbols', () => {
    it('extracts classes, methods, interfaces, and functions', () => {
      const code = `
export class UserService {
  private id: string;

  constructor() {}

  public async fetchUser() {
    return null;
  }
}

export interface UserProfile {
  name: string;
}

export type UserRole = 'admin' | 'user';

export enum UserStatus {
  Active,
}

export function helperFunction() {}

const arrowHandler = async () => {};
const regularVar = 42;
`;

      const symbols = extractTypeScriptSymbols(code);
      const names = symbols.map((s) => s.name);

      expect(names).toContain('UserService');
      expect(names).toContain('UserProfile');
      expect(names).toContain('UserRole');
      expect(names).toContain('UserStatus');
      expect(names).toContain('helperFunction');
      expect(names).toContain('arrowHandler');
      expect(names).toContain('regularVar');

      const userClass = symbols.find((s) => s.name === 'UserService');
      expect(userClass).toBeDefined();
      expect(userClass?.kind).toBe('class');
      expect(userClass?.children?.some((c) => c.name === 'fetchUser')).toBe(true);
      expect(userClass?.children?.some((c) => c.name === 'constructor')).toBe(true);
    });
  });

  describe('extractMarkdownSymbols', () => {
    it('extracts nested headings hierarchy', () => {
      const md = `
# Title
Intro paragraph
## Section 1
Content 1
### Subsection 1.1
Subcontent
## Section 2
Content 2
`;

      const symbols = extractMarkdownSymbols(md);
      expect(symbols.length).toBe(1);
      expect(symbols[0].name).toBe('Title');
      expect(symbols[0].detail).toBe('H1');

      const children = symbols[0].children || [];
      expect(children.length).toBe(2);
      expect(children[0].name).toBe('Section 1');
      expect(children[1].name).toBe('Section 2');

      const subchildren = children[0].children || [];
      expect(subchildren.length).toBe(1);
      expect(subchildren[0].name).toBe('Subsection 1.1');
    });
  });

  describe('extractPythonSymbols', () => {
    it('extracts python functions and classes', () => {
      const py = `
class DataPipeline:
    pass

def process_records(data):
    return data
`;

      const symbols = extractPythonSymbols(py);
      expect(symbols.length).toBe(2);
      expect(symbols[0].name).toBe('DataPipeline');
      expect(symbols[0].kind).toBe('class');
      expect(symbols[1].name).toBe('process_records');
      expect(symbols[1].kind).toBe('function');
    });
  });

  describe('extractJsonSymbols', () => {
    it('extracts top-level json keys', () => {
      const json = `
{
  "name": "qm-editor",
  "version": "0.1.0",
  "scripts": {
    "build": "vite build"
  }
}
`;

      const symbols = extractJsonSymbols(json);
      const names = symbols.map((s) => s.name);
      expect(names).toContain('name');
      expect(names).toContain('version');
      expect(names).toContain('scripts');
    });
  });

  describe('extractDocumentSymbols dispatcher', () => {
    it('dispatches to language extractors accurately', () => {
      const tsSymbols = extractDocumentSymbols('export function foo() {}', 'typescript');
      expect(tsSymbols.length).toBe(1);
      expect(tsSymbols[0].name).toBe('foo');

      const mdSymbols = extractDocumentSymbols('# Header', 'markdown');
      expect(mdSymbols.length).toBe(1);
      expect(mdSymbols[0].name).toBe('Header');

      const empty = extractDocumentSymbols('', 'typescript');
      expect(empty).toEqual([]);
    });
  });
});
