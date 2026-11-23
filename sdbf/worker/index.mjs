import { pointIds } from "../data/point-rain.mjs";
import { loadPointRain } from "./point-rain.mjs";
import { loadCounty, loadSamples } from "./county.mjs";
import { loadContext, loadRain, summarizeRain } from "./water.mjs";

const minute = 60000;
const schedules = { county:29*minute, samples:6*60*minute, rain:15*minute, "point-rain":29*minute, context:30*minute };
const headers = { "Cache-Control":"no-store" };
const newestTime = (first, second) => !first || second > first ? second : first;

async function feeds(db) {
  const { results } = await db.prepare("SELECT name, verified_at, payload FROM feed_snapshots").all();
  return Object.fromEntries(results.map(row => [row.name, { at:row.verified_at, value:JSON.parse(row.payload) }]));
}

function mergeHistory(saved, fresh) {
  return [...new Map([...saved,...fresh].map(sample => [sample.id,sample])).values()]
    .sort((a,b) => b.collectedAt.localeCompare(a.collectedAt))
    .slice(0,60);
}

function mergeContext(previous = {}, recent = {}) {
  const result = { ...previous };
  for (const [gauge, values] of Object.entries(recent)) {
    result[gauge] = { ...previous[gauge], ...values };
  }
  return result;
}

export function assemble(records, now=Date.now()) {
  const root = records.bootstrap?.value;
  if (!root?.sites?.length) return null;
  const county = records.county?.value;
  const samples = records.samples?.value ?? {};
  const rain = records.rain?.value ?? {};
  const expectedPoints = new Set(root.sites.flatMap(pointIds));
  const pointRain = Object.fromEntries(Object.entries(records["point-rain"]?.value ?? {}).filter(([id]) => expectedPoints.has(id)));
  const rainSeries = { ...root.rainSeries, ...Object.fromEntries(Object.entries(rain).map(([gauge, record]) => [gauge,record.intervals])) };
  const sites = root.sites.map(site => {
    const history = mergeHistory(site.history, samples[site.id] ?? []);
    return {
      ...site,
      posting:county?.postings[site.id] ?? site.posting,
      history,
      sample:history[0] ?? null,
      rain:rain[site.rainGauge] ? summarizeRain(rain[site.rainGauge].intervals, rain[site.rainGauge].verifiedAt, now) : site.rain,
    };
  });
  const generatedAt = Object.values(records).reduce((time, record) => newestTime(time, record.at), root.generatedAt);
  return { sites, rainSeries, pointRain, context:records.context?.value ?? {}, regionalRain:county?.regionalRain ?? root.regionalRain, generatedAt,
    countyCheckedAt:records.county?.at ?? root.regionalRain?.verifiedAt ?? null };
}

const loads = {
  county: (env,previous,now) => loadCounty(env.BROWSER, previous.county?.value ?? {
    regionalRain:previous.bootstrap?.value.regionalRain,
    postings:Object.fromEntries((previous.bootstrap?.value.sites ?? []).map(site => [site.id,site.posting])),
  }, new Date(now).toISOString()),
  samples: async (env,previous,now) => {
    const prior = previous.samples?.value ?? {};
    const incoming = await loadSamples(env.BROWSER, new Date(now).toISOString());
    return { ...prior, ...Object.fromEntries(Object.entries(incoming).map(([id, history]) => [id,mergeHistory(prior[id] ?? [],history)])) };
  },
  rain: async (_,previous,now) => {
    const intervals = await loadRain(now);
    const verifiedAt = new Date(now).toISOString();
    return { ...previous.rain?.value, ...Object.fromEntries(Object.entries(intervals).map(([gauge, values]) =>
      [gauge, { intervals:values, verifiedAt }])) };
  },
  "point-rain": async (_,previous,now) => ({ ...previous["point-rain"]?.value,...await loadPointRain(now) }),
  context: async (_,previous,now) => mergeContext(previous.context?.value, await loadContext(now)),
};

const acquire = `INSERT INTO refresh_attempts(name,requested_at) VALUES (?,?)
  ON CONFLICT(name) DO UPDATE SET requested_at=excluded.requested_at
  WHERE refresh_attempts.requested_at < ?`;
const store = `INSERT INTO feed_snapshots(name,verified_at,payload) VALUES (?,?,?)
  ON CONFLICT(name) DO UPDATE SET verified_at=excluded.verified_at,payload=excluded.payload
  WHERE feed_snapshots.verified_at < excluded.verified_at`;

async function refreshFeeds(env) {
  const now = Date.now();
  const time = new Date(now).toISOString();
  const names = Object.keys(schedules);
  const attempts = await env.DB.batch(names.map(name =>
    env.DB.prepare(acquire).bind(name,now,now-schedules[name])));
  const due = names.filter((_, index) => attempts[index].meta.changes > 0);
  const previous = await feeds(env.DB);
  const updated = await Promise.allSettled(due.map(async name => {
    const value = await loads[name](env,previous,now);
    await env.DB.prepare(store).bind(name,time,JSON.stringify(value)).run();
    previous[name] = { at:time, value };
  }));
  for (const [index,result] of updated.entries()) {
    if (result.status === "rejected") console.warn(JSON.stringify({event:"source-refresh-failed",feed:due[index], message:String(result.reason).slice(0,350)}));
  }
  // A parallel request may have written another feed while this one refreshed.
  return { snapshot:assemble(await feeds(env.DB)), unavailable:due.filter((_, index) => updated[index].status === "rejected") };
}

export default {
  async fetch(request,env) {
    const path = new URL(request.url).pathname;
    try {
      if (path === "/api/cache" && request.method === "GET") {
        const snapshot = assemble(await feeds(env.DB));
        return Response.json({ snapshot }, { status:snapshot ? 200 : 503, headers });
      }
      if (path === "/api/source" && request.method === "GET") {
        const result = await refreshFeeds(env);
        return Response.json(result, { status:result.snapshot ? 200 : 503, headers });
      }
      if (path === "/api/cache" && request.method === "POST") {
        // The client can request reconciliation. The server obtains all values from the providers.
        if (request.headers.get("Sec-Fetch-Site") === "cross-site") return new Response(null,{status:403});
        const result = await refreshFeeds(env);
        return Response.json(result, { status:result.snapshot ? 200 : 503, headers });
      }
      return Response.json({error:"Unknown API route"}, {status:404,headers});
    } catch (error) {
      console.error(JSON.stringify({event:"api-failed",path,message:String(error).slice(0,350)}));
      return Response.json({error:"Beach data temporarily unavailable"}, {status:503,headers});
    }
  },
  scheduled(_controller, env, ctx) {
    ctx.waitUntil(refreshFeeds(env));
  },
};
