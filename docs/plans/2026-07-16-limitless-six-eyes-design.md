# Limitless Six Eyes Theme Design

## Status

Approved for implementation as a private fan prototype. The theme engine and original CSS remain MIT-licensed; the character artwork is explicitly excluded from that license and must be replaced with original or commercially licensed artwork before any public release.

## Product Goal

Create one unmistakable flagship theme that proves Awesome Codex Themes can transform the entire Codex workspace instead of merely changing a wallpaper. A new technical user should be able to install, apply, inspect, and restore it with the existing CLI.

## Visual Direction

The theme uses a high-fashion editorial interpretation of “limitless perception”:

- porcelain white and cool lavender workspace
- near-black violet code surfaces for working contrast
- electric iris focus rings and restrained cyan highlights
- large editorial type, optical targets, infinity geometry, fine technical rules
- glass panels with soft inner highlights instead of generic purple gradients
- a sparse ambient layer that adds brand, live status, particles, and orbit graphics without blocking native controls

All Codex product UI copy remains English. The only branded prototype strings are:

- `LIMITLESS`
- `SIX EYES`
- `LIMITLESS WORKSPACE`
- `LIMITLESS ONLINE`
- `SATORU GOJO`

The model selector remains Codex-owned. The theme must never insert a Claude model label or alter application behavior.

## Architecture

The existing 33-role semantic palette stays the shared foundation for backgrounds, panels, text, icons, borders, menus, inputs, code, hover, selection, scrollbars, and Composer.

Schema v2 gains an optional declarative `experience` object. It contains text and a boolean ambient-chrome flag, not arbitrary JavaScript. The injector creates one project-owned, `aria-hidden` decorative node from this data and removes it during restore. Reapplying is idempotent.

Theme-specific CSS may enhance known Codex 26.707 renderer surfaces, but:

- selectors stay scoped below `.awesome-codex-theme`
- decorative layers use `pointer-events: none`
- unknown versions continue to fail closed through the existing compatibility gate
- remote CSS, remote assets, and executable theme scripts remain forbidden

## Theme Package

`themes/limitless-six-eyes/` contains:

- `theme.json` — schema v2 manifest and complete semantic palette
- `theme.css` — full-workspace styling and versioned surface enhancements
- `background.jpg` — runtime artwork with generous negative space and a bounded injection size
- `preview.png` — corrected marketing mockup
- `ASSET_LICENSE.md` — private prototype restriction and replacement requirement

## Verification

Automated tests cover:

- schema normalization and invalid experience metadata
- safe/idempotent ambient chrome creation and restore
- complete token and surface-marker coverage
- catalog inclusion and flagship ordering
- gallery copy and detail presentation

Live smoke verification applies the theme to the supported local Codex renderer, checks injected state and representative computed tokens, captures a private screenshot, and restores the prior renderer state without removing unrelated injectors.
