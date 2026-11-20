import { keys, measurements, type Table, type Row } from "./model.ts";
// Column names come exclusively from the typed schema; all values are bound.
export function upsertStatement(table: Table, row: Row, receivedAt: string) {
  const value = row as unknown as Record<string, unknown>;
  const fields = measurements[table].filter((k) => Object.hasOwn(value, k));
  const metadata = [
    "source_retrieved_at_pst",
    ...("source_issued_at_pst" in value ? ["source_issued_at_pst"] : []),
    "updated_at_pst",
  ];
  const columns = [...keys[table], ...fields, ...metadata];
  const values = columns.map((k) =>
    k === "updated_at_pst" ? receivedAt : (value[k] ?? null),
  );
  const revisionGuard =
    table === "daily_sun_times"
      ? `excluded.source_retrieved_at_pst >= ${table}.source_retrieved_at_pst`
      : `CASE WHEN excluded.source_issued_at_pst IS NOT NULL AND ${table}.source_issued_at_pst IS NOT NULL
       THEN excluded.source_issued_at_pst >= ${table}.source_issued_at_pst
       ELSE excluded.source_retrieved_at_pst >= ${table}.source_retrieved_at_pst END`;
  return {
    sql: `INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})
      ON CONFLICT (${keys[table].join(",")}) DO UPDATE SET
      ${[...fields, ...metadata].map((k) => `${k}=excluded.${k}`).join(",")}
      WHERE (${revisionGuard}) AND (${fields.map((k) => `${table}.${k} IS NOT excluded.${k}`).join(" OR ")})`,
    values,
  };
}
