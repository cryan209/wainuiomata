# Wainuiomata ’02
A browser-based PS2-inspired walking game built on measured local geography. Serve `dist` over HTTP; no build step is required.

WASD/arrows move, mouse looks (drag fallback), Shift sprints, Escape pauses, R returns to Queen Street, M toggles a free-flying drone. Space/E ascends, C/Q/Control descends, and Shift boosts the drone. Touch movement and drag-look are supported.

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

## Surface materials

Procedural pixel textures cover grass, asphalt aggregate, jointed concrete, corrugated metal and four facade styles (weatherboard, brick, render, shopfront). Building paint varies deterministically by building ID; roofs now use the actual georeferenced 2025 aerial photographs. Cool daylight, a blue sky and light distance fog replace the earlier warm cast. Appearance remains stylised; these are not photographs of the actual facades. Survey geometry assets are unchanged.

## Day and night

The stylised 24-hour cycle lasts 12 minutes of active play, starting at 16:30. Sunlight, sky, fog, ambient light, moonlight, stars and emissive window masks update continuously. Pausing the game or hiding its tab pauses the cycle. The time panel provides pause/resume, a manual slider (which pauses automatic time), and Dawn / Day / Dusk / Night presets. N skips to the next preset. Lighting depicts a fictional cycle, not date-specific solar ephemerides.

## Actual roof photography

Roof surfaces use a 4096 × 4096 aerial mosaic covering approximately 2.45km square at 0.597m/pixel. UV coordinates are computed from NZTM positions; the photographs are not repeated across buildings. Colour is kept neutral during daylight and dimmed with the existing day–night cycle to avoid lighting an already lit photograph twice. `scripts/prepare_roof_imagery.py` reproduces the mosaic from public georeferenced tiles. Image metadata and extent are in `dist/roof-imagery.json`.

Source: Hutt City Council Aerials_2025 service, urban aerial orthophotography captured 29 March 2025 according to its service description. © NZ Aerial Surveys and Hutt City Council, CC BY 4.0. Changes: downloaded tiles stitched, cropped, resampled and JPEG-compressed; mapped onto derived roof surfaces. https://maps.huttcity.govt.nz/server02/rest/services/Aerials_2025/MapServer . Licence: https://creativecommons.org/licenses/by/4.0/ .

Facade textures use original generated photographic artwork. They depict fictional buildings, not the actual street-facing walls or businesses. Accurate facades would require suitably licensed street-level photographs or textured 3D model data. Photographs and the 2021 building outlines have different capture dates; roof parallax and later building changes can cause local mismatch.

## Expanded valley, rivers and traffic

The playable area is now 6.4km square, within the existing 7km terrain coverage. Streets are clipped 150m beyond the movement boundary, which shows an edge message rather than silently stopping after the former 700m movement limit. OpenStreetMap data covers a larger bounding box and retains node IDs for routing. There are 2,404 mapped road/path ways and 63 bridge-tagged ways (some are separate pedestrian sections of one crossing).

River and stream surfaces follow mapped waterway centre lines, with inferred widths where no width tag exists. Terrain is refined and carved along channels. Bridge decks are inferred from bank elevations and channel clearance; adjacent road approaches share the deck elevations. Generic rails, posts, decks and piers depict crossings, not engineering-accurate bridge designs. Walking follows the bridge surface instead of dropping into the river. Culverted/covered streams are excluded from visible water.

8,514 additional building parts use official LINZ outlines and coarser LiDAR-derived heights (LoD1 extrusions) outside the detailed centre. The original detailed meshes are retained. A wider, lower-resolution georeferenced aerial photograph covers those roofs. All added roof photography has the same Hutt City / NZ Aerial Surveys CC BY 4.0 attribution.

Drone flight uses independent three-dimensional movement and bypasses building/water collisions. It follows mouse pitch; Space/E and C/Q provide vertical motion. Returning to walking finds nearby free ground if the drone is over a building. Controls provides jumps to Queen Street, Fitzherbert Road bridge, the Main Road river bridge and the northern valley.

48 low-poly cars follow connected road nodes and keep left, choose routes at intersections, meet bridge deck heights, slow for cars and nearby pedestrians, and display lights at night. Ten additional parked cars populate the town-centre kerbs. They are ambient traffic, not driveable vehicles.

Run `node tests/movement-network.mjs` for regression coverage of flight collision bypass, altitude, expanded bounds, landing, walking collision, bridge clearance / approach continuity, and traffic routing across a bridge. Rebuild scripts: `scripts/expand_map.py`, `scripts/expand_buildings.py`, `scripts/prepare_wide_imagery.py`.

## Fictional facade and road variety

The facade library uses a photographic atlas of eight fictional house fronts and eight fictional shops, with restrained paint variants across 16 house and 12 shop style slots. Weatherboard, timber grain, brickwork, roughcast, glass, curtains, doors and modest shop signs retain visible material detail. Separate cropped window bays serve upper floors; doors and shop signs only occur at ground level. Matching image-derived window masks light the interiors at night.

Facade bays are anchored to footprint corners at approximately 5.5m intervals. Detailed wall panels are cut at both bay and storey boundaries, preventing partial signs, mid-window material changes and upside-down facades. The cuts preserve wall surface area and the measured footprint. Roof photography and terrain remain unchanged. Run `node tests/facade-mapping.mjs` for bay, winding, storey and wall-area checks. Original generation prompts and saved asset paths are in [ASSET-PROMPTS.md](ASSET-PROMPTS.md).

Road materials distinguish fresh asphalt, weathered asphalt, coarse chipseal, heavy patching, utility repairs, gravel and pavers, based on mapped surface/type tags and a stable street-name seed. UVs follow the street's direction, with longitudinal tyre wear, cracks, repair seams and drain covers. Bridge, pedestrian and track surface rules are distinct. These are deliberately fictional visual treatments, not records of actual business tenants or pavement condition.

## Greenery and the hill tunnel

Procedural planting adds broadleaf trees, conifers, cabbage-tree-like crowns, low shrubs and flax-shaped plants. Street-tree placement is prioritised near the town centre; additional clusters populate the civic lawn, hills and riverbanks. Candidates are rejected near roads, buildings, water channels and tunnel entrances. Planting is decorative and does not claim to reproduce surveyed tree positions. Instanced geometry keeps the additional vegetation batched.

The mapped Wainuiomata Tunnel (OSM way 357697360) is approximately 874m long and marked disused with no public access in the source data. The game uses its mapped alignment with a fictional explorable interior: arched lining, ribs, lighting, portals and an approach apron. The tunnel floor is inferred between source-ground elevations at the portals; dimensions and interior design are not surveyed. This is not a representation of present-day public access.

Terrain and intersecting surface material fragments are clipped at the portals. Walking uses a separate underground floor and wall checks, and does not snap pedestrians on the hill road into the tunnel. Controls provides jumps to either portal. `node tests/tunnel.mjs` verifies subterranean movement, wall collision, exit, separation from the hill surface, and portal clipping, alongside the existing movement/bridge/traffic tests.

## Dense hillside canopy

A second, spatially batched canopy layer turns woodland slopes into continuous bush rather than sparse trees on grass. A coarse appearance mask is inferred from the existing licensed aerial mosaic; it is a visual heuristic, not a surveyed land-cover classification. Tree crowns overlap on a jittered 14m grid, with woodland ground tint, closer trunks and undergrowth. Nearby trunks and shrubs are culled by camera distance, and forest crowns are divided into spatial chunks for frustum culling. Roads, buildings, tunnel entrances and likely clearings remain excluded. Rebuild the mask with `scripts/forest_mask.py`. The original street trees and planting remain.

## Detailed foliage cards

Broadleaf crowns and shrubs now use a transparent atlas with four original photographic foliage variants, carried on three crossed vertical cards and two canopy slices. Alpha testing preserves irregular leaf silhouettes and gaps without transparent sorting; canopy slices retain coverage from the drone. Shared materials, per-instance atlas selection, gentle wind, chunk culling and the existing near-distance trunk/undergrowth limits keep the dense woodland batched. Trunks, cabbage-tree fans and flax remain low-poly geometry. Planting positions remain inferred/decorative.
