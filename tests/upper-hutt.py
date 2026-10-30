"""Validate the expanded district and its connections to the existing world."""
import json,pathlib,math,collections
import numpy as np
from PIL import Image
D=pathlib.Path(__file__).resolve().parents[1]/'dist'
def read(n):return json.loads((D/n).read_text())
m=read('regional-terrain.json');grid=np.fromfile(D/'regional-terrain.bin',dtype='<i4').reshape(m['height'],m['width'])/100
coast=read('regional-coast.json');mask=Image.open(D/coast['mask']);assert grid.shape==(m['height'],m['width'])
def land(x,z):
 b=coast['bounds'];return mask.getpixel((int((x-b['minX'])/(b['maxX']-b['minX'])*mask.width),int((z-b['minZ'])/(b['maxZ']-b['minZ'])*mask.height)))>128
places={p['name']:p for p in coast['places']}
for name in ['Upper Hutt','Silverstream','Trentham','Tōtara Park']:
 p=places[name];x,z=p['x'],p['z'];assert m['bounds']['minX']<x<m['bounds']['maxX'] and m['bounds']['minZ']<z<m['bounds']['maxZ'];assert land(x,z),name
 h=grid[round((z-m['minZ'])/25),round((x-m['minX'])/25)];assert 20<h<150,(name,h)
assert not land(-6000,0),'Existing harbour must remain water'
assert (D/'regional-forest.bin').stat().st_size==coast['forest']['width']*coast['forest']['height']
roads=list({r['id']:r for file in ['map.json','regional-map.json'] for r in read(file)['elements']}.values());drive=[r for r in roads if r['tags'].get('highway') in ['motorway','trunk','primary','secondary','tertiary','unclassified','residential','living_street','motorway_link','trunk_link','primary_link','secondary_link','tertiary_link'] and r['tags'].get('access') not in ['no','private']]
graph=collections.defaultdict(set);points={}
for r in drive:
 for p in r['geometry']:points[p['node']]=p
 for a,b in zip(r['geometry'],r['geometry'][1:]):graph[a['node']].add(b['node']);graph[b['node']].add(a['node'])
def near(x,z):return min(points,key=lambda n:math.hypot(points[n]['x']-x,points[n]['z']-z))
start=near(-5400,-4400);end=near(10838,-15076);seen={start};queue=collections.deque([start])
while queue:
 for n in graph[queue.popleft()]:
  if n not in seen:seen.add(n);queue.append(n)
assert end in seen,'Upper Hutt roads must connect back to Petone'
for name in ['Main Street','Fergusson Drive','Kiln Street','California Drive']:assert any(r['tags'].get('name')==name for r in drive),name
buildings=read('regional-buildings.json');assert buildings['upperHutt']['addedParts']>15000;assert (D/'regional-far.bin').stat().st_size==buildings['count']*32
signals=[p for p in read('traffic-controls.json')['nodes'] if p['z']<-11500];assert len(signals)>20,'Expanded junctions need mapped controls'
rail=read('railways.json');upper=next(s for s in rail['stations'] if s['name']=='Upper Hutt');route=next(r for r in rail['routes'] if r['name']=='Hutt Valley commuter');assert math.hypot(route['p'][-1]['x']-upper['x'],route['p'][-1]['z']-upper['z'])<150
assert all(math.isfinite(p[k]) for r in rail['tracks'] for p in r['p'] for k in ['x','z','h'])
print('PASS: Upper Hutt terrain, land/forest masks, four districts, Petone road connection, streamed footprints, mapped controls and connected Upper Hutt train route.')
