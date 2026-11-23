export function measurementChart(target, values, maximum, limit, observed) {
  const width = Math.floor(target.getBoundingClientRect().width);
  const height = 112;
  const ratio = window.devicePixelRatio || 1;
  target.width = width * ratio;
  target.height = height * ratio;
  const context = target.getContext("2d");
  context.scale(ratio, ratio);
  const x = timestamp => (Date.parse(timestamp) - (observed - 30 * 86400000)) / (30 * 86400000) * (width - 12) + 6;
  const y = value => height - 8 - value / maximum * (height - 16);
  context.strokeStyle = "#cbd9df";
  for (let offset = 0; offset <= 30; offset += 5) {
    const position = x(new Date(observed - offset * 86400000).toISOString());
    context.beginPath(); context.moveTo(position, 2); context.lineTo(position, height - 8); context.stroke();
  }
  if (limit) {
    context.strokeStyle = "#941f39";
    context.setLineDash([4, 4]);
    context.beginPath(); context.moveTo(6, y(limit)); context.lineTo(width - 6, y(limit)); context.stroke();
  }
  context.fillStyle = "#126557";
  for (const point of values) {
    if (!Number.isFinite(point.value) || x(point.at) < 6 || x(point.at) > width - 6) continue;
    context.beginPath(); context.arc(x(point.at), y(point.value), 3.4, 0, Math.PI * 2); context.fill();
  }
}
