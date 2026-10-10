import { describe, it, expect } from 'vitest';
import {
  FileService,
  normalizePath,
  extractFileExtension,
  isBinaryContent,
  MAX_SAFE_FILE_SIZE_BYTES,
} from './FileService';
import { ErrorCode } from '../utils/errors';

describe('FileService Storage Abstraction & Safety Guards', () => {
  const service = new FileService();

  describe('Path Normalization & Security', () => {
    it('normalizes backslashes to forward slashes', () => {
      expect(normalizePath('C:\\Users\\Test\\Document.txt')).toBe('C:/Users/Test/Document.txt');
    });

    it('strips redundant multiple slashes', () => {
      expect(normalizePath('path//to///file.txt')).toBe('path/to/file.txt');
    });

    it('prevents relative path traversal exploits', () => {
      expect(normalizePath('folder/sub/../../secret.txt')).toBe('secret.txt');
    });
  });

  describe('Extension & Content Format Detection', () => {
    it('extracts extension accurately', () => {
      expect(extractFileExtension('archive.tar.gz')).toBe('gz');
      expect(extractFileExtension('document.PDF')).toBe('pdf');
      expect(extractFileExtension('noextension')).toBe('');
    });

    it('detects binary null-byte sequences', () => {
      const textBuffer = new TextEncoder().encode('Hello world plain text').buffer;
      expect(isBinaryContent(textBuffer)).toBe(false);

      const binaryBuffer = new Uint8Array([0x48, 0x65, 0x00, 0x6c, 0x6f]).buffer;
      expect(isBinaryContent(binaryBuffer)).toBe(true);
    });
  });

  describe('File Read & Write Safety Controls', () => {
    it('rejects files larger than 10MB', async () => {
      const mockLargeFile = {
        name: 'huge.txt',
        size: MAX_SAFE_FILE_SIZE_BYTES + 100,
        arrayBuffer: async () => new ArrayBuffer(0),
      } as unknown as File;

      await expect(service.readFile(mockLargeFile)).rejects.toThrowError(
        expect.objectContaining({ code: ErrorCode.FILE_TOO_LARGE })
      );
    });

    it('rejects binary files', async () => {
      const mockBinaryFile = {
        name: 'app.exe',
        size: 500,
        arrayBuffer: async () => new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0x00]).buffer,
      } as unknown as File;

      await expect(service.readFile(mockBinaryFile)).rejects.toThrowError(
        expect.objectContaining({ code: ErrorCode.BINARY_NOT_SUPPORTED })
      );
    });

    it('reads valid text file successfully', async () => {
      const textContent = 'Sample code file';
      const mockTextFile = {
        name: 'script.ts',
        size: textContent.length,
        lastModified: 1700000000000,
        arrayBuffer: async () => new TextEncoder().encode(textContent).buffer,
      } as unknown as File;

      const result = await service.readFile(mockTextFile);
      expect(result.content).toBe(textContent);
      expect(result.resource.name).toBe('script.ts');
      expect(result.resource.extension).toBe('ts');
      expect(result.resource.exists).toBe(true);
    });
  });
});
