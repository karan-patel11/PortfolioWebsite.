# MOTION SPEC — Horizontal-scroll portfolio (reference: khanhnguyen.design)

**How to use this file:** paste it into Codex as the task brief, or commit it to the repo root as `INSPIRATION.md` and tell Codex "implement §3 panel by panel, stop after each panel for review."

**Provenance of this spec.** Everything in §2–§6 marked **[DOM]** was read off the rendered DOM of the reference site (Astro v6.3.1 + Tailwind v4, custom TS motion layer). The markup is instrumented with `data-*` hooks that name each animation, so the structure below is observed, not guessed. Items marked **[INFER]** are durations, easings, and trigger offsets — the compiled JS was not readable, so those are reasonable values to start from and tune by eye, not gospel. Nothing here is invented whole cloth; where a value is unknown it says so.

---

## 0. Rules of engagement for the implementing agent

1. Build **panel by panel**, in the order of §3. Do not start panel N+1 until panel N is approved.
2. Every animated element gets a `data-*` hook in the markup and is driven from JS by that hook. No animation logic keyed to Tailwind/utility classes, no inline `style` animation except the initial state.
3. Animate **`transform`, `opacity`, `clip-path`** only. Never animate `width`, `height`, `top`, `left`, `margin`, or `font-size`. Any element that moves gets `transform: translateZ(0)` and `will-change: transform`.
4. Initial states live in the HTML/CSS (`opacity: 0`, `scale-x: 0`, `clip-path: inset(0 100% 0 0)`), so the page never flashes un-animated content before JS boots. JS animates *to* the resting state.
5. All content exists in the DOM as real text at all times. Nothing is injected by JS, nothing is `display:none` on desktop. Split-text wrappers are `aria-hidden="true"` only when a readable duplicate exists.
6. `prefers-reduced-motion: reduce` → every timeline is built with `duration: 0` and scroll-scrubbing is disabled; horizontal layout falls back to the vertical stack in §2.7.
7. Below the `md` breakpoint (768px) there is **no horizontal scroll and no scroll-jacking**. Same content, normal vertical document flow, per-section reveals only.
8. If something in this spec conflicts with a working build, stop and ask. Do not silently substitute a different effect.

### Stack constraints (non-negotiable, this repo)

- Static site on GitHub Pages. No framework, no build step beyond what already exists.
- **GSAP 3 (core + ScrollTrigger) via CDN.** Both are free. **Do not use SplitText or ScrollSmoother** — those are paid GSAP Club plugins. Write a ~20-line splitter (§2.6) and use **Lenis** (MIT) for smooth scroll.
- Total added JS budget: **≤ 25 KB min+gz excluding GSAP/Lenis**. If a panel needs more than ~80 lines of JS, flag it.
- Dark theme is default; light theme is a toggle in the header rail. Every colour below is a CSS custom property, never a literal in JS.

---

## 1. Content map (reference panel → this site's panel)

| # | Reference | This site | Keep the motion? |
|---|---|---|---|
| 1 | Loading / name hero | Name hero + role line | Yes, verbatim structure |
| 2 | Chapter I — Quick intro | About + portrait | Yes |
| 3 | "The / Work" expand panel | "Selected / Work" expand panel | Yes — this is the signature moment |
| 4 | Chapter II — Related work | Featured projects (Verdict, NorthPort, QuantEra, BNPL-Marketplace, QE-Copilot) | Yes |
| 5 | Chapter III — What I do | What I build (4 cards) | Yes |
| 6 | Chapter IV — Selected experiences | Experience (GWU, Vipul Enterprise, TWODS Capital) | Yes |
| 7 | Next chapter / contact | Contact | Yes |

Copy, colours, typefaces, and imagery are **ours**. Only the motion system is borrowed. Do not reproduce the reference's wording, chapter naming ("Chapter I"), or the "Folio — Edition" rail text.

---

## 2. Global systems

### 2.1 The `--scale` unit **[DOM, arithmetic INFER]**

The reference sizes almost everything in one derived unit: `text-[calc(18.1 * var(--scale))]`, `w-[calc(40 * var(--scale))]`, `h-[calc(0.3 * var(--scale))]`. Back-solving from the 1440×900 Figma frame the markup cites: the desktop rail is `w-16` (64px) and is also described as `8 * --scale`, so **`--scale ≈ 8px at 1440px wide`**, i.e. `100vw / 180`.

```css
:root { --scale: clamp(5.5px, calc(100vw / 180), 10px); }
@media (max-width: 767px) { :root { --scale: clamp(3.6px, calc(100vw / 90), 5px); } }
```

Every size in §3 is expressed in these units. Do not introduce a second sizing system.

Derived tokens used throughout **[DOM]**:

```css
--vg: calc(3 * var(--scale));        /* vertical gutter: top/bottom page margin */
--display-fs: calc(2.4 * var(--scale));
--cta-fs:     calc(1.8 * var(--scale));
--list-fs:    calc(4.1 * var(--scale));
--name-fs:    calc(18.1 * var(--scale));  /* desktop hero; 9 * --scale on mobile */
```

Desktop content insets **[DOM]**: left gutter `left-32` (128px = 16·scale, which is the 64px rail + 64px margin), right gutter `right-16` (64px = 8·scale), top/bottom `var(--vg)`.

### 2.2 Horizontal scroll engine **[DOM structure, INFER config]**

DOM contract, exactly as the reference:

```html
<div data-horizontal-story>            <!-- sets page background -->
  <div data-horizontal-pin>            <!-- md:h-dvh, this is what ScrollTrigger pins -->
    <div data-horizontal-track>        <!-- flex-col on mobile, md:flex-row md:flex-nowrap md:h-dvh -->
      <section data-horizontal-panel>…</section>  <!-- xN -->
    </div>
  </div>
</div>
```

- Panels are `w-full shrink-0` **except** the "what I build" panel, which is `md:w-max` and therefore wider than the viewport (§3.5). Track length is **not** `N × 100vw` — measure `track.scrollWidth` at runtime.
- One master ScrollTrigger: `pin: [data-horizontal-pin]`, `scrub: 1` **[INFER]**, `end: () => "+=" + (track.scrollWidth - window.innerWidth)`, `invalidateOnRefresh: true`, `anticipatePin: 1`.
- The track moves with `gsap.to(track, { x: () => -(track.scrollWidth - innerWidth), ease: "none" })`.
- Per-panel reveals attach as **child ScrollTriggers with `containerAnimation: masterTween`** and `horizontal: true`. This is the only correct way to trigger on x-position; do not fake it with progress maths.
- `ScrollTrigger.refresh()` on resize (debounced 150ms) and after fonts load (`document.fonts.ready`).
- Lenis: `lerp: 0.1`, `wheelMultiplier: 1` **[INFER]**. Wire `lenis.on('scroll', ScrollTrigger.update)` and drive Lenis from `gsap.ticker`.

### 2.3 The pause phase **[DOM — the reference documents this in an HTML comment]**

The master timeline is **not** one continuous slide. It has three phases:

1. Track slides until the "Selected / Work" panel is centred in the viewport.
2. **Track x is held still** while that panel plays its expand animation (§3.3).
3. Track resumes to its final x.

Implement as a single timeline: `tl.to(track, {x: xCentered})` → `tl.addLabel('expand')` + the panel's sub-timeline (track x untouched here) → `tl.to(track, {x: xFinal})`. Phase 2 should consume roughly **25–30% of total scroll distance** **[INFER]**.

### 2.4 Header rail **[DOM]**

- `position: fixed; z-index: 110;` starts at `opacity: 0`, fades in at the end of the intro sequence (§3.1) **[DOM: `data-intro-header` + `opacity-0`]**.
- Desktop: **left vertical rail, 64px wide, full height, 1px right border.** Contains, top to bottom: menu button (64px square, bottom border), vertical text block (`writing-mode: vertical-rl` reading upward), logo, second vertical text line.
- Mobile: top bar, full width, `px-5 py-4`, 1px bottom border, logo left + menu button right.
- The menu button is `disabled` until the intro finishes **[DOM]**, then opens a fullscreen overlay menu (`aria-expanded` / `aria-controls="fullscreen-menu"`) with the numbered nav items and social links.

**Scroll progress indicator [DOM: `data-header-scroll-progress`]**
- Desktop: a `0.3 * --scale` (~2.4px) wide vertical bar on the rail, `height: 100dvh`, `transform-origin: top`, `scaleY: 0 → 1` bound to master ScrollTrigger progress.
- Mobile: a 1px full-width bar at the header's bottom edge, `transform-origin: left`, `scaleX: 0 → 1` bound to document scroll progress.

**Per-panel header theming [DOM]** — this is the detail that makes the reference feel built rather than assembled. Each `section` declares:

```html
<section data-horizontal-panel data-header-bg="#faf9f6" data-header-text="#2e2b28" data-header-border="#b8b3ac">
```

The header holds those as inline custom properties (`--header-bg`, `--header-text`, `--header-border`) and consumes them via `bg-(--header-bg) text-(--header-text) border-(--header-border)`. As each panel's leading edge crosses the rail, tween the three properties to that panel's values over **0.4s, `power2.out`** **[INFER]**. The rail therefore flips dark→light→dark through the journey without ever changing markup. Panel 1's `data-header-bg` is `transparent` **[DOM]**.

In this repo the same mechanism must survive the dark/light theme toggle: `data-header-*` values resolve from theme tokens, not hex literals.

### 2.5 Reveal primitives — build these once, reuse everywhere **[DOM]**

The reference has exactly three reusable primitives. Build them as three functions, not per-section copies.

**(a) Masked line reveal — `[data-reveal-line]` / `[data-line]`**
Structure: an outer element at `opacity: 0`, containing `<span class="block overflow-hidden"><span class="block whitespace-nowrap translate-z-0" data-line>…</span></span>` per line.
Animation: outer `opacity 0→1`; each `[data-line]` `y: 100% → 0`, stagger **0.08s**, duration **0.9s**, ease **`expo.out`** **[INFER]**. Trigger: panel enters at 70% of viewport width **[INFER]**.
Used by: hero tagline, location/clock block, "Open for collaborations", "SCROLL", section labels, project list rows, client rows, contact block.

**(b) Two-stage image curtain — `[data-reveal-image-overlay]` + `[data-reveal-image]`** **[DOM]**
Both start at `clip-path: inset(0 100% 0 0)`; the image also starts `opacity: 0`. The overlay is a **solid colour card** sitting at `z-5` above the image at `z-10`… reading the stacking: overlay `z-[5]` inside the shell, image wrapper `z-10`.
Sequence: overlay wipes open left→right (**0.7s `power3.inOut`**), then the image wipes open on the same axis (**0.7s**, offset **-0.35s**) with `opacity → 1`, then the overlay wipes closed off the right edge. Net effect: a coloured panel sweeps across and leaves the photo behind it. **[timings INFER, mechanism DOM]**

**(c) Hairline draw — `[data-work-line]`**
`transform-origin: left; scaleX: 0 → 1`, duration **0.8s**, ease **`power3.out`**, stagger **0.06s** down the list **[INFER]**.

### 2.6 Text splitting **[DOM: `.char` / `.word` inline-block, `[data-name-line-text]`]**

The hero name and the contact heading are split per word (and the year digits per char). Write your own splitter:

```js
function splitWords(el){ el.innerHTML = el.textContent.trim().split(/\s+/)
  .map(w => `<span class="word">${w}</span>`).join(' '); }
```

Rules from the reference markup **[DOM]**:
- Each line lives in its own `overflow-hidden` mask so words can slide up from below the baseline.
- The mask carries padding-then-negative-margin compensation — `pl-[0.2em] -ml-[0.2em] pt-[0.1em] -mt-[0.1em]` — so descenders, italic overhang, and discretionary ligatures are not clipped. **Copy this trick; without it the display face gets shaved.**
- Split containers are `aria-hidden="true"`; the accessible text is the `<h1>`/`<h2>` itself.
- Re-split on resize only if the line count changes.

### 2.7 Mobile behaviour **[DOM]**

- `data-horizontal-track` becomes `flex-col`; panels become `w-full` auto-height (hero and the expand panel stay `100svh`).
- Reveals fire on vertical `ScrollTrigger` (`start: "top 75%"`).
- The expand panel (§3.3) pins vertically for its own duration; the word pair flies **up/down** instead of left/right.
- **Tablet portrait gets a full-screen "Rotate your screen" overlay** **[DOM: `.tablet-orientation-notice`, `z-[120]`, `role="status"`]**: shown when `768px ≤ width` fails but the device is a tablet in portrait — i.e. `(min-width: 600px) and (orientation: portrait)`. Decide whether we want this; it is an honest admission that the layout does not work in that window. My recommendation: **do not ship it** — ship a working vertical layout for tablet portrait instead.

---

## 3. Panel-by-panel animation inventory

### 3.1 Panel 1 — Hero / intro sequence **[DOM]**

Background `#262220`-equivalent dark token, full `h-dvh`, `overflow-hidden`, `data-header-bg="transparent"`.

Elements and their hooks, all present in the reference:

| Hook | What it does |
|---|---|
| `[data-loading-base-overlay]` | Solid block, `transform-origin: bottom left`, absolutely positioned bottom-left, z-0. Scales up as the loader progresses, then off. |
| `[data-hero-year]` | `overflow-hidden` clip shell at the same position as the name. |
| `[data-year-row]` | `opacity 0→1` + slide; defines `--year-slot` (the digit line height: `18.1·scale` desktop, `8.4·scale` mobile). |
| `[data-year-start-text]` | Static prefix `20`, chars `.char` inline-block. |
| `[data-year-strip]` | A vertical column of `.year-strip-cell` spans: `13,14,…,26`. |
| `[data-hero-name]` / `[data-name-row]` / `[data-name-heading]` | Two masked lines, words split. |
| `[data-loading-tagline]` | One-line role statement, top-right. |
| `[data-loading-journey-line]` | Bottom-right strapline. |
| `[data-reveal-line]` ×3 | Location + live clock (bottom-left), "Open for collaborations" (bottom-centre), "SCROLL" (bottom-right). |
| `[data-clock]` | Live clock, `tabular-nums`, initial text `--:--`. |

**Sequence (order is [DOM] via z-index and shared position; timings [INFER]):**

1. `t=0` — dark panel, everything at rest state. The year block and the name block occupy **the same grid slot** (`md:left-32 md:top-(--vg)`); year is `z-[2]`, name is `z-[1]`. This is deliberate: the counter sits where the name will land.
2. Year row fades in (`opacity 0→1`, `y: 0.3em → 0`, 0.6s).
3. **Odometer:** `[data-year-strip]` translates `y: 0 → -(13 × 1em)` so the visible cell runs `13 → 26`. Only the last two digits move; the `20` prefix is static. Duration ≈ **2.2s**, ease **`power2.inOut`** (not linear — it should ease into the final year). Drive it off real asset-load progress if we have any; otherwise a fixed tween.
4. Year block wipes up out of its clip shell (`y: -100%`, 0.6s, `power3.inOut`).
5. **Name enters in the vacated slot.** Per the reference's own comment: *the shell has no translateY — opacity + per-word motion only.* So `[data-name-row]` does `opacity 0→1` while each `.word` does `y: 100% → 0` inside its line mask, stagger **0.08s**, duration **1s**, `expo.out`.
6. `[data-loading-base-overlay]` scales away.
7. Tagline, journey line, and the three `[data-reveal-line]` blocks reveal, stagger **0.1s**.
8. Header fades in (`opacity 0→1`, 0.5s) and the menu button is enabled.
9. Clock starts ticking (1s interval, GMT-relative to our location, `tabular-nums` so digits don't jitter).

Total intro ≈ **4.5s**. **A first-time visitor must be able to skip it**: any wheel/touch/keydown before it finishes jumps the timeline to its end (`tl.progress(1)`). The reference does not appear to do this; we should, because our visitors are recruiters, not design-award juries.

### 3.2 Panel 2 — About **[DOM]**

- Group trigger `[data-about-reveal-group-trigger]` fires the whole cluster when the panel enters.
- `[data-about-reveal-label]` (small uppercase label) → primitive (a), first.
- `[data-about-reveal-intro]` (the one large paragraph, `--display-fs`) → primitive (a), offset **+0.1s**.
- `[data-about-reveal-quote]` (short pull-quote beside the portrait) → primitive (a), offset **+0.2s**.
- Portrait: primitive (b), the two-stage curtain, on `[data-about-reveal-group-image-shell]`. Desktop the image is `--portrait-w × --portrait-h` anchored bottom-right; mobile it is a full-width `3:4`.
- "More about me" link uses the `to-link-underline` hover (§4.1).

### 3.3 Panel 3 — The signature expand panel **[DOM, including the reference's own comment]**

Layer order inside the section (`overflow-hidden` clips both):
- `z-10` — the expanding rect, absolutely centred, containing an autoplaying muted looping `<video>` (`playsinline`, `preload="metadata"`).
- `z-20` — the word pair, above the rect while it grows.

Desktop, at rest: rect is `24.9 × 14` scale units (≈ 199 × 112px at 1440), words sit left and right of it with a constant `1.6 · --scale` visual gap, each at `12.8 · --scale` (~102px).

**Three phases, as documented in the reference markup:**
1. Track slides until this panel is centred. Rect is at `scale: 0` (JS sets this on init).
2. **Track holds.** Simultaneously, scrubbed to scroll:
   - rect `scale: 0 → cover` (enough to fill the panel bounds; compute, don't hardcode),
   - left word `x: 0 → -110%` (flies out left),
   - right word `x: 0 → +110%` (flies out right),
   - both words may fade in the last 20% of the phase.
3. Track resumes.

Mobile: the panel is `100svh` and pins vertically; the rect is a `8.5 × 15.2` scale-unit portrait; word "The"-equivalent flies **up**, the other flies **down**; separate shorter video asset.

Use two video files (desktop landscape, mobile portrait) as the reference does. Poster frame required, `muted` + `playsinline` required for iOS autoplay.

### 3.4 Panel 4 — Featured projects **[DOM]**

List structure per row: `<li data-work-item-index="n">` → link → `[data-work-item-text-wrap]` (`overflow-hidden`, `transition-opacity duration-500 ease-out`) → `[data-line][data-work-item-text]`.

**On enter:**
- label → primitive (a).
- `[data-work-list]` `opacity 0→1`; each row's `[data-line]` `y: 100% → 0`, stagger 0.08s.
- `[data-work-line]` (1px, muted colour, `scale-x-0`, origin-left) → primitive (c), staggered — the rules draw in one after another under each row. Note the last row in the reference has **no** rule (list bottom edge stays open).

**On hover (desktop only, pointer: fine):**
- `[data-work-hover-line]` — a second 1px rule in the **foreground colour**, `origin-left`, `scaleX 0 → 1`, **0.5s `power3.out`**; reverses on leave.
- The hovered row keeps `opacity: 1`; **all sibling rows drop to ~0.4** via the CSS transition already on `[data-work-item-text-wrap]` (0.5s ease-out). Implement with a class on the `<ul>`, not per-row JS.
- `[data-work-preview]` — a 16:9 box pinned bottom-left (`max-width: 40.1 · --scale`) holding one `<img data-work-image="i">` per project, all `opacity: 0`, `object-cover`, `origin-center`. On hover the matching index goes `opacity 0→1` (+ `scale 1.04 → 1` **[INFER]**, 0.6s `power2.out`) and the previously active one fades out. No preview is visible when nothing is hovered.
- Each link carries `data-transition-color` for the page transition (§5).

Footnote line under the list (e.g. "live demo unavailable for some projects") is static, no animation **[DOM]**.

### 3.5 Panel 5 — What I build **[DOM]**

**This panel is `md:w-max` — deliberately wider than the viewport.** It contains an intro column (`63.6 · --scale`) plus four cards (`40 · --scale` each), so it keeps scrolling horizontally for ~2.5 viewport widths. Do not force it to `100vw`.

Per card `[data-service-item]`:
- Full-panel height, `p: var(--vg)`, 1px left border between cards, `justify-between` pushing: big number (`9 · --scale`) → title (`--display-fs`) → one-line description.
- Background stack: `[data-service-bg-reveal]` (`absolute inset-0 -z-1 overflow-hidden`) → a `70%` dark scrim at `z-1` → `[data-service-bg-media]` holding an `<img>` at **`scale: 1.1`**.
- That 10% oversize is headroom for motion: as the card crosses the viewport, translate `[data-service-bg-media]` on x by up to **±6%** scrubbed to horizontal progress (a parallax drift), and/or on hover ease `scale 1.1 → 1.15` over 0.8s **[mechanism DOM via the scale-110 + wrapper, exact motion INFER]**.
- Cards do **not** individually fade/slide in. Their entrance *is* the horizontal scroll. Do not add a reveal here — it would read as the generic "every section fades up" default.

### 3.6 Panel 6 — Experience / logos **[DOM]**

- Label + list → primitive (a); list `opacity 0→1`.
- **Desktop hover (pure CSS, no JS):** each `[data-client-row]` contains a hidden portrait card positioned `right-full mr-6` (i.e. to the **left** of the row text), aspect `188:251`, width `18.8 · --scale`, light background, holding the logo at 74.5% width. It is clipped with `clip-path: inset(0 0 0 100%)` and on `group-hover` goes to `inset(0 0 0 0)` — a **left-edge wipe**, `duration: 500ms`, `ease: cubic-bezier(.3,.86,.36,.95)`. **These two values are exact [DOM]** — use them, and reuse that cubic-bezier as the site's signature ease elsewhere.
- Non-hovered rows dim (same 0.5s opacity transition as §3.4).
- `[data-clients-list-interactive]` — the list is **pointer-events-none until the entrance animation completes**; JS adds this attribute at the end, which switches `cursor: default → pointer` and enables hover. Copy this gate; hovering mid-reveal otherwise produces broken states.
- **Mobile:** a single sticky logo slot at `top: calc(50vh - rowHeight/2)`, containing all logos stacked in one grid cell, each `scale: 0; opacity: 0`. As each row passes the centre line its logo goes `scale 0→1, opacity 0→1` and the previous one goes back to 0. One visible at a time.
- A final non-linked row ("and more" equivalent) uses the same text-wrap markup but no hover card **[DOM]**.

### 3.7 Panel 7 — Contact **[DOM]**

- `[data-char-line-heading]` — two-line display heading, same masked-line + per-word reveal as the hero name, same padding/negative-margin compensation, `aria-hidden` with the real `<h2>` text behind it. Discretionary ligatures are enabled on this face in the reference (`font-editorial-dlig`); only keep that if our display face actually has them.
- Contact block: `[data-reveal-line]` wrapping label + email link → primitive (a).
- Email link uses the `from-link-underline` hover (§4.1).
- Mobile-only footer bar (copyright + edition line) above a 1px top border, static.

---

## 4. Micro-interactions

### 4.1 Two link underline variants **[DOM: `to-link-underline` / `from-link-underline`]**

The reference has **two distinct hover underlines** and uses them in different places. Implement both as CSS, no JS:

- `.to-link-underline` — underline grows **left → right** on enter (`transform-origin: left; scaleX 0→1`) and, on leave, **continues out to the right** (`transform-origin: right; scaleX 1→0`). Used on forward-navigation links ("more about me", "view all work").
- `.from-link-underline` — the mirrored behaviour, used on the email / terminal links.

Duration **0.4s**, ease `cubic-bezier(.3,.86,.36,.95)` (the site's signature ease, §3.6).

### 4.2 Others

- Menu button: `enabled:hover:opacity-80` only. No rotation, no morph **[DOM]**.
- Focus states: `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2` in the current foreground colour **[DOM]** — the reference does this properly; match it.
- No custom cursor, no magnetic buttons, no hover tilt. **[DOM: absent]**

---

## 5. Page transitions **[DOM: `#dissolve-mount`, `data-transition-color`]**

The reference mounts an empty `<div id="dissolve-mount" aria-hidden="true">` at the top of `<body>` and each project link carries `data-transition-color="#faf9f6"`. That is a **full-screen dissolve overlay whose fill colour is supplied by the link that was clicked**, so the outgoing page dissolves into the incoming page's background colour.

Without Astro's view transitions, implement as:
1. Intercept same-origin link clicks. Read `data-transition-color`.
2. Fill `#dissolve-mount` with that colour, animate `opacity 0→1` (or a `clip-path` wipe) over **0.5s `power2.inOut`**.
3. Navigate. Set `sessionStorage.transitionIn = color`.
4. On load, if that key exists, render the overlay opaque and fade it out over 0.5s, then clear the key.

If this proves fragile on GitHub Pages, **drop it**. It is the least important item in this document and the easiest to get visibly wrong (flash of unstyled overlay, back-button leaving the overlay stuck).

---

## 6. Explicit DO-NOT list

Everything here is either absent from the reference or actively harmful in our context.

1. **Do not use GSAP SplitText or ScrollSmoother** (paid Club plugins). Own splitter + Lenis.
2. **Do not use AOS, animate.css, WOW.js, or any scroll-animation library.**
3. **Do not add a marquee/infinite ticker, a custom cursor, magnetic buttons, WebGL/three.js, a particle field, a percentage preloader, text scramble/typewriter effects, tilt cards, or a noise/grain overlay.** None of these exist in the reference; adding them turns a coherent system into a showreel.
4. **Do not put a fade-and-slide-up on every element.** The reference reveals *clusters* (label + paragraph + image as one group), and the "what I build" cards have no entrance at all. Scattered per-element fades are the generic tell.
5. **Do not animate layout properties** (width/height/top/left/margin/font-size). Transform, opacity, clip-path only.
6. **Do not hide content from crawlers or from `Ctrl+F`.** Split-text duplicates must be `aria-hidden` with real text present. Horizontal panels must remain in DOM order matching reading order.
7. **Do not scroll-jack on mobile.** Below `md`, native vertical scroll, no pinning except the one expand panel.
8. **Do not hardcode panel widths or track length.** Measure at runtime; `ScrollTrigger.refresh()` on resize and on `document.fonts.ready`.
9. **Do not block first paint on the intro sequence.** HTML/CSS must render the hero's rest state even if JS fails.
10. **Do not copy the reference's copy, chapter naming, rail wording, colours, or typefaces.** Structure and motion only.
11. **Do not let the horizontal experience be the only path to the content.** Every project must also be reachable from a plain, vertically scrolling page (a `/projects` list) linked in the menu — a recruiter with 20 seconds and a trackpad must not have to scrub through seven panels to find the GitHub links.
12. **Do not ship the "rotate your screen" blocker** as the tablet-portrait answer (see §2.7).

---

## 7. Acceptance checklist

Codex must self-verify each before declaring a panel done.

**Correctness**
- [ ] Every `data-*` hook in §3 exists in the markup and is referenced by exactly one JS module.
- [ ] `track.scrollWidth` is measured, never assumed; resizing 1280 → 1920 → 1280 leaves the final panel flush with the right edge.
- [ ] All per-panel reveals use `containerAnimation`; none fire early or late after a resize.
- [ ] The expand panel's phase 2 holds track x exactly still (assert `track.style.transform` is unchanged across that label range).
- [ ] Header `--header-*` values match `data-header-*` of whichever panel occupies the rail, at any scroll position, in both themes.

**Performance**
- [ ] Sustained ≥ 55fps scrubbing the full track on a mid-tier laptop (DevTools Performance, 4× CPU throttle).
- [ ] No layout thrash: zero `Layout` entries during scroll in the flame chart.
- [ ] Lighthouse mobile Performance ≥ 85, LCP ≤ 2.5s. Videos lazy, posters set, images `loading="lazy" decoding="async"` with explicit `width`/`height` **[DOM: the reference does all of this]**.
- [ ] Total JS (excl. GSAP/Lenis) ≤ 25KB gz.

**Accessibility**
- [ ] Tab order follows DOM order; focusing an off-screen panel scrolls it into view (`ScrollTrigger` scroll-to on `focusin`) — the reference does **not** solve this and it is a real bug in horizontal layouts. Solve it.
- [ ] `prefers-reduced-motion: reduce` → no scrub, no pin, vertical layout, all content visible.
- [ ] Every animated text node is readable by screen reader exactly once.
- [ ] Visible focus ring on every interactive element in both themes.

**Fallback**
- [ ] JS disabled → all seven sections render stacked, legible, all links working.
- [ ] 375px, 768px, 1024px, 1440px, 1920px, 2560px all render without horizontal overflow on the `<body>`.
