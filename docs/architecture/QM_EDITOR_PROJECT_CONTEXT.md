# QM Editor — Project Context & Multi-Root Architectural Preparation
## Phase 04, Step 30 Architecture Document

### 1. Conceptual Separation of Concerns

QM Editor explicitly distinguishes between related but distinct architectural concepts:

```text
Application Runtime
       ≠
Workspace Instance
       ≠
Repository Identity
       ≠
Project Concept
       ≠
Filesystem Root
       ≠
Document Buffer
```

| Concept | Responsibility | Authority |
| :--- | :--- | :--- |
| **Application** | Global host process, lifecycle, windowing, UI layout | `ApplicationRuntime` |
| **Workspace** | Active development work container, active roots, generation counter | `WorkspaceEngine` |
| **Project** | Semantic configuration (languages, frameworks, build commands) | Future Project Engine |
| **Repository** | Git commit graph, staging area, working branch, remotes | `SourceControlService` |
| **Filesystem Root** | Physical directory on disk or browser virtual filesystem handle | `WorkspaceRoot` |
| **Document** | Text buffer, edit history, dirty state, syntax highlighting | `DocumentRegistry` |

---

### 2. Multi-Root Architecture Preparation

The `WorkspaceModel` natively supports an array of roots:
```typescript
roots: WorkspaceRoot[];
```
Each root carries:
- `rootId`: Unique identifier (e.g. `root-c__frontend`, `root-c__backend`).
- `uri`: Canonical path.
- `name`: Display name.
- `isAccessible`: Accessibility state.

#### Scope Constraint for Phase 04
While the internal data structure and resource resolution logic (`findRootForResource`) support multiple roots, **the user interface remains single-root focused**. Multi-root picker dialogues, multi-root explorer sections, and complex multi-root UI management are deliberately deferred until explicitly planned.

---

### 3. Resource Boundary Safety & Traversal Prevention

All resource queries pass through `WorkspaceResourceBoundary`:
1. **Drive Letter Normalization**: Windows drives (`C:\`, `D:\`) are normalized to standardized casing.
2. **Directory Collisions**: Strict slash matching prevents prefix false-positives (e.g., `C:/project` vs `C:/project-other`).
3. **Traversal Traps**: Inputs with `../` attempting to escape roots are rejected with `PathTraversalError`.
4. **Symlinks & Virtual Handles**: File System Access API virtual handles (`browser-fs://`) are preserved without mangling protocols.

---

### 4. Future Project Context Extensions

`WorkspaceModel` includes an extensible `projectMetadata` field:
```typescript
projectMetadata?: Record<string, unknown>;
```
This serves as an integration point for upcoming build systems, project detection algorithms, and toolchain configurations, without bloating the core Workspace Engine with ad-hoc manifest parsing.
