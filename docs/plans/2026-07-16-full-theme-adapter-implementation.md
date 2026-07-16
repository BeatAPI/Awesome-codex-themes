# Full Theme Adapter Implementation Plan

**Goal:** Add a versioned Codex `26.707` full-theme adapter and one complete semantic theme system that covers every requested visual surface while preserving safe restore.

**Architecture:** Load a trusted shared adapter from `src/engine/adapters/`, validate semantic theme palettes in schema v2, and compose adapter CSS with per-theme CSS in the existing owned style element. Keep schema v1 readable through deterministic palette expansion, migrate Obsidian Bloom to v2, and fail closed when no adapter supports the app version.

**Tech Stack:** Node.js 22 ESM, Vitest, JSDOM, CSS custom properties, Chromium DevTools Protocol, Vite/React gallery.

---

### Task 1: Semantic palette schema

**Files:**
- Modify: `src/engine/theme.mjs`
- Modify: `tests/engine/theme.test.mjs`

**Step 1: Write the failing tests**

Add tests requiring schema v2 to normalize every semantic color, reject a missing required role, and keep schema v1 manifests readable by deriving the expanded palette.

**Step 2: Run the focused test and verify RED**

Run: `pnpm vitest run tests/engine/theme.test.mjs`

Expected: FAIL because schema v2 and semantic roles are not implemented.

**Step 3: Implement the minimal schema support**

Accept schema versions 1 and 2. Validate all explicit v2 roles as six- or eight-digit hex colors. Expand v1 palettes deterministically without weakening existing path, CSS, asset, license, or compatibility checks.

**Step 4: Run the focused test and verify GREEN**

Run: `pnpm vitest run tests/engine/theme.test.mjs`

Expected: PASS.

### Task 2: Versioned adapter contract

**Files:**
- Create: `src/engine/adapter.mjs`
- Create: `src/engine/adapters/codex-26.707.css`
- Create: `tests/engine/adapter.test.mjs`

**Step 1: Write failing coverage tests**

Require a `26.707.*` adapter to contain representative rules for canvas/artwork, surfaces, text, icons, borders, menus, inputs, code/diff, hover/active/selection, scrollbars, composer, dialogs, and focus. Require unknown versions to fail with `THEME_ADAPTER_UNSUPPORTED`.

**Step 2: Run and verify RED**

Run: `pnpm vitest run tests/engine/adapter.test.mjs`

Expected: FAIL because the adapter module does not exist.

**Step 3: Implement the adapter loader and original CSS**

Read only the built-in local stylesheet selected by app version. Scope component rules under `html.awesome-codex-theme`; override official Codex/VS Code variables with `!important`; do not hide native controls or capture pointer events.

**Step 4: Run and verify GREEN**

Run: `pnpm vitest run tests/engine/adapter.test.mjs`

Expected: PASS.

### Task 3: Runtime composition and recovery

**Files:**
- Modify: `src/engine/injection.mjs`
- Modify: `src/engine/session.mjs`
- Modify: `tests/engine/injection.test.mjs`
- Modify: `tests/engine/session.test.mjs`

**Step 1: Write failing runtime tests**

Require adapter CSS to precede theme CSS, all semantic variables to be owned on the root, an adapter marker to be verified, idempotent re-apply to replace one style element, and restore to remove only Awesome Codex Themes variables/markers.

**Step 2: Run and verify RED**

Run: `pnpm vitest run tests/engine/injection.test.mjs tests/engine/session.test.mjs`

Expected: FAIL because the current payload has only five variables and no adapter marker.

**Step 3: Implement composition**

Load the matching adapter during `applyThemeAtPort`, pass it to the expression builder, set semantic variables through a fixed mapping, and extend verification/removal without touching unrelated styles.

**Step 4: Run and verify GREEN**

Run: `pnpm vitest run tests/engine/injection.test.mjs tests/engine/session.test.mjs`

Expected: PASS.

### Task 4: Migrate and tune one repository theme

**Files:**
- Modify: `themes/obsidian-bloom/theme.json`
- Modify: `themes/obsidian-bloom/theme.css`
- Modify: `tests/themes/catalog.test.mjs`
- Regenerate: `src/generated/themes.json`

**Step 1: Write failing catalog assertions**

Require Obsidian Bloom to use schema v2, expose the full semantic palette, and be marked as the primary full-coverage experimental theme. Require the other launch themes to remain explicit schema-v1 legacy packages.

**Step 2: Run and verify RED**

Run: `pnpm vitest run tests/themes/catalog.test.mjs`

Expected: FAIL because Obsidian Bloom remains schema v1.

**Step 3: Migrate Obsidian Bloom**

Provide a complete accessible dark palette for Obsidian Bloom. Keep package CSS limited to artwork composition and small theme-specific refinements; bump its version to `1.1.0`. Leave Arctic Signal, Paper Circuit, and Solar Archive on schema v1 until separate tuning work is approved.

**Step 4: Generate and verify GREEN**

Run: `pnpm build && pnpm vitest run tests/themes/catalog.test.mjs`

Expected: PASS.

### Task 5: Documentation and project status

**Files:**
- Modify: `README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/THEME_SCHEMA.md`
- Modify: `docs/STATUS.md`
- Modify: `NOTICE.md` if reference attribution needs clarification

Document the high-coverage versus permanent-full-coverage boundary, supported version family, semantic token list, contributor rules, and exact test command. Keep all themes `experimental` until runtime page coverage is recorded.

Run: `git diff --check`

Expected: exit 0.

### Task 6: Full verification and live smoke

**Files:**
- Create only if useful: `artifacts/` output remains untracked.

Run automated verification:

```bash
pnpm check
```

Then apply Obsidian Bloom to the already CDP-enabled official app on `127.0.0.1:9225`, verify the adapter/theme markers and representative computed tokens, capture a screenshot for visual inspection, and run restore. Confirm the Awesome style, marker, and variables are absent after restore and any unrelated existing style remains.

### Task 7: Review, integrate, and publish

Inspect the complete diff against the design and run a local code review. Fix all critical or important findings. Merge `feat/full-theme-adapter` into `main`, rerun `pnpm check` on main, push `origin/main`, and verify the remote commit and GitHub Actions result.
