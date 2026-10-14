/**
 * QM Editor Storage Serializer & Validation Boundary
 * Phase 05, Step 46 — Data & Storage Architecture Foundation
 */

import { StorageSerializationError, StorageSensitiveDataError } from '../StorageErrors';

export class StorageSerializer {
  private static readonly SENSITIVE_KEY_PATTERNS = [
    /password/i,
    /api[_-]?secret/i,
    /private[_-]?key/i,
    /access[_-]?token/i,
    /auth[_-]?token/i,
    /client[_-]?secret/i,
  ];

  /**
   * Serializes a payload to a JSON string while enforcing serialization boundaries:
   * 1. Rejects live runtime objects (functions, symbols, DOM elements, circular structures).
   * 2. Scans for accidental plaintext credential leaks.
   * 3. Normalizes Dates.
   */
  public static serialize<T>(payload: T, checkSensitiveData: boolean = true): string {
    if (payload === undefined) {
      throw new StorageSerializationError('Cannot serialize undefined payload.');
    }

    const seen = new WeakSet();

    const validateNode = (value: unknown, path: string = 'root') => {
      if (value === null || value === undefined) return;

      const type = typeof value;
      if (type === 'function') {
        throw new StorageSerializationError(
          `Runtime function detected at "${path}". Functions cannot be persisted.`
        );
      }
      if (type === 'symbol') {
        throw new StorageSerializationError(
          `Symbol detected at "${path}". Symbols cannot be persisted.`
        );
      }

      // Check browser DOM elements
      if (typeof Element !== 'undefined' && value instanceof Element) {
        throw new StorageSerializationError(
          `DOM Element detected at "${path}". DOM nodes cannot be persisted.`
        );
      }

      if (type === 'object') {
        if (seen.has(value as object)) {
          throw new StorageSerializationError(
            `Circular reference detected at "${path}". Cannot serialize circular structures.`
          );
        }
        seen.add(value as object);

        if (Array.isArray(value)) {
          value.forEach((item, idx) => validateNode(item, `${path}[${idx}]`));
        } else {
          for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            if (checkSensitiveData) {
              for (const pattern of this.SENSITIVE_KEY_PATTERNS) {
                if (pattern.test(k) && typeof v === 'string' && v.trim().length > 0) {
                  throw new StorageSensitiveDataError(
                    `Potentially sensitive secret detected at key "${path}.${k}". Secrets must not be stored in plaintext persistence.`,
                    { path: `${path}.${k}` }
                  );
                }
              }
            }
            validateNode(v, `${path}.${k}`);
          }
        }
      }
    };

    validateNode(payload);

    try {
      return JSON.stringify(payload, (_key, value) => {
        if (value instanceof Date) {
          return value.toISOString();
        }
        return value;
      });
    } catch (err: any) {
      throw new StorageSerializationError(
        `JSON stringify failed: ${err?.message || 'Unknown error'}`,
        { originalError: err?.message }
      );
    }
  }

  /**
   * Deserializes JSON string to an object with basic structural validation.
   */
  public static deserialize<T>(raw: string): T {
    if (!raw || typeof raw !== 'string') {
      throw new StorageSerializationError('Cannot deserialize empty or non-string input.');
    }

    try {
      return JSON.parse(raw) as T;
    } catch (err: any) {
      throw new StorageSerializationError(
        `JSON parse failed: ${err?.message || 'Malformed JSON'}`,
        { rawSample: raw.slice(0, 100) }
      );
    }
  }

  /**
   * Generates a lightweight deterministic checksum for corruption detection.
   */
  public static computeChecksum(content: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < content.length; i++) {
      hash ^= content.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }
}
