# Release process

This checklist separates a tested local candidate from a public GitHub release. Passing automated tests does not prove the macOS LaunchAgent lifecycle, and a private repository is not yet an open-source distribution channel.

## 1. Source and privacy gate

- Review every tracked and untracked change against the intended release.
- Keep internal visual-iteration screenshots, active workspace captures, logs, tokens, credentials, and local agent state outside the repository.
- Confirm that `themes/` and `public/theme-assets/` contain only complete runnable themes.
- Confirm that the catalog contains exactly the twelve reviewed launch themes and that Satoru Gojo remains the only Featured entry.
- Run the repository security scanner against the complete worktree and resolve every high or medium finding.
- Review artwork provenance and the maintainer's public-distribution approval for every packaged asset.

## 2. Automated release gate

```bash
pnpm install --frozen-lockfile
pnpm release:check
```

The portable gate runs the full test/theme/type/build suite, the production dependency audit, and whitespace-error detection. It requires zero test failures, twelve validated runnable themes, a successful TypeScript check, and a successful production Gallery build. The test suite also exercises an isolated installed `current` symlink—not only the source checkout—so it can execute the CLI entry.

## 3. macOS lifecycle evidence

Use an explicitly approved test session on a live-verified official Codex version. Never terminate an active user session to satisfy this checklist.

1. Record `doctor` output and resolve any legacy injector conflict through that injector's documented restore path.
2. Install without the takeover flag while Codex is already open and confirm `restart-required` without automatic termination.
3. Quit Codex explicitly and confirm the agent starts the verified official app on a dynamic literal-loopback port.
4. Confirm `active`, the existing Codex profile, and the Satoru Gojo presentation.
5. Reload the renderer and confirm idempotent reapply without duplicate owned nodes or styles.
6. Exercise keyboard focus, menus, Composer, code/diff surfaces, reduced motion, and owned-state restore.
7. Run `pause`, confirm owned styling is removed, and confirm Codex can remain closed.
8. Run `resume`, close the managed app, and confirm the agent starts a new managed process with the saved theme.
9. Reinstall with `install-agent satoru-gojo --takeover-at-login`, reboot the approved test Mac, and confirm the bounded handoff or direct managed startup restores the theme.
10. Confirm an unverified numeric-version fixture attempts `codex-best-effort`; if verification fails, confirm `pause` or `restore` returns the official UI.
11. Run `uninstall-agent`, then verify the plist, installed support directory, owned renderer state, and service are gone while the official Codex profile remains intact.
12. Exercise the manual `launchctl bootout` recovery from [INSTALL.md](INSTALL.md).

Store only sanitized evidence. Update [STATUS.md](STATUS.md) from “integration pending” to “integration verified” only after all applicable steps have direct evidence.

The `26.715.21425` service-boundary results are recorded in the [Satoru Gojo lifecycle audit](audits/2026-07-17-satoru-gojo-26.715-lifecycle-audit.md). That audit does not claim a physical reboot or a complete visual page matrix.

## 4. Public visibility gate

Changing repository visibility is a consequential external action. `BeatAPI/Awesome-codex-themes` is public; obtain the repository owner's explicit approval before changing its visibility again.

Before approval is executed, verify:

- the complete Git history contains no private screenshots, secrets, proprietary source, or assets that were never approved for publication;
- README, NOTICE, SECURITY, CONTRIBUTING, issue templates, and third-party notices match the public project;
- the repository description, topics, default branch, and security-advisory link are correct;
- the owner understands that forks, caches, and downloaded release assets cannot be recalled reliably after publication.

## 5. Main and `v0.4.3`

After the source, lifecycle, and visibility gates pass:

1. Land the reviewed release commit on `main` without overwriting unrelated local work.
2. Rerun `pnpm check` from the exact `main` commit.
3. Push `main` and confirm GitHub Actions succeeds on that SHA.
4. Create the annotated `v0.4.3` tag from the verified commit.
5. Publish a GitHub Release that links to [INSTALL.md](INSTALL.md), [MIGRATION.md](MIGRATION.md), [SAFETY.md](SAFETY.md), and the exact live-verified Codex ranges while explaining the best-effort fallback.
6. Confirm a fresh public clone can run `doctor`, `list`, an isolated `install-agent satoru-gojo --takeover-at-login` flow, and an `upgrade-agent` flow that preserves paused and takeover configuration.

Do not describe login/reboot persistence as publicly verified until both the local lifecycle record and the CI/release SHA are available.
