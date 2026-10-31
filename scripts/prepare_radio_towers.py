"""Project cached OSM radio tower anchors into the game's NZTM world (requires pyproj)."""
import json
from pathlib import Path
from pyproj import Transformer
root=Path(__file__).resolve().parents[1]
source=json.loads((root/'scripts/data/radio-towers-osm.json').read_text())
meta=json.loads((root/'dist/geodata.json').read_text())
project=Transformer.from_crs(4326,2193,always_xy=True)
profiles=[('fitzherbert','Mount Fitzherbert transmitter',46,7,7,'silver','Approximate visual height; OSM does not specify height'),('victoria','Mount Victoria radio tower',50,8,10,'red-white','Approximate visual height; OSM does not specify height'),('kaukau','Mount Kaukau TV/FM tower',122,22,22,'silver','Pre-2022 mast height, matching the 2002 setting; OSM way 361818550')]
rows=[]
for ident,name,height,width,antenna,paint,height_source in profiles:
 row=source['sites'][ident];elements=row['elements'];way=next((e for e in elements if e['type']=='way'),None)
 if way:
  nodes={e['id']:e for e in elements if e['type']=='node'};points=[nodes[n] for n in dict.fromkeys(way['nodes'])];lat=sum(p['lat'] for p in points)/len(points);lon=sum(p['lon'] for p in points)/len(points);osm=f"way/{way['id']}"
 else:
  node=next(e for e in elements if e['type']=='node');lat,lon=node['lat'],node['lon'];osm=f"node/{node['id']}"
 x,y=project.transform(lon,lat)
 rows.append(dict(id=ident,name=name,lat=lat,lon=lon,x=round(x-meta['originNZTM'][0],3),z=round(meta['originNZTM'][1]-y,3),height=height,width=width,antenna=antenna,paint=paint,heightSource=height_source,source='https://www.openstreetmap.org/'+osm))
(root/'dist/radio-tower-sites.js').write_text('// Anchors: © OpenStreetMap contributors, ODbL. Geometry is an illustrative reconstruction.\nexport const RADIO_TOWER_SITES = '+json.dumps(rows,indent=2)+';\nexport function radioTowerVegetationClear(x,z,radius=0){return RADIO_TOWER_SITES.every(s=>Math.hypot(x-s.x,z-s.z)>s.width*.7+radius+8)}\n')
print('Projected',len(rows),'radio tower sites')
