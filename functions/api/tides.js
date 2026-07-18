const NOAA_BASE = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';
const STATION = '9414290';

export async function onRequest({ request }) {
  const url = new URL(request.url);
  const product = url.searchParams.get('product') || 'predictions';
  const date = url.searchParams.get('date') || '';

  if (!date) {
    return new Response('Missing "date" param (YYYYMMDD)', { status: 400 });
  }

  const params = new URLSearchParams({
    station: STATION,
    datum: 'MLLW',
    units: 'english',
    time_zone: 'lst_ldt',
    format: 'json',
    product,
    begin_date: date,
    end_date: date,
  });

  if (product === 'predictions') params.set('interval', 'h');

  const noaaUrl = `${NOAA_BASE}?${params}`;

  try {
    const resp = await fetch(noaaUrl, {
      headers: { 'User-Agent': 'WeatherDash/1.0 (weatherdash.pages.dev)' },
    });
    const text = await resp.text();

    return new Response(text, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
