import sites from "../data/sites.json" with { type:"json" };

const countyUrl = "https://cosdapps.sandiegocounty.gov/sdbeachinfo/";
const statusByPriority = { 0:"unknown", 1:"open", 2:"advisory", 3:"warning", 4:"closure" };
const makeBrowserCode = (run, args) => `async ({ page, browser }) => (${run.toString()})(page, browser, ${JSON.stringify(args)})`;

async function browserResult(binding, code, timeout) {
  const response = await binding.script(code, { library:"playwright", timeout, keepAlive:10000 });
  try {
    const body = await response.json();
    if (!response.ok || !body.success) throw Error(`County Browser Run ${response.status}: ${body.errors?.[0]?.message ?? body.error?.message ?? body.message ?? "source unavailable"}`);
    return body.result;
  } finally {
    const session = response.headers.get("cf-browser-session-id");
    if (session) await binding.closeSession(session).catch(() => {});
  }
}

async function readPostings(page, browser, url) {
  const received = {};
  const endpoints = [
    ["/HomeBlockNew/ScreenDataSetGetSiteById","pins"],
    ["/HomeBlockNew/DataActionGetLastDateTime","updated"],
    ["/HomeBlockNew/ScreenDataSetGetAdvisoriesCount","count"],
    ["/BlockNotification/ScreenDataSetGetEventsList","notices"],
  ];
  page.on("response", async response => {
    const match = endpoints.find(([ending]) => response.url().endsWith(ending));
    if (!match || !response.ok()) return;
    try {
      const data = (await response.json()).data;
      const key = match[1];
      if (key !== "pins" || !received.pins || data.List.List.length > received.pins.List.List.length) received[key] = data;
    } catch { /* Validate the captured response after page load. */ }
  });
  try {
    const response = await page.goto(url, { waitUntil:"domcontentloaded", timeout:16000 });
    if (response?.status() >= 400) return { failure:"County webpage " + response.status() };
    for (let i=0; i<80 && !(received.pins && received.updated && received.count); i++) {
      await page.waitForTimeout(175);
    }
    if (!(received.pins && received.updated && received.count))
      return { failure:"Missing public County responses: " + Object.keys(received).join(",") };
    const advisoryCount = Number(received.count?.List?.List?.[0]?.Count);
    if (advisoryCount > 0) {
      await page.evaluate(() => {
        const label = [...document.querySelectorAll("body *")].find(element =>
          !element.childElementCount && element.textContent.trim().toUpperCase() === "ADVISORIES");
        label?.click();
      }).catch(() => {});
      for (let i=0; i<32 && !received.notices; i++) await page.waitForTimeout(175);
    }
    return {
      pins: received.pins?.List?.List?.map(record => [record.Id, record.PriorityMax]),
      observedAt: received.updated?.LastUpdate,
      advisoryCount,
      notices: received.notices?.List?.List?.map(row => ({
        station:row.Site.StationID, description:row.Event.DescriptionIssue, issuedAt:row.Event.IssueDateTime,
      })),
    };
  } catch (error) {
    return { failure:String(error).slice(0,240) };
  }
}

async function readSamples(page, browser, { url, siteIds }) {
  const results = {};
  for (let start=0; start<siteIds.length; start+=5) {
    await Promise.all(siteIds.slice(start,start+5).map(async id => {
      const report = await browser.newPage();
      try {
        await report.route("**/*", route => ["image","font","media"].includes(route.request().resourceType()) ? route.abort() : route.continue());
        const [response] = await Promise.all([
          report.waitForResponse(response => {
            if (!response.ok() || !response.url().endsWith("/ScreenDataSetGetSamples")) return false;
            try {
              return String(response.request().postDataJSON().screenData.variables.StationIdFilter) === String(id);
            } catch { return false; }
          }, { timeout:11500 }),
          report.goto(url + "SamplesReport?SiteId=" + id, { waitUntil:"domcontentloaded", timeout:10500 }),
        ]);
        const body = await response.json();
        const rows = body.data?.List?.List;
        if (Array.isArray(rows)) results[id] = rows.map(({AnalysisMethod, Site, Parameter, Sample, Units}) => [
          Sample.Id, Site.StationID, Sample.SampleDate, Sample.SampleTime, Sample.Result,
          Sample.Qualifier, AnalysisMethod.Label, Units.Label, Parameter.Label,
        ]);
      } catch { /* A missing station remains on its last verified database record. */ }
      finally { await report.close().catch(() => {}); }
    }));
  }
  return results;
}

const pacificOffset = new Intl.DateTimeFormat("en-US", { timeZone:"America/Los_Angeles", timeZoneName:"shortOffset" });

export function pacificTime(date, time = "00:00:00") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}(?::\d{2})?$/.test(time)) return null;
  const naive = Date.parse(`${date}T${time.length === 5 ? time + ":00" : time}Z`);
  if (!Number.isFinite(naive)) return null;
  const offset = pacificOffset.formatToParts(naive + 8*3600000).find(part => part.type === "timeZoneName")?.value;
  const hours = Number(offset?.slice(3));
  return Number.isFinite(hours) ? new Date(naive - hours*3600000).toISOString() : null;
}

function estimatedLift(html) {
  const text = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
  const found = /anticipated lift date[^:]{0,55}:\s*([A-Za-z]+ \d{1,2}, \d{4})\s*~?\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(text);
  if (!found) return null;
  const day = Date.parse(found[1] + " UTC");
  if (!Number.isFinite(day)) return null;
  const hour = (Number(found[2])%12) + (found[4].toUpperCase()==="PM" ? 12 : 0);
  return pacificTime(new Date(day).toISOString().slice(0,10), `${String(hour).padStart(2,"0")}:${found[3]}`);
}

export function normalizeCounty(raw, previous, verifiedAt) {
  if (!Array.isArray(raw?.pins) || !Number.isFinite(Date.parse(raw.observedAt))) throw Error("County map structure changed");
  const priorTime = Object.values(previous?.postings ?? {})[0]?.observedAt;
  if (priorTime && Date.parse(raw.observedAt) < Date.parse(priorTime)) throw Error("County map is older than the saved posting set");
  const candidates = new Map(raw.pins.map(([id,priority]) => [Number(id),statusByPriority[priority]]));
  if (!sites.every(site => candidates.get(site.countyId))) throw Error("County map did not return all monitored sites");
  const rawNotices = Array.isArray(raw.notices) ? raw.notices : [];
  const isRainNotice = notice => /general\s+rain\s+advisory/i.test(notice.description?.replace(/<[^>]+>/g," "));
  const rainNotice = rawNotices.find(isRainNotice);
  const fullNoticeList = raw.advisoryCount === 0 ||
    Number.isInteger(raw.advisoryCount) && raw.advisoryCount > 0 && rawNotices.length >= raw.advisoryCount;
  const previousRain = previous?.regionalRain;
  let regionalRain = previousRain;
  if (rainNotice) {
    regionalRain = {
      advisory:"active", verifiedAt, issuedAt:rainNotice.issuedAt,
      estimatedLiftAt:estimatedLift(rainNotice.description),
    };
  } else if (fullNoticeList && (!previousRain?.issuedAt || Date.parse(raw.observedAt) > Date.parse(previousRain.issuedAt))) {
    regionalRain = {
      advisory:"clear", verifiedAt, complete:true,
      ...(previousRain?.advisory === "active" ? { endedAt:raw.observedAt } : { endedAt:previousRain?.endedAt }),
    };
  }
  const postings = Object.fromEntries(sites.map(site => {
    const posting = candidates.get(site.countyId);
    const siteNotices = rawNotices.filter(notice => notice.station === site.monitor);
    const rainOnly = posting === "advisory" && fullNoticeList && siteNotices.length && siteNotices.every(isRainNotice);
    const status = rainOnly ? "rain advisory" : posting;
    const old = previous?.postings?.[site.id];
    const priorHazard = status === "open" && old?.status && old.status !== "open";
    return [site.id, { status, observedAt:raw.observedAt, verifiedAt, lastHazardEnded:priorHazard ? raw.observedAt : old?.lastHazardEnded }];
  }));
  return { postings, regionalRain };
}

export async function loadCounty(binding, previous, now) {
  const raw = await browserResult(binding, makeBrowserCode(readPostings, countyUrl), 38000);
  if (raw?.failure) throw Error(raw.failure);
  return normalizeCounty(raw, previous, now);
}

export async function loadSamples(binding, now) {
  const raw = await browserResult(binding, makeBrowserCode(readSamples, { url:countyUrl, siteIds:sites.map(x => x.countyId) }), 43000);
  const histories = {};
  for (const site of sites) {
    if (!Array.isArray(raw?.[site.countyId])) continue;
    histories[site.id] = raw[site.countyId].flatMap(([id,station,day,time,result,qualifier,method,units,parameter]) => {
      const value = Number(result);
      const collectedAt = pacificTime(day, time || "00:00:00");
      if (!collectedAt || collectedAt > now || !Number.isFinite(value) || result == null || result === "" || value < 0 ||
          station !== site.monitor || parameter !== "Enterococcus") return [];
      return [{ id, collectedAt, value, qualifier, method, units, parameter, dateOnly:!time || time === "00:00:00" }];
    });
  }
  if (!Object.values(histories).some(history => history.length)) throw Error("County returned no station-specific Enterococcus samples");
  return histories;
}
