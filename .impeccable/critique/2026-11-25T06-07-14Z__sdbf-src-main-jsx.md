---
target: sdbeach finder usability for mother deciding toddler water play and visit timing
total_score: 15
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/Users/ericwimsatt/git/weatherDash/sdbf/src/main.jsx"
target_fingerprint: "sha256:6b26ec4ef0852c3a9c850c45337404d52acdd6aefaa5ffce81f77cb0395ac1b0"
target_path: /Users/ericwimsatt/git/weatherDash/sdbf/src/main.jsx
timestamp: 2026-11-25T06-07-14Z
slug: sdbf-src-main-jsx
---
Method: dual-agent (A: /root/usability_review · B: /root/state_evidence)

The Beach Finder helps a parent spot an obvious closure, but does not reliably answer “Can my toddler play in the water, and when can we go?” It presents evidence and leaves the parent to turn it into a decision. This is a usability critique, not an aesthetic review or a determination that any beach is safe for a child.

Assessment scope: live desktop and 390×844 phone inspection on November 24, 2026, plus current local source and deterministic state probes. Local source contains existing uncommitted changes; rendered production observations and local source findings are distinguished below. No application code changed.

Observed states:

| State | What happened | Usability consequence |
|---|---|---|
| Oceanside, low risk | 1/10, Low risk, No current risk factors are showing, Low risk based on current evidence; both rain totals unavailable, bacteria 36 days old | Reassurance outweighs evidence limitations |
| La Jolla Shores, low risk | 2/10; bacteria 27 days old, 4 below the limit | Historical below-limit sample can read like current clearance |
| Cardiff, caution | 3/10, Sensitive groups should use caution; County Open; nearby advisory; Cannot estimate when it will be safe to swim | Parent must reconcile the apparent conflict and interpret caution |
| Coronado, caution | 4/10; elevated but below-advisory bacteria, repeated sensitive-group caution | Repetition does not provide a practical toddler decision |
| Moonlight, advisory | 7/10, Everyone should avoid water contact; no estimate for swimming; default runoff chart | Immediate action is clear; next step is missing |
| Border Field, closure | 10/10, County closure, nearby advisory, old below-limit test, unavailable rain, chart | Closure determines action; supporting details compete with it |

Five priority issues:

1. P1: Missing or old evidence can still produce confident reassurance. Oceanside is a rendered example. Local state probes also reproduced score 1 with missing bacteria, old below-limit bacteria, or missing rain when County statuses were current and clear. Put evidence limitations beside the main recommendation and distinguish no detected warning from current evidence coverage. A separate local probe found that Verified spill scores 10 but its cause is rewritten to Current water conditions could not be confirmed (src/evidence.js:92). Preserve specific confirmed hazards. Appropriate next work: harden and clarify.

2. P1: The main answer does not match the toddler question. Sensitive groups is undefined; use caution does not explain what changes about splashing or paddling. Safety score sounds broader than the water-quality signals assessed, and 10/10 can initially sound good. Use a plain water-contact recommendation, identify the relevant audience with vetted guidance, label the score as water-quality concern, and make surf/current coverage explicit. Do not add a blanket toddler-safe promise. Appropriate next work: clarify.

3. P1: When can we go often ends without a next step. Cannot estimate when it will be safe to swim is honest but incomplete. Explain what would change the recommendation: County notice lifted, newer evidence, or reduced rain-related concern. Link directly to a status check or another beach. Provide simple today/tomorrow/weekend planning summaries when supported. Source review found that current low-risk states short-circuit before the future-rain summary, while incomplete forecast coverage can produce the same negative 10-day wording as genuinely prolonged rain. Distinguish a forecast of continued concern from insufficient forecast data. Appropriate next work: harden and clarify.

4. P2: The default rainfall card frequently adds no decision value. It sits above routine bacteria/County evidence in clear and caution states; still appears for a direct closure with unavailable rain. It cannot answer when the County will reopen a beach. Collapse it into Rain outlook when it does not drive the recommendation. For rain-driven states, show a concise timing conclusion before the optional graph. The chart needs a comprehensible legend and textual equivalent; its accessible name alone conveys no data. Appropriate next work: distill.

5. P2: Finding a useful alternative takes too much work. On phone the map fills most of the first view; comparison is below it. A parent scans 15 beaches and opens details individually, with no date choice or quick lower-concern comparison. Offer map/list choice and a concise comparison of concern, reason, evidence freshness, and timing. Nearby options can help, but must not imply unmeasured toddler suitability. Appropriate next work: shape a task-focused comparison, preserving existing water-quality scope.

Content decisions:

| Existing content | Recommendation |
|---|---|
| Low risk + No current risk factors are showing + Low risk based on current evidence | Combine into one conclusion; spend remaining space on evidence limitations |
| Sensitive groups caution repeated in score and estimate | State once and explain the practical implication |
| Cannot estimate… without explanation or action | Keep honest uncertainty; add dependency and next action |
| Full runoff chart in clear/closure/missing-data states | Collapse unless it changes the planning decision |
| Rain totals repeated in contributing factors and evidence rows | State once by default |
| County posting and repeated County notice links | Combine into one authoritative status block |
| Nearby advisory when beach is already directly closed | Demote under supporting evidence |
| 4 below the limit / 914 below the limit | Replace by below/above advisory level plus sample age; retain exact values in evidence |
| Detailed penalty arithmetic, ddPCR thresholds, scoring percentages | Move mechanics to methodology; keep a short practical explanation in help |
| Modeled and observed water temperatures | Prefer relevant observed data with location/age; explain differences if both retained |
| Raw water level, river cfs, station IDs, nighttime next tide | Keep technical context optional; these do not answer the family visit question alone |
| Monitoring details and recent tests | Keep as optional transparency, not a required step for deciding |

The water-quality scope is appropriate to the product, but the task flow behaves like an evidence viewer rather than a family outing planner. Its strongest elements are explicit avoid-water-contact language, access to official County notices, hazard prioritization, and a native modal that closes and returns focus properly.

Cognitive load: the parent must interpret ten score levels, risk category, lab method/units, old versus current evidence, three rain concepts, nearby advisory effects, and official versus app status. Repeated copy does not reduce those decisions. Emotional journey: initial reassurance, doubt when stale or conflicting evidence appears, then a dead end at Cannot estimate.

Persona checks: distracted mother cannot translate caution into a toddler action; first-time visitor must learn that a higher safety score is worse and that Open can coexist with caution; planner cannot select tomorrow/weekend; screen-reader user can reach controls but cannot obtain the chart data from its generic accessible name.

Nielsen heuristic scoring, specific to this task:

| Heuristic | /4 | Main finding |
|---|---:|---|
| System status | 1 | Evidence freshness and failed refresh unclear |
| Match to real world | 1 | Toddler action and timing unanswered |
| User control | 3 | Close/focus works; no planning choice |
| Consistency | 2 | Official Open and app caution need reconciliation |
| Error prevention | 1 | Reassurance can outpace evidence |
| Recognition over recall | 2 | Unexplained categories/chart semantics |
| Efficiency | 1 | Manual beach-by-beach comparison |
| Minimal presentation | 1 | Repeated copy and unconditional chart |
| Error recovery | 1 | Silent fallback; no useful failure action |
| Help | 2 | Available, but too much scoring machinery |
| Total | 15/40 | Poor for the parent decision task |

Suggested default detail order: water-contact recommendation and evidence limitation; main reason and current County posting; when to reconsider and required confirmation; lower-concern alternatives; optional rain outlook and monitoring evidence. No forecast date should imply an official reopening or guaranteed child safety.

Detector result: 2 side-tab visual warnings at src/styles.css:89 and :104. These do not establish usability defects and do not drive the recommendations. Browser script mutation/injection unavailable under read-only evaluate; no overlay claimed. Offline/request failure, active regional advisory and rain-only future logic were source-reviewed, not experimentally rendered. No local server was started.

Questions for next work: prioritize (a) trustworthy current recommendation, (b) future visit planning, or (c) removing redundant content? Scope: (a) copy/disclosure cleanup, or (b) recommendation and planning behavior as well?
