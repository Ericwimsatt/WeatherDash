# SF map integration and exploration archive

Branch: `codex/sf-regional-map-exploration`.

The selected SF map is now integrated into the main homepage after the header and before forecasts: brown elevation bands, green park elevation, a runtime daily-high gradient and fifteen readings selected from 22 registered forecast samples, prioritizing the nearest sample when real browser location is available inside SF. It follows the shared date and existing data pipeline, preserves independent beach queries and offers native selection plus phone zoom/pan. Regional detail routes retain their forecast view. See [SITE-INTEGRATION.md](SITE-INTEGRATION.md), [current design notes](DESIGN-NOTES.md#selected-map-integration-current-main-app), and [asset provenance](../../src/assets/maps/README.md). No deployment or merge was performed; the work remains on the branch above.

The [combination board archive](../../public/sf-map-lab/parks-study.html) remains a separate synthetic comparison of six hill treatments, four park treatments and four weather displays in a simultaneous grid. It starts with twelve combinations, supports all 96 permutations, uses eleven overview locations and shows wind only above 15 mph. Revision 7 adds five sparse high/low labels over a daily-high gradient informed by all 22 fixture samples; the eleven-label hybrid remains selectable. See [COMBINATION-STUDY.md](../../public/sf-map-lab/COMBINATION-STUDY.md), `browser-qa-v6.cjs`, and `qa-v6.json`. Revision 5’s high-led text and smaller teal swimmer treatment is preserved in [the selected-text archive](../../public/sf-map-lab/parks-study-v5.html).

The earlier [density and style comparison](../../public/sf-map-lab/parks-study-v4.html), documented in [DENSITY-STUDY.md](../../public/sf-map-lab/DENSITY-STUDY.md), preserves six weather styles, five swimmer-button treatments and softer elevation bands. Its browser script and evidence are `browser-qa-v4.cjs` and `review-v4/`.

Revision 3's selected bare-text reference is preserved as `parks-study-v3.*`. The earlier [Parks, bridges & hills](../../public/sf-map-lab/parks-study-v2.html) revision is documented in [REVISION.md](../../public/sf-map-lab/REVISION.md). It uses real USGS-derived terrain, four daily-label alternatives, and SVG-only symbol choice lists. Its browser script and evidence are `browser-qa-v2.cjs` and `review-v2/`. The original lab below remains an archive.

Open [the comparison lab](../../public/sf-map-lab/index.html), [morning report](../../public/sf-map-lab/report.html), or [all-option atlas](../../public/sf-map-lab/atlas.html) directly in a browser. They also work at `/sf-map-lab/` under `npm run dev`. A server is optional; there are no fetch calls.

Archived comparison UI and fixture code is isolated in `public/sf-map-lab/`. The authorized main-page integration lives separately in `src/components/RegionalMap.tsx`, `regional-map.css`, `src/data/regional-map.ts` and `src/assets/maps/`, with homepage placement in `src/App.tsx` and coordinate registration in `src/config.ts`. Former proposal coordinates are now approved forecast samples, not sensor/station claims. The original archive's dashboard-untouched scope is historical. The SD beach finder is outside this integration.

The archived original comparison uses a component grid that can switch to a horizontal carousel. The archived combination board keeps every map in a vertical grid. Every option retains its own map preview and source configuration. Minimize, hide and restore are presentation state; keeping options and provisional recipe selections are saved locally and can be exported as JSON.

## Source of truth

File names in this list are under `public/sf-map-lab/` unless a different directory is specified.

- `map-engine.js`: local map renderer, forecast fixtures, original SVG icons, point selection, independent beach details, simulation-only locate and region-exit behavior.
- `map.css`: study-local materials inherited from the SD map, scoped label treatments and container-based mobile adaptation.
- `choices.js`: 46 alternatives across six chapters. Every alternative has a configuration, concrete tradeoff and map preview.
- `lab.js` / `lab.css` / `index.html`: comparison controls, reversible hiding, local persistence, inspector and decision export.
- `REPORT.md`: substantive recommendations, open decisions and production implications.
- `CHOICE_SET.json`: scored twelve-direction map matrix, four developed systems, rejected alternatives, complete option manifest and choice-display contract.
- `SOURCES.md`: source URLs, coordinate provenance, simplification and schematic limitations.
- `QA.md`: checked interactions, viewports and review findings.

Regenerate the static report HTML, atlas, SVG icon sheet and decision manifest with:

```sh
node docs/sf-map-exploration/build-study.mjs
```

Regenerate simplified geographic data from freshly downloaded public GeoJSON with:

```sh
python3 docs/sf-map-exploration/prepare-geography.py /tmp/sf-neighborhoods.geojson /tmp/sf-parks.geojson
```

Use the source URLs in `SOURCES.md` to obtain those input files. Input data is not fetched by the build or browser. Shared font assets are copied locally with their licenses.

## Original review brief and design contract

This section records the original exploration brief; the selected main-page integration above supersedes its open-choice status. The user requested an SF-only regional map exploration for the main all-weather app, using the SD beach finder map as the visual reference. They explicitly requested multiple per-region overlay layouts, heterogeneous information patterns, weather / data states, independent beach conditions, three choices each for swim / UV / current-location / adjacent-region icons, complete locational-context systems, a substantial morning report and a new branch. They authorized independent work without additional questions; choices were left open for that morning review.

The visual contract is an extension of the existing map language, not a new brand identity: warm land, pale blue water, fine road lines and compact readable type; primary weather labels above quieter orientation context. The first large map demonstrates differences between ten existing SF points and independent beach coordinates. Signature interactions are mixing a map recipe, selecting a point without losing geographic context, inspecting a beach independently, and keeping / exporting multiple candidates.

The product remains a web app. No durable product-wide visual decision is established by a proposed option. This exploration deliberately does not replace or create global app design tokens, an app-wide DESIGN.md or a product-wide preference file. The existing implementation remains the visual authority for future integration. No image-generation workflow was used because the artifacts are geographic geometry, data UI and editable SVG symbols.
