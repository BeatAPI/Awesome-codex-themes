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
| Theme validator and schema | Implemented | Schema v2 requires 33 semantic color roles; schema v1 remains readable through deterministic expansion. Unit tests cover metadata, traversal, symlink confinement, size limits, CSS restrictions, colors, and version ranges. |
| CDP and macOS safety boundary | Implemented | Unit tests cover literal loopback, renderer allowlist, signature/Team ID, architecture, port owner and descendant checks. |
| Versioned full-workspace adapter | Prototype verified | The `codex-26.707` adapter was applied with Obsidian Bloom to one main renderer; semantic tokens, live menu and Composer surfaces, and owned-state removal were inspected on the environment below. |
| One-shot apply and restore | Prototype verified | Applied Obsidian Bloom to one main renderer and restored it without restarting or terminating the app. |
| Persistent managed watcher | Implemented, not live-smoke verified | Lifecycle and exact process identity are covered by isolated tests; the active user session was not closed to test a fresh launch. |
| Limitless Six Eyes flagship theme | Prototype verified, experimental | The schema-v2 palette, declarative experience layer, workspace/home classifier, single-surface Composer treatment, one-shot apply, and owned-state restore were exercised locally. The private prototype artwork is not cleared for public release. |
| Obsidian Bloom full theme | Prototype verified, experimental | The complete palette and current conversation workspace were exercised locally. Menus and Composer were opened/inspected, but the complete settings/editor/diff page matrix has not been live-smoke tested. |
| Three original legacy themes | Implemented, experimental | Packages remain on schema v1 and are included for compatibility; they have not been tuned as full-workspace themes. |
| Static Gallery | Implemented | Search/filter/detail/copy tests pass; production build and desktop/mobile browser render checks pass. |
| Release package/tag | Planned | No version tag or packaged public release yet. |
| Commercial Desktop | Out of scope | Intentionally absent. |

## Runtime smoke record

- Official app: `/Applications/ChatGPT.app`
- Bundle version: `26.707.91948`
- Architecture: arm64
- Bundle ID: `com.openai.codex`
- Team ID: `2DC432GLL2`
- Existing endpoint: `127.0.0.1:9225`
- Theme: `obsidian-bloom` schema v2 (`1.1.0`)
- Adapter: `codex-26.707`
- Apply result: `applied obsidian-bloom to 1 renderer`
- Runtime markers: owned style present, theme and adapter datasets exact, 33 semantic variables installed.
- Token checks: panel, text, icon, border, menu, input, code, hover, selection, and scrollbar tokens resolved to the Obsidian Bloom palette.
- Live surfaces: root background `rgb(16, 15, 14)`; Composer `rgba(25, 22, 19, 0.95)` with the strong theme border; an opened five-item menu `rgba(23, 20, 17, 0.95)` with themed text and border.
- Visual check: a `3024 × 1752` renderer screenshot was inspected locally and intentionally not committed because it contained active workspace content.
- Restore result: `restored official UI`
- Post-restore DOM check: owned style/class/datasets absent and all `--act-*` variables removed.
- Concurrent injector check: the pre-existing unrelated `cat-theme-style` was temporarily disabled only for the clean visual smoke, then re-enabled; after Awesome restore its `nocturne-mumbai` marker and `2,472,703`-character stylesheet were unchanged.
- Process behavior: no app restart or termination; live `start` refusal returned `APP_ALREADY_RUNNING` as designed.

This record proves a local prototype path on one app version. It is not evidence of broad compatibility, packaging, notarization, or public release.

## Limitless Six Eyes smoke record

- Official app and endpoint: same `26.707.91948` main renderer on `127.0.0.1:9225`.
- Theme and adapter: `limitless-six-eyes` schema v2 (`0.1.0`) with `codex-26.707`.
- Apply result: `applied limitless-six-eyes to 1 renderer`.
- Workspace classification: root marker resolved to `workspace`; no home marker was present.
- Visual behavior: the active task view kept a quiet artwork-free workspace, the large identity/status chrome was hidden, the selected sidebar item used the compact violet treatment, and Composer rendered as one `15px` surface rather than nested chrome.
- Visual check: a main-renderer screenshot was inspected locally and intentionally not committed because it contained active workspace content.
- Restore result: `restored official UI`.
- Post-restore DOM check: owned style, chrome node, class, and surface marker were absent.
- Concurrent injector check: the unrelated `cat-theme-style` was temporarily disabled for the clean smoke and restored to `disabled: false` with its `2,472,703`-character stylesheet unchanged.

This smoke verifies the active workspace state and restore behavior. Home artwork behavior is covered by automated classifier/theme tests but still needs a dedicated clean-home live screenshot before the theme can move beyond `experimental`.
