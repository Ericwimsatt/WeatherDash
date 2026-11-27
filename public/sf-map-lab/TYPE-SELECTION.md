# Selected text and swimmer treatment — revision 5

The current [SF preview](parks-study.html) defaults to the user-selected **High leads, low recedes** treatment and **solid teal swimmer disc**. The previous comparison remains at [parks-study-v4.html](parks-study-v4.html).

- High temperature: **18 pt**. Low temperature: **14 pt**. These are literal CSS point sizes: 24 px and approximately 18.667 px, respectively. They stay fixed across preview widths, and retain the WeatherDash Next font, red high / blue low, and UV / qualifying rain second row.
- The white competition-freestyle glyph is **13.5 px**, half its previous 27 px size. The teal disc stays 34 px across, with a 44 × 44 px click target.
- **Every one of the 22 locations renders at every preview width.** The prior narrow-screen representative filter, overlap pruning and personal-marker suppression are removed. `visiblePoints` always returns all 22, and the locations control no longer offers reduced subsets. Old stored density recipes cannot trim this version.

At narrow widths, fixed-size readings may overlap. This version intentionally exposes the full density instead of silently removing locations. It does not claim every narrow-layout combination is overlap-free.

The softer terrain, selected compass / person glyphs, independent beaches, and strict daily precipitation display rule remain unchanged. Weather values and added locations are still illustrative. The main app's production configuration is unchanged.

Revision 5 uses its own browser-state key so older style or density preferences do not replace the selected defaults. The comparison controls remain available for further exploration.

Verification: `docs/sf-map-exploration/browser-qa-v5.cjs` passed 35 checks, including exact sizes and 22 rendered labels at 320, 390, 768 and 1440 px, legacy density isolation, beach details, export and reload. Captures and the fresh visual review are in `docs/sf-map-exploration/review-v5/`.
