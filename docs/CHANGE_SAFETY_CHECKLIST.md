# QM EDITOR — CHANGE SAFETY CHECKLIST

Before submitting any code modification or declaring a step complete, verify that every item on this checklist has been executed.

---

## 1. ARCHITECTURE & CODE DISCIPLINE
- [ ] Read relevant architecture documentation in `docs/architecture/`
- [ ] Inspected target files before making edits
- [ ] Preserved existing public signatures and exported interfaces
- [ ] Verified module dependencies flow top-down (UI → Application → Core → Infrastructure)
- [ ] Ensured no circular imports or unnecessary barrel files were introduced

## 2. PRESERVATION & RECOVERY
- [ ] Verified existing features continue to function as expected
- [ ] Preserved UI visual identity, colors, font hierarchy, and logo asset (`QM Editor Logo.png`)
- [ ] Confirmed user configuration and document persistence models are undamaged

## 3. SECURITY & CONFIGURATION
- [ ] Verified no API keys, tokens, or credentials are hard-coded
- [ ] Confirmed sensitive files are listed in `.gitignore`
- [ ] Checked that logging routes through `logger` without leaking sensitive text

## 4. VERIFICATION & VALIDATION
- [ ] Executed type check (`cmd /c npm run type-check`) and resolved all TypeScript errors
- [ ] Executed tests (`cmd /c npm run test`) and verified 100% pass rate
- [ ] Executed build (`cmd /c npm run build`) and confirmed bundle compiles without errors
- [ ] Reviewed `git status` and `git diff` to confirm zero unintended files were modified
