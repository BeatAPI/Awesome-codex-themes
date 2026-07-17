# Awesome Codex Themes — Product & Architecture Design

## Product boundary

Awesome Codex Themes is an unofficial, global, Mac-first open-source theme system for the official Codex Desktop app. The first release is deliberately smaller than a commercial desktop product: it provides a dependable CLI, a documented theme package format, a searchable static gallery, original example themes, diagnostics, and a recovery path. It does not include payments, accounts, entitlements, remote JavaScript, a hosted marketplace, or a signed GUI.

The project is independently implemented. `Fei-Away/Codex-Dream-Skin` and `Cmochance/codex-app-transfer` are architecture references for local-loopback CDP injection, application identity checks, idempotent apply/remove behavior, lifecycle handling, and restoration. No upstream artwork or product branding is shipped. Any source-level reuse must be isolated, attributed, and covered by its original license in `THIRD_PARTY_NOTICES.md`.

The gallery borrows product patterns—not code—from open prompt libraries: an image-first catalogue, structured tags, compact search, stable item metadata, one-click copy actions, and a contribution flow based on small declarative files. Code is MIT. Theme artwork has explicit per-theme provenance and licensing.

## Architecture

The repository is a single package instead of a premature multi-app monorepo. Runtime-neutral modules live in `src/engine/`: theme validation and loading, CDP target selection, loopback URL enforcement, injection expression construction, state handling, and macOS application inspection. `src/cli/main.mjs` composes those modules into `list`, `doctor`, `start`, `apply`, `status`, and `restore` commands. `bin/awesome-codex-themes` locates the Node runtime bundled in the official app, so end users do not need a global Node installation.

`themes/<slug>/theme.json` is the public extension boundary. A theme contains metadata, palette/tokens, optional local artwork, preview information, and CSS. Themes cannot run arbitrary remote JavaScript. The runtime reads local files, validates paths and size limits, converts artwork to a local data URL, and injects a single namespaced style element and root marker. Applying twice replaces the existing payload. Restoring removes only project-owned DOM/style state.

The React/Vite gallery reads generated theme metadata. It remains static and account-free, with search, category filters, preview cards, detail panels, compatibility notes, and a copyable CLI command. GitHub Actions validates every theme, runs tests, builds the gallery, and uploads the static artifact.

## Safety and lifecycle

The engine discovers `/Applications/ChatGPT.app` and legacy `Codex.app` locations on every run, then validates bundle identifier `com.openai.codex`, OpenAI Team ID `2DC432GLL2`, code signature, architecture, and the bundled Node runtime. CDP must bind to `127.0.0.1` on a dynamically selected port. Target WebSocket URLs must be loopback-only and renderer URLs must use the expected `app://` scheme.

The CLI never silently terminates an active Codex session. If Codex is already running without a usable debugging endpoint, `start` stops with an explanation and asks the user to quit the app explicitly. A future explicit restart flag may be added only after tests cover unsaved-session protection. State records app identity, port, injector PID/start time, theme slug, and paths so the process can refuse unsafe PID reuse.

Every valid numeric Codex version receives a documented best-effort adapter attempt. `restore` always remains available and removes only Awesome Codex Themes state. The official app bundle, `app.asar`, accounts, conversations, API keys, provider configuration, and unrelated Codex settings are never read or modified.

## Error handling and verification

Errors are structured for humans and automation: stable codes such as `APP_NOT_FOUND`, `SIGNATURE_INVALID`, `CDP_UNAVAILABLE`, `UNSUPPORTED_VERSION`, `THEME_INVALID`, and `RESTORE_INCOMPLETE` accompany concise recovery instructions. Commands return non-zero status on incomplete work. Logs contain operational metadata but never task content or account data.

Tests are organized around the safety boundary. Unit tests cover manifest validation, path traversal, size and color rules, loopback URL validation, target filtering, state/PID identity checks, and injection idempotency/removal. CLI tests exercise list/help/doctor behavior with isolated fixtures. Gallery tests cover search, filters, details, and copy commands. A macOS smoke test can attach to an already-authorized local CDP endpoint, apply a fixture theme, verify namespaced markers, and restore immediately without restarting the app. Release verification requires tests, typecheck, gallery build, theme validation, deterministic security scanning, and a manual diff review.
