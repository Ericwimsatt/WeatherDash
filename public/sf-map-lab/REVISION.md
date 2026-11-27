# Selected parks direction — next mockup

**Archive note:** this document describes revision 2. The current selected brown / green bands and bare overlays are documented in [SELECTIONS.md](SELECTIONS.md); revision 2's alternatives remain at [parks-study-v2.html](parks-study-v2.html).

This revision records the user's selections and presents the remaining choices at [parks-study.html](parks-study.html). The original comparison and report remain available as an archive.

## Kept and changed

- **Parks are the structure** is now the selected orientation system.
- Both **Golden Gate Bridge** and **Bay Bridge** appear as original schematic suspension-bridge drawings, placed along their road crossings.
- Roads remain visible but have no road-name or route-number labels. The I-80 line joins the southern freeway connection and continues along the Bay Bridge to Yerba Buena Island and the eastern viewport edge. US 101 continues through Golden Gate Bridge and connects to the Presidio / cross-town road skeleton. Road topology and geometry remain simplified for orientation, not routing.
- Removed the previous tower / landmark icons and the standalone north compass. Park names remain part of the selected park system. Bridge names identify the two explicitly requested bridge features.
- Each weather label has **daily temperature high / low**, **daily UV maximum**, and **daily precipitation only when strictly greater than 0.05 inches**. There is no region name, current temperature, wind, sky icon, rain probability or time phrase inside these labels. Forecast point names remain available to assistive technology, in the phone picker and in the selected-point footer.
- The main map and all four label alternatives use the same locally hosted **Atkinson Hyperlegible Next variable** font as WeatherDash's body and data text; the wordmark uses the incumbent bold Atkinson Hyperlegible face. This replaces the original exploration's static body font for the new study only.
- Swimmer symbols sit directly at beach coordinates. They have no map labels, detached callouts or leader lines. A selected swimmer opens a beach-specific detail dialog. The selected weather point is preserved.
- Adjacent-region controls use a compass. The compass is an action icon beside a destination; it is not a north marker.

## Hill choices

The same elevation model drives every treatment, so the comparison is about visual encoding rather than five invented hill patterns:

1. **Shaded hills:** low-contrast relief with northwest illumination. Recommended first candidate.
2. **Elevation bands:** four height steps at 60, 120, 180 and 240 meters.
3. **Sparse contours:** 80, 160 and 240 meter curves over very light relief. Recommended alternative.
4. **Full topographic:** 20 meter contour interval, stronger 100 meter index curves, and some elevation labels.
5. **Flat reference:** parks and roads without terrain.

Contours and shading are derived from a coarse, locally stored public [USGS 3DEP elevation export](https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer). The downloaded raster covers longitude -122.544 to -122.348 and latitude 37.707 to 37.846 at 360 × 324 samples. It is smoothed twice before contouring to avoid grid-scale noise. This is a city-scale visualization, not a survey, hiking map or navigation-grade topographic product.

The input raster is in `docs/sf-map-exploration/data/sf-elevation-usgs.tiff`; the reproducible transform is `docs/sf-map-exploration/prepare-terrain.py`. The derived PNG stores source metadata. No terrain, map tile or font service is called by the browser. The exact public export URL is recorded in that transform.

Land and park geometry still comes from DataSF, as documented in [SOURCES.md](SOURCES.md). Treasure Island / Yerba Buena Island is restored from the same downloaded dataset. The small Marin headland at the north edge is an authored schematic to show the Golden Gate's northern connection. Bridge structures and road lines are original schematic vector geometry, not photographs or official engineering drawings.

## Four label appearances

The comparison holds facts and typography constant: compact ticket, horizontal ribbon, three-column reading, and open type. The sample day includes 0.00, 0.03, 0.04, 0.05, 0.06, 0.09 and 0.12 inch values; exactly 0.05 stays hidden. The dry-day fixture removes all precipitation lines. The threshold is interpreted as inches of daily total, consistent with the main app's weather units; this is a mock display rule, not a live forecast change.

## SVG choices

The choice lists show only SVG specimens at three sizes, with individual downloads. Five swimmers include an original solid competition / freestyle pictogram close to the requested Olympic-style direction, rather than official Olympic artwork. Five compass choices vary ring, needle and rose structure. Six location images include a crosshair, yellow and blue standing people, a person pin, a walking person and a circular person badge. Choosing a personal marker turns on a simulated location; it requests no geolocation or device heading.

The choice state is kept separately from the original study in browser storage and can be exported as `sf-parks-recipe.json`. Hiding and minimizing terrain / label candidates is reversible with Restore. These remaining options are provisional; the selected parks system and explicit removals are recorded in the export.

All forecast and beach data remains illustrative. The main WeatherDash application and its providers are unchanged.

## Verification

The revision passed 60 browser assertions, including all terrain / label / SVG choices, the strict precipitation threshold, beach-marker centering, compact-label clearance, downloads, recipe export and narrow layouts. Widths checked: 320, 390, 768 and 1440 px. No external HTTP requests or uncaught browser errors occurred. Typecheck and production build pass; the main app's existing bundle-size warning is unchanged.

Reproduce the browser pass with an existing Playwright installation using `docs/sf-map-exploration/browser-qa-v2.cjs`. Captures and the exact check record are in `docs/sf-map-exploration/review-v2/`. The separate fresh visual review's final scope and disposition are recorded there as `finish-review.md`.
