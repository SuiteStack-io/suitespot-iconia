

## SEO Pre-rendering Support

### What will be done

**1. Add `<noscript>` fallback content to `index.html`**

Add a `<noscript>` block inside `<body>` with structured HTML content about your property, suites, amenities, and location. This gives search engines readable content even if JavaScript fails to execute.

**2. Skip `react-snap` (not compatible with this environment)**

`react-snap` requires a headless browser (Puppeteer/Chrome) to run during the build step. Lovable's build environment does not support running a headless browser, so `react-snap` would fail at build time. This is not something we can work around in this platform.

**3. No changes needed for `react-helmet-async` (already fully set up)**

Your project already has the fallback approach fully implemented:
- `react-helmet-async` is installed and `<HelmetProvider>` wraps the app in `main.tsx`
- A reusable `<SEO>` component (`src/components/SEO.tsx`) already provides per-page `<title>`, `<meta description>`, Open Graph tags, Twitter cards, canonical URLs, and JSON-LD structured data
- Public pages like PublicHome, About, Suites, etc. already use this component

### Summary of changes

| File | Change |
|------|--------|
| `index.html` | Add `<noscript>` block with structured content about SuiteSpot |

### Technical details

The `<noscript>` block will be placed inside `<body>`, after the `<div id="root">`. It will contain:
- H1 with business name and tagline
- Description paragraph
- Suite listings with links to `/suites`
- Amenities summary
- Location description
- Navigation links to `/book`, `/suites`, `/about`

Note: The links in noscript will point to `/suites` instead of `/rooms` (which is an admin route), matching your public-facing URL structure.

