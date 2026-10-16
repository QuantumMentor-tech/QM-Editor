/**
 * QM Editor Canonical LSP URI Mapper
 * Phase 06, Step 56 — Language Server Protocol Foundation, Server Lifecycle & Client Architecture
 *
 * Implements strict, standards-compliant bidirectional conversion between
 * QM Editor filesystem/resource paths and LSP RFC 3986 `file://` / `untitled:` URIs.
 */

export class LspUriMapper {
  /**
   * Converts a QM Editor file path or resource URI into a canonical LSP DocumentUri.
   */
  public static pathToUri(inputPathOrUri: string): string {
    if (!inputPathOrUri || typeof inputPathOrUri !== 'string') {
      throw new Error('Invalid path or URI provided to LspUriMapper.pathToUri');
    }

    const trimmed = inputPathOrUri.trim();

    // Preserve untitled URI scheme
    if (trimmed.startsWith('untitled:')) {
      return trimmed;
    }

    // Already a file URI? Normalize and return
    if (trimmed.startsWith('file://')) {
      return this.normalizeFileUri(trimmed);
    }

    // Windows drive letter path: e.g. "C:\dir\file.ts" or "c:/dir/file.ts"
    const windowsMatch = trimmed.match(/^([a-zA-Z]):[/\\](.*)$/);
    if (windowsMatch) {
      const driveLetter = windowsMatch[1].toUpperCase();
      const rest = windowsMatch[2].replace(/\\/g, '/');
      const encodedSegments = rest
        .split('/')
        .map((seg) => encodeURIComponent(seg))
        .join('/');
      return `file:///${driveLetter}:${encodedSegments ? '/' + encodedSegments : ''}`;
    }

    // Windows UNC path: e.g. "\\server\share\file.ts"
    if (trimmed.startsWith('\\\\')) {
      const normalized = trimmed.slice(2).replace(/\\/g, '/');
      const parts = normalized.split('/').map((seg) => encodeURIComponent(seg));
      return `file:////${parts.join('/')}`;
    }

    // POSIX absolute path: e.g. "/usr/local/bin/file.ts"
    if (trimmed.startsWith('/')) {
      const segments = trimmed
        .slice(1)
        .split('/')
        .map((seg) => encodeURIComponent(seg))
        .join('/');
      return `file:///${segments}`;
    }

    // Relative path or fallback: encode as relative POSIX file URI
    const segments = trimmed
      .replace(/\\/g, '/')
      .split('/')
      .map((seg) => encodeURIComponent(seg))
      .join('/');
    return `file:///${segments}`;
  }

  /**
   * Converts a canonical LSP DocumentUri back into a native filesystem path or resource URI.
   */
  public static uriToPath(uri: string): string {
    if (!uri || typeof uri !== 'string') {
      throw new Error('Invalid URI provided to LspUriMapper.uriToPath');
    }

    const trimmed = uri.trim();

    // Preserve untitled scheme
    if (trimmed.startsWith('untitled:')) {
      return trimmed;
    }

    if (!trimmed.startsWith('file://')) {
      // Non-file URI: return as-is
      return trimmed;
    }

    // Remove file:// prefix
    let pathPart = trimmed.slice(7);

    // UNC path: file:////server/share...
    if (pathPart.startsWith('//')) {
      const unc = pathPart.slice(2);
      const decoded = unc
        .split('/')
        .map((seg) => decodeURIComponent(seg))
        .join('\\');
      return `\\\\${decoded}`;
    }

    // Standard file:///...
    if (pathPart.startsWith('/')) {
      pathPart = pathPart.slice(1);
    }

    // Check for Windows drive letter: "C:/path" or "c:/path" or "C%3A/path"
    const decodedDriveMatch = pathPart.match(/^([a-zA-Z])(?::|%3A)(.*)$/i);
    if (decodedDriveMatch) {
      const driveLetter = decodedDriveMatch[1].toUpperCase();
      const rest = decodedDriveMatch[2];
      const decodedRest = rest
        .split('/')
        .map((seg) => decodeURIComponent(seg))
        .join('/');
      const windowsPath = `${driveLetter}:${decodedRest}`.replace(/\//g, '\\');
      return windowsPath;
    }

    // POSIX path: restore leading slash
    const decodedSegments = pathPart
      .split('/')
      .map((seg) => decodeURIComponent(seg))
      .join('/');
    return `/${decodedSegments}`;
  }

  /**
   * Normalizes an existing file:// URI to standard casing and percent-encoding.
   */
  private static normalizeFileUri(fileUri: string): string {
    const rawPath = this.uriToPath(fileUri);
    return this.pathToUri(rawPath);
  }
}
