# Karan Patel portfolio

One editorial chapter flow built from the finalized `portport.zip` handoff.
The UI, fonts and animations are served locally with no runtime libraries or
trackers. A bounded Web Animations intro runs on home loads and refreshes across all viewports.

## Run

Requires Node.js 22 or newer.

```sh
npm run build
npm test
npm run dev
```

Open http://localhost:4173. Deploy the contents of `dist/` on a static host.
All four project routes have their own `index.html`; the host must serve directory
indexes. Measured content partitioning and paged details require JavaScript; fonts and assets are served locally.

## Edit

- `content/portfolio.json`: supplied public content and unresolved editorial notes.
- `scripts/build.mjs`: semantic static page templates and content mapping.
- `src/style.css` and `src/tokens.css`: responsive layouts and approved tokens.
- `src/main.js` and `src/navigation.js`: theme controls, chapter sheet, hint, and modal routing.
- `src/mobile-first.css`: mobile dock, chapter sheet, safe areas, and 44px controls.
- `src/viewport-deck.css`: viewport containment, fluid sizing, native snap track and paged detail layouts.
- `src/deck-pagination.js`: measured semantic sibling slides and bounded detail pages.
- `src/motion.js`: bidirectional touch translation, smooth snap release and wheel/keyboard chapter navigation.
- `src/hero.js` and `src/hero-motion.css`: local year/name entrance with prepaint masking and input skip.
- `src/coursework.js`: coursework ticker activation, touch pause, keyboard controls and reduced motion.
- `src/metrics.js`: once-only, viewport-triggered Twods counters with reduced-motion support.
- `src/assets/`: optimized responsive WebP derivatives of supplied images.
- `karan-patel-single-design-handoff/`: untouched design package and originals.

The build only uses the finalized package. The former root HTML, CSS, and script
were removed from the working site and remain recoverable in Git history.

## Content decisions

NMIMS includes the supplied B.Tech qualification, diploma/B.Tech track note,
dates, and highlighted coursework. GWU includes the supplied coursework. The
ambiguous About duration strip, QE Copilot, BGE embeddings, Qdrant, and Jenkins are
excluded as instructed. LinkedIn, GitHub, X, repositories, missing demos,
and a resume file were not supplied. Their actions are omitted rather than
invented. The two supplied live project URLs are included.

## Verification

`npm test` runs real Chrome checks at twenty-two phone, tablet, desktop, and landscape
sizes. It checks every generated slide and detail page for clipping and overflow,
vertical-to-horizontal touch translation, slow/rapid swipes on both axes, diagonal gestures, jitter rejection, cancellation, two-finger handoff, card gesture handoff,
light wheel gestures, short swipes, inertia tails, idle page stability, counters,
sheet locking, Escape/Back focus, breakpoint changes, reduced
motion, content preservation, text contrast, asset URLs and project redirects.
Results and screenshots are saved in `comparison/viewport-deck/`. Requires local
Google Chrome; set `CHROME_PATH` for another installation. Touch input is emulated.
See [VIEWPORT_DECK_REPORT.md](VIEWPORT_DECK_REPORT.md) for the architecture and
local verification breakdown. `npm run test:animations` checks fresh and refreshed
intro sequences, zero layout shift, ticker seams, pauses and frame cadence on seven
emulated screens. `npm run test:framing` checks card/control alignment and zero layout shift on fresh
chapter links. Its evidence is in `comparison/framing-review/`. Animation evidence
is in `comparison/animation-review/`; see
[MOBILE_ANIMATION_REPORT.md](MOBILE_ANIMATION_REPORT.md).

Development-only `/__qa/` fixtures support enlarged text, text spacing, and
JavaScript-free rendering. They are not included in production output.

Fresh visits start in light mode; explicit theme choices persist. Below 768px,
the top rail is hidden and a safe-area-aware bottom dock opens the chapter sheet.
Every viewport uses the same native horizontal CSS snap track. Vertical document
and chapter scrolling are locked. Overflowing content becomes consecutive sibling
slides labeled Part I, Part II, and further parts as needed. Cards and image masks
use `overflow: clip` so horizontal gestures reach the track. Wheel gestures and
keyboard arrows move between adjacent slides. A 4px wheel threshold, 24px swipe threshold and velocity-aware
release assistance reduce effort; inertia is consumed until a gesture goes quiet.
Image loads and layout updates preserve the selected Part page. Chapter-specific
layouts keep employers with roles, institutions with coursework, and complete
project rows. About and Venture use coherent content groups rather than an
alternating grid of loose paragraphs. A cached source tree restores whole groups
after resizing from phone to laptop. Wide Venture metrics use four columns. The separate QuantEra system-design
page is removed. Chapter and part numbers use Roman numerals. Page changes glide
over 560ms for wheel/keyboard input. Single-finger vertical and horizontal movement drives the track once per animation frame. Direction locks after 10px, and travel is bounded to one neighboring page. CSS snap pauses during the drag and returns for native smooth release; `touch-action: pinch-zoom` preserves zoom while preventing native panning. Project/role modals have bounded
pages with Previous/Next controls. The cue fades on first
touch and stays dismissed for the browsing session. Touch devices omit parallax
and decorative chapter entrances. Twods counters run once for 2200ms with
ease-out cubic easing; tabular numbers and reserved space prevent layout shifts.
Reduced motion shows final metric values. Both universities share one Education page at every standard breakpoint, with
two columns on roomy or short landscape screens and compact stacks elsewhere. Coursework uses
two identical pill groups and a linear `translate3d(-50%,0,0)` loop at 32px/s.
Hover, holding, tapping and a Pause/Play button support reading. Both university tickers animate only while Education is visible; reduced motion uses a static list with an instant Next control.
Navigation, counters and the opening animation are all local.

`node scripts/profile-mobile.mjs` saves screenshots, renderer timings, layout
shift observations, and a DevTools touch trace in `comparison/mobile-overhaul/`.
It covers iPhone SE, iPhone 15/Pro, Pixel 8, small phones, iPad portrait and
landscape, and laptop widths. Its rAF cadence is a lab proxy; physical iOS/Android QA is still needed
to confirm compositor FPS and real Safari gesture behavior. See
`MOBILE_ANIMATION_REPORT.md` for the current entry/ticker/swipe results.

## GitHub Pages v2

The production site is https://karan-patel11.github.io/PortfolioWebsite./.
The Pages workflow builds with `BASE_PATH` supplied by `actions/configure-pages`,
runs lint, Chrome verification and responsive framing checks, and publishes only `dist/`. The release keeps source files in Git and generates a fresh `dist/` during deployment; local screenshots and profiling output are excluded. Pushes to `main`
deploy automatically after the checks pass.

To verify the exact project-path build locally:

```sh
BASE_PATH=/PortfolioWebsite. npm run build
npm test
npm run dev
```

Open http://localhost:4173/PortfolioWebsite./. Plain `npm run build` still targets
the host root. The preview server reads the generated path from `site-config.json`.
The release suite covers all generated detail pages, project redirects, text
contrast in both themes, counter timing, and production resource availability.
No push or deployment is performed by local verification.

## Bidirectional touch navigation

See [TOUCH_NAVIGATION.md](TOUCH_NAVIGATION.md) for the complete drop-in JavaScript, required CSS, exact integration locations and threshold behavior. `PORTFOLIO_GESTURES_ONLY=1 npm test` runs the gesture/navigation regression without repeating the responsive layout matrix.
