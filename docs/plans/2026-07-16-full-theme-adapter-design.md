# Full Theme Adapter Design

## Outcome

Awesome Codex Themes will move from background-led theme packages to a versioned, full-workspace visual adapter for the official Codex Desktop renderer. The first target is Codex `26.707.*`, with Obsidian Bloom as the primary live visual check. The adapter must cover backgrounds, layered surfaces, text, icons, borders, menus, inputs, code and diff views, hover and selection states, scrollbars, and the composer while preserving native interaction.

## Chosen architecture

The engine owns a shared adapter stylesheet. Theme packages remain small and declarative: each manifest supplies a semantic palette, artwork, live-verified compatibility metadata, and optional namespaced CSS for theme-specific composition. At apply time the engine combines the trusted adapter with the validated theme CSS into one owned style element. This avoids duplicating brittle Codex selectors across every theme and gives maintainers one compatibility surface for both verified families and best-effort attempts.

The adapter is original project code. The two MIT reference repositories are behavior and coverage references, not wholesale source. Stable Codex and VS Code design-token names observed in the supported renderer are preferred over transient utility classes. Explicit semantic selectors are used only where tokens cannot expose the artwork or glass treatment.

## Semantic palette

Schema version 2 expands the four launch colors into a complete visual contract:

- canvas and artwork scrim;
- surface, elevated surface, overlay, and input surface;
- primary, secondary, muted, and disabled text;
- primary, secondary, and muted icons;
- normal, subtle, and strong borders;
- accent, accent hover, selection, focus, and link;
- hover and active surfaces;
- code, terminal, diff-added, and diff-removed surfaces;
- success, warning, and danger colors;
- scrollbar and composer colors;

All color fields remain six- or eight-digit hex. Version 1 theme manifests remain readable through deterministic palette derivation so existing themes do not break immediately. Obsidian Bloom is the first repository theme migrated and tuned to version 2; the other three launch themes stay on version 1 until they receive their own visual pass.

## Runtime and recovery

The adapter is loaded from the repository itself, never from a theme package or network. The apply expression creates one namespaced style element, sets owned variables, and marks the active adapter family. Re-apply replaces the same element. Restore removes only Awesome Codex Themes state and leaves official inline Appearance values and unrelated styles intact.

The existing signature, Team ID, renderer allowlist, loopback, port-owner, and version checks remain unchanged. The adapter fails closed when no adapter family matches the declared app version.

## Coverage contract

Automated tests will require representative token groups and selectors for every requested surface. Runtime verification will report an adapter marker in addition to the theme slug. Live verification on `26.707.91948` will inspect computed values for background, panel, text, icon, border, input, code, hover, selection, scrollbar, and composer categories. Screenshots will cover the currently visible real conversation surface; missing pages remain explicitly experimental until separately exercised.

The project will describe this as high-coverage theming for a supported renderer version, not permanent pixel-perfect coverage across future Codex releases.
