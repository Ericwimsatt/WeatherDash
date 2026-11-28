import { SF_MAP_LOCATIONS } from "../config.ts";
import type { Location } from "../config.ts";
import type { Bundle } from "../../shared/model.ts";
import { weatherDay, uvDay, extrema } from "./selectors.ts";

export const MAP_LOCATIONS: Location[] = SF_MAP_LOCATIONS;
export const MAP_BOUNDS = { west: -122.522, east: -122.351, north: 37.820, south: 37.7091666667 };
export type Coordinates = { lat: number; lon: number };
export type MapReading = { high: number | null; low: number | null; uv: number | null; rain: number | null; wind: number | null; partialRain: boolean };
export const projectMap = ({ lon, lat }: Coordinates) => ({
  x: (lon - MAP_BOUNDS.west) / (MAP_BOUNDS.east - MAP_BOUNDS.west) * 1000,
  y: (MAP_BOUNDS.north - lat) / (MAP_BOUNDS.north - MAP_BOUNDS.south) * 875,
});
export function isInMap(p: Coordinates) {
  return p.lat <= MAP_BOUNDS.north && p.lat >= MAP_BOUNDS.south && p.lon >= MAP_BOUNDS.west && p.lon <= MAP_BOUNDS.east;
}
const distance = (a: Coordinates, b: Coordinates) => (a.lat - b.lat) ** 2 + ((a.lon - b.lon) * Math.cos(a.lat * Math.PI / 180)) ** 2;
export function nearestMapLocation(p: Coordinates) {
  return MAP_LOCATIONS.reduce((best, l) => distance(p, l) < distance(p, best) ? l : best);
}
// Always reserve the first slot for the closest sample, then spread labels across SF.
// This selects display density only; every sample continues to inform the field.
export function selectMapLocations(user: Coordinates | null, count = 15) {
  const seed = user && isInMap(user) ? nearestMapLocation(user) : MAP_LOCATIONS.find(l => l.id === "marketStreet")!;
  const chosen = [seed];
  while (chosen.length < Math.min(count, MAP_LOCATIONS.length)) {
    const next = MAP_LOCATIONS.filter(l => !chosen.includes(l)).reduce((best, l) => {
      const spacing = (p: Location) => Math.min(...chosen.map(c => distance(p, c)));
      return spacing(l) > spacing(best) ? l : best;
    });
    chosen.push(next);
  }
  return chosen;
}
export function summarizeMapWeather(bundle: Bundle, date: string): MapReading {
  const rows = weatherDay(bundle, date), temperatures = extrema(rows.map(r => r.temperature_f));
  const uv = extrema(uvDay(bundle, date).map(r => r.uv_index));
  const wind = extrema(rows.map(r => r.wind_speed_mph));
  const rain = rows.filter(r => r.rainfall_in != null);
  return {
    high: temperatures?.max ?? null, low: temperatures?.min ?? null,
    uv: uv?.max ?? null, wind: wind?.max ?? null,
    rain: rain.length ? rain.reduce((sum, r) => sum + r.rainfall_in!, 0) : null,
    partialRain: rain.length < rows.length,
  };
}
export type FieldSample = Coordinates & { high: number };
export function fieldScale(samples: FieldSample[]) {
  if (!samples.length) return { min: 50, max: 75 };
  const min = Math.floor(Math.min(...samples.map(p => p.high)) / 5) * 5;
  return { min, max: Math.max(min + 10, Math.ceil(Math.max(...samples.map(p => p.high)) / 5) * 5) };
}
export function interpolateHigh(samples: FieldSample[], x: number, y: number) {
  if (!samples.length) return null;
  let sum = 0, weights = 0;
  for (const sample of samples) {
    const p = projectMap(sample);
    const weight = 1 / ((x - p.x) ** 2 + (y - p.y) ** 2 + 1600) ** 1.2;
    sum += sample.high * weight; weights += weight;
  }
  return sum / weights;
}
export function fieldColor(high: number, scale: { min: number; max: number }) {
  const t = Math.max(0, Math.min(1, (high - scale.min) / (scale.max - scale.min)));
  const cool = [156, 191, 224], mid = [246, 239, 228], warm = [231, 164, 151];
  const a = t < .5 ? cool : mid, b = t < .5 ? mid : warm, f = t < .5 ? t * 2 : (t - .5) * 2;
  return a.map((v, i) => Math.round(v * (1 - f) + b[i] * f));
}
