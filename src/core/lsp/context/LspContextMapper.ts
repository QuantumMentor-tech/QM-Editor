/**
 * QM Editor LSP Contextual Intelligence Mapper
 * Phase 06, Step 59 — LSP Hover, Signature Help & Contextual Documentation Integration
 */

import {
  LspHover,
  LspSignatureHelp,
} from '../LspTypes';
import {
  HoverRequest,
  HoverResult,
  HoverContentPart,
  SignatureHelpRequest,
  SignatureHelpResult,
  SignatureInformation,
  ParameterInformation,
  MarkupContent,
} from '../../language-intelligence/LanguageIntelligenceTypes';
import { Range } from '../../navigation/LocationTypes';

export class LspContextMapper {
  /**
   * Maps a validated LSP hover result to a canonical QM Editor HoverResult.
   */
  public static mapLspHover(
    hover: LspHover,
    request: HoverRequest,
    providerId: string = 'lsp'
  ): HoverResult {
    const canonicalContents: HoverContentPart[] = [];

    if (typeof hover.contents === 'string') {
      canonicalContents.push(hover.contents);
    } else if (Array.isArray(hover.contents)) {
      for (const item of hover.contents) {
        if (typeof item === 'string') {
          canonicalContents.push(item);
        } else if (typeof item === 'object' && item !== null) {
          canonicalContents.push({
            language: item.language,
            value: item.value,
          });
        }
      }
    } else if (typeof hover.contents === 'object' && hover.contents !== null) {
      if ('kind' in hover.contents) {
        canonicalContents.push(hover.contents.value);
      } else if ('language' in hover.contents) {
        canonicalContents.push({
          language: hover.contents.language,
          value: hover.contents.value,
        });
      }
    }

    let canonicalRange: Range | undefined = undefined;
    if (hover.range) {
      canonicalRange = {
        startLine: hover.range.start.line + 1,
        startColumn: hover.range.start.character + 1,
        endLine: hover.range.end.line + 1,
        endColumn: hover.range.end.character + 1,
      };
    }

    return {
      contents: canonicalContents,
      range: canonicalRange,
      providerId,
      requestId: request.requestId,
      generation: 1,
      revision: request.revision,
    };
  }

  /**
   * Maps a validated LSP signature help result to a canonical QM Editor SignatureHelpResult.
   */
  public static mapLspSignatureHelp(
    sigHelp: LspSignatureHelp,
    request: SignatureHelpRequest,
    providerId: string = 'lsp'
  ): SignatureHelpResult {
    const canonicalSignatures: SignatureInformation[] = sigHelp.signatures.map((sig) => {
      let doc: string | MarkupContent | undefined = undefined;
      if (typeof sig.documentation === 'string') {
        doc = sig.documentation;
      } else if (sig.documentation && typeof sig.documentation === 'object') {
        doc = {
          kind: sig.documentation.kind,
          value: sig.documentation.value,
        };
      }

      const parameters: ParameterInformation[] = (sig.parameters || []).map((param) => {
        let paramDoc: string | MarkupContent | undefined = undefined;
        if (typeof param.documentation === 'string') {
          paramDoc = param.documentation;
        } else if (param.documentation && typeof param.documentation === 'object') {
          paramDoc = {
            kind: param.documentation.kind,
            value: param.documentation.value,
          };
        }

        return {
          label: param.label,
          documentation: paramDoc,
        };
      });

      return {
        label: sig.label,
        documentation: doc,
        parameters,
        activeParameter: sig.activeParameter,
      };
    });

    return {
      signatures: canonicalSignatures,
      activeSignature: sigHelp.activeSignature ?? 0,
      activeParameter: sigHelp.activeParameter ?? 0,
      providerId,
      requestId: request.requestId,
      generation: 1,
      revision: request.revision,
    };
  }
}
