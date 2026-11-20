# Follow-ups

- Replace fixed PST (UTC−08:00, without daylight saving) with location-aware
  IANA timezones and a user display preference. Plan a migration to unambiguous
  UTC storage; recalculate local daily buckets and verify DST boundaries.
  All adapters and day boundaries currently use fixed PST. Revisit historical
  rainfall intervals and daily means when migrating these stored timestamps.
- Address permanent database growth: decide how much past hourly weather,
  rainfall, tide and daily data to retain; consider daily rollups and archived
  exports, monitor D1 storage, and schedule bounded cleanup. UPSERT avoids
  duplicate refresh rows, but each new location/hour/day still grows the DB.
- Review the NWS station mappings in `src/config.ts` for local representativeness.
  Recorded temperature, wind and rainfall now come from NWS stations; missing
  or overlapping rainfall intervals are excluded from complete totals.
  Some stations do not report every field. Add a more local observation provider
  if airport stations or their coverage are insufficient; never relabel
  Open-Meteo forecasts/reanalysis as station observations.
