# Theme authoring
A complete Awesome Codex Themes package is a visual system, not only a wallpaper. It must include validated metadata, a full semantic palette, scoped CSS, runtime artwork, preview media, provenance, compatibility declarations, and recorded interaction/restore QA.

## Naming policy

Use an **English primary name** for global discovery, commands, filenames, and documentation. Add a native-language display name when it is culturally meaningful:

```json
{
  "name": "Satoru Gojo",
  "nativeName": "五条 悟",
  "nativeLocale": "ja-JP"
}
```

`nativeName` and `nativeLocale` are an optional pair: provide both or neither. Use a canonical BCP 47 locale. The slug remains lowercase ASCII kebab-case, for example `satoru-gojo`.

## Package layout

```text
themes/my-theme/
├── assets/
├── theme.json
├── theme.css
├── background.svg
├── preview.png
└── ASSET_LICENSE.md
```

Create a new package outside `themes/`, complete every required file, and move it into the runnable catalog only after validation passes. Do not use an empty placeholder directory as a release theme.

## Required design coverage

- Workspace canvas and readable background treatment.
- Sidebar, header, cards, dialogs, menus, listboxes, tooltips, and elevated surfaces.
- Primary, secondary, muted, and disabled text and icon tiers.
- Inputs, Composer, send action, links, hover, active, selection, and keyboard focus.
- Code, terminal, diffs, status colors, scrollbars, and reduced-motion behavior.
- Pointer-transparent decorative layers that never obscure native controls.
- Idempotent reapply and complete owned-state restore.

The built-in adapter owns version-sensitive Codex selectors. Theme CSS should express only theme-specific composition below `html.awesome-codex-theme` and must not contain JavaScript, remote imports, analytics, or destructive DOM behavior.

## Asset rights and provenance

Every asset requires an entry in `ASSET_LICENSE.md` describing its source and redistribution terms. By submitting a package, the contributor confirms they have the necessary rights to publish and redistribute all included artwork, character imagery, names, logos, fonts, and derivatives under the declared terms.

The repository does not turn that declaration into a legal guarantee. Maintainers may request evidence, attribution, replacement assets, or removal when a rights claim is unclear or challenged.

## Compatibility and QA

New packages start with `compatibility.status: experimental`, use `compatibility.strategy: best-effort-all`, and list only actually tested families under `verifiedAppVersions`. The engine attempts unverified numeric Codex versions with the shared mapping; contributors must not describe those attempts as verified compatibility.

Before proposing a package:

```bash
pnpm themes:validate
pnpm test
pnpm typecheck
pnpm build
```

Record clean screenshots without conversations, names, tokens, account data, or other private content. Test apply twice, renderer reload, theme switch, focus/keyboard operation, reduced motion, and restore. See [THEME_SCHEMA.md](THEME_SCHEMA.md) for the machine-readable contract.
