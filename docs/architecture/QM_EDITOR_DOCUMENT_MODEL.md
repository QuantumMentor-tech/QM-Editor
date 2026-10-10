# QM EDITOR — DOCUMENT MODEL & WORKSPACE SPECIFICATION

**Version:** 1.0.0  
**Status:** Approved Document & Workspace Foundation  
**Last Updated:** October 10, 2026  

---

## 1. ARCHITECTURE OVERVIEW

QM Editor decouples **Document Models** from **Editor Views** and **Shell Layout**. A single authoritative registry (`DocumentRegistry`) manages open document sessions, dirty state flags, tab ordering, and unsaved change confirmation boundaries.

### Layer & State Boundaries

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        WORKSPACE CONTEXT & REGISTRY                    │
│   (Authoritative owner of open documents, tab order, active ID)       │
└───────┬────────────────────────────────────────────────┬───────────────┘
        │ Provides Document Models & Actions             │ Render Tabs & Surface
        ▼                                                ▼
┌────────────────────────────────┐            ┌────────────────────────────────┐
│         TAB STRIP VIEW         │            │         EDITOR SURFACE         │
│ (Tabs = Light Views of Docs)   │            │ (Text Editing View Container)  │
└────────────────────────────────┘            └────────────────────────────────┘
```

---

## 2. DOCUMENT LIFECYCLE STATE MACHINE

```text
[ Not Open ] ──( Open / Create )──> [ Loaded / Clean ] ──( Text Edit )──> [ Modified / Dirty ]
                                           ▲                                     │
                                           │                                     ▼
                                     ( Save Success ) <──( Save Action )──── [ Saving ]
                                                                                 │
                                                                           ( Attempt Close )
                                                                                 │
                                                                                 ▼
                                                                     [ Unsaved Close Guard ]
                                                                     ( Save / Discard / Cancel )
```

---

## 3. DOMAIN MODEL CONTRACT (`src/types/index.ts`)

```typescript
export interface FileResource {
  uri: string;                 // Normalized URI/path (e.g. 'file:///C:/path/notes.md' or 'browser-fs://...')
  name: string;                // Filename with extension (e.g. 'notes.md')
  extension: string;           // Extension without leading dot (e.g. 'md')
  readOnly: boolean;           // Whether the file resource is read-only
  exists: boolean;             // Whether resource exists physically on disk
  size?: number;               // Byte size of physical file
  modifiedTime?: number;       // Last modified epoch timestamp
  handle?: FileSystemFileHandle; // Optional browser File System Access API handle
}

export interface DocumentModel {
  id: string;                  // Unique, immutable session ID (e.g. 'doc-1698293...')
  title: string;               // Display title (e.g. 'notes.md' or 'Untitled')
  content: string;             // Active in-memory text content
  filePath?: string;           // Optional normalized file path / URI
  fileResource?: FileResource; // Attached physical storage resource
  language: string;            // Language mode (e.g. 'markdown', 'typescript')
  contentRevision: number;     // Incremented on every content change
  savedRevision: number;       // Equal to contentRevision when saved physically
  isDirty: boolean;            // Evaluated as contentRevision !== savedRevision
  lastSavedTimestamp: number;  // Epoch timestamp of last successful save
}
```

---

## 4. TAB ORDER & SELECTION RULES

1. **Single Tab Per Document:** Opening a document that is already present in the workspace activates its existing tab without creating duplicate tabs.
2. **Deterministic Close Selection:** Closing the active tab transfers focus to the adjacent tab on the right. If closing the rightmost tab, focus transfers to the adjacent tab on the left. If the last tab is closed, the workspace transitions to the `Empty Workspace State`.
3. **Dirty Close Guard:** Attempting to close a dirty document triggers an Unsaved Changes Dialog (`Save`, `Discard`, `Cancel`).
