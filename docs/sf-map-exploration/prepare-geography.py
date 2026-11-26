"""Simplify two pre-downloaded public GeoJSON inputs. No network or third-party packages."""
import json
import math
import sys
from pathlib import Path

def distance(point, start, end):
    x, y, *_ = point
    ax, ay, *_ = start
    bx, by, *_ = end
    denominator = (bx - ax) ** 2 + (by - ay) ** 2
    t = max(0, min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / denominator)) if denominator else 0
    return math.hypot(x - ax - t * (bx - ax), y - ay - t * (by - ay))

def simplify(points, tolerance=0.00006):
    if len(points) < 3:
        return points
    distances = [distance(point, points[0], points[-1]) for point in points[1:-1]]
    maximum = max(distances, default=0)
    if maximum > tolerance:
        split = distances.index(maximum) + 1
        return simplify(points[:split + 1], tolerance)[:-1] + simplify(points[split:], tolerance)
    return [points[0], points[-1]]

def geometry(source):
    polygons = source['coordinates'] if source['type'] == 'MultiPolygon' else [source['coordinates']]
    return [[[[round(x, 5), round(y, 5)] for x, y, *_ in simplify(ring)] for ring in polygon] for polygon in polygons]

def main():
    if len(sys.argv) != 3:
        raise SystemExit('Usage: prepare-geography.py neighborhoods.geojson parks.geojson')
    neighborhoods = json.loads(Path(sys.argv[1]).read_text())
    parks = json.loads(Path(sys.argv[2]).read_text())
    selected = ['Golden Gate Park', 'Lake Merced Park', 'Lincoln Park', 'Mission Dolores Park', 'Twin Peaks', 'Buena Vista Park', 'Alamo Square', 'Bernal Heights Park', 'Glen Canyon Park', 'McLaren Park']
    result = {
        'neighborhoods': [{'name': f['properties']['nhood'], 'polygons': geometry(f['geometry'])} for f in neighborhoods['features'] if f['properties']['nhood'] != 'Treasure Island'],
        'parks': [{'name': f['properties']['property_name'], 'polygons': geometry(f['geometry'])} for f in parks['features'] if f['geometry'] and any(f['properties']['property_name'].startswith(name) for name in selected)],
    }
    output = Path(__file__).resolve().parents[2] / 'public/sf-map-lab/geography.js'
    output.write_text('/* Simplified public DataSF geometry. See SOURCES.md. */\nwindow.SF_GEOGRAPHY = ' + json.dumps(result, separators=(',', ':')) + ';\n')
    print(f'Wrote {output}')

if __name__ == '__main__':
    main()
