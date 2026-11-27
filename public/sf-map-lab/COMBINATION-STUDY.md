# SF map combinations · revision 7

Open `parks-study.html`. This is an isolated interactive mockup; all weather is synthetic.

## Compare together

The board starts with twelve different combinations. “Compare” opens 24 hills × parks maps, 24 hills × weather maps, or all 96 permutations. Maps stay in a vertical grid; they do not switch to a horizontal carousel. Desktop supports two, three or four columns. Smaller screens use two or one. Each map has independent selectors, Keep, Minimize, Hide and Inspect larger. Restore brings hidden/minimized maps back. Recipes and kept flags persist locally; Export choices downloads them. Changing the comparison set replaces its cards, so export a board before switching if you want to retain it.

“Build a combination” adds any recipe. Its weather choice is used by the 24-map set; its park choice by the 24-map hills × weather set. Existing combinations are restored rather than duplicated.

## Options

| Layer | Choices |
|---|---|
| Hills | Flat; softened brown elevation bands; shaded relief; sparse contours; full 20 m topographic contours; slope-aligned hachure texture |
| Parks | Green fill; green elevation bands; outline; repeating tree texture |
| Weather | High/low readings; interpolated daily-high gradient with five number anchors; gradient plus 11 readings; gradient plus five sparse high/low readings |

Brown bands use the previously selected softened palette. Green elevation is a separate park choice. Textured hills derive from the existing USGS DEM, not random noise. Trees repeat inside geographic park paths. Gradient color is multiplied over terrain so terrain comparisons remain visible. Park fills are translucent in gradient modes so both systems remain perceptible.

## Sparse high / low + gradient

Select “Gradient + sparse high / low” in any Weather selector. Five full high/low labels (Outer Richmond, North Beach, Mission, Bayview and Lake Merced) sit over the daily-high gradient. All 22 forecast samples continue to contribute to the field. UV and qualifying rain stay beneath these five labels, with qualifying wind retained across the eleven overview locations. This separates the density of source samples from the density of visible labels. The previous eleven-label hybrid remains available as “Gradient + 11 readings.”

A link with `?revision=7&weather=sparse-hybrid` puts this option first while retaining locally saved choices. The default twelve-map set also starts with it.

## Density and thresholds

Standard reading modes show eleven of the previous twenty-two locations, deliberately spaced across SF: Outer Richmond, Inner Sunset, Presidio, North Beach, Market Street, Mission, Glen Park, Bayview, West Portal, Lake Merced and Ingleside. No responsive or collision-based pruning is applied. Previews scale the entire map uniformly; inspect larger to assess the selected 18pt high / 14pt low sizes.

UV maximum is in row two. Rain appears only above 0.05 daily inches. Wind appears only above 15 mph, in an additional row. Exactly 15 mph stays hidden. Five overview fixtures qualify for wind. Gradient-only maps keep these wind exceptions even when no temperature number is placed there.

The gradient uses all 22 synthetic forecast inputs, with a fixed 60–74°F blue-to-red legend and smooth inverse-distance interpolation. It illustrates a presentation option; it is not a measured or operational weather field. Its five number labels are sample forecasts, so they need not exactly equal the smoothed color at each coordinate. UV/low/rain remain available in the point inspection; use hybrid mode to keep them on the map.

## Retained choices

Atkinson Hyperlegible Next; warm red high, blue low, dark yellow UV, blue rain; no label backgrounds, leader lines or dots. Swimmers use the selected competition freestyle glyph at half size in a solid teal disc. Person-in-pin is simulated. Solid compass needles link conceptually to adjacent regions. Beach buttons remain directly on the shoreline with independent conditions. Bridges stay stylized and unnamed, roads unnamed, parks unnamed, no landmarks or north compass. Map extent remains SF.

## Files and provenance

`comparison-fixtures.js` contains the synthetic weather and overview subset. `prepare-comparison-assets.py` generates the two local texture/gradient PNGs from the existing USGS DEM and fixture forecasts. Geometry and original elevation sources remain in `SOURCES.md`. No runtime network fetches or new map services are used. Revision 5 is preserved in `parks-study-v5.*` and `density-choices-v5.js`.
