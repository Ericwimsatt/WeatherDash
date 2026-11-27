# Disposition — ship

Ship revision 3 as the selected, illustrative SF map study. No material discrepancy with the pinned design was found in the supplied desktop and phone renders or the relevant source. No rebuild, UI fix, or replacement capture is required for this bounded design handoff.

This is a finish review of the selected revision, using the supplied brief as authority. It does not reopen the design choices or constitute a full Impeccable critique workflow.

# Material findings

- The map gives weather the strongest visual hierarchy. Bare temperature pairs are centered over their forecast coordinates, with UV and qualifying rain immediately beneath. The visible land, park, and terrain changes do not require backplates to keep the numbers readable.
- Brown terrain sits within the mainland silhouette; green terrain is confined to park shapes. The central hills remain legible while parks retain their separate green identity. No park captions, bridge captions, road captions, or region-name labels compete with the weather.
- The selected icons read consistently: competition freestyle swimmers at coastal locations, solid-needle compasses inside adjacent-region controls, and the person-in-pin in free central-south map space. The Golden Gate structure faces the opposite side of its road deck; its geographic road alignment remains intact.
- The 390px captures preserve the city silhouette and sufficient weather hierarchy without cramming all ten labels into the map. The forecast picker exposes the selected point; the Outer Richmond capture demonstrates that a western rain-bearing selection stays bare and readable.
- No material finding requires a change. The inherited cream palette and small metadata are consistent with this selected study; the detector flags described in the handoff are not grounds to replace the approved visual identity.

# Requirement coverage

| Requirement | Observed coverage |
| --- | --- |
| Brown elevation outside parks; green only in park overlap | Source draws brown bands within the land clip, covers parks with their green base, then applies green bands within the park clip. Captures show the intended separation. |
| No park labels | No SVG text is generated; rendered park areas are uncaptioned. |
| Bare weather in every visual state | Source explicitly removes background, border, shadow, and text shadow; hover and selected states retain bare treatment. Supplied QA reports passing default, hover, and selected checks. |
| High/low row, then UV and optional rain | Captures and generated markup agree: red high, blue low, ochre/yellow-tinted UV, blue rain, with rain beside UV. The 62°/49° point has UV4 beneath. |
| Daily rain strictly above 0.05 inches | Both label content and accessible label use `rain > .05`; exactly 0.05 is suppressed. QA reports the mixed and dry cases passing. |
| Swimmer without beach caption | Coastal swimmer pictograms are visible; beach names occur in accessible labels and opened detail content rather than map captions. |
| Solid compass and person-in-pin | Pinned IDs resolve to the selected SVG geometry; both are visible in the captures. |
| Reverse Golden Gate drawing; remove bridge captions | Golden Gate structure uses `scale(1,-1)` independently of the road deck. Both bridges remain uncaptioned. |
| Map text reserved for weather and adjacent-region controls | Map surface contains weather readings plus Marin/East Bay controls. Branding, units, selected-point name, and attribution sit outside the mapped surface. |
| Zoom to mainland SF | Bounds are pinned to west -122.522, east -122.351, north 37.820, south 37.706. Captures show the enlarged mainland; supplied QA reports city-extents coverage passing. |
| Preserve confirmed choices against old recipes | Only sample, selected point, and demo-location visibility are read from saved/query state; terrain, label, swimmer, compass, and location designs remain pinned. |
| Preserve legibility and responsive fit | Captures are clear at desktop and 390px. Supplied QA reports no overflow at 320/390/768/1440 and minimum weather-color contrast of 4.92:1 or higher across tested fills. |

# Evidence limits

Reviewed `main-map.png`, `desktop.png`, `phone-map.png`, and `phone-richmond.png`, plus the current selected HTML/CSS/JS, icon definitions, exported recipe, and `qa-results.json`. The screenshots match the selected source in the significant visible details. This reviewer did not independently recapture the browser or rerun the 42 supplied assertions, so interaction/state claims beyond the screenshots rely on source inspection and the supplied QA record.

The contrast results cover the tested map fills, not every possible text-over-road intersection or every interface element. The captures show two phone selections rather than every selection at every breakpoint. Mainland coverage relies on the bounds and supplied city-extents check, not a new geographic audit. Forecasts, beach readings, location, and adjacent-region destinations are demonstrative; this disposition does not certify live weather, geolocation, regional navigation, or exhaustive accessibility.

# Bounded recommendations

Accept the selected revision with its current recipe and evidence bundle. Keep the existing illustrative-weather and simulated-location disclosure attached to this handoff. Recapture only if the map geometry, weather type treatment, viewport, or mobile selection behavior changes. No additional visual work is recommended within the requested scope.
