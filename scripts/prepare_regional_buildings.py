"""Official regional footprints with coarse LiDAR heights, packaged in spatial chunks."""
import pathlib,json,subprocess,urllib.parse,math
import numpy as np
from shapely.geometry import Polygon,Point
ROOT=pathlib.Path(__file__).resolve().parents[1];CACHE=pathlib.Path('/private/tmp/wainui-regional-buildings');CACHE.mkdir(exist_ok=True);OUT=ROOT/'dist/region-chunks';OUT.mkdir(exist_ok=True)
meta=json.loads((ROOT/'dist/geodata.json').read_text());ox,oy=meta['originNZTM'];datum=meta['originElevation'];features=[]
for offset in range(0,120000,2000):
 p=CACHE/f'footprints-{offset}.json'
 if not p.exists():
  params={'f':'json','geometry':f'{ox-10500},{oy-9000},{ox+5500},{oy+11500}','geometryType':'esriGeometryEnvelope','inSR':2193,'outSR':2193,'spatialRel':'esriSpatialRelIntersects','outFields':'building_id,name,use_,suburb_locality,town_city','resultRecordCount':2000,'resultOffset':offset,'orderByFields':'OBJECTID'}
  subprocess.run(['curl','-sS','--fail','--retry','2','--max-time','60','https://services.arcgis.com/xdsHIIxuCWByZiCB/arcgis/rest/services/LINZ_NZ_Building_Outlines/FeatureServer/0/query?'+urllib.parse.urlencode(params),'-o',str(p)],check=True)
 j=json.loads(p.read_text());assert 'error' not in j,j;features+=j['features'];print('Regional footprints',len(features),flush=True)
 if not j.get('exceededTransferLimit'):break
survey=np.load('/private/tmp/wainui-regional-survey/surface.npz');dem=survey['dem'];dsm=survey['dsm'];existing={b['id'] for name in ['buildings.json','buildings-outer.json'] for b in json.loads((ROOT/'dist'/name).read_text())};groups={};far=[];count=0;omitted=0
def sample(a,x,z):
 i=min(a.shape[1]-1,max(0,round((x+10500)/4)));j=min(a.shape[0]-1,max(0,round((z+11500)/4)));return float(a[j,i])
for feature in features:
 at=feature['attributes'];id=at['building_id']
 if id in existing:continue
 polygons=[]
 for ring in feature.get('geometry',{}).get('rings',[]):
  p=Polygon([(x-ox,oy-y) for x,y in ring]).buffer(0)
  if p.is_empty or p.geom_type!='Polygon' or p.area<8:continue
  polygons.append(p)
 polygons.sort(key=lambda p:p.area,reverse=True);parts=[]
 for p in polygons:
  host=next((i for i,q in enumerate(parts) if q.contains(p.representative_point())),None)
  if host is None:parts.append(p)
  else:parts[host]=parts[host].difference(p)
 for p in parts:
  if p.is_empty or p.geom_type!='Polygon':continue
  x,z=p.representative_point().coords[0]
  if abs(x)<3200 and abs(z)<3200:continue
  if not(-10000<x<5000 and -11000<z<8500):continue
  points=[p.representative_point()];l,t,r,b=p.bounds
  for fraction in [.2,.4,.6,.8]:
   point=Point(l+(r-l)*fraction,t+(b-t)*fraction)
   if p.contains(point):points.append(point)
  measurements=[(sample(dem,q.x,q.y),sample(dsm,q.x,q.y)) for q in points];valid=[(g,s) for g,s in measurements if g>-100 and 1.6<s-g<100]
  if not valid:omitted+=1;continue
  height=float(np.median([s-g for g,s in valid]));ground=float(np.percentile([g for g,s in valid],35));key=f'{math.floor(x/512)},{math.floor(z/512)}';rings=[list(p.exterior.coords)]+[list(q.coords) for q in p.interiors]
  building={'id':id,'rings':[[[round(x,2),round(z,2)] for x,z in ring] for ring in rings],'ground':round(ground,2),'height':round(height,2),'suburb':at.get('suburb_locality') or '', 'name':at.get('name') or ''};groups.setdefault(key,[]).append(building)
  rect=list(p.minimum_rotated_rectangle.exterior.coords);a,c,d=rect[:3];width=math.dist(a,c);depth=math.dist(c,d);cx=sum(q[0] for q in rect[:4])/4;cz=sum(q[1] for q in rect[:4])/4;rotation=-math.atan2(c[1]-a[1],c[0]-a[0]);far.extend([cx,cz,ground-datum,height,width,depth,rotation,float(id%8)]);count+=1
chunks=[]
for key,buildings in groups.items():
 ix,iz=map(int,key.split(','));name=key.replace(',','_')+'.json';(OUT/name).write_text(json.dumps({'buildings':buildings},separators=(',',':')));chunks.append({'id':key,'file':'region-chunks/'+name,'x':(ix+.5)*512,'z':(iz+.5)*512,'count':len(buildings)})
(ROOT/'dist/regional-far.bin').write_bytes(np.array(far,dtype='<f4').tobytes());(ROOT/'dist/regional-buildings.json').write_text(json.dumps({'span':512,'chunks':chunks,'count':count,'omittedNoRoofReturns':omitted,'source':'LINZ NZ Building Outlines, 2021 imagery; heights from 4m samples of 2025/2013–2014 LiDAR, inferred LoD1 roofs'},separators=(',',':')))
print('Regional buildings ready',count,'parts in',len(chunks),'chunks; omitted',omitted,flush=True)
