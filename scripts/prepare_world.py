"""Build reproducible local game assets from LINZ DEM/DSM and building outlines."""
import json,pathlib,subprocess,urllib.parse,concurrent.futures
import numpy as np
import rasterio
from rasterio.windows import from_bounds
from rasterio.enums import Resampling
from rasterio.warp import reproject
from rasterio.transform import from_origin
from pyproj import Transformer
from shapely.geometry import Polygon,Point
from shapely.ops import triangulate
ROOT=pathlib.Path(__file__).resolve().parents[1]
CACHE=pathlib.Path('/private/tmp/wainui-linz');CACHE.mkdir(exist_ok=True)
ORIGIN=(1762931.1408190602,5430336.934043825)
BASE='https://nz-elevation.s3.ap-southeast-2.amazonaws.com/'
np.set_printoptions(suppress=True)
def download_json(url,path):
 path=pathlib.Path(path)
 if not path.exists():subprocess.run(['curl','-sS','-L','--fail','--max-time','40',url,'-o',str(path)],check=True)
 return json.loads(path.read_text())
# Get every LINZ footprint in the original walkable area, following server pagination.
features=[]
for offset in range(0,10000,2000):
 params={'f':'json','geometry':'174.933,-41.269,174.953,-41.253','geometryType':'esriGeometryEnvelope','inSR':4326,'spatialRel':'esriSpatialRelIntersects','outSR':2193,'outFields':'*','resultRecordCount':2000,'resultOffset':offset,'orderByFields':'OBJECTID'}
 url='https://services.arcgis.com/xdsHIIxuCWByZiCB/arcgis/rest/services/LINZ_NZ_Building_Outlines/FeatureServer/0/query?'+urllib.parse.urlencode(params)
 data=download_json(url,CACHE/f'buildings-{offset}.json')
 if 'error' in data:raise RuntimeError(data['error'])
 features.extend(data['features'])
 if not data.get('exceededTransferLimit'):break
print('Footprints',len(features),flush=True)
# Preserve the raw public data in the processing cache, not in the deployment.
pathlib.Path('/private/tmp/wainui-footprints-all.json').write_text(json.dumps(features))
ENV={'GDAL_DISABLE_READDIR_ON_OPEN':'EMPTY_DIR','CPL_VSIL_CURL_ALLOWED_EXTENSIONS':'.tiff','GDAL_HTTP_TIMEOUT':'40','GDAL_HTTP_MAX_RETRY':'2'}
def raster_window(url,bounds,spacing):
 with rasterio.Env(**ENV):
  with rasterio.open(url) as src:
   l,b,r,t=bounds
   l=max(l,src.bounds.left);b=max(b,src.bounds.bottom);r=min(r,src.bounds.right);t=min(t,src.bounds.top)
   if l>=r or b>=t:return None
   window=from_bounds(l,b,r,t,src.transform).round_offsets().round_lengths()
   h=max(1,round(window.height/spacing));w=max(1,round(window.width/spacing))
   arr=src.read(1,window=window,out_shape=(h,w),resampling=Resampling.bilinear)
   transform=src.window_transform(window)*src.transform.scale(window.width/w,window.height/h)
   return arr,transform
# 8km horizon sampled every 20m from 1m sources, at true vertical scale.
size=351;spacing=20;ox,oy=ORIGIN
bounds=(ox-3520,oy-3520,ox+3520,oy+3520)
transform=from_origin(ox-3510,oy+3510,20,20)
terrain=np.full((size,size),-9999,dtype=np.float32)
ids=['BQ32_10000_'+suffix for suffix in ['0101','0102','0103','0201','0202','0203','0301','0302','0303']]
reg=download_json(BASE+'wellington/wellington_2013-2014/dem_1m/2193/collection.json',CACHE/'regional-collection.json');regional={pathlib.Path(x['href']).stem for x in reg['links'] if x['rel']=='item'}
hutt=download_json(BASE+'wellington/hutt-city_2025/dem_1m/2193/collection.json',CACHE/'hutt-collection.json');huttids={pathlib.Path(x['href']).stem for x in hutt['links'] if x['rel']=='item'}
# Read overview windows, keeping network transfer and browser asset size small.
def tile_job(task):
 survey,tile=task;url=BASE+f'wellington/{survey}/dem_1m/2193/{tile}.tiff'
 cache=CACHE/f'{survey}-{tile}-terrain.npz'
 if cache.exists():
  c=np.load(cache);return c['a'],rasterio.Affine(*c['t'])
 result=raster_window(url,bounds,20)
 if result:np.savez_compressed(cache,a=result[0],t=np.array(tuple(result[1])[:6]))
 print('Terrain tile',survey,tile,flush=True)
 return result
for survey,available in [('wellington_2013-2014',regional),('hutt-city_2025',huttids)]:
 tasks=[(survey,tile) for tile in ids if tile in available]
 for result in concurrent.futures.ThreadPoolExecutor(3).map(tile_job,tasks):
  if not result:continue
  arr,src_transform=result
  target=np.full_like(terrain,-9999)
  reproject(arr,target,src_transform=src_transform,src_crs=2193,dst_transform=transform,dst_crs=2193,src_nodata=-9999,dst_nodata=-9999,resampling=Resampling.bilinear)
  mask=target!=-9999;terrain[mask]=target[mask]
# National contour DEM supplies remaining land beyond the regional LiDAR masks.
national=raster_window(BASE+'new-zealand/new-zealand-contour/dem_8m/2193/BQ32.tiff',bounds,20)
if national:
 arr,src_transform=national;target=np.full_like(terrain,-9999)
 reproject(arr,target,src_transform=src_transform,src_crs=2193,dst_transform=transform,dst_crs=2193,src_nodata=-9999,dst_nodata=-9999,resampling=Resampling.bilinear)
 mask=(terrain==-9999)&(target!=-9999);terrain[mask]=target[mask]
missing=terrain==-9999
print('Terrain missing',int(missing.sum()),'of',terrain.size,flush=True)
# Missing areas outside survey coverage are not silently made up.
if missing.any():
 np.save('/private/tmp/wainui-terrain-check.npy',terrain)
 raise RuntimeError('Terrain coverage incomplete')
# Precise 1m ground/surface window for roofs and a 2m terrain grid in the town.
local_bounds=(ox-1100,oy-1200,ox+900,oy+1200)
local={}
for kind in ['dem','dsm']:
 cache=CACHE/f'local-{kind}.npz'
 if cache.exists():
  c=np.load(cache);local[kind]=(c['a'],rasterio.Affine(*c['t']))
 else:
  a,t=raster_window(BASE+f'wellington/hutt-city_2025/{kind}_1m/2193/BQ32_10000_0202.tiff',local_bounds,1)
  np.savez_compressed(cache,a=a,t=np.array(tuple(t)[:6]));local[kind]=(a,t)
 print('Local',kind,local[kind][0].shape,flush=True)
def sample(kind,x,y):
 a,t=local[kind];col=(x-t.c)/t.a-.5;row=(y-t.f)/t.e-.5
 col=np.clip(col,0,a.shape[1]-1.001);row=np.clip(row,0,a.shape[0]-1.001)
 c=col.astype(int) if isinstance(col,np.ndarray) else int(col);r=row.astype(int) if isinstance(row,np.ndarray) else int(row)
 dx=col-c;dy=row-r
 return a[r,c]*(1-dx)*(1-dy)+a[r,c+1]*dx*(1-dy)+a[r+1,c]*(1-dx)*dy+a[r+1,c+1]*dx*dy
origin_elevation=float(sample('dem',ox,oy))
# 2m ground grid: metres above the same real datum, no vertical exaggeration.
xs=np.arange(-1000,1001,2,dtype=float);zs=np.arange(-1100,1101,2,dtype=float)
gx,gz=np.meshgrid(xs,zs);fine=sample('dem',gx+ox,oy-gz)
(ROOT/'dist/terrain-fine.bin').write_bytes(np.round(fine*100).astype('<i4').tobytes())
(ROOT/'dist/terrain.bin').write_bytes(np.round(terrain*100).astype('<i4').tobytes())
# Roof surface mesh clipped to each exact LINZ polygon. Use 2m DSM samples;
# isolated vegetation spikes are filtered against neighbouring roof samples.
from shapely import contains_xy
buildings=[];roofvertices=[];wallvertices=[];roofsources={};bad=0;roofcoverage=[]
for feature in features:
 rings=feature.get('geometry',{}).get('rings',[])
 if not rings:continue
 # ArcGIS exterior rings clockwise. Build each exterior with its contained holes.
 polys=[]
 for ring in rings:
  poly=Polygon(ring)
  if not poly.is_valid:poly=poly.buffer(0)
  if poly.is_empty or poly.geom_type!='Polygon':continue
  polys.append(poly)
 polys.sort(key=lambda p:p.area,reverse=True)
 outer=[]
 for poly in polys:
  if not any(p.contains(poly.representative_point()) for p in outer):outer.append(poly)
  else:
   for i,p in enumerate(outer):
    if p.contains(poly.representative_point()):outer[i]=p.difference(poly);break
 for poly in outer:
  if poly.area<8:continue
  minx,miny,maxx,maxy=poly.bounds
  if minx<local_bounds[0]+2 or maxx>local_bounds[2]-2 or miny<local_bounds[1]+2 or maxy>local_bounds[3]-2:continue
  coords=np.array(poly.exterior.coords)
  # Interior samples determine observed roof eaves and ridge heights.
  xx,yy=np.meshgrid(np.arange(minx+.5,maxx,1),np.arange(miny+.5,maxy,1));xx=xx.ravel();yy=yy.ravel();mask=contains_xy(poly.buffer(-.6),xx,yy);xx=xx[mask];yy=yy[mask]
  if len(xx)<3:continue
  ground=sample('dem',xx,yy);surface=sample('dsm',xx,yy);good=(ground>-100)&(surface-ground>1.6)&(surface-ground<45)
  if good.sum()<3:bad+=1;continue
  xx,yy,ground,surface=xx[good],yy[good],ground[good],surface[good]
  floor=float(np.percentile(ground,35));lo,hi=np.percentile(surface,[15,90]);eave=float(max(floor+2,lo))
  # Recover dominant measured roof planes, rejecting isolated LiDAR/vegetation noise.
  lx=xx-minx;ly=yy-miny;design=np.column_stack([lx,ly,np.ones(len(xx))]);remaining=np.ones(len(xx),dtype=bool);planes=[];labels=np.full(len(xx),-1);rng=np.random.default_rng(int(feature['attributes']['building_id']))
  for plane_index in range(5):
   candidates=np.where(remaining)[0]
   if len(candidates)<max(8,len(xx)*.06):break
   best=None;best_count=0
   for attempt in range(45):
    idx=rng.choice(candidates,3,replace=False)
    try:coef=np.linalg.solve(design[idx],surface[idx])
    except np.linalg.LinAlgError:continue
    if np.hypot(coef[0],coef[1])>1.5:continue
    inliers=remaining&(np.abs(design@coef-surface)<.22);count=int(inliers.sum())
    if count>best_count:best=inliers;best_count=count
   if best is None or best_count<max(8,len(xx)*.06):break
   coef=np.linalg.lstsq(design[best],surface[best],rcond=None)[0];planes.append(coef);labels[best]=len(planes)-1;remaining[best]=False
  # Roof vertices on exact footprint boundary plus regularly spaced interior grid.
  boundary=[]
  for ring in [poly.exterior,*poly.interiors]:
   rc=list(ring.coords)
   for a,b in zip(rc,rc[1:]):
    length=np.linalg.norm(np.array(b)-a);steps=max(1,int(np.ceil(length/2)))
    for j in range(steps):boundary.append((a[0]+(b[0]-a[0])*j/steps,a[1]+(b[1]-a[1])*j/steps))
  interior=list(zip(xx[::4],yy[::4]));points=boundary+interior
  from shapely.geometry import MultiPoint
  triangles=triangulate(MultiPoint(points));valid=[];covered=0
  # At footprint edges DSM mixes wall/ground. Transfer nearby interior roof samples.
  def roof_height(x,y):
   d=(xx-x)**2+(yy-y)**2;idx=np.argpartition(d,min(11,len(d)-1))[:min(12,len(d))];valid_labels=labels[idx][labels[idx]>=0]
   if len(valid_labels):
    plane=np.bincount(valid_labels).argmax();v=float(np.dot([x-minx,y-miny,1],planes[plane]))
   else:v=float(np.median(surface[idx]))
   return float(np.clip(v,max(floor+2,lo-.6),hi+.5))
  for tri in triangles:
   clipped=tri.intersection(poly)
   if clipped.is_empty:continue
   pieces=[clipped] if clipped.geom_type=='Polygon' else list(getattr(clipped,'geoms',[]))
   for piece in pieces:
    if piece.geom_type!='Polygon' or piece.area<.00001:continue
    for face in triangulate(piece):
     if not piece.covers(face):continue
     covered+=face.area
     for x,y in list(face.exterior.coords)[:3]:valid.extend([round(x-ox,3),round(roof_height(x,y)-origin_elevation,3),round(oy-y,3)])
  if not valid:continue
  roofvertices.extend(valid);roofcoverage.append(covered/poly.area)
  for ring in [poly.exterior,*poly.interiors]:
   raw=list(ring.coords);rc=[]
   for a,b in zip(raw,raw[1:]):
    count=max(1,int(np.ceil(np.linalg.norm(np.array(b)-a)/2)))
    rc.extend([(a[0]+(b[0]-a[0])*j/count,a[1]+(b[1]-a[1])*j/count) for j in range(count)])
   rc.append(rc[0])
   for a,b in zip(rc,rc[1:]):
    # Keep every corner in the official outline, with ground-following bases.
    ax,az=a[0]-ox,oy-a[1];bx,bz=b[0]-ox,oy-b[1];ab=float(sample('dem',*a))-origin_elevation-.12;bb=float(sample('dem',*b))-origin_elevation-.12;ah=roof_height(*a)-origin_elevation;bh=roof_height(*b)-origin_elevation
    wallvertices.extend([ax,ab,az,bx,bb,bz,bx,bh,bz,ax,ab,az,bx,bh,bz,ax,ah,az])
  buildings.append({'id':feature['attributes']['building_id'],'rings':[[[round(x-ox,3),round(oy-y,3)] for x,y in r.coords] for r in [poly.exterior,*poly.interiors]],'ground':round(floor,2),'eave':round(eave,2),'ridge':round(float(hi),2)})
print('Buildings with observed roof surfaces',len(buildings),'omitted without roof returns',bad,flush=True)
(ROOT/'dist/building-roofs.bin').write_bytes(np.array(roofvertices,dtype='<f4').tobytes());(ROOT/'dist/building-walls.bin').write_bytes(np.array(wallvertices,dtype='<f4').tobytes());(ROOT/'dist/buildings.json').write_text(json.dumps(buildings,separators=(',',':')))
# Use the exact same projection for street coordinates and all terrain data.
t=Transformer.from_crs(4326,2193,always_xy=True);roads=json.loads((ROOT/'dist/map.json').read_text());roads['elements']=[el for el in roads['elements'] if 'highway' in el['tags']]
for el in roads['elements']:
 for p in el['geometry']:
  x,y=t.transform(p['lon'],p['lat']);p['x']=round(x-ox,3);p['z']=round(oy-y,3)
(ROOT/'dist/map.json').write_text(json.dumps(roads,separators=(',',':')))
meta={'originNZTM':ORIGIN,'originElevation':round(origin_elevation,3),'verticalScale':1,'terrain':{'size':size,'step':20,'minX':-3500,'minZ':-3500},'fine':{'width':len(xs),'height':len(zs),'step':2,'minX':-1000,'minZ':-1100},'sources':{'ground':'LINZ Hutt City LiDAR 1m DEM (2025), with Wellington LiDAR (2013–2014) and national 8m DEM filling regional survey gaps','roofs':'LINZ Hutt City LiDAR 1m DSM (2025), sampled within building outlines','footprints':'LINZ NZ Building Outlines — Hutt City aerial imagery (2021)','roads':'OpenStreetMap'},'counts':{'buildings':len(buildings),'roofTriangles':len(roofvertices)//9,'wallTriangles':len(wallvertices)//9,'minimumRoofCoverage':round(min(roofcoverage),6)},'terrainElevationRange':[round(float(terrain.min()),2),round(float(terrain.max()),2)]}
(ROOT/'dist/geodata.json').write_text(json.dumps(meta,indent=2));print(json.dumps(meta,indent=2),flush=True)
