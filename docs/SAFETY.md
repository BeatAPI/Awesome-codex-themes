# Safety model

Awesome Codex Themes changes renderer presentation at runtime. It does not patch or redistribute the official app. This document describes what the engine trusts, what it verifies, and how it recovers.

## Trust boundary

The engine trusts:

- The local macOS account running the command.
- The signed official Codex Desktop bundle after identity verification.
- Theme packages committed to or deliberately placed in this repository after validation.

It does not trust:

- A service merely listening on localhost.
- Renderer targets reported by a CDP endpoint without URL/title/type filtering.
- Theme paths, symlinks, CSS, metadata, or asset sizes before validation.
- A PID from an old state file without full process identity comparison.

## Apply sequence

1. Discover the official `ChatGPT.app` or legacy `Codex.app` bundle.
2. Verify code signature integrity, bundle ID `com.openai.codex`, Team ID `2DC432GLL2`, architecture, and bundled Node version.
3. Refuse `start` if an exact official app process is already running.
4. Select an unused non-privileged port and launch the inspected executable with `--remote-debugging-address=127.0.0.1`.
5. Verify the listener address and confirm its PID belongs to the inspected official app.
6. Query `/json/list` only on literal loopback and accept only the expected main `app://-/index.html` renderer.
7. Load a local theme, validate its manifest, paths, sizes, CSS, and declared Codex version range.
8. Select the trusted built-in adapter for the exact supported Codex version family.
9. Inject one owned style element, one artwork variable, one color-scheme variable, 33 semantic palette variables, and namespaced theme/adapter root markers.
10. Require the renderer to return the expected theme and adapter markers before reporting success.
11. Start an idempotent watcher and persist exact process identity in a mode-`0600` state file.

## Restore sequence

Managed `restore` first observes the recorded watcher so an active watcher cannot race the final CSS removal:

- Exact PID, start time, executable, and script match: send `SIGTERM` to the watcher, remove live namespaced style state, then remove state.
- Watcher already exited: remove live style and stale state; there is no process to terminate.
- Identity differs: leave that process untouched, remove live style, report `INJECTOR_IDENTITY_MISMATCH`, and keep enough state for diagnosis.

The official app process is not terminated. If the app has already closed, its next normal launch uses the official UI because runtime injection was never written into the app bundle.

One-shot `apply --port` does not create a watcher or state file. Use `restore --port` against the same still-running verified endpoint.

## Failure behavior

- Unknown app versions fail before DOM mutation.
- Unsafe/non-loopback endpoints and unexpected renderer targets fail before evaluation.
- Invalid themes fail before CDP access.
- Partial renderer confirmation is treated as failure.
- Malformed state is reported and not silently discarded.
- Concurrent third-party theme injectors are unsupported because their high-specificity rules can override either theme. Restore or disable the other theme before evaluating Awesome Codex Themes; this engine never deletes unrelated style elements.

## Non-goals

The engine does not provide a security boundary against a malicious local administrator or a compromised official application. It does not secure CDP for unrelated software, sign a desktop distribution, or guarantee compatibility beyond the ranges declared by each theme.
