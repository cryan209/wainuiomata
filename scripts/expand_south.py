"""Extend mapped forest-park / Coast Road coverage to the Wainuiomata south coast.
Preserve existing survey terrain; fill new area with LINZ national 8m DEM sampled at 25m.
Run with the GIS Python environment, then prepare_regional_coast.py.
"""
import pathlib,json,subprocess,os
import numpy as np,rasterio
from rasterio.enums import Resampling
from rasterio.transform import from_origin
from rasterio.warp import reproject
from lib.regional_map import load_map,save_map
ROOT=pathlib.Path(__file__).resolve().parents[1];DIST=ROOT/'dist';CACHE=pathlib.Path('/private/tmp/wainui-south');CACHE.mkdir(exist_ok=True)
# Reuse the OSM parser and resilient tiled fetcher, with its own geographic cache.
source=(ROOT/'scripts/prepare_regional_map.py').read_text()
source=source.replace("'/private/tmp/wainui-regional-osm'","'/private/tmp/wainui-south-osm'").replace('174.80,-41.345,175.015,-41.155','174.84,-41.445,175.065,-41.30')
source=source.replace('i/6','i/4').replace('j/6','j/4').replace('(i+1)/6','(i+1)/4').replace('(j+1)/6','(j+1)/4').replace('range(6)','range(4)')
source=source.replace("dist/regional-map.json","dist/south-map.json").replace("dist/regional-waterways.json","dist/south-waterways.json").replace("dist/regional-coast-input.json","dist/south-coast-input.json")
exec(compile(source,str(ROOT/'scripts/prepare_regional_map.py'),'exec'),{'__file__':str(ROOT/'scripts/prepare_regional_map.py')})
for main,extra,key in [('regional-map.json','south-map.json','elements'),('regional-waterways.json','south-waterways.json',None)]:
 a=load_map() if key else json.loads((DIST/main).read_text());b=json.loads((DIST/extra).read_text());rows={r['id']:r for r in (a[key] if key else a)};rows.update({r['id']:r for r in (b[key] if key else b)})
 if key:a[key]=list(rows.values());a['bounds'].update(maxX=8500,maxZ=19000)
 else:a=list(rows.values())
 save_map(a) if key else (DIST/main).write_text(json.dumps(a,separators=(',',':')))
a=json.loads((DIST/'regional-coast-input.json').read_text());b=json.loads((DIST/'south-coast-input.json').read_text())
for key in ['coastline','forest','beaches','places']:
 rows={json.dumps(r,sort_keys=True):r for r in a[key]+b[key]};a[key]=list(rows.values())
a['bounds'].update(maxX=8500,maxZ=19000);(DIST/'regional-coast-input.json').write_text(json.dumps(a,separators=(',',':')))
meta=json.loads((DIST/'regional-terrain.json').read_text());old=np.fromfile(DIST/'regional-terrain.bin',dtype='<i4').reshape(meta['height'],meta['width'])
if meta['maxZ']<19000 or meta['maxX']<8500:
 ox,oy=json.loads((DIST/'geodata.json').read_text())['originNZTM'];step=25;minx,minz=meta['minX'],meta['minZ'];maxx,maxz=8500,19000;nx=(maxx-minx)//step+1;nz=(maxz-minz)//step+1;transform=from_origin(ox+minx-step/2,oy-minz+step/2,step,step);out=np.full((nz,nx),-9999,dtype=np.float32)
 with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR',CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tiff',GDAL_HTTP_TIMEOUT='60'):
  for sheet in ['BP32','BQ31','BQ32']:
   url='https://nz-elevation.s3.ap-southeast-2.amazonaws.com/new-zealand/new-zealand-contour/dem_8m/2193/'+sheet+'.tiff'
   with rasterio.open(url) as src:
    target=np.full_like(out,-9999);reproject(rasterio.band(src,1),target,src_transform=src.transform,src_crs=src.crs,dst_transform=transform,dst_crs=2193,src_nodata=src.nodata,dst_nodata=-9999,resampling=Resampling.bilinear);valid=target>-1000;out[valid]=target[valid]
   print('South terrain',sheet,flush=True)
 out[out<-1000]=-3;out=np.round(out*100).astype('<i4');out[:old.shape[0],:old.shape[1]]=old;out.tofile(DIST/'regional-terrain.bin');meta.update(width=nx,height=nz,maxX=maxx,maxZ=maxz);meta['bounds'].update(maxX=maxx-500,maxZ=maxz-500);meta['sources']+='; south/east extension: LINZ national contour DEM (8m source / 25m grid)';(DIST/'regional-terrain.json').write_text(json.dumps(meta,indent=2))
print('South coast expansion data ready',flush=True)

for name in ['south-map.json','south-waterways.json','south-coast-input.json']:(DIST/name).unlink(missing_ok=True)
