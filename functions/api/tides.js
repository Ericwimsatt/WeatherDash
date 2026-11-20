const BASE = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter";
const STATIONS = new Set(["9414290", "9410230"]);
const PRODUCTS = new Set(["predictions", "water_level", "water_temperature"]);
export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const station = url.searchParams.get("station") || "9414290";
  const product = url.searchParams.get("product") || "predictions";
  const from =
    url.searchParams.get("from") || url.searchParams.get("date") || "";
  const to = url.searchParams.get("to") || from;
  const valid = (s) =>
    /^\d{8}$/.test(s) &&
    new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T00:00:00Z`)
      .toISOString()
      .slice(0, 10)
      .replaceAll("-", "") === s;
  try {
    if (
      !STATIONS.has(station) ||
      !PRODUCTS.has(product) ||
      !valid(from) ||
      !valid(to) ||
      from > to ||
      Date.parse(`${to.slice(0, 4)}-${to.slice(4, 6)}-${to.slice(6, 8)}`) -
        Date.parse(
          `${from.slice(0, 4)}-${from.slice(4, 6)}-${from.slice(6, 8)}`,
        ) >
        14 * 86400000
    )
      return Response.json(
        { error: "Invalid station, product or date range" },
        { status: 400 },
      );
    const params = new URLSearchParams({
      station,
      product,
      begin_date: from,
      end_date: to,
      datum: "MLLW",
      units: "english",
      time_zone: "lst",
      format: "json",
      application: "WeatherDash",
    });
    if (product === "predictions" || product === "water_temperature")
      params.set("interval", "h");
    const response = await fetch(`${BASE}?${params}`, {
      headers: { "User-Agent": "WeatherDash/2.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      return Response.json(
        { error: `NOAA returned ${response.status}` },
        { status: 502 },
      );
    const data = await response.json();
    if (data.error)
      return Response.json(
        { error: data.error.message || "NOAA data unavailable" },
        { status: 502 },
      );
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "NOAA data unavailable" }, { status: 502 });
  }
}
