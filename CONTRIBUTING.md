# Contributing

Thanks for helping make Codex customization safer and more original.

## Before opening a change

- Search existing issues and themes.
- Keep the project narrow: themes, engine safety, diagnostics, restore behavior, Gallery discovery, and documentation are in scope.
- Commercial desktop packaging, payments, accounts, model relays, API keys, credits, arbitrary remote JavaScript, and unrelated Codex configuration are out of scope.
- For security-sensitive bugs, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## Development setup

```bash
corepack enable
pnpm install
pnpm check
```

Use Node 22 or newer for development. End-user engine commands use the Node runtime bundled in the official signed app.

## Theme contributions

1. Copy an existing package into a new lowercase kebab-case directory.
2. Replace all artwork and metadata; do not submit a recolor of copyrighted character or brand art.
3. Keep CSS under `html.awesome-codex-theme` and preserve native controls, focus states, pointer behavior, and readable contrast.
4. Add `ASSET_LICENSE.md` with exact provenance and redistributable rights.
5. Start at `compatibility.status: experimental` and declare only versions you actually tested.
6. Run `pnpm themes:validate` and `pnpm check`.
7. Include before/after evidence without conversations, names, account data, or tokens.

Read [docs/THEME_SCHEMA.md](docs/THEME_SCHEMA.md) for the contract.

## Engine changes

Engine changes require tests that fail before the implementation and cover the relevant safety invariant. Do not add shell interpolation when `execFile` with an argument array is sufficient. Do not broaden loopback addresses, renderer selectors, app identities, version ranges, filesystem roots, or process-kill behavior for convenience.

If behavior changes, update README/help/error codes and recovery documentation in the same pull request.

## Pull requests

- Keep commits focused and describe the user-visible outcome.
- Run `pnpm check` on the final diff.
- Confirm no secrets, personal data, generated `dist/`, or external reference repository content is included.
- Disclose adapted code and preserve its required license/attribution.
- Expect review of safety, recovery, licensing, compatibility evidence, accessibility, and reduced-motion behavior.

By contributing, you agree that your code contribution is licensed under MIT and that any artwork contribution is available under the license declared in its package.
