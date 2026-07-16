# Architecture

The repository is one package with two deliberately separate surfaces.

## Runtime engine

```text
bin/awesome-codex-themes
  → src/cli/main.mjs
    → macOS identity + port-owner inspection
    → theme package validation
    → versioned Codex adapter selection
    → CDP renderer allowlist
    → namespaced apply / verify / restore
    → owner-only runtime state
```

- `src/engine/theme.mjs` validates manifests, canonical paths, symlinks, sizes, CSS, assets, and version ranges.
- `src/engine/adapter.mjs` selects a trusted built-in compatibility stylesheet for the exact supported Codex version family.
- `src/engine/adapters/codex-26.707.css` maps semantic theme variables onto Codex/VS Code design tokens and stable component surfaces.
- `src/engine/macos.mjs` inspects signature/team/runtime identity, exact processes, and loopback port ownership using argv-based system tools.
- `src/engine/cdp.mjs` enforces literal-loopback HTTP/WebSocket endpoints, filters renderer targets, and wraps JSON CDP requests with timeouts.
- `src/engine/injection.mjs` builds data-only idempotent apply, verification, and removal expressions.
- `src/engine/state.mjs` validates and atomically stores exact app/watcher identity with owner-only permissions.
- `src/engine/session.mjs` composes apply/start/restore state transitions without terminating the official app.

Theme packages do not carry their own copy of the Codex compatibility layer. At apply time the engine loads the matching trusted adapter, appends the validated theme CSS, and injects both as one namespaced style element. This keeps selector maintenance centralized while allowing themes to remain small and portable.

The public CLI keeps `_watch` internal. The shell entrypoint finds the official app's bundled Node runtime, while every mutating operation independently validates the application and endpoint.

## Static gallery

Theme packages are the source of truth. `scripts/build-catalog.mjs` validates them, emits `src/generated/themes.json`, and copies declared previews into `public/theme-assets`. React/Vite renders an account-free static catalog with client-side search and filters.

The Gallery cannot install a theme, call the runtime engine, or execute theme code. It exposes copyable commands and accurate compatibility metadata.

## Why this is not a monorepo

There is no commercial desktop client, hosted catalog service, entitlement system, or shared multi-app release train. A single package keeps the security boundary reviewable. A monorepo should be introduced only when an implemented second product surface requires independent packaging and release semantics.
