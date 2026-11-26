"""Build local SF terrain treatments from a downloaded public USGS float32 DEM.
Requires numpy, Pillow and matplotlib. Does not download data.
"""
from pathlib import Path
import json
import os
os.environ.setdefault('MPLCONFIGDIR', '/tmp/sf-terrain-matplotlib')
import numpy as np
from PIL import Image, PngImagePlugin
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import runpy

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / 'public/sf-map-lab'
SOURCE = 'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage?bbox=-122.544,37.707,-122.348,37.846&bboxSR=4326&imageSR=4326&size=360,324&format=tiff&pixelType=F32&interpolation=RSP_BilinearInterpolation&adjustAspectRatio=false&f=image'
elevation = np.asarray(Image.open(Path(__file__).parent / 'data/sf-elevation-usgs.tiff')).astype(float)
elevation = np.maximum(elevation, 0)
# One small smoothing pass suppresses raster-scale noise without inventing hills.
for _ in range(2):
    padded = np.pad(elevation, 1, mode='edge')
    elevation = sum(padded[y:y+324, x:x+360] for y in range(3) for x in range(3)) / 9
x = np.linspace(0, 1000, elevation.shape[1])
y = np.linspace(0, 900, elevation.shape[0])
fig, ax = plt.subplots()
contours = ax.contour(x, y, elevation, levels=list(range(20, 321, 20)))
simplify = runpy.run_path(str(Path(__file__).parent / 'prepare-geography.py'))['simplify']
paths = []
for height, segments in zip(contours.levels, contours.allsegs):
    output = []
    for segment in segments:
        if len(segment) < 6:
            continue
        points = simplify(segment.tolist(), .55)
        output.append('M' + 'L'.join(f'{a:.1f},{b:.1f}' for a, b in points))
    paths.append({'m': int(height), 'paths': output})
plt.close(fig)
dy, dx = np.gradient(elevation, 15450 / 324, 17240 / 360)
normal = np.stack([-dx * 1.6, dy * 1.6, np.ones_like(dx)], axis=-1)
normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
light = np.array([-.5, -.5, .7071])
shade = np.clip((1 - (normal * light).sum(axis=-1)) * 170, 0, 110).astype(np.uint8)
rgba = np.zeros((*elevation.shape, 4), dtype=np.uint8)
rgba[:, :, :3] = [72, 79, 58]
rgba[:, :, 3] = shade
info = PngImagePlugin.PngInfo()
info.add_text('Source', SOURCE)
info.add_text('Description', 'Derived shaded relief from public USGS 3DEP elevation; 2 smoothing passes; northwest illumination. Not generated artwork.')
Image.fromarray(rgba).save(OUTPUT / 'assets/sf-hillshade.png', pnginfo=info)
(OUTPUT / 'terrain.js').write_text('/* USGS 3DEP-derived 20 m contours; see REVISION.md. */\nwindow.SF_TERRAIN=' + json.dumps({'bounds': [-122.544,37.707,-122.348,37.846], 'intervalMeters':20, 'contours':paths}, separators=(',',':')) + ';\n')
print('Wrote terrain.js and sf-hillshade.png from USGS DEM.')
