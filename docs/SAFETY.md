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
3. Refuse a managed launch if an exact official app process is already running without this project's trusted endpoint.
4. Select an unused non-privileged port and launch the inspected app through macOS LaunchServices with `--remote-debugging-address=127.0.0.1`.
5. Verify the listener address and confirm its PID belongs to the inspected official app.
6. Query `/json/list` only on literal loopback and accept only the expected main `app://-/index.html` renderer.
7. Load a local theme and validate its manifest, paths, sizes, CSS, and live-verified Codex version metadata.
8. Select a live-verified adapter marker when available; otherwise use the same trusted stylesheet as `codex-best-effort`.
9. Inject one owned style element, one artwork variable, one color-scheme variable, 33 semantic palette variables, namespaced theme/adapter root markers, and at most one inert decorative experience node.
10. Require the renderer to return the expected theme and adapter markers before reporting success.
11. For a session launch, start an idempotent watcher and persist exact process identity in a mode-`0600` state file.

## Persistent agent sequence

1. Validate and copy the runtime into an immutable per-user release outside the Git clone.
2. Atomically select the installed `current` release and write owner-only desired configuration.
3. Generate a user LaunchAgent that calls only the stable installed launcher.
4. Boot out only this project's existing label, then bootstrap and kickstart the replacement.
5. If Codex is absent, launch the verified official executable with a dynamic `127.0.0.1` CDP port and no alternate data directory.
6. If Codex is already running unmanaged, record `restart-required` and leave it untouched by default.
7. Only after explicit `--takeover-at-login` consent, within 120 seconds of boot, and with exactly one revalidated official PID, request one normal macOS quit and confirm complete exit before a managed relaunch.
8. Never escalate a login handoff to a signal, force quit, wildcard process match, or second attempt; any ambiguity fails closed to `restart-required`.
9. Reapply idempotently while the verified managed process and endpoint remain valid.
10. After a Codex version change, attempt the verified or best-effort adapter and report a normal typed error if renderer verification fails.

## Restore sequence

Session-scoped `restore` first observes the recorded watcher so an active watcher cannot race the final CSS removal:

- Exact PID, start time, executable, and script match: send `SIGTERM` to the watcher, remove live namespaced style state, then remove state.
- Watcher already exited: remove live style and stale state; there is no process to terminate.
- Identity differs: leave that process untouched, remove live style, report `INJECTOR_IDENTITY_MISMATCH`, and keep enough state for diagnosis.

The official app process is not terminated. If the app has already closed, its next normal launch uses the official UI because runtime injection was never written into the app bundle.

One-shot `apply --port` does not create a watcher or state file. Use `restore --port` against the same still-running verified endpoint.

For an installed persistent agent, `pause` and no-port `restore` first set `enabled: false`, kickstart the agent into its paused state, and request owned-style removal only through the recorded verified endpoint. This prevents the background agent from immediately reapplying after restore. `uninstall-agent` uses the same ownership boundary before removing the installed service and files.

## Failure behavior

- Every valid numeric app version is attempted. Unverified versions may have visual mismatches, so the user may need `pause` or `restore`.
- Unsafe/non-loopback endpoints and unexpected renderer targets fail before evaluation.
- Invalid themes fail before CDP access.
- Partial renderer confirmation is treated as failure.
- An enabled persistent agent may relaunch Codex after it exits; use `pause` before intentionally keeping the app closed.
- An official app update may receive a best-effort theme immediately; no claim of visual compatibility is made until that version is recorded as verified.
- Malformed state is reported and not silently discarded.
- Temporary app-discovery failures during login are recorded and retried by the persistent loop instead of disabling the service.
- Concurrent third-party theme injectors are unsupported because their high-specificity rules can override either theme. Restore or disable the other theme before evaluating Awesome Codex Themes; this engine never deletes unrelated style elements.

## Non-goals

The engine does not provide a security boundary against a malicious local administrator or a compromised official application. It does not secure CDP for unrelated software, sign a desktop distribution, permanently intercept every ordinary Dock launch, or guarantee visual compatibility on unverified Codex versions.
