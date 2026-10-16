/**
 * QM Editor Canonical LSP JSON-RPC 2.0 Framing & Protocol Parser
 * Phase 06, Step 56 — Language Server Protocol Foundation, Server Lifecycle & Client Architecture
 *
 * Implements strict Base Protocol header framing (Content-Length: ...\r\n\r\n),
 * chunk streaming, fragmented buffer reassembly, serialization, and message dispatch.
 */

import { JsonRpcMessage, RequestMessage, ResponseMessage, NotificationMessage } from './LspTypes';
import { logger } from '../../utils/logger';

export class LspJsonRpc {
  private buffer: string = '';
  private readonly encoder = new TextEncoder();
  private readonly decoder = new TextDecoder('utf-8');

  /**
   * Serializes a JSON-RPC message into an LSP-framed wire string with Content-Length header.
   */
  public static serialize(message: JsonRpcMessage): string {
    const json = JSON.stringify(message);
    const byteLength = new TextEncoder().encode(json).length;
    return `Content-Length: ${byteLength}\r\n\r\n${json}`;
  }

  /**
   * Appends an incoming raw text chunk to the stream buffer and extracts all complete JSON-RPC messages.
   * Gracefully discards malformed data and recovers synchronization on subsequent messages.
   */
  public append(chunk: string): JsonRpcMessage[] {
    this.buffer += chunk;
    const messages: JsonRpcMessage[] = [];

    while (this.buffer.length > 0) {
      // Find header delimiter (\r\n\r\n)
      const headerEndIndex = this.buffer.indexOf('\r\n\r\n');
      if (headerEndIndex === -1) {
        // Incomplete header; wait for more chunks
        break;
      }

      const headerText = this.buffer.slice(0, headerEndIndex);
      const contentLengthMatch = headerText.match(/content-length:\s*(\d+)/i);

      if (!contentLengthMatch) {
        // Invalid or corrupt header; skip past this header to prevent infinite loops
        logger.warn('LspJsonRpc: Malformed header encountered without valid Content-Length. Skipping header.', {
          header: headerText,
        });
        this.buffer = this.buffer.slice(headerEndIndex + 4);
        continue;
      }

      const contentLength = parseInt(contentLengthMatch[1], 10);
      if (isNaN(contentLength) || contentLength < 0) {
        logger.warn('LspJsonRpc: Invalid Content-Length value. Skipping header.', {
          header: headerText,
        });
        this.buffer = this.buffer.slice(headerEndIndex + 4);
        continue;
      }

      const bodyStartIndex = headerEndIndex + 4;
      const bodyBytesAvailable = this.getByteLength(this.buffer.slice(bodyStartIndex));

      if (bodyBytesAvailable < contentLength) {
        // Incomplete message body; wait for more data
        break;
      }

      // Extract exact body of `contentLength` bytes
      const { bodyString, remainingString } = this.sliceByByteLength(
        this.buffer.slice(bodyStartIndex),
        contentLength
      );

      this.buffer = remainingString;

      try {
        const parsed = JSON.parse(bodyString);
        if (parsed && typeof parsed === 'object') {
          messages.push(parsed as JsonRpcMessage);
        } else {
          logger.warn('LspJsonRpc: Non-object JSON payload ignored', { body: bodyString });
        }
      } catch (err) {
        logger.error('LspJsonRpc: Failed to parse JSON-RPC message body', {
          error: (err as Error).message,
          rawBody: bodyString.slice(0, 200),
        });
      }
    }

    return messages;
  }

  /**
   * Clears any buffered partial messages.
   */
  public reset(): void {
    this.buffer = '';
  }

  /**
   * Identifies whether a parsed message is a RequestMessage.
   */
  public static isRequest(msg: JsonRpcMessage): msg is RequestMessage {
    return 'method' in msg && 'id' in msg && msg.id !== undefined && msg.id !== null;
  }

  /**
   * Identifies whether a parsed message is a ResponseMessage.
   */
  public static isResponse(msg: JsonRpcMessage): msg is ResponseMessage {
    return ('result' in msg || 'error' in msg) && 'id' in msg;
  }

  /**
   * Identifies whether a parsed message is a NotificationMessage.
   */
  public static isNotification(msg: JsonRpcMessage): msg is NotificationMessage {
    return 'method' in msg && !('id' in msg);
  }

  private getByteLength(str: string): number {
    return this.encoder.encode(str).length;
  }

  private sliceByByteLength(
    str: string,
    targetByteLength: number
  ): { bodyString: string; remainingString: string } {
    const encoded = this.encoder.encode(str);
    const bodyBytes = encoded.subarray(0, targetByteLength);
    const remainingBytes = encoded.subarray(targetByteLength);

    return {
      bodyString: this.decoder.decode(bodyBytes),
      remainingString: this.decoder.decode(remainingBytes),
    };
  }
}
