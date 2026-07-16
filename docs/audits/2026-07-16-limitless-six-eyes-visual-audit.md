# Limitless Six Eyes Visual Audit

## Scope

Three user-provided Codex screenshots covering an active task, a large branded surface, and a blank/new-task composition on Codex `26.707.91948`.

## User Goal

Make Codex feel like a distinctive editorial theme while keeping native task reading and composing comfortable.

## Strengths

- The porcelain and iris-violet palette is recognizable and coherent.
- The left navigation, status chip, and Composer already prove that the semantic tokens can reach native Codex surfaces.
- The clean runtime artwork has enough left-side negative space to support an editorial start screen.

## Structural Risks

1. **Home/workspace state is unreliable.** A broad `:has()` signal can match hidden or stale home nodes, so the oversized identity layer appears over active task content.
2. **Artwork is global instead of contextual.** The character competes with conversation text and makes long-form work harder to scan.
3. **The start composition duplicates visual hierarchy.** Full-screen artwork, a large identity lockup, native content, and Composer all ask for attention at once.
4. **Composer receives nested chrome.** Outer and inner surfaces both receive border, radius, blur, and shadow, creating stacked rounded rectangles.

## Polish Risks

- Radius values drift between pills, controls, panels, cards, and Composer.
- Purple borders appear on nearly every edge instead of being reserved for active/focus states.
- Glow and blur are overused, reducing edge clarity.
- The selected project item is a saturated capsule that feels disconnected from the quieter editorial panels.
- The fixed online badge can collide with top-bar controls on narrower windows.

## Accessibility Risks

- Artwork behind content can reduce local contrast even when the base palette passes.
- Excessive translucency makes contrast dependent on the underlying image.
- Decorative motion needs a reliable reduced-motion path.
- Screenshot evidence cannot prove keyboard order, screen-reader output, or exact WCAG ratios; those require runtime checks.

## Approved Direction

- Add a trusted runtime surface classifier: `home` or `workspace`.
- Show full artwork and the large identity lockup only on a visibly confirmed home route.
- Use a quiet, artwork-free lavender mesh in workspace routes.
- Use one radius scale: `8 / 10 / 14 / 18 / pill`.
- Apply one border and one shadow to Composer's visible surface; reset the outer wrapper.
- Reduce default purple borders and reserve stronger accent treatment for selection, hover, and focus.
- Make the home hero a controlled editorial panel with a softer artwork crop and enough space for native cards and Composer below.
