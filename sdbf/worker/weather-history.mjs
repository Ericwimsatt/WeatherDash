import sites from "../data/sites.json" with { type:"json" };
import { pointLocations, hour } from "../data/point-rain.mjs";

const toPst = time => new Date(time - 8 * hour).toISOString().slice(0,19) + "-08:00";
const coordinates = point => ({ latitude_e6:Math.round(point.lat * 1e6), longitude_e6:Math.round(point.lon * 1e6) });

export async function writeRainHistory(db, records, now) {
  const locations = pointLocations(sites);
  const recentCutoff = toPst(now - 8 * 24 * hour);
  const existing = await db.prepare(`SELECT COUNT(DISTINCT latitude_e6 || ':' || longitude_e6) AS count
      , MIN(hour_pst) AS oldest
    FROM hourly_weather WHERE data_kind='observation' AND rainfall_in IS NOT NULL
      AND hour_pst >= ? AND latitude_e6 BETWEEN 32000000 AND 34000000
      AND longitude_e6 BETWEEN -118000000 AND -116000000`).bind(recentCutoff).first("count");
  const covered = Number(existing?.count) >= locations.length && Date.parse(existing?.oldest) <= now - 8 * 24 * hour;
  const cutoff = toPst(now - (covered ? 6 : 192) * hour);
  const statements = [];
  const sourceIds = new Set();
  for (const point of locations) {
    const siteId = point.id.replace(/^local:/, "").replace(/^inland:3mi:/, "");
    const site = sites.find(item => item.id === Number(siteId));
    if (!site) continue;
    const coords = coordinates(point);
    statements.push(db.prepare(`INSERT INTO locations(latitude_e6,longitude_e6,name,group_name)
      VALUES(?,?,?,?) ON CONFLICT(latitude_e6,longitude_e6) DO NOTHING`)
      .bind(coords.latitude_e6,coords.longitude_e6,point.name,site.area));
    const station = site.rainGauge;
    const sourceId = `nws:${station}`;
    if (!sourceIds.has(sourceId)) {
      sourceIds.add(sourceId);
      statements.push(db.prepare(`INSERT INTO data_sources(id,provider,dataset,station_id)
        VALUES(?,'nws','station_observations',?) ON CONFLICT(id) DO NOTHING`).bind(sourceId,station));
    }
    const latestByHour = new Map();
    for (const interval of [...(records?.[station]?.intervals ?? [])].sort((a,b) => a.end.localeCompare(b.end))) {
      const start = Date.parse(interval.start);
      if (interval.hours === 1 && Number.isFinite(start)) latestByHour.set(Math.floor(start / hour),interval);
    }
    for (const interval of latestByHour.values()) {
      const start = Date.parse(interval.start), end = Date.parse(interval.end);
      if (interval.hours !== 1 || !Number.isFinite(start) || !Number.isFinite(end) ||
          end - start !== hour || toPst(start) < cutoff || end > now ||
          !Number.isFinite(interval.inches) || interval.inches < 0) continue;
      const rowHour = Math.floor(start / hour) * hour;
      const retrieved = toPst(records[station].verifiedAt ? Date.parse(records[station].verifiedAt) : now);
      statements.push(db.prepare(`INSERT INTO hourly_weather(
        latitude_e6,longitude_e6,hour_pst,data_kind,source_id,rainfall_in,
        rainfall_start_pst,rainfall_end_pst,source_retrieved_at_pst,updated_at_pst)
        VALUES(?,?,?,'observation',?,?,?,?,?,?)
        ON CONFLICT(latitude_e6,longitude_e6,hour_pst,data_kind,source_id) DO UPDATE SET
          rainfall_in=excluded.rainfall_in,
          rainfall_start_pst=excluded.rainfall_start_pst,
          rainfall_end_pst=excluded.rainfall_end_pst,
          source_retrieved_at_pst=excluded.source_retrieved_at_pst,
          updated_at_pst=excluded.updated_at_pst
        WHERE hourly_weather.rainfall_in IS NOT excluded.rainfall_in
          OR hourly_weather.rainfall_end_pst IS NOT excluded.rainfall_end_pst`)
        .bind(coords.latitude_e6,coords.longitude_e6,toPst(rowHour),sourceId,interval.inches,
          toPst(start),toPst(end),retrieved,retrieved));
    }
  }
  for (let i=0; i<statements.length; i+=100) await db.batch(statements.slice(i,i+100));
}

export async function readRainHistory(db, now) {
  const locations = pointLocations(sites).map(coordinates);
  const unique = [...new Map(locations.map(point => [`${point.latitude_e6}:${point.longitude_e6}`,point])).values()];
  const pairs = unique.map(() => "(latitude_e6=? AND longitude_e6=?)").join(" OR ");
  const bindings = [toPst(now - 8 * 24 * hour), ...unique.flatMap(point => [point.latitude_e6,point.longitude_e6])];
  const { results=[] } = await db.prepare(`SELECT latitude_e6,longitude_e6,hour_pst,data_kind,source_id,
      rainfall_in,rainfall_start_pst,rainfall_end_pst,source_retrieved_at_pst
    FROM hourly_weather WHERE data_kind='observation' AND rainfall_in IS NOT NULL AND hour_pst>=?
      AND (${pairs}) ORDER BY hour_pst,source_retrieved_at_pst DESC`).bind(...bindings).all();
  return results;
}
