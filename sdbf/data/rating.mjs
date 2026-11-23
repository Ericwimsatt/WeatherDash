const hour = 60 * 60 * 1000;
const restrictions = new Set(["closure", "warning", "advisory", "rain advisory"]);

function fresh(timestamp, now, hours) {
  const age = now - Date.parse(timestamp);
  return age >= 0 && age <= hours * hour;
}

export function sampleEvidence(sample) {
  if (sample?.parameter !== "Enterococcus" || !Number.isFinite(sample.value) || sample.value < 0)
    return null;

  const method = String(sample.method ?? "").toLowerCase();
  const units = String(sample.units ?? "").toLowerCase().replace(/\s/g, "");
  const threshold = method === "ddpcr" && units === "copies/100ml" ? 1413
    : ((method === "mf" && units === "cfu/100ml") ||
      (["mtf", "mpn", "enterolert"].includes(method) && units === "mpn/100ml")) ? 104
    : null;
  if (threshold === null) return null;

  const above = ["=", ">", ">="].includes(sample.qualifier) && sample.value >= threshold;
  const below = sample.qualifier === "<" && sample.value <= threshold ||
    ["=", "<="].includes(sample.qualifier) && sample.value < threshold;
  return { threshold, above, below, difference: sample.qualifier === "=" ? sample.value - threshold : null };
}

export function assess({ posting, sample, rain, runoff }, now = Date.now()) {
  const result = sampleEvidence(sample);
  if (restrictions.has(posting?.status)) {
    return { state: "avoid", reason: `County ${posting.status}` };
  }
  if (runoff?.hazard) return { state: "avoid", reason: runoff.hazard };
  if (result?.above) return { state: "avoid", reason: "Latest test at or above limit" };
  if (rain?.stormActive || (rain?.qualifying && fresh(rain.endedAt, now, 72)))
    return { state: "rain", reason: "Rain within the 72-hour window" };
  if (rain?.qualifying && (!Number.isFinite(Date.parse(rain.endedAt)) || Date.parse(rain.endedAt) > now))
    return { state: "rain", reason: "Qualifying rain with unverified end time" };

  if (posting?.status !== "open" || !fresh(posting.verifiedAt, now, 12))
    return { state: "unknown", reason: "Current County status unverified" };
  if (!rain?.complete || !fresh(rain.verifiedAt, now, 3))
    return { state: "unknown", reason: "Incomplete rain observations" };
  if (!runoff?.clear || !fresh(runoff.verifiedAt, now, 12))
    return { state: "unknown", reason: "Runoff status unverified" };
  if (!result?.below || !fresh(sample.collectedAt, now, 48))
    return { state: "unknown", reason: "No comparable sample in the last 48 hours" };
  const hazardEnded = [posting.lastHazardEnded, rain.qualifying ? rain.endedAt : null, runoff.lastHazardEnded]
    .filter(Boolean);
  if (hazardEnded.some(end => !Number.isFinite(Date.parse(end)) || Date.parse(end) >= Date.parse(sample.collectedAt)))
    return { state: "unknown", reason: "No comparable sample after the latest hazard" };

  return { state: "recent", reason: "Recent test below limit" };
}
