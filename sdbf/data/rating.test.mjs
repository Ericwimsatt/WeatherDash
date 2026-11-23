import test from "node:test";
import assert from "node:assert/strict";
import { assess, assessCoast, sampleEvidence } from "./rating.mjs";

const now = Date.parse("2026-11-22T20:00:00Z");
const before = hours => new Date(now - hours * 3600000).toISOString();
const baseline = {
  posting: { status: "open", verifiedAt: before(1) },
  sample: { parameter: "Enterococcus", method: "ddPCR", units: "Copies/100ml", qualifier: "=", value: 100, collectedAt: before(24) },
  rain: { complete: true, verifiedAt: before(1) },
  regionalRain: { advisory: "clear", complete: true, verifiedAt: before(1) },
  runoff: { clear: true, verifiedAt: before(1) },
};

test("official closures override a low result, even when the posting fetch has gone stale", () => {
  assert.equal(assess({ ...baseline, posting: { status: "closure", verifiedAt: before(48) } }, now).state, "avoid");
});
test("qualifying rain overrides a low result through the 72-hour boundary", () => {
  assert.equal(assess({ ...baseline, rain: { qualifying: true, endedAt: before(72) } }, now).state, "rain");
  assert.equal(assess({ ...baseline, rain: { ...baseline.rain, qualifying: true, endedAt: null } }, now).state, "rain");
});
test("stale evidence and coverage gaps each prevent a favorable rating", () => {
  for (const changes of [
    { sample: { ...baseline.sample, collectedAt: before(49) } },
    { posting: { ...baseline.posting, verifiedAt: before(13) } },
    { rain: { ...baseline.rain, complete: false } },
    { runoff: { ...baseline.runoff, clear: false } },
  ]) assert.equal(assess({ ...baseline, ...changes }, now).state, "unknown");
});
test("newer hazards require a follow-up sample", () => {
  assert.equal(assess({ ...baseline, runoff: { ...baseline.runoff, lastHazardEnded: before(3) } }, now).state, "unknown");
});
test("a favorable rating requires matching units and an unambiguous below-limit result", () => {
  assert.equal(assess(baseline, now).state, "recent");
  assert.equal(sampleEvidence({ ...baseline.sample, units: "MPN/100ml" }), null);
  assert.equal(sampleEvidence({ ...baseline.sample, qualifier: "<", value: 1413 }).below, true);
  assert.equal(sampleEvidence({ ...baseline.sample, qualifier: "<", value: 1500 }).below, false);
  assert.equal(sampleEvidence({ ...baseline.sample, value: 1413 }).above, true);
});

test("a countywide advisory applies everywhere while retaining independent local closures", () => {
  const sites = [{ ...baseline, id: 1 }, { ...baseline, id: 2, posting: { status: "closure" } }];
  const result = assessCoast(sites, { regionalRain: { advisory: "active", verifiedAt: before(48) } }, now);
  assert.equal(result.coastRainHold, "Countywide rain advisory");
  assert.deepEqual(result.results.map(item => [item.decision, item.water.state]), [["avoid", "rain"], ["avoid", "avoid"]]);
});

test("qualifying rain at one site applies the 72-hour hold to every site", () => {
  const sites = [{ ...baseline, id: 1 }, { ...baseline, id: 2, rain: { qualifying: true, endedAt: before(20) } }];
  const result = assessCoast(sites, { regionalRain: baseline.regionalRain }, now);
  assert.ok(result.coastRainHold);
  assert.deepEqual(result.results.map(item => item.water.state), ["rain", "rain"]);
  assert.deepEqual(result.candidates, []);
});

test("a high surf risk blocks swimming without altering water quality", () => {
  const sites = [{ ...baseline, id: 1 }];
  const surf = { ripCurrentRisk: "high", issuedAt: before(1), validUntil: before(-2) };
  const result = assessCoast(sites, { regionalRain: baseline.regionalRain, surf }, now);
  assert.equal(result.surfHold, "NWS high rip-current risk");
  assert.equal(result.results[0].water.state, "recent");
  assert.equal(result.results[0].decision, "avoid");
  assert.deepEqual(assessCoast(sites, { regionalRain: baseline.regionalRain, surf: { ...surf, ripCurrentRisk: "low" } }, now).candidates, [1]);
  assert.deepEqual(assessCoast(sites, { regionalRain: baseline.regionalRain, surf: { ...surf, validUntil: before(1) } }, now).candidates, []);
});
