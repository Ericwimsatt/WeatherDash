# San Diego Beach Finder

The separate branch contains the project design, rating logic, monitoring-site catalog, database schema and a working layout comparison. The design choice comes before the production React layout and custom hostname deployment.

Open [the layout comparison](preview/index.html) in a browser. Each option has a table, a schematic map with all 15 points and the same detail dialog. Use **Shortlist only** to see the two selections, and **Restore all** to reopen minimized or discarded options. The preview uses a dated, offline snapshot.

- [System design and rating rules](docs/DESIGN.md)
- [Layout decision record](docs/CHOICE_SET.yaml)
- [Station catalog](data/sites.json)
- [D1 schema](data/0001.sql)

## Initial import

The Nov 22, 2026 import populated and verified 15 sites, 15 County map postings, 341 Enterococcus results, 257 County storm-drain or outfall records, and 112 measured precipitation intervals from five NWS gauges in the separate `sd-beach-finder` D1 database. The County map reported its last update at 2:55 p.m. Pacific on Nov 21. Its snapshot showed advisories at 12 representative sites and closures at Silver Strand, Imperial Beach Pier and Border Field. The newest result found in the public station reports was collected on Nov 12, and the oldest latest result was collected on Oct 19. The source only provided partial precipitation coverage.

The first import used the County's public site and station report views in a browser. A direct request to the County report endpoint returned HTTP 403. A supported production ingestion path still needs verification. The comparison uses the public map's posting classifications without inferring why a site was posted. Outfall coordinates identify potential runoff locations. They do not report whether a drain was flowing at the time.

Run the rating checks with `node --test sdbf/data/rating.test.mjs`.
