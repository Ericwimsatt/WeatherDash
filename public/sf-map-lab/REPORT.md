# San Francisco regional weather map study

This is a decision package for a new map in the main weather app. It preserves the quiet map language of the SD beach finder and explores what SF needs instead of a highway-led orientation system. Nothing is wired into the main dashboard. Every weather value, beach condition, timing statement and proposed point is an illustrative fixture.

Start with the [interactive comparison](index.html). For an uninterrupted view of every option, open the [map atlas](atlas.html). The [SVG icon sheet](icons.svg) is available separately. Each of the four map systems also has a standalone page: [parks](parks.html), [streets](streets.html), [landmarks](landmarks.html), [hybrid](hybrid.html).

## A 20-minute morning route

1. Spend five minutes in **Map systems**. Before reading the cards, look at the map and locate your usual places. Keep the system that helps you do that fastest. Do not choose based on whether one thumbnail looks prettier.
2. Spend three minutes in **Region labels**. Select Inner Sunset, Marina and Mission. Try the ticket and the one-line chip. Turn on **Phone preview** before committing.
3. Spend four minutes in **Information patterns**. Compare the exception pattern with the uniform pattern. Then use **Mix all choices** to set the comparison lens to wind, UV and rain.
4. Spend three minutes in **Weather & data states**. Look at rain, high UV, partial data and an older forecast. A favorite layout that cannot explain these is not ready to become the default.
5. Spend three minutes in **Icon workshop**. Choose each category independently. Try a beach and the simulated location; do not judge all icons at specimen size.
6. Spend two minutes in **Other major choices**. Decide whether to retain ten points or change coverage, then choose how beaches appear. Open **My decisions**, add notes and export the JSON.

You can keep multiple candidates. **Try on map** changes the provisional recipe; **Keep option** marks a candidate for later discussion. **Minimize**, **Hide**, per-option restore and **Restore all options** change only the comparison display. Choices and notes stay in this browser; export makes them portable. No selection is a merge request or a permanent product decision.

## My starting recommendation

Use the **hybrid orientation system**, **small weather tickets**, and a **shared core with local exceptions**. Keep the existing ten SF forecast points for the first integration. Show beach conditions at independent beach coordinates. Use named beaches on desktop and symbols plus a named list on phones. Keep a citywide requested hour, with forecast issuance and observation times shown separately when real data is connected.

For icons, start with **swimmer + condition badge**, **lettered UV**, **a blue location dot** and **destination + frame-exit arrow** at the city boundary. Use a **crosshair for the locate action** and a **chevron for nearby forecast-point links** even though this study lets you compare one symbol in both roles. A map marker and the action that creates it are different jobs.

I would change this recommendation if you navigate SF primarily by driving corridors, if visitors are the primary audience, or if your main repeated task is comparing the same three fields across all neighborhoods. Those favor the street system, the landmark system, or the uniform information pattern respectively.

## What exists to build on

The main app already has ten SF locations: Inner and Outer Richmond, Inner and Outer Sunset, Market Street, Pacific Heights, Marina, Mission, North Beach and Lake Merced. These are coordinates in `src/config.ts`, not a set of weather polygons. The study uses those coordinates unchanged. Four additional coordinates in the expanded-coverage option are explicitly proposed, not changes to the main app configuration.

The app has hourly forecast weather, observations, tide data, water temperature and sun times. Its README says SF observations are represented by a nearby station mapping, not neighborhood sensors. The UI must preserve that distinction: two neighborhood forecasts may differ while their nearest recorded observation is the same station. Drawing ten different temperatures does not establish ten independent measurements.

The SD beach finder’s map is primarily warm land, pale blue water, fine road lines, compact text and independently anchored beach points. That is the visual reference here. This study uses the same map surface colors and a locally hosted Atkinson font. It does not redesign the app’s headers, charts or overall identity.

The geography is a simplified local snapshot of public DataSF analysis-neighborhood and park geometry. The city’s analysis neighborhoods are reporting groupings of census tracts, not an authoritative weather-region model. Street centerlines, landmark placements, lake-water fill and the scale display are schematic. The map is an orientation mockup, not a navigation product. Sources and transformation notes are in [SOURCES.md](SOURCES.md).

## Four complete orientation systems

### Parks are the structure

The Presidio is the northwest anchor. Golden Gate Park separates Richmond from Sunset. Twin Peaks provides central hill context, and Lake Merced locates the southwest. Smaller anchors such as Glen Canyon, Dolores Park and McLaren Park explain the remaining city without drawing a full street grid.

This is the most locally grounded system for people who think about walking, cycling, recreation or neighborhood relationships. Park footprints have a second advantage: they orient without looking like live weather. A green area means park land, not a better forecast.

The risk is uneven familiarity. A visitor may recognize Golden Gate Park but not Glen Canyon. Eastern SF also has fewer enormous green shapes. This option should stay a complete park-first system, with useful names and water edges, rather than acquiring five unrelated landmark symbols to patch every gap.

### A few streets, well chosen

SF needs a street skeleton if roads lead the map. US 101 and I-280 alone do not explain the center or west. Geary, 19th Avenue, Market, Van Ness, Sunset Boulevard and the Embarcadero create a sparse but useful network. Street names remain quieter than weather labels.

This is closest to the SD map’s reasoning, and likely best if you are choosing where to drive. The risk is mistaking a thin orientation line for a route that has been traced accurately. Production should source real street geometry and choose the label anchors deliberately. The mock does not claim that its simplified bends follow the road.

### Recognize the skyline

The Golden Gate Bridge, Sutro Tower, Twin Peaks, Coit Tower and Ferry Building form a system of distinctive reference points. The symbols share the same line weight as the rest of the map UI; they are small locators, not decorative illustrations.

This system is useful for visitors and for explaining “west of the hill” or “near the waterfront.” It is weaker for block-level orientation. A landmark can be recognizable while its map position is unfamiliar. Icons also compete directly with beach and sky-condition icons. Five meaningful points are preferable to a city full of attractions.

### Parks + three corridors

The recommended hybrid retains the large park footprints and four park labels, adds Geary / 19th / Market, and uses the bridge, Sutro Tower and Ferry Building as a few edge and hill references. The northern US 101 segment provides a quiet gateway cue. It is deliberately not the sum of the other three systems.

Its advantage is geographic completeness: west-side green structure, central cross-town corridors, recognizable water edges and a southern lake. Its risk is gradual accumulation. If every proposed landmark and street is added over time, the system stops being restrained. A production label budget should be written down: selected forecast first, weather exceptions next, primary orientation anchors next, secondary orientation labels last.

## Four per-region overlay layouts

| Layout | Always visible | Best reason to choose it | Main cost |
| --- | --- | --- | --- |
| Weather ticket | Name, condition, temperature; one optional second line | Handles useful exceptions and incomplete evidence | Larger footprint; needs collision rules |
| One-line chip | Name, condition, temperature | Keeps the map visible | Important secondary facts need the dock or a banner |
| Two-reading strip | Name, condition, temperature, wind | Frequent comparison of wind and temperature | Dense, especially in the north |
| Bare map text | Name, condition, temperature with a text halo | A continuous geographic feel | Variable contrast and weaker grouping |

The label is distinct from its fixed forecast coordinate. In the mock, the point remains anchored and the label can sit above it or use a small mobile offset. The selected point has a heavier outline and its details appear in a dock. A beach opens its own detail panel without changing the weather selection.

For production, label collisions need a deterministic policy. Keep selection visible. Then keep the most useful exceptions and geographic spread. Shift a label with a leader, or collapse it to a point. Do not move the forecast coordinate, shrink text indefinitely, or let document order decide which region disappears. A collision policy is still implementation work; the mock uses authored positions and demonstrates the density limits.

On phones, the map does not pretend that ten desktop tickets fit. It shows four representative tickets, substituting a nearby selected point where appropriate, and sometimes a fifth when the selected point is elsewhere. The named picker provides all available forecast points. The selected detail and beach list move below the map. That is a working structural adaptation, not simply a smaller desktop layout.

## Five information patterns

### Shared core, local exceptions

Every forecast point gets a name, temperature and sky condition. A second line appears only when it earns attention. Outer Sunset can show wind; Outer Richmond can show fog; Mission can show high UV on a high-UV day. Missing or old data takes precedence over those embellishments.

This is my default. It represents SF’s differences without making every point an entire weather station. Its weakness is asymmetric comparison: no wind line does not mean no wind. The selected dock must keep the full field set in a stable order, and the map needs a separate lens for explicit wind, rain or UV comparisons.

The study’s priority order is missing / old evidence, rain, wind, UV, then fog. This is an authored display rule, not a validated threshold policy. If rain and UV are both important, use the one-line summary for the leading fact and preserve the other in detail; serious alerts should have their own visible layer. Do not reduce every type of risk to one winner in a ranking.

### Uniform facts everywhere

Every ticket gets temperature, wind and UV. That makes spatial comparison consistent. It also creates a lot of nearly identical text on a mild day. Choose it if repeated cross-neighborhood comparison matters more than the map’s visual calm. Do not use it merely because the data exists.

### One question at a time

Wind, UV or rain chance becomes the big number at every point. The toolbar writes the metric and unit explicitly, and every label carries the unit. Temperature and the rest remain in the selected dock. The user changes the lens deliberately; the app should not silently switch the meaning of the large number as weather changes.

This pattern is excellent for “where is it less windy?” It is a complement to the default overview, not necessarily the first screen. Rain chance, rain amount and an observation are different quantities and must never share an unlabeled lens.

### Tell me what changes

A short phrase identifies a change: fog until 2, rain arriving at 2, wind after 3, sunny through 4. This makes the map useful for scheduling. Production needs forecast-derived rules, confidence handling and a visible time window. The synthetic phrases here are authored examples; the app does not currently generate or verify them.

### Numbers first, detail on selection

Most labels become temperature-only. Selection supplies the name and detail. This is the quietest view and a good personal mode for someone who already knows the geography. It is the weakest first-visit default because it assumes a mental map. The named picker remains essential.

## Ten states shown on the same map

| State | What changes | What it tests |
| --- | --- | --- |
| Marine layer | Fog and wind west, warmer sun east | The microclimate contrast |
| Clear | Sun and warmer values citywide | Whether the design can remain quiet |
| Rain | Higher coastal rain chances; separate runoff concern at beaches | Weather priority and independent beach evidence |
| Wind | Stronger wind and gust text at exposed points | Secondary-line capacity and the wind lens |
| High UV | Larger modeled UV even with some cloud | Whether UV is discoverable outside beach UI |
| Night | Cooler values, moon icons, zero sample UV | Time-sensitive hierarchy |
| Partial | Two points lose wind and UV; one beach becomes unknown | Missing is not zero |
| Stale | Old values remain with a map-wide warning and age | A refresh failure without unexplained blanking |
| Loading | Place names remain, values wait | Layout stability |
| Error | Dashes, clear failure message and recovery control | Recovery in place |

All ten are deterministic fixtures. They do not call providers, animate a storm, or simulate meteorology. In the error state, **Try again** restores the baseline fixture to demonstrate the recovery interaction. Beach evidence remains independent of regional forecast loading or failure.

Night is a subdued version of the daytime surface. It is not a full dark-mode design. A true dark palette would need its own contrast and semantic-color review. The loading fixture is intentionally static so it can be inspected and captured.

## Beach conditions belong at the beach

The four beach coordinates are Ocean Beach, Baker Beach, Crissy Field and Aquatic Park. Their weather is not copied from the selected neighborhood. Clicking a beach opens water temperature, surf estimate, wind, water-quality evidence and tide. The selected weather point stays selected.

The baseline deliberately includes four different kinds of status: a strong-surf concern, shore-break caution, unknown water quality and no posted advisory. These words describe sample evidence states. **No posted advisory** is not a claim that swimming is safe. Small waves do not settle water quality, and a water sample does not settle surf or current conditions.

Three placement options are mocked: independent named beach points, symbols with names in the dock, or one suggested beach tied to the selection. I recommend independent points on desktop and symbols plus the list on mobile. The suggested-beach option saves space but hides alternatives and revives the coupling you explicitly wanted to avoid.

Before production, decide whether the top-level beach state is a concern summary or an activity recommendation. I recommend a concern summary with reason labels and separate evidence. A single numeric swim score would need a defensible rule, provenance, freshness and an unknown policy. A green swimmer cannot quietly imply “safe.”

The current data model has tide and water-temperature support, but the prototype’s surf and water-quality evidence are not connected to live sources. Availability, provider provenance and update timing are integration questions. There is no new scoring system or advisory feed in this branch.

## Twelve icon alternatives

| Meaning | Option A | Option B | Option C | Recommendation |
| --- | --- | --- | --- | --- |
| Swimming conditions | Swimmer | Beach flag | Waves | Swimmer plus a condition word and badge |
| UV index | Sun | Lettered UV | Shade umbrella | Lettered UV; sun is already used for sky |
| My location | Blue dot + ring | Crosshair | Heading arrow | Dot as marker, crosshair as action |
| Adjacent region | Frame-exit arrow | Compass | Chevron | Frame exit at city edges; chevron for nearby points |

The icon workshop shows every option on the full SF mock and at two specimen sizes. The separate SVG sheet gives you a common-size comparison. Each icon is an original SVG path with a consistent stroke; it is not an emoji or a raster image.

The beach badge changes both shape and content: concern uses a square with an exclamation mark; caution uses a diamond with an exclamation mark; unknown uses a question mark; the informational state uses an “i.” Text remains in the beach list and detail. Color reinforces those meanings rather than carrying them alone.

A flag can imply an official lifeguard signal. Waves can mean surf or tide rather than swimming. An umbrella can mean rain rather than UV. A compass says exploration but not destination. A directional location arrow implies that heading is known. These are semantic tradeoffs, not aesthetic defects to fix with a heavier stroke.

## Other decisions worth making now

### Coverage: ten points, six anchors, or fourteen points

The ten-point option matches the app today. It is the simplest integration, but leaves the south and southeast sparse. The six-anchor overview reduces clutter while preserving all ten locations through selection. The fourteen-point option adds proposed Noe Valley, Potrero Hill, Bayview and Excelsior coordinates and uses chips to expose the density tradeoff.

I recommend the existing ten for the first integration and a separate coverage decision immediately after. More named points do not automatically produce more independent weather information. Check source-grid resolution and actual forecast differences before presenting a fine-grained microclimate network. Do not draw temperature-colored polygons to conceal the gaps.

### Points, halos, or neighborhood outlines

Use forecast points by default. A soft halo is a selection aid only, not a measured weather radius. Dashed public neighborhood outlines can be context, but several names and shapes do not match the app: Sunset/Parkside is not an Inner / Outer split, and Market Street is not a corresponding public neighborhood polygon.

If you want entire regions to be clickable later, define the region system first: a navigation partition, a neighborhood convention, or a weather model. These are different promises. Do not borrow a planning map simply because it is available and then call each polygon a weather region.

### Selection dock, map bubble, or detail takeover

The mock uses a persistent right dock on desktop and a panel below the map on phones. This preserves comparison context. A map bubble is more spatially attached but covers nearby labels, especially near the northern beaches. A full detail takeover has the most room for charts but makes repeated region comparison slower.

I recommend the dock / below-map panel for the map’s quick detail, with a deliberate link to the existing full weather view in a later integration. The existing dashboard charts should not be squeezed into ten map labels. The mock beach detail is an inline panel, not a browser modal.

### Hour, day summary, or timeline

A shared requested hour gives the cleanest comparison. A daily high / low map would answer a different question and needs paired values plus a daily-maximum UV label. A timeline is useful for planning but multiplies loading, source and selection states. The prototype has a two-step citywide preview rather than a full scrubber.

I recommend one shared requested hour first, then a deliberate time-step control. The main app currently uses fixed PST according to its README. A move to America/Los_Angeles civil time would be a separate product and data decision; this mock intentionally uses relative fixture labels rather than dated observations.

### My location: recenter, select, or auto-follow

Recenter on request is the least surprising action. Selecting the nearest forecast point can be a second explicit action. Continuous following is a different mode and should show how to exit. Denial should leave the map usable and preserve a manually selected point. Unknown accuracy should not be drawn as a precise radius.

The prototype never requests location permission. **Locate · demo** toggles a simulated point near Inner Sunset. The ring and heading-arrow alternatives illustrate symbols; neither represents a real GPS accuracy or heading measurement. Production should not request location on page load.

### Color: map material, temperature field, or concern layer

The study reserves green for parks, pale blue for water, teal for selection, blue for the user, and warm / red / neutral states for beach evidence. Temperature remains a numeral. This avoids a park looking like a “good weather” area.

A temperature-colored continuous surface could be compelling, but it would require interpolation, a legend, uncertainty and a credible reason to color between points. A weather-code region fill is simpler but still assumes region boundaries. I rejected both as defaults for the existing data model. A future explicit lens can use color cautiously while retaining numbers and units.

## Rejected directions and why

The map-system matrix considered twelve candidates before developing four. Scores and rejection reasons are in [CHOICE_SET.json](CHOICE_SET.json). The rejected candidates are highway-only SF, every neighborhood boundary, a full street atlas, tourist pictograms everywhere, continuous temperature color, a radar-first map, a 3D terrain view and a transit-only skeleton.

Highway-only is a weak SF locator. A full street atlas buries weather. Every neighborhood boundary implies a geographic model the app does not have. Tourist pictograms inflate the icon vocabulary. Temperature fill implies data between points. Radar shifts the product toward precipitation alone. 3D makes label comparison harder and adds implementation cost. Transit-only is useful for some journeys but uneven as an all-weather city frame.

Rejected overlay directions include ten permanently expanded cards, hover-only weather, unlabeled weather icons and one enormous selected-region bubble. Each fails either map visibility, mobile use, name recognition or multi-region comparison. They are documented so we do not reopen them accidentally while combining the better parts.

## A first implementation that can be plucked cleanly

1. Port the chosen base-map materials and one orientation system. Keep the main app’s existing data adapters and location IDs. Use real road geometry if the street system is selected.
2. Add a map view alongside the current regional list, using the selected label layout and point semantics. Preserve a named list / picker as an alternative. Make selection open the existing full weather view through an explicit action.
3. Implement collision handling, keyboard selection, accessible reading order and responsive label reduction before adding more metrics. Test long names and all ten existing points.
4. Connect shared-hour forecast fields and per-field provenance. Keep missing, stale, loading and error semantics visible. Distinguish nearest-station observations from neighborhood forecasts.
5. Add independent beaches only for fields with a real source and explicit evidence policy. Unknown is a supported state. Add surf and water-quality integrations separately rather than inventing a composite score.
6. Add future coverage points, a time scrubber, richer beach evidence or a dark theme as separate decisions and commits. None is required to prove the first regional map.

The exploration is isolated under `public/sf-map-lab/`, plus this branch’s supporting documentation and reproducible scripts. The main app’s source and runtime behavior remain unchanged. No deployment, database write, remote branch push or permission request to the eventual app user is part of the mockup.

## Decisions to bring back

Pick a map system, a desktop label layout, a mobile label policy and a default information pattern. Pick each of the four icon meanings separately. Decide whether the first map keeps the existing ten points and whether beaches are independent named points or symbols plus a list. Say whether the selected-detail dock is the right model, and whether the shared-hour preview is enough for the first pass.

Useful disagreement is specific: “parks-first, but keep Market Street,” “ticket on desktop, chip on mobile,” “uniform wind but UV only when selected,” or “never collapse the beach names.” Keep multiple candidates if the phone and desktop views pull you in different directions. Exported notes are more useful than a forced single winner.

## Verification and limits

The deliverables are local, static HTML / CSS / JavaScript with local geometry and fonts. They work when opened directly from disk or served as `/sf-map-lab/` by the app’s existing Vite setup. The browser does not fetch weather, map tiles, GPS, external fonts or analytics. External source links are ordinary optional links.

This is an interaction and visual study. It does not implement live providers, geographic pan / zoom, interpolation, a production collision engine, real regional navigation beyond SF, GPS, advisory scoring, dark mode or generated forecast prose. The four proposed extra locations are not added to `src/config.ts`. Sample thresholds and gust calculations exist only to exercise display states.

See [QA.md](QA.md) for the exact checked behaviors, viewports, screenshots and remaining findings. Review the rendered maps before plucking implementation code; these fixtures are not a forecast library.
