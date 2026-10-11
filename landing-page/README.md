# VOYA landing page

The public website for VOYA: **https://aayush64x.github.io/voya/**

Next.js (React, TypeScript, Tailwind CSS), exported as a static site. `DESIGN.md` describes the design system.

## Run it locally

Needs Node.js 18.18 or newer.

```bash
cd landing-page
npm install
npm run dev        # http://localhost:3000
```

## The live side panel in "User Interface"

`public/extension-ui/` is a copy of the real extension panel (`extension/sidepanel/`), with `js/showcase.js`
in place of the backend bridge. It shows a benefits-check run with sample content, and pressing its button
plays the whole example. `?scene=idle|ask|working|confirm|done` picks the moment shown on each slide.

When the extension's panel changes, refresh the copy (keep `showcase.js` and `index.html`):

```bash
rsync -a --exclude DESIGN.md --exclude states.html --exclude sidepanel.html \
  --exclude js/bridge.js --exclude js/demo.js \
  ../extension/sidepanel/ public/extension-ui/
```

## Publish to GitHub Pages

The site is served from `/voya/`, so build with that base path, then push the `out/` folder to the
`gh-pages` branch (Pages is set to deploy from `gh-pages`, root).

```bash
STATIC_EXPORT=1 NEXT_PUBLIC_BASE_PATH=/voya npm run build
touch out/.nojekyll   # GitHub Pages would otherwise hide the _next/ folder
```

Plain `<img>`/`<video>` paths must go through `asset()` (`src/lib/asset.ts`) so they get the base path.
