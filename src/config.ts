export type Location = {
  id: string;
  name: string;
  short?: string;
  lat: number;
  lon: number;
  group?: string;
};
export const LOCATIONS: Location[] = [
  {
    id: "innerRichmond",
    name: "Inner Richmond",
    short: "In.Rich",
    lat: 37.7811,
    lon: -122.4635,
    group: "San Francisco",
  },
  {
    id: "outerRichmond",
    name: "Outer Richmond",
    short: "Out.Rich",
    lat: 37.7761,
    lon: -122.4895,
    group: "San Francisco",
  },
  {
    id: "innerSunset",
    name: "Inner Sunset",
    short: "In.Sunset",
    lat: 37.7626,
    lon: -122.4684,
    group: "San Francisco",
  },
  {
    id: "outerSunset",
    name: "Outer Sunset",
    short: "Out.Sunset",
    lat: 37.7626,
    lon: -122.4945,
    group: "San Francisco",
  },
  {
    id: "marketStreet",
    name: "Market Street",
    short: "Market",
    lat: 37.7749,
    lon: -122.4194,
    group: "San Francisco",
  },
  {
    id: "pacHeights",
    name: "Pacific Heights",
    short: "Pac.Hts",
    lat: 37.7914,
    lon: -122.4362,
    group: "San Francisco",
  },
  {
    id: "marina",
    name: "Marina",
    short: "Marina",
    lat: 37.8027,
    lon: -122.4348,
    group: "San Francisco",
  },
  {
    id: "mission",
    name: "Mission",
    short: "Mission",
    lat: 37.7599,
    lon: -122.4148,
    group: "San Francisco",
  },
  {
    id: "northBeach",
    name: "North Beach",
    short: "N.Beach",
    lat: 37.8005,
    lon: -122.4103,
    group: "San Francisco",
  },
  {
    id: "lakeMerced",
    name: "Lake Merced (TPC Harding)",
    short: "Lk.Merced",
    lat: 37.7235,
    lon: -122.492,
    group: "San Francisco",
  },
  {
    id: "millValley",
    name: "Mill Valley",
    short: "Mill Vly",
    lat: 37.906,
    lon: -122.545,
    group: "Marin",
  },
  {
    id: "mtTam",
    name: "Mt. Tamalpais",
    short: "Mt.Tam",
    lat: 37.9235,
    lon: -122.5965,
    group: "Marin",
  },
  {
    id: "pointReyes",
    name: "Point Reyes",
    short: "Pt.Reyes",
    lat: 38.042,
    lon: -122.809,
    group: "Marin",
  },
  {
    id: "bolinas",
    name: "Bolinas",
    short: "Bolinas",
    lat: 37.906,
    lon: -122.684,
    group: "Marin",
  },
  {
    id: "pacifica",
    name: "Pacifica",
    short: "Pacifica",
    lat: 37.6138,
    lon: -122.4869,
    group: "Peninsula",
  },
  {
    id: "oakland",
    name: "Oakland",
    short: "Oakland",
    lat: 37.8044,
    lon: -122.2712,
    group: "East Bay",
  },
  {
    id: "berkeley",
    name: "Berkeley",
    short: "Berkeley",
    lat: 37.8716,
    lon: -122.2727,
    group: "East Bay",
  },
  {
    id: "encinitas",
    name: "Encinitas",
    short: "Encinitas",
    lat: 33.037,
    lon: -117.2924,
    group: "San Diego",
  },
];
export const SWIM_SPOTS: Record<string, Location> = Object.fromEntries(
  Object.entries({
    innerRichmond: { name: "Baker Beach", lat: 37.7946, lon: -122.4829 },
    outerRichmond: { name: "Baker Beach", lat: 37.7946, lon: -122.4829 },
    innerSunset: { name: "Ocean Beach", lat: 37.7597, lon: -122.5108 },
    outerSunset: { name: "Ocean Beach", lat: 37.7597, lon: -122.5108 },
    marketStreet: { name: "Aquatic Park", lat: 37.806, lon: -122.422 },
    pacHeights: { name: "Crissy Field", lat: 37.8025, lon: -122.448 },
    marina: { name: "Chrissy Field East Beach", lat: 37.8025, lon: -122.448 },
    mission: { name: "Aquatic Park", lat: 37.806, lon: -122.422 },
    northBeach: { name: "Aquatic Park", lat: 37.806, lon: -122.422 },
    lakeMerced: { name: "Ocean Beach (South)", lat: 37.732, lon: -122.501 },
    millValley: { name: "Stinson Beach", lat: 37.899, lon: -122.6463 },
    mtTam: { name: "Stinson Beach", lat: 37.899, lon: -122.6463 },
    pointReyes: { name: "Drakes Beach", lat: 37.995, lon: -122.96 },
    bolinas: { name: "Bolinas Beach", lat: 37.899, lon: -122.685 },
    pacifica: { name: "Linda Mar Beach", lat: 37.594, lon: -122.501 },
    oakland: { name: "Berkeley Marina", lat: 37.865, lon: -122.311 },
    berkeley: { name: "Berkeley Marina", lat: 37.865, lon: -122.311 },
    encinitas: { name: "Moonlight Beach", lat: 33.0487, lon: -117.2987 },
  }).map(([id, spot]) => [id, { ...spot, id: `swim-${id}` }]),
);

export const INLAND: Location = {
  id: "vallejo",
  name: "Vallejo",
  lat: 38.1041,
  lon: -122.2567,
};
export const coordKey = (l: Pick<Location, "lat" | "lon">) =>
  `${Math.round(l.lat * 1e6)},${Math.round(l.lon * 1e6)}`;
export const ALL_LOCATIONS = [
  ...new Map(
    [...LOCATIONS, ...Object.values(SWIM_SPOTS), INLAND].map((l) => [
      coordKey(l),
      l,
    ]),
  ).values(),
];
// Station observations represent the named station, not a neighborhood sensor.
export const STATIONS: Record<
  string,
  { name: string; lat: number; lon: number }
> = {
  KSFO: { name: "San Francisco airport", lat: 37.619, lon: -122.375 },
  KDVO: { name: "Novato / Gnoss Field", lat: 38.1436, lon: -122.556 },
  KOAK: { name: "Oakland airport", lat: 37.7213, lon: -122.2207 },
  KHAF: { name: "Half Moon Bay airport", lat: 37.5134, lon: -122.501 },
  KCRQ: { name: "Carlsbad / Palomar airport", lat: 33.1283, lon: -117.28 },
  KAPC: { name: "Napa airport", lat: 38.2075, lon: -122.2808 },
};
export function stationFor(l: Location) {
  if (l.lat < 34) return "KCRQ";
  if (l.id === "vallejo") return "KAPC";
  if (l.lon > -122.35) return "KOAK";
  if (l.lat > 37.85) return "KDVO";
  if (l.lat < 37.65) return "KHAF";
  return "KSFO";
}
export function tideStation(l: Location) {
  return l.lat < 34 ? "9410230" : "9414290";
}
export const NOAA_STATIONS: Record<
  string,
  { name: string; lat: number; lon: number }
> = {
  "9414290": { name: "San Francisco", lat: 37.8063, lon: -122.4659 },
  "9410230": { name: "La Jolla", lat: 32.8669, lon: -117.2571 },
};
