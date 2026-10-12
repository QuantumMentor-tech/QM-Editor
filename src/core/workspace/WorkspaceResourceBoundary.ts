/**
 * QM Editor Workspace Resource Boundary & Path Safety
 * Phase 04, Step 30 — Core Workspace Subsystem
 */

import { PathTraversalError } from './WorkspaceErrors';
import { WorkspaceRoot } from './WorkspaceTypes';

/**
 * Normalizes any filesystem path or URI into a canonical forward-slash representation.
 * Resolves redundant '.' and '..' segments, handles Windows drive letters, and preserves schemes.
 */
export function normalizeWorkspacePath(rawPath: string): string {
  if (!rawPath || typeof rawPath !== 'string') return '';

  let path = rawPath.trim().replace(/\\/g, '/');

  // Preserve URI schemes (e.g. browser-fs://, file://)
  let scheme = '';
  const schemeMatch = path.match(/^([a-zA-Z0-9+.-]+:\/\/)/);
  if (schemeMatch) {
    scheme = schemeMatch[1];
    path = path.slice(scheme.length);
  }

  // Normalize Windows drive letter casing (e.g. c:/ -> C:/)
  if (/^[a-zA-Z]:\//.test(path)) {
    path = path[0].toUpperCase() + path.slice(1);
  }

  // Deduplicate consecutive slashes
  path = path.replace(/\/+/g, '/');

  // Segment canonicalization
  const isAbsolute = path.startsWith('/') || /^[a-zA-Z]:/.test(path);
  const segments = path.split('/');
  const stack: string[] = [];

  for (const seg of segments) {
    if (seg === '' || seg === '.') {
      continue;
    }
    if (seg === '..') {
      if (stack.length > 0 && stack[stack.length - 1] !== '..') {
        stack.pop();
      } else if (!isAbsolute) {
        stack.push('..');
      }
    } else {
      stack.push(seg);
    }
  }

  let normalized = stack.join('/');

  if (isAbsolute && !/^[a-zA-Z]:/.test(normalized)) {
    normalized = '/' + normalized;
  }

  // Keep drive root slash if drive root (e.g. "C:")
  if (/^[a-zA-Z]:$/.test(normalized)) {
    normalized += '/';
  }

  return scheme + normalized;
}

/**
 * Determines whether a filesystem path or URI belongs to Windows OS conventions (drive letters).
 */
export function isWindowsStylePath(path: string): boolean {
  const clean = path.replace(/^[a-zA-Z0-9+.-]+:\/\//, '');
  return /^[a-zA-Z]:/.test(clean);
}

/**
 * Checks whether a target resource path/URI is strictly contained inside a workspace root.
 * Guarantees that similar directory prefixes (e.g. C:/project vs C:/project-other) do NOT collide.
 */
export function isResourceInRoot(
  rootUri: string,
  resourceUri: string,
  options: { caseSensitive?: boolean } = {}
): boolean {
  if (!rootUri || !resourceUri) return false;

  const normRoot = normalizeWorkspacePath(rootUri);
  const normResource = normalizeWorkspacePath(resourceUri);

  const isWin = isWindowsStylePath(normRoot) || isWindowsStylePath(normResource);
  const caseSensitive = options.caseSensitive ?? !isWin;

  const compareRoot = caseSensitive ? normRoot : normRoot.toLowerCase();
  const compareResource = caseSensitive ? normResource : normResource.toLowerCase();

  // Exact root match
  if (compareRoot === compareResource) {
    return true;
  }

  // If root is a drive root like "C:/" or "/"
  if (compareRoot.endsWith('/')) {
    return compareResource.startsWith(compareRoot);
  }

  // Strict boundary: resource must start with root + '/'
  return compareResource.startsWith(`${compareRoot}/`);
}

/**
 * Resolves a workspace-relative path safely within the authorized root.
 * Throws PathTraversalError if relative traversal escapes the root.
 */
export function resolveRelativeResource(rootUri: string, relativePath: string): string {
  if (!rootUri) throw new Error('Cannot resolve relative path without rootUri');
  if (!relativePath) return normalizeWorkspacePath(rootUri);

  const normRoot = normalizeWorkspacePath(rootUri);

  // Clean relative path leading slashes
  const cleanRelative = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  const combined = normRoot.endsWith('/') ? `${normRoot}${cleanRelative}` : `${normRoot}/${cleanRelative}`;
  const resolved = normalizeWorkspacePath(combined);

  if (!isResourceInRoot(normRoot, resolved)) {
    throw new PathTraversalError(relativePath, normRoot);
  }

  return resolved;
}

/**
 * Extracts the workspace-relative path of a resource given a root.
 * Returns null if the resource is outside the root.
 */
export function getRelativeResourcePath(rootUri: string, resourceUri: string): string | null {
  if (!isResourceInRoot(rootUri, resourceUri)) {
    return null;
  }

  const normRoot = normalizeWorkspacePath(rootUri);
  const normResource = normalizeWorkspacePath(resourceUri);

  if (normRoot === normResource) {
    return '';
  }

  const prefix = normRoot.endsWith('/') ? normRoot : `${normRoot}/`;
  return normResource.slice(prefix.length);
}

/**
 * Finds the authoritative WorkspaceRoot that contains a given resource URI.
 * In case of multiple roots, selects the most specific root (longest prefix).
 */
export function findRootForResource(
  roots: WorkspaceRoot[],
  resourceUri: string
): WorkspaceRoot | undefined {
  if (!roots || roots.length === 0) return undefined;

  let bestMatch: WorkspaceRoot | undefined;
  let bestLength = -1;

  for (const root of roots) {
    if (root.isAccessible && isResourceInRoot(root.uri, resourceUri)) {
      const len = root.uri.length;
      if (len > bestLength) {
        bestMatch = root;
        bestLength = len;
      }
    }
  }

  return bestMatch;
}
