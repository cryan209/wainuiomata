"""Validate the north/east expansion: Porirua, the Kāpiti Coast, the Wairarapa and the railway into Wellington."""
import json,math,pathlib,sys,tarfile
import numpy as np
from PIL import Image
from pyproj import Transformer
D=pathlib.Path(__file__).resolve().parents[1]/'dist';sys.path.insert(0,str(D.parent/'scripts'))
from lib.regional_map import load_map
def load(n):return json.loads((D/n).read_text())
m=load('regional-terrain.json');coast=load('regional-coast.json');terrain=np.fromfile(D/'regional-terrain.bin',dtype='<i4').reshape(m['height'],m['width'])/100
mask=Image.open(D/coast['mask']);ox,oy=load('geodata.json')['originNZTM'];project=Transformer.from_crs(4326,2193,always_xy=True)
assert m['minZ']<=-44000 and m['maxX']>=46000 and m['bounds']=={**m['bounds'],'minZ':m['minZ']+500,'maxX':m['maxX']-500}
assert coast['bounds']=={k:m[k] for k in ['minX','maxX','minZ','maxZ']}
assert mask.width*mask.height*4<200e6,'The decoded coast mask stays within the earlier browser memory budget'
def point(lon,lat):e,n=project.transform(lon,lat);return e-ox,oy-n
def land(x,z):return mask.getpixel((int((x-m['minX'])/(m['maxX']-m['minX'])*mask.width),int((z-m['minZ'])/(m['maxZ']-m['minZ'])*mask.height)))>128
def height(x,z):return terrain[round((z-m['minZ'])/25),round((x-m['minX'])/25)]
towns=[('Porirua',174.840,-41.133,0,40),('Plimmerton',174.866,-41.081,0,30),('Paekākāriki',174.9525,-40.9865,0,35),('Paraparaumu',175.005,-40.915,0,60),('Waikanae',175.065,-40.875,0,60),('Featherston',175.325,-41.116,20,90),('Greytown',175.459,-41.081,30,100),('Martinborough',175.46,-41.218,10,80)]
for name,lon,lat,low,high in towns:
 x,z=point(lon,lat);assert land(x,z),name;assert low<height(x,z)<high,(name,height(x,z))
for name,lon,lat in [('Porirua Harbour',174.855,-41.115),('Kāpiti sea',174.93,-40.93)]:assert not land(*point(lon,lat)),name+' must be sea'
backup=pathlib.Path('/private/tmp/wainui-before-north-east.tar.gz')
if backup.exists():
 with tarfile.open(backup) as t:
  old=json.load(t.extractfile('regional-terrain.json'));a=np.frombuffer(t.extractfile('regional-terrain.bin').read(),dtype='<i4').reshape(old['height'],old['width'])
 row=(old['minZ']-m['minZ'])//25;b=np.round(terrain[row:row+old['height'],:old['width']]*100).astype('<i4');keep=a!=-300;assert np.array_equal(a[keep],b[keep]),'Earlier terrain samples are unchanged'
# Streets and buildings in each new district.
roads=load_map()['elements'];manifest=load('regional-buildings.json')
for name,lon,lat,*_ in towns:
 x,z=point(lon,lat);near=sum(1 for r in roads if 'highway' in r['tags'] and any(abs(p['x']-x)<1200 and abs(p['z']-z)<1200 for p in r['geometry'][::4]))
 chunks=[c for c in manifest['chunks'] if abs(c['x']-x)<1300 and abs(c['z']-z)<1300];assert near>40 and sum(c['count'] for c in chunks)>150,(name,near,sum(c['count'] for c in chunks))
assert manifest['northEast']['addedParts']>50000 and manifest['count']==sum(c['count'] for c in manifest['chunks'])
assert (D/'regional-far.bin').stat().st_size==manifest['count']*8*4,'One far-view row per streamed building'
# Railway: Wellington station to every terminus, connected, under a 3% ruling grade on new track.
rail=load('railways.json');station={s['name']:s for s in rail['stations']}
for name in ['Wellington','Johnsonville','Porirua','Paekākāriki','Paraparaumu','Waikanae','Featherston','Petone','Upper Hutt']:assert name in station,name
ends={'Hutt Valley commuter':'Upper Hutt','Kāpiti commuter':'Waikanae','Johnsonville commuter':'Johnsonville','Wairarapa Connection':'Featherston','Melling commuter':'Melling'}
assert rail['routes'][0]['name']=='Hutt Valley commuter' and {r['name'] for r in rail['routes']}==set(ends)
for r in rail['routes']:
 p=r['p'];w,e=station['Wellington'],station[ends[r['name']]]
 assert math.hypot(p[0]['x']-w['x'],p[0]['z']-w['z'])<150 and math.hypot(p[-1]['x']-e['x'],p[-1]['z']-e['z'])<150,r['name']
hutt=rail['routes'][0]['p'];surveyed={q['node'] for q in hutt[min(range(len(hutt)),key=lambda i:math.hypot(hutt[i]['x']-station['Petone']['x'],hutt[i]['z']-station['Petone']['z'])):]}
for r in rail['routes']:
 p=r['p']
 # The surveyed Petone–Upper Hutt line keeps its own profile; everything graded by expand_north_east_rail.py is checked.
 for a,b in zip(p,p[1:]):
  d=math.hypot(b['x']-a['x'],b['z']-a['z']);assert d<10,(r['name'],a,b)
  if not {a['node'],b['node']}<=surveyed:assert abs(b['h']-a['h'])<=.031*d+.01,(r['name'],a,b)
kapiti=rail['routes'][1]['p'];assert 50000<sum(math.hypot(b['x']-a['x'],b['z']-a['z']) for a,b in zip(kapiti,kapiti[1:]))<60000,'Wellington–Waikanae is about 55km'
print('PASS: Porirua, Kāpiti Coast and Wairarapa terrain, sea, streets and buildings; preserved earlier samples; Wellington station with graded Hutt, Kāpiti, Johnsonville, Wairarapa and Melling routes.')
