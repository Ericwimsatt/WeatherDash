# Selected SF map on the main page

The main homepage now opens with brown elevation bands, green elevation inside parks, a live daily-high gradient and fifteen high/low readings. The mockup comparison remains independently available. Regional detail routes retain their existing forecast view.

`src/components/RegionalMap.tsx` consumes the existing `useLocation` query/repository pipeline. Twenty-two sampled coordinates are registered in `src/config.ts` so existing API cache reads/writes accept them. Fifteen numeric labels are selected by geographic separation, with the closest sample reserved when browser location is inside the map. The user’s coordinates stay in the browser: geolocation only chooses which predefined readings to show and where to draw the user pin. Weather requests use the predefined forecast and beach sample coordinates. An existing location grant is reused; otherwise the user selects Use my location. Denial and out-of-map states remain usable.

The gradient is calculated from available real high-temperature summaries using inverse-distance interpolation. It is not loaded from the synthetic mockup PNG. Fewer than two valid samples leaves the field absent; unavailable readings show dashes. The legend states its actual sample count, min/max scale and interpolation. Standard summary rules select observed completed hours and forecast future hours; UV retains its modeled full-day peak. Rain above .05 daily inches is shown, with partial totals indicated by ≥. Wind above 15 mph is shown. Highs lead, lows recede, and UV/qualifying rain remain beneath.

The map follows the shared forecast date. Readings expose independent details and a route to an existing nearby regional forecast; a native selector provides an alternative to small map targets. Swimmers query beach data separately and do not invent surf or water-quality ratings. Marin/East Bay controls navigate to existing regional forecasts. Zoom doubles the map plane and centers near the user when available; Show all SF restores the full map.

The SF mainland continues through the map viewport’s lower edge: bounds end north of the simplified geometry’s southern boundary, at latitude 37.7091667. Desktop caps the map to fit the available screen height; phones preserve the full SF extent and can zoom/pan rather than dropping readings. Land is not extended with fabricated geometry.

## Verification

`tests/regional-map.test.ts` covers 15 distinct labels, nearest-sample priority at every source location, outside-map fallback, all source points inside the cropped extent, interpolation from non-label samples, missing data, temperature/UV/wind extrema, partial rain, and registration of forecast/beach coordinates. The full test suite has 45 tests.

`browser-qa-site.cjs` verifies the integrated main page with schema-valid controlled data and external providers blocked. It checks 22 interpolation samples, 15 visible readings, granted and denied location, thresholds, independent beaches, native selection, phone zoom, 320/390/768/1440px overflow, date synchronization, regional navigation and unavailable data. Screenshots `site-map-*.png` use these controlled values; they do not claim a live provider or deployed production check. Typecheck and production build are also checked. Existing large-bundle warning remains.

Implementation is on the exploration branch. No deployment or merge is performed by this integration.
