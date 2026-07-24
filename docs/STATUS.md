# Implementation status

Last verified: 2026-07-21 (Asia/Shanghai)

## State definitions

- **Implemented**: present in this repository with automated coverage.
- **Prototype verified**: exercised successfully on the recorded local environment.
- **Integration verified**: exercised through the installed macOS service boundary.
- **Packaged**: available as a versioned installable release artifact.
- **Publicly released**: published in a public repository or release channel.

## Current evidence

| Capability | State | Evidence |
| --- | --- | --- |
| Theme validator and schema | Implemented | Schema v2 validates 33 semantic roles, local assets, CSS, compatibility, and paired native-name metadata. |
| CDP and macOS safety boundary | Implemented | Tests cover literal loopback, renderer allowlist, signature/Team ID, architecture, and port-owner checks. |
| One-shot apply and owned restore | Prototype verified | The engine applied and removed the current Satoru Gojo package on the recorded official app renderer without editing the app bundle. |
| Renderer reload reapply | Integration verified | A new 26.715 renderer document started without markers and regained the one owned style/chrome pair on the fourth 500 ms observation. |
| Self-contained versioned installer | Implemented | Isolated filesystem tests cover staging, atomic activation, configuration, permissions, replacement, and cleanup. |
| User LaunchAgent | Integration verified | The legacy plist was backed up and replaced; install, bootout/bootstrap, kickstart, pause/resume, upgrade, and uninstall ran through the real user service boundary. `status` also requires the service to be loaded before it reports `active`. |
| Full app exit/relaunch recovery | Integration verified | An unmanaged process transitioned through `restart-required` and was replaced by a verified CDP-managed official process without a second profile. |
| Login service bootstrap | Implemented and integration verified; physical reboot pending | `RunAtLoad`/`KeepAlive`, LaunchServices PID acquisition, and an opt-in one-shot 120-second login handoff have automated coverage. A real bootout/bootstrap and managed app restart were verified; a full physical reboot after this implementation is still pending. |
| Best-effort version fallback | Implemented | Automated coverage confirms every valid numeric app version selects the shared `codex-best-effort` adapter instead of being rejected. Live visual verification on an unverified future build remains pending. |
| Satoru Gojo (native Japanese name: 五条 悟) | Featured complete package, experimental compatibility | Version `1.2.1` is live-verified on 26.707/26.715 with current assets, owned-state behavior, persistent lifecycle recovery, stable typing geometry, and collision-safe status chrome. |
| Twelve-theme collection | Implemented and current-version verified | Satoru Gojo is Featured. Eleven additional Schema 2 packages include complete local backgrounds, previews, CSS, metadata, and component assets; all eleven passed the recorded 26.715 workspace, right-panel, home, plugins, scheduled, sites, pull-request, and narrow-window matrix. Compatibility remains experimental outside the recorded builds. |
| Static Gallery | Implemented | Catalog, search, native-name discovery, detail, copy, and production-build tests are present. |
| GitHub repository | Publicly released | The repository is public under `BeatAPI/Awesome-codex-themes`; no tagged GitHub Release has been created yet. |
| Signed GUI / commercial desktop manager | Out of scope | Intentionally absent from this open-source repository. |

## Recorded local prototype environment

- Official app: `/Applications/ChatGPT.app`
- Bundle version: `26.715.21425` (updated during the audit from `26.707.91948`)
- Architecture: arm64
- Bundle ID: `com.openai.codex`
- Team ID: `2DC432GLL2`
- Observed managed endpoint: `127.0.0.1:9341` (dynamic for this run)
- Current public theme slug: `satoru-gojo`
- Adapter family: `codex-26.715` using the shared 26.707/26.715 semantic mapping

The active renderer was checked for owned style/chrome markers, theme variables, workspace classification, idempotent apply, renderer reload reapply, pointer-transparent decoration, and complete owned-state removal. Private screenshots with active workspace content and internal visual iteration labels remain local development evidence and are not public release assets. See the sanitized [26.715 lifecycle audit](audits/2026-07-17-satoru-gojo-26.715-lifecycle-audit.md).

The current source candidate is `0.4.5`. It retains the verified `26.715.52143` renderer behavior and adds a direct signed-executable launch path for `26.721+`, where LaunchServices was observed to drop the loopback CDP flags. On `26.721.30844`, the installed agent reached `active` on `127.0.0.1:9341` and the renderer exposed one owned `satoru-gojo` style, one pointer-transparent chrome node, and the expected best-effort adapter marker. A complete visual page matrix, exact-commit CI, and a physical reboot remain separate gates.

The legacy injector plist and script were backed up outside the repository before migration. The old plist is no longer present in `~/Library/LaunchAgents`; its source script was not deleted.

## Evidence boundary

The approved live session recorded the unmanaged `restart-required` transition, renderer reload reapply, pause and owned-state removal, paused-state upgrade, resume, managed relaunch, a real LaunchAgent bootout/bootstrap cycle, the former unknown-version safe mode before the policy changed, uninstall, and a successful reinstall with the original Codex profile preserved.

A clean release candidate passed `release:check`: 34 test files / 272 tests, all 12 theme packages, TypeScript, production Gallery build, production dependency audit, public-file hygiene, and diff whitespace. The public repository and anonymous clone path are live. Remaining tagged-release gates are a physical logout/reboot observation, the exact-commit CI result, and an explicit version-tag decision.
