# Changelog

All notable changes are documented here. The project follows semantic versioning after its first tagged release.

## [Unreleased]

### Added

- Explicit `--takeover-at-login` installation mode for automatic theme recovery when macOS restores Codex during boot.
- A one-shot 120-second startup handoff that revalidates one official PID, uses normal app quit, confirms complete exit, and fails closed without signals or force quit.
- LaunchServices-based managed startup with real official PID discovery and transient app-discovery retry behavior.
- Self-contained per-user runtime installation with an atomic versioned `current` release.
- User LaunchAgent commands: `install-agent`, `upgrade-agent`, `switch`, `pause`, `resume`, and `uninstall-agent`.
- Portable `release:check` command and CI gate for tests, themes, types, build, production dependency audit, public-file hygiene, and diff whitespace.
- A separately identified `codex-26.715` adapter backed by the live-verified shared semantic mapping.
- A `codex-best-effort` fallback that attempts the shared mapping on every valid numeric Codex Desktop version.
- Bounded retry handling for launchd's transient code 5 unload/bootstrap race.
- Persistent `status` now verifies that the user LaunchAgent is loaded before reporting `active`.
- Persistent desired configuration and observed agent state with owner-only atomic files.
- Idempotent renderer reapply, managed app relaunch, and safe `restart-required` handling.
- Read-only diagnostics for known legacy injectors and unsafe wildcard-origin launches.
- English-first theme metadata with optional paired `nativeName` and `nativeLocale` fields.
- Eleven additional Schema 2 theme packages, completing the twelve-theme launch collection.
- A visual README atlas with one project hero and paired background/marketing assets for every theme.
- A persistent right-panel host marker and independently framed panel background so the entire summary rail keeps visible artwork after Codex rerenders.
- Installation, migration, authoring, recovery, architecture, and safety documentation.

### Changed

- **Satoru Gojo (五条 悟)** `1.2.0` remains the Featured package under the stable `satoru-gojo` slug. It is attempted on every numeric Codex Desktop version and marks `26.707.*` and `26.715.*` as live-verified.
- Four early engineering study themes and the temporary intake-slot scaffolding were removed from the release candidate.
- Theme submissions use an explicit provenance and necessary-rights declaration.

## Private prototype history (not publicly released)

The private `0.2.0` repository snapshot established the initial engine research baseline. It was never tagged or published as a GitHub Release.

### Added

- Independent Mac-first theme engine and session CLI with `list`, `doctor`, `start`, `apply`, `status`, and `restore`.
- Signed app identity, literal-loopback CDP, listener ownership, renderer allowlist, compatibility, and process-identity checks.
- Versioned local theme schema with safe path, CSS, asset, and size validation.
- Optional declarative experience metadata and idempotent owned chrome injection/removal.
- Static React/Vite Gallery, automated tests, CI, security policy, and contribution templates.

[Unreleased]: https://github.com/BeatAPI/Awesome-codex-themes/commits/main
