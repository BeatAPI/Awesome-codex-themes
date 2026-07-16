# Security policy

## Supported versions

The project is pre-1.0. Security fixes target the latest commit on `main`. Theme compatibility is narrower than repository support and is declared in each `theme.json`.

## Report a vulnerability

Please use GitHub's private vulnerability reporting for this repository: **Security → Advisories → Report a vulnerability**. Do not open a public issue for a vulnerability that could expose a user's local app, files, tokens, or process control.

Include:

- Affected commit and macOS/Codex versions.
- The smallest reliable reproduction.
- Which boundary failed: theme validation, app identity, loopback/port ownership, renderer selection, injection ownership, state permissions, or process identity.
- Expected impact and any temporary mitigation.

Avoid attaching real conversations, account tokens, API keys, or other user data. A maintainer should acknowledge a complete report within seven days; timelines for fixes and disclosure depend on severity and reproducibility.

## Security invariants

Changes are not accepted if they weaken these invariants:

1. The official app bundle, signature, Team ID, architecture, and bundled runtime are validated before injection.
2. CDP endpoints use literal `127.0.0.1`; the listening port is owned by an inspected official app process.
3. Renderer selection is allowlisted. The engine never broadcasts an expression to arbitrary targets.
4. Theme paths remain below the theme root, including through symlinks.
5. Theme CSS cannot load remote resources or executable URLs. Arbitrary theme JavaScript is unsupported.
6. Injection uses project-owned IDs, classes, data attributes, and CSS variables and is reversible.
7. Runtime state is atomically written with owner-only permissions.
8. A watcher is terminated only when PID, start time, executable, and script identity all match.
9. The official Codex process is never silently terminated.
10. Theme functionality never reads conversations, account tokens, API keys, model settings, or unrelated files.

See [docs/SAFETY.md](docs/SAFETY.md) for the threat model and recovery behavior.
