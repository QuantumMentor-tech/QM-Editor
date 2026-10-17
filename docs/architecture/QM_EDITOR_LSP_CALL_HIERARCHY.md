# QM Editor — LSP Call Hierarchy Protocol & Subsystem Architecture

## 1. Specification Overview
- **Domain:** Language Server Protocol (LSP 3.17)
- **Protocol Methods:**
  - `textDocument/prepareCallHierarchy`
  - `callHierarchy/incomingCalls`
  - `callHierarchy/outgoingCalls`
- **Capabilities:**
  - Client: `textDocument.callHierarchy = { dynamicRegistration: false }`
  - Server: `serverCapabilities.callHierarchyProvider: boolean | CallHierarchyOptions | CallHierarchyRegistrationOptions`

## 2. Core Architecture Pipeline

```text
Editor / Cursor
        │
        ▼
Call Hierarchy Coordinator (LspCallHierarchyCoordinator)
        │
        ▼
LSP Call Hierarchy Provider (LspCallHierarchyProvider)
        │
        ▼
textDocument/prepareCallHierarchy
        │
        ▼
Call Hierarchy Item (QmCallHierarchyItem)
        │
        ├─────────────────────────────┐
        ▼                             ▼
Incoming Calls                    Outgoing Calls
        │                             │
        ▼                             ▼
callHierarchy/incomingCalls      callHierarchy/outgoingCalls
        │                             │
        └──────────────┬──────────────┘
                       ▼
               Validation / Mapping
         (LspCallHierarchyValidator / Mapper)
                       │
                       ▼
             Canonical QM Call Model
         (QmIncomingCall / QmOutgoingCall)
                       │
                       ▼
              Hierarchical UI Model
             (CallHierarchyTreeNode)
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
      Call Tree                 Navigation
 (CallHierarchyModal)       (NavigationCoordinator)
                                    │
                                    ▼
                             Document Engine
                                    │
                                    ▼
                                  Editor
```

## 3. Subsystem Separation & Authority
- **LSP Client (`LspClient`):** Owns JSON-RPC 2.0 wire protocol, requests, cancellation, and response multiplexing.
- **Call Hierarchy Provider (`LspCallHierarchyProvider`):** Owns capability negotiation, parameter packaging, request dispatch, and defensive response validation.
- **Call Hierarchy Coordinator (`LspCallHierarchyCoordinator`):** Owns active call context, lazy child loading, cycle detection, and centralized navigation invocation.
- **Symbol Engine (`SymbolEngine`):** Owns canonical symbol meaning, `SymbolKind`, and `SymbolTag`.
- **Navigation Coordinator (`NavigationCoordinator`):** Authoritative for all editor movements, buffer reveals, and history entries.
- **Document Engine (`DocumentEngine`):** Authoritative for resource opening, lifecycles, and revision management.
- **Editor Engine (`EditorSurface` / `EditorAdapter`):** Presentation, focus, keyboard handling, and tree rendering.

## 4. Lifecycle & Stale Protection
- Every request validates document revision, server session ID, and session generation before sending and upon return.
- In-flight requests are automatically cancelled via `CancellationToken` if superseded by a newer query or if the document/modal closes.
- Server restart invalidates active context without crashing the editor.
- Document closure immediately cleans up active call hierarchy contexts.
