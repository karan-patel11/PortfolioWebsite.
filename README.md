# Karan Patel portfolio

One editorial chapter flow built from the finalized `portport.zip` handoff.
No runtime dependencies, external fonts, trackers, or client rendering dependency.

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
- `src/main.js`: native modal navigation and progressive motion.
- `dist/assets/`: optimized responsive WebP derivatives of supplied images.
- `karan-patel-single-design-handoff/`: untouched design package and originals.

The build only uses the finalized package. The former root HTML, CSS, and script
were removed from the working site and remain recoverable in Git history.

## Content decisions

NMIMS contains only the supplied institution, qualification, and dates. The
ambiguous duration strip, QE Copilot, BGE embeddings, Qdrant, and Jenkins are
excluded as instructed. Email, LinkedIn, GitHub, X, repositories, missing demos,
and a resume file were not supplied. Their actions are omitted rather than
invented. The two supplied live project URLs are included.

## Verification

`npm test` checks rendered content against the authoritative text, internal
routes and assets, NMIMS facts, heading structure, forbidden placeholder copy,
and reduced-motion behavior. Browser checks are documented in `QA.md`.
Development-only `/__qa/` fixtures allow text enlargement, text spacing,
JavaScript-free rendering, and deterministic reduced-motion branch testing.
These fixtures are not part of the production output.
