import { readFile } from "node:fs/promises";
const source = await readFile(new URL("../preview/snapshot.js",import.meta.url),"utf8");
const snapshot = JSON.parse(source.replace(/^window\.beachSnapshot = /,"").replace(/;\s*$/,""));
const escape = value => value.replaceAll("'","''");
const sql = await readFile(new URL("./0002.sql",import.meta.url),"utf8");
console.log(sql);
console.log(`INSERT INTO feed_snapshots(name,verified_at,payload) VALUES ('bootstrap','${snapshot.generatedAt}','${escape(JSON.stringify(snapshot))}') ON CONFLICT(name) DO NOTHING;`);
