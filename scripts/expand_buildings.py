"""Add official footprints and measured coarse surface heights outside the detailed centre."""
import pathlib,json,subprocess,urllib.parse,concurrent.futures
import numpy as np,rasterio
from rasterio.windows import from_bounds
from rasterio.enums import Resampling
from rasterio.transform import from_origin
from rasterio.warp import reproject
from shapely.geometry import Polygon
ROOT=pathlib.Path(__file__).resolve().parents[1];CACHE=pathlib.Path('/private/tmp/wainui-expanded-buildings');CACHE.mkdir(exist_ok=True)
meta=json.load(open(ROOT/'dist/geodata.json'));ox,oy=meta['originNZTM'];datum=meta['originElevation'];BASE='https://nz-elevation.s3.ap-southeast-2.amazonaws.com/wellington/'
existing={b['id'] for b in json.load(open(ROOT/'dist/buildings.json'))}
features=[]
for offset in range(0,20000,2000):
 params={'f':'json','geometry':','.join(map(str,[ox-3250,oy-3250,ox+3250,oy+3250])),'geometryType':'esriGeometryEnvelope','inSR':2193,'spatialRel':'esriSpatialRelIntersects','outSR':2193,'outFields':'*','resultRecordCount':2000,'resultOffset':offset,'orderByFields':'OBJECTID'}
 p=CACHE/f'footprints-{offset}.json'
 if not p.exists():subprocess.run(['curl','-sS','-L','--fail','--retry','2','--max-time','45','https://services.arcgis.com/xdsHIIxuCWByZiCB/arcgis/rest/services/LINZ_NZ_Building_Outlines/FeatureServer/0/query?'+urllib.parse.urlencode(params),'-o',str(p)],check=True)
 data=json.loads(p.read_text());assert 'error' not in data,data;features.extend(data['features'])
 if not data.get('exceededTransferLimit'):break
print('Expanded footprint features',len(features),flush=True)
step=4;n=1651;dest_transform=from_origin(ox-3302,oy+3302,step,step);bounds=(ox-3310,oy-3310,ox+3310,oy+3310)
ENV={'GDAL_DISABLE_READDIR_ON_OPEN':'EMPTY_DIR','CPL_VSIL_CURL_ALLOWED_EXTENSIONS':'.tiff','GDAL_HTTP_TIMEOUT':'40','GDAL_HTTP_MAX_RETRY':'2'}
def tile_job(task):
 kind,suffix=task;p=CACHE/f'{kind}-{suffix}.npz'
 if p.exists():c=np.load(p);return kind,c['a'],rasterio.Affine(*c['t'])
 survey='wellington_2013-2014' if suffix=='0303' else 'hutt-city_2025';url=BASE+f'{survey}/{kind}_1m/2193/BQ32_10000_{suffix}.tiff'
 with rasterio.Env(**ENV):
  with rasterio.open(url) as src:
   l,b,r,t=bounds;l=max(l,src.bounds.left);b=max(b,src.bounds.bottom);r=min(r,src.bounds.right);t=min(t,src.bounds.top)
   if l>=r or b>=t:return None
   win=from_bounds(l,b,r,t,src.transform).round_offsets().round_lengths();h=max(1,round(win.height/step));w=max(1,round(win.width/step));arr=src.read(1,window=win,out_shape=(h,w),resampling=Resampling.bilinear);tr=src.window_transform(win)*src.transform.scale(win.width/w,win.height/h)
   np.savez_compressed(p,a=arr,t=np.array(tuple(tr)[:6]));print(kind,suffix,flush=True);return kind,arr,tr
rasters={kind:np.full((n,n),-9999,dtype=np.float32) for kind in ['dem','dsm']}
for result in concurrent.futures.ThreadPoolExecutor(3).map(tile_job,[(kind,s) for kind in ['dem','dsm'] for s in ['0201','0202','0203','0301','0302','0303']]):
 if result is None:continue
 kind,arr,tr=result;target=np.full((n,n),-9999,dtype=np.float32);reproject(arr,target,src_transform=tr,src_crs=2193,dst_transform=dest_transform,dst_crs=2193,src_nodata=-9999,dst_nodata=-9999,resampling=Resampling.bilinear);mask=target!=-9999;rasters[kind][mask]=target[mask]
# Preserve a measured 4m grid for bridge engineering and future detail upgrades.
np.savez_compressed(CACHE/'surface.npz',**rasters)
buildings=[];omitted=0
for f in features:
 at=f['attributes'];id=at['building_id']
 if id in existing:continue
 for ring in f.get('geometry',{}).get('rings',[]):
  poly=Polygon(ring)
  if not poly.is_valid:poly=poly.buffer(0)
  if poly.is_empty or poly.geom_type!='Polygon' or poly.area<8:continue
  minx,miny,maxx,maxy=poly.bounds
  if minx<ox-3200 or maxx>ox+3200 or miny<oy-3200 or maxy>oy+3200:continue
  points=[poly.representative_point()]
  for fraction in [.2,.4,.6,.8]:
   x=minx+(maxx-minx)*fraction;y=miny+(maxy-miny)*fraction
   from shapely.geometry import Point
   p=Point(x,y)
   if poly.contains(p):points.append(p)
  rows=np.clip(np.array([(oy+3300-p.y)/step for p in points]).astype(int),0,n-1);cols=np.clip(np.array([(p.x-(ox-3300))/step for p in points]).astype(int),0,n-1)
  dem=rasters['dem'][rows,cols];dsm=rasters['dsm'][rows,cols];valid=(dem>-100)&(dsm-dem>1.6)&(dsm-dem<35)
  if not valid.any():omitted+=1;continue
  height=float(np.median(dsm[valid]-dem[valid]));buildings.append({'id':id,'rings':[[[round(x-ox,3),round(oy-y,3)] for x,y in ring]],'height':round(height,2),'detail':'survey-derived LoD1'})
(ROOT/'dist/buildings-outer.json').write_text(json.dumps(buildings,separators=(',',':')));print('Additional measured building parts',len(buildings),'omitted no valid returns',omitted,flush=True)
