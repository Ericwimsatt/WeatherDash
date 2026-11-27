# Disposition: SHIP

Both original finish findings are resolved in the refreshed captures and source. Ship this as the reviewable SF exploration. No rebuild or further recapture is required by this bounded verdict. Compact text plus paper-disc swimmers is a credible provisional starting point; the alternatives remain useful choices.

## Material findings

1. **Original P2 mobile weather/icon occlusion — RESOLVED.** Refreshed `phone-capsule.png` shows selected Glen Park 67°/52° and its UV row fully readable. The personal pin is temporarily hidden and the footer explains why. The western capsule that previously collided with Ocean Beach is absent, leaving the beach control clear. Refreshed `phone-map.png` preserves readable compact weather, the personal marker, and beach buttons. Source confirms mobile collision handling now treats beach controls and the visible personal marker as obstacles for non-selected weather; selected weather remains visible, with higher stacking priority, and the personal marker yields when it overlaps selected weather. Geographic coordinates are unchanged.

2. **Original P3 sliced weather at swimmer-crop edge — RESOLVED.** All five refreshed individual swimmer cards and `swimmer-options.png` show a clean lower crop boundary without partial weather values. All three northern swimmers remain visible. CSS now uses a 650×190 crop; the existing y80 offset yields y80–270. Water, land, and park specimens remain available for every treatment.

The softened terrain now recedes appropriately behind weather. The 22-point desktop map retains whitespace between readings and adds convincing coverage across the center, south, and east. Compact, high-led, capsule, outline, and split treatments are meaningfully different; the 25 px reference gives an honest density comparison. The capsule provides the strongest separation over roads and contours, while compact bare text preserves the map's openness. Paper discs give the selected swimmer a clear silhouette on all three tested surfaces; the filled disc offers an intentionally stronger action cue. None of these choices requires reopening the pinned icon or geography.

## Coverage

- Inspected actual rendered evidence: `main-map.png`, `desktop.png`, `phone-map.png`, `phone-capsule.png`, `weather-options.png`, `swimmer-options.png`, `weather-high-led.png`, and `swimmer-disc.png`.
- Reviewed `parks-study.html`, relevant rendering/collision/crop code in `parks-study.js`, responsive typography and button treatments in `parks-study.css`, and all option definitions in `density-choices.js`.
- The evidence includes 22 illustrative locations, six weather treatments, five swimmer treatments, desktop composition, mobile representative readings and picker, and swimmer specimens on water, land, and park. The UI explicitly distinguishes added demo proposals from production locations.
- Reviewed `qa-results.json`: 83 recorded checks, including density changes, all option applications, strict daily rain >0.05 inches, coordinate centering, 44 px swimmer hit areas, selection/detail actions, reversible comparison controls, export/persistence, 320/390/768/1440 px overflow checks, and no recorded browser errors or external requests. Added assertions cover selected forecast visibility, icon clearance, personal-marker suppression and its explanation. Recorded weather contrast is at least 5.8:1; filled swimmer contrast is 8.6:1.
- Used the incumbent study and supplied brief as visual authority for this scoped review. Impeccable context found no PRODUCT.md or DESIGN.md; that documentation gap does not block this refinement. This subagent inferred the bounded review scope from the supplied brief and did not run an interview or edit the UI.

The follow-up verdict was limited to the two original findings: inspected refreshed `phone-capsule.png`, `phone-map.png`, all five individual swimmer cards, and `swimmer-options.png`, plus the changed collision, marker, and crop source. No UI edits or new full defect hunt were performed.

## Evidence limits

This is an independent source-and-capture review, not a new live interaction or assistive-technology audit. Recorded QA is supporting evidence from the implementation pass and was not rerun here. Static captures cannot establish keyboard focus recovery, real-device touch behavior, every selected-location/style combination, or browser compatibility. The refreshed captures establish resolution of the observed mobile collisions and crop defects; this bounded verdict does not establish every location/style combination. Added forecasts and coordinates remain illustrative study data.

## Bounded recommendation and fixes

No further fixes are required for either original finding. Keep the current direction, all eleven options, fixed coordinates, and compact + paper-disc provisional default. Deliver the exploration for the user's comparison and selection. This ship verdict applies to the demo exploration and the two verified finish fixes, not to production provider integration or a broader application release.
