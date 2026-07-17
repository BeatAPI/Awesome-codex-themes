# Persistent Theme Platform Design

## Purpose

Awesome Codex Themes is an English-first, Mac-first open-source theme platform for technical users of the official Codex Desktop app. It ships a small audited CDP engine, a persistent user agent, a declarative theme format, a safe restore path, and a catalog designed to grow to twelve complete themes.

The first release theme is **Satoru Gojo (五条 悟)**. Eleven additional theme slots remain intentionally non-runnable until their original or redistributable asset packs are supplied. Empty slots must never appear as installable themes.

## Product boundary

The repository provides:

- local theme discovery and selection;
- loopback-only CDP launch, injection, verification, and removal;
- idempotent reapplication after renderer reload;
- persistent recovery after app exit/relaunch and macOS login;
- live-verified compatibility metadata, best-effort fallback, and explicit recovery;
- user-level install, status, switch, pause, restore, upgrade, and uninstall commands;
- an English static gallery and English contributor documentation;
- a shared schema and adapter boundary for twelve independent theme packages.

It does not patch or redistribute the official app, create a second Codex data profile, read conversations or credentials, execute theme JavaScript, download remote theme code, or silently terminate a running Codex process.

## Evaluated persistence approaches

### Repository-bound LaunchAgent

A plist can point directly at the cloned repository. This is small but fragile: moving, deleting, or switching the clone can break login startup. It is unsuitable for a public release.

### Self-contained user installation — selected

The installer copies the audited runtime and runnable themes into a versioned directory below `~/Library/Application Support/AwesomeCodexThemes/`. A LaunchAgent calls a stable `current` installation path. Configuration and operational state live beside, but outside, the immutable runtime copy.

This approach is inspectable, reversible, updateable, and does not require a global Node installation because the launcher locates the Node runtime bundled with the validated official app.

### Signed helper application

A signed helper could provide the best consumer experience, but it duplicates the later commercial desktop-manager boundary. It is intentionally deferred.

## Installed layout

```text
~/Library/Application Support/AwesomeCodexThemes/
├── config.json                 # owner-only desired state
├── agent-state.json            # owner-only observed state
├── current -> releases/0.3.0/  # atomically switched release
└── releases/
    └── 0.3.0/
        ├── bin/awesome-codex-themes
        ├── package.json
        ├── src/cli/
        ├── src/engine/
        └── themes/             # runnable, validated packages only

~/Library/LaunchAgents/
└── io.github.awesome-codex-themes.agent.plist
```

The LaunchAgent never points at a Git clone. Installation uses a temporary release directory, validates its required files, and swaps `current` only after the copy succeeds.

## Desired configuration

```json
{
  "schemaVersion": 1,
  "enabled": true,
  "themeSlug": "satoru-gojo",
  "launchAtLogin": true
}
```

Configuration is declarative. `switch <theme>` changes only `themeSlug`; the running agent observes the change and reapplies the new package. `pause` sets `enabled` to false and removes owned renderer state when reachable. `resume` enables the configured theme again.

## Agent lifecycle

1. LaunchAgent starts the user agent at login with `RunAtLoad` and `KeepAlive`.
2. The agent validates the installed configuration, official app identity, signature, Team ID, architecture, and selected theme.
3. If Codex is not running and persistent mode is enabled, the agent launches the official executable with a dynamically selected `127.0.0.1` CDP port. It does not pass `--user-data-dir`, so the user's existing Codex profile remains authoritative.
4. The agent verifies that the listener belongs to the official process, waits for the allowlisted renderer, applies the selected theme, and records observed state.
5. While the same app process is alive, the agent reapplies idempotently so renderer reloads recover automatically.
6. When the app exits, the agent clears transient process state and starts a new managed session while persistent mode remains enabled. The explicit `pause` and `uninstall-agent` commands are the supported way to stop persistent relaunch.
7. If Codex is already running without a trusted local CDP listener, the agent reports `restart-required` and leaves the process untouched. It never kills or restarts an active session.
8. Every valid numeric Codex version attempts the shared mapping. Live-verified families use dedicated markers; other versions use `codex-best-effort` and rely on `pause`/`restore` if visual compatibility has drifted.

## Commands

| Command | Behavior |
| --- | --- |
| `list` | List runnable validated theme packages. |
| `doctor` | Inspect the official app, installed agent, configuration, conflicts, and recovery path without mutation. |
| `start <theme>` | Start a session-scoped managed launch. |
| `install-agent <theme>` | Install the self-contained runtime, save the desired theme, and bootstrap persistent mode. |
| `upgrade-agent` | Stage the current source release while preserving the installed theme and enabled/paused state. |
| `switch <theme>` | Validate and persist a new active theme for the installed agent. |
| `pause` | Disable persistent launch/reapply and remove owned live styling when reachable. |
| `resume` | Re-enable the saved theme without changing its selection. |
| `status` | Report desired theme, service state, app/CDP state, compatibility, and last error. |
| `restore` | Remove project-owned live styling and stop session-scoped management. |
| `uninstall-agent` | Boot out the LaunchAgent, restore owned styling when reachable, and remove installed runtime/configuration. |

Every mutating command prints the exact installed paths and recovery command. Stable error codes remain part of the public interface.

## Theme catalog and twelve-slot model

`themes/` contains runnable packages only. Each directory must pass the schema and asset validator before it appears in CLI output or the Gallery.

`theme-slots/` contains eleven numbered planning slots. A slot is documentation and intake metadata, not a partial theme package. It has no apply command and is excluded from catalog generation. When assets arrive, a slot receives a real English name, optional native-language display name, design brief, component specification, package, QA evidence, and only then moves into `themes/<slug>/`.

The four existing study themes are preserved outside the release catalog under `examples/legacy-themes/`. They remain useful engine fixtures but do not consume any of the eleven planned user-supplied slots.

## Naming and language policy

All project documentation, CLI text, code comments, metadata descriptions, issue templates, release notes, and Gallery copy are English.

Theme display metadata supports:

```json
{
  "name": "Satoru Gojo",
  "nativeName": "五条 悟",
  "nativeLocale": "ja-JP"
}
```

English is primary. A native name is optional and appears only when it is culturally meaningful. Slugs, filenames, commands, and schema keys remain lowercase ASCII English. Chinese appears only as a native language for a Chinese-origin theme.

Public Satoru Gojo files and UI do not use internal visual-iteration labels. The development snapshots remain in a local backup; the public package contains one current theme.

## Complete theme package contract

A runnable theme includes schema-valid metadata, semantic palette coverage, scoped CSS, runtime artwork, named UI assets, preview media, asset provenance, compatibility declarations, and P0 component coverage. A theme is not complete when it is only a wallpaper.

The shared engine owns version-sensitive selectors. Theme CSS owns only visual decisions below `html.awesome-codex-theme`. Decorative nodes are inert and pointer-transparent. Compatibility remains `experimental` until recorded live QA proves the declared surface matrix and restore behavior on an exact Codex version.

## Safety and recovery

- CDP binds to a dynamic port on literal `127.0.0.1`; wildcard origins are not used.
- The listener must belong to the validated official app process.
- The agent never modifies the app bundle or sets a second data directory.
- The agent never reads renderer content beyond owned markers and computed theme verification.
- Existing third-party injectors are detected and reported as conflicts; they are never silently deleted.
- Agent and runtime state are owner-only and atomically written.
- Install and update operations are rollback-safe.
- `uninstall-agent` and a documented manual `launchctl bootout` path remain available even if the Gallery or agent is broken.

## Verification

Automated tests cover configuration validation, release copying, plist generation, launchctl argument arrays, theme switching, agent state transitions, best-effort version fallback, conflict reporting, and restore/uninstall idempotence. Existing CDP, signature, port-owner, renderer, injection, and theme-schema tests remain mandatory.

macOS integration evidence must separately verify renderer reload, app exit/relaunch, login-agent bootstrap, theme switch, best-effort fallback and recovery, restore, uninstall, and preservation of the existing Codex profile. Linux CI validates pure generation and state-machine behavior without attempting to load launchd.
