import sites from "../data/sites.json" with { type:"json" };
import { hour,pointLocations } from "../data/point-rain.mjs";
import { json } from "./water.mjs";

const locations = pointLocations(sites);

export async function loadPointRain(now) {
  const query = new URLSearchParams({
    latitude:locations.map(point => point.lat).join(","),
    longitude:locations.map(point => point.lon).join(","),
    past_days:"7", forecast_days:"3", hourly:"precipitation", precipitation_unit:"inch",
    timeformat:"unixtime", timezone:"GMT", cell_selection:"land",
  });
  const data = await json(`https://api.open-meteo.com/v1/forecast?${query}`);
  if (!Array.isArray(data) || data.length !== locations.length) throw Error("Point rainfall did not return all requested locations");
  const verifiedAt = new Date(now).toISOString();
  const pairs = data.flatMap((item,index) => {
    const time = item.hourly?.time;
    const rainfall = item.hourly?.precipitation;
    if (item.hourly_units?.precipitation !== "inch" || !Array.isArray(time) || !Array.isArray(rainfall) ||
        rainfall.length < 100 || rainfall.length !== time.length ||
        !time.every((t,i) => Number.isFinite(t) && (i===0 || (t-time[i-1])*1000===hour))) return [];
    const { id,...point } = locations[index];
    const values = rainfall.map(value => Number.isFinite(value) && value >= 0 ? value : null);
    if (!values.some(Number.isFinite)) return [];
    return [[id, { ...point, gridLat:item.latitude, gridLon:item.longitude, start:time[0]*1000, verifiedAt, values }]];
  });
  if (!pairs.length) throw Error("Point rainfall contained no usable series");
  return Object.fromEntries(pairs);
}
