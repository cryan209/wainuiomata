"""Validate the Remutaka Range extension and the open-sea classification."""
import json,pathlib,tarfile
import numpy as np
from PIL import Image
from pyproj import Transformer
from shapely.geometry import Point,Polygon
D=pathlib.Path(__file__).resolve().parents[1]/'dist'
def load(n):return json.loads((D/n).read_text())
m=load('regional-terrain.json');coast=load('regional-coast.json');terrain=np.fromfile(D/'regional-terrain.bin',dtype='<i4').reshape(m['height'],m['width'])/100;mask=Image.open(D/coast['mask']);ox,oy=load('geodata.json')['originNZTM'];project=Transformer.from_crs(4326,2193,always_xy=True)
assert m['maxX']>=34000 and m['bounds']['maxX']==m['maxX']-500 and m['width']==(m['maxX']-m['minX'])//25+1
assert coast['bounds']=={k:m[k] for k in ['minX','maxX','minZ','maxZ']}
assert (D/'regional-forest.bin').stat().st_size==coast['forest']['width']*coast['forest']['height']
forest=np.fromfile(D/'regional-forest.bin',dtype='u1').reshape(coast['forest']['height'],coast['forest']['width'])
def point(lon,lat):e,n=project.transform(lon,lat);return e-ox,oy-n
def land(x,z):return mask.getpixel((int((x-m['minX'])/(m['maxX']-m['minX'])*mask.width),int((z-m['minZ'])/(m['maxZ']-m['minZ'])*mask.height)))>128
def height(x,z):return terrain[round((z-m['minZ'])/25),round((x-m['minX'])/25)]
for name,lon,lat,low,high in [('Remutaka Hill Road summit',175.2305,-41.1075,450,700),('Featherston',175.325,-41.116,20,90),('Kaitoke',175.17,-41.08,150,320)]:
 x,z=point(lon,lat);assert m['bounds']['minX']<x<m['bounds']['maxX'] and m['bounds']['minZ']<z<m['bounds']['maxZ'],name;assert land(x,z),name;assert low<height(x,z)<high,(name,height(x,z))
# Range crest: the highest new ground is a real mountain range, not a placeholder plateau.
east=terrain[round((-23500-m['minZ'])/25):,round((20500-m['minX'])/25):round((34000-m['minX'])/25)];assert 700<east.max()<1000,east.max()  # the Remutaka strip; the Tararua Range north of it rises past 1500m
for name,lon,lat in [('Palliser Bay',175.141,-41.425),('Ōhāriu coast',174.728,-41.175)]:assert not land(*point(lon,lat)),name+' must be sea'
# No flat land at the -3m no-data placeholder: large gaps are sea, and only tiny inland holes may remain.
landMask=np.array(mask.resize((m['width'],m['height'])))>128;assert ((terrain<=-2.99)&landMask).sum()<500,int(((terrain<=-2.99)&landMask).sum())
# Sea polygons extend beyond the terrain grid into Cook Strait and Palliser Bay.
water=[Polygon(r[0],r[1:]) for r in coast['water']]
for x,z in [(0,m['maxZ']+3000),(m['minX']-3000,-15000),(20000,m['maxZ']+2000)]:assert any(p.contains(Point(x,z)) for p in water),(x,z)
fx=lambda x:int((x-m['minX'])/(m['maxX']-m['minX'])*forest.shape[1]);assert (forest[:,fx(20500):]>128).mean()>.1,'Mapped woodland covers part of the eastern range'
backup=pathlib.Path('/private/tmp/wainui-before-remutaka.tar.gz')
if backup.exists():
 with tarfile.open(backup) as t:
  old=json.load(t.extractfile('regional-terrain.json'));a=np.frombuffer(t.extractfile('regional-terrain.bin').read(),dtype='<i4').reshape(old['height'],old['width']);row=round((old['minZ']-m['minZ'])/25);b=np.round(terrain[row:row+old['height'],:old['width']]*100).astype('<i4');keep=a!=-300;assert np.array_equal(a[keep],b[keep]),'Surveyed samples must remain unchanged'
print('PASS: Remutaka Range to Featherston on dry terrain, crest heights, open sea at Palliser Bay and Ōhāriu, sea beyond the grid, eastern woodland and preserved survey samples.')
