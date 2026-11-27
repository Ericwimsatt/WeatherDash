"""Generate data-derived map textures and an illustrative daily-high field.
No network calls. Requires the already downloaded USGS raster, NumPy and Pillow.
"""
from pathlib import Path
import json
import math
import numpy as np
from PIL import Image, ImageDraw, PngImagePlugin

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / 'public/sf-map-lab'
ASSETS = PUBLIC / 'assets'
source = (PUBLIC / 'comparison-fixtures.js').read_text()
data = json.loads(source.split('window.SF_COMPARISON_FIXTURES=', 1)[1].strip().rstrip(';'))

# An engraved hill texture whose marks follow actual downhill DEM gradients.
z = np.asarray(Image.open(Path(__file__).parent / 'data/sf-elevation-usgs.tiff')).astype(float)
z = np.maximum(z, 0)
for _ in range(2):
    p = np.pad(z, 1, mode='edge')
    z = sum(p[y:y+324, x:x+360] for y in range(3) for x in range(3)) / 9
gy, gx = np.gradient(z)
image = Image.new('RGBA', (1080, 972), (0, 0, 0, 0))
draw = ImageDraw.Draw(image)
for row in range(2, 322, 4):
    for col in range(2 + (row % 8), 358, 4):
        dx, dy = gx[row, col], gy[row, col]
        slope = math.hypot(dx, dy)
        if z[row, col] < 55 or slope < 1.25:
            continue
        length = min(7, 2.5 + slope * .55)
        nx, ny = dx / slope, dy / slope
        x, y = col * 3, row * 3
        alpha = int(min(105, 28 + slope * 7))
        draw.line((x-nx*length, y-ny*length, x+nx*length, y+ny*length), fill=(126,95,56,alpha), width=1)
info = PngImagePlugin.PngInfo()
info.add_text('Source', 'USGS 3DEP raster in docs/sf-map-exploration/data/sf-elevation-usgs.tiff')
info.add_text('Transform', 'Slope-aligned cartographic hachures above 55 m; no generated artwork or random noise.')
image.save(ASSETS / 'sf-hill-texture.png', pnginfo=info)

# Smooth IDW field from synthetic daily highs. This is not a meteorological analysis.
width, height = 200, 180
xx, yy = np.meshgrid(np.linspace(0, 1000, width), np.linspace(0, 900, height))
weighted = np.zeros_like(xx)
weights = np.zeros_like(xx)
b = data['bounds']
for point in data['points']:
    px = (point['lon']-b['w'])/(b['e']-b['w'])*1000
    py = (b['n']-point['lat'])/(b['n']-b['s'])*900
    weight = 1 / ((xx-px)**2 + (yy-py)**2 + 1600)**1.2
    weighted += weight * point['high']
    weights += weight
field = weighted / weights
cool = np.array([156,191,224])
middle = np.array([246,239,228])
warm = np.array([231,164,151])
low = np.clip((field-60)/7, 0, 1)[..., None]
high = np.clip((field-67)/7, 0, 1)[..., None]
rgb = np.where((field <= 67)[..., None], cool*(1-low)+middle*low, middle*(1-high)+warm*high)
rgba = np.concatenate([np.rint(rgb).astype(np.uint8), np.full((height,width,1),255,dtype=np.uint8)], axis=-1)
info = PngImagePlugin.PngInfo()
info.add_text('Source', 'Synthetic daily high fixtures in comparison-fixtures.js, revision 6')
info.add_text('Transform', 'Smoothed inverse-distance weighting; display scale 60–74 F; illustrative surface only, not observed or modeled weather.')
Image.fromarray(rgba).save(ASSETS / 'sf-daily-high-gradient.png', pnginfo=info)
print('Wrote slope-derived hill texture and synthetic daily-high gradient.')
