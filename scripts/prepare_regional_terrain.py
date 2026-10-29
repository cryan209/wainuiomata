"""Survey-derived regional ground and surface grids; preserve the detailed town."""
import pathlib,json,subprocess,urllib.parse,concurrent.futures,math
import numpy as np,rasterio
from rasterio.enums import Resampling
from rasterio.windows import from_bounds
from rasterio.transform import from_origin
from rasterio.warp import reproject
ROOT=pathlib.Path(__file__).resolve().parents[1];CACHE=pathlib.Path('/private/tmp/wainui-regional-survey');CACHE.mkdir(exist_ok=True)
BASE='https://nz-elevation.s3.ap-southeast-2.amazonaws.com/'
meta=json.loads((ROOT/'dist/geodata.json').read_text());ox,oy=meta['originNZTM'];minx,maxx,minz,maxz=-10500,5500,-11500,9000
bounds=(ox+minx-20,oy-maxz-20,ox+maxx+20,oy-minz+20)
ENV={'GDAL_DISABLE_READDIR_ON_OPEN':'EMPTY_DIR','CPL_VSIL_CURL_ALLOWED_EXTENSIONS':'.tiff','GDAL_HTTP_TIMEOUT':'60','GDAL_HTTP_MAX_RETRY':'2'}
def getjson(url,path):
 if not path.exists():subprocess.run(['curl','-sS','--fail','--retry','2','--max-time','60',url,'-o',str(path)],check=True)
 return json.loads(path.read_text())
def window(url,step):
 with rasterio.Env(**ENV):
  with rasterio.open(url) as src:
   l,b,r,t=bounds;l=max(l,src.bounds.left);r=min(r,src.bounds.right);b=max(b,src.bounds.bottom);t=min(t,src.bounds.top)
   if l>=r or b>=t:return None
   win=from_bounds(l,b,r,t,src.transform).round_offsets().round_lengths();h=max(1,round(win.height/step));w=max(1,round(win.width/step));a=src.read(1,window=win,out_shape=(h,w),resampling=Resampling.bilinear);tr=src.window_transform(win)*src.transform.scale(win.width/w,win.height/h)
   return a,tr
step=25;nx=(maxx-minx)//step+1;nz=(maxz-minz)//step+1;transform=from_origin(ox+minx-step/2,oy-minz+step/2,step,step)
coarse=np.full((nz,nx),-9999,dtype=np.float32)
for sheet in ['BP31','BP32','BQ31','BQ32']:
 p=CACHE/f'national-{sheet}.npz'
 if p.exists():c=np.load(p);a,tr=c['a'],rasterio.Affine(*c['t'])
 else:
  result=window(BASE+f'new-zealand/new-zealand-contour/dem_8m/2193/{sheet}.tiff',25)
  if result is None:continue
  a,tr=result;np.savez_compressed(p,a=a,t=np.array(tuple(tr)[:6]))
 target=np.full_like(coarse,-9999);reproject(a,target,src_transform=tr,src_crs=2193,dst_transform=transform,dst_crs=2193,src_nodata=-9999,dst_nodata=-9999,resampling=Resampling.bilinear);ok=target!=-9999;coarse[ok]=target[ok]
 print('Regional base DEM',sheet,flush=True)
if not (CACHE/'surface.npz').exists():
 tasks=[]
 for priority,survey in enumerate(['wellington_2013-2014','hutt-city_2025']):
  prefix=BASE+f'wellington/{survey}/dem_1m/2193/'
  collection=getjson(prefix+'collection.json',CACHE/f'{survey}-collection.json')
  candidates=[pathlib.Path(x['href']).stem for x in collection['links'] if x['rel']=='item' and pathlib.Path(x['href']).stem.startswith(('BP31_','BP32_','BQ31_','BQ32_'))]
  def item(tile):
   data=getjson(prefix+tile+'.json',CACHE/f'{survey}-{tile}.json');b=data['bbox'];return tile if b[0]<175.03 and b[2]>174.77 and b[1]<-41.145 and b[3]>-41.36 else None
  with concurrent.futures.ThreadPoolExecutor(5) as pool:ids=[x for x in pool.map(item,candidates) if x]
  for tile in ids:
   for kind in ['dem','dsm']:tasks.append((priority,survey,tile,kind))
 rows=(maxz-minz)//4+1;cols=(maxx-minx)//4+1;tr4=from_origin(ox+minx-2,oy-minz+2,4,4);rasters={k:np.full((rows,cols),-9999,dtype=np.float32) for k in ['dem','dsm']}
 def tile(task):
  priority,survey,id,kind=task;p=CACHE/f'{survey}-{kind}-{id}.npz'
  if p.exists():c=np.load(p);return kind,c['a'],rasterio.Affine(*c['t'])
  result=window(BASE+f'wellington/{survey}/{kind}_1m/2193/{id}.tiff',4)
  if result is None:return None
  a,tr=result;np.savez_compressed(p,a=a,t=np.array(tuple(tr)[:6]));return kind,a,tr
 with concurrent.futures.ThreadPoolExecutor(3) as pool:
  for i,result in enumerate(pool.map(tile,tasks)):
   if result:
    kind,a,tr=result;target=np.full((rows,cols),-9999,dtype=np.float32);reproject(a,target,src_transform=tr,src_crs=2193,dst_transform=tr4,dst_crs=2193,src_nodata=-9999,dst_nodata=-9999,resampling=Resampling.bilinear);valid=target!=-9999;rasters[kind][valid]=target[valid]
   print('Regional LiDAR',i+1,'/',len(tasks),flush=True)
 np.savez_compressed(CACHE/'surface.npz',**rasters,minX=minx,minZ=minz,step=4)
else:rasters=np.load(CACHE/'surface.npz')
# Bilinear 4m survey samples onto the 25m browser grid, preserving the real datum.
xx,zz=np.meshgrid(np.arange(nx)*25/4,np.arange(nz)*25/4);ix=np.minimum(xx.astype(int),rasters['dem'].shape[1]-2);iz=np.minimum(zz.astype(int),rasters['dem'].shape[0]-2);fx=xx-ix;fz=zz-iz;a=rasters['dem'];values=[a[iz,ix],a[iz,ix+1],a[iz+1,ix],a[iz+1,ix+1]];survey=values[0]*(1-fx)*(1-fz)+values[1]*fx*(1-fz)+values[2]*(1-fx)*fz+values[3]*fx*fz;valid=np.minimum.reduce(values)>-1000;coarse[valid]=survey[valid]
# Missing offshore pixels are below the water plane. Land coverage is checked after shoreline extraction.
missing=coarse<-1000;coarse[missing]=-3
(ROOT/'dist/regional-terrain.bin').write_bytes(np.round(coarse*100).astype('<i4').tobytes())
info={'width':nx,'height':nz,'step':25,'minX':minx,'maxX':maxx,'minZ':minz,'maxZ':maxz,'bounds':{'minX':minx+500,'maxX':maxx-500,'minZ':minz+500,'maxZ':maxz-500},'datum':meta['originElevation'],'verticalScale':1,'sources':'LINZ Hutt City LiDAR 2025; Wellington LiDAR 2013–2014; national 8m contour DEM for gaps','missingOffshoreSamples':int(missing.sum())}
(ROOT/'dist/regional-terrain.json').write_text(json.dumps(info,indent=2));print('Regional terrain ready',nx,nz,'elevation range',float(coarse.min()),float(coarse.max()),flush=True)
