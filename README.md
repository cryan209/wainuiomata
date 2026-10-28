# Wainuiomata ’02
A browser-based PS2-inspired walking game built on measured local geography. Serve `dist` over HTTP; no build step is required.

WASD/arrows move, mouse looks (drag fallback), Shift sprints, Escape pauses, R returns to Queen Street, M toggles an aerial inspection view. Touch movement and drag-look are supported.

## Geography

- Terrain: LINZ Hutt City LiDAR 1m DEM (2025), with Wellington LiDAR (2013–2014) and the national contour-interpolated 8m DEM filling regional gaps. A 7km square surrounds the town. The browser uses 2m ground samples near town and 20m samples on the horizon, at 1:1 vertical scale.
- Roofs: LINZ Hutt City LiDAR 1m DSM (2025), sampled inside the official footprints and filtered into dominant roof planes. These are derived roof surfaces, not architectural/BIM models. Vegetation, sensor resolution and outline vintage can affect the result. 66 outlines with insufficient above-ground returns are omitted rather than given invented heights.
- Buildings: LINZ NZ Building Outlines, from Hutt City aerial imagery (2021), retrieved through the LINZ-published ArcGIS service. 3,208 building parts are included. Exact polygon corners and courtyard holes are retained, with polygon-based collisions. Roof triangles cover all included footprint area.
- Roads: OpenStreetMap centre lines, projected into NZTM2000 to align with the LINZ survey. Road widths and markings remain schematic. Walking height follows the measured ground.
- Facades, windows and trees remain decorative PS2-style representations.

All geometry uses EPSG:2193 coordinates relative to (1762931.140819, 5430336.934044). The starting ground elevation is 90.849m in the source DEM's vertical datum; heights are not exaggerated.

## Sources and attribution

LINZ elevation catalog: https://nz-elevation.s3.ap-southeast-2.amazonaws.com/catalog.json

2025 DEM: https://nz-elevation.s3.ap-southeast-2.amazonaws.com/wellington/hutt-city_2025/dem_1m/2193/collection.json

2025 DSM: https://nz-elevation.s3.ap-southeast-2.amazonaws.com/wellington/hutt-city_2025/dsm_1m/2193/collection.json

Building outlines: https://services.arcgis.com/xdsHIIxuCWByZiCB/arcgis/rest/services/LINZ_NZ_Building_Outlines/FeatureServer

Sourced from the LINZ Data Service and licensed for reuse under Creative Commons Attribution. Crown copyright reserved. Survey-specific licenses are retained in the metadata: https://www.linz.govt.nz/products-services/data/licensing-and-using-data

Road data © OpenStreetMap contributors, ODbL: https://www.openstreetmap.org/copyright . Three.js r160 is MIT licensed.

## Rebuild geographic assets

With Python 3, numpy, rasterio, pyproj and shapely installed, run `python scripts/prepare_world.py`. This downloads public source windows and caches them under `/private/tmp/wainui-linz`. Run `python scripts/verify_geodata.py` afterward. Verification checks packaged elevation samples against the source DEM, geometry integrity, closed rings, and full roof coverage. Sampling/serialization precision is distinct from the survey's measurement accuracy.
