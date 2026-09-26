# Frontend Swiss UI Tokens

> When restyling `apps/frontend` chrome (Guide / Train / Admin), keep Minimalism & Swiss Style unless the user explicitly changes direction.

## Checklist

- [ ] Colors come from `:root` tokens in `apps/frontend/src/App.css` — do not reintroduce ad-hoc hex in page components for chrome UI
- [ ] Keep `border-radius: 0` for chrome controls; no soft card shadows
- [ ] Primary CTA = black fill / white text; status green/amber/red only for semantic state
- [ ] Display font: Space Grotesk; body: IBM Plex Sans (+ CJK fallbacks), loaded via `@fontsource/*` (bundled). Do not use `fonts.googleapis.com` / `fonts.gstatic.com`. Do not default to Inter
- [ ] Guide landing: brand is hero-level; one headline, one lead, one CTA group before instruction grid
- [ ] 3D viewport may stay dark; surrounding chrome stays light Swiss
- [ ] Interactive controls need `cursor: pointer`, hover ≤ 250ms, and visible `:focus-visible`
- [ ] Honor `prefers-reduced-motion` (tokens already zero-out long animations)

## Wrong vs Correct

| Wrong | Correct |
| ----- | ------- |
| Dark rounded cards + neon green primary on Guide | White bg, hairline borders, black primary button |
| Decorative wash bubbles | Geometric square spinner |
| Soft gray-on-gray body without 4.5:1 contrast | `--color-fg` / `--color-fg-muted` against white |

## Key files

- `apps/frontend/src/App.css` — source of truth for tokens and chrome styles
- `apps/frontend/src/ui/GuidePage.tsx` — brand-first landing structure
