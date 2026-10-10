import { FileResource } from '../types';
import { QMEditorError, ErrorCode } from '../utils/errors';
import { logger } from '../utils/logger';

export interface OpenPickerOptions {
  types?: Array<{
    description?: string;
    accept: Record<string, string[]>;
  }>;
  multiple?: boolean;
}

export interface SavePickerOptions {
  suggestedName?: string;
  types?: Array<{
    description?: string;
    accept: Record<string, string[]>;
  }>;
}

export const MAX_SAFE_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB limit for plain text

export const normalizePath = (rawPath: string): string => {
  if (!rawPath) return '';
  let normalized = rawPath.replace(/\\/g, '/');
  // Strip duplicate slashes except for protocol (e.g. file:// or http://)
  normalized = normalized.replace(/([^:]\/)\/+/g, '$1');
  // Prevent relative path traversal exploits
  const parts = normalized.split('/');
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
  const prefix = normalized.startsWith('/') ? '/' : '';
  return prefix + safeParts.join('/');
};

export const extractFileExtension = (filename: string): string => {
  if (!filename.includes('.')) return '';
  const parts = filename.split('.');
  return parts[parts.length - 1].toLowerCase();
};

export const isBinaryContent = (buffer: ArrayBuffer): boolean => {
  const bytes = new Uint8Array(buffer.slice(0, 8192));
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0) {
      return true; // Null byte indicates binary format
    }
  }
  return false;
};

export class FileService {
  /**
   * Reads a file handle or browser File object and constructs a FileResource
   */
  public async readFile(
    source: FileSystemFileHandle | File
  ): Promise<{ content: string; resource: FileResource }> {
    try {
      let file: File;
      let handle: FileSystemFileHandle | undefined;

      if ('getFile' in source && typeof source.getFile === 'function') {
        handle = source as FileSystemFileHandle;
        file = await handle.getFile();
      } else {
        file = source as File;
      }

      if (file.size > MAX_SAFE_FILE_SIZE_BYTES) {
        throw new QMEditorError(
          `File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum safe editor limit of 10MB.`,
          ErrorCode.FILE_TOO_LARGE,
          'warning'
        );
      }

      const buffer = await file.arrayBuffer();
      if (isBinaryContent(buffer)) {
        throw new QMEditorError(
          `File "${file.name}" appears to be binary or unsupported non-text format.`,
          ErrorCode.BINARY_NOT_SUPPORTED,
          'warning'
        );
      }

      const decoder = new TextDecoder('utf-8', { fatal: false });
      const content = decoder.decode(buffer);

      const extension = extractFileExtension(file.name);
      const resource: FileResource = {
        uri: handle ? `browser-fs://${handle.name}` : `file://${file.name}`,
        name: file.name,
        extension,
        readOnly: false,
        exists: true,
        size: file.size,
        modifiedTime: file.lastModified,
        handle,
      };

      logger.info('File read successfully', { filename: file.name, size: file.size });
      return { content, resource };
    } catch (err: unknown) {
      if (err instanceof QMEditorError) {
        throw err;
      }

      const errorObj = err as Error;
      if (errorObj.name === 'NotFoundError') {
        throw new QMEditorError('Requested file was not found.', ErrorCode.FILE_NOT_FOUND, 'warning');
      }
      if (errorObj.name === 'NotAllowedError' || errorObj.name === 'SecurityError') {
        throw new QMEditorError('Permission denied accessing file.', ErrorCode.PERMISSION_DENIED, 'error');
      }

      throw new QMEditorError(`Failed to read file: ${errorObj.message}`, ErrorCode.FILE_READ_ERROR, 'error');
    }
  }

  /**
   * Writes content safely to physical storage via FileSystemFileHandle
   */
  public async writeFile(
    target: FileSystemFileHandle | FileResource,
    content: string
  ): Promise<FileResource> {
    try {
      let handle: FileSystemFileHandle | undefined;
      let existingResource: FileResource | undefined;

      if ('kind' in target && target.kind === 'file') {
        handle = target as FileSystemFileHandle;
      } else {
        existingResource = target as FileResource;
        handle = existingResource.handle;
      }

      if (!handle) {
        throw new QMEditorError(
          'Target resource has no writable handle assigned.',
          ErrorCode.FILE_WRITE_ERROR,
          'error'
        );
      }

      // Safe atomic write strategy using createWritable() stream
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();

      const updatedFile = await handle.getFile();
      const extension = extractFileExtension(updatedFile.name);

      const resource: FileResource = {
        uri: existingResource?.uri || `browser-fs://${handle.name}`,
        name: updatedFile.name,
        extension,
        readOnly: false,
        exists: true,
        size: updatedFile.size,
        modifiedTime: updatedFile.lastModified,
        handle,
      };

      logger.info('File write confirmed', { filename: updatedFile.name, size: updatedFile.size });
      return resource;
    } catch (err: unknown) {
      if (err instanceof QMEditorError) {
        throw err;
      }

      const errorObj = err as Error;
      if (errorObj.name === 'NotAllowedError' || errorObj.name === 'SecurityError') {
        throw new QMEditorError('Permission denied writing file.', ErrorCode.PERMISSION_DENIED, 'error');
      }

      throw new QMEditorError(`Safe write failed: ${errorObj.message}`, ErrorCode.FILE_WRITE_ERROR, 'error');
    }
  }

  /**
   * Shows native browser open file picker (FileSystemAccess API)
   */
  public async showOpenPicker(
    options: OpenPickerOptions = {}
  ): Promise<{ content: string; resource: FileResource } | null> {
    try {
      if (typeof window !== 'undefined' && 'showOpenFilePicker' in window) {
        const pickerWindow = window as unknown as {
          showOpenFilePicker: (opts?: OpenPickerOptions) => Promise<FileSystemFileHandle[]>;
        };
        const [handle] = await pickerWindow.showOpenFilePicker({
          types: options.types || [
            {
              description: 'Text Files',
              accept: { 'text/plain': ['.txt', '.md', '.json', '.js', '.ts', '.html', '.css', '.py'] },
            },
          ],
          multiple: false,
        });

        if (!handle) return null;
        return await this.readFile(handle);
      } else {
        throw new QMEditorError(
          'File System Access API is not supported in this runtime environment.',
          ErrorCode.SERVICE_UNAVAILABLE,
          'warning'
        );
      }
    } catch (err: unknown) {
      const errorObj = err as Error;
      if (errorObj.name === 'AbortError') {
        logger.info('File open picker cancelled by user');
        return null;
      }
      if (err instanceof QMEditorError) {
        throw err;
      }
      throw new QMEditorError(`File picker error: ${errorObj.message}`, ErrorCode.FILE_READ_ERROR, 'error');
    }
  }

  /**
   * Shows native browser save file picker (FileSystemAccess API)
   */
  public async showSavePicker(
    options: SavePickerOptions = {}
  ): Promise<FileSystemFileHandle | null> {
    try {
      if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
        const pickerWindow = window as unknown as {
          showSaveFilePicker: (opts?: SavePickerOptions) => Promise<FileSystemFileHandle>;
        };
        const handle = await pickerWindow.showSaveFilePicker({
          suggestedName: options.suggestedName || 'Untitled.txt',
          types: options.types || [
            {
              description: 'Text Files',
              accept: { 'text/plain': ['.txt', '.md', '.json', '.js', '.ts', '.html', '.css', '.py'] },
            },
          ],
        });
        return handle;
      } else {
        throw new QMEditorError(
          'File System Access API is not supported in this runtime environment.',
          ErrorCode.SERVICE_UNAVAILABLE,
          'warning'
        );
      }
    } catch (err: unknown) {
      const errorObj = err as Error;
      if (errorObj.name === 'AbortError') {
        logger.info('File save picker cancelled by user');
        return null;
      }
      if (err instanceof QMEditorError) {
        throw err;
      }
      throw new QMEditorError(`Save picker error: ${errorObj.message}`, ErrorCode.FILE_WRITE_ERROR, 'error');
    }
  }
}

export const fileService = new FileService();
