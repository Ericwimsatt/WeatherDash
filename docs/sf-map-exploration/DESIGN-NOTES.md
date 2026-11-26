# SF map exploration design notes

This is a record of an unchosen study, not a product design system. The [review brief and direction contract](README.md#review-brief-and-design-contract) authorizes extending the SD beach finder map language for an SF-only comparison. Options remain available to pluck and combine later. No recipe, icon choice, layout, or recommendation here establishes an app-wide preference.

## Inherited evidence

The visual reference is the rendered SD map in `sdbf/src/map.js`: warm land (`#f0ede1`) and pale blue water (`#dceff5`). The SF study preserves those exact fills in `public/sf-map-lab/map.css`. Fine roads, quiet orientation captions, coordinate-based points and compact readable type carry forward the map's hierarchy. The SD renderer uses lighter road casing (`#fffdf6`) with route strokes (`#849098` and `#9ca5a1`); SF's simplified street network uses its own study-local strokes rather than claiming identical geography or rendering.

`sdbf/preview/preview.css` supplies additional interaction evidence: selected pins, accompanying evidence panels, visible keyboard focus, status words and colors, and a map/list arrangement that stacks on small screens. Its surrounding preview shell uses system type; the production SD map explicitly names Atkinson Hyperlegible. Those are distinct sources, not a single shared token system.

The study loads local Atkinson Hyperlegible regular and bold TTF files from `public/sf-map-lab/assets/`, with the copied OFL license alongside them. Its CSS aliases the family as `Atkinson`, maps regular to weights 400–600 and bold to 650–900, uses `font-display: swap`, and disables synthesized faces. These are two static font files, not a variable font. The incumbent dashboard separately uses local Atkinson Hyperlegible bold for headings and Atkinson Hyperlegible Next variable for body text in `src/styles.css`; its typography remains authoritative for that app.

The main app's `src/design-tokens.css` remains unchanged. Its warm Sunline page (`#fbf1df`), ink (`#2d2018`), orange accent (`#e85d32`) and water surface (`#d8eef4`) are incumbent app values, not values to overwrite with this study's map palette. The root has a pre-existing gap in global `PRODUCT.md`, `DESIGN.md` and `.impeccable/design.json` documentation. This pass records that gap without creating those files or promoting a provisional direction. The SD-specific `sdbf/docs/DESIGN.md` is a separate document.

## Study-local extensions

All browser UI, fixtures, original SVG symbols and local font assets live under `public/sf-map-lab/`. Documentation and build helpers live under `docs/sf-map-exploration/`. The lab stylesheet defines its own ink (`#253d43`), muted text (`#52676b`), paper (`#fffdf7`) and teal interaction accent (`#165a60`), plus park and lake materials. Even its `:root` declarations are confined by loading the stylesheet only on these standalone study pages. They are not global dashboard tokens and must not be imported wholesale into the app.

Weather labels lead; roads, parks, landmarks, water names and coverage sketches provide quieter orientation. Ticket, chip, strip and bare-label treatments test different amounts of enclosure and density. Uniform, exception-led, quiet and other information patterns test what each point reveals. Orientation systems and swim, UV, location and adjacent-region symbols remain configurable alternatives. The default recipe makes a preview concrete; it is not an approved selection.

The material is mostly flat, separated by thin borders and paper tones. Transient beach drawers and messages use shadows locally. Rounded label bodies, circular beach symbols, status shapes, selected outlines and keyboard focus support this study's interactions; their exact geometry does not redefine app components.

## Geographic and interaction boundaries

`map-engine.js` projects longitude/latitude into a study coordinate plane of 1000 × 810. Ten incumbent SF locations are distinguished from four proposed additions. Forecast points remain at their stored coordinates while authored label offsets move the readable button bodies. Real button hit boxes follow those bodies, with at least 44px label height in the final rules. Compensating anchor-dot positions preserve the point location even when a label moves.

The SVG leader layer is decorative, hidden from assistive technology and ignores pointer input. It connects each visible point to the nearest edge of its displaced label; beach connectors originate at each beach's independently projected coordinate and end at its symbol. Lines are drawn after rendering and recomputed through a `ResizeObserver`. They explain authored offsets, not forecast boundaries or a production collision-avoidance algorithm.

Ocean Beach, Baker Beach, Crissy Field and Aquatic Park have separate coordinates, sample conditions, status words and detail drawers. Selecting a beach does not turn it into a neighborhood forecast or replace the weather selection. Surf, water quality, sample age and missing evidence stay separate. Color is accompanied by words and status shapes; “No posted advisory” must not become “safe.” Every weather and beach value is synthetic, including the deliberately varied data and weather states.

Coverage sketches are illustrative, not validated service polygons. Geography is simplified; source provenance and limitations belong with the study's source documentation. Locate toggles a demo point without geolocation access. Marin and East Bay controls explain the SF boundary rather than navigating to live regional maps. Persistence and JSON export record local comparison choices only; they do not change production preferences.

## Mobile scope

Responsive rules use the named `weather` container, with adjustments at 900px and 620px. At the smaller size the detail dock moves below the map, a region selector keeps every point reachable, and representative labels plus the selected point reduce congestion. The map becomes square while geographic layers occupy the same inset band (8% from the top, 81% high). Authored offsets and leader lines preserve the coordinate relationship. Beach labels yield to symbols; the beach summary and drawer retain the condition wording. Reduced-motion rules disable animations and transitions.

Thumbnail maps are deliberately inert and hidden from assistive technology. They retain a fixed desktop-like map composition and scale as a whole; their tiny text is comparison imagery, not the functional mobile reading surface. The full-size inspector and standalone maps are the interaction surfaces. These density and breakpoint decisions apply to this SF study, not to every dashboard or region.

## Provisional decisions and integration boundaries

Label placement is hand-authored for this geographic extent and fixture set. Long translated names, live error messages, denser regional point sets, different map extents and real provider data still need integration review. The study's responsive behavior and reported browser verification do not establish production data correctness or universal collision handling.

Future integration starts with an explicitly chosen subset of recipes and symbols. Extract the selected map behavior into the existing application architecture; reconcile its local materials with the incumbent tokens deliberately, retain local font licensing, and review new scope against the app's existing typography and interaction patterns. Connect forecast, beach evidence, geolocation, routing and durable preferences only through their actual production contracts. Preserve independent beach coordinates and evidence semantics, keyboard access, geographic anchors and a reachable mobile selection path.

This documentation pass changes only this file. It does not alter UI, generated assets, app tokens, providers, database, routing or the SD beach finder. Global design documentation remains a separate future task after durable product-wide decisions exist.
