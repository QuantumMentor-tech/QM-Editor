/**
 * QM Editor Symbol Icon Renderer
 * Phase 04, Step 35 — Symbol Infrastructure, Outline & Symbol Navigation
 */

import React from 'react';
import {
  Code,
  Box,
  FileCode,
  Layers,
  Braces,
  Hash,
  Type,
  Key,
  Folder,
  Tag,
  Heading,
} from 'lucide-react';
import { SymbolKind } from '../../core/symbols/SymbolTypes';

export interface SymbolIconProps {
  kind: SymbolKind;
  size?: number;
}

export const SymbolIcon: React.FC<SymbolIconProps> = ({ kind, size = 14 }) => {
  switch (kind) {
    case 'class':
    case 'struct':
      return <Box size={size} color="#f59e0b" />;
    case 'interface':
    case 'typeParameter':
      return <Layers size={size} color="#3b82f6" />;
    case 'function':
    case 'method':
    case 'constructor':
      return <Code size={size} color="#a855f7" />;
    case 'variable':
    case 'field':
    case 'property':
      return <Braces size={size} color="#06b6d4" />;
    case 'constant':
    case 'number':
    case 'boolean':
      return <Hash size={size} color="#10b981" />;
    case 'enum':
    case 'enumMember':
      return <Tag size={size} color="#ec4899" />;
    case 'string':
      return <Type size={size} color="#84cc16" />;
    case 'heading':
      return <Heading size={size} color="#6366f1" />;
    case 'key':
      return <Key size={size} color="#eab308" />;
    case 'module':
    case 'namespace':
    case 'package':
      return <Folder size={size} color="#94a3b8" />;
    case 'file':
    default:
      return <FileCode size={size} color="var(--text-muted)" />;
  }
};
