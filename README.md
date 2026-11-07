# entromorphic.com

The website of EntroMorphic, an independent research lab. Static HTML, CSS and JavaScript, served by GitHub Pages from `main`.

## Layout

| Path | What it is |
|---|---|
| `index.html`, `Research.html`, `Projects.html`, `Companies.html`, `Writing.html`, `About.html`, `404.html` | Pages. Every page shares one shell: nav, `<main id="view">`, footer. |
| `em-styles.css` | The single stylesheet. Pages carry no `<style>` of their own. |
| `em-site.js` | Shared behaviour: buttons, mobile menu, reveals, filters, the Flynn live preview. |
| `em-router.js` | Client-side navigation: swaps `<main id="view">` so the orb persists between pages. |
| `em-consciousness.js` | The shared "mood" state that drives the orb and a few CSS variables. |
| `em-orb.js`, `src/` | The WebGL Blob Core (three.js 0.160.0 from unpkg). Falls back to a CSS glow without WebGL. |
| `CNAME`, `.nojekyll`, `robots.txt`, `sitemap.xml`, `favicon.svg` | Hosting and discovery. |

## Working on it

No build step. Serve the folder with any static server, e.g. `python3 -m http.server`, and open `http://localhost:8000`.

Rules the code relies on:
- Keep nav and footer identical on every page; the router only swaps `<main>`.
- Put all CSS in `em-styles.css`.
- `.real-button` must stay above `.button` (z-index) or the buttons stop responding to hover and clicks.
- `404.html` carries `<base href="/">` because GitHub Pages serves it at whatever URL was missing; without it, deep URLs would break its CSS and links. (The design-project copy omits this line so it previews correctly there.)
