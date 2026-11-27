# More locations and smaller weather treatments

**Revision 4 archive:** the comparison described here is preserved at [parks-study-v4.html](parks-study-v4.html). The user's selected 18 pt / 14 pt treatment, half-size swimmer glyph and all-location preview policy are recorded in [TYPE-SELECTION.md](TYPE-SELECTION.md).

Open [the current comparison](parks-study.html). The [previous selected map](parks-study-v3.html) remains available as a reference.

## What changed

The expanded demo has **22 forecast locations**, up from 10. Twelve proposed points add Presidio, Haight-Ashbury, Castro, Noe Valley, Glen Park, Bernal Heights, Potrero Hill, Mission Bay, Bayview, Excelsior, West Portal and Ingleside. The selector also offers the original ten and an intermediate sixteen, so type can be compared at different densities without changing the map extent.

The added coordinates and weather are illustrative proposals. They are not added to the main application's production location configuration or connected to new observations. Every forecast in this study is synthetic.

The elevation bands are softened by blending **70% of each prior band color with 30% of its matching base surface**. Brown stays outside parks and green stays inside park footprints. The underlying USGS elevation contours, SF extent, roads and bridges are unchanged.

## Six weather choices

| Option | Main treatment | Reason to try it |
| --- | --- | --- |
| Compact bare | 18 px high / low, 11 px second row | Fits more readings while preserving the open map |
| Original large | Previous 25 px high / low | A legibility reference at the same 22 locations |
| High leads | 21 px high, 15 px low | Prioritizes daytime temperature with less width |
| Paper capsule | Compact text on a small light oval | Separates readings from roads and terrain |
| Fine outline | Transparent fill, thin rounded frame | Groups the readings with less backing |
| Paired lozenges | Small red / blue temperature shapes | Distinguishes the two numbers through both color and grouping |

All options use WeatherDash's actual Atkinson Hyperlegible Next variable font. The field meanings stay fixed: daily high / low first, then daily UV maximum and precipitation strictly above 0.05 inches. Red high, blue low, gold UV and blue rain remain consistent. No region name, leader line or forecast dot is added.

The compact bare treatment is the recommended starting point, with the capsule as the stronger separation option. These are recommendations for comparison, not newly confirmed user decisions. Smaller type makes the difference between a comfortable overview and a map that demands closer inspection; use the full map to judge readability rather than relying on thumbnails.

## Five swimmer-button choices

The competition freestyle symbol remains fixed. Compare a paper disc, the bare symbol, a solid teal disc with a white swimmer, a small rounded square, and an open teal ring.

Each button retains a 44 × 44 px hit area and stays centered at its beach coordinate. The visible button surface is smaller than that hit area. Comparison cards include a real northern-shoreline crop plus water, land and park specimens. Clicking any beach in the main map still opens its independent sample conditions.

The paper disc is the recommended initial candidate: it gives a clear edge without the emphasis of the filled teal button. The bare icon remains a reference. No swimmer glyph, navigation compass or personal-location symbol has been replaced.

## Using the comparison

Use the selectors above the map to mix any weather treatment, swimmer button, density and sample day. Each comparison card can be tried, kept, minimized or hidden. Restore controls retain every source option. Keyboard h / l and Home / End cycle the active comparison. The component grids switch to horizontal carousels when their rendered height would exceed half the viewport.

Kept options and the provisional recipe are saved separately under revision 4 browser storage. Export downloads `sf-density-choices.json`. Older no-background preferences are preserved in the revision 3 reference; the current request explicitly reopens small shapes and fills.

On phones, representative readings remain at their coordinates and the picker exposes all locations at the selected density. Colliding secondary readings yield to beach buttons and the selected forecast. A simulated personal marker yields when it would obscure the selected reading; a note explains its temporary absence. This is a bounded mockup collision policy rather than a production map-label engine.

## Verification and scope

Text colors measure at least **5.8:1** against the softened map fills; the filled swimmer's light glyph against teal measures **8.6:1**. These are palette checks, not an exhaustive accessibility certification. The source, snapshot geometry and licenses remain documented in the earlier study files.

The browser check is `docs/sf-map-exploration/browser-qa-v4.cjs`; evidence and its exact result record live in `docs/sf-map-exploration/review-v4/`. It exercises all eleven treatments, density controls, new-point selection, rain thresholds, button centering and hit areas, keep / hide / restore, keyboard comparison, export, saved choices and phone layouts. The fresh visual review is saved in the same evidence directory.

The main WeatherDash source, providers, database and production location configuration remain unchanged on the exploration branch.
