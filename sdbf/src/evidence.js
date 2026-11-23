export const countyUrl = "https://www.sdbeachinfo.com/";

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

export function rainDisplay(site, inland = false) {
  const point = inland ? site.inlandRain : site.coastal;
  const gauge = inland ? site.inlandGaugeRain : site.rain;
  const station = gauge?.station ?? site.rainGauge;
  const number = value => `${value.toFixed(2)} in`;
  if (gauge?.complete && Number.isFinite(gauge.lowerBound) && (!point?.complete || gauge.lowerBound >= point.total)) {
    return { value:number(gauge.lowerBound), note:`${station} gauge` };
  }
  if (Number.isFinite(point?.total) && (gauge?.lowerBound ?? 0) <= point.total) {
    return { value:(point.complete ? "" : "≥") + number(point.total), note:point.complete ? "Grid estimate" : "Partial grid estimate" };
  }
  if (gauge?.lowerBound > 0) return { value:"≥"+number(gauge.lowerBound), note:`${station} gauge minimum` };
  return { value:"Unavailable", note:"Rain coverage incomplete" };
}

export function outfallText(site) {
  return site.outfall ? `${site.outfall.meters.toLocaleString("en-US")} m to outfall` : "Unverified";
}

export function postingText(site) {
  return { advisory:"Advisory", closure:"Closure", warning:"Warning", open:"Open", "rain advisory":"Rain advisory" }[site.posting?.status] ?? "Unverified";
}
