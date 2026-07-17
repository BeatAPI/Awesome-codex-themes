# Limitless Six Eyes Theme Implementation Plan

> **For Codex:** Execute this plan test-first and verify restore behavior before pushing.

**Goal:** Ship one complete, installable flagship Codex theme with full semantic-token coverage, a safe declarative experience layer, gallery marketing, and live renderer evidence.

**Architecture:** Extend schema v2 with optional bounded experience metadata. Convert it into one injector-owned decorative DOM layer while the existing adapter continues to style native Codex surfaces. Package all styling and assets locally.

**Tech Stack:** Node.js ESM, Vitest, JSDOM, React 19, Vite 8, CSS, Codex CDP runtime injection.

---

### Task 1: Add declarative experience metadata

**Files:**
- Modify: `tests/engine/theme.test.mjs`
- Modify: `src/engine/theme.mjs`
- Modify: `docs/THEME_SCHEMA.md`

1. Add failing tests for valid experience metadata and malformed/missing fields.
2. Implement bounded string normalization and boolean chrome normalization.
3. Document that the field is declarative and cannot execute theme JavaScript.
4. Run the focused theme tests.

### Task 2: Add safe ambient chrome injection

**Files:**
- Modify: `tests/engine/injection.test.mjs`
- Modify: `src/engine/injection.mjs`

1. Add failing tests for content, idempotency, verification, and removal.
2. Serialize normalized metadata into the runtime payload.
3. Create one owned, inert, `aria-hidden` node with text assigned through `textContent`.
4. Extend verification and restore without touching unrelated injectors.
5. Run the focused injection tests.

### Task 3: Build the flagship theme package

**Files:**
- Create: `tests/themes/limitless-six-eyes.test.mjs`
- Create: `themes/limitless-six-eyes/theme.json`
- Create: `themes/limitless-six-eyes/theme.css`
- Create: `themes/limitless-six-eyes/background.jpg`
- Create: `themes/limitless-six-eyes/preview.png`
- Create: `themes/limitless-six-eyes/ASSET_LICENSE.md`

1. Add a failing contract test for all required workspace surfaces and project asset metadata.
2. Add the corrected preview and clean runtime artwork.
3. Implement the full 33-role palette and surface-specific CSS.
4. Regenerate and validate the catalog.

### Task 4: Promote the flagship in the gallery and repository

**Files:**
- Modify: `tests/gallery/app.test.tsx`
- Modify: `src/gallery/App.tsx`
- Modify: `src/gallery/styles.css`
- Modify: `README.md`
- Modify: `docs/STATUS.md`
- Modify: `CHANGELOG.md`

1. Add failing gallery expectations for five themes and flagship-first presentation.
2. Implement editorial flagship treatment while preserving the existing accessible detail dialog.
3. Make the new theme the primary quick-start example.
4. State the artwork metadata clearly.

### Task 5: Verify and publish

1. Run focused tests after every task.
2. Run `pnpm check`.
3. Apply to the local supported Codex renderer, inspect representative computed tokens and owned chrome, capture a screenshot, then restore.
4. Review the diff and repository status.
5. Fast-forward the clean main branch, rerun the full check, push to the existing GitHub repository, and confirm CI.
