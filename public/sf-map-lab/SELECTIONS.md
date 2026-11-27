# Selected SF map — revision 3

The current mockup is [parks-study.html](parks-study.html). The previous alternatives are preserved at [parks-study-v2.html](parks-study-v2.html).

## Confirmed treatment

- Elevation bands at 60, 120, 180 and 240 meters. Brown on ordinary land; corresponding green bands only inside actual park footprints. Flat parks remain pale green.
- No park, bridge, road or water captions inside the map. Adjacent-region names and weather readings are the only map text.
- Bare weather overlays centered on their forecast coordinates. No label backing, border, halo, leader line or location dot; selection changes weight only. Normal keyboard focus remains visible.
- First row: `62°/49°`, high in dark red and low in dark blue. Second row: `UV4` in dark gold, followed by blue precipitation such as `0.12″` when the daily total is strictly greater than 0.05 inches. No H/L suffixes or extra “rain” word. UV remains daily maximum.
- Competition freestyle swimmer at each beach coordinate, solid needle compass on adjacent-region controls, and person-in-a-pin for personal location. The visible personal location is simulated; no location permission is requested.
- Golden Gate's stylized structure is mirrored across its deck. Its actual road alignment remains connected to SF. Both bridges have no captions, and I-80 still crosses the Bay Bridge.
- The viewport is tightened to the mainland city: longitude -122.522 to -122.351; latitude 37.706 to 37.820. All mainland DataSF neighborhood geometry fits, including the eastern Hunters Point shoreline. Northern bridge approaches, islands and remote water are cropped. Bridge spans can leave the viewport at the city's edges.

## Contrast

Text color is intentionally dark enough to read without a background rectangle or text halo. Gold provides the requested yellow tint without using a bright yellow that disappears over the map.

| Reading | Color | Minimum contrast against all land / park / elevation fills |
| --- | --- | --- |
| High temperature | `#7e202a` | 4.96:1 |
| Low temperature | `#124577` | 4.92:1 |
| UV maximum | `#5c3e00` | 4.92:1 |
| Rain | `#064860` | 5.02:1 |

Ratios are calculated from sRGB relative luminance against the actual fill palette, including water. This is a palette check rather than an exhaustive accessibility certification of every map pixel or road crossing. Labels keep the main WeatherDash Atkinson Hyperlegible Next variable font.

## Data and scope

The existing public DataSF land / park snapshot and USGS-derived contours remain the source geometry. The contour coordinates are transformed from the older extent into this tighter viewport; no hills are invented or manually relocated. Source URLs, the input DEM and its reproducible transform remain documented in [REVISION.md](REVISION.md) and [SOURCES.md](SOURCES.md).

All weather and beach evidence is illustrative. On phones, representative overlays plus the selected point keep the map readable, and a named picker exposes all ten forecast locations. Labels stay over their actual coordinates rather than moving into detached callouts.

The selected visual choices are pinned in revision 3. Old query strings and browser recipes cannot restore discarded terrain, backgrounds or symbols. Sample-day, selected-point and simulated-location visibility are the remaining interactive controls. The exported JSON records these confirmed choices.

The main application, its data providers and database remain unchanged on the exploration branch. Browser verification and screenshots are under `docs/sf-map-exploration/review-v3/`; 42 assertions pass with no uncaught errors or external HTTP requests. Typecheck and production build pass. A separate fresh visual review is recorded in that folder.
