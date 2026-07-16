# Implementation status

Last verified: 2026-07-16 (Asia/Shanghai)

## State definitions

- **Implemented**: present in this repository with automated coverage.
- **Prototype verified**: exercised successfully on the recorded local environment.
- **Packaged**: available as a versioned installable release artifact.
- **Publicly released**: published in a public repository or release channel.

## Current evidence

| Capability | State | Evidence |
| --- | --- | --- |
| Theme validator and schema | Implemented | Unit tests cover metadata, traversal, symlink confinement, size limits, CSS restrictions, colors, and version ranges. |
| CDP and macOS safety boundary | Implemented | Unit tests cover literal loopback, renderer allowlist, signature/Team ID, architecture, port owner and descendant checks. |
| One-shot apply and restore | Prototype verified | Applied Arctic Signal to one main renderer and restored it on the environment below. |
| Persistent managed watcher | Implemented, not live-smoke verified | Lifecycle and exact process identity are covered by isolated tests; the active user session was not closed to test a fresh launch. |
| Four original themes | Implemented, experimental | Packages validate and the generated catalog builds. A single local smoke does not justify changing broad compatibility status to verified. |
| Static Gallery | Implemented | Search/filter/detail/copy tests pass; production build and desktop/mobile browser render checks pass. |
| Release package/tag | Planned | No version tag or packaged public release yet. |
| Commercial Desktop | Out of scope | Intentionally absent. |

## Runtime smoke record

- Official app: `/Applications/ChatGPT.app`
- Bundle version: `26.707.72221`
- Architecture: arm64
- Bundle ID: `com.openai.codex`
- Team ID: `2DC432GLL2`
- Existing endpoint: `127.0.0.1:9225`
- Theme: `arctic-signal`
- Apply result: `applied arctic-signal to 1 renderer`
- Restore result: `restored official UI`
- Post-restore DOM check: `stylePresent=false`, `markerPresent=false`, `theme=null`
- Process behavior: no app restart or termination; live `start` refusal returned `APP_ALREADY_RUNNING` as designed.

This record proves a local prototype path on one app version. It is not evidence of broad compatibility, packaging, notarization, or public release.
