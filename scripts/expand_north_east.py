"""Extend the regional terrain north over Porirua and the Kāpiti Coast to Waikanae, and east across the
Wairarapa to Greytown and Martinborough. Stage 1 of the north/east expansion: terrain, sea, coast mask, water and woodland.
Run with /private/tmp/wainui-gis/bin/python. Downloads are cached in /private/tmp/wainui-north-east.
Terrain is the LINZ national 8m contour DEM sampled on the existing 25m grid; every existing sample is retained and only
former no-data placeholders (-3m) are refilled. Large DEM no-data areas are open sea. The coast mask is resampled from
7.8125 to 10 m/pixel so the larger grid decodes to about the same RGBA canvas size in the browser.
Follow with scripts/prepare_outer_imagery.py and scripts/expand_north_east_map.py."""
import pathlib,json,subprocess
import numpy as np,rasterio
from rasterio.enums import Resampling
from rasterio.transform import from_origin
from rasterio.windows import from_bounds
from rasterio.warp import reproject
from rasterio import features
from shapely.geometry import shape,box,Polygon,LineString
from shapely.ops import unary_union,polygonize
from pyproj import Transformer
from PIL import Image,ImageDraw
from lib.regional_map import load_map,save_map
Image.MAX_IMAGE_PIXELS=None
ROOT=pathlib.Path(__file__).resolve().parents[1];D=ROOT/'dist';CACHE=pathlib.Path('/private/tmp/wainui-north-east');CACHE.mkdir(exist_ok=True)
def load(n):return json.loads((D/n).read_text())
def save(n,d):(D/n).write_text(json.dumps(d,separators=(',',':')))
BASE='https://nz-elevation.s3.ap-southeast-2.amazonaws.com/new-zealand/new-zealand-contour/dem_8m/2193/'
ENV=dict(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR',CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tiff',GDAL_HTTP_TIMEOUT='60',GDAL_HTTP_MAX_RETRY='2')
geo=load('geodata.json');ox,oy=geo['originNZTM'];m=load('regional-terrain.json');step=25
nb={'minX':m['minX'],'maxX':46000,'minZ':-44000,'maxZ':m['maxZ']}
if m['maxX']>=nb['maxX'] and m['minZ']<=nb['minZ']:raise SystemExit('Already extended. Restore /private/tmp/wainui-before-north-east.tar.gz before rebuilding.')
assert m['minX']==nb['minX'] and m['maxZ']==nb['maxZ']
project=Transformer.from_crs(4326,2193,always_xy=True)
def dem(sheets,l,b,r,t,res,tag):
 """Mosaic DEM sheets onto a north-up grid at res metres; -9999 is no-data (sea or no sheet)."""
 nx=round((r-l)/res)+1;nz=round((t-b)/res)+1;tr=from_origin(l-res/2,t+res/2,res,res);out=np.full((nz,nx),-9999,dtype=np.float32)
 with rasterio.Env(**ENV):
  for sheet in sheets:
   cache=CACHE/f'{tag}-{sheet}.npz'
   if cache.exists():c=np.load(cache);a,srcTr=c['a'],rasterio.Affine(*c['t'])
   else:
    try:src=rasterio.open(BASE+sheet+'.tiff')
    except rasterio.errors.RasterioIOError:np.savez_compressed(cache,a=np.zeros((0,0),np.float32),t=np.zeros(6));print(tag,sheet,'(no sheet: open sea)',flush=True);continue
    with src:
     L,B,R,Tp=max(l-res,src.bounds.left),max(b-res,src.bounds.bottom),min(r+res,src.bounds.right),min(t+res,src.bounds.top)
     if L>=R or B>=Tp:np.savez_compressed(cache,a=np.zeros((0,0),np.float32),t=np.zeros(6));continue
     win=from_bounds(L,B,R,Tp,src.transform);h=max(1,round((Tp-B)/res));w=max(1,round((R-L)/res));a=src.read(1,window=win,out_shape=(h,w),resampling=Resampling.bilinear);a[a==src.nodata]=-9999;srcTr=src.window_transform(win)*src.transform.scale(win.width/w,win.height/h);np.savez_compressed(cache,a=a,t=np.array(tuple(srcTr)[:6]))
   if a.size==0:continue
   target=np.full_like(out,-9999);reproject(a,target,src_transform=srcTr,src_crs=2193,dst_transform=tr,dst_crs=2193,src_nodata=-9999,dst_nodata=-9999,resampling=Resampling.bilinear);valid=target>-1000;out[valid]=target[valid];print(tag,sheet,flush=True)
 return out,tr
# 1. Terrain: taller and wider grid. Old samples keep their place (old rows start 820 rows down); only placeholders refill.
old=np.fromfile(D/'regional-terrain.bin',dtype='<i4').reshape(m['height'],m['width'])
nx=(nb['maxX']-nb['minX'])//step+1;nz=(nb['maxZ']-nb['minZ'])//step+1;row0=(m['minZ']-nb['minZ'])//step
fresh,_=dem([f'B{r}{c}' for r in 'PQ' for c in (31,32,33,34)],ox+nb['minX'],oy-nb['maxZ'],ox+nb['maxX'],oy-nb['minZ'],step,'grid')
assert fresh.shape==(nz,nx),fresh.shape
terrain=np.full((nz,nx),-300,dtype='<i4');terrain[row0:row0+old.shape[0],:old.shape[1]]=old
fill=(terrain==-300)&(fresh>-1000);terrain[fill]=np.round(fresh[fill]*100).astype('<i4');missing=terrain==-300
print('Grid',nx,'x',nz,'; refilled',int(fill.sum()),'samples',flush=True)
# 2. Sea: large connected no-data areas (small inland holes stay land).
def polys(arr,tr,value=1):return[shape(g) for g,v in features.shapes(arr.astype(np.uint8),transform=tr) if v==value]
local=rasterio.Affine(step,0,nb['minX']-step/2,0,step,nb['minZ']-step/2)
sea=features.rasterize([p for p in polys(missing,local) if p.area>=2000*step*step],out_shape=missing.shape,transform=local).astype(bool)&missing
# 3. Coast mask at 10 m/pixel: the established shoreline is resampled into place, sea added where the DEM has no ground.
coast=load('regional-coast.json');SCALE=10;mw,mh=(nb['maxX']-nb['minX'])//SCALE,(nb['maxZ']-nb['minZ'])//SCALE;ob=coast['bounds']
oldMask=Image.open(D/coast['mask']).convert('L').resize(((ob['maxX']-ob['minX'])//SCALE,(ob['maxZ']-ob['minZ'])//SCALE),Image.BILINEAR)
mask=Image.new('L',(mw,mh),255);mask.paste(oldMask,((ob['minX']-nb['minX'])//SCALE,(ob['minZ']-nb['minZ'])//SCALE))
seaHi=np.array(Image.fromarray((sea*255).astype(np.uint8)).resize((mw,mh),Image.BILINEAR))>127
maskArr=np.array(mask);maskArr[seaHi]=0;Image.fromarray(maskArr).save(D/'coast-mask-region.png',optimize=True)
# 4. Water meshes: new in-grid sea plus open water beyond the grid, minus already-mapped water.
grid=box(nb['minX'],nb['minZ'],nb['maxX'],nb['maxZ'])
inner=unary_union(polys(sea,local)).buffer(40).intersection(grid)
res=200;ol,ot,orr,obt=-50000,-75000,70000,50000
outer,_=dem([f'B{r}{c}' for r in 'NPQR' for c in (30,31,32,33,34,35)],ox+ol,oy-obt,ox+orr,oy-ot,res,'outer')
outerLocal=rasterio.Affine(res,0,ol-res/2,0,res,ot-res/2)
beyond=unary_union(polys(outer<-1000,outerLocal)).buffer(res).difference(grid.buffer(-60))
oldWater=unary_union([Polygon(r[0],r[1:]).buffer(0) for r in coast['water']])
added=unary_union([inner,beyond]).difference(oldWater.buffer(-1)).simplify(12)
def parts(g):return[g] if g.geom_type=='Polygon' else [p for p in getattr(g,'geoms',[]) if p.geom_type=='Polygon']
def rings(p):return[[[round(x,1),round(z,1)] for x,z in r.coords] for r in [p.exterior,*p.interiors]]
water=coast['water']+[rings(p) for p in parts(added) if p.area>20000]
# 5. Forest: mapped OSM woodland in the new strips; the old raster is pasted back unchanged.
def lonlat(x,z):
 inv=Transformer.from_crs(2193,4326,always_xy=True);return inv.transform(ox+x,oy-z)
strips=[box(nb['minX'],nb['minZ'],nb['maxX'],m['minZ']),box(m['maxX'],m['minZ'],nb['maxX'],nb['maxZ'])]
woods=[]
for k,s in enumerate(strips):
 osm=CACHE/f'woodland-{k}.json';x0,z0,x1,z1=s.bounds;lo0,la0=lonlat(x0,z1);lo1,la1=lonlat(x1,z0);bb=f'{min(la0,la1)},{min(lo0,lo1)},{max(la0,la1)},{max(lo0,lo1)}'
 if not osm.exists():
  q=f'[out:json][timeout:240];(way["natural"="wood"]({bb});way["landuse"="forest"]({bb});relation["natural"="wood"]({bb});relation["landuse"="forest"]({bb}););out geom;'
  for url in ['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter','https://maps.mail.ru/osm/tools/overpass/api/interpreter']:
   if subprocess.run(['curl','-sS','--fail','--max-time','300','-A','wainuiomata-terrain-build/1.0',url,'--data-urlencode','data='+q,'-o',str(osm)]).returncode==0:break
  else:raise SystemExit('Overpass woodland request failed')
 def xz(pts):
  e,n=project.transform([p['lon'] for p in pts],[p['lat'] for p in pts]);return[(a-ox,oy-b) for a,b in zip(e,n)]
 for el in json.loads(osm.read_text())['elements']:
  if el['type']=='way' and len(el.get('geometry',[]))>3:woods.append(Polygon(xz(el['geometry'])).buffer(0))
  elif el['type']=='relation':
   outerL=[LineString(xz(w['geometry'])) for w in el['members'] if w['type']=='way' and w.get('role')!='inner' and len(w.get('geometry',[]))>1];innerL=[LineString(xz(w['geometry'])) for w in el['members'] if w['type']=='way' and w.get('role')=='inner' and len(w.get('geometry',[]))>1]
   if not outerL:continue
   g=unary_union(list(polygonize(unary_union(outerL))))
   if innerL:g=g.difference(unary_union(list(polygonize(unary_union(innerL)))))
   woods.append(g)
FS=31.25;fw,fh=round((nb['maxX']-nb['minX'])/FS),round((nb['maxZ']-nb['minZ'])/FS);forestImg=Image.new('L',(fw,fh));draw=ImageDraw.Draw(forestImg)
def fpx(x,z):return((x-nb['minX'])/FS,(z-nb['minZ'])/FS)
newArea=unary_union(strips)
for g in woods:
 for p in parts(g.intersection(newArea)):
  if p.area<2000:continue
  draw.polygon([fpx(x,z) for x,z in p.exterior.coords],fill=235)
  for r in p.interiors:draw.polygon([fpx(x,z) for x,z in r.coords],fill=0)
oldForest=np.fromfile(D/'regional-forest.bin',dtype='u1').reshape(coast['forest']['height'],coast['forest']['width'])
forest=np.array(forestImg);fr0=round((m['minZ']-nb['minZ'])/FS);region=forest[fr0:fr0+oldForest.shape[0],:oldForest.shape[1]];np.maximum(region,oldForest,out=region)
forest[np.array(Image.fromarray(maskArr).resize((fw,fh)))<128]=0;(D/'regional-forest.bin').write_bytes(forest.tobytes())
# 6. Metadata. Playable bounds stay 500m inside the terrain, as for the earlier extensions.
terrain.tofile(D/'regional-terrain.bin')
m['sources']+='; Porirua, Kāpiti Coast and Wairarapa: LINZ national contour DEM (8m source / 25m grid)'
m.update(width=int(nx),height=int(nz),maxX=nb['maxX'],minZ=nb['minZ'],missingOffshoreSamples=int(missing.sum()));m['bounds'].update(maxX=nb['maxX']-500,minZ=nb['minZ']+500);(D/'regional-terrain.json').write_text(json.dumps(m,indent=2))
roads=load_map();roads['bounds'].update(maxX=nb['maxX'],minZ=nb['minZ']);save_map(roads)
data=load('regional-coast-input.json');data['bounds'].update(maxX=nb['maxX'],minZ=nb['minZ']);save('regional-coast-input.json',data)
coast.update(bounds={k:nb[k] for k in ['minX','maxX','minZ','maxZ']},mask='coast-mask-region.png',water=water,forest={'width':fw,'height':fh});save('regional-coast.json',coast)
(D/'coast-mask-remutaka.png').unlink(missing_ok=True)
# Checks: towns are dry land at plausible heights; harbours and open coast are sea.
def at(lon,lat):
 e,n=project.transform(lon,lat);x,z=e-ox,oy-n;return x,z,terrain[round((z-nb['minZ'])/step),round((x-nb['minX'])/step)]/100,maskArr[int((z-nb['minZ'])/SCALE),int((x-nb['minX'])/SCALE)]>127
for name,lon,lat,land in [('Porirua',174.840,-41.133,True),('Paraparaumu',175.005,-40.915,True),('Waikanae',175.065,-40.875,True),('Greytown',175.459,-41.081,True),('Martinborough',175.46,-41.218,True),('Featherston',175.325,-41.116,True),('Petone',174.88,-41.225,True),('Porirua Harbour',174.855,-41.115,False),('Kāpiti sea',174.93,-40.93,False),('Palliser Bay',175.141,-41.425,False)]:
 x,z,h,isLand=at(lon,lat);print(name,round(x),round(z),h,'land' if isLand else 'sea',flush=True);assert isLand==land,name
print('North/east terrain ready:',nx,'x',nz,'samples,',len(water),'water polygons,',round(float((forest>100).mean())*100,1),'% woodland',flush=True)
