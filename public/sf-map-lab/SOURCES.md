# Geography and asset sources

Retrieved November 26, 2026 for a local design exploration. No weather source was queried.

- **Land / analysis neighborhoods:** [DataSF Analysis Neighborhoods](https://data.sf.gov/Geographic-Locations-and-Boundaries/Analysis-Neighborhoods/j2bu-swwd). Download: `https://data.sf.gov/resource/j2bu-swwd.geojson`. The published dataset describes reporting groupings of census tracts, not an official weather map or a universally definitive neighborhood map. Forty mainland neighborhood features are used as a land surface; Treasure Island is omitted from this SF-city viewport.
- **Park footprints:** [DataSF Recreation and Parks Properties](https://data.sf.gov/Culture-and-Recreation/Recreation-and-Parks-Properties/gtr9-ntp6). Download: `https://data.sf.gov/resource/gtr9-ntp6.geojson`. Selected major properties only. Presidio and Lincoln Park are supplemented by the corresponding analysis-neighborhood footprints for orientation, so these should not be interpreted as surveyed recreation-property boundaries.
- **Dataset catalog descriptions:** [Analysis Neighborhoods catalog](https://catalog.data.gov/dataset/analysis-neighborhoods), [Recreation and Parks Properties catalog](https://catalog.data.gov/dataset/recreation-and-parks-properties). These support the distinction between a reporting geography, park property, and a weather region.
- **Forecast coordinates:** the ten SF entries in this repository’s `src/config.ts`, preserved exactly. Four proposed additional neighborhood points are approximate design-study coordinates authored in `map-engine.js`; none are added to the application configuration.
- **Beaches:** four study points correspond to the existing app’s Baker Beach, Ocean Beach, Crissy Field and Aquatic Park coordinates. Crissy Field is placed slightly north for shoreline readability (`37.8045` rather than the app’s `37.8025`); this is a schematic beach marker, not a source-grid change.
- **Street skeleton, landmark points, water fill within Lake Merced:** authored schematics in `map-engine.js`. Roads have not been downloaded or verified for routing. They are intentionally labeled schematic. Landmark icons are original geometric SVGs.
- **Map palette:** exact SD beach finder values from `sdbf/src/map.js`: warm land `#f0ede1`, water `#dceff5`. Supporting park / selection / evidence colors are study-local extensions.
- **Typeface:** Atkinson Hyperlegible regular and bold, copied from `sdbf/src/assets/fonts/`; corresponding OFL license is included under `assets/`. No external font request.
- **Weather, surf, water quality, tide and timing phrases:** entirely synthetic, authored to compare UI states. They are not current or historical observations, advisories, forecasts, or swimming recommendations.

## Geometry transformation

The public GeoJSON polygons are simplified with Douglas–Peucker at `0.00006` degree coordinate tolerance, rounded to five decimals, and stored in `geography.js`. This is roughly several meters at SF latitude, adequate for a city-scale mock. The local projection accounts for the city viewport’s approximate aspect ratio; it is not a navigation-grade map projection. Polygon topology is not repaired, and internal coast details are kept only for recognizability.

The selected city viewport is longitude `-122.544 … -122.366`, latitude `37.708 … 37.822`; its SVG view box is `1000 × 810`. The southern county edge lies just beyond the frame. Cross-boundary gateways are scope cues, not complete maps of Marin or the East Bay.

The public data source URLs remain in attribution. Review the datasets’ published usage terms when selecting a production map source. This snapshot introduces no tile-provider credentials, paid service, or continuing network dependency.
