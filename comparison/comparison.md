# Inspiration comparison

Compared [Khanh Nguyen](https://khanhnguyen.design/) with [the local portfolio](http://localhost:4173/) in the browser at **1280×720**, with motion allowed. Screenshots show actual pages; the reference is captured at observed scroll positions rather than pixel-perfect reconstructed panel boundaries. This is a visual/interaction audit, not another layout compliance run. No portfolio implementation was changed during this audit.

**Finding:** the fixed-page/detail foundation works, but much of the original art direction and chapter-specific behavior is absent. The earlier verification suite established fit and accessibility; it did not establish design fidelity.

## Measured type scale

| Element | Inspiration px | Local px | Local/reference |
|---|---:|---:|---:|
| Hero name | 160.89 | 100.80 | 62.7% |
| Project title | 56.89 | 20.16 | 35.4% |
| Contact heading | 160.89 | 32.40 | 20.1% |

Reference computed families: PP Editorial Old and PP Neue Montreal. Local: Georgia and Arial. The brief explicitly calls for adapting structure and motion, not copying the original typefaces.

## Side-by-side evidence

### Hero

| Inspiration | Local portfolio |
|---|---|
| ![Reference Hero](/Users/karanpatel/PortfolioWebsite./comparison/reference-hero.png) | ![Local Hero](/Users/karanpatel/PortfolioWebsite./comparison/local-hero.png) |

The name no longer has the same visual dominance. At 1280×720, the reference display type is 160.89px; ours is 100.80px. Georgia also has a heavier, less delicate silhouette than the reference display face.

### About

| Inspiration | Local portfolio |
|---|---|
| ![Reference About](/Users/karanpatel/PortfolioWebsite./comparison/reference-about.png) | ![Local About](/Users/karanpatel/PortfolioWebsite./comparison/local-about.png) |

Our photo, heading and paragraphs collect near the top. The rest of the viewport is largely unused. The reference distributes its introduction, portrait and supporting details across the frame.

### Transition chapter

| Inspiration | Local portfolio |
|---|---|
| ![Reference Transition chapter](/Users/karanpatel/PortfolioWebsite./comparison/reference-expand.png) | ![Local Transition chapter](/Users/karanpatel/PortfolioWebsite./comparison/local-expand.png) |

The local Expand panel is completely empty. The corresponding reference chapter is a major visual event, with large split words and expanding work imagery.

### Project index

| Inspiration | Local portfolio |
|---|---|
| ![Reference Project index](/Users/karanpatel/PortfolioWebsite./comparison/reference-projects.png) | ![Local Project index](/Users/karanpatel/PortfolioWebsite./comparison/local-projects.png) |

Our four small text blocks replace large editorial work rows. Project titles measure 20.16px locally versus 56.89px in the reference. There is no local project preview artwork.

### Chapter variation

| Inspiration | Local portfolio |
|---|---|
| ![Reference Chapter variation](/Users/karanpatel/PortfolioWebsite./comparison/reference-services.png) | ![Local Chapter variation](/Users/karanpatel/PortfolioWebsite./comparison/local-projects-b.png) |

These are not equivalent content sections: this pair compares visual rhythm. The reference switches to tall numbered cards and imagery. Our archive repeats the preceding project grid.

### Experience

| Inspiration | Local portfolio |
|---|---|
| ![Reference Experience](/Users/karanpatel/PortfolioWebsite./comparison/reference-experience.png) | ![Local Experience](/Users/karanpatel/PortfolioWebsite./comparison/local-experience.png) |

The local section repeats the same 2×2 grid used for projects. It lacks a distinct employer-led composition, large timeline/list typography and logo treatment.

### Contact

| Inspiration | Local portfolio |
|---|---|
| ![Reference Contact](/Users/karanpatel/PortfolioWebsite./comparison/reference-contact.png) | ![Local Contact](/Users/karanpatel/PortfolioWebsite./comparison/local-contact.png) |

The reference closes with a dominant display heading and prominent contact action. Our heading is 32.40px versus 160.89px; the paragraphs and footer are compressed into the upper half.

### Project detail

| Inspiration | Local portfolio |
|---|---|
| ![Reference Project detail](/Users/karanpatel/PortfolioWebsite./comparison/reference-detail.png) | ![Local Project detail](/Users/karanpatel/PortfolioWebsite./comparison/local-detail.png) |

The dialog behavior works, but its visual treatment is mostly two columns of text. It has no screenshots, demonstration media, prominent results treatment or designed architecture diagram.

## Missing or weakened elements

| Priority | Area | Difference |
|---|---|---|
| Critical | Empty transition chapter | The Expand rail link leads to a blank full-screen panel. There is no media, title, transition composition or pause sequence. |
| High | Display scale and typography | The name is roughly 63% of the reference size, work titles 35%, and closing headline 20% at the matched desktop viewport. The Georgia/Arial combination is also visually different. A distinctive, appropriately licensed display face could restore character without copying the reference fonts. |
| High | Navigation silhouette | The narrow vertical rail and restrained menu have become a permanent nine-link horizontal header. The desktop loses its vertical framing; the small-screen header becomes a three-row link grid. The menu exists in generated HTML but its trigger is hidden. |
| High | Missing intro and live details | The year-to-name handoff is disabled: the year/overlay hooks are hidden and hero.js is copied into dist but not loaded by the page. The live clock is consequently left as “Local time · ET”. |
| High | Composition and whitespace | Our About, work indexes, experience and contact sections group most content along their top edges. Empty space below them does not establish the deliberate visual balance of the reference. |
| High | Visual evidence of the work | Only four images are rendered in the local home: portrait, two campuses and venture artwork. Projects and their dialogs contain no product screenshots or demo media. Original engineering diagrams and actual product captures would make the work tangible. |
| High | Repeated chapter layout | Projects A, Projects B and Experience all use the same index-grid pattern. The reference changes scale, alignment, imagery and rhythm between chapters. Fixed viewport pages do not require identical compositions. |
| High | Signature motion is disconnected | The current runtime mainly handles track travel, routing and modal behavior. The earlier build pack called for distinct intro, portrait, work-list, experience and contact effects. projects.js is not loaded; the current card hover is a 2px upward translation. The chapter effects need compliant opacity/transform versions. |
| Medium | Rail response and small interactions | Current chapter handling updates the selected link and a horizontal progress line. It does not coordinate rail surface colors with each panel. Animated rules, directional underlines and purposeful preview feedback are absent from the active styles. |
| High | Detail art direction | The accessible dialogs are a useful architecture, but the visual hierarchy is shallow: modest heading, paragraph-based architecture and plain results. They need a clear title/metadata band, visual evidence, readable diagram and prominent metrics while preserving the full copy. |
| High | Closing emphasis | The contact section lacks a large final statement and a visually dominant email action. Social links and resume destinations remain a separate content issue: they should only be shown where valid destinations have been supplied. |
| Medium | Editorial finishing | “Expand”, “Projects A” and “Projects B” read as implementation labels. The empty chapter produces a visible jump in chapter numbering. Venture does not present a chapter label like the surrounding sections. Education has no direct reference counterpart and needs its own deliberate composition. |

## Constraint-aware restoration

The agreed architecture should remain: viewport-sized panels, index cards, complete detail dialogs, a 14px floor, contained media and accessible focus/history behavior. Those constraints do not require small desktop headlines, an empty transition page, small portrait treatments or identical grids.

- Restore desktop typography and intentional chapter compositions first. Keep compact mobile rules separate from desktop sizing.
- Give the empty transition chapter a complete visual purpose using the supplied content and suitable real project media.
- Reintroduce distinct chapter effects using only opacity and transforms, 500ms, and --ease-sig. Do not restore animated clip-path, cropped cover images or over-wide panels from the older pack.
- Design card indexes and dialogs as part of the same visual system, with full copy retained. Do not simply recreate the reference’s very sparse copy: this portfolio has more substantive engineering content.
- Add screenshot-based design checks alongside the existing numerical tests. The two kinds of acceptance establish different things.

## Code evidence

- [Empty Expand panel](/Users/karanpatel/PortfolioWebsite./scripts/build.mjs:64).
- [Generated page loads main.js, but not hero.js](/Users/karanpatel/PortfolioWebsite./scripts/build.mjs:7).
- [Hidden hero animation layers](/Users/karanpatel/PortfolioWebsite./src/style.css:3).
- [Shared index grid and 2px hover](/Users/karanpatel/PortfolioWebsite./src/style.css:4).
- [Current chapter handler](/Users/karanpatel/PortfolioWebsite./src/main.js:6).
- [Current track tween](/Users/karanpatel/PortfolioWebsite./src/motion.js:15).
- [Earlier chapter-specific motion brief](/Users/karanpatel/PortfolioWebsite./CODEX-BUILD-PROMPTS.md:17). That brief contains superseded requirements; the latest user constraints take precedence.

Live observation confirmed the opening year sequence, the expansion chapter, visual chapter changes and the detailed project gallery. Exact hover choreography is described in the existing build pack; this audit did not record a frame-by-frame hover trace.
