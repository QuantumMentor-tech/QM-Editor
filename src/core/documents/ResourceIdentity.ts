/**
 * QM Editor Resource Identity & Normalization Subsystem
 * Phase 04, Step 36 — Core Application Engine
 */

import { NormalizedResource, ResourceScheme, LineEnding } from './DocumentTypes';
import { FileResource } from '../../types';

/**
 * Normalizes any raw path or URI into a canonical, platform-stable resource URI.
 */
export function normalizeResourceUri(rawPathOrUri: string): string {
  if (!rawPathOrUri || typeof rawPathOrUri !== 'string') {
    return '';
  }

  const trimmed = rawPathOrUri.trim();
  const lower = trimmed.toLowerCase();

  // 1. Untitled URI scheme: "untitled:1", "untitled:2"
  if (lower.startsWith('untitled:')) {
    return lower;
  }

  // 2. Browser File System Access scheme: "browser-fs://filename.ts"
  if (lower.startsWith('browser-fs://')) {
    const rest = trimmed.substring('browser-fs://'.length).replace(/\\/g, '/');
    return `browser-fs://${rest}`;
  }

  // 3. Virtual URI scheme: "virtual://..."
  if (lower.startsWith('virtual://')) {
    const rest = trimmed.substring('virtual://'.length).replace(/\\/g, '/');
    return `virtual://${rest}`;
  }

  // 4. File URI or physical path
  let pathStr = trimmed;
  if (pathStr.startsWith('file:///')) {
    pathStr = pathStr.substring('file:///'.length);
  } else if (pathStr.startsWith('file://')) {
    pathStr = pathStr.substring('file://'.length);
  }

  // Normalize slashes
  pathStr = pathStr.replace(/\\/g, '/');

  // Strip duplicate slashes
  pathStr = pathStr.replace(/\/+/g, '/');

  // Standardize Windows drive letter (e.g., "c:/..." -> "C:/...")
  if (/^[a-zA-Z]:\//.test(pathStr)) {
    pathStr = pathStr[0].toUpperCase() + pathStr.substring(1);
  }

  // Resolve dot traversal components safely
  const parts = pathStr.split('/');
  const safeParts: string[] = [];

  for (const part of parts) {
    if (part === '..') {
      if (safeParts.length > 0 && safeParts[safeParts.length - 1] !== '..') {
        safeParts.pop();
      }
    } else if (part !== '.' && part !== '') {
      safeParts.push(part);
    }
  }

  const cleanedPath = safeParts.join('/');

  // Re-attach Windows drive letter or leading root slash
  if (/^[A-Z]:\//.test(pathStr) || /^[A-Z]:$/.test(cleanedPath)) {
    return `file:///${cleanedPath}`;
  }

  if (trimmed.startsWith('/') || trimmed.startsWith('file:///')) {
    return `file:///${cleanedPath}`;
  }

  return `file:///${cleanedPath}`;
}

/**
 * Extracts the scheme from a normalized resource URI.
 */
export function getResourceScheme(uri: string): ResourceScheme {
  if (uri.startsWith('untitled:')) return 'untitled';
  if (uri.startsWith('browser-fs:')) return 'browser-fs';
  if (uri.startsWith('virtual:')) return 'virtual';
  return 'file';
}

/**
 * Extracts the basename (filename) from a path or URI.
 */
export function extractResourceBasename(uriOrPath: string): string {
  if (!uriOrPath) return '';
  if (uriOrPath.startsWith('untitled:')) {
    const num = uriOrPath.substring('untitled:'.length);
    return `Untitled-${num || '1'}`;
  }

  const cleaned = uriOrPath.replace(/\\/g, '/').replace(/\/+$/, '');
  const parts = cleaned.split('/');
  return parts[parts.length - 1] || uriOrPath;
}

/**
 * Extracts lowercase file extension without dot.
 */
export function extractResourceExtension(nameOrUri: string): string {
  const basename = extractResourceBasename(nameOrUri);
  const dotIndex = basename.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === basename.length - 1) {
    return '';
  }
  return basename.substring(dotIndex + 1).toLowerCase();
}

/**
 * Detects predominant line ending in text content.
 */
export function detectLineEnding(content: string): LineEnding {
  if (!content) return 'LF';

  const crlfCount = (content.match(/\r\n/g) || []).length;
  const lfOnlyCount = (content.match(/[^\r]\n/g) || []).length;
  const crOnlyCount = (content.match(/\r[^\n]/g) || []).length;

  if (crlfCount > 0 && lfOnlyCount === 0 && crOnlyCount === 0) {
    return 'CRLF';
  }
  if (lfOnlyCount > 0 && crlfCount === 0 && crOnlyCount === 0) {
    return 'LF';
  }
  if (crOnlyCount > 0 && crlfCount === 0 && lfOnlyCount === 0) {
    return 'CR';
  }
  if (crlfCount > 0 && lfOnlyCount > 0) {
    return 'mixed';
  }
  return 'LF';
}

/**
 * Determines whether two resource URIs refer to the same underlying entity.
 */
export function areResourcesEqual(uriA?: string, uriB?: string): boolean {
  if (!uriA || !uriB) return false;
  return normalizeResourceUri(uriA) === normalizeResourceUri(uriB);
}

/**
 * Generates an untitled resource URI from an integer sequence.
 */
export function createUntitledUri(counter: number): string {
  return `untitled:${counter}`;
}

/**
 * Creates a NormalizedResource model from raw parameters or an existing FileResource.
 */
export function createNormalizedResource(
  rawUriOrPath: string,
  options: {
    name?: string;
    exists?: boolean;
    readOnly?: boolean;
    size?: number;
    modifiedTime?: number;
    handle?: FileSystemFileHandle;
  } = {}
): NormalizedResource {
  const uri = normalizeResourceUri(rawUriOrPath);
  const scheme = getResourceScheme(uri);
  const name = options.name || extractResourceBasename(uri);
  const extension = extractResourceExtension(name);

  return {
    uri,
    scheme,
    name,
    extension,
    exists: options.exists ?? (scheme !== 'untitled'),
    readOnly: options.readOnly ?? false,
    size: options.size,
    modifiedTime: options.modifiedTime,
    handle: options.handle,
  };
}

/**
 * Bridges a legacy FileResource to NormalizedResource.
 */
export function bridgeFileResource(fileResource: FileResource): NormalizedResource {
  const uri = normalizeResourceUri(fileResource.uri);
  return {
    uri,
    scheme: getResourceScheme(uri),
    name: fileResource.name,
    extension: fileResource.extension || extractResourceExtension(fileResource.name),
    exists: fileResource.exists,
    readOnly: fileResource.readOnly,
    size: fileResource.size,
    modifiedTime: fileResource.modifiedTime,
    handle: fileResource.handle,
  };
}
