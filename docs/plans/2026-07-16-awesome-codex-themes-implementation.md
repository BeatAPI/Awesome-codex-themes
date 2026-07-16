# Awesome Codex Themes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build and privately publish a Mac-first MIT Codex Desktop theme engine, original theme catalogue, and static searchable gallery in a new independent repository.

**Architecture:** A dependency-light Node ESM engine owns validation, CDP communication, safe injection, macOS discovery, state, and CLI commands. A Vite/React frontend renders generated metadata from declarative theme packages. Runtime code never executes remote theme JavaScript and never mutates the official application bundle.

**Tech Stack:** Node.js ESM, Bash, React 19, TypeScript, Vite, Vitest, Testing Library, jsdom, CSS, GitHub Actions.

---

### Task 1: Repository foundation

**Files:**
- Create: `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `vite.config.ts`, `index.html`
- Create: `.gitignore`, `.editorconfig`, `.github/workflows/ci.yml`

1. Add package scripts for `test`, `typecheck`, `build`, `themes:validate`, and `check`.
2. Install only the dependencies needed by the engine tests and gallery.
3. Confirm `pnpm test` starts with no tests and `pnpm build` has an intentionally missing entry until Task 7.

### Task 2: Theme contract (TDD)

**Files:**
- Test: `tests/engine/theme.test.mjs`
- Create: `src/engine/theme.mjs`
- Create: `docs/theme-schema.md`

1. Write failing tests for required metadata, slug rules, local-only artwork paths, traversal rejection, byte limits, palette validation, and CSS loading.
2. Run `pnpm vitest run tests/engine/theme.test.mjs`; verify failures are caused by the absent module.
3. Implement the smallest validator/loader that passes.
4. Run the focused test and then all tests.

### Task 3: Safe injection contract (TDD)

**Files:**
- Test: `tests/engine/injection.test.mjs`
- Create: `src/engine/injection.mjs`

1. Write failing jsdom tests proving apply is namespaced, idempotent, text-safe, and removable without touching unrelated styles/classes.
2. Run the test and confirm the expected missing-module failure.
3. Implement apply/remove expressions with `awesome-codex-theme-*` identifiers.
4. Verify focused and full test suites.

### Task 4: CDP and state safety (TDD)

**Files:**
- Test: `tests/engine/cdp.test.mjs`, `tests/engine/state.test.mjs`
- Create: `src/engine/cdp.mjs`, `src/engine/state.mjs`

1. Write failing tests for loopback-only HTTP/WebSocket URLs, accepted `app://` renderers, rejected web/extension targets, command timeouts, state schema, and PID identity comparison.
2. Implement target discovery, a minimal CDP client, dynamic port selection helpers, and atomic state helpers.
3. Verify no wildcard listener/origin is introduced.

### Task 5: macOS inspection and CLI (TDD)

**Files:**
- Test: `tests/engine/macos.test.mjs`, `tests/cli/main.test.mjs`
- Create: `src/engine/macos.mjs`, `src/cli/main.mjs`, `bin/awesome-codex-themes`

1. Write failing fixture-driven tests for app discovery, bundle/team/version parsing, explicit-running-session refusal, CLI help/list/status/doctor output, and stable error codes.
2. Implement command execution behind injectable adapters so tests never terminate or launch the real app.
3. Add `start`, `apply`, and `restore` composition, keeping explicit user quit as the only v0.1 restart path.
4. Verify shell syntax and all CLI tests.

### Task 6: Original themes and catalogue generation (TDD)

**Files:**
- Test: `tests/themes/catalog.test.mjs`
- Create: `themes/{obsidian-bloom,solar-archive,arctic-signal,paper-circuit}/**`
- Create: `scripts/build-catalog.mjs`, `src/generated/themes.json`

1. Write a failing test requiring four valid, uniquely tagged, explicitly licensed themes.
2. Create original SVG/CSS assets and manifests without third-party characters, logos, or artwork.
3. Build stable catalogue JSON and verify all themes.

### Task 7: Searchable gallery (TDD)

**Files:**
- Test: `tests/gallery/app.test.tsx`
- Create: `src/gallery/{main.tsx,App.tsx,styles.css,types.ts}`

1. Write failing tests for text search, category filters, empty state, theme detail selection, compatibility copy, and copied apply command.
2. Implement an editorial image-first gallery using generated theme metadata.
3. Add responsive and reduced-motion behavior.
4. Run component tests, typecheck, and production build.

### Task 8: Documentation, licensing, and community surface

**Files:**
- Create: `README.md`, `LICENSE`, `NOTICE.md`, `THIRD_PARTY_NOTICES.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`
- Create: `.github/ISSUE_TEMPLATE/**`, `.github/pull_request_template.md`

1. Document actual shipped state only, installation, recovery, theme contribution, privacy boundaries, and unofficial status.
2. Use MIT for original code and explicit license/provenance per theme asset.
3. Record conceptual references and exact source reuse, if any.

### Task 9: Live smoke, security gate, and private GitHub publication

**Files:**
- Create: `scripts/smoke-live.mjs` if the existing CDP endpoint is suitable.

1. Run full `pnpm check` and inspect complete output.
2. If safe, apply a fixture theme to the existing loopback CDP session, verify markers, and restore immediately; never restart Codex.
3. Run the deterministic pre-commit scanner before and after staging, then manually review the full diff against the security checklist.
4. Commit on `main`, create `erickkkyt/Awesome-codex-themes` as a private repository, push with tracking, and verify remote visibility and commit SHA.
5. Open `/Users/kkkk/Desktop/Awesome-codex-themes` in GitHub Desktop and verify the app received the repository path.

