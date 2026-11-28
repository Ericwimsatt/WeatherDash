# San Francisco map assets

`san-francisco.svg` promotes the selected map study’s brown elevation bands and green park elevation into the main app. Land/parks are simplified DataSF geometry; terrain contours derive from the study’s USGS 3DEP raster. Roads are schematic. The Golden Gate structural drawing is mirrored across its deck as selected. The viewBox crops at model y=875 (latitude 37.7091667) so the mainland continues past the lower edge rather than ending above a strip of water.

Full source URLs, simplification and DEM provenance are in `public/sf-map-lab/SOURCES.md`, `REVISION.md`, and `docs/sf-map-exploration/prepare-terrain.py`. The selected geometry is unchanged; only the southern crop changes. The static asset contains no forecast values. An empty clipped image layer receives a runtime field generated from available live forecasts.

`sf-locations.json` contains 22 forecast sample coordinates, promoted from the approved exploration. They are interpolation samples, not sensor/station claims or polygonal region boundaries. Fifteen are selected for numeric display, reserving the first for the sample nearest an in-map user. All 22 are registered in the existing weather API’s coordinate allowlist.

`icons.json` contains the selected original competition freestyle, solid-needle compass and person-pin vector glyphs from the study. Beaches have independent coordinates and data queries. The person pin appears only after real browser location succeeds; no mock or stored position is used.
