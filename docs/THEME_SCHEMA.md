# Theme package schema

Schema version `1` defines a self-contained theme directory. A package contains metadata, one CSS file, one runtime artwork file, one gallery preview, and an asset license notice.

## Directory layout

```text
themes/obsidian-bloom/
├── theme.json
├── theme.css
├── background.svg
├── preview.svg
└── ASSET_LICENSE.md
```

All file references must be relative, use forward slashes, and resolve below the canonical theme directory. Absolute paths, URL schemes, traversal segments, empty segments, and symlinks that escape the directory are rejected.

## Complete manifest

```json
{
  "schemaVersion": 1,
  "slug": "my-original-theme",
  "version": "1.0.0",
  "name": "My Original Theme",
  "description": "A concise description of the visual system.",
  "author": {
    "name": "Your Name",
    "url": "https://github.com/your-name"
  },
  "license": {
    "code": "MIT",
    "artwork": "CC0-1.0"
  },
  "categories": ["dark", "editorial"],
  "tags": ["amber", "reading", "low-glare"],
  "compatibility": {
    "platforms": ["macos"],
    "status": "experimental",
    "appVersions": ["26.707.*"]
  },
  "mode": "dark",
  "palette": {
    "background": "#15130E",
    "surface": "#292419D9",
    "text": "#FFF4D6",
    "accent": "#F5B942"
  },
  "files": {
    "css": "theme.css",
    "artwork": "background.svg",
    "preview": "preview.svg"
  }
}
```

## Fields

| Field | Rule |
| --- | --- |
| `schemaVersion` | Integer `1`. Unknown versions fail closed. |
| `slug` | Lowercase kebab-case and identical to the directory name. |
| `version` | Semantic version such as `1.0.0` or `1.0.0-beta.1`. |
| `name` | Human-readable global/English launch name. |
| `description` | Plain, non-empty summary. |
| `author.name` | Required. `author.url` is optional metadata. |
| `license.code` | License identifier for CSS/metadata. Repository themes use `MIT`. |
| `license.artwork` | License identifier for artwork. It must match `ASSET_LICENSE.md`. |
| `categories` | Non-empty normalized category list used by gallery filters. |
| `tags` | Non-empty normalized search terms. |
| `compatibility.platforms` | Version 1 accepts only `macos`. |
| `compatibility.status` | `experimental` or `verified`. Use `verified` only with recorded runtime evidence. |
| `compatibility.appVersions` | Exact dotted versions or trailing-wildcard ranges such as `26.707.*`. |
| `mode` | `dark`, `light`, or `system`; defaults to `dark`. |
| `palette` | Six- or eight-digit hex colors. Alpha belongs at the end (`#RRGGBBAA`). |
| `files` | Local paths to CSS, artwork, and preview. |

## Runtime tokens

The engine owns five variables on the document root:

```css
--act-artwork
--act-background
--act-surface
--act-text
--act-accent
```

Scope every rule below the root marker:

```css
html.awesome-codex-theme body {
  color: var(--act-text);
  background-color: var(--act-background);
  background-image: var(--act-artwork);
}
```

Prefer semantic elements and ARIA roles over hashed application classes. Decorative layers must not capture pointer events or obscure keyboard focus. Avoid structural DOM assumptions and do not hide native controls.

## Asset and CSS rules

- Artwork formats: SVG, PNG, JPEG, WebP, or AVIF.
- Default maximum artwork/preview size: 10 MiB each.
- Default maximum CSS size: 256 KiB.
- Remote `@import`, HTTP(S) and protocol-relative `url(...)`, JavaScript URLs, and CSS `expression(...)` are rejected.
- Arbitrary JavaScript, remote fonts, analytics beacons, data collection, and content scripts are not part of the schema.
- Artwork must be original or commercially redistributable. Do not submit character, celebrity, game, anime, brand, or logo artwork without documented rights.

## Validation

```bash
pnpm themes:validate
pnpm test
pnpm build
```

Catalog metadata and preview copies are generated deterministically by `scripts/build-catalog.mjs`.
