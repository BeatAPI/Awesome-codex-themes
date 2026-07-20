# Migration from another injector
Run only one Codex theme injector at a time. Two injectors can both be locally trusted and still fight over the same renderer CSS cascade.

## Inspect first

```bash
./bin/awesome-codex-themes doctor
```

The read-only report recognizes known legacy LaunchAgents, legacy scripts, and Codex processes launched with wildcard remote origins. It never stops or removes the legacy injector for you.

## Safe migration sequence

1. Record the legacy injector's install path, service label, selected theme, and restore command.
2. Use that project's documented restore or uninstall command.
3. Confirm its LaunchAgent is unloaded and its owned renderer style is absent.
4. Quit Codex yourself if it is still running with the old endpoint.
5. Run `doctor` again.
6. Install this project with `install-agent satoru-gojo --takeover-at-login` when reboot persistence is desired.
7. Check `status` and complete the first transition described in [INSTALL.md](INSTALL.md).

Do not delete an unfamiliar plist or send signals to an unverified PID. A legacy injector can contain unrelated user configuration, and this project deliberately does not claim ownership of it.

## Known local legacy marker

Older development setups may use the label `com.kkkk.codex-nocturne` or a script named `theme_agent`. The diagnostic can report those identifiers, but removal remains an explicit user decision. Follow the legacy setup's own recovery instructions or inspect its plist before unloading it.

## Rollback

If the new agent is not suitable:

```bash
./bin/awesome-codex-themes uninstall-agent
```

If the command is unavailable, use the manual `launchctl bootout` and file-removal procedure in [INSTALL.md](INSTALL.md). Re-enable the previous injector only after this service is unloaded and Codex has been relaunched through the previous injector's documented path.
