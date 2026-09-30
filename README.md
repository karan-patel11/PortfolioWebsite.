# Karan Patel portfolio

One editorial chapter flow built from the finalized `portport.zip` handoff.
The core UI has no runtime dependencies, external fonts, or trackers. The optional
desktop intro uses GSAP, with a bounded static fallback if its CDN is unavailable.

## Run

Requires Node.js 22 or newer.

```sh
npm run build
npm test
npm run dev
```

Open http://localhost:4173. Deploy the contents of `dist/` on a static host.
All four project routes have their own `index.html`; the host must serve directory
indexes. The home page and native disclosures remain usable without JavaScript.

## Edit

- `content/portfolio.json`: supplied public content and unresolved editorial notes.
- `scripts/build.mjs`: semantic static page templates and content mapping.
- `src/style.css` and `src/tokens.css`: responsive layouts and approved tokens.
- `src/main.js` and `src/navigation.js`: theme controls, chapter sheet, hint, and modal routing.
- `src/mobile-first.css`: mobile dock, readable chapter flow, safe areas, and 44px controls.
- `src/motion.js`: native vertical scrolling mapped to horizontal chapters on every viewport.
- `src/metrics.js`: once-only, viewport-triggered Twods counters with reduced-motion support.
- `dist/assets/`: optimized responsive WebP derivatives of supplied images.
- `karan-patel-single-design-handoff/`: untouched design package and originals.

The build only uses the finalized package. The former root HTML, CSS, and script
were removed from the working site and remain recoverable in Git history.

## Content decisions

NMIMS contains only the supplied institution, qualification, and dates. The
ambiguous duration strip, QE Copilot, BGE embeddings, Qdrant, and Jenkins are
excluded as instructed. LinkedIn, GitHub, X, repositories, missing demos,
and a resume file were not supplied. Their actions are omitted rather than
invented. The two supplied live project URLs are included.

## Verification

`npm test` runs real Chrome checks at eight phone, tablet, desktop, and landscape
sizes. It verifies the mobile header breakpoint, 44px targets, horizontal overflow,
native wheel/touch progression, counters, theme persistence, sheet focus, project
history, resizing, reduced motion, and the JavaScript-free fallback. Results and
screenshots are saved in `comparison/mobile-first/`. Requires local Google Chrome;
set `CHROME_PATH` for another installation. Touch input is emulated.

Development-only `/__qa/` fixtures support enlarged text, text spacing, and
JavaScript-free rendering. They are not included in production output.

Fresh visits start in light mode; explicit theme choices persist. Below 768px,
the top rail is hidden and a safe-area-aware bottom dock opens the chapter sheet.
Normal vertical gestures scroll through a chapter's full content, then move the
track sideways. Horizontal wheel/touch gestures also advance the track. The hint
fades on interaction and stays dismissed for the browsing session. Reduced motion
uses discrete chapter changes and final metric values. Mobile navigation and
counters do not depend on third-party animation libraries.

## GitHub Pages v2

The production site is https://karan-patel11.github.io/PortfolioWebsite./.
The Pages workflow builds with `BASE_PATH` supplied by `actions/configure-pages`,
runs lint and Chrome verification, and publishes only `dist/`. Pushes to `main`
deploy automatically after the checks pass.

To verify the exact project-path build locally:

```sh
BASE_PATH=/PortfolioWebsite. npm run build
npm test
npm run dev
```

Open http://localhost:4173/PortfolioWebsite./. Plain `npm run build` still targets
the host root. The preview server reads the generated path from `site-config.json`.
The release suite also covers all project redirects and detail dialogs, v1
bookmarks, malformed fragments, text contrast in both themes, 200% text sizing,
resource availability, and JavaScript-free native detail disclosures.
