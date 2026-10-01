# Viewport deck implementation and local verification

Implemented and verified locally on September 30, 2026. No GitHub push or deployment was performed.

## Architecture

`src/viewport-deck.css` is the final architecture stylesheet, loaded after the base compositions. `src/deck-pagination.js` owns measured content partitioning. `src/motion.js` owns the single native horizontal track, wheel/keyboard navigation, resize handling and modal locking.

The document, main element and viewport shell cannot scroll vertically. The shell uses `100svh` as the fallback followed by `100dvh`, and its pin, track and slides inherit the exact available height. Slides use `100vw` as their width fallback; `measureTrack()` sets `--panel-width` to `document.documentElement.clientWidth` and `--panel-count` to the generated slide count.

The operative declarations in `src/viewport-deck.css` are:

```css
[data-horizontal-story] { height:100svh; height:100dvh; overflow:hidden; }
[data-horizontal-track] {
  display:flex; width:100%; height:100%;
  overflow-x:auto; overflow-y:hidden;
  scroll-snap-type:x mandatory;
  scroll-behavior:smooth;
  touch-action:pan-x; overscroll-behavior-x:contain; overscroll-behavior-y:none;
  scrollbar-width:none; -webkit-overflow-scrolling:touch;
}
[data-horizontal-panel] {
  flex:0 0 var(--panel-width,100vw);
  width:var(--panel-width,100vw);
  height:100%; min-height:0; max-height:100%;
  overflow:clip;
  scroll-snap-align:start; scroll-snap-stop:always;
  touch-action:pan-x; contain:layout paint;
}
```

`overflow: clip` on slides, images and text masks is essential: unlike hidden overflow, it does not create an inner scroll container that intercepts a native swipe. The track is the only horizontal scroller. The former document-height/overflow-distance transition calculation and panel `scrollTop` animation were removed.

Fluid scale uses these exact tokens:

```css
--chapter-top:clamp(16px,3dvh,32px);
--gap:clamp(10px,1.8dvh,22px);
--fs-body:clamp(1rem,1.7dvh,1.0625rem);
--fs-heading:clamp(1.75rem,min(3.5vw,5dvh),2.5rem);
--fs-hero:clamp(3.25rem,min(11vw,15dvh),10rem);
--fs-work-title:clamp(1.5rem,min(3.5vw,4dvh),3rem);
```

Body text stays at least 16px with the default browser font size. Labels and metadata use 14px. Below 768px, the header is hidden; padding reserves safe areas and the bottom dock. Short landscape screens use smaller spacing and wider grids while preserving the same body font floor.

## Content partitioning and navigation

Every chapter except a fitting desktop Intro uses a consistent semantic layout on fresh load and after resize. The paginator moves complete content groups into consecutive sibling slides. It measures the actual rendered content, including the final chapter heading, before accepting each block. Overflow creates another sibling rather than an inner scrollbar. Individual paragraphs may split at sentence or word boundaries when necessary; original IDs, controls, links and listeners remain usable.

Twods pages are labeled `Twods Capital: Research & Systems — Part I`, `— Part II`, and further parts as needed. Narrative, growth metrics, QuantEra AI and investment principles remain in order. The separate QuantEra system-design diagram page has been removed. Chapter headings, part labels, part counts and the chapter menu use Roman numerals. The overview/story/metrics and QuantEra research/thesis are distinct sections. Phones stack them; tablet and laptop research pages place the overview and principles in two coherent columns. Smaller phones require further parts to preserve readable typography.

Education places GWU and NMIMS together on one shared slide at every standard breakpoint, using aligned columns or stacked cards as space allows. Each card ends in a clipped horizontal coursework ticker; coursework never adds vertical height or continuation pages. Both required coursework inventories and the exact degree/track text are preserved. The supplied intro statements are preserved verbatim. The community metric remains `300+ community members`.

Native touch owns continuous dragging. Release assistance selects an adjacent slide after a 24px drag or a 12px flick at 0.18px/ms. Desktop wheel gestures have a 4px activation threshold. Wheel, keyboard and chapter-link navigation use a 560ms cubic Hermite glide. Touch release hands its destination to native `scrollTo({behavior:"smooth"})`, keeping CSS mandatory snapping active throughout dragging and release. Wheel/keyboard easing temporarily disables CSS snap until the boundary; the idle-settle timer cannot truncate the animation. The gesture is consumed until wheel input is quiet for 180ms; lingering trackpad inertia cannot retrigger another page. Keyboard navigation uses adjacent pages. No vertical gesture is translated into a document or card scroll.

Height/width changes repack the deck while preserving the selected chapter and Part number, then restore its exact horizontal snap point. Existing slide elements are reused. A cached source tree restores complete groups after a phone split, so wider reflows do not inherit fragmented content. Oversized first blocks are checked before splitting rather than silently discarded. Project rows remain atomic, and each role stays inside its employer group. Unchanged viewport/font geometry and already-fitting content skip redundant repacking. Unexpected native scroll-anchor adjustments are corrected to the selected page rather than published as navigation. Portrait dimensions are reserved before lazy decoding; image loads and font readiness can trigger a bounded remeasurement. Repacking is deferred while a modal is open, preserving native dialog focus and top-layer state.

Long project/experience details use a fixed header, bounded page and Previous/Next pager. Chapter and detail dialogs retain Escape, Back, focus restoration and deck locking.

Counters use 2200ms ease-out cubic (`1 - (1 - progress) ** 3`), start when their slide is settled, and run once. Accessible final values remain in the HTML. Reduced motion displays final values immediately.

## Local verification

Commands completed:

```sh
npm run build
npm run lint
node scripts/verify-deck.mjs
BASE_PATH=/PortfolioWebsite. npm run build
npm run lint
node scripts/verify-deck.mjs
```

Latest responsive-layout and navigation run: **940 assertions, 0 failures**, 126.19 seconds across **22 emulated viewports**. Final card alignment and fresh-link stability passed another 132 checks. See RWD_AUDIT_REPORT.md for current Education framing and code.

| Emulated viewport | Deck slides | Twods parts | Detail pages checked | Result |
| --- | ---: | ---: | ---: | --- |
| 320 × 568 | 20 | 9 | 30 | Pass |
| 320 × 701 | 17 | 7 | 23 | Pass |
| 360 × 640 | 16 | 6 | 23 | Pass |
| 375 × 667 | 13 | 4 | 22 | Pass |
| 375 × 812 | 9 | 3 | 18 | Pass |
| 390 × 844 | 9 | 3 | 18 | Pass |
| 393 × 852 | 9 | 3 | 18 | Pass |
| 412 × 915 | 9 | 3 | 15 | Pass |
| 600 × 960 | 8 | 2 | 12 | Pass |
| 767 × 900 | 8 | 2 | 11 | Pass |
| 768 × 1024 | 8 | 2 | 11 | Pass |
| 820 × 1180 | 8 | 2 | 9 | Pass |
| 900 × 600 | 9 | 2 | 19 | Pass |
| 1024 × 568 | 11 | 3 | 20 | Pass |
| 1024 × 768 | 8 | 2 | 14 | Pass |
| 1280 × 720 | 8 | 2 | 15 | Pass |
| 1366 × 768 | 8 | 2 | 14 | Pass |
| 1440 × 900 | 8 | 2 | 11 | Pass |
| 1920 × 1080 | 8 | 2 | 10 | Pass |
| 2560 × 1440 | 8 | 2 | 9 | Pass |
| 667 × 375 | 28 | 9 | 34 | Pass |
| 844 × 390 | 18 | 5 | 33 | Pass |

Latest local layout measurements ranged from **6.5–18.0ms**. Counter state durations were **2223.9–2224.0ms**. These are local lab measurements, not physical-device FPS claims.

Responsive compositions use chapter-specific layouts: whole employer cards in two columns and paired university cards at desktop widths and stacked image/copy rows on tablets, a portrait beside the biography, complete three-column project rows, and coherent Venture overview/research sections. Phones use stacked groups. About keywords and Contact details stay with related copy rather than occupying sparse standalone pages. Primary body text remains at least 16px; compact Education metadata uses 14px.

Six desktop Education/Venture scenarios at 1280px, 1440px and 1920px verify that delayed image loads, refresh calls, unexpected native snap-anchor adjustments and idle time cannot select a different page. Additional checks cover light 4px and 14px wheel inputs, a two-second inertia tail, a subsequent deliberate gesture, 28px mobile swipes in both directions, and phone-to-desktop reflow. These directly exercise the reported unwanted-page-change and excessive-effort regressions. The wheel trajectory captured 43 frames with monotonic movement and a maximum 64px step at 1440px width (4.4% of one slide), without a snap jump. The suite also verifies that the diagram is absent and Roman chapter numbering is consistent.

The suite checks every generated slide and detail page for horizontal/vertical overflow and clipped content; vertical touch pulls on every phone slide; slow drags and rapid flicks in both directions; card swipe handoff; one-page wheel bursts; modal locking and Escape/Back focus; height-change page preservation; exact required copy; reduced motion; text contrast in both themes; resource URLs; and all project redirects. Third-party animation CDNs are blocked during verification.

Machine-readable evidence: `comparison/viewport-deck/results.json`. Screenshot evidence includes `375x667-intro.png`, `375x667-education.png`, `375x667-venture.png`, `375x667-metrics-settled.png` and `1440x900-intro.png` in the same directory.

Validation used real headless Chrome with touch emulation. Physical Safari/Android gesture feel and browser address-bar animation remain device checks. Measured pagination and paged details require JavaScript.

## Visual review

Personally inspected settled screenshots of every chapter and generated Part at 375 × 812 (phone), 820 × 1180 (tablet), and 1440 × 900 (laptop). Captures wait for entrance animations and running counters to finish. Review sheets use only the currently generated pages: `comparison/viewport-deck/review-phone.png`, `review-tablet.png`, and `review-laptop.png`. Full-size screenshots are saved beside them.

Confirmed employer/role association, complete project rows, Venture reading order, image/text alignment, readable body copy, chapter numbering, and safe-area separation from the phone dock. Automated semantic checks cover all four roles, all four projects, and both institutions at every viewport. These are emulated previews, not physical-device inspection.
