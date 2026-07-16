# Theme package schema

Schema version `2` defines a self-contained semantic theme directory. A package contains metadata, a complete visual palette, one optional refinement CSS file, one runtime artwork file, one gallery preview, and an asset license notice. The engine owns the versioned Codex selector adapter.

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
  "schemaVersion": 2,
  "slug": "my-original-theme",
  "version": "1.1.0",
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
    "scrim": "#15130ED9",
    "surface": "#292419D9",
    "surfaceElevated": "#342D20EE",
    "surfaceOverlay": "#1C180FF2",
    "input": "#30291DE8",
    "text": "#FFF4D6",
    "textSecondary": "#DDD0AD",
    "textMuted": "#A99C7A",
    "textDisabled": "#746B54",
    "icon": "#FFF4D6",
    "iconSecondary": "#D5C69E",
    "iconMuted": "#938767",
    "border": "#F5B94238",
    "borderSubtle": "#F5B9421F",
    "borderStrong": "#F5B94270",
    "accent": "#F5B942",
    "accentHover": "#FFD36F",
    "selection": "#F5B9424D",
    "focus": "#FFD983",
    "link": "#F8C85D",
    "hover": "#F5B9421F",
    "active": "#F5B94238",
    "code": "#100E09F2",
    "terminal": "#0A0906F7",
    "diffAdded": "#2DAA6A42",
    "diffRemoved": "#FF5F5242",
    "success": "#58D68D",
    "warning": "#F6C85F",
    "danger": "#FF6B64",
    "scrollbar": "#F5B94245",
    "scrollbarHover": "#F5B94278",
    "composer": "#211C12F2"
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
| `schemaVersion` | Integer `2` for new themes. Version `1` remains readable through deterministic palette expansion; unknown versions fail closed. |
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
| `palette` | Every schema-v2 semantic role is required. Values are six- or eight-digit hex colors; alpha belongs at the end (`#RRGGBBAA`). |
| `files` | Local paths to CSS, artwork, and preview. |

## Runtime tokens

The engine exposes the validated palette as namespaced variables on the document root:

```css
--act-artwork
--act-background
--act-scrim
--act-surface
--act-surface-elevated
--act-surface-overlay
--act-input
--act-text
--act-text-secondary
--act-text-muted
--act-text-disabled
--act-icon
--act-icon-secondary
--act-icon-muted
--act-border
--act-border-subtle
--act-border-strong
--act-accent
--act-accent-hover
--act-selection
--act-focus
--act-link
--act-hover
--act-active
--act-code
--act-terminal
--act-diff-added
--act-diff-removed
--act-success
--act-warning
--act-danger
--act-scrollbar
--act-scrollbar-hover
--act-composer
```

Scope every rule below the root marker:

```css
html.awesome-codex-theme body {
  color: var(--act-text);
  background-color: var(--act-background);
  background-image: var(--act-artwork);
}
```

Theme CSS is appended after the trusted adapter and should contain only artwork composition or narrowly scoped refinements. Prefer semantic elements and ARIA roles over hashed application classes. Decorative layers must not capture pointer events or obscure keyboard focus. Avoid structural DOM assumptions and do not hide native controls.

## Asset and CSS rules

- Artwork formats: SVG, PNG, JPEG, WebP, or AVIF.
- Default maximum artwork/preview size: 10 MiB each.
- Default maximum CSS size: 256 KiB.
- CSS `url(...)`, remote/protocol-relative strings, `@import`, executable URLs, `expression(...)`, and escape sequences that could obscure those tokens are rejected. Runtime artwork is available only through `var(--act-artwork)`.
- SVG artwork and previews cannot contain scripts, active embedded markup, event handlers, document/entity declarations, obscured tokens, or non-fragment `href`, `src`, and `url(...)` values.
- Arbitrary JavaScript, remote fonts, analytics beacons, data collection, and content scripts are not part of the schema.
- Artwork must be original or commercially redistributable. Do not submit character, celebrity, game, anime, brand, or logo artwork without documented rights.

## Validation

```bash
pnpm themes:validate
pnpm test
pnpm build
```

Catalog metadata and preview copies are generated deterministically by `scripts/build-catalog.mjs`.
