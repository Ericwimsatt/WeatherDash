export const hour = 3600000;
export const rainPeriods = { local:72, inland:96 };
export const rainLimits = { local:.2, inland:.75 };

const milesInland = 3;
const milesPerLongitudeDegreeAtEquator = 69.17;
// Inland rain is shared along the coast with a smooth distance falloff, not a
// hard cutoff: a heavy reading inland of Moonlight should still register at
// La Jolla Shores (~13.5 mi south) and Oceanside (~11 mi north). Runoff can be
// dangerous, so sharing errs high. Weight halves near ~11.6 mi and is treated
// as zero beyond twice the scale (~28 mi), past the far South Bay.
const inlandShareScale = 14;
const inlandKeyPrefix = "inland:3mi:";

export const pointIds = site => [`local:${site.id}`, `${inlandKeyPrefix}${site.id}`];

export function pointLocations(sites) {
  return sites.flatMap(site => {
    const [local, inland] = pointIds(site);
    const milesPerDegree = milesPerLongitudeDegreeAtEquator * Math.cos(site.lat * Math.PI / 180);
    return [
      { id:local, name:`${site.name} coast`, lat:site.lat, lon:site.lon },
      { id:inland, name:`3 mi inland of ${site.name}`, lat:site.lat, lon:site.lon + milesInland / milesPerDegree },
    ];
  });
}

export function pointTotal(point, from, through) {
  const start = Math.floor(from/hour)*hour;
  const end = Math.floor(through/hour)*hour;
  const expected = (end-start)/hour;
  const offset = Math.round((start-point?.start)/hour);
  if (expected <= 0 || !Number.isFinite(offset)) return { total:null, complete:false, hours:0 };
  let total = 0, hours = 0, endedAt;
  for (let i=1; i<=expected; i++) {
    const value = point.values[offset+i];
    if (!Number.isFinite(value) || value < 0) continue;
    hours++;
    total += value;
    if (value > 0) endedAt = new Date(start+i*hour).toISOString();
  }
  return { total:hours ? Number(total.toFixed(3)) : null, complete:hours===expected, hours, endedAt };
}

// Replace matching past hours with NWS observations. Retain modeled estimates
// where the gauge has gaps; sparse history must not erase the entire series.
// Keep forecast hours untouched.
export function withObservedRain(point, rows, now) {
  if (!point || !Array.isArray(rows)) return point;
  const lat = Math.round(point.lat * 1e6), lon = Math.round(point.lon * 1e6);
  const historyStart = now - 8 * 24 * hour;
  const pointRows = rows.filter(row => {
    const end = Date.parse(row.rainfall_end_pst);
    return row.latitude_e6 === lat && row.longitude_e6 === lon && row.data_kind === "observation" &&
      Number.isFinite(end) && end >= historyStart && end <= now;
  });
  if (!pointRows.length) return point;
  const values = [...point.values];
  let changed = false;
  const observed = new Set();
  for (const row of pointRows) {
    const start = Date.parse(row.rainfall_start_pst), end = Date.parse(row.rainfall_end_pst);
    if (row.latitude_e6 !== lat || row.longitude_e6 !== lon || row.data_kind !== "observation" ||
        !Number.isFinite(start) || !Number.isFinite(end) || end > now || end - start !== hour ||
        !Number.isFinite(row.rainfall_in) || row.rainfall_in < 0) continue;
    const index = Math.round((Date.parse(row.hour_pst) - point.start) / hour) + 1;
    if (!Number.isInteger(index) || index < 0 || index >= values.length || observed.has(index)) continue;
    values[index] = row.rainfall_in;
    observed.add(index);
    changed = true;
  }
  return changed ? { ...point, values } : point;
}

function inlandEstimate(site, points, key, now) {
  const own = points?.[key];
  const center = own ?? pointLocations([site])[1];
  const longitudeScale = milesPerLongitudeDegreeAtEquator * Math.cos(center.lat * Math.PI / 180);
  const sources = [];
  for (const [id,point] of Object.entries(points ?? {})) {
    if (!id.startsWith(inlandKeyPrefix)) continue;
    const checked = Date.parse(point.verifiedAt);
    if (now < checked || now - checked > 3*hour) continue;
    const distance = id === key ? 0 : Math.hypot(
      (point.lat-center.lat)*milesPerLongitudeDegreeAtEquator,
      (point.lon-center.lon)*longitudeScale,
    );
    if (distance >= 2*inlandShareScale) continue;
    sources.push({point, distance, checked, weight:Math.exp(-((distance/inlandShareScale)**2))});
  }
  if (!sources.some(source => source.point !== own)) return own;
  sources.sort((a,b) => a.distance-b.distance);
  const start = Math.min(...sources.map(({point}) => point.start));
  const end = Math.max(...sources.map(({point}) => point.start+(point.values.length-1)*hour));
  const checked = Math.max(...sources.map(source => source.checked));

  const values = Array.from({length:(end-start)/hour+1},(_,index) => {
    const time = start+index*hour;
    let nearest = null;
    let estimate = null;
    for (const source of sources) {
      // Hours from an older forecast cannot become rainfall observations.
      if (time <= now && time > source.checked) continue;
      const rain = source.point.values[(time-source.point.start)/hour];
      if (!Number.isFinite(rain) || rain < 0) continue;
      nearest ??= rain;
      estimate = Math.max(estimate ?? nearest,nearest + source.weight*(rain-nearest));
    }
    return estimate;
  });
  return {...center,start,values,verifiedAt:new Date(checked).toISOString()};
}

export function withPointRain(site, points, now, rainHistory=[]) {
  const [localKey,inlandKey] = pointIds(site);
  const local = points?.[localKey];
  const inland = inlandEstimate(site,points,inlandKey,now);
  const summarize = (point, hours) => {
    if (!point) return null;
    const checked = Date.parse(point.verifiedAt);
    const cutoff = Math.min(now,checked);
    const summary = pointTotal(point,now-hours*hour,cutoff);
    return {
      ...summary, complete:summary.complete && summary.hours===hours,
      verifiedAt:point.verifiedAt, name:point.name, lat:point.lat, lon:point.lon,
    };
  };
  const coastalPoint = withObservedRain(local, rainHistory, now);
  const inlandPoint = withObservedRain(inland, rainHistory, now);
  const coastal = summarize(coastalPoint,rainPeriods.local);
  if (coastal?.total >= rainLimits.local) {
    // Qualifying rain must fall in one rolling 24-hour period.
    const cutoff = Math.min(now,Date.parse(local.verifiedAt));
    for (let end=cutoff; end>now-rainPeriods.local*hour; end-=hour) {
      if (pointTotal(coastalPoint,Math.max(now-rainPeriods.local*hour,end-24*hour),end).total >= rainLimits.local) {
        coastal.qualifying = true;
        break;
      }
    }
  }
  return { ...site, coastal, inlandRain:summarize(inlandPoint,rainPeriods.inland), localPoint:coastalPoint, inlandPoint };
}
