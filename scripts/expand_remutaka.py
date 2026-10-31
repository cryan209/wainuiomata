"""Extend the regional terrain east over the Remutaka Range to Featherston, and finish the sea.
Run with /private/tmp/wainui-gis/bin/python. Downloads are cached in /private/tmp/wainui-remutaka.
Terrain is the LINZ national 8m contour DEM sampled on the existing 25m grid; every surveyed sample is
retained and only former no-data placeholders (-3m) are refilled. Large DEM no-data areas are open sea
(the contour DEM stops at the shoreline), so Porirua Harbour, the Ōhāriu coast and Palliser Bay become water
instead of flat ground. Sea polygons continue past the grid so the coast does not end in a hard edge.
Forest uses mapped OSM woodland (largely the LINZ Topo50 wood import)."""
import pathlib,json,subprocess,urllib.parse
import numpy as np,rasterio
from rasterio.enums import Resampling
from rasterio.transform import from_origin
from rasterio.windows import from_bounds
from rasterio.warp import reproject
from rasterio import features
from shapely.geometry import shape,box,Polygon,Point
from shapely.ops import unary_union
from pyproj import Transformer
from PIL import Image,ImageDraw
from lib.regional_map import load_map,save_map
ROOT=pathlib.Path(__file__).resolve().parents[1];D=ROOT/'dist';CACHE=pathlib.Path('/private/tmp/wainui-remutaka');CACHE.mkdir(exist_ok=True)
def load(n):return json.loads((D/n).read_text())
def save(n,d):(D/n).write_text(json.dumps(d,separators=(',',':')))
BASE='https://nz-elevation.s3.ap-southeast-2.amazonaws.com/new-zealand/new-zealand-contour/dem_8m/2193/'
ENV=dict(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR',CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tiff',GDAL_HTTP_TIMEOUT='60',GDAL_HTTP_MAX_RETRY='2')
geo=load('geodata.json');ox,oy=geo['originNZTM'];m=load('regional-terrain.json');step=25
nb={'minX':m['minX'],'maxX':34000,'minZ':m['minZ'],'maxZ':m['maxZ']}
if m['maxX']>=nb['maxX']:raise SystemExit('Already extended. Restore the pre-extension assets (e.g. /private/tmp/wainui-before-remutaka.tar.gz) before rebuilding.')
def dem(sheets,l,b,r,t,res,tag):
 """Mosaic DEM sheets onto a north-up grid at res metres; -9999 is no-data (sea or no sheet)."""
 nx=round((r-l)/res)+1;nz=round((t-b)/res)+1;tr=from_origin(l-res/2,t+res/2,res,res);out=np.full((nz,nx),-9999,dtype=np.float32)
 with rasterio.Env(**ENV):
  for sheet in sheets:
   cache=CACHE/f'{tag}-{sheet}.npz'
   if cache.exists():c=np.load(cache);a,srcTr=c['a'],rasterio.Affine(*c['t'])
   else:
    with rasterio.open(BASE+sheet+'.tiff') as src:
     L,B,R,Tp=max(l-res,src.bounds.left),max(b-res,src.bounds.bottom),min(r+res,src.bounds.right),min(t+res,src.bounds.top)
     if L>=R or B>=Tp:np.savez_compressed(cache,a=np.zeros((0,0),np.float32),t=np.zeros(6));continue
     win=from_bounds(L,B,R,Tp,src.transform);h=max(1,round((Tp-B)/res));w=max(1,round((R-L)/res));a=src.read(1,window=win,out_shape=(h,w),resampling=Resampling.bilinear);a[a==src.nodata]=-9999;srcTr=src.window_transform(win)*src.transform.scale(win.width/w,win.height/h);np.savez_compressed(cache,a=a,t=np.array(tuple(srcTr)[:6]))
   if a.size==0:continue
   target=np.full_like(out,-9999);reproject(a,target,src_transform=srcTr,src_crs=2193,dst_transform=tr,dst_crs=2193,src_nodata=-9999,dst_nodata=-9999,resampling=Resampling.bilinear);valid=target>-1000;out[valid]=target[valid];print(tag,sheet,flush=True)
 return out,tr
# 1. Terrain: wider grid, old samples kept except their no-data placeholders.
old=np.fromfile(D/'regional-terrain.bin',dtype='<i4').reshape(m['height'],m['width'])
nx=(nb['maxX']-nb['minX'])//step+1;nz=(nb['maxZ']-nb['minZ'])//step+1
fresh,_=dem(['BP31','BP32','BP33','BQ31','BQ32','BQ33'],ox+nb['minX'],oy-nb['maxZ'],ox+nb['maxX'],oy-nb['minZ'],step,'grid')
assert fresh.shape==(nz,nx),fresh.shape
missingOld=np.zeros((nz,nx),bool);missingOld[:,old.shape[1]:]=True
if m['maxX']<nb['maxX']:
 terrain=np.full((nz,nx),-300,dtype='<i4');terrain[:,:old.shape[1]]=old
else:terrain=old.copy()
placeholder=terrain==-300;fill=placeholder&(fresh>-1000);terrain[fill]=np.round(fresh[fill]*100).astype('<i4')
missing=terrain==-300
print('Refilled',int(fill[:,:old.shape[1]].sum()),'old placeholder samples; new columns',nx-old.shape[1],flush=True)
# 2. Sea: large connected no-data areas (small inland holes stay land).
def polys(arr,tr,value=1):return[shape(g) for g,v in features.shapes(arr.astype(np.uint8),transform=tr) if v==value]
local=rasterio.Affine(step,0,nb['minX']-step/2,0,step,nb['minZ']-step/2)
sea=features.rasterize([p for p in polys(missing,local) if p.area>=2000*step*step],out_shape=missing.shape,transform=local).astype(bool)&missing
# 3. Coast mask: established shoreline kept, sea added where the DEM has no ground.
coast=load('regional-coast.json');scale=7.8125;mw,mh=round((nb['maxX']-nb['minX'])/scale),round((nb['maxZ']-nb['minZ'])/scale)
oldMask=Image.open(D/coast['mask']).convert('L');mask=Image.new('L',(mw,mh),255);mask.paste(oldMask,(round((coast['bounds']['minX']-nb['minX'])/scale),round((coast['bounds']['minZ']-nb['minZ'])/scale)))
seaHi=np.array(Image.fromarray((sea*255).astype(np.uint8)).resize((mw,mh),Image.BILINEAR))>127
maskArr=np.array(mask);oldWaterHi=maskArr<128;maskArr[seaHi]=0;Image.fromarray(maskArr).save(D/'coast-mask-remutaka.png',optimize=True)
# 4. Water meshes: new in-grid sea plus open water beyond the grid, minus already-mapped harbour water.
grid=box(nb['minX'],nb['minZ'],nb['maxX'],nb['maxZ'])
inner=unary_union(polys(sea,local)).buffer(40).intersection(grid)
res=200;ol,ot,orr,ob=-45000,-40000,50000,45000
outer,otr=dem(['BN32','BN33','BN34','BP30','BP31','BP32','BP33','BP34','BQ30','BQ31','BQ32','BQ33','BQ34','BR33','BR34'],ox+ol,oy-ob,ox+orr,oy-ot,res,'outer')
outerSea=outer<-1000
outerLocal=rasterio.Affine(res,0,ol-res/2,0,res,ot-res/2)
beyond=unary_union(polys(outerSea,outerLocal)).buffer(res).difference(grid.buffer(-60))
oldWater=unary_union([Polygon(r[0],r[1:]).buffer(0) for r in coast['water']])
added=unary_union([inner,beyond]).difference(oldWater.buffer(-1)).simplify(12)
def parts(g):return[g] if g.geom_type=='Polygon' else [p for p in getattr(g,'geoms',[]) if p.geom_type=='Polygon']
def rings(p):return[[[round(x,1),round(z,1)] for x,z in r.coords] for r in [p.exterior,*p.interiors]]
water=coast['water']+[rings(p) for p in parts(added) if p.area>20000]
# 5. Forest: OSM woodland across the extension, the old raster pasted back unchanged.
osm=CACHE/'woodland.json'
if not osm.exists():
 q='[out:json][timeout:180];(way["natural"="wood"](-41.48,174.95,-41.02,175.40);way["landuse"="forest"](-41.48,174.95,-41.02,175.40);relation["natural"="wood"](-41.48,174.95,-41.02,175.40);relation["landuse"="forest"](-41.48,174.95,-41.02,175.40););out geom;'
 for url in ['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter']:
  if subprocess.run(['curl','-sS','--fail','--max-time','240','-A','wainuiomata-terrain-build/1.0',url,'--data-urlencode','data='+q,'-o',str(osm)]).returncode==0:break
 else:raise SystemExit('Overpass woodland request failed')
project=Transformer.from_crs(4326,2193,always_xy=True)
def xz(pts):
 e,n=project.transform([p['lon'] for p in pts],[p['lat'] for p in pts]);return[(a-ox,oy-b) for a,b in zip(e,n)]
woods=[]
for el in json.loads(osm.read_text())['elements']:
 if el['type']=='way' and len(el.get('geometry',[]))>3:woods.append(Polygon(xz(el['geometry'])).buffer(0))
 elif el['type']=='relation':
  from shapely.ops import polygonize
  from shapely.geometry import LineString
  outerL=[LineString(xz(w['geometry'])) for w in el['members'] if w['type']=='way' and w.get('role')!='inner' and len(w.get('geometry',[]))>1];innerL=[LineString(xz(w['geometry'])) for w in el['members'] if w['type']=='way' and w.get('role')=='inner' and len(w.get('geometry',[]))>1]
  if not outerL:continue
  g=unary_union(list(polygonize(unary_union(outerL))))
  if innerL:g=g.difference(unary_union(list(polygonize(unary_union(innerL)))))
  woods.append(g)
fw,fh=round(mw/4),round(mh/4);forestImg=Image.new('L',(fw,fh));draw=ImageDraw.Draw(forestImg)
def fpx(x,z):return((x-nb['minX'])/(nb['maxX']-nb['minX'])*fw,(z-nb['minZ'])/(nb['maxZ']-nb['minZ'])*fh)
newCols=box(-3500,nb['minZ'],nb['maxX'],nb['maxZ'])
for g in woods:
 for p in parts(g.intersection(newCols)):
  if p.area<2000:continue
  draw.polygon([fpx(x,z) for x,z in p.exterior.coords],fill=235)
  for r in p.interiors:draw.polygon([fpx(x,z) for x,z in r.coords],fill=0)
oldForest=Image.fromarray(np.fromfile(D/'regional-forest.bin',dtype='u1').reshape(coast['forest']['height'],coast['forest']['width']))
# Mapped woodland (east of the town) only adds cover east of the town; the earlier aerial/OSM raster is otherwise unchanged.
forest=np.array(forestImg);prior=np.zeros_like(forest);prior[:oldForest.height,:oldForest.width]=np.array(oldForest);forest=np.maximum(prior,forest);forest[np.array(Image.fromarray(maskArr).resize((fw,fh)))<128]=0;(D/'regional-forest.bin').write_bytes(forest.tobytes())
# 6. Metadata. Playable bounds stay 500m inside the terrain, as for the earlier extensions.
terrain.tofile(D/'regional-terrain.bin')
if m['maxX']<nb['maxX']:m['sources']+='; Remutaka Range to Featherston: LINZ national contour DEM (8m source / 25m grid)'
m.update(width=int(nx),height=int(nz),maxX=nb['maxX'],missingOffshoreSamples=int(missing.sum()));m['bounds']['maxX']=nb['maxX']-500;(D/'regional-terrain.json').write_text(json.dumps(m,indent=2))
roads=load_map();roads['bounds']['maxX']=nb['maxX'];save_map(roads)
data=load('regional-coast-input.json');data['bounds']['maxX']=nb['maxX'];save('regional-coast-input.json',data)
coast.update(bounds={k:nb[k] for k in ['minX','maxX','minZ','maxZ']},mask='coast-mask-remutaka.png',water=water,forest={'width':fw,'height':fh});save('regional-coast.json',coast)
# Checks: summit and Featherston are dry high/low ground; Palliser Bay and the Ōhāriu coast are sea.
def at(lon,lat):
 e,n=project.transform(lon,lat);x,z=e-ox,oy-n;return x,z,terrain[round((z-nb['minZ'])/step),round((x-nb['minX'])/step)]/100,maskArr[int((z-nb['minZ'])/scale),int((x-nb['minX'])/scale)]>127
for name,lon,lat,land in [('Remutaka summit',175.2305,-41.1075,True),('Featherston',175.325,-41.116,True),('Palliser Bay',175.141,-41.425,False),('Ōhāriu coast sea',174.728,-41.175,False),('Petone',174.88,-41.225,True)]:
 x,z,h,isLand=at(lon,lat);print(name,round(x),round(z),h,'land' if isLand else 'sea',flush=True);assert isLand==land,name
print('Remutaka expansion ready:',nx,'x',nz,'samples,',len(water),'water polygons,',round(float((forest>100).mean())*100,1),'% woodland',flush=True)
# 7. Ground photography for the new strip: run scripts/prepare_outer_imagery.py afterwards.
