# Wainuiomata ’02
A browser-based PS2-inspired walking game built on measured local geography. Serve `dist` over HTTP; no build step is required.

WASD/arrows move, mouse looks (drag fallback), Shift sprints, Escape pauses, R returns to Queen Street, M toggles a free-flying drone. Space/E ascends, C/Q/Control descends, and Shift boosts the drone. G boards a helicopter for fast travel (W/S forward/back, A/D or mouse turn, Space/E climb, C/Q descend, Shift boost to about 575 km/h and faster climbs, up to 3,000 m); G, F or M lands it on nearby free ground and returns you to walking. A HELI touch button and a Controls travel entry do the same. B hops on a bicycle (W pedal, S/Space brake, A/D steer, Shift pedal harder to about 54 km/h); it coasts downhill, slows on climbs and in shallow water, uses walking collisions, and B, F or G gets off and leaves it parked. A BIKE touch button and a Controls travel entry do the same. U rides a road motorbike and Y a dirt bike (W throttle, S/Space brake, A/D steer, Shift full power, E wheelie or pull the nose up in the air, H horn; the same key gets off). They run a geared engine voice, lean into corners and leave the ground off crests and drops: the road bike reaches about 215 km/h, while the dirt bike tops out near 130 km/h but climbs steeper steps and soaks up landings. MOTO and DIRT touch buttons and Controls travel entries do the same. Touch movement and drag-look are supported.

Run `node tests/motorbike.mjs` to check motorbike throttle, steering, braking, jumps, landings, wheelies and parking. Run `node tests/driving.mjs` to check vehicle controls, collision handling, meshes, entry/exit and train direction selection.

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

The 24-hour cycle lasts 12 minutes of active play and starts at the current date and time in Pacific/Auckland. Sun and moon positions are calculated independently using SunCalc 1.9.0 (MIT), from the player's inverse-projected NZTM2000 coordinates and simulated timestamp. Seasonal daylight, lunar illumination, and New Zealand daylight saving are reflected in the sky. Dates advance at midnight. The date picker and time slider allow manual exploration; the slider pauses time. Dawn and Dusk presets use calculated twilight times. Pausing the game or hiding the tab pauses the cycle. The low precision lunar model and stylised disc brightness are approximate, not an observatory-grade ephemeris.

## Actual roof photography

Roof surfaces use a 4096 × 4096 aerial mosaic covering approximately 2.45km square at 0.597m/pixel. UV coordinates are computed from NZTM positions; the photographs are not repeated across buildings. Colour is kept neutral during daylight and dimmed with the existing day–night cycle to avoid lighting an already lit photograph twice. `scripts/prepare_roof_imagery.py` reproduces the mosaic from public georeferenced tiles. Image metadata and extent are in `dist/roof-imagery.json`.

Source: Hutt City Council Aerials_2025 service, urban aerial orthophotography captured 29 March 2025 according to its service description. © NZ Aerial Surveys and Hutt City Council, CC BY 4.0. Changes: downloaded tiles stitched, cropped, resampled and JPEG-compressed; mapped onto derived roof surfaces. https://maps.huttcity.govt.nz/server02/rest/services/Aerials_2025/MapServer . Licence: https://creativecommons.org/licenses/by/4.0/ .

Facade textures use original generated photographic artwork. They depict fictional buildings, not the actual street-facing walls or businesses. Accurate facades would require suitably licensed street-level photographs or textured 3D model data. Photographs and the 2021 building outlines have different capture dates; roof parallax and later building changes can cause local mismatch.

## Expanded valley, rivers and traffic

The playable area is now 6.4km square, within the existing 7km terrain coverage. Streets are clipped 150m beyond the movement boundary, which shows an edge message rather than silently stopping after the former 700m movement limit. OpenStreetMap data covers a larger bounding box and retains node IDs for routing. There are 2,404 mapped road/path ways and 63 bridge-tagged ways (some are separate pedestrian sections of one crossing).

River and stream surfaces follow mapped waterway centre lines, with inferred widths where no width tag exists. Terrain is refined and carved along channels. Bridge decks are inferred from bank elevations and channel clearance; adjacent road approaches share the deck elevations. Generic rails, posts, decks and piers depict crossings, not engineering-accurate bridge designs. Walking follows the bridge surface instead of dropping into the river. Culverted/covered streams are excluded from visible water.

Hydrology retains complete mapped ways across the expanded region, including Te Awa Kairangi / Hutt River through Upper Hutt and its tributaries. River meshes load and unload near the camera; channel physics, terrain carving and vegetation clearance use the full mapped network. Run `node tests/regional-rivers.mjs` to check regional coverage, connected Hutt River water levels and mesh streaming against the bundled geography.

Closed mapped lakes, ponds and open reservoirs also have streamed water surfaces, minimap fills, shallow shore beds, swimming/diving and vegetation clearance. Their level is inferred from the lower fifth of shoreline terrain samples; depths are illustrative rather than surveyed bathymetry. Open/partial outlines, covered tanks and river-area polygons are excluded from this standing-water layer. Run `node tests/inland-water.mjs` for the Pencarrow lakes, Avalon Park, Karori and Stuart Macaskill reservoirs, shoreline physics and streaming cleanup.

8,514 additional building parts use official LINZ outlines and coarser LiDAR-derived heights (LoD1 extrusions) outside the detailed centre. The original detailed meshes are retained. A wider, lower-resolution georeferenced aerial photograph covers those roofs. All added roof photography has the same Hutt City / NZ Aerial Surveys CC BY 4.0 attribution.

Drone flight uses independent three-dimensional movement and bypasses building/water collisions. It follows mouse pitch; Space/E and C/Q provide vertical motion. Returning to walking finds nearby free ground if the drone is over a building. Controls provides jumps to Queen Street, Fitzherbert Road bridge, the Main Road river bridge and the northern valley.

144 moving vehicles follow connected road nodes and keep left, choose routes at intersections, meet bridge deck heights, slow for cars and nearby pedestrians, and display lights at night. Ten additional parked cars populate the town-centre kerbs. Press F to drive the nearest car, or T to take control of the commuter train. F exits either vehicle. Cars use W/S for throttle and reverse, A/D to steer and Space to brake, with a chase camera and building, pole, fence and region-boundary collision checks. Water entry uses drag, gravity, flooding and sinking instead of an invisible wall. Trains use W/S to add or reduce power, Space to brake, and A/D to stop and select the route direction. Train travel follows the mapped rails and stops at route ends. Both modes are also available from the Controls travel menu; touch buttons support driving. Cars have shaped body panels, sloping glass cabins, paint-matched roofs, round tyres, alloy rims, mirrors, bumpers, plates and paired lights. Exited cars remain where you leave them; wet or airborne cars continue settling.

Run `node tests/movement-network.mjs` for regression coverage of flight collision bypass, altitude, expanded bounds, landing, walking collision, bridge clearance / approach continuity, and traffic routing across a bridge. Rebuild scripts: `scripts/expand_map.py`, `scripts/expand_buildings.py`, `scripts/prepare_wide_imagery.py`.

## Fictional facade and road variety

The facade library uses a photographic atlas of eight fictional house fronts and eight fictional shops, with restrained paint variants across 16 house and 12 shop style slots. Weatherboard, timber grain, brickwork, roughcast, glass, curtains, doors and modest shop signs retain visible material detail. Separate cropped window bays serve upper floors; doors and shop signs only occur at ground level. Matching image-derived window masks light the interiors at night.

Facade bays are anchored to footprint corners at approximately 5.5m intervals. Detailed wall panels are cut at both bay and storey boundaries, preventing partial signs, mid-window material changes and upside-down facades. The cuts preserve wall surface area and the measured footprint. Roof photography and terrain remain unchanged. Run `node tests/facade-mapping.mjs` for bay, winding, storey and wall-area checks. Original generation prompts and saved asset paths are in [ASSET-PROMPTS.md](ASSET-PROMPTS.md).

Road materials distinguish fresh asphalt, weathered asphalt, coarse chipseal, heavy patching, utility repairs, gravel and pavers, based on mapped surface/type tags and a stable street-name seed. UVs follow the street's direction, with soft wheel polishing, fine cracks and restrained repair seams. Bridge, pedestrian and track surface rules are distinct. These are deliberately fictional visual treatments, not records of actual business tenants or pavement condition.

## Greenery and the hill tunnel

Procedural planting adds broadleaf trees, conifers, cabbage-tree-like crowns, low shrubs and flax-shaped plants. Street-tree placement is prioritised near the town centre; additional clusters populate the civic lawn, hills and riverbanks. Candidates are rejected near roads, buildings, water channels and tunnel entrances. Planting is decorative and does not claim to reproduce surveyed tree positions. Instanced geometry keeps the additional vegetation batched.

The mapped Wainuiomata Tunnel (OSM way 357697360) is approximately 874m long and marked disused with no public access in the source data. The game uses its mapped alignment with a fictional explorable interior: arched lining, ribs, lighting, portals and an approach apron. The tunnel floor is inferred between source-ground elevations at the portals; dimensions and interior design are not surveyed. This is not a representation of present-day public access.

Terrain and intersecting surface material fragments are clipped at the portals. Walking uses a separate underground floor and wall checks, and does not snap pedestrians on the hill road into the tunnel. Controls provides jumps to either portal. `node tests/tunnel.mjs` verifies subterranean movement, wall collision, exit, separation from the hill surface, and portal clipping, alongside the existing movement/bridge/traffic tests.

## Dense hillside canopy

A second, spatially batched canopy layer turns woodland slopes into continuous bush rather than sparse trees on grass. A coarse appearance mask is inferred from the existing licensed aerial mosaic; it is a visual heuristic, not a surveyed land-cover classification. Tree crowns overlap on a jittered 14m grid, with woodland ground tint, closer trunks and undergrowth. Nearby trunks and shrubs are culled by camera distance, and forest crowns are divided into spatial chunks for frustum culling. Roads, buildings, tunnel entrances and likely clearings remain excluded. Rebuild the mask with `scripts/forest_mask.py`. The original street trees and planting remain.

## Detailed foliage cards

Broadleaf crowns and shrubs now use a transparent atlas with four original photographic foliage variants, carried on three crossed vertical cards and two canopy slices. Alpha testing preserves irregular leaf silhouettes and gaps without transparent sorting; canopy slices retain coverage from the drone. Shared materials, per-instance atlas selection, gentle wind, chunk culling and the existing near-distance trunk/undergrowth limits keep the dense woodland batched. Trunks, cabbage-tree fans and flax remain low-poly geometry. Planting positions remain inferred/decorative.

## Building sides, verandas and protected open spaces

Street-facing walls are selected from nearby mapped roads, including corner frontages. Side/rear faces use continuous photographic weatherboard, brick, timber, stucco, concrete or corrugated-metal cladding at material-specific scales. Sparse framed window overlays add glazing without a whole front-wall patch, door or sign. Original material art is saved in `dist/assets/building-surfaces-v1.png`; the supplied Queen Street photograph informed the fictional material and veranda style. Prompts and generation mode are recorded in ASSET-PROMPTS.md.

Commercial street frontages receive flat or occasionally sloped verandas with textured tops and soffits, fascia trim and narrow support posts. A paved strip follows the ground under each veranda. Post collision leaves the covered walkway open. Frontage choice, canopy dimensions and window positions are inferred visual details, not surveyed architecture.

`dist/open-spaces.json` extracts 158 mapped park-lawn interiors, grass areas, pitches and playgrounds from the retained OpenStreetMap dataset. Sports fields receive a clearance buffer; smaller urban parks retain an 8m edge band and mapped woodland areas. Both planting systems reject protected interiors, and woodland ground tint is suppressed on the lawns. Large wooded reserves are not blanket-cleared. Regenerate with `scripts/prepare_open_spaces.py` using the retained OSM cache. `tests/building-environment.mjs` checks real named park exclusions, frontage assignment, veranda collision and roof-tile slope/area continuity.

## Streamed high-resolution roof photography

Roof detail now comes from newly requested council aerial imagery sampled at 12.5cm/pixel in the detailed centre and 25cm/pixel in the surrounding valley, rather than enlarging the former 59.7cm and 238.9cm/pixel images. Spatial 256m tiles retain roof-footprint pixels plus a 3m imagery/parallax margin. Source imagery is © NZ Aerial Surveys / Hutt City Council (2025 urban); rural imagery is AAM NZ Ltd / Greater Wellington Regional Council (2021), CC BY 4.0, as documented by the council service.

`dist/roof-detail.json` records the 309 georeferenced tiles. Measured roof triangles are clipped at texture-tile boundaries without changing their slopes or total surface area. Nearby detail textures load on demand with three concurrent requests and an 18-million-pixel resident selection budget (about 96MiB including RGBA mipmaps). Distant roofs, failed requests and tiles awaiting download retain the existing lower-resolution roof maps. Linear sampling and anisotropic filtering retain detail at oblique drone angles. Rebuild with `scripts/prepare_roof_detail.py`; downloaded source images are cached outside the project.

## Lower Hutt, Petone and Eastbourne expansion

The playable bounds now span 15km east–west by 19.5km north–south, extending across the hill into Lower Hutt, Petone, the eastern harbour bays and Eastbourne. The regional terrain extends 500m farther on each side. Upper Hutt is outside the intended first expansion; the rectangular coverage also includes surrounding hills and some western background suburbs.

A new 25m ground grid uses 2025 Hutt City LiDAR, Wellington 2013–2014 LiDAR and national 8m contour DEM gaps at true vertical scale. It blends into the retained 20m town horizon and original 2m Wainuiomata centre. The detailed town's terrain, surveyed roof meshes and building outlines are unchanged. The regional four-metre DEM/DSM processing cache supplies approximate heights for 47,497 additional official footprint parts; 2,744 parts without suitable roof returns are omitted. These new buildings are LoD1 extrusions, not architectural roof reconstructions.

OpenStreetMap supplies the expanded street/path network, shoreline, wharves, beaches and place names. Shoreline polygonisation retains Wellington Harbour and its islands; a raster shoreline mask removes land triangles over the sea. Water appearance and mean sea level are fictional visual treatments, not tide or bathymetric predictions. Twenty-two mapped beach areas receive a simple sand/pebble treatment. Mapped piers use simplified raised timber decks and support geometry. Both marine and river crossing clearances are inferred.

Regional buildings are packaged in 408 spatial JSON files. Nearby footprint geometry, facades, sparse side windows, shop verandas and woodland load on demand; distant buildings use simplified oriented boxes. Scenery unloads after leaving the surrounding area. At most two background scenery requests run concurrently, with a pinned load during quick travel. Woodland is inferred from mapped woods, licensed aerial appearance and slope, and respects the enlarged park/playing-field exclusion set (1,582 clearings).

The new districts have 303 additional roof images, sampled around 0.5m/pixel and georeferenced to each chunk's full footprint bounds. They stream within a 16-million-pixel nearby selection budget; simpler coloured roof surfaces remain while imagery loads or farther away. Wainuiomata retains its finer 12.5–25cm/pixel detail. Regional imagery has the same Hutt City/NZ Aerial Surveys/AAM NZ/GWRC CC BY attribution as the existing roof imagery.

Controls → **Explore the region** adds Lower Hutt/High Street, Petone waterfront, Days Bay/coast and wharf, and Eastbourne waterfront. Drone mode is retained through travel; walking returns to a nearby free land point. The minimap now displays harbour water and clips distant roads from its local view. Walking blocks harbour water except mapped bridges/wharves; drone flight remains independent of ground collision.

Rebuild scripts: `prepare_regional_map.py`, `prepare_regional_terrain.py`, `prepare_regional_buildings.py`, `prepare_regional_coast.py`, `prepare_regional_roofs.py`, followed by `prepare_open_spaces.py`. Source downloads remain in `/private/tmp` caches rather than the deployment. Run `node tests/regional-expansion.mjs` alongside the existing geometry, movement/network and tunnel checks. It verifies expanded bounds, coastline orientation, raised pier traversal, four mapped travel points and streamed-building index completeness.

## Weather, moving shadows and railways

Controls now offers Clear skies, Overcast, Rain, Valley mist and Changing weather, plus a Sun shadows toggle. The weather is a fictional simulation: cloud layers drift, rainfall follows the nearby view, roads darken and gain a restrained wet sheen, and fog/sky/light levels change with the selected conditions. Automatic weather transitions are independent of the day/night clock. Time and weather remain separate controls.

A camera-following 2048px PCF sun-shadow map covers nearby terrain and objects and updates at a bounded cadence. Terrain uses its actual geometry and shoreline/tunnel clipping in the depth pass. Alpha-tested leaf cards use matching atlas selection and wind in their shadow material. Photographic roof materials retain their neutral colours and receive a separate shadow overlay. The shadow toggle removes the depth-map work for lighter rendering.

`railways.json` adds 195 mapped track-way pieces, about 64.8km in total, with sleepers, ballast, steel rails, bridge decks/supports and overhead wires where the source marks electrification. Station/platform geometry is simplified. The gauge is 1.067m, following KiwiRail's published glossary: https://www.kiwirail.co.nz/about-us/glossary/ . © OpenStreetMap contributors, ODbL, supplies alignments and station locations; LINZ DEM samples supply inferred, smoothed vertical profiles. They are visual approximations, not surveyed railway engineering data.

An ambient two-car commuter unit follows a connected Petone–Pōmare path and reverses at its ends. Its rolling stock, speed and service are fictional. Disconnected or incomplete mapped alignments do not carry an invented through-service. Petone and Waterloo station jumps are available in Explore the region, and rail corridors appear on the minimap. Planting avoids the track corridor; open station canopy roofs retain their roofs/supports without solid building walls.

Rebuild rail data with `scripts/prepare_railways.py` and `scripts/rail_profile.py`, using the retained OSM and regional DEM caches. `node tests/weather-railways.mjs` checks preset visibility, route sampling, gauge, station coverage, connectivity and smoothed grades. Existing movement, geography, roof, bridge and tunnel checks remain applicable.

The commuter train also has a drone-view jump in Explore the region, and its current position is marked on the minimap. Station canopy footprints are kept as open roof-and-post structures near the tracks. Trackbed terrain refinement and bridge-aware walking heights keep the rail alignment visible without lifting pedestrians onto overhead rail bridges.

## Wainui classics fleet

Traffic and parked cars cycle through six era-inspired, locally modelled designs: Holden Commodore VN, Ford Falcon EB, Nissan Skyline R32, Toyota Corolla AE92 hatch, Toyota Hilux LN106 and Subaru Legacy BG wagon. These are simplified interpretations, not manufacturer-supplied models or a survey of local car ownership. Each has different proportions, cabin profiles, wheelbases and paint palettes. Skyline round taillights, sedan spoilers, Corolla hatchback glass, the Hilux open tray and raised ride height, and the Legacy long roof and roof rails distinguish the silhouettes. Geometry is instanced per model and material to keep traffic rendering efficient. The driving HUD names the current model; Controls → Explore the region offers each model directly. Vehicle collision footprints follow model width and length.

Run `node tests/classic-cars.mjs` for fleet coverage, body geometry and model selection checks.

The everyday wagon additions are Mitsubishi Magna TR, Mitsubishi Lancer, Toyota Corolla AE100 and Toyota Caldina T190 interpretations. These use subdued beige, white, silver, blue-grey and green paint, plain steel-wheel styling and unadorned long roofs; the Lancer and Corolla have taller rear lamps. All four appear in traffic and the model selection menu.

## Vans and buses

Toyota Hiace passenger and Mitsubishi L300 panel van interpretations join the fleet, along with fictional Valley city and school buses. Cab-over bodies, tall roofs, passenger windows or solid cargo panels, door seams and mirrors distinguish the vans. The buses have window rows, passenger doors, destination panels, side stripes, rear vents and larger wheels. All four can be selected in Controls → Explore the region and driven with the existing F / WASD / Space controls. Buses accelerate and turn more slowly, have a lower maximum speed and use a wider, higher chase camera. Collision probes cover the longer body, and traffic following distances account for vehicle length. Bus spawning prefers wider roads; these are ambient vehicles rather than scheduled bus services.

## Road grading and ride smoothing

Road surfaces now use a smoothed centre-line elevation profile, shared across their full width instead of sampling hillside elevation separately at each edge. Endpoints retain common node elevations and bridge approaches meet the deck. Terrain under non-bridge roads is graded to the roadbed and blends back into the surveyed terrain across a four-metre shoulder. This is a gameplay approximation of road cuts, not an engineering survey. Road meshes use two-metre longitudinal sections; coarse terrain gains detail near roads to avoid protruding through the roadbed. Traffic derives pitch from front/rear axle samples and damps pitch and turning with frame-rate-independent interpolation; driving uses a damped chase camera.

Run `node tests/road-smoothing.mjs` for hillside cross-sections, joins, terrain grading, profile smoothness and traffic pitch through segment ends.

Driving frame synchronisation: player movement now runs before traffic instance matrices are uploaded, so the camera and vehicle use the same simulation frame. The chase camera inherits vehicle translation immediately and smooths the remaining view offset, preventing frame-time changes from varying the apparent following distance. Run `node tests/driving-frame-sync.mjs` for variable-frame-time coverage and render-order regression checks.

## Forest parks and Wainuiomata south coast

The playable bounds now span 18 × 29.5 km, extending east into the forest park and south along Coast Road to the Wainuiomata coast. New OpenStreetMap road/path, river and shoreline data are merged with the existing region. The expansion uses LINZ national contour DEM data sampled onto a 25m grid; the existing urban LiDAR grids remain unchanged. This rural terrain is coarser than the town and does not depict every track cutting or structure. Woodland multipolygons, including Remutaka forest coverage, now contribute to the forest mask with their clearings preserved.

Controls → Explore the region adds Wainuiomata Regional Park at Hine Road, the Reservoir Road trails, Remutaka Forest Park at Catchpool Valley and the Coast Road beach. Public paths are mapped; dams, visitor buildings and a complete set of rural buildings have not been recreated. References: [Greater Wellington Wainuiomata Regional Park](https://www.gw.govt.nz/parks/wainuiomata-regional-park/) and [East Harbour Regional Park](https://www.gw.govt.nz/parks/east-harbour-regional-park/).

Rebuild using a Python environment with numpy, rasterio, pyproj, shapely and Pillow: `python scripts/expand_south.py`, `python scripts/prepare_park_woodland.py`, then `python scripts/prepare_regional_coast.py`. These retrieve public OSM and LINZ data and retain geographic caches under /private/tmp.

Driving now uses a fixed 120Hz physics step, interpolates the displayed vehicle between steps and positions the chase camera from that exact same displayed pose. Forward motion and steering therefore keep a fixed camera offset, rather than feeding two independent smoothing loops.

## Performance, streaming and LOD

Terrain GPU geometry is generated in 400m tiles around the camera rather than one full-region mesh. Four distance bands use 2m, 8m, 25m and 100m sampling, with skirts at tile boundaries, a roughly 3ms per-frame generation budget, hysteresis at LOD transitions and disposal outside the resident radius. Survey arrays still load at startup; this is geometry streaming, while regional buildings and roof photography use HTTP streaming. Travel waits for nearby terrain and regional collision scenery before placing the player. Collision and driving elevations continue to use the source ground sampler, independently of visual LOD.

Roads are partitioned into 512m spatial groups with individual mesh bounds and distance culling. Local forest canopies use five, two or one cards with distance; trunks and undergrowth have shorter ranges. Regional buildings generate incrementally, use simpler distant proxies and release distant data/geometry; roof photo budgets are reduced. Shadows use a 1024px map updated at most around eight times a second, and streamed terrain shares its shadow depth material. Beyond the ~5km streamed-tile range, one coarse 150m-sampled mesh of the whole region shows the distant hills; a per-tile mask hides it wherever a streamed tile is shown, so it also fills gaps while tiles load. Clear-weather fog now extends to about 18km so the surrounding hills stay visible; rain and mist keep their short visibility.

Press P for FPS, frame time, draw calls, triangles, terrain queue and loaded scenery counts. Controls → Graphics provides 50%, 65% (default), and 85% resolution options. These options change render resolution; world scale and driving physics remain the same.

Run `node tests/terrain-stream.mjs` for LOD geometry reduction, near-ground accuracy, bounded initial loading and GPU disposal. The 100m tile has approximately 1,275 times fewer triangles than a 2m tile including their skirts; this is not an FPS comparison.

## River clearance and aerial ground textures

Local dense forest, streamed regional forest and planted greenery all exclude mapped water channels using the full crown radius plus a two-metre bank margin. This prevents trees with dry trunks from projecting their canopies across the river. Channel widths remain inferred where OSM supplies no width.

Streamed terrain now uses the already loaded, georeferenced 2025 aerial mosaics: approximately 7.3km of wider imagery, with the 2.45km central mosaic layered at higher detail. The images use the same NZTM-aligned extents as the roofs and blend at their boundaries; procedural grass remains beyond coverage. Shader sampling reuses the two existing GPU textures and keeps the terrain LOD and geometry-streaming budgets. Photographs may contain historical tree shadows and vegetation, which are baked into the imagery rather than 3D trees. Existing Hutt City / NZ Aerial Surveys CC BY 4.0 attribution applies.

Run `node tests/rivers-imagery.mjs` for crown clearance, bank margins, aerial UV orientation and texture/shader reuse.

## Crossing structures and native aerial detail

River crossings now have end abutments, raised edge kerbs and two-height rails. Short bridge segments leave the channel free of a central pier; long spans retain supports. Roadbed grading no longer fills mapped channels at bridge approaches. These are visual/physical approximations, not replicas of surveyed bridge structures.

Ground photography now streams the original unmasked aerial tiles from the licensed roof-source cache: 309 packaged tiles at 0.125–0.25m/pixel where available. Four nearby tiles at most (16 megapixels, two concurrent requests) are sampled directly on the terrain, with smooth edge fades, mipmaps, linear filtering and 8× anisotropy. Distant areas keep the coarse mosaics. Leaving an area disposes the high-detail textures. Rebuild the package with `python scripts/prepare_ground_detail.py` after downloading source tiles using the roof-detail preparation script. No low-resolution image is enlarged to create detail.

Quality now renders at 100% viewport resolution by default, Balanced at 75%, and Performance at 50%. Forced pixelated canvas scaling and scanlines are removed; procedural surface textures use filtered sampling. Full source-image attribution remains in the ground-detail manifest and Controls. Run `node tests/crossings-detail.mjs` for bridge clearance, structural geometry and texture coverage/budgets.

## Two-lane bridge decks and sound

Parallel OSM bridge-sidewalk ways now share the adjacent road bridge deck and height instead of generating separate kerbs, abutments and rails inside the carriageway. Vehicle water-crossing checks accept any containing bridge footprint, so a narrow nearby sidewalk cannot hide the wider road deck. Bridge centre lines run continuously across short segments. `node tests/bridge-lanes.mjs` checks shared sidewalks and full-sized cars crossing in both lanes.

Procedural Web Audio effects add engine revs, tyre/rail rumble, wind/rain, nearby river water and H horns for the driven car or train. Sound starts after the Play gesture, pauses with play and silences when the page is hidden. Controls provides a volume slider and mute checkbox. These are lightweight synthesised effects, not recordings of the named vehicles. No audio files are downloaded. Run `node tests/sound.mjs` for gesture startup, context reuse, driving audio, pause and mute.

## Residential property fences

Nearby residential properties gain low front fences and taller side/rear timber fences, with four-metre driveway openings and separate pedestrian gaps. Suggested yard envelopes are inferred from footprints and street direction, not surveyed legal property parcels. Shops, large commercial buildings, public open spaces, roads, mapped waterways and obstructed runs are excluded. Some fence runs are omitted where an inferred boundary would cross another building or public access.

Fences build incrementally in spatial chunks, use instanced panels/posts, hide at distance and provide spatially indexed collision checks. Regional fences unload with their building chunks. Run `node tests/fences.mjs` for layouts, gates, collisions, river clearance and disposal.

## Parallel paths and grade-separated crossings

Overlapping, parallel sidewalk/cycleway segments at the same mapped layer now share the road pavement and height. Turning segments, paths outside the pavement envelope and paths on other layers keep their own geometry. Footpaths no longer generate duplicate road ribbons or bridge barriers, and carriageways take precedence over incidental paths inside traffic lanes. Road edges use common offset joins at bends. Explicit lane counts guide width where no mapped width is supplied.

Road surface selection uses the player's current foot elevation to distinguish an overbridge from the lower road. Upper bridge decks receive inferred clearance above intersecting lower-layer roads and ground-level railway tracks; approach nodes follow the raised deck, terrain grading follows the lower route, and central piers are omitted where they would obstruct a crossing. Lower-road profiles remove local DEM deck imprints using ground samples beyond the span. Railway and road surfaces are compared by elevation instead of always selecting railway height first. Clearances are gameplay approximations, not measured bridge engineering data.

Controls → Explore the region includes a Dowse Drive overbridge drone view. Run `node tests/road-topology.mjs` for shared and independent path segments, layer separation, lower-road node crossings, overbridge/rail clearance, ramp continuity, underpass ground profiles and joined road edges.

Adjacent, overlapping bridge carriageways on the same mapped layer now align deck elevations and omit edge kerbs/rails where those would lie inside the neighbouring carriageway. They keep their independent traffic connectivity and lane markings. The topology regression includes a divided bridge with different initial DEM heights and verifies no interior guardrails remain.

## Junction surface clipping and continuous bridge joints

Road concrete is now rendered as shoulder strips, with intersecting carriageway footprints subtracted geometrically. Same-height asphalt overlaps have deterministic ownership instead of drawing duplicate coplanar surfaces; markings are clipped back at intersecting routes. Bridge kerbs and rails open at same-level branches, including connections to different road names. Bridge undersides follow the road's curved offset edges rather than straight rectangular beams, and internal bridge-to-bridge joins omit abutment walls.

Connected bridge sections now share one elevation at each mapped node, preserving clearance while removing steps between differently classified road sections. Pedestrian crossings tagged on a bridge share its roadway rather than receiving independent bridge rails. `node tests/road-clipping.mjs` checks union area and open lanes/exits; `node tests/dowse-junction.mjs` checks eight shared joints and pedestrian crossings using the actual packaged Dowse OSM geometry. These are stronger regression checks than the earlier isolated bridge examples.

The junction renderer caches candidate overlap pairs per road segment, so surface subtraction does not repeatedly scan the spatial index for every triangle. The current Dowse browser view was rechecked after these changes; the earlier screenshot was not sufficient evidence that its road geometry was correct.

## Gradual approaches and filled junction surfaces

The fixed 25m approach ramp is followed by a connected road-grade solve: sampled road edges limit rise per metre and extend an approach as far along its actual connected route as needed. Primary/highway routes target 8% maximum grade, other motor roads 12%, and paths 25%; steps retain their source profile. This is an inferred gameplay road profile, not an engineering model. Shared junction samples form short level platforms, with nearby platforms on very short connecting links sharing one elevation.

Connected junctions are rendered as single convex asphalt patches, and their footprints are subtracted from the incoming road ribbons. Patch geometry and movement height use the same elevation. This fills the spaces that independent ribbons left at branching joins. Kerbs, rails and property fences are excluded from those junction interiors.

The Dowse regression now samples the actual packaged terrain rather than flat dummy ground: it verifies 12,000+ grade samples, shared deck joints, rendered junction coverage using downward raycasts, collision/render agreement and absence of rail/kerb intrusions.

The grade solver uses packed adjacency arrays rather than per-sample graph objects. Build-time clipping caches and duplicate geometry staging arrays are released after mesh construction. Road widths are flat cross-sections, so they no longer receive unnecessary subdivisions across their width; ordinary longitudinal road sections use 4m sampling and bridge sections retain 2m sampling. Independent footpaths no longer get generic concrete road shoulders. `node --max-old-space-size=1024 tests/road-map-memory.mjs` builds the full packaged regional road network as a resource regression. `node tests/road-approaches.mjs` checks an elevated crossing whose gradual approach must extend beyond the old 25m ramp.

Bridge rails and structural faces also receive a final carriageway-clearance pass, including outside junction footprints. The real-terrain Dowse regression checks all traffic lanes for protruding structure vertices, in addition to 68 rendered surface probes and bounded approach grades. The full-map resource regression completes with a 1 GB Node heap budget.

Passenger cars now have smooth curved body shells, slender flush window frames, inset rounded tyres, model-dependent trim, detailed wheels and clear-coated paint with shared reflection maps. Headlights and tail lamps brighten with the day/night cycle. Number plates use a locally generated texture. These remain procedural approximations of the named vehicles.

The instanced fleet uses detailed meshes within 80 metres and keeps them until 100 metres to avoid repeated switching near the boundary. The driven vehicle always retains its detailed mesh. Distant traffic uses the simpler shells; instance slots and paint colours are rebuilt together each frame. Close models have a 32,000-triangle budget. The model viewer at `/car-model-preview.html` displays the detailed vehicles. Run `node tests/classic-cars.mjs`, `node tests/driving.mjs` and `node tests/driving-frame-sync.mjs` to check geometry, open wheel arches, LOD switching, drive controls and current-frame rendering.

Vehicle lights use shallow curved lens surfaces and shared prismatic/reflector textures. Indicators sit within the headlamp outline; rear red, amber and reversing sections share one contour. Vans and buses use shallow rounded lens skins, too. Light textures are generated locally and emissive detail is retained at night.

All fourteen vehicles have nearby interiors: right-hand-drive dashboards, instruments and steering wheels, seats and headrests, gear levers, door trim, floor and roof lining. Passenger cars have rear benches, wagons and vans retain cargo space, and buses have seat rows around a centre aisle. Nearby windows use lightly tinted transparent glazing, with real openings in the body panels; distant vehicles omit interior geometry and use opaque glass. Interiors remain part of each model/material instance batch.

People: up to 56 local pedestrians walk safe pavement and footpath sections, with varied clothing, skin tones, heights, articulated walking and idle pauses. Routes reject carriageways, rail tracks, water, buildings and fences. Pedestrians yield to other walkers and keep clear of vehicles. The crowd is populated around the player and distant walkers are released. Moving vehicles have right-hand-drive seated drivers, rendered from the current vehicle transform. All people share six instanced render batches; facial and arm details are omitted at a distance. Press P to see the local walker count. Run `node tests/people.mjs` for placement, movement, collision avoidance, pause, batching and culling checks.

Street furniture follows the supplied Short Street references: mixed timber and concrete poles, crossarms and ceramic insulators, occasional ribbed transformers, sagging overhead power/telecom spans, and modest outreach street lamps. Street-name blades use real adjoining road names, abbreviated white lettering and borders on green panels, with two-sided text and metal bands on concrete poles. Placement is procedural rather than a survey of individual utility assets. Nearby 240 m scenery chunks are built and distant chunks are released; two shadowless spotlights supplement warm lamp lenses and ground pools at night. Pole bases are solid, clear carriageways and tracks, and parked-car placement checks the pole plan. The travel menu includes Short Street · Bledisloe Crescent. Run `node tests/street-furniture.mjs` for reference-junction labels, mounting, verge clearance, geometry, collisions and the night-light budget.

Street-service styles: public urban roads now include unnamed streets and public service streets, while private driveways, parking aisles and unlit high-speed rural roads are excluded. Concealed-supply streets use slim standalone steel lamp columns, without crossarms, transformers or overhead spans. Bridges also use concealed-supply lamps. Explicit supply tags and reference overrides take priority; the supplied Short Street and Bledisloe Crescent references stay overhead. Most imported roads have no utility metadata, so unknown streets use a stable visual mix by street name rather than claiming surveyed underground/overhead coverage. Standalone lamps and overhead poles use the same streamed lighting and collision system.

## Swimming and water entry

Mapped river and stream centrelines now use smooth channels, gradual downhill profiles and joined confluence levels. Rounded beds become shallow toward the banks. Flowing ripples, depth colour, edge glints, textured gravel and instanced bank stones replace flat ribbons of water. River meshes stream in 300m chunks near the camera and unload at distance. Terrain is cut beneath the visible channel to keep coarse ground triangles out of the water.

Walk into shallow water to wade and deeper water to swim. WASD swims, Shift swims faster, Space/E rises, and C/Q/Control dives; looking up or down also changes forward swimming direction. The bed stops downward movement. Underwater visibility, tint and muffled audio recover on resurfacing. Bridge support is checked against the player's height, so swimming underneath does not snap you onto a bridge deck. The coast also supports swimming and diving over an approximate seabed.

Cars splash on entry, lose speed in water, flood their engines and gradually settle. Shallow water can leave a flooded car grounded with its roof exposed; sufficiently deep water submerges it. F exits into the surrounding water. R while driving recovers the car onto the nearest drivable road (within 400 m), in the left lane facing its current heading and clear of poles and parked cars; with no road nearby it returns to its saved dry starting point. Controls → Explore the region includes Wainuiomata River · Swim, Bank and Drive destinations.

Widths use waterway tags where available; other widths, river depths, bank shapes, seabed depths and flooding are procedural approximations, not surveyed bathymetry or a hydrodynamic simulation. Covered and culverted streams stay hidden.

Run `node tests/water-interaction.mjs` for profile/confluence grading, shallow banks, wading, swimming, diving, bed collision, bridge separation, car water entry/sinking, underwater exit, recovery, seabed depth and fog restoration. Existing driving, frame-sync, movement, sound, bridge and road tests remain applicable.

## Vehicle handling and riverside road grades

The fourteen drivable models now have separate gameplay profiles for mass, power, driven wheels, tyre grip, braking, centre of gravity and body-motion response. Steering builds and returns gradually, uses wheelbase, reduces lock with speed and limits cornering by grip. Space is the handbrake: it brakes in a straight line and holds a stopped car (accelerating releases the hold), but steering while it is held locks the rear wheels so the tail slides out. Throttle keeps a rear-wheel-drive car sliding after release. Sliding tyres scrub speed, squeal and leave rubber marks under the rear tyres (a 1,600-segment ring buffer, so the oldest marks are replaced). Newly entered and recovered cars also hold their starting position. Cars retain coasting momentum, brake before reversing, slow uphill and lose traction on gravel or grass. Four ground-contact samples and damped ride height/pitch/roll soften surface changes. Automatic engine RPM/gear changes also drive the engine tone. The Skyline accelerates and corners more sharply; wagons are more restrained, and the Hilux, vans and buses respond more slowly with greater body movement. This remains a simplified vehicle model rather than a full rigid-body tyre/suspension simulation; tuning is era-inspired, not certified vehicle specifications.

Stanley Street beside the river demo no longer gets lifted to meet the shallow street-grade limit applied to adjoining steep hillside tracks. Tracks have their own grade allowance and do not create flattened street-junction patches. The real-map regression checks the street against the packaged elevation data; Controls includes Stanley Street · Riverside for inspection. The river driving destination has a longer run-up with clearance checks.

Run `node tests/vehicle-handling.mjs`, `node tests/river-road-grades.mjs`, `node tests/driving.mjs`, `node tests/driving-frame-sync.mjs` and `node tests/water-interaction.mjs`.

## Bush-track elevation audit

Street grades are solved before trails. Tracks, paths, footways, cycleways, bridleways and steps then follow their terrain profiles, with short blended collars meeting fixed street/junction heights. Hillside trail grades cannot raise the paved street graph. Mapped bridge clearances, bridge approaches and shared sidewalks remain part of the street plan.

The full merged-map comparison checks 16,613 road/path ways and 532,274 street samples. It found 80 road ways with more than 1m of trail-induced rise in the previous solver; the updated comparison has no remaining lift above floating-point rounding. Findings, method and limitations are in [the audit report](reports/track-rise-audit.md). Controls includes Wainuiomata Hill Road · Road view and Mawson Street · Road view for inspection.

Run `node scripts/audit_track_rises.mjs` for a geometry-free scan, `node tests/map-trail-grades.mjs` for the whole-map regression, and `node tests/trail-grade-isolation.mjs` for steep-trail endpoint/terrain checks. Motor-road slope limits and bridge checks remain covered separately by the existing road tests.

## Denser traffic

The moving fleet grows from 48 to 144 vehicles, plus the existing ten parked slots. More traffic starts around town. When visiting another area, eligible distant AI vehicles refill nearby roads toward a target of 48 moving vehicles within 850m, prioritising twelve vehicles within 350m and capping replenished local traffic at 64. Replenishment is limited to eight vehicles per second and happens behind the camera, at least 180m away, with spacing and road/pole clearance checks. Driven cars and cars parked by the player are protected from recycling.

Nearby spatial buckets replace all-pairs following checks and ignore vehicles on a different vertical level. Ordinary AI beyond 1.7km pauses, and fleet rendering omits vehicles beyond 1.5km; the controlled vehicle retains its detailed mesh. Existing car models, buses, left-hand traffic and one-way routing are retained. Run `node tests/traffic-density.mjs` alongside driving, frame-sync, people and classic-car tests.

## Road surface detail

Road surfaces now use 1024px mipmapped textures with finer aggregate, neutral asphalt/chipseal colours, soft tyre polishing and smaller irregular repairs. The former high-contrast outlined patch rectangles and repeated oversized utility covers are removed. Longitudinal texture repeats are 12m rather than 24m, while world-space detail maintains a consistent grain scale across different road widths and junctions. Broad world-space variation reduces obvious tiling; derivative filtering suppresses subpixel grain at distance. Lane paint has fine wear instead of a perfectly flat fill. Gravel and pavers retain separate surface treatments. Existing clipping hooks, bridge geometry and traffic routes are unchanged.

## Local aerial road surfaces

Asphalt road meshes now sample the same geographically aligned local aerial photographs as the terrain, including the streamed 0.25m/pixel detail tiles near town. They reuse existing texture and extent uniforms; no duplicate aerial downloads or GPU image copies are needed. Wider mosaics provide fallback coverage and transitions fade at image/tile edges. This applies to asphalt roads and bridge carriageways; gravel, pavers and timber retain their own materials.

Photographic contrast is compressed to avoid doubling capture-day lighting. A colour/brightness confidence mask reduces vegetation, bright photographed paint and deep baked shadows, while existing road-marking geometry remains clear. The native photograph still contains its capture-day lighting and may retain some objects; the mask is not object segmentation. Fine procedural aggregate remains on top of the real photographed surface for driving-height detail. Existing imagery attribution and capture dates apply. `node tests/road-imagery.mjs` checks shared streaming bindings, geographic orientation and clipping/detail shader chaining.

## Intersections and traffic controls

Traffic now plans a route ahead of each junction, slows with bounded acceleration/braking, and follows curved lane transitions through turns. Junction reservations prevent conflicting entries. Main-road priority, through-road priority at T junctions, give-way-to-right ties and circulating roundabout traffic are handled separately. STOP approaches require a stationary pause. Cars wait outside an occupied junction or blocked exit; route ends do not invent an illegal reverse edge.

`traffic-controls.json` restores tagged control nodes from the same cached OSM extracts used for the map: 130 signal nodes, 276 stop nodes, 1,484 give-way nodes and 3,133 crossing nodes before filtering to public drivable roads. The current traffic graph uses 63 signal nodes and 361 full-width marked/signalised crossing locations. Mapped controls take priority; untagged junctions use inferred road-class/geometry rules. Signals have alternating green/amber/all-red phases and a pedestrian interval. Timings, sign offsets and inferred priority are gameplay approximations rather than surveyed signal plans.

Nearby controls render as instanced signs, stop lines, lamp heads and zebra stripes. Posts are checked against carriageways and solid objects, and their collisions respect elevation. Crossers start at kerbs, wait for a safe gap or pedestrian phase, and clear the carriageway before waiting again. AI yields for crossing demand; manual drivers retain control and vehicle/pedestrian contact prevents ghosting through them. Vehicle impacts stop AI briefly and give a small rebound; there is no deformation or injury model.

Cars have independent brake-light intensity and left/right blinking amber lenses, including daylight operation. AI indicators follow planned turns; while driving, Q toggles left, E toggles right and C cancels. A completed steering manoeuvre cancels the signal. Controls → Explore the region includes Traffic lights · Hutt Valley and Pedestrian crossing · Wainuiomata viewpoints.

Run `node tests/intersection-rules.mjs`, `node tests/crossing-people.mjs`, `node tests/traffic-map.mjs` and the existing traffic, driving, frame-sync, people and fleet tests. `python3 scripts/prepare_traffic_controls.py` rebuilds tagged controls from existing cached map extracts without fetching new data.

## Cockpit camera, breakaway controls and crossing flow

V switches between chase and first-person driving views; the touch controls include a Camera button. Cockpit eye positions follow each model's right-hand driver seat, body pitch and roll. Mouse movement looks around inside the cabin, the near plane is reduced for dashboard detail, and the driver's external character is hidden in this view. Returning to chase/on-foot restores the usual camera projection.

Road-control posts fall when struck: lightweight stop/give-way posts break above approximately 1.8m/s, and signal posts above 6m/s. The assembly tips over visibly and its solid collision is released immediately, so the fallen sign does not become an invisible wall. Damage persists until the world reloads. These controls do not change the existing utility-pole destruction model.

Crossing routes now extend completely beyond both kerbs instead of ending at intermediate OSM nodes in the carriageway. A local area has at most one crossing agent; after crossing, they join a nearby ordinary footpath and a 35–60 second crossing cooldown applies. This replaces the former repeated back-and-forth crossing behaviour.

`node tests/cockpit-breakaway.mjs` verifies seat placement across all fourteen models, mouse look, camera restoration, falling sign transforms and released collision. Crossing, intersection, driving and pedestrian regression tests also apply.

Nearby walkers also step aside when a driven vehicle approaches or makes contact. Evasion targets are checked for solids, road edges and height changes, and crossing agents continue to a kerb rather than stopping after evading. The Breakaway sign · Drive travel option provides a clear approach for testing sign impacts.


## Upper Hutt extension

Controls → Explore the region now includes Upper Hutt · Main Street, Silverstream · Kiln Street, Trentham · Fergusson Drive and Tōtara Park · California Drive. The playable region is 30 × 41.5km, with connected roads back through the Hutt Valley, mapped Hutt River waterways, parks, woodland, street furniture, traffic and pedestrian controls. The Hutt Valley commuter running path reaches Upper Hutt via Silverstream, Heretaunga, Trentham and Wallaceville.

The extension adds 26,381 LINZ building parts to the existing spatial streaming/LOD system (73,878 regional parts total). New buildings use official footprints and procedural facades. LiDAR roof-height fitting now covers 19,135 new building parts; remaining heights are inferred. Roof-plane layouts are inferred rather than surveyed. North/east terrain comes from LINZ's national 8m contour DEM sampled onto the existing 25m regional rendering grid. Original terrain samples, detailed town assets and existing photographic roofs are retained; boundary chunks receiving additional buildings use procedural roofs when their old photo crop no longer covers the whole chunk. The original shoreline mask is preserved at the same resolution, with added inland land/woodland coverage.

Rebuild using the GIS Python environment: `python scripts/expand_upper_hutt.py`, then `python scripts/prepare_traffic_controls.py` and `python scripts/prepare_railways.py`. Public OSM/LINZ downloads are cached in `/private/tmp/wainui-upper-osm` and `/private/tmp/wainui-upper-hutt`. Existing building IDs are deduplicated. Rail elevation sampling blends the survey boundary into regional terrain and smooths the connected profile to avoid abrupt train pitches.

Validation: `python tests/upper-hutt.py`, `python tests/verify_regional_assets.py`, `node tests/regional-expansion.mjs`, `node tests/weather-railways.mjs`, `node tests/traffic-map.mjs`, `node tests/terrain-stream.mjs` and `node tests/road-topology.mjs`. The expansion test checks land classification, valley elevations, four districts, road connectivity from Petone, streamed building data, mapped controls and the commuter route endpoint at Upper Hutt. Browser QA covers Main Street and Silverstream without console errors.


## Regional building heights and shaped roofs

`python scripts/prepare_regional_profiles.py` fits Upper Hutt roof elevations using the public LINZ Wellington 2013–2014 DSM and DEM, sampled at 2m. Interior footprint samples exclude ground/no-data, use robust height percentiles and reject high outliers. It replaces footprint-size height buckets for 19,135 parts. The historical survey can miss newer buildings; those retain explicitly inferred heights. Ground placement continues to follow the existing world terrain. Cached survey arrays are under `/private/tmp/wainui-upper-roof-survey`.

All 73,878 regional parts now have footprint-aligned gable, hip or flat/parapet profiles. Roof triangles split at plane intersections, preserving crisp ridges, concave outlines and courtyard holes. Gable infill and fascia close the wall/roof seams; flat buildings get parapet coping. Roof rise is limited to plausible pitches to reduce tree-contaminated survey spikes. Rail platform canopies remain flat. Corrugated fallback textures use metre-scale UVs; aerial roofs keep separate geographic UVs and now receive lighting on the shaped surfaces. Distant instanced roof silhouettes use `regional-roof-far.bin` and the same eave/ridge heights as streamed buildings.

Controls → Explore the region → Upper Hutt · Roof view opens a drone viewpoint over Trentham. Re-run the profile preparation after rebuilding regional building footprints. `node tests/regional-roofs.mjs` checks measured height variation, roof planes, gable closure, concave/courtyard area preservation and matching far data; existing regional asset and expansion checks still apply. Roof type/orientation remain an approximation rather than a reconstruction of surveyed roof planes.

## Audio mix and background music

Sound effects now default to 85% with a full 0–100% range. Engine/horn levels and road/water ambience are stronger; normalized noise and a mix compressor keep peaks controlled. The Controls menu has separate effects and music volume sliders, Music mute and Mute all audio. Preferences persist locally. Pausing or hiding the tab fades the mix out.

`music.js` synthesizes an original 86 BPM instrumental loop with warm keys, bass, a changing melody and soft percussion. It starts after a play gesture, uses the existing audio context and schedules only a short window ahead; voices disconnect when finished. Music bypasses the underwater effects filter and ducks while the horn is held. No music downloads are required. `node tests/sound.mjs` checks gesture startup, reusable context, effects/music separation, scheduling, volume, mute and hidden-tab silence.

## W01 bus job

Controls → Start W01 · Village bus route (also in Explore the region) assigns a city bus to a 1.7km, seven-stop run from the shopping centre down Main Road to the village/depot. Stops come from cached mapped OSM bus-stop nodes; the service and timetable are fictional gameplay. Follow the yellow minimap line/road arrows, pull into the highlighted bay in the correct direction, stop and hold Space to board. Passengers wait at the kerb, walk to the front door, appear seated aboard and get off at later stops. The final stop empties the bus and displays delivered passengers, trip time and score.

The timetable uses active play time and allows lateness without failing the trip. Boarding requires the assigned stationary bus, the correct approach direction and brakes/park hold. Leaving the bus retains the job; choosing another travel destination or End bus job cancels it. Restarting resets all passengers, score and timing. Route guidance uses directed mapped roads, including sub-metre roundabout connectors that the ambient-traffic graph omits. It does not cut across property or reverse a one-way road. Job passengers are visual mission agents and do not add solid pedestrian obstructions.

`python scripts/prepare_bus_route.py` rebuilds stop metadata from cached map extracts. `node tests/bus-route.mjs` validates the complete mapped path, braking/speed/vehicle/direction gates, boarding dwell, seven-stop completion, drop-offs, score and restart. Existing driving, frame-sync and bus handling tests also apply.

## Regional aerial ground and road widths

Ground photography now covers the whole 31 × 42.5km region, not only the 7.3km around Wainuiomata. Three tiers layer under the existing Wainuiomata imagery: an 8m/pixel overview of the full regional terrain (always resident), 2m/pixel valley tiles (2,048m, four nearest streamed) and 0.5m/pixel urban tiles (one per 512m building chunk outside the native Wainuiomata detail, sharing its four streamed slots). Sea and areas outside the source coverage are stored as pure white and fall back to procedural ground in the shader. The coarse tiers keep a little of the procedural ground texture's local grain so metre-scale pixels are not flat at walking height. Roads sample the same layers through the existing road-imagery mask.

Most tiles come from the Hutt City Aerials_2025 export service (© NZ Aerial Surveys / Hutt City Council; NZ Aerial Surveys for GWRC rural, CC BY 4.0). Outside Hutt City that service only holds coarse imagery, so blurry tiles (mainly Upper Hutt and the outer hills) are rebuilt from the GWRC Aerial_basemap_2021 tile cache (GWRC, WAGGIS, LINZ, AAM NZ; 2021) and kept only where measurably sharper; those tiles are marked `gwrc-2021` in `dist/ground-regional.json`. Rebuild with `python scripts/prepare_regional_ground.py`; downloads are cached in `/private/tmp/wainui-regional-ground` and `/private/tmp/wainui-gwrc-tiles`. The package adds roughly 250MiB of streamed JPEG tiles (265 tiles upgraded from GWRC).

Road widths use one lane model for every class: lane count × class lane width plus a class shoulder (urban roads include kerbside parking) and 1.5m per tagged cycle lane. Roundabout rings and links default to a single lane; other one-way arterials (primary/secondary and up) default to two lanes, and ordinary one-way streets keep at least 6m for kerbside parking. Previously untagged arterials received a fixed 11m while `lanes=2` sections of the same street got 7.2m, and untagged one-way roads and roundabout rings were also 11m wide. Untagged continuation ways now inherit the lane count of a same-named, same-class neighbour, and added turn/climbing lanes first absorb shoulder space, so kerb lines no longer jump a full lane at each OSM way split. `width` tags are kept only when plausible against the lane estimate. Proposed/abandoned roads and `area=yes` plaza outlines (formerly drawn as 7m ribbons around the plaza edge) are no longer rendered as carriageways; mapped piers are retained. Widths remain inferred, not surveyed.

`node tests/regional-ground-roads.mjs` checks the width model, lane inheritance, regional coverage and tile files, Upper Hutt urban coverage, tier selection and the no-data/grain shader options.

## Wellington City expansion

The western map now includes central Wellington, the waterfront, Karori, Newtown, Island Bay, Kilbirnie and Miramar. The travel menu offers street-level arrivals in nine districts. Roads, paths, coastline and parks come from OpenStreetMap; building footprints come from LINZ. New western terrain uses the national 8m contour DEM sampled on a 25m grid. Building heights use matching OSM height or level tags where available; other heights are explicitly estimated from footprint area. Wellington roof forms and facades remain stylised, without surveyed architectural detail or new roof photography.

Run `/private/tmp/wainui-gis/bin/python scripts/expand_wellington.py` to reproduce the cached import, then `/private/tmp/wainui-gis/bin/python scripts/fix_wellington_heights.py` (re-matches heights for the buildings it already added: each LINZ outline takes the tallest OSM building covering at least 40% of it, and outlines holding OSM `building:part` towers are split into one building per part; it ends by repackaging roofs), or `/private/tmp/wainui-gis/bin/python scripts/package_regional_roofs.py` alone so the added buildings get gable/hip/flat roofs and matching far-view rows (it needs no downloads, and keeps `regional-far.bin` and `regional-roof-far.bin` at one row per building), then `python tests/wellington.py` in an environment with numpy, Pillow and pyproj. The import retains existing terrain samples and building IDs. Packaging also applies the hand-modelled landmarks in `scripts/regional_landmarks.py`: the Beehive replaces its merged LINZ outline (and OSM's `height=7`) with a flat podium and a tiered drum of white window bands under a bronze crown, about 61m tall. Sky Stadium's oval stand steps up from the pitch in plain white bands to a 27m outer wall, and the 51m National War Memorial Carillon gets its pyramidal cap.

## Remutaka Range and open sea

The regional terrain now extends 13.5km farther east, to x = 34km, across the Remutaka Range crest, Remutaka Hill Road summit and Kaitoke to Featherston and the north shore of Lake Wairarapa. It is part of the playable area: `world.bounds` (walk/drive/fly limit, 500m inside the terrain grid) now reaches x = 33.5km, so the helicopter (G) can fly over the range and set down in the Wairarapa. The grid is 58 × 42.5km (2,321 × 1,701 samples). The terrain download grows from 12.1MB to 15.8MB, and the 150m far-hills mesh grows from about 170k to 222k triangles. Near-tile streaming, its 3ms generation budget and its 5km radius are unchanged. In clear weather, fog distance now grows with altitude (up to 95% of the camera's 30km far plane), so the range shows on the horizon from the helicopter; at street level, visibility is unchanged.

New ground uses the LINZ national 8m contour DEM sampled on the existing 25m grid. Earlier LiDAR and DEM samples are retained exactly. Former -3m no-data placeholders are refilled where the DEM has ground, including a 3km strip on the old eastern edge that the earlier DEM sheets missed. Large areas with no DEM ground are sea: Porirua Harbour, the Ōhāriu/Mana coast and Palliser Bay were previously flat land at -3m and are now water. Sea polygons continue past the terrain grid into Cook Strait and Palliser Bay, built from DEM no-data at 200m, so the coast no longer ends at a hard edge. Land outside the grid, such as Cape Terawhiti and the Aorangi Range, is still not modelled. Lake Wairarapa appears only in the aerial photograph; it is flat terrain, not swimmable water.

Woodland across the eastern hills comes from mapped OpenStreetMap natural=wood / landuse=forest areas (largely the LINZ Topo50 import; © OpenStreetMap contributors, ODbL). These areas can only add to the earlier forest raster east of the town. Ground photography outside the 8m Hutt overview, covering Wellington, Porirua/Tawa and the new Remutaka/Wairarapa strip, comes from a 20m/pixel layer over the whole terrain grid (`ground-overview-outer.jpg`, 1.5MB; about 33MB on the GPU with mipmaps). It is built from the GWRC Aerial_basemap_2021 tile cache (GWRC, WAGGIS, LINZ, AAM NZ; 2021; CC BY 4.0), colour-matched to the 8m overview and layered beneath it, and it also fills that overview's no-data holes. The terrain shader already uses all 16 texture units, so it is a single texture rather than separate east and west strips. Road coverage now includes the mapped SH2 route through Kaitoke, over Remutaka Hill and into Featherston, plus surrounding streets and paths. Full OSM ways and node IDs preserve connections to Upper Hutt. Controls → Explore the region includes Remutaka Hill summit and Featherston. Buildings in this eastern extension have not been added.

Rebuild with `/private/tmp/wainui-gis/bin/python scripts/expand_remutaka.py`, then `scripts/prepare_outer_imagery.py`. DEM, woodland (Overpass API) and imagery downloads are cached in `/private/tmp/wainui-remutaka` and `/private/tmp/wainui-gwrc-tiles`. It refuses to run twice; restore the pre-extension assets before rebuilding. Validate with `python tests/remutaka.py`, plus `tests/wellington.py`, `tests/upper-hutt.py`, `tests/south-expansion.py`, `node tests/regional-expansion.mjs` and `node tests/terrain-stream.mjs`.

## Choppy sea and boats

The sea shader now draws a wind sea: seven deep-water wave octaves (52m swell down to 1.7m ripples) perturb the surface normal. The water polygons span kilometres and stay flat, so the effect is all in shading. It adds sky reflection with a Fresnel term, a sun glint that follows the day/night sun, subsurface tint on crests and whitecaps on the steepest crests. Wave height and whitecaps scale with the weather's wind: calm in valley mist, lively in clear weather and rough in storms. Each octave fades out before it can alias with distance, so the sea seen from the helicopter does not shimmer. Swimming and boat physics treat the surface as flat sea level; the waves are visual.

`boats.js` adds fictional, unbranded shipping: 16 sailing yachts, 10 launches and two large inter-island ferries. The ferries run an in-water route from Aotea Quay through the harbour entrance and along the south coast into Cook Strait, beyond the terrain grid. Yachts and launches wander between random open-water points at least about 120m offshore, checked against the coast mask. Every boat rides the same three longest swell octaves as the shader, pitching, rolling and leaning into turns, and yachts heel with the wind. Each boat type is one instanced mesh with baked vertex colours, so the fleet adds four draw calls including foam wakes. Boats are scenery: the player cannot board them or collide with them. Run `node tests/boats.mjs`.


## Enterable interiors

Nine fictional rooms—Valley Dairy, The Long Way Home Café, Valley Lounge, Valley Reading Room, Valley Arcade, Valley Fish & Chips, Valley Cycle Works, Valley Records and Valley Flowers—are attached to accessible street-facing buildings near the starting area. Subtle, softly pulsing doorway surrounds and individually coloured door textures identify them from the street. Door icons mark them on the minimap; the enter prompt appears only when close to a door. Walk to a marker and press E (or tap the prompt) to enter. Walk back to the marked exit and press E to return outside. The Controls travel menu can take you to each entrance. Interiors have furnished rooms, indoor lighting, solid furniture and walls, and on-foot movement. Vehicles and drone mode stay outside; reset and travel leave the room safely. The outdoor clock continues while exploring. Rooms load on first entry and are reused. Their layouts and uses are invented, rather than surveyed representations of the real buildings.

Run `node tests/interiors.mjs` for entrance selection, room collision, entry/exit and movement checks.

## Cut-and-fill road grading

Street grades are now solved as balanced cut and fill: the solver takes the midpoint of the raised and lowered grade envelopes instead of only ever raising roads, so one cliff-top sample, retaining wall or steep driveway no longer lifts every connected street onto an embankment. Grade limits only reject survey noise (motorway/trunk 10%, primary/secondary 14%, tertiary 18%, local streets 25%, service roads 33%). Bridge decks stay fixed and their approaches still climb at design grades (8% for arterials, 12% otherwise).

Junction hubs are matched by distance along each road, so both segments meeting at a map vertex share one height. Previously a short segment inside a junction radius could leave a free vertical step at its far end. Street nodes are no longer pinned to the raw survey sample. Roadbeds use the median of the centre and both edge samples, then a five-sample median along the road, so a cliff under one edge or a slightly offset centre line does not drag the profile. Parallel same-layer carriageways whose pavements touch may differ by at most half the surveyed step between them. Sidewalks and cycleways running beside a street are pulled onto its level. Opposing one-way carriageways of the same named road (a divided road such as Wainuiomata Hill Road) are built level with each other across the median, even where the survey samples each centre line on a different part of the embankment. Only samples directly across from each other are linked, so the climb itself is not flattened.

Lane markings now follow the lane count: one-way carriageways get a dashed divider at every lane boundary, and two-way roads get a centre line plus dividers within each direction. Wainuiomata Hill Road's mapped lanes (two each way, with a third uphill lane from the Gracefield link junction to the merge near the summit) now show as painted lanes rather than a single centre line.

Terrain beside roads blends toward every nearby roadbed and junction patch across a shoulder that widens with the height difference (about 1:2, 4–16m). The nearest surface dominates smoothly, which removes the walls left by the fixed 4m blend, nearest-road switching and junction hull edges. In the town area, the largest roadbed deviation from the survey falls from 36.5m to 3.9m. Overlapping same-level carriageway mismatches fall from 70 to 1, and wall-like terrain jumps beside roads from about 40,000 to 6,000 samples. Most of the remaining jumps are real level differences, such as the separated Wainuiomata Hill Road carriageways.

Lane inheritance now ignores footpaths and tracks that end at a node, so they cannot change a street's width. Run `node tests/road-cut-fill.mjs` for these cases, and `node scripts/audit_road_steps.mjs 3300` for the whole-area scan (roadbed lift/cut, overlapping-carriageway ledges and terrain jumps).

## Road underpasses

`tunnel=yes` ways are real roads instead of gaps in the network, so traffic, driving and walking pass through them: short underpasses (the Seaview/Gracefield link under Wainuiomata Hill Road, station subways, car-park ramps) and Wellington's long bored road tunnels (Terrace Motorway Tunnel, Mount Victoria Tunnel and its shared path, the Hataitai bus tunnel, Moa Point Road under the runway). Over 150 m, the Wainuiomata Tunnel (which has its own interior) and closed `access=no` ways that are not bus routes are left out. Approach roads graded into a cutting below a portal rise to meet the floor at their approach grade. Below a roof only the shell walls block movement, so buildings overhead do not, and the chase camera stays under the roof. At bends, adjoining segments of a curving tunnel overlap so the outside of each bend stays inside the shell. `node tests/long-tunnels.mjs` drives each real tunnel portal to portal. Each floor runs straight between its portal ground levels. Every road crossing above clears 4.6 m of headroom (2.8 m over paths) plus a 0.7 m roof slab. Half of any shortfall against the surveyed road level above is dug out of the floor (at most 2.5 m, with the approaches easing down into cuttings within their grade limit), and half is built up. The lift over each crossing fades at the approach grade relative to the graded road, never steeper than the road's limit, so it stays local even on a steep hill. Opposing carriageways of a divided road rise together.

Each underpass gets side walls, a roof slab, a headwall at each portal and 6 m wing walls lining the cutting. Terrain inside the shell is cut away in the shader below the roof, for the 24 shells nearest the camera. A footway or cycleway tunnel running alongside a road underpass shares its box: its floor sits at kerb height on the road's, under the same roof, with no dividing wall. Height-aware surface picking puts walkers and vehicles on the floor or the road above. Calls without a height always return the road above. The walls block leaving or entering the shell sideways below the roof; the portals stay open. Run `node tests/road-underpass.mjs` for these cases.



Interior templates are also copied into up to three accessible buildings per district as scenery streams in: northern/southern Wainuiomata, Lower Hutt, Petone, Days Bay, Eastbourne, Upper Hutt, Silverstream, Trentham, Tōtara Park and Wellington neighbourhoods. Copies retain subtle door surrounds and minimap icons, have district-qualified names, and join the travel menu when available. Furnished scenes are shared by type. Travel back to a discovered entrance loads its terrain and buildings before arrival.


## Supermarkets

A shared large supermarket interior includes long stocked grocery aisles, produce displays, chilled cabinets and four checkouts in a roughly 33 × 36 m room. It uses the same subtle doorway surround, minimap icon and E/touch interaction as other interiors. Placement is restricted to 33 mapped supermarket sites, rather than random district copies: named LINZ building footprints identify regional stores, and OpenStreetMap supermarket way 960045397 identifies the current Woolworths Wainuiomata site. Older survey store names are retained where present; current brands and exact shop boundaries can differ. The layout is fictional and is not a surveyed floor plan. Rooms are shared and built only on entry. Stores become available as their buildings stream in.

`node scripts/prepare_supermarkets.mjs` regenerates the site manifest from regional building names and the saved Wainuiomata OSM point. OpenStreetMap location data © OpenStreetMap contributors, ODbL, retrieved 31 October 2026 from https://api.openstreetmap.org/api/0.6/map?bbox=174.939,-41.263,174.946,-41.257 . `node tests/supermarkets.mjs` checks placement, exclusions and the walkable large-store layout.


## Music playlist and vehicle audio

Controls → Music track selects Valley Afterglow (warm keys), Harbour Lights (house), Hill Road FM (breakbeat), Coast Road Sunday (slow keys) or Morning in the Ranges (ambient). The playlist now contains twelve arrangements; Auto rotates through all twelve after 32 bars apiece; selecting a track repeats that arrangement. Selection and independent music/effects levels persist locally. These are original procedural instrumental arrangements, generated in the browser.

Vehicle sound now layers RPM-driven firing pulses, filtered exhaust and intake, with different four/six-cylinder and diesel tones and a brief load dip on gear changes. Trains have traction whine, rhythmic rail rumble and an air-brake release; helicopters have a pulsing rotor and air wash; bicycles have chain/freewheel noise and an H bell. Tyre noise follows road speed, flooded engines stop, and leaving a vehicle fades its layers. Effects are synthesised approximations, not recordings of the named models.

Run `node tests/sound.mjs` and `node tests/audio-arrangements.mjs` for audio controls, all five playlist arrangements, pause/resume, vehicle layers, gear changes, flooding, brake release and audio graph reuse.


## Valley FM radio

The twelve-track playlist adds Queen Street Shuffle (funk), Petone Sunset Dub, Midnight Express (synth), Rain on the Veranda (swung keys), Seaview Warehouse (garage), Rata Street Daydream (funk) and Stars over Eastbourne (ambient). New grooves include swung percussion, offbeat chords, extra bass pickups and synth arpeggios.

In automatic Valley FM mode, a short fictional radio spot plays after every two tracks, then the next track begins. Six spots rotate: Valley Dairy, Valley Cycle Works, The Long Way Home Café, Valley Records, Valley Fish & Chips and a Valley FM station ident. These are fictional promotions with synthetic narration (macOS Karen and Daniel voices), packaged as six mono MP3 files totalling about 480 KB. The clips are loaded after audio starts; no live speech service is used. A caption displays each script. Controls → Fictional radio ads switches spots off and saves the preference. Selecting an individual track repeats it without ads. Pause, mute, hiding the tab and changing tracks stop the current spot; a missing audio file leaves music playing.

`scripts/build_radio_ads.py` rebuilds the clips on macOS with `say`, `ffmpeg` and `ffprobe`. `node tests/radio.mjs` verifies packaged assets, rotation, cancellation, captions, handoff to music and failed-load fallback.


## Dashboard radio, street ambience, rain and lookouts

While driving, the dashboard stereo offers three fictional stations: Valley FM (92.4, all twelve tracks and optional local ads), Harbour Heat (98.6, dance/funk) and Ranges Radio (88.2, mellow/ambient). Use [ / ] to tune, or J to release mouse capture and use the preset buttons, tuning slider, volume and power. Stations also appear in Controls. A brief burst of static accompanies tuning. Station, volume and power preferences persist. Choosing a specific track repeats it without ads.

A fixed pool of synthesised voices follows up to three nearby moving traffic vehicles with distance, vertical separation and stereo panning. Birds favour dry daytime conditions, wind responds to mapped woodland density, occasional distant dogs punctuate inhabited streets, and entering/exiting an interior rings a shop bell. Vehicle cabins reduce outdoor ambience. These are lightweight sound approximations, not wildlife recordings.

In cockpit view, rain collects on the windscreen and two animated wipers clear droplets. K (or the wiper button) cycles Auto / Off / Slow / Fast; Auto follows rain intensity. The overlay hides when looking sideways, switching to chase view, exiting or pausing. Wet tyres hiss and kick up a bounded spray in chase view; wipers swish. Tunnels shelter the effects. Rain reduces tyre grip by up to 25% in the gameplay handling model, increasing braking distance. Existing wet-road shading remains in use. The windscreen is an illustrative screen overlay rather than model-specific glass geometry.

Three local lookouts now have travel entries, minimap triangles, small illustrative benches/signs and persistent discoveries when visited on foot: Wainuiomata Hill / Pukeatua Lookout, Kiwanis Lookout, and Centenary Lookout in Korokoro. Anchors follow the shipped OpenStreetMap parking aisle/path ways 16868680, 234502136 and 199293308 (© OpenStreetMap contributors, ODbL); scenery is not a surveyed reconstruction. Procedural planting leaves a small foreground opening at each viewpoint. Arrival faces the harbour or valley and uses existing terrain streaming and safe landing checks. See [Waiu Park / Wainui Lookout](https://www.wellingtonnz.com/visit/trails/waiu-park), [Wainuiomata place-name history / Kiwanis Lookout](https://ttc.org.nz/TararuaHistory/WainuiomataPlaceNameOrigins) and [mapped Centenary Lookout](https://www.openstreetmap.org/way/199293308).

Run `node tests/radio-rain-lookouts.mjs` plus the sound, radio, audio-arrangements, vehicle-handling, driving, driving-frame-sync and cockpit-breakaway checks. Coverage includes station playlists, saved controls, automatic wipers, bounded spray, mapped lookout anchors, on-foot discoveries and wet-road braking.


## Local radio towers

Three geolocated transmitters now mark the skyline: Mount Fitzherbert above the Hutt Valley, Mount Victoria in Wellington, and Mount Kaukau north of the city. Coordinates are projected from cached OpenStreetMap tower features into the existing NZTM world. Kaukau uses the mapped 122 m pre-2022 profile for the game's 2002 setting; the 46 m Fitzherbert and 50 m Mount Victoria heights are illustrative estimates because their source features have no height tags. Lattice geometry, platforms, ladders, dishes and aerial arrangements are approximate. Mount Victoria has red/white sections; red obstruction lights appear at night. These landmarks do not assign the game's fictional stations to real transmitters.

Each site uses one batched detailed mesh nearby and a lightweight line silhouette beyond 2.2 km. Towers remain visible up to 26 km subject to the existing camera, terrain occlusion and weather fog. Footings follow sampled ground; tower supports and upper antennas have height-aware collision. Generated vegetation leaves a small opening around each structure. The minimap marks transmitters, and Controls → Explore the region adds a Tower view at each site, using drone mode to frame the full mast.

Coordinate sources: OpenStreetMap [Fitzherbert node 2392530592](https://www.openstreetmap.org/node/2392530592), [Mount Victoria node 296684884](https://www.openstreetmap.org/node/296684884), and [Kaukau way 361818550](https://www.openstreetmap.org/way/361818550), © OpenStreetMap contributors, ODbL, retrieved 31 October 2026. The cached source strips unrelated features and account metadata. [Kordia's tower history](https://www.kordia.co.nz/news-and-views/mt-kaukau-tower-wellingtons-highest-point-turns-60) explains the shorter present-day Kaukau mast and its 2022 removal of redundant upper steelwork. [The Wellington VHF Group](https://vhf.nz/index.php/MtVictoria) documents the Mount Victoria site; [local place-name history](https://www.ttc.org.nz/TararuaHistory/WainuiomataPlaceNameOrigins) documents the Mount Fitzherbert transmitter.

Rebuild projected anchors with `/private/tmp/wainui-gis/bin/python scripts/prepare_radio_towers.py` (or a Python environment with pyproj). Run `node tests/radio-towers.mjs` for coordinate bounds, finite geometry, historical mast height, draw-call budget, near/far switching, lights, collision and travel entries.


## RSM cell sites

The world includes 481 cell-site location clusters derived from 2,464 current transmitter licences in the public RSM / MBIE Register of Radio Frequencies, retrieved 1 November 2026. The import searches 40 km around the Wainuiomata origin, clips to the playable bounds, selects current unsuppressed Spark, One NZ, 2degrees and Rural Connectivity Group (RCG, the carriers' shared rural network) transmitting records in mobile downlink/TDD bands, and excludes receivers, national rights without coordinates and microwave links. Repeated licence/sector points are grouped within 12 m of a retained RSM anchor. NZTM2000 coordinates are used directly; legacy NZGD1949 coordinates are never mistaken for NZGD2000.

RSM points indicate licensed antenna locations rather than a surveyed inventory of physical towers. The models are illustrative: 353 monopole clusters, nine hilltop lattice supports and 119 rooftop mounts. Height grows with the number of the seven mobile bands licensed at the site: monopoles 14–26 m, lattices 18–30 m and rooftop masts 3–6 m above the game roof. Structure types are inferred from containing building footprints and hilltop location names; heights and sector panel arrangements are estimated, not RSM measurements. Roof elevation comes from the existing local/regional building models, with actual loaded roof heights preferred. A cellular location within 15 m of an existing radio tower shares that tower rather than adding another pole. Current locations do not represent the mobile network as it existed in 2002.

Six batched draw calls at most cover the entire cellular layer: three support styles, shared sector antennas, equipment cabinets and distant silhouettes. Detailed sites render within 1.6 km and simple masts out to 5.5 km. Ground poles and cabinets have height-aware collision; tiny foreground clearances keep generated trees out of the masts. Small blue squares mark sites on the minimap. Controls → Explore the region offers Wainuiomata / Lower Hutt cell-tower views and a Wellington rooftop-antenna view. Preview cameras are framed after nearby buildings load, choosing a direction and altitude that clear neighbouring roofs.

Source: [RSM public register](https://rrf.rsm.govt.nz/ui/search/licence), [RSM search guidance](https://www.rsm.govt.nz/licensing/how-do-i/use-the-rrf/search-the-rrf/search-licences), and [RSM copyright](https://www.rsm.govt.nz/copyright). Crown copyright acknowledged. `scripts/data/cell-sites-rsm.json` preserves the filtered site anchors, contributing licence IDs/frequencies, query, date and projection; it omits account and contact details. Runtime data is bundled locally in `dist/cell-sites.json`; the game does not query RSM.

`scripts/prepare_cell_sites.py --fetch --retrieved YYYY-MM-DD` refreshes the public JSON searches using curl, without authentication or an Access database reader. Omit `--fetch` to rebuild from `/private/tmp/wainui-rsm` cached searches. `--cache PATH` selects another cache. The importer refuses incomplete paginated results. Run `node tests/cell-towers.mjs`, plus the radio-towers, radio-rain-lookouts, rivers-imagery and driving-frame-sync checks.


## Short overhead house services

Rendered low-voltage street spans now supply nearby house facades with a pair of short sagging service wires. Eligibility is a horizontal distance of at most 8 m from the actual visible overhead conductor to the nearest outer house wall, including exactly 8 m. The measurement uses the footprint edge rather than the house centre or the nearest pole. Each house receives at most one nearest valid connection, attached just below its eaves. House selection follows the existing house/shop/industrial presentation plus footprint area and height checks; small sheds, garages, commercial buildings, landmarks and rail canopies are excluded.

Only low-voltage polylines that passed the existing street-wire clearance checks can feed a house. Underground-supply streets, plain lamp columns, missing/rejected spans and railway wires never create house services. Routes are rejected if they cut through another building, hit terrain, or fall below the game's road/rail clearance envelope. A house whose closest feasible route is farther than 8 m remains unconnected. Service geometry is scenery, not a surveyed electrical layout.

All nearby house services share one additional line batch. They refresh as street furniture and regional houses stream in and out, and their count appears as house leads in the P performance display. Run `node tests/house-service-lines.mjs`, `node tests/street-furniture.mjs` and `node tests/driving-frame-sync.mjs` for the exact cutoff, overhead-only eligibility, eave attachment, sag, exclusions, clearance and streaming cleanup.

## Verge utility scenery

Street-furniture chunks include illustrative green telecom cabinets, compact electrical pillars, double-door ground transformers on underground-supply streets, rectangular access covers and small yellow water-service lids. Cabinets have concrete plinths, recessed doors, hinges, handles, vents and small identification/caution plates. Placement is deterministic and spaced along suitable verges; this is decorative scenery rather than a surveyed utility inventory.

Footprint samples reject buildings, fences, carriageways, junctions, waterways, bridges, railway margins and steep or uneven ground. Cabinets reserve pedestrian and parking clearance before their chunk loads; flush covers remain passable. Regional building clearance is checked again when rendering a chunk. The equipment merges into each chunk's existing opaque geometry and shares its materials, adding no dedicated draw calls or lights. P shows the streamed utility count. Controls → Explore the region → Verge utilities · Cabinet view provides a close streetside view. Run `node tests/utility-scenery.mjs` alongside the street-furniture, house-service-lines and driving-frame-sync checks.


## Loading progress

While the world loads, a bar under the start button shows what is happening: each download by name and size (`loading-progress.js` counts response bytes as they stream), then the named build steps — coastline, rivers, roads, terrain, trees, Wellington and Hutt buildings, traffic, bus routes. Startup code marks a step with `await globalThis.loadingStage?.('Name')`, which paints the label before the step blocks the page. Downloads fill the first 40% of the bar against the bytes the last completed load needed; the build fills the rest against how long it took (both remembered in `localStorage`). A download that sends nothing for 15 seconds is called out by name. Building the nearby terrain advances one slice per animation frame, so a load in a background tab pauses until the tab is shown.

## Larger-house facades

Eligible residential footprints of 180–650 m² and eave heights of 2.6–8.5 m use continuous, metre-scaled cladding across their front, side and upper walls. Individual photographic window and entrance crops replace repeated complete cottage frontages. Each house has at most one entrance on its principal street-facing wall; upstairs and side/rear bays contain windows or blank cladding. Window widths, sill levels and storey heights use physical dimensions, with corner and terrain clearance checks. Small houses, shopfronts, industrial buildings, explicit nonresidential types, landmarks, rail canopies and plain-facade buildings retain their existing treatment.

Individual joinery crops come directly from the bundled facade atlas, including matching glass-only night masks. Sill/head trim, recess shadows, an eave shadow line and restrained foundation strips add detail. Shared cladding materials also use shallow material-specific bump relief for boards, brick and roughcast. Roof survey geometry is preserved. The same layout runs for detailed local buildings, outer suburbs and regional streamed chunks; window/door/trim geometry is batched per material, and regional unloading releases owned geometry/materials while retaining shared textures.

Controls → Explore the region → Larger houses · Facade view opens an example. Run `node tests/large-house-facades.mjs`, `node tests/facade-mapping.mjs`, `node tests/building-environment.mjs` and `node tests/regional-roofs.mjs`.

## Enterable houses

Six accessible larger-house front doors around the local valley lead into furnished residential interiors: Rimu, Kōwhai, Tawa, Kauri, Rātā and Mānuka House. Three warm family/bungalow/retro furnishing palettes share a walkable hall, living room, kitchen/dining area, main bedroom, second bedroom/study and bathroom. They include fabric sofas, rugs, a CRT television, timber floors, dining furniture, kitchen appliances, beds, wardrobes, shower, basin, toilet, curtains and warm lights. These are fictional interiors rather than surveyed floorplans or residents' homes.

House entrances align with the individual front-door positions from the larger-house facade layer. Existing commercial/supermarket buildings are excluded, and blocked, submerged, steep or elevated thresholds are rejected. The existing exterior door is retained, with a subtle warm outline; gold minimap doorway markers distinguish houses. Controls → Explore the region lists each house entrance. Approach the door and press E (or use the on-screen button); return to the entry hall and press E to go outside at the exact saved position. Existing indoor audio/weather sheltering applies.

Rooms are built only on first entry and cached by furnishing style. Solid furniture and wall partitions use the existing substepped indoor movement; flat rugs/floors remain passable. Run `node tests/house-interiors.mjs` and `node tests/interiors.mjs`. The new tests flood-fill each furnished layout to ensure all rooms remain reachable, and verify exterior-door alignment, entry exclusions, room caching and safe exits.

Rebuild the eastern roads with `/private/tmp/wainui-gis/bin/python scripts/expand_remutaka_roads.py --map-api` (cached OSM tiles; omit the flag to reuse the merged download). The importer merges roads by OSM ID and refuses incomplete ways. Source metadata is in `dist/remutaka-roads.json`. Run `node tests/remutaka-roads.mjs` for the bidirectional Upper Hutt–summit–Featherston connection, graded heights and rendered summit road geometry.

## Regional tunnel interiors

Named road and trail tunnels now have streamed arched linings, portal frames, ribs and illustrative lamps inside their existing collision/road shells. This includes Mangaroa, Pakuratahi, Price's, Siberia and Summit tunnels on the Remutaka rail trail, and the mapped Wellington road tunnels. Controls → Explore the region lists both ends of each named bore.

The active railway network includes the mapped Rimutaka Tunnel and eastern approach tracks towards Featherston. Its approximately 8.8 km alignment comes from complete OSM ways. Grades are inferred between regional terrain elevations at the portals, pinned to existing rail profiles where they join. The existing commuter running route is preserved. Maoribank and other mapped railway tunnels also have visible linings, floors, rails and sleepers; their terrain openings, interior walking heights and walls remain separate from the surface above. Railway portal travel entries provide drone views from outside. A river overhead does not trigger swimming or underwater fog inside a bore.

Tunnel dimensions, materials, fittings and interiors are illustrative rather than surveyed models. Meshes load near the camera and release their geometry when distant. Woodland remains above underground tracks while portal clearances stay open. `scripts/expand_remutaka_rail.py` rebuilds the eastern rail additions from the road import's cached public OSM tiles without changing existing routes or survey profiles. Run `node tests/regional-tunnels.mjs`, `node tests/long-tunnels.mjs`, `node tests/tunnel.mjs`, `node tests/road-underpass.mjs` and `node tests/weather-railways.mjs`.

## Waterloo canopy and rail-crossing clearance

Waterloo's broad station roof (LINZ outline 3468908) renders as an open canopy with two roof levels, translucent strips, circular columns and a visible spaceframe. The original footprint and its aerial roof mapping are retained. The distant model is a roof plate rather than a full-height box; the covered platforms remain walkable. The form is informed by [Metlink's May 2024 canopy reassessment](https://www.metlink.org.nz/assets/Images-by-Suburb/Hutt-Valley/Waterloo/OIA2026/Canopy-Reassessment_Harrison-Grierson_May-2024.pdf), section 2. Member spacing, roof pitch, column placement and interior details are inferred game scenery rather than surveyed structural drawings.

Rail beds are protected after road and junction grading, preventing bridge approaches from filling the track corridor. Local terrain shader cuts also keep coarse terrain triangles out of the railway beneath overbridges. Railway subways and their stair branches join at every mapped node, including branches in the middle of a way, with roof slabs below the tracks. Headwalls and bridge structures are excluded from the train envelope. Platform surfaces follow local track grades, catenary poles avoid adjacent tracks, and station signs/travel entries stand beside the railway.

Run `node tests/rail-stations.mjs` for Waterloo's streamed open roof/collision and far model, roof footprint coverage, support/electrical clearance, platform grades, subway joints, rendered headwalls and the map-wide overbridge rail-bed audit. Existing bridge, underpass, tunnel, train and building-roof regressions remain applicable.

## Parks, playgrounds and dog parks

Mapped parks, reserves, playgrounds, pitches and dog exercise areas now carry furniture that streams in within about 420 m. Lawns get benches facing inward from the edge, bins and picnic tables, and named parks get a green name sign on the side nearest a road. Playgrounds get a rubber safety surface, a slide tower and swings, plus a spring rider where there is room. Pitches are fitted with an oriented rectangle: larger fields get rugby posts with padded bases and 22 m lines, and smaller fields get football goals, a centre circle and penalty boxes. Benches, play equipment, posts and fences block walking and driving, and drone flight passes over them. Placement is procedural and illustrative, not a survey of council assets.

`dist/dog-parks.json` packages 15 OpenStreetMap `leisure=dog_park` areas across Wellington and the Hutt Valley. It also includes Les Dalton Dog Park on Waiu Street, Wainuiomata, which is not mapped in OSM. That park's main enclosure and separate small-dog area are traced from fence lines in the Hutt City Aerials_2025 photography (© NZ Aerial Surveys and Hutt City Council, CC BY 4.0). It sits on the left as you come down Wainuiomata Hill Road, beside the shared path at the foot of Waiu Street ([Hutt City Libraries](https://huttcitylibraries.co.nz/2021/08/12/the-new-les-dalton-dog-park-wainuiomata-dog-clubs/)). Dog areas join the open-space set, so trees stay off them. Each fenced area has chain-link panels with a single open gate, and a sign, bag dispenser, bin, dog water fountain and benches at the entrance. Open beach and zone areas stay unfenced. Agility equipment is not depicted.

Near a dog park, low-poly dogs in varied coats and sizes trot, sniff, sit, chase each other and do zoomies inside the fence. They come over and wag at you when you walk in. Small dogs stay in the small-dog area. One or two owners stroll nearby and keep an eye on their dogs. Dogs and owners are released after you leave. Controls → Explore the region adds Les Dalton Dog Park · Waiu Street and Hikoikoi Reserve Dog Park · Petone, and the minimap outlines nearby dog areas. Rebuild with `python scripts/prepare_dog_parks.py` (pyproj, using the retained OSM caches). Run `node tests/parks.mjs` to check the fence and gate, small-dog separation, pitch markings and goals, playground equipment, collisions, dog containment and streaming cleanup.

## Wainuiomata Hill Road lighting

Wainuiomata Hill Road is lit along its 80 km/h divided section, where previously only its 50 km/h ends were. Roads over 70 km/h are skipped unless tagged `lit=yes`; Hill Road is now listed in `litArterials` in `dist/street-furniture.js`. It uses slim steel lamp columns about every 40 m on the left (outer) kerb of each one-way carriageway, with no overhead wires. Where the Wainuiomata Shared Path runs along the kerb, a column steps out up to about 6 m so it stands clear of the path. An explicit `lit=no` still wins. Column positions are procedural, not a survey of the actual lighting assets. `node tests/street-furniture.mjs` covers the arterial override, kerb side, the clearance beside the shared path and the `lit=no` exception.

## Porirua, the Kāpiti Coast and the Wairarapa

The regional map now reaches north to Waikanae and east to Greytown and Martinborough. The terrain grid is 70 × 63 km (x −24 000…46 000, z −44 000…19 000; 2801 × 2521 samples at 25 m), and the playable bounds stay 500 m inside it. The gaps inside the old grid are filled too: Porirua, Titahi Bay, Whitby, Plimmerton and Pāuatahanui had no streets or buildings, and Churton Park, Tawa, Ōhāriu, Mākara and Featherston were sparse.

- **Terrain and coast.** New ground comes from the LINZ national 8 m contour DEM (sheets BP31–BQ34). Every earlier sample is kept, and only former no-data placeholders are refilled. Large DEM no-data areas become sea. The coast mask is now `coast-mask-region.png` at 10 m/pixel (was 7.8125). That keeps the decoded browser canvas near its earlier size, and the established shoreline is resampled into place. OSM woodland fills the forest raster in the new strips, and `prepare_outer_imagery.py` rebuilds the 20 m aerial layer for the whole grid.
- **Streets, water and parks.** These come from OpenStreetMap map-API tiles over the new areas. Tiles wholly inside an earlier import are skipped. This added about 16 800 road and path ways, 4 500 waterways and 1 370 parks and sports grounds, which `parks.js` furnishes.
- **Buildings.** About 69 500 LINZ building outlines were added. Heights come from overlapping OSM `height`/`building:levels` tags where present (about 3 700). The rest are inferred from footprint area and are not surveyed. Roofs and far-view rows are repackaged by `package_regional_roofs.py`.
- **Railway.** Wellington station, the Johnsonville line, the Kāpiti line (through the Tawa tunnels and along the coast to Waikanae) and the Wairarapa line beyond Featherston are added from OSM. Four Hutt and Kāpiti ways had been cut at an old x = −10 000 boundary, short of Wellington, and are rebuilt whole. Trains now run from Wellington on four routes:
  - Hutt Valley commuter to Upper Hutt (32 km)
  - Kāpiti commuter to Waikanae (55 km)
  - Johnsonville commuter (10 km)
  - Wairarapa Connection to Featherston (57 km)

  New track is graded to at most 3%; the 25 m DEM alone gave pitches of up to 15% through cuttings. The terrain blends to the trackbed as cut or fill. The surveyed Petone–Upper Hutt line keeps its profile. Tunnel grades are interpolated between portals, and the service pattern is fictional.
- **Travel.** The Travel menu adds Johnsonville, Tawa, Mākara, Porirua, Titahi Bay, Plimmerton, Paekākāriki, Paraparaumu Beach, Waikanae, Greytown and Martinborough.

Rebuild with `/private/tmp/wainui-gis/bin/python`, in this order:

1. `scripts/expand_north_east.py` (terrain, sea, coast mask, water and woodland; it refuses to run twice, so restore `/private/tmp/wainui-before-north-east.tar.gz` first)
2. `scripts/prepare_outer_imagery.py`
3. `scripts/expand_north_east_map.py` (streets, waterways, buildings and parks; reruns deduplicate)
4. `scripts/package_regional_roofs.py`
5. `scripts/expand_north_east_rail.py`

`python tests/north-east.py` checks dry land and sea at each town, preserved earlier samples, streets and buildings per district, one far row per building, the station list, connected routes from Wellington to each terminus, and the 3% grade on new track. `tests/regional-rivers.mjs`, `tests/remutaka.py` and `tests/wellington.py` now pin their checks to the extents they were written for.
