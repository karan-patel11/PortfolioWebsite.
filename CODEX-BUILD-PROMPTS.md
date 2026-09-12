# Codex build pack — horizontal-scroll portfolio

Three files ship with this pack. They are **reference implementations, written but not executed** — there is no browser in the environment they were authored in. Treat them as a spec that happens to compile-check by eye: Codex's job is to wire them into the repo, run them, and fix what breaks. Do not assume they run clean on first load.

| File | Role |
|---|---|
| `index.skeleton.html` | DOM contract. Every animation hook, mapped to real content. |
| `motion.css` | Tokens, layout, **all initial and resting states**, CSS-only micro-interactions. |
| `motion.js` | Engine: smooth scroll, horizontal track with pause phase, per-chapter effects. |

**The division of labour is the important part.** CSS owns every initial state (`opacity: 0`, `scaleX(0)`, `clip-path: inset(0 100% 0 0)`). JS only animates *to* the resting state. That means the page never flashes un-animated content, and if JS fails the reduced-motion block in `motion.css` still renders a readable site.

---

## Distinct effect per chapter

Each chapter has one signature effect and does not borrow another chapter's. This is the whole point — seven fade-ups in a row is the generic default and reads as generated.

| Ch | Section | Signature effect | Lifted from the reference (hook in their DOM) |
|---|---|---|---|
| 0 | Hero | **Year odometer → name handoff.** A digit strip counts 2019→2026 in the exact slot the name will occupy, wipes up, and the name rises word by word into the vacated space. | `data-year-strip`, `data-hero-year` (z-2) + `data-hero-name` (z-1) sharing one position; `data-name-heading` |
| I | About | **Two-stage curtain.** A solid colour card wipes left→right, the photo wipes open behind it, the card exits off the right edge. | `data-reveal-image-overlay` + `data-reveal-image`, both `clip-path: inset(0 100% 0 0)` |
| II | Expand panel | **Pause phase.** Horizontal track holds completely still while a small video rect scales to full-bleed and the two words fly apart. | `data-more-work-rect` / `data-more-work-more` / `data-more-work-work` + the author's own HTML comment documenting phases 1–3 |
| III | Projects | **Hairline draw + sibling dim + thumbnail crossfade.** Rules draw left→right under each row on enter; on hover a second rule draws in the foreground colour, the other rows drop to 35%, and a 16:9 preview crossfades in the far corner. | `data-work-line` (scale-x-0, origin-left), `data-work-hover-line`, `data-work-preview` / `data-work-image` |
| IV | What I build | **No entrance at all** — an over-wide panel whose cards arrive by scrolling, with a ±6% background parallax drift inside 112%-scaled images. | `md:w-max` panel, `data-service-bg-media` at `scale-110` behind a 70% scrim |
| V | Experience | **Left-edge clip wipe on hover**, gated until the reveal completes. Mobile swaps to a sticky logo that scales in per row. | `clip-path: inset(0 0 0 100%)` → `inset(0 0 0 0)`, `duration-500`, `cubic-bezier(.3,.86,.36,.95)`; `data-clients-list-interactive`; `data-client-mobile-logo` |
| VI | Contact | **Per-word rise** on a two-line display heading, same mask trick as the hero, plus the mirrored underline variant. | `data-char-line-heading`, `from-link-underline` |

Two values in `motion.css` are exact, read off the reference's markup rather than guessed: `--dur-hover: .5s` and `--ease-sig: cubic-bezier(.3,.86,.36,.95)`. Everything else is a starting point to tune.

---

## Prompt 1 — Scaffold

> Add `assets/css/motion.css`, `assets/js/motion.js`, and the markup from `index.skeleton.html` to the `redesign-astra` branch. Load GSAP 3.12 core + ScrollTrigger and Lenis 1.1 from jsDelivr with `defer`, in that order, before `motion.js`.
>
> Replace the placeholder copy and image paths with real content; keep every `data-*` attribute exactly as written — `motion.js` addresses elements only by those hooks, never by class.
>
> Do not add a build step, a bundler, a CSS framework, or any npm dependency. This ships to GitHub Pages as static files.
>
> Verify before continuing: the page renders all seven sections stacked and legible with JavaScript disabled; no console errors with JS on; `document.querySelectorAll('[data-horizontal-panel]').length === 7`.

## Prompt 2 — Horizontal engine

> Get the desktop horizontal track working: `motion.js` §5. One master ScrollTrigger pins `[data-horizontal-pin]` and translates `[data-horizontal-track]` on x.
>
> Requirements:
> - Track length is measured at runtime from `track.scrollWidth`. Never assume `panelCount × 100vw` — the "what I build" panel is `width: max-content` and is wider than the viewport by design.
> - Timeline durations are expressed in pixels of track motion so scroll speed stays constant across all three phases.
> - `invalidateOnRefresh: true`; `ScrollTrigger.refresh()` fires after `document.fonts.ready` and on a 150ms-debounced resize.
> - Below 768px there is no horizontal scroll and no pinning except the expand panel. Use `gsap.matchMedia()`, not a manual resize listener.
>
> Verify: resizing 1280 → 1920 → 1280 leaves the last panel flush with the right viewport edge, with no dead scroll at the end and no clipped final panel.

## Prompt 3 — The pause phase (Chapter II)

> Implement the three-phase master timeline in `motion.js` §5–6.
>
> 1. Track slides until `[data-expand-panel]` is centred.
> 2. **Track x is held completely still** while `[data-expand-rect]` scales from 0 to viewport-cover and the two `[data-expand-word]` elements fly to ±120%.
> 3. Track resumes to its final x.
>
> Phase 2 consumes 45% of total scroll length (`HOLD` constant — tune it, it is the single most subjective number in this build).
>
> The cover scale is computed as `max(innerWidth/rectWidth, innerHeight/rectHeight) * 1.02`, uniform on both axes so the video does not distort.
>
> On mobile the same sub-timeline runs with `axis: 'y'` — words fly up and down — driven by a vertical pin on that one section.
>
> Verify: assert `gsap.getProperty(track, 'x')` is unchanged across the entire phase-2 label range. If the track creeps even a pixel, the effect reads as broken rather than deliberate.

## Prompt 4 — Reveal primitives

> Implement the three reusable primitives in `motion.js` §4 and wire them in §13. Build them **once** and reuse; do not write per-section reveal code.
>
> - **Masked line** — outer `opacity 0→1`, inner `[data-line]` `yPercent 110→0`, stagger 0.08s, 0.9s, `expo.out`.
> - **Two-stage curtain** — card wipes open, image wipes open 0.35s later, card wipes out. 0.7s each, `power2.inOut`.
> - **Hairline draw** — `scaleX 0→1`, origin left, 0.8s, `power3.out`, stagger 0.06s.
>
> Trigger detection uses `IntersectionObserver`, **not** ScrollTrigger's `containerAnimation`. This is deliberate: IO reports real rendered geometry, so the same code path works for a horizontally translated track and for the mobile vertical page, and it cannot drift after a resize. `rootMargin: '-8% -12% -8% -12%'`, fire once, then unobserve.
>
> Keep the `.line-mask` padding/negative-margin compensation (`padding:.1em .2em; margin:-.1em -.2em`) exactly as written — without it the display face gets its descenders and ligatures shaved by the overflow clip.
>
> Do not add a reveal to the Chapter IV cards. Their entrance is the horizontal scroll itself.

## Prompt 5 — Intro sequence

> Implement `motion.js` §3. The odometer and the name share one absolute position (`.hero__slot`, z-index 2 and 1) — the counter sits exactly where the name will land, wipes up, and the name rises into the vacated slot. That handoff is the effect; if they are in different places it does not work.
>
> Split words with the local `splitWords()` helper. **Do not use GSAP SplitText** — it is a paid Club plugin. Same for ScrollSmoother; Lenis is the free replacement.
>
> The split copy is `aria-hidden="true"` and the real `<h1>` is visually hidden but present.
>
> Add the skip behaviour: the first `wheel`, `touchstart`, `keydown`, or `pointerdown` jumps the timeline to `progress(1)`. A recruiter must never be held hostage by a 4.5-second title card.
>
> Verify: total intro under 5s; header fades in and the menu button is enabled only at the end; the live clock renders `America/New_York` in `tabular-nums` so digits do not jitter.

## Prompt 6 — Header rail

> Implement `motion.js` §7.
>
> - Scroll progress: `scaleY` on the desktop rail bar, `scaleX` on the mobile bottom edge. Use `gsap.quickSetter`.
> - **Per-panel theming:** each panel declares `data-header-theme="dark|light"`; the rail tweens `--header-bg`, `--header-fg`, `--header-rule` over 0.4s as that panel's leading edge crosses the rail. Values are read from CSS custom properties on the panel, never hex literals in JS — this is the one place I deliberately diverged from the reference, which hardcodes hex in `data-header-bg`. Reading from CSS is what keeps the site-wide dark/light toggle working.
> - Panel geometry is cached on `ScrollTrigger.refresh` and the per-frame check reads only the cached values plus the track's x. **Zero `getBoundingClientRect` calls per frame in this function** — GSAP writes transforms every frame, so a read here forces a synchronous layout and costs you the frame budget.
>
> Verify with the Performance panel at 4× CPU throttle: scrubbing the full track shows no `Layout` entries and holds ≥55fps.

## Prompt 7 — Chapters III, IV, V

> **III (projects):** hover handling in §8. The sibling dim is one class on the `<ul>` plus CSS, not per-row JS. Preview images crossfade via a class toggle, `opacity` + `scale(1.04→1)`, 0.6s. Gate the whole thing behind `(pointer: fine)` so touch devices never get stuck in a hover state.
>
> **IV (build):** parallax in §9. Images sit at `scale(1.12)` behind a scrim; drift is ±6% of card width, driven from the master `onUpdate`, skipped for off-screen cards. Use `gsap.quickSetter`.
>
> **V (experience):** the hover card wipe is **pure CSS** — `clip-path: inset(0 0 0 100%)` → `inset(0 0 0 0)`, 500ms, `cubic-bezier(.3,.86,.36,.95)`. JS's only job is adding `data-clients-list-interactive` when the row reveal completes; the list is `pointer-events: none` until then. Mobile gets the sticky stacked-logo treatment in §10.

## Prompt 8 — Accessibility and fallbacks

> Non-negotiable, and the part most horizontal-scroll builds get wrong:
>
> - **Keyboard:** tabbing to a link inside an off-screen panel must scroll that panel into view (`focusin` handler in §5). The reference site does not solve this; without it the site is unusable with a keyboard and fails a basic accessibility review.
> - **Reduced motion:** `motion.js` returns before registering GSAP; `motion.css` §14 flattens the track to a vertical column and forces every animated element to its resting state.
> - Focus rings visible in both themes. Split-text duplicates `aria-hidden`, real text present exactly once for screen readers.
> - Every project must also be reachable from a plain vertical `/projects/` page linked in the menu. The horizontal journey is the front door, not the only door.
>
> Verify: full keyboard traverse of all seven panels; VoiceOver/NVDA reads each heading once, not twice; `prefers-reduced-motion: reduce` in DevTools renders a normal vertical page.

## Prompt 9 — Page transition (optional, do last)

> Implement §12 only if everything above is stable. The overlay fades to the clicked link's `data-transition-color`, navigates, and fades out on arrival via `sessionStorage`.
>
> This is the most fragile item in the pack: the failure mode is an overlay stuck opaque after a back-button navigation, which bricks the page. The `pageshow` handler exists for exactly that. **If it misbehaves on GitHub Pages, delete the feature** — nobody was ever hired because of a cross-fade.

---

## Global DO-NOT list

1. No GSAP SplitText or ScrollSmoother (paid Club plugins). No AOS, animate.css, WOW.js.
2. No animating `width`, `height`, `top`, `left`, `margin`, or `font-size`. Transform, opacity, clip-path only.
3. No custom cursor, magnetic buttons, marquee ticker, WebGL, particles, text scramble, tilt cards, or grain overlay. None exist in the reference; each one turns a coherent system into a showreel.
4. No fade-up on every element. Reveal clusters, and leave Chapter IV with no entrance.
5. No scroll-jacking on mobile. No "rotate your screen" blocker — ship a working vertical layout instead.
6. No hardcoded track length or panel widths.
7. No content hidden from `Ctrl+F` or from crawlers.
8. Do not copy the reference's copy, chapter naming, palette, or typefaces. Structure and motion only.

## Acceptance gate (run before declaring done)

- [ ] JS disabled → seven sections stacked, legible, all links work.
- [ ] 375 / 768 / 1024 / 1440 / 1920 / 2560 px: no horizontal overflow on `<body>`.
- [ ] ≥55fps scrubbing the full track, 4× CPU throttle, zero `Layout` entries during scroll.
- [ ] Lighthouse mobile Performance ≥85, LCP ≤2.5s. Videos have posters, images have explicit `width`/`height`.
- [ ] Track x is provably frozen during the expand phase.
- [ ] Added JS excluding GSAP/Lenis ≤25KB gzipped.
- [ ] Full keyboard traverse works; reduced-motion renders a vertical page.
