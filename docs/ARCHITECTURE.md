# Architecture

The repository is one package with three deliberately separated surfaces.

## Runtime engine

```text
bin/awesome-codex-themes
  → src/cli/main.mjs
    → macOS identity + port-owner inspection
    → theme package validation
    → verified or best-effort Codex adapter selection
    → CDP renderer allowlist
    → namespaced apply / verify / restore
    → owner-only runtime state
```

- `src/engine/theme.mjs` validates manifests, canonical paths, symlinks, sizes, CSS, assets, and live-verified version metadata.
- `src/engine/adapter.mjs` identifies live-verified version families and otherwise returns the shared trusted stylesheet as `codex-best-effort`.
- `src/engine/adapters/codex-26.707.css` is the live-verified shared semantic mapping used by separately identified `codex-26.707` and `codex-26.715` adapter records.
- `src/engine/macos.mjs` inspects signature/team/runtime identity, exact processes, and loopback port ownership using argv-based system tools.
- `src/engine/cdp.mjs` enforces literal-loopback HTTP/WebSocket endpoints, filters renderer targets, and wraps JSON CDP requests with timeouts.
- `src/engine/injection.mjs` builds data-only idempotent apply, verification, and removal expressions.
- `src/engine/state.mjs` validates and atomically stores exact app/watcher identity with owner-only permissions.
- `src/engine/session.mjs` composes apply/start/restore state transitions without terminating the official app.
- `src/engine/config.mjs` and `src/engine/agent-state.mjs` separate desired persistent configuration from observed process state.
- `src/engine/agent.mjs` implements idempotent reapply, managed relaunch, `restart-required`, pause, and typed failure transitions.
- `src/engine/installer.mjs` stages immutable user releases and atomically activates the stable `current` symlink.
- `src/engine/launch-agent.mjs` generates and controls the user LaunchAgent through argument-array `launchctl` calls, with bounded retry only for launchd's transient code 5 unload window.
- `src/engine/control.mjs` disables persistence before requesting verified live owned-style removal.
- `src/engine/conflicts.mjs` reports known legacy injectors and wildcard-origin processes without changing them.

Theme packages do not carry their own copy of the Codex compatibility layer. At apply time the engine loads the trusted shared adapter, records whether the app family is live-verified or best effort, appends the validated theme CSS, and injects both as one namespaced style element. Schema-v2 packages may also declare bounded experience copy; the engine converts that data into one inert, owned decorative node without accepting theme JavaScript or HTML. This keeps selector maintenance centralized while allowing themes to remain small and portable.

The public CLI keeps `_watch` and `_agent` internal. The shell entrypoint finds the official app's bundled Node runtime, while every mutating operation independently validates the application and endpoint.

## Persistent user installation

```text
Git clone (mutable source)
  → validated staging copy
  → ~/Library/Application Support/AwesomeCodexThemes/releases/0.4.3/
  → atomic current symlink
  → ~/Library/LaunchAgents/io.github.awesome-codex-themes.agent.plist
  → current/bin/awesome-codex-themes _agent
```

The service never points at the clone. Configuration and state remain outside immutable release directories, use owner-only permissions, and are written atomically. Reinstallation boots out only this project's label, updates the installed plist/current release, bootstraps, and kickstarts it. Uninstall removes only project-owned paths.

An enabled agent owns the CDP-enabled launch lifecycle. If an ordinary Dock launch is already running, it normally reports `restart-required` rather than touching it. Users who explicitly install with `--takeover-at-login` permit one narrowly bounded exception: during the first 120 seconds after boot, a single revalidated official PID may receive a normal macOS quit request, and only a confirmed complete exit is followed by a LaunchServices reopen. Multiple processes, changed identity, timeout, or any later session fail closed without force termination. This handles the macOS restore race while preserving the open-source CDP boundary.

## Theme catalog and static gallery

Theme packages are the source of truth. `scripts/build-catalog.mjs` validates them, emits `src/generated/themes.json`, and copies declared previews into `public/theme-assets`. React/Vite renders an account-free static catalog with client-side search and filters.

`themes/` contains the twelve complete runnable launch packages. The Featured tag is catalog metadata rather than a separate package type, and the build keeps every theme on the same engine, schema, and adapter path.

The Gallery cannot install a theme, call the runtime engine, or execute theme code. It exposes copyable commands and accurate compatibility metadata.

## Why this is not a monorepo

There is no commercial desktop client, hosted catalog service, entitlement system, or shared multi-app release train. A single package keeps the security boundary reviewable. A monorepo should be introduced only when an implemented second product surface requires independent packaging and release semantics.
