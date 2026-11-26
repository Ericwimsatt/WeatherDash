# Verification record

Prepared November 26, 2026 for the SF-only design exploration on `codex/sf-regional-map-exploration`.

## Browser checks

The reproducible browser check at `docs/sf-map-exploration/browser-qa.cjs` passed **110 assertions** using an existing local Playwright installation. It installs no dependencies. Results are recorded at `docs/sf-map-exploration/review/qa-results.json`.

Checked behaviors:

- All **46 options** render on the SF map across six chapters, and the atlas includes all 46.
- The baseline retains all ten existing SF forecast points and four independent beach callouts.
- All four orientation systems open as independent standalone pages.
- Keep, minimize, hide, individual restore and restore-all controls work without deleting source options.
- Comparison content switches to a carousel for long / dense option sets.
- Keyboard h / l, Home and End cycle options; selected-point controls retain useful focus after rendering.
- A selected forecast point updates its dock; opening and closing beach detail preserves weather selection. Escape returns focus to the beach trigger.
- The phone picker exposes the configured forecast locations and updates the selected detail.
- The simulated locate button toggles a demo point without calling geolocation.
- Citywide time selection updates the map stamp and hourly labels.
- Marin / East Bay controls explain the SF-only scope instead of pretending an external map exists.
- Local choices and notes survive reload; export downloads a portable JSON configuration and kept-option list.
- Wind / UV / rain lenses carry a written metric label; Celsius is explicit when chosen.
- Loading and error fixtures do not invent selected numeric weather fields. Retry demonstrates recovery to the baseline fixture.
- Expanded coverage displays fourteen points; returning to existing coverage removes proposed points.
- Rain beach pins, list rows and opened detail share the same resolved concern. Partial Aquatic Park remains unknown in all three surfaces.
- Both Sunset chip readings remain unobstructed in the tested full-size map.
- Selected Outer Richmond clears beach symbols in the tested 390 px partial-data view.
- Unknown query values normalize to valid defaults.
- No uncaught browser errors and **no external HTTP requests** occurred during the browser run.

Viewport widths checked for accidental document overflow: **320, 390, 768, 1280, 1440 and 1600 px**. The intended horizontal option carousel and chapter navigation can scroll within their own containers.

## Visual evidence

Fifteen nonblank PNG captures are saved under `docs/sf-map-exploration/review/`:

- `desktop.png` and `mobile.png`: complete comparison lab at 1440 and 390 px.
- `map-parks.png`, `map-streets.png`, `map-landmarks.png`, `map-hybrid.png`: full standalone orientation systems at 1280 px.
- `map-systems.png`: four systems side by side in the report.
- `label-layouts.png`: four per-region overlay layouts on SF.
- `information-patterns.png`: all five content patterns on SF.
- `weather-states.png`: all ten state fixtures on SF.
- `state-rain.png`, `state-partial.png`, `state-night.png`: full-size state examples.
- `phone-partial.png`: selected Outer Richmond with missing wind / UV and independent beaches.
- `icons.png`: the complete editable icon-sheet specimen through its HTML wrapper.

The icon sheet is also directly viewable at [icons.html](icons.html) and editable as [icons.svg](icons.svg). The browser initially timed out capturing the bare SVG document; the HTML image wrapper resolves that capture issue. It was a screenshot-path issue, not a network dependency or missing icon asset.

## Review corrections

A fresh screenshot-and-source finish review requested four bounded corrections:

1. Resolve beach states once, then share them between map, list and detail.
2. Prevent compact Sunset labels from hiding a temperature.
3. Move the selected Outer Richmond phone ticket away from nearby beach symbols, preserving visible anchors.
4. Shorten repeated rain and stale-data text in dense tickets.

Those corrections are implemented and the affected evidence has been recaptured. Offset weather labels and beach callouts now connect to their fixed coordinates with fine leader lines. Phone selection can substitute a different representative point to preserve room for the selected detail. The exact fresh-review disposition and scope are recorded in `docs/sf-map-exploration/review/finish-review.md`.

## Repository checks

- `npm run typecheck`: passed.
- `npm run build`: passed. Vite reports the existing main application JavaScript chunk above its 500 kB warning threshold; this study does not change that application bundle.
- JavaScript syntax checks for the map engine, comparison controller and static generator: passed.
- `git diff --check`: passed.

The main app’s existing source, configuration, providers, database schema and SD beach finder implementation are unchanged. This branch adds static exploration artifacts and supporting documentation only. The app’s existing unit tests were not rerun for these static-only additions; browser checks cover the new interactions.

## Limits of the checks

This is not an exhaustive accessibility certification, screen-reader audit, measured contrast study, production map performance benchmark or live-provider integration test. Compact secondary map metadata remains intentionally dense; open the standalone maps rather than judging readability from scaled contact sheets. Every weather, beach, tide, timing and extra-coverage value is synthetic.

The Impeccable detector was run once during the visual pass. It flagged the inherited warm palette, small study controls / metadata and colored elevation shadows. The warm land / water language is the user’s explicit reference, so it was retained. Functional comparison controls and primary labels were enlarged and elevation shadows made neutral. The detector output is not presented as a final automated accessibility pass.

Authored offsets and representative-label substitutions demonstrate the desired hierarchy. They do not constitute a production collision engine, geographic zoom / pan system or verified region boundary model. Beach evidence sources, forecast freshness thresholds, observation provenance, real GPS accuracy, external-region navigation and dark mode remain separate integration decisions described in the report.
