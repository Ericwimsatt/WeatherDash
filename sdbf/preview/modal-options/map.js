const bounds = { west:-117.48, east:-116.91, north:33.22, south:32.513 };
export function project(lon, lat) {
  return [(lon - bounds.west) / (bounds.east - bounds.west), (bounds.north - lat) / (bounds.north - bounds.south)];
}

const towns = [
  ["Oceanside",-117.275,33.207], ["Carlsbad",-117.284,33.16], ["Encinitas",-117.241,33.044],
  ["Solana Beach",-117.197,32.988], ["Del Mar",-117.207,32.944], ["La Jolla",-117.202,32.862],
  ["San Diego",-117.116,32.747], ["Coronado",-117.215,32.656], ["Imperial Beach",-117.094,32.562],
];
const routeLabels = [
  ["I-5",33.073], ["SR-78",33.172], ["SR-56",32.958], ["SR-52",32.842], ["I-8",32.776],
  ["I-805",32.687], ["I-15",32.918], ["SR-75",32.622],
];

export function drawMap(canvas, geography) {
  const { width, height } = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);
  const pixel = (lon, lat) => { const [x,y] = project(lon,lat); return [x * width, y * height]; };
  const trace = points => points.forEach((point, index) => ctx[index ? "lineTo" : "moveTo"](...pixel(...point)));

  ctx.fillStyle = "#f0ede1";
  ctx.fillRect(0,0,width,height);
  ctx.fillStyle = "#dceff5";
  for (const rings of [[geography.ocean], ...geography.waters]) {
    ctx.beginPath();
    for (const ring of rings) { trace(ring); ctx.closePath(); }
    ctx.fill("evenodd");
  }
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const [route, segments] of Object.entries(geography.roads)) {
    ctx.beginPath();
    for (const segment of segments) trace(segment);
    ctx.strokeStyle = "#fffdf6";
    ctx.lineWidth = route.startsWith("I-") ? 3.2 : 2.3;
    ctx.stroke();
    ctx.strokeStyle = route.startsWith("I-") ? "#849098" : "#9ca5a1";
    ctx.lineWidth = route.startsWith("I-") ? 1.35 : .85;
    ctx.stroke();
  }
  ctx.save();
  ctx.setLineDash([4,3]);
  ctx.beginPath();
  trace([[-117.12419,32.53432],[-116.90,32.5576]]);
  ctx.strokeStyle = "#657a83";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  function caption(text, point, type) {
    const [x,y] = pixel(...point);
    if (type === "route") {
      ctx.font = "700 9px system-ui";
      const labelWidth = ctx.measureText(text).width + 8;
      ctx.fillStyle = "#fcfbf5";
      ctx.strokeStyle = "#849098";
      ctx.lineWidth = .8;
      ctx.fillRect(x - labelWidth/2,y - 7,labelWidth,14);
      ctx.strokeRect(x - labelWidth/2,y - 7,labelWidth,14);
    } else {
      ctx.font = type === "town" ? "650 12px system-ui" : "italic 11px system-ui";
      ctx.strokeStyle = type === "town" ? "#f0ede1" : "#dceff5";
      ctx.lineWidth = 3;
      ctx.strokeText(text,x,y);
    }
    ctx.fillStyle = type === "town" ? "#213d48" : "#47636e";
    ctx.fillText(text,x,y);
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const [route, latitude] of routeLabels) {
    const visible = (geography.roads[route] ?? []).flat().filter(([lon,lat]) =>
      lon > bounds.west + .025 && lon < bounds.east - .035 && lat < bounds.north - .02 && lat > bounds.south + .03);
    const point = visible.reduce((best, candidate) =>
      !best || Math.abs(candidate[1]-latitude) < Math.abs(best[1]-latitude) ? candidate : best, null);
    if (point) caption(route,point,"route");
  }
  for (const [name,lon,lat] of towns) caption(name,[lon,lat],"town");
  caption("Pacific Ocean",[-117.397,32.828],"water");
  caption("San Diego Bay",[-117.172,32.648],"water");
  caption("U.S.–Mexico border",[-117.028,32.531],"water");
}
