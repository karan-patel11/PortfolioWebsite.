# Mobile performance overhaul — local validation

Validated September 30, 2026. Production preview: http://localhost:4173/PortfolioWebsite./.

## 1. Local audit and baseline

The previous touch path converted horizontal pointer deltas into document scroll changes. Every document scroll rendered a transformed seven-page track, read/wrote panel scroll positions, updated navigation attributes, and walked chapter geometry for parallax/entrances. Its horizontal wheel listener was non-passive. Even though baseline load and desktop-host frame tests passed, that gesture dependency made mobile motion sensitive to main-thread work.

Baseline: 351 Chrome assertions passed; Lighthouse Mobile performance 92, CLS 0, total blocking time 0. Baseline rAF cadence was about 60 on this host too; there is no measured baseline physical-device frame rate, so these results do not establish that the reported live-device stutter was reproduced.

## 2. Implementation and copy

- Native touch track below 1024 CSS pixels or with a coarse primary pointer: CSS `scroll-snap-type: x mandatory`, momentum scrolling, horizontal overscroll containment, and native vertical chapter scrolling. Horizontal swipes change chapters; vertical swipes read the current chapter. This deliberately changes the previous mobile down-to-sideways gesture mapping.
- The native track has no JavaScript gesture physics or non-passive wheel listener. Its passive scroll callback publishes chapter changes at most once per animation frame. It does not transform the track, traverse geometry, or update panel scroll positions during a swipe. The browser handles momentum and snapping.
- Panel layout/paint containment bounds invalidation. Native scrolling does not need a giant `will-change: transform` layer. Desktop keeps `translate3d` travel and bounded rAF rendering, with read/write batching and inactive-panel updates only on chapter changes.
- Touch devices omit parallax, decorative entrances, moving grain, animated diagram packets, and animated tablet navigation palette/indicators. No mobile third-party animation requests. Existing local variable fonts and responsive WebP assets are retained; images have intrinsic dimensions and reserved frames.
- The horizontal cue animates its small graphic using transforms, fades over 220ms on first touch, and stays dismissed for the session. The Explore action directly selects About.
- The top rail is hidden below 768px. A compact bottom dock provides chapter and theme controls; tested visible actions are at least 44 × 44px. Fresh visits default to light, including dark OS preferences and no-JavaScript visits. Explicit theme choices persist.
- Both requested intro statements are present verbatim. The first has a display claim and a readable supporting sentence. NMIMS uses **Bachelor of Technology (Honors in AI)** and **3 years diploma + 3 years B.Tech**, without the prohibited wording. Both institutions have the exact supplied coursework. Twods displays **300+ community members**.

### Twods counter parameters

Default duration: **2200ms**. Easing: **easeOutCubic**, `1 - (1 - t) ** 3`. Starts at zero when at least 20% of the number intersects the viewport, runs once, and preserves suffixes and decimal precision. Measured running-to-complete duration: **2232.7ms**, including initial rAF scheduling. Screen readers retain static final values; reduced motion immediately shows final values. Tabular numerals and reserved numeric widths prevent counter-driven movement; all observed layout-shift entries, including those after touch input, summed to zero.

## 3. Local device validation

Final Chrome regression suite: **416 assertions, 0 failures**. Ten screen sizes from 320px phones to 1440px desktop, with portrait/landscape, 200% text, both themes/contrast, native wheel and touch input, chapter selection, modal focus trapping/restoration, Back/Escape, deployment paths, reduced motion, and JavaScript-free native disclosures.

The dedicated touch profile uses real local Chrome with CDP device metrics and touch emulation (DPR 2). It captures all seven chapters plus education tails and metrics. iPhone 15 and 15 Pro share the tested 393 × 852 CSS viewport. These are viewport simulations, not iOS/Android browser engines or physical-device tests.

| Viewport | CSS size | rAF cadence | P95 interval | Max interval | CLS | Style recalculations |
|---|---|---:|---:|---:|---:|---:|
| small-phone | 320 × 568 | 60.00 | 16.7 ms | 16.8 ms | 0 | 12 |
| iPhone-14 | 390 × 844 | 59.85 | 16.8 ms | 33.2 ms | 0 | 13 |
| iPhone 15 / 15 Pro | 393 × 852 | 60.00 | 16.7 ms | 16.8 ms | 0 | 13 |
| Pixel-8 | 412 × 915 | 60.00 | 16.7 ms | 16.8 ms | 0 | 12 |
| iPad-portrait | 820 × 1180 | 59.84 | 16.7 ms | 33.3 ms | 0 | 18 |
| iPad-landscape | 1180 × 820 | 60.00 | 16.8 ms | 16.8 ms | 0 | 18 |

All chapters have zero horizontal content/document overflow; long content scrolls vertically. Phone layouts use one column and hide the top rail; tablets retain the full rail and two-column content. Education in iPad landscape needs 123px of vertical reading travel; its final coursework is visible in the saved tail screenshot. Small phones intentionally scroll longer intro, education, and venture content above the dock. Native sideways drag on a project card does not activate the project. Modal close returns the originating action above the dock.

## 4. Frame and paint profiling

Six rapid sideways sweeps plus one vertical gesture per viewport. No long tasks and no frame interval above 34ms in final samples; P95 stayed within 16.8ms. Two samples had isolated 33ms intervals. Therefore these measurements support approximately 60Hz lab cadence, **not a claim of sustained zero-drop compositor FPS on physical phones**. The instrumentation includes DevTools/input overhead and runs on a desktop host.

| Viewport | Baseline → final style recalculations | Reduction | Baseline → final script time |
|---|---:|---:|---:|
| small-phone | 202 → 12 | 94.1% | 48.4 → 15.6 ms |
| iPhone-14 | 255 → 13 | 94.9% | 59.3 → 16.1 ms |
| iPhone-15-Pro | 261 → 13 | 95.0% | 53.0 → 15.9 ms |
| Pixel-8 | 348 → 12 | 96.6% | 53.2 → 11.2 ms |
| iPad-portrait | 592 → 18 | 97.0% | 56.0 → 16.0 ms |
| iPad-landscape | 561 → 18 | 96.8% | 49.4 → 16.6 ms |

Comparable iPhone-14 DevTools touch traces:

| Trace work | Baseline | Final |
|---|---:|---:|
| Style updates | 255 / 88.299ms | 12 / 0.885ms |
| Paint | 89 / 16.399ms | 27 / 1.741ms |
| Layout | 6 / 1.85ms | 6 / 1.878ms |

Final isolated Lighthouse **91/100**, version 12.8.2, default Mobile simulated throttling:

- FCP 1.65s; LCP 3.38s.
- Total blocking time 0ms; CLS 0.
- The score meets the requested 90+ budget. This uncompressed local static server is not an estimate of real GitHub Pages network performance.

Engineering references: [WebKit fast overflow scrolling](https://webkit.org/blog/9674/new-webkit-features-in-safari-13/), [WebKit scrolling and snapping](https://trac.webkit.org/wiki/Scrolling), [Chrome rendering pipeline](https://developer.chrome.com/blog/inside-browser-part3). rAF runs on the main thread; it does not make JavaScript physics run off-thread. Native compositor scrolling avoids that dependency.

## 5. Visual critique and corrections

Reviewed individual screenshots and phone/tablet contact sheets. The claim and verification sentence have distinct typography; education headings, track note, dates, and coursework have a readable hierarchy; light/dark contrast checks pass. Long sections retain readable text rather than shrinking it to fit one screen. Tail checks verify content can clear the fixed dock.

The first regression pass found transient desktop scrollbar width mismatch and browser history restoring focus to a native scroll container. Desktop reserves its scrollbar before measurement; close handling now restores the originating action after browser history focus restoration. Final regression checks pass.

## 6. Production build and sign-off

Built with `BASE_PATH=/PortfolioWebsite. npm run build`; `npm run lint`, `npm test`, and `git diff --check` pass. Production output is in `dist/`; the reviewable static bundle is `comparison/mobile-overhaul/portfolio-github-pages.zip`. No pushes or deployments were performed. Existing unrelated working-tree edits were preserved.

**Local automated sign-off: passed. Physical-device / Safari sign-off: outstanding.** No physical iPhone, Pixel, or iPad was available to this session. Sustained physical-device 60fps, Safari momentum/axis locking, actual browser toolbar changes, and home-indicator safe areas still require real-device verification. The isolated 33ms lab samples are disclosed above; zero dropped frames is not certified.

Artifacts:

The source patch is the cumulative current diff against Git HEAD for the touched
files, plus the new profiling script. README and the regression script already
had local edits when this request began; those edits are preserved in the patch.

- [Updated source diff](comparison/mobile-overhaul/source-changes.patch)
- [Regression results](comparison/mobile-first/results.json)
- [Touch profile](comparison/mobile-overhaul/final/results.json)
- [Phone visual review](comparison/mobile-overhaul/final/phones-contact-sheet.jpg)
- [Tablet visual review](comparison/mobile-overhaul/final/tablets-contact-sheet.jpg)
- [Lighthouse HTML](comparison/mobile-overhaul/final/lighthouse.report.html)
- [Lighthouse JSON](comparison/mobile-overhaul/final/lighthouse.report.json)
- [Final touch trace](comparison/mobile-overhaul/final/touch-trace.json)
- [Trace comparison](comparison/mobile-overhaul/trace-summary.json)

To reproduce, run the project-path build and preview server, then `npm test` and `node scripts/profile-mobile.mjs`. Open the trace JSON in Chrome DevTools Performance. The profile requires Chrome; set `CHROME_PATH` to override the macOS default. Run profiling and Lighthouse separately for comparable results.
