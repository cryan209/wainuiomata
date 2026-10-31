"""Fit Upper Hutt heights to public LINZ LiDAR and package regional roof profiles.
Roof shapes remain inferred; measured height distributions replace size-only guesses.
"""
import pathlib,json,math,concurrent.futures
import numpy as np,rasterio
from rasterio.enums import Resampling
from shapely.geometry import Polygon,Point
from pyproj import Transformer
ROOT=pathlib.Path(__file__).resolve().parents[1];D=ROOT/'dist';CACHE=pathlib.Path('/private/tmp/wainui-upper-roof-survey');CACHE.mkdir(exist_ok=True)
m=json.load(open(D/'regional-buildings.json'));origin=json.load(open(D/'geodata.json'));ox,oy=origin['originNZTM'];datum=origin['originElevation'];project=Transformer.from_crs(4326,2193,always_xy=True);chunks={};targets=[]
for c in m['chunks']:
 data=json.load(open(D/c['file']));chunks[c['id']]=data
 for b in data['buildings']:
  if 'inferred' not in b.get('heightSource','') or b.get('roof',{}).get('measured'):continue
  p=Polygon(b['rings'][0],b['rings'][1:]).buffer(0)
  if p.geom_type!='Polygon' or p.is_empty:continue
  q=p.representative_point();targets.append((b,p,q.x,q.y))
items=[]
for path in pathlib.Path('/private/tmp/wainui-regional-survey').glob('wellington_2013-2014-BP32*.json'):
 item=json.load(open(path));l,s,r,n=item['bbox'];corners=[project.transform(a,b) for a in [l,r] for b in [s,n]];xs=[p[0]-ox for p in corners];zs=[oy-p[1] for p in corners];bounds=(min(xs),min(zs),max(xs),max(zs));selected=[t for t in targets if bounds[0]<=t[2]<=bounds[2] and bounds[1]<=t[3]<=bounds[3]]
 if selected:items.append((path.name.removeprefix('wellington_2013-2014-').removesuffix('.json'),selected))
def tile(job):
 name,selected=job;arrays=[];tr=None
 with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR',CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tiff',GDAL_HTTP_TIMEOUT='90',GDAL_HTTP_MAX_RETRY='2'):
  for kind in ['dem','dsm']:
   cache=CACHE/f'{kind}-{name}.npz'
   if cache.exists():saved=np.load(cache);a,tr=saved['a'],rasterio.Affine(*saved['t'])
   else:
    url=f'https://nz-elevation.s3.ap-southeast-2.amazonaws.com/wellington/wellington_2013-2014/{kind}_1m/2193/{name}.tiff'
    with rasterio.open(url) as src:
     a=src.read(1,out_shape=(max(1,round(src.height/2)),max(1,round(src.width/2))),resampling=Resampling.bilinear);tr=src.transform*src.transform.scale(src.width/a.shape[1],src.height/a.shape[0]);np.savez_compressed(cache,a=a,t=np.array(tuple(tr)[:6]))
   arrays.append(a)
  dem,dsm=arrays;inverse=~tr;results=[]
  for b,p,x,z in selected:
   u,v=inverse*(x+ox,oy-z)
   if not(0<=u<dem.shape[1] and 0<=v<dem.shape[0]):continue
   interior=p.buffer(-1);interior=interior if not interior.is_empty else p;l,t,r,bt=interior.bounds;stride=max(2,math.sqrt(p.area/180));heights=[]
   for px in np.arange(l+stride/2,r,stride):
    for pz in np.arange(t+stride/2,bt,stride):
     if not interior.contains(Point(px,pz)):continue
     u,v=inverse*(px+ox,oy-pz);i,j=int(u),int(v)
     if not(0<=i<dem.shape[1] and 0<=j<dem.shape[0]):continue
     g,s=float(dem[j,i]),float(dsm[j,i]);h=s-g
     if g>-100 and 1.7<h<70:heights.append(h)
   if len(heights)<4:continue
   a=np.array(heights);q25,q75=np.percentile(a,[25,75]);a=a[a<=q75+max(1.5,(q75-q25)*1.5)]
   if len(a)<4:continue
   low,high=np.percentile(a,[20,90]);results.append((b,float(low),float(high),len(a)))
 return name,results
measured=0
with concurrent.futures.ThreadPoolExecutor(2) as pool:
 for name,results in pool.map(tile,items):
  for b,low,high,count in results:
   if b.get('roof',{}).get('measured'):continue
   b['height']=round(max(2.2,low-.2),2);b['heightSource']='LINZ Wellington 2013–2014 LiDAR DSM minus DEM; robust roof samples';b['roof']={'rise':round(max(0,high-b['height']),2),'measured':True,'samples':count};measured+=1
  print('Roof survey',name,len(results),'fits;',measured,'new measured buildings',flush=True)
# Every streamed building gets a stable footprint-aligned roof, even outside coverage.
from package_regional_roofs import package
package(m,chunks,datum)
