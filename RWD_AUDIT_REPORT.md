# Responsive framing and Education audit

Updated locally September 30, 2026. Production output is rebuilt in `dist/`.

## Implemented changes

Both universities now share one measured Education section at all 22 standard test sizes. The explicit NMIMS page break is removed. Roomy desktops use two columns; tablets generally stack image/copy rows; narrow phones stack compact cards. Short tablet/laptop and landscape screens use compact columns. Short narrow phones omit the decorative campus photographs to preserve qualification text. The measured paginator can still preserve whole cards on further pages for unusually enlarged content, rather than clipping them.

An inherited NMIMS-only bottom-padding rule caused misaligned controls. It is removed from the base/mobile styles. Cards now share padding, matched image frames and aligned coursework controls. Compact layouts use an explicit grid row for the ticker and its 44px pause control.

The Education container has a 1200px maximum width, `minmax(0,1fr)` tracks, 12–20px card padding and 10–20px stacked spacing. Headings use rem/clamp sizing and balanced wrapping; paragraphs use `text-wrap: pretty`. Primary body copy retains a 1rem floor, with 0.875rem qualification metadata on compact screens. Email and keyword containers can wrap long strings. Chapter counters remain on one line, grid children use `min-width:0`, and images remain inside their frames.

The intentionally clipped coursework strip and the horizontal chapter deck remain the only intentional horizontal movement. All six GWU and ten NMIMS courses retain their exact wording and accessible list structure. Duplicate ticker content is hidden from assistive technology.

The prepaint layout guard now covers direct chapter links as well as the intro. It reveals content after font readiness and deck measurement, preventing an unpaginated first frame from flashing. A five-second fallback prevents failed initialization from leaving content hidden. Existing entrance animations and native touch snapping remain intact.

## Exact updated code

- Complete CSS source: `src/viewport-deck.css`.
- Exact operative Education/framing CSS excerpt: `comparison/framing-review/education-and-framing.css`.
- Exact generated semantic Education HTML: `comparison/framing-review/education-section.html`.
- HTML generator and prepaint guard: `scripts/build.mjs`.
- Measured section assembly: `src/deck-pagination.js`.
- Layout-readiness release: `src/main.js`.
- Removed conflicting padding: `src/style.css` and `src/mobile-first.css`.

The generator produces two articles inside `.education-cards`. Runtime pagination moves those intact articles into `.deck-school` wrappers under one `.deck-content`. The excerpt uses the actual application class names and existing design tokens. The complete production entrypoint remains `dist/index.html`.

## Verification

Build, lint and whitespace checks passed. The expanded all-chapter regression passed **940 checks** across 22 emulated viewports in 126.19 seconds, covering generated pages, overflow/clipping, gestures, inertia, modal focus, reflow stability, content preservation, both themes and asset/route URLs.

The final framing audit passed **132 checks** in 42.93 seconds: one Education page, equal column heights and aligned controls, matching stacked margins, readable metadata, 44px controls, ticker containment and zero fresh-load layout shift. It also verified fresh links to every primary chapter on phone, tablet and laptop profiles. The intro/ticker suite passed **143 checks** in 77.79 seconds, including load/refresh, seamless loops, hover/touch/keyboard pause, reduced motion and immediate input handoff. Ticker sampling remained approximately 60 rAF frames/s.

| Viewport | Education arrangement | Pages | Fresh-load CLS |
| --- | --- | ---: | ---: |
| 320 × 568 | Stacked | 1 | 0 |
| 320 × 701 | Stacked | 1 | 0 |
| 360 × 640 | Stacked | 1 | 0 |
| 375 × 667 | Stacked | 1 | 0 |
| 375 × 812 | Stacked | 1 | 0 |
| 390 × 844 | Stacked | 1 | 0 |
| 393 × 852 | Stacked | 1 | 0 |
| 412 × 915 | Stacked | 1 | 0 |
| 600 × 960 | Stacked | 1 | 0 |
| 767 × 900 | Stacked | 1 | 0 |
| 768 × 1024 | Stacked | 1 | 0 |
| 820 × 1180 | Stacked | 1 | 0 |
| 900 × 600 | Columns | 1 | 0 |
| 1024 × 568 | Columns | 1 | 0 |
| 1024 × 768 | Columns | 1 | 0 |
| 1280 × 720 | Columns | 1 | 0 |
| 1366 × 768 | Columns | 1 | 0 |
| 1440 × 900 | Columns | 1 | 0 |
| 1920 × 1080 | Columns | 1 | 0 |
| 2560 × 1440 | Columns | 1 | 0 |
| 667 × 375 | Columns | 1 | 0 |
| 844 × 390 | Columns | 1 | 0 |

Evidence is saved under `comparison/viewport-deck/`, `comparison/framing-review/` and `comparison/animation-review/`. Final Education screenshots are in `comparison/framing-review/`. These are local Chrome emulations, not physical iOS/Android measurements.

```sh
npm run build
npm run lint
npm test
npm run test:framing
npm run test:animations
```

## First-time visitor / hiring-manager review

**Hierarchy and readability:** Institutions, degrees and dates read as complete groups, enabling immediate comparison. Whole employer/role groups and project outcome rows support scanning. The 14px metadata on short phones is a deliberate space compromise; primary body text remains larger.

**Professional polish:** Consistent padding, matched image frames, aligned controls and restrained serif/sans typography give the page a coherent editorial appearance. Removing the institutional offset and first-paint reflow fixes visible inconsistencies.

**Remaining UX friction:** The horizontal deck requires a visitor to learn its navigation, and dense content produces more pages on the smallest phones. A direct Selected Work action from the hero would bring hiring evidence within one tap. Moving coursework also takes time to scan; a future static-list option would help fast readers. These are future improvements, preserving the requested ticker behavior for this pass.
