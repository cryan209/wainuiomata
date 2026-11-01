"""Check expansion coverage, shoreline, buildings and preservation of existing terrain."""
import json,pathlib,tarfile,io
import numpy as np
from PIL import Image
from pyproj import Transformer
import sys;sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'));from lib.regional_map import load_map
D=pathlib.Path(__file__).resolve().parents[1]/'dist'
def load(name):return json.loads((D/name).read_text())
m=load('regional-terrain.json');coast=load('regional-coast.json');terrain=np.fromfile(D/'regional-terrain.bin',dtype='<i4').reshape(m['height'],m['width']);mask=Image.open(D/coast['mask']);ox,oy=load('geodata.json')['originNZTM'];project=Transformer.from_crs(4326,2193,always_xy=True)
def point(lon,lat):
 x,y=project.transform(lon,lat);return x-ox,oy-y
for name,lon,lat in [('CBD',174.7762,-41.2805),('Cuba Street',174.775,-41.294),('Karori',174.739,-41.285),('Island Bay',174.773,-41.341),('Miramar',174.816,-41.315),('Newtown',174.780,-41.312)]:
 x,z=point(lon,lat);assert m['bounds']['minX']<x<m['bounds']['maxX'] and m['bounds']['minZ']<z<m['bounds']['maxZ'],name
 px=round((x-m['minX'])/(m['maxX']-m['minX'])*(mask.width-1));pz=round((z-m['minZ'])/(m['maxZ']-m['minZ'])*(mask.height-1));assert mask.getpixel((px,pz))>128,name+' must be land'
 assert terrain[round((z-m['minZ'])/25),round((x-m['minX'])/25)]>=0,name+' needs terrain'
x,z=point(174.82,-41.28);assert mask.getpixel((round((x-m['minX'])/(m['maxX']-m['minX'])*(mask.width-1)),round((z-m['minZ'])/(m['maxZ']-m['minZ'])*(mask.height-1))))<128,'Harbour remains water'
roads=load_map()['elements'];names={r['tags'].get('name') for r in roads};assert {'Lambton Quay','Cuba Street','Oriental Parade','Karori Road','Riddiford Street','Miramar Avenue'}<=names
# Wellington streets must join the existing Petone road graph.
from collections import defaultdict,deque
graph=defaultdict(set);points={}
for road in roads:
 if road['tags'].get('highway') not in ['motorway','trunk','primary','secondary','tertiary','unclassified','residential','living_street','motorway_link','trunk_link','primary_link','secondary_link','tertiary_link']:continue
 for p in road['geometry']:points[p['node']]=p
 for a,b in zip(road['geometry'],road['geometry'][1:]):graph[a['node']].add(b['node']);graph[b['node']].add(a['node'])
def nearest(x,z):return min(points,key=lambda n:(points[n]['x']-x)**2+(points[n]['z']-z)**2)
start=nearest(-14182,1754);end=nearest(-5400,-4400);seen={start};queue=deque([start])
while queue:
 for n in graph[queue.popleft()]:
  if n not in seen:seen.add(n);queue.append(n)
assert end in seen,'Wellington CBD must connect to Petone by mapped streets'
manifest=load('regional-buildings.json');assert manifest['wellington']['addedParts']>10000
count=0;tagged=0;ids=set()
for c in manifest['chunks']:
 buildings=load(c['file'])['buildings'];assert c['count']==len(buildings)
 for b in buildings:
  count+=1;ids.add(b['id']);assert b['height']>0
  if b.get('heightSource','').startswith('OSM'):tagged+=1
assert count==manifest['count'];assert tagged>20
assert (D/'regional-far.bin').stat().st_size==count*8*4
backup=pathlib.Path('/private/tmp/wainui-before-wellington.tar.gz')
if backup.exists():
 with tarfile.open(backup) as t:
  old=json.load(t.extractfile('regional-terrain.json'));a=np.frombuffer(t.extractfile('regional-terrain.bin').read(),dtype='<i4').reshape(old['height'],old['width']);offset=(old['minX']-m['minX'])//25;row=(old['minZ']-m['minZ'])//25;b=terrain[row:row+old['height'],offset:offset+old['width']];keep=a!=-300;assert np.array_equal(a[keep],b[keep]),'Previous terrain samples must remain unchanged (no-data placeholders may be refilled)'
print('PASS: Wellington districts on dry terrain, harbour water, named streets, building manifests, height tags, far geometry and preserved terrain.')
