/**
 * QM Editor Heuristic Symbol Extractors
 * Phase 04, Step 35 — Symbol Infrastructure, Outline & Symbol Navigation
 */

import { DocumentSymbol, SymbolRange } from './SymbolTypes';

function makeRange(startLine: number, startColumn: number, endLine: number, endColumn: number): SymbolRange {
  return { startLine, startColumn, endLine, endColumn };
}

/**
 * Extracts symbols from TypeScript, JavaScript, TSX, and JSX source text.
 */
export function extractTypeScriptSymbols(content: string): DocumentSymbol[] {
  const symbols: DocumentSymbol[] = [];
  const lines = content.split('\n');

  let currentClass: DocumentSymbol | null = null;
  let currentClassIndent = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      continue;
    }

    const indent = rawLine.search(/\S/);

    // If we've left the class indentation block, close currentClass
    if (currentClass && indent <= currentClassIndent && trimmed === '}') {
      currentClass = null;
      continue;
    }

    // 1. Class: class MyClass
    const classMatch = rawLine.match(/(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z0-9_$]+)/);
    if (classMatch) {
      const name = classMatch[1];
      const startCol = rawLine.indexOf(name) + 1;
      const symbol: DocumentSymbol = {
        name,
        kind: 'class',
        range: makeRange(lineNum, 1, lineNum, rawLine.length + 1),
        selectionRange: makeRange(lineNum, startCol, lineNum, startCol + name.length),
        children: [],
      };
      symbols.push(symbol);
      currentClass = symbol;
      currentClassIndent = indent;
      continue;
    }

    // 2. Interface: interface MyInterface
    const interfaceMatch = rawLine.match(/(?:export\s+)?interface\s+([A-Za-z0-9_$]+)/);
    if (interfaceMatch) {
      const name = interfaceMatch[1];
      const startCol = rawLine.indexOf(name) + 1;
      symbols.push({
        name,
        kind: 'interface',
        range: makeRange(lineNum, 1, lineNum, rawLine.length + 1),
        selectionRange: makeRange(lineNum, startCol, lineNum, startCol + name.length),
      });
      continue;
    }

    // 3. Type alias: type MyType
    const typeMatch = rawLine.match(/(?:export\s+)?type\s+([A-Za-z0-9_$]+)\s*=/);
    if (typeMatch) {
      const name = typeMatch[1];
      const startCol = rawLine.indexOf(name) + 1;
      symbols.push({
        name,
        kind: 'typeParameter',
        range: makeRange(lineNum, 1, lineNum, rawLine.length + 1),
        selectionRange: makeRange(lineNum, startCol, lineNum, startCol + name.length),
      });
      continue;
    }

    // 4. Enum: enum MyEnum
    const enumMatch = rawLine.match(/(?:export\s+)?enum\s+([A-Za-z0-9_$]+)/);
    if (enumMatch) {
      const name = enumMatch[1];
      const startCol = rawLine.indexOf(name) + 1;
      symbols.push({
        name,
        kind: 'enum',
        range: makeRange(lineNum, 1, lineNum, rawLine.length + 1),
        selectionRange: makeRange(lineNum, startCol, lineNum, startCol + name.length),
      });
      continue;
    }

    // 5. Function declaration: function myFunction
    const funcMatch = rawLine.match(/(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z0-9_$]+)/);
    if (funcMatch) {
      const name = funcMatch[1];
      const startCol = rawLine.indexOf(name) + 1;
      symbols.push({
        name,
        kind: 'function',
        range: makeRange(lineNum, 1, lineNum, rawLine.length + 1),
        selectionRange: makeRange(lineNum, startCol, lineNum, startCol + name.length),
      });
      continue;
    }

    // 6. Const / Let / Var function or variable: const myFunc = () =>
    const varMatch = rawLine.match(/(?:export\s+)?(const|let|var)\s+([A-Za-z0-9_$]+)\s*(?::\s*[^=]+)?\s*=\s*(async\s*)?(?:\([^)]*\)|[A-Za-z0-9_$]+)?\s*=>/);
    if (varMatch) {
      const name = varMatch[2];
      const startCol = rawLine.indexOf(name) + 1;
      symbols.push({
        name,
        kind: 'function',
        range: makeRange(lineNum, 1, lineNum, rawLine.length + 1),
        selectionRange: makeRange(lineNum, startCol, lineNum, startCol + name.length),
      });
      continue;
    }

    const constMatch = rawLine.match(/(?:export\s+)?(const|let|var)\s+([A-Za-z0-9_$]+)/);
    if (constMatch) {
      const keyword = constMatch[1];
      const name = constMatch[2];
      const startCol = rawLine.indexOf(name) + 1;
      symbols.push({
        name,
        kind: keyword === 'const' ? 'constant' : 'variable',
        range: makeRange(lineNum, 1, lineNum, rawLine.length + 1),
        selectionRange: makeRange(lineNum, startCol, lineNum, startCol + name.length),
      });
      continue;
    }

    // 7. Method inside class: methodName(...)
    if (currentClass) {
      const methodMatch = rawLine.match(
        /^\s*(?:(?:public|private|protected|static|async|\*)\s+)*([A-Za-z0-9_$]+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/
      );
      if (methodMatch) {
        const name = methodMatch[1];
        if (name !== 'if' && name !== 'for' && name !== 'while' && name !== 'switch' && name !== 'catch') {
          const startCol = rawLine.indexOf(name) + 1;
          const methodSym: DocumentSymbol = {
            name,
            kind: name === 'constructor' ? 'constructor' : 'method',
            containerName: currentClass.name,
            range: makeRange(lineNum, 1, lineNum, rawLine.length + 1),
            selectionRange: makeRange(lineNum, startCol, lineNum, startCol + name.length),
          };
          currentClass.children?.push(methodSym);
          continue;
        }
      }
    }
  }

  return symbols;
}

/**
 * Extracts hierarchical headings from Markdown documents.
 */
export function extractMarkdownSymbols(content: string): DocumentSymbol[] {
  const rootSymbols: DocumentSymbol[] = [];
  const stack: { level: number; symbol: DocumentSymbol }[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];
    const match = line.match(/^(#{1,6})\s+(.+)$/);

    if (match) {
      const level = match[1].length;
      const name = match[2].trim();
      const startCol = line.indexOf(name) + 1;

      const symbol: DocumentSymbol = {
        name,
        kind: 'heading',
        detail: `H${level}`,
        range: makeRange(lineNum, 1, lineNum, line.length + 1),
        selectionRange: makeRange(lineNum, startCol, lineNum, startCol + name.length),
        children: [],
      };

      // Find appropriate parent in stack
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      if (stack.length === 0) {
        rootSymbols.push(symbol);
      } else {
        stack[stack.length - 1].symbol.children?.push(symbol);
      }

      stack.push({ level, symbol });
    }
  }

  return rootSymbols;
}

/**
 * Extracts functions and classes from Python documents.
 */
export function extractPythonSymbols(content: string): DocumentSymbol[] {
  const symbols: DocumentSymbol[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const rawLine = lines[i];

    const defMatch = rawLine.match(/^\s*def\s+([A-Za-z0-9_]+)\s*\(/);
    if (defMatch) {
      const name = defMatch[1];
      const startCol = rawLine.indexOf(name) + 1;
      symbols.push({
        name,
        kind: 'function',
        range: makeRange(lineNum, 1, lineNum, rawLine.length + 1),
        selectionRange: makeRange(lineNum, startCol, lineNum, startCol + name.length),
      });
      continue;
    }

    const classMatch = rawLine.match(/^\s*class\s+([A-Za-z0-9_]+)/);
    if (classMatch) {
      const name = classMatch[1];
      const startCol = rawLine.indexOf(name) + 1;
      symbols.push({
        name,
        kind: 'class',
        range: makeRange(lineNum, 1, lineNum, rawLine.length + 1),
        selectionRange: makeRange(lineNum, startCol, lineNum, startCol + name.length),
      });
      continue;
    }
  }

  return symbols;
}

/**
 * Extracts top-level keys from JSON documents.
 */
export function extractJsonSymbols(content: string): DocumentSymbol[] {
  const symbols: DocumentSymbol[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const rawLine = lines[i];
    const match = rawLine.match(/^\s*"([^"]+)"\s*:/);

    if (match) {
      const name = match[1];
      const startCol = rawLine.indexOf(name) + 1;
      symbols.push({
        name,
        kind: 'key',
        range: makeRange(lineNum, 1, lineNum, rawLine.length + 1),
        selectionRange: makeRange(lineNum, startCol, lineNum, startCol + name.length),
      });
    }
  }

  return symbols;
}

/**
 * Dispatches to language-specific extractor or fallback.
 */
export function extractDocumentSymbols(content: string, languageId: string): DocumentSymbol[] {
  if (!content || !content.trim()) {
    return [];
  }

  const lang = languageId.toLowerCase();

  if (lang === 'typescript' || lang === 'javascript' || lang === 'typescriptreact' || lang === 'javascriptreact') {
    return extractTypeScriptSymbols(content);
  }

  if (lang === 'markdown' || lang === 'md') {
    return extractMarkdownSymbols(content);
  }

  if (lang === 'python' || lang === 'py') {
    return extractPythonSymbols(content);
  }

  if (lang === 'json' || lang === 'jsonc') {
    return extractJsonSymbols(content);
  }

  // Fallback heuristic: check for functions or classes
  const tsCandidate = extractTypeScriptSymbols(content);
  if (tsCandidate.length > 0) {
    return tsCandidate;
  }

  return [];
}
