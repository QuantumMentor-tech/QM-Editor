import { LanguageDefinition } from '../types';
import { QMEditorError, ErrorCode } from '../utils/errors';

export const DEFAULT_PLAIN_TEXT_LANGUAGE: LanguageDefinition = {
  id: 'plaintext',
  displayName: 'Plain Text',
  aliases: ['text', 'txt'],
  extensions: ['txt', 'text'],
};

export const BUILTIN_LANGUAGES: LanguageDefinition[] = [
  DEFAULT_PLAIN_TEXT_LANGUAGE,
  {
    id: 'typescript',
    displayName: 'TypeScript',
    aliases: ['ts', 'tsx'],
    extensions: ['ts', 'tsx'],
    filenames: ['tsconfig.json'],
  },
  {
    id: 'javascript',
    displayName: 'JavaScript',
    aliases: ['js', 'jsx'],
    extensions: ['js', 'jsx', 'mjs', 'cjs'],
    filenames: ['package.json'],
  },
  {
    id: 'json',
    displayName: 'JSON',
    aliases: ['json'],
    extensions: ['json', 'jsonc'],
    filenames: ['.eslintrc', '.prettierrc'],
  },
  {
    id: 'markdown',
    displayName: 'Markdown',
    aliases: ['md'],
    extensions: ['md', 'markdown'],
    filenames: ['README.md', 'CHANGELOG.md'],
  },
  {
    id: 'html',
    displayName: 'HTML',
    aliases: ['html'],
    extensions: ['html', 'htm'],
  },
  {
    id: 'css',
    displayName: 'CSS',
    aliases: ['css'],
    extensions: ['css'],
  },
  {
    id: 'python',
    displayName: 'Python',
    aliases: ['py'],
    extensions: ['py', 'pyw'],
  },
  {
    id: 'cpp',
    displayName: 'C++ / C',
    aliases: ['cpp', 'c'],
    extensions: ['cpp', 'c', 'h', 'hpp'],
  },
  {
    id: 'rust',
    displayName: 'Rust',
    aliases: ['rs'],
    extensions: ['rs'],
    filenames: ['Cargo.toml'],
  },
  {
    id: 'sql',
    displayName: 'SQL',
    aliases: ['sql'],
    extensions: ['sql'],
  },
  {
    id: 'shell',
    displayName: 'Shell Script',
    aliases: ['sh', 'bash'],
    extensions: ['sh', 'bash', 'zsh'],
    filenames: ['Dockerfile', 'Makefile', '.gitignore', '.env'],
  },
  {
    id: 'xml',
    displayName: 'XML / SVG',
    aliases: ['xml'],
    extensions: ['xml', 'svg'],
  },
  {
    id: 'yaml',
    displayName: 'YAML',
    aliases: ['yml'],
    extensions: ['yaml', 'yml'],
  },
];

export class LanguageRegistry {
  private languages: Map<string, LanguageDefinition> = new Map();
  private extensionMap: Map<string, string> = new Map();
  private filenameMap: Map<string, string> = new Map();

  constructor(initialLanguages: LanguageDefinition[] = BUILTIN_LANGUAGES) {
    initialLanguages.forEach((lang) => this.registerLanguage(lang));
  }

  public registerLanguage(def: LanguageDefinition): void {
    if (!def.id || def.id.trim() === '') {
      throw new QMEditorError('Language ID cannot be empty', ErrorCode.DOCUMENT_VALIDATION_ERROR, 'warning');
    }

    const normalizedId = def.id.toLowerCase();
    this.languages.set(normalizedId, def);

    // Register extension mappings
    def.extensions.forEach((ext) => {
      const normalizedExt = ext.toLowerCase().replace(/^\./, '');
      this.extensionMap.set(normalizedExt, normalizedId);
    });

    // Register special filename mappings
    if (def.filenames) {
      def.filenames.forEach((filename) => {
        const normalizedFilename = filename.toLowerCase();
        this.filenameMap.set(normalizedFilename, normalizedId);
      });
    }
  }

  public getLanguageById(id: string): LanguageDefinition | undefined {
    if (!id) return undefined;
    return this.languages.get(id.toLowerCase());
  }

  public getAllLanguages(): LanguageDefinition[] {
    return Array.from(this.languages.values());
  }

  public resolveLanguage(filenameOrPath: string, overrideLanguageId?: string): LanguageDefinition {
    // 1. Explicit User Override
    if (overrideLanguageId) {
      const overrideLang = this.getLanguageById(overrideLanguageId);
      if (overrideLang) return overrideLang;
    }

    if (!filenameOrPath) {
      return DEFAULT_PLAIN_TEXT_LANGUAGE;
    }

    // Extract filename from path
    const parts = filenameOrPath.replace(/\\/g, '/').split('/');
    const filename = parts[parts.length - 1] || filenameOrPath;
    const normalizedFilename = filename.toLowerCase();

    // 2. Known Special Filename
    const matchedByFilename = this.filenameMap.get(normalizedFilename);
    if (matchedByFilename) {
      const lang = this.languages.get(matchedByFilename);
      if (lang) return lang;
    }

    // 3. Known File Extension
    if (filename.includes('.')) {
      const extParts = filename.split('.');
      const ext = extParts[extParts.length - 1].toLowerCase();
      const matchedByExt = this.extensionMap.get(ext);
      if (matchedByExt) {
        const lang = this.languages.get(matchedByExt);
        if (lang) return lang;
      }
    }

    // 4. Plain Text Fallback
    return DEFAULT_PLAIN_TEXT_LANGUAGE;
  }
}

export const globalLanguageRegistry = new LanguageRegistry();
