import sites from "../data/sites.json" with { type:"json" };
import { inlandGaugeFor } from "../data/point-rain.mjs";
const hour = 3600000;
const gauges = [...new Set(sites.map(site => site.rainGauge))];
const allRainGauges = [...new Set([...gauges,...sites.map(inlandGaugeFor).filter(Boolean)])];

export async function json(url) {
  const response = await fetch(url, {
    headers: { "User-Agent":"San Diego Beach Finder (sdbeachfinder.gingernet.net)", Accept:"application/json" },
    signal:AbortSignal.timeout(9000),
  });
  if (!response.ok) throw Error(`Upstream ${new URL(url).hostname}: ${response.status}`);
  return response.json();
}

export function checkedRain(features, now) {
  const measurements = new Map();
  for (const {properties:p} of features) {
    const time = Date.parse(p?.timestamp);
    if (!Number.isFinite(time) || time > now) continue;
    for (const [length, field] of [[1,"precipitationLastHour"],[3,"precipitationLast3Hours"],[6,"precipitationLast6Hours"]]) {
      const q = p[field];
      if (!Number.isFinite(q?.value) || q.value < 0 || q.unitCode !== "wmoUnit:mm" || ["X","Q","B","Z"].includes(q.qualityControl)) continue;
      const end = new Date(time).toISOString();
      measurements.set(`${end}:${length}`, { start:new Date(time-length*hour).toISOString(), end, hours:length, inches:q.value/25.4 });
    }
  }
  return [...measurements.values()];
}

function nonoverlapping(intervals) {
  const weighted = [0];
  for (const [i, item] of intervals.entries()) {
    let earlier = i - 1;
    while (earlier >= 0 && intervals[earlier].end > item.start) earlier--;
    weighted.push(Math.max(weighted[i], weighted[earlier+1] + item.inches));
  }
  return weighted.at(-1);
}

export function summarizeRain(intervals, verifiedAt, now=Date.now(), hours=72) {
  const start = now - hours*hour;
  const recent = intervals.filter(interval => Date.parse(interval.end) <= now && Date.parse(interval.end) > start);
  const ordered = recent.filter(interval => Date.parse(interval.start) >= start).sort((a,b) => a.end.localeCompare(b.end));
  let covered = start;
  for (const interval of [...recent].sort((a,b) => a.start.localeCompare(b.start))) {
    if (Date.parse(interval.start) > covered + 60000) break;
    covered = Math.max(covered, Date.parse(interval.end));
  }
  const wet = recent.filter(interval => interval.inches > 0).sort((a,b) => a.end.localeCompare(b.end));
  const qualifyingWet = wet.filter(interval => interval.inches >= .2);
  for (const interval of ordered) {
    if (interval.inches <= 0) continue;
    const until = Date.parse(interval.end);
    const window = ordered.filter(item => Date.parse(item.start) >= until-24*hour && Date.parse(item.end) <= until);
    if (nonoverlapping(window) >= .2) qualifyingWet.push(interval);
  }
  const lastRain = wet.at(-1);
  return {
    lowerBound:ordered.length ? Number(nonoverlapping(ordered).toFixed(4)) : null,
    complete:covered >= now - hour,
    endedAt:lastRain?.end,
    qualifying:qualifyingWet.length > 0,
    verifiedAt,
  };
}

async function readGauge(gauge, now) {
  const endpoint = `https://api.weather.gov/stations/${gauge}/observations`;
  const params = new URLSearchParams({ start:new Date(now-5*24*hour).toISOString(), end:new Date(now).toISOString(), limit:"500" });
  const records = [];
  let pageURL = endpoint+"?"+params;
  for (let page=0; page<4 && pageURL?.startsWith(endpoint+"?"); page++) {
    let body;
    try { body = await json(pageURL); }
    catch (error) { if (!records.length) throw error; break; }
    if (!Array.isArray(body.features) || !body.features.length) break;
    records.push(...body.features);
    pageURL = body.pagination?.next;
  }
  if (!records.length) throw Error("NWS station returned no observations");
  return checkedRain(records,now);
}

export async function loadRain(now) {
  const results = await Promise.allSettled(allRainGauges.map(gauge => readGauge(gauge, now)));
  const ready = Object.fromEntries(results.flatMap((result,index) => result.status === "fulfilled" ? [[allRainGauges[index],result.value]] : []));
  if (!Object.keys(ready).length) throw Error("No NWS gauge returned observations");
  return ready;
}

const coastStations = [["9410230","La Jolla"],["9410170","San Diego Bay"]];
async function noaa(station, name, now, product) {
  const params = new URLSearchParams({ product, application:"SDBeachFinder", station, time_zone:"gmt", units:"english", format:"json" });
  if (product === "predictions") {
    params.set("interval","hilo");
    params.set("datum","MLLW");
    const date = ms => new Date(ms).toISOString().slice(0,10).replaceAll("-","");
    params.set("begin_date", date(now));
    params.set("end_date", date(now + 2*24*hour));
  } else {
    params.set("date","latest");
    if (product === "water_level") params.set("datum","MLLW");
  }
  const data = await json(`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?${params}`);
  const at = text => new Date(text.replace(" ","T") + "Z").toISOString();
  if (product === "predictions") {
    const items = (data.predictions ?? []).filter(item => Number.isFinite(Number(item.v)))
      .map(item => ({ height:Number(item.v), type:item.type, at:at(item.t), station:name }));
    return items.find(item => Date.parse(item.at) > now);
  }
  const item = data.data?.at(-1);
  if (item?.v && Number.isFinite(Number(item.v))) {
    return { [product === "water_level" ? "height" : "temperature"]:Number(item.v), observedAt:at(item.t), station:name };
  }
}

async function flow() {
  const data = await json("https://waterservices.usgs.gov/nwis/iv/?format=json&sites=11023000&parameterCd=00060&period=P1D");
  const values = data.value?.timeSeries?.[0]?.values?.[0]?.value;
  const item = values?.at(-1);
  if (item && Number(item.value) >= 0) return { cfs:Number(item.value), observedAt:item.dateTime, station:"San Diego River at Fashion Valley" };
}

export async function loadContext(now) {
  const coordinates = [[33.18,-117.38],[33.10,-117.32],[32.93,-117.25],[32.76,-117.25],[32.57,-117.13]];
  const meteo = new URLSearchParams({ latitude:coordinates.map(x => x[0]).join(","), longitude:coordinates.map(x => x[1]).join(","),
    current:"temperature_2m,wind_speed_10m", daily:"sunrise,sunset", timezone:"America/Los_Angeles", temperature_unit:"fahrenheit", wind_speed_unit:"mph", forecast_days:"1", timeformat:"unixtime" });
  const marine = new URLSearchParams({ latitude:coordinates.map(x => x[0]).join(","), longitude:"-117.40,-117.34,-117.30,-117.29,-117.19", hourly:"sea_surface_temperature", temperature_unit:"fahrenheit", forecast_days:"1", timeformat:"unixtime" });
  const results = await Promise.allSettled([
    json(`https://api.open-meteo.com/v1/forecast?${meteo}`),
    ...coastStations.flatMap(([station,name]) => ["water_temperature","predictions","water_level"].map(product => noaa(station,name,now,product))),
    flow(), json(`https://marine-api.open-meteo.com/v1/marine?${marine}`),
  ]);
  const values = results.map(result => result.status === "fulfilled" ? result.value : undefined);
  const [model,northWater,northTide,northLevel,southWater,southTide,southLevel,river,ocean] = values;
  if (!values.some(Boolean)) throw Error("No environmental context sources returned data");
  return Object.fromEntries(gauges.map((gauge,index) => {
    const current = model?.[index]?.current;
    const daily = model?.[index]?.daily;
    const marineHourly = ocean?.[index]?.hourly;
    const sample = marineHourly?.time?.findLastIndex(time => time*1000 <= now) ?? -1;
    const timestamp = value => Number.isFinite(value) ? new Date(value*1000).toISOString() : undefined;
    const temperature = marineHourly?.sea_surface_temperature?.[sample];
    const south = gauge === "KNRS";
    return [gauge, {
      air:current?.temperature_2m, wind:current?.wind_speed_10m, airAt:timestamp(current?.time),
      sunrise:timestamp(daily?.sunrise?.[0]), sunset:timestamp(daily?.sunset?.[0]),
      sea:Number.isFinite(temperature) ? {temperature,at:timestamp(marineHourly.time[sample])} : undefined,
      water:south ? southWater : northWater, tide:south ? southTide : northTide, level:south ? southLevel : northLevel,
      river:gauge === "KSAN" ? river : undefined,
    }];
  }));
}
