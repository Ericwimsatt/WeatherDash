import { z } from "zod";
import { validPst, validDate } from "./time.ts";
export const timeSchema = z
  .string()
  .refine(validPst, "Expected fixed PST timestamp");
export const dateSchema = z.string().refine(validDate, "Expected valid date");
const hourSchema = timeSchema.refine(
  (s) => s.slice(14, 19) === "00:00",
  "Expected hour boundary",
);
const coordinates = {
  latitude_e6: z.number().int().min(-90e6).max(90e6),
  longitude_e6: z.number().int().min(-180e6).max(180e6),
};
const sourceId = z.string().min(1).max(160);
const provenance = {
  source_id: sourceId,
  source_retrieved_at_pst: timeSchema,
  source_issued_at_pst: timeSchema.nullable().optional(),
};
const optional = (min: number, max: number) =>
  z.number().finite().min(min).max(max).nullable().optional();
export const sourceSchema = z
  .object({
    id: sourceId,
    provider: z.enum(["open_meteo", "open_meteo_marine", "nws", "noaa"]),
    dataset: z.string().min(1).max(80),
    station_id: z.string().max(20).nullable().optional(),
    model: z.string().max(80).nullable().optional(),
    source_latitude_e6: z
      .number()
      .int()
      .min(-90e6)
      .max(90e6)
      .nullable()
      .optional(),
    source_longitude_e6: z
      .number()
      .int()
      .min(-180e6)
      .max(180e6)
      .nullable()
      .optional(),
  })
  .strict();
const kind = z.enum(["forecast", "observation", "reanalysis"]);
export const weatherFields = [
  "temperature_f",
  "uv_index",
  "rainfall_in",
  "wind_speed_mph",
  "wind_direction_deg",
  "weather_code",
  "observed_at_pst",
  "rainfall_start_pst",
  "rainfall_end_pst",
] as const;
export const weatherSchema = z
  .object({
    ...coordinates,
    ...provenance,
    hour_pst: hourSchema,
    data_kind: kind,
    temperature_f: optional(-150, 160),
    uv_index: optional(0, 40),
    rainfall_in: optional(0, 100),
    wind_speed_mph: optional(0, 300),
    wind_direction_deg: z.number().min(0).lt(360).nullable().optional(),
    weather_code: z.number().int().min(0).max(99).nullable().optional(),
    observed_at_pst: timeSchema.nullable().optional(),
    rainfall_start_pst: timeSchema.nullable().optional(),
    rainfall_end_pst: timeSchema.nullable().optional(),
  })
  .strict()
  .refine(
    (r) =>
      weatherFields
        .slice(0, 6)
        .some((f) => typeof r[f as keyof typeof r] === "number"),
    "No weather measurements",
  )
  .refine(
    (r) =>
      r.rainfall_in == null ||
      (r.rainfall_start_pst != null &&
        r.rainfall_end_pst != null &&
        Date.parse(r.rainfall_end_pst) - Date.parse(r.rainfall_start_pst) ===
          3_600_000),
    "Rain requires a one-hour interval",
  );
export const tideSchema = z
  .object({
    ...coordinates,
    ...provenance,
    hour_pst: hourSchema,
    data_kind: z.enum(["forecast", "observation"]),
    datum: z.literal("MLLW"),
    height_ft: z.number().finite().min(-50).max(100),
  })
  .strict();
export const waterSchema = z
  .object({
    ...coordinates,
    ...provenance,
    date_pst: dateSchema,
    data_kind: kind,
    mean_temperature_f: z.number().finite().min(20).max(120),
    sample_count: z.number().int().min(1).max(10000),
    is_complete: z.union([z.literal(0), z.literal(1)]),
  })
  .strict();
export const sunSchema = z
  .object({
    ...coordinates,
    source_id: sourceId,
    source_retrieved_at_pst: timeSchema,
    date_pst: dateSchema,
    sunrise_pst: timeSchema.nullable(),
    sunset_pst: timeSchema.nullable(),
  })
  .strict();
export type Source = z.infer<typeof sourceSchema>;
export type Weather = z.infer<typeof weatherSchema>;
export type Tide = z.infer<typeof tideSchema>;
export type Water = z.infer<typeof waterSchema>;
export type Sun = z.infer<typeof sunSchema>;
export type Row = Weather | Tide | Water | Sun;
export type Table =
  | "hourly_weather"
  | "hourly_tides"
  | "daily_water_temperature"
  | "daily_sun_times";
export const tables: Table[] = [
  "hourly_weather",
  "hourly_tides",
  "daily_water_temperature",
  "daily_sun_times",
];
export type Bundle = {
  sources: Source[];
  hourly_weather: Weather[];
  hourly_tides: Tide[];
  daily_water_temperature: Water[];
  daily_sun_times: Sun[];
};
export const emptyBundle = (): Bundle => ({
  sources: [],
  hourly_weather: [],
  hourly_tides: [],
  daily_water_temperature: [],
  daily_sun_times: [],
});
export const rowSchemas = {
  hourly_weather: weatherSchema,
  hourly_tides: tideSchema,
  daily_water_temperature: waterSchema,
  daily_sun_times: sunSchema,
};
export const measurements: Record<Table, readonly string[]> = {
  hourly_weather: weatherFields,
  hourly_tides: ["height_ft"],
  daily_water_temperature: [
    "mean_temperature_f",
    "sample_count",
    "is_complete",
  ],
  daily_sun_times: ["sunrise_pst", "sunset_pst"],
};
export const keys: Record<Table, string[]> = {
  hourly_weather: [
    "latitude_e6",
    "longitude_e6",
    "hour_pst",
    "data_kind",
    "source_id",
  ],
  hourly_tides: [
    "latitude_e6",
    "longitude_e6",
    "hour_pst",
    "data_kind",
    "source_id",
    "datum",
  ],
  daily_water_temperature: [
    "latitude_e6",
    "longitude_e6",
    "date_pst",
    "data_kind",
    "source_id",
  ],
  daily_sun_times: ["latitude_e6", "longitude_e6", "date_pst", "source_id"],
};
export function keyFor(table: Table, row: Row) {
  const r = row as unknown as Record<string, unknown>;
  return keys[table].map((k) => r[k]).join("|");
}
export function changedRows<T extends Row>(
  table: Table,
  fresh: T[],
  saved: Row[],
): T[] {
  const old = new Map(
    saved.map((row) => [
      keyFor(table, row),
      row as unknown as Record<string, unknown>,
    ]),
  );
  return fresh.filter((row) => {
    const previous = old.get(keyFor(table, row));
    const r = row as unknown as Record<string, unknown>;
    return (
      !previous ||
      measurements[table].some(
        (k) => Object.hasOwn(r, k) && (r[k] ?? null) !== (previous[k] ?? null),
      )
    );
  });
}
export function mergeBundles(saved: Bundle, fresh: Bundle): Bundle {
  const result = emptyBundle();
  result.sources = [
    ...new Map(
      [...saved.sources, ...fresh.sources].map((s) => [s.id, s]),
    ).values(),
  ];
  for (const table of tables) {
    const rows = new Map(saved[table].map((r) => [keyFor(table, r), r]));
    for (const row of fresh[table])
      rows.set(keyFor(table, row), {
        ...rows.get(keyFor(table, row)),
        ...row,
      } as Row);
    (result[table] as Row[]) = [...rows.values()];
  }
  return result;
}
