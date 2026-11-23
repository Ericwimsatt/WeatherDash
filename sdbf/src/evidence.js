export const countyUrl = "https://www.sdbeachinfo.com/";
export const labels = { avoid: "Avoid water contact", rain: "Avoid after rain", unknown: "Insufficient data", recent: "Recent test below limit" };

const pacific = new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  timeZone: "America/Los_Angeles",
});

export function date(timestamp) {
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) ? pacific.format(parsed) : "Unavailable";
}

export function age(timestamp, now) {
  const hours = Math.floor((now - Date.parse(timestamp)) / 3600000);
  if (!Number.isFinite(hours) || hours < 0) return "Collection time unavailable";
  return hours < 24 ? `${hours}h old` : `${Math.floor(hours / 24)}d old`;
}

export function reading(sample) {
  if (!sample) return "Unavailable";
  const qualifier = sample.qualifier && sample.qualifier !== "=" ? sample.qualifier : "";
  return qualifier + sample.value.toLocaleString("en-US");
}

export function rainText(site) {
  const amount = site.rain?.lowerBound;
  if (site.rain?.complete && Number.isFinite(amount)) return `${amount.toFixed(2)} in`;
  return amount > 0 ? `≥${amount.toFixed(2)} in` : "Unverified";
}

export function coverage(site) {
  return site.rain?.complete ? "Observed gauge intervals" : "Gaps in gauge observations";
}

export function outfallText(site) {
  return site.outfall ? `${site.outfall.meters.toLocaleString("en-US")} m to outfall` : "Unverified";
}

export function postingText(site) {
  return { advisory:"Advisory", closure:"Closure", warning:"Warning", open:"Open", "rain advisory":"Rain advisory" }[site.posting?.status] ?? "Unverified";
}
