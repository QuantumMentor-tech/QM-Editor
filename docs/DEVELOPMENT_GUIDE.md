# QM EDITOR — DEVELOPER GUIDE & ENGINEERING STANDARDS

---

## 1. GETTING STARTED

### Prerequisites
- Node.js `v20+` or `v26+`
- npm `v10+` or `v11+`
- Git `v2.40+`

### Installation
```bash
cmd /c npm install
```
*Note for Windows environments:* Execute npm scripts via `cmd /c npm` to prevent PowerShell script execution policy errors.

---

## 2. STANDARD DEVELOPMENT COMMANDS

| Command | Purpose |
|---|---|
| `cmd /c npm run dev` | Starts local Vite development server |
| `cmd /c npm run build` | Compiles TypeScript and runs production Vite build |
| `cmd /c npm run type-check` | Executes strict TypeScript type validation (`tsc --noEmit`) |
| `cmd /c npm run test` | Executes Unit & Integration tests via Vitest |
| `cmd /c npm run lint` | Performs code quality & type safety linting |

---

## 3. PROJECT DIRECTORY ARCHITECTURE

```text
QM Editor (working)/
├── docs/
│   ├── architecture/
│   │   ├── QM_EDITOR_ARCHITECTURE.md
│   │   └── DECISIONS.md
│   ├── DEVELOPMENT_GUIDE.md
│   └── CHANGE_SAFETY_CHECKLIST.md
├── src/
│   ├── app/                # Application entry points & shell composition
│   ├── components/         # Presentation UI components & layout panels
│   ├── config/             # Application environment configuration
│   ├── core/               # Domain models, business logic & unit tests
│   ├── services/           # Storage, persistence & external APIs
│   ├── state/              # State management providers & custom hooks
│   ├── types/              # TypeScript type definitions
│   ├── utils/              # Shared helper functions, logging & error hierarchy
│   ├── App.tsx             # Root UI layout shell
│   ├── index.css           # Global design system & theme CSS variables
│   └── main.tsx            # DOM initialization entry
├── QM Editor Logo.png       # Primary branding logo
├── .env.example            # Environment variables template
├── package.json            # Package dependencies & scripts
├── tsconfig.json           # TypeScript configuration
└── vite.config.ts          # Vite bundler configuration
```

---

## 4. CODE QUALITY & QUALITY GUARDRAILS

1. **Strict Type Safety:** Avoid `any` types. Define explicit interfaces in `src/types/`.
2. **Error Handling:** Instantiate standardized error classes from `src/utils/errors.ts`.
3. **Safe Logging:** Route output through `logger` in `src/utils/logger.ts`. Do not log secrets or sensitive content.
4. **Design System Tokens:** Use CSS variables defined in `src/index.css` rather than ad-hoc inline hex colors.
