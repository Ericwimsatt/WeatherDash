# WeatherDash colors

The active palette is Christmas Lights. `index.html` selects it with `data-palette="christmas-lights"` so the loading screen and rendered app use the same colors.

- `src/design-tokens.css` preserves the original Sunline reference colors and semantic roles for surfaces, text, water, charts, warnings, loading placeholders, and photo overlays. Historical overridden declarations have been removed.
- `src/themes/christmas-lights.css` overrides those roles for the selected palette. Change values here to tune the live theme.
- `src/color-tokens.ts` resolves CSS tokens for Chart.js and derives transparent chart fills. Keep its alpha source tokens in hexadecimal format.
- `src/header-skin.css` styles the gingerbread village and retro EricWeather wordmark without increasing the existing header height. Its source assets live in `src/assets/holiday/` and are bundled by Vite.

The original application used 96 distinct literal color values across stacked historical styles. Consolidation retained 38 independent base colors, with aliases and transparency for semantic roles. The header artwork adds two scrim/background colors. Sun-info text has separate role aliases so future palettes can use light information boxes on a dark page without changing other text.

Validation before selecting the new palette compared geometry and 16 computed-style properties across 168 rendered elements against the original stylesheet. All matched. Live weather values and asynchronous image painting were not used as deterministic screenshot assertions.

The Christmas Lights palette keeps a warm white page, green daylight panels, red selected tabs, blue water/rain charts, and golden/violet supporting chart accents. The rest of the layout, navigation, data access, and safety rules retain their existing behavior.
