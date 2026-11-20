import { z } from "zod";
import {
  ALL_LOCATIONS,
  coordKey,
  stationFor,
  tideStation,
} from "../../src/config.ts";
import {
  tables,
  sourceSchema,
  rowSchemas,
  emptyBundle,
  type Source,
  type Row,
  type Table,
} from "../../shared/model.ts";
import { upsertStatement } from "../../shared/database.ts";
import {
  pst,
  pstDate,
  pstHour,
  validDate,
  midnight,
  shiftDate,
  DAY,
  HOUR,
} from "../../shared/time.ts";
type Env = Partial<CloudflareEnv>;
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const coordinateSchema = z
  .object({ latitude_e6: z.number().int(), longitude_e6: z.number().int() })
  .strict();
const envelopeSchema = z
  .object({
    location: coordinateSchema,
    table: z.enum(tables as [Table, ...Table[]]),
    rows: z.array(z.unknown()).min(1).max(25),
    sources: z.array(sourceSchema).max(4),
  })
  .strict();
const known = (lat: number, lon: number) =>
  ALL_LOCATIONS.find((l) => coordKey(l) === `${lat},${lon}`);
function validGridSource(
  source: Source,
  product: "forecast" | "marine",
  location: NonNullable<ReturnType<typeof known>>,
) {
  const parts = source.id.split(":");
  if (
    parts.length !== 4 ||
    parts[0] !== "om" ||
    parts[1] !== product ||
    source.model !== "best_match"
  )
    return false;
  const latitude = Number(parts[2]),
    longitude = Number(parts[3]);
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    source.source_latitude_e6 === Math.round(latitude * 1e6) &&
    source.source_longitude_e6 === Math.round(longitude * 1e6) &&
    Math.abs(latitude - location.lat) < 2 &&
    Math.abs(longitude - location.lon) < 2
  );
}
function eligible(
  source: Source,
  row: Row,
  table: Table,
  location: NonNullable<ReturnType<typeof known>>,
) {
  const kind = "data_kind" in row ? row.data_kind : null;
  if (table === "hourly_weather") {
    if (source.provider === "nws")
      return (
        source.dataset === "station_observations" &&
        source.station_id === stationFor(location) &&
        source.id === `nws:${source.station_id}` &&
        kind === "observation"
      );
    return (
      source.provider === "open_meteo" &&
      source.dataset === "forecast" &&
      validGridSource(source, "forecast", location) &&
      kind === "forecast"
    );
  }
  if (table === "daily_sun_times")
    return (
      source.provider === "open_meteo" &&
      source.dataset === "forecast" &&
      validGridSource(source, "forecast", location)
    );
  if (table === "hourly_tides")
    return (
      source.provider === "noaa" &&
      source.station_id === tideStation(location) &&
      source.id ===
        `noaa:${source.station_id}:${kind === "forecast" ? "predictions" : "water_level"}` &&
      source.dataset === (kind === "forecast" ? "predictions" : "water_level")
    );
  if (source.provider === "open_meteo_marine")
    return (
      source.dataset === "marine" &&
      validGridSource(source, "marine", location) &&
      kind === "forecast"
    );
  return (
    source.provider === "noaa" &&
    source.station_id === tideStation(location) &&
    source.dataset === "water_temperature" &&
    source.id === `noaa:${source.station_id}:water_temperature` &&
    kind === "observation"
  );
}
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.DB) return json({ error: "Database is not configured" }, 503);
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat_e6")),
    lon = Number(url.searchParams.get("lon_e6"));
  const from = url.searchParams.get("from") || "",
    to = url.searchParams.get("to") || "";
  if (
    !url.searchParams.has("lat_e6") ||
    !url.searchParams.has("lon_e6") ||
    !known(lat, lon) ||
    !validDate(from) ||
    !validDate(to) ||
    from > to ||
    Date.parse(midnight(to)) - Date.parse(midnight(from)) > 14 * DAY
  )
    return json(
      { error: "Invalid location or date range (maximum 15 days)" },
      400,
    );
  try {
    const result = emptyBundle();
    const queries = tables.map((table) =>
      env
        .DB!.prepare(
          `SELECT * FROM ${table} WHERE latitude_e6=? AND longitude_e6=? AND ${table.startsWith("hourly") ? "hour_pst" : "date_pst"}>=? AND ${table.startsWith("hourly") ? "hour_pst" : "date_pst"}<?`,
        )
        .bind(
          lat,
          lon,
          table.startsWith("hourly") ? midnight(from) : from,
          table.startsWith("hourly")
            ? midnight(shiftDate(to, 1))
            : shiftDate(to, 1),
        ),
    );
    const responses = await env.DB.batch(queries);
    responses.forEach((r, i) => {
      (result[tables[i]] as unknown[]) = r.results;
    });
    const ids = [
      ...new Set(tables.flatMap((t) => result[t].map((r) => r.source_id))),
    ];
    if (ids.length)
      result.sources = (
        await env.DB.prepare(
          `SELECT * FROM data_sources WHERE id IN (${ids.map(() => "?").join(",")})`,
        )
          .bind(...ids)
          .all<Source>()
      ).results;
    return json(result);
  } catch (error) {
    console.error("Weather DB read failed", error);
    return json({ error: "Weather database temporarily unavailable" }, 503);
  }
};
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.DB) return json({ error: "Database is not configured" }, 503);
  const origin = request.headers.get("Origin");
  if (
    (origin && origin !== new URL(request.url).origin) ||
    request.headers.get("Sec-Fetch-Site") === "cross-site"
  )
    return json({ error: "Cross-origin writes are not allowed" }, 403);
  if (!request.headers.get("Content-Type")?.startsWith("application/json"))
    return json({ error: "Expected application/json" }, 415);
  // Bound actual streamed bytes, not only the client-supplied Content-Length.
  const reader = request.body?.getReader();
  if (!reader) return json({ error: "Missing JSON body" }, 400);
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    length += next.value.byteLength;
    if (length > 64 * 1024) {
      await reader.cancel();
      return json({ error: "Write batch is too large" }, 413);
    }
    chunks.push(next.value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  let input: z.infer<typeof envelopeSchema>;
  let rows: Row[];
  try {
    input = envelopeSchema.parse(JSON.parse(new TextDecoder().decode(bytes)));
    rows = input.rows.map((r) => rowSchemas[input.table].parse(r));
  } catch {
    return json({ error: "Invalid weather write batch" }, 400);
  }
  const location = known(
    input.location.latitude_e6,
    input.location.longitude_e6,
  );
  if (!location) return json({ error: "Unknown location" }, 400);
  const sourceMap = new Map(input.sources.map((s) => [s.id, s]));
  if (sourceMap.size !== input.sources.length)
    return json({ error: "Duplicate source IDs" }, 400);
  const usedSources = new Set(rows.map((row) => row.source_id));
  if (input.sources.some((source) => !usedSources.has(source.id)))
    return json({ error: "Unused source records are not accepted" }, 400);
  const now = Date.now();
  for (const row of rows) {
    const source = sourceMap.get(row.source_id);
    const time = "hour_pst" in row ? row.hour_pst : midnight(row.date_pst);
    if (
      row.latitude_e6 !== input.location.latitude_e6 ||
      row.longitude_e6 !== input.location.longitude_e6 ||
      !source ||
      !eligible(source, row, input.table, location) ||
      Math.abs(Date.parse(time) - now) > 32 * DAY ||
      Date.parse(row.source_retrieved_at_pst) > now + 5 * 60_000 ||
      ("source_issued_at_pst" in row &&
        row.source_issued_at_pst &&
        Date.parse(row.source_issued_at_pst) > now + 5 * 60_000)
    )
      return json({ error: "Unsupported source, location, or time" }, 400);
    if (
      "data_kind" in row &&
      row.data_kind === "observation" &&
      (("hour_pst" in row && Date.parse(row.hour_pst) > now) ||
        ("date_pst" in row && row.date_pst > pstDate(now)) ||
        ("observed_at_pst" in row &&
          row.observed_at_pst &&
          Date.parse(row.observed_at_pst) > now) ||
        ("rainfall_end_pst" in row &&
          row.rainfall_end_pst &&
          Date.parse(row.rainfall_end_pst) > now))
    )
      return json({ error: "Observations cannot be in the future" }, 400);
    if (
      input.table === "hourly_weather" &&
      "rainfall_in" in row &&
      row.rainfall_in != null &&
      row.rainfall_start_pst &&
      pstHour(row.rainfall_start_pst) !== (row as { hour_pst: string }).hour_pst
    )
      return json(
        { error: "Rain interval does not match its hourly bucket" },
        400,
      );
  }
  try {
    const statements = [
      env.DB.prepare(
        "INSERT INTO locations(latitude_e6,longitude_e6,name,group_name) VALUES (?,?,?,?) ON CONFLICT(latitude_e6,longitude_e6) DO NOTHING",
      ).bind(
        input.location.latitude_e6,
        input.location.longitude_e6,
        location.name,
        location.group || null,
      ),
    ];
    for (const source of input.sources) {
      statements.push(
        env.DB.prepare(
          `INSERT INTO data_sources(id,provider,dataset,station_id,model,source_latitude_e6,source_longitude_e6) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`,
        ).bind(
          source.id,
          source.provider,
          source.dataset,
          source.station_id ?? null,
          source.model ?? null,
          source.source_latitude_e6 ?? null,
          source.source_longitude_e6 ?? null,
        ),
      );
    }
    for (const row of rows) {
      const stmt = upsertStatement(input.table, row, pst(now));
      statements.push(env.DB.prepare(stmt.sql).bind(...stmt.values));
    }
    const results = await env.DB.batch(statements);
    return json({
      changed: results
        .slice(1 + input.sources.length)
        .reduce((sum, r) => sum + (r.meta.changes || 0), 0),
    });
  } catch (error) {
    console.error("Weather DB write failed", error);
    return json({ error: "Weather data could not be saved" }, 503);
  }
};
