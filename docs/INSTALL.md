# Installation and recovery

Awesome Codex Themes installs a private, versioned runtime for the current macOS user. The installed LaunchAgent never depends on the location of the Git clone.

## Before installation

Run the read-only diagnostics:

```bash
./bin/awesome-codex-themes doctor
./bin/awesome-codex-themes list
```

Resolve any reported legacy injector conflict first. The doctor command does not disable or delete anything.

The installer validates the selected theme and the signed official app, then writes only these project-owned locations:

```text
~/Library/Application Support/AwesomeCodexThemes/
~/Library/LaunchAgents/io.github.awesome-codex-themes.agent.plist
~/Library/Logs/AwesomeCodexThemes.log
~/Library/Logs/AwesomeCodexThemes.error.log
```

It does not edit `ChatGPT.app`, `Codex.app`, Codex conversations, settings, credentials, or the user's app profile.

## Install Satoru Gojo

```bash
./bin/awesome-codex-themes install-agent satoru-gojo --takeover-at-login
./bin/awesome-codex-themes status
```

The installed configuration selects `satoru-gojo`, enables persistence, and starts the user LaunchAgent. The agent uses a dynamic literal-loopback CDP port and does not pass `--user-data-dir`.

The optional `--takeover-at-login` flag is explicit consent for a single bounded handoff when macOS restores Codex before the agent can open its managed endpoint. It is the mode to use when the theme should return automatically after reboot. Without the flag, unmanaged Codex processes are always left untouched.

## Reboot and login handoff

The handoff is permitted only inside a 120-second startup window and only when exactly one official Codex process is present. The agent revalidates the signed application and exact PID, sends the normal macOS quit request, waits until that PID is gone with no replacement process, then opens the same official app through LaunchServices with a dynamic `127.0.0.1` endpoint. It does not use another `--user-data-dir`, so the existing Codex profile remains in place.

If the startup window has expired, more than one official process exists, the PID changes, or normal quit cannot be confirmed, the agent fails closed to `restart-required`. It does not escalate to `kill`, `kill -9`, or broad process matching.

## First transition

If Codex is already running without a trusted endpoint outside the explicitly approved startup handoff, status becomes `restart-required`. This protects an active work session.

1. Save any active work.
2. Quit the official Codex app yourself.
3. The enabled agent starts the verified official executable with its managed local endpoint.
4. Run `./bin/awesome-codex-themes status` and expect `active`.

While enabled, the agent owns the launch lifecycle. It starts Codex at login, reapplies the theme after renderer reload, and starts a new managed process after Codex exits. Run `pause` before intentionally keeping the app closed:

```bash
./bin/awesome-codex-themes pause
```

Resume the same selection with:

```bash
./bin/awesome-codex-themes resume
```

## Updates and compatibility

After inspecting a newer checkout, upgrade the installed runtime without changing the selected theme or enabled/paused state:

```bash
./bin/awesome-codex-themes upgrade-agent
```

The command stages a new immutable release and atomically changes the installed `current` link. The service never runs from mutable repository files.

A Codex app update is evaluated against the selected theme metadata. Versions in `verifiedAppVersions` use their live-verified adapter marker; every other numeric version receives the shared `codex-best-effort` mapping. This is an attempt, not a compatibility guarantee. Upgrade Awesome Codex Themes only from a release you have inspected.

If an updated Codex layout looks wrong, run:

```bash
./bin/awesome-codex-themes pause
# or, for an explicitly managed one-shot endpoint:
./bin/awesome-codex-themes restore --port <port>
```

Confirm the official UI is restored, then file a GitHub Issue with the exact Codex version, the theme slug, the recovery result, and a privacy-safe screenshot. A visual mismatch can temporarily affect access to a control, but the runtime theme does not modify the signed app bundle or Codex data.

## Normal removal

```bash
./bin/awesome-codex-themes uninstall-agent
```

The command removes project-owned live styling when the verified endpoint is reachable, boots out the user agent, and deletes only the plist and `AwesomeCodexThemes` support directory. It does not delete the official app or its data.

## Manual recovery

If the CLI cannot run, stop the service first:

```bash
launchctl bootout "gui/$(id -u)/io.github.awesome-codex-themes.agent"
```

Then remove the project-owned install:

```bash
rm -f "$HOME/Library/LaunchAgents/io.github.awesome-codex-themes.agent.plist"
rm -rf "$HOME/Library/Application Support/AwesomeCodexThemes"
```

Quit and reopen the official app normally to obtain the official UI. Runtime CSS is never written into the signed application bundle, so an ordinary launch without the agent has no installed theme state.

If `launchctl bootout` reports that the service is not loaded, continue with the two file-removal commands. Keep the log files when reporting an installer problem.

## Operational states

| State | Meaning | Action |
| --- | --- | --- |
| `idle` | Agent is installed but has not completed a managed launch. | Wait briefly, then run `status`. |
| `starting` | A verified managed app launch is in progress. | Wait; do not start another app copy. |
| `active` | The selected theme is verified on the managed renderer. | None. |
| `restart-required` | Codex is running without the managed endpoint, or a safe login handoff was not allowed/confirmed. | Save work and quit it yourself. |
| `paused` | Persistence is disabled and owned live styling has been removed when reachable. | Run `resume` when desired. |
| `error` | A stable error code was recorded. | Run `doctor`, inspect logs, and use manual recovery if necessary. |
