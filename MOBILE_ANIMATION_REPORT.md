# Local entry, swipe and coursework verification

Updated September 30, 2026. Changes are built locally; nothing was pushed or deployed.

## Updated files

- `scripts/build.mjs`: prepaint intro bootstrap and semantic university/ticker HTML; all animation assets are local.
- `src/hero.js`, `src/hero-motion.css`: year reel and masked name/text entrance using Web Animations, with an input skip, reduced-motion skip and five-second fallback.
- `src/coursework.js`: visible-slide activation, pause/play, touch hold/tap and reduced-motion Next controls.
- `src/deck-pagination.js`: one shared university section across standard breakpoints; intact intro decorations and final-state measurement.
- `src/viewport-deck.css`: native snap rules, responsive university cards and continuous ticker styles.
- `src/motion.js`, `src/main.js`: native touch release and component initialization.
- `scripts/verify-animation.mjs`, `scripts/verify-deck.mjs`, `scripts/profile-mobile.mjs`: reproducible local validation and profiling.

## Opening animation

The old desktop-only eligibility gate and remote GSAP dependency prevented the animation on mobile and when its CDN was unavailable. The head now arms the home route before CSS paints on both fresh loads and refreshes, including `#intro`. The intro waits for DOMContentLoaded before awaiting the main module’s readiness promise, preventing a deferred-script race that could start it before navigation initialized. Once fonts and measured deck layout are ready, a local Web Animations sequence rolls 2013–2026 into the reserved name area, then reveals the name and supporting lines over approximately 2.2 seconds.

The decorative year is absolutely positioned inside the name wrapper, so it stays aligned when the responsive layout changes. All animated properties are transform/opacity. Geometry is measured in its final state; masks retain the same dimensions throughout. Input skips synchronously and leaves navigation available. Reduced motion and return/deep-link navigation expose readable static content. A five-second deadline releases the static layout even if initialization fails.

## Touch and viewport lock

The deck uses `scroll-snap-type: x mandatory`, `scroll-behavior: smooth`, `-webkit-overflow-scrolling: touch`, `overscroll-behavior-x: contain`, and `touch-action: pan-x`. The viewport remains `100dvh` with `100svh` fallback; panels occupy the exact measured viewport width with `100vw` fallback. Panels and ticker masks use `overflow: clip` rather than creating nested scrolling areas.

Native scrolling owns dragging and touch release. A 24px deliberate horizontal drag, or a 12px flick at 0.18px/ms, selects the adjacent page through native smooth `scrollTo`; release no longer cancels inertia with an instant jump and a JavaScript animation loop. Mandatory snap stays active throughout touch gestures. A vertical pull cannot move the document or individual cards.

Wheel/keyboard/link changes keep a 560ms eased glide. A 4px wheel threshold reduces effort; consuming the gesture until 180ms of quiet prevents inertia from advancing multiple pages. Resize, image loads and idle native anchor changes preserve the selected page.

## Coursework loops

GWU and NMIMS now share one Education page, including 320 × 568 and short landscape. GWU contains all six supplied courses; NMIMS contains all ten, with unchanged wording.

Two identical flex groups form each track. Every group includes the same end gap, so each occupies exactly half the combined width. The continuous linear animation ends at `transform: translate3d(-50%, 0, 0)`, placing the duplicate exactly where the original started before restarting. Runtime duration is half the track width divided by 32px/s, maintaining reading speed for either course inventory. The clip boundary keeps this wide track out of card and viewport overflow calculations.

Hover and touch hold pause the loop; a short tap toggles pause, while horizontal travel passes through to deck navigation. An explicit Pause/Play control supports keyboard input. Only the settled visible university animates; offscreen tracks pause and release `will-change`. The duplicate list is `aria-hidden` and inert, leaving one complete accessible inventory. Reduced motion disables automatic movement and provides a Next control that reveals each course with an instant transform.

## Regression results

Build, lint and whitespace checks passed. The responsive suite now covers 22 viewport sizes with both universities on one page; see RWD_AUDIT_REPORT.md for the current combined-layout results. The final entry/ticker suite completed **143 assertions with zero failures** in 77.79 seconds across seven screens: 320 × 568, iPhone SE (375 × 667), iPhone 15 (390 × 844), iPhone 15 Pro (393 × 852), Pixel 8 (412 × 915), tablet (820 × 1180) and laptop (1440 × 900).

Fresh-load and refresh entrances completed with zero CLS on every screen. The year stayed anchored to the name, ticker duplicates matched at the loop boundary, hover/touch/keyboard pauses worked, offscreen tickers stopped, and reduced motion exposed courses with the Next control. Five additional immediate keyboard inputs during fresh intros each skipped the animation and landed on About. Ticker sampling measured approximately 60 rAF frames/s, with 95th-percentile frame intervals of 16.7–16.8ms and no sampled interval over 34ms.

## Local swipe profiling

Command: `PROFILE_LABEL=entry-tickers npm run profile:mobile`. Three forward and three reverse emulated swipes plus a vertical pull were profiled per screen. Captures cover every primary chapter and both Education pages. All eight cases passed with zero document/card overflow, zero layout shift and no long tasks. No sampled frame exceeded 34ms. Renderer metrics and the iPhone 15 DevTools trace are saved in `comparison/mobile-overhaul/entry-tickers/`.

| Profile | Viewport | Median interval | 95th percentile | Approx. rAF FPS | CLS |
| --- | --- | --- | --- | --- | --- |
| small-phone | 320 × 568 | 16.7 ms | 16.7 ms | 59.9 | 0 |
| iPhone-SE | 375 × 667 | 16.7 ms | 16.7 ms | 60.0 | 0 |
| iPhone-15 | 390 × 844 | 16.7 ms | 16.8 ms | 60.0 | 0 |
| iPhone-15-Pro | 393 × 852 | 16.7 ms | 16.8 ms | 59.9 | 0 |
| Pixel-8 | 412 × 915 | 16.7 ms | 16.7 ms | 60.0 | 0 |
| iPad-portrait | 820 × 1180 | 16.7 ms | 16.7 ms | 59.9 | 0 |
| iPad-landscape | 1180 × 820 | 16.7 ms | 16.8 ms | 59.9 | 0 |
| laptop | 1440 × 900 | 16.7 ms | 16.7 ms | 59.9 | 0 |

These are real local Chrome renderer measurements with emulated touch. rAF cadence is a lab proxy, not a physical iOS/Android compositor FPS measurement. Physical Safari gesture feel was not tested.

## Visual inspection

Personally reviewed all generated chapter/Part screenshots at 375 × 812, 820 × 1180 and 1440 × 900, plus the opening year animation and university cards on small phones. Checked institution/image association, name/year alignment, complete employer/project groups, readable copy, Roman numbering and separation from the mobile dock. Review sheets are in `comparison/viewport-deck/review-{phone,tablet,laptop}.png`; opening and university screenshots are in `comparison/animation-review/`.

## Reproduce

```sh
npm run build
npm run lint
npm test
npm run test:animations
PROFILE_LABEL=entry-tickers npm run profile:mobile
```

The tests launch a separate disposable local Chrome profile, with animation CDNs blocked. Full responsive results are in `comparison/viewport-deck/results.json`; entry/ticker assertions are in `comparison/animation-review/results.json`.
