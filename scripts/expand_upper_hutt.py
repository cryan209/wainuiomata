"""Add Upper Hutt from public OSM/LINZ data, preserving existing regional detail.
Run with the GIS Python environment. Network requests are cached in /private/tmp.
North/east terrain is a 25m rendering grid from LINZ's 8m national contour DEM;
new building footprints are official LINZ outlines with explicitly inferred heights.
"""
import pathlib,json,math,subprocess,urllib.parse
import numpy as np,rasterio
from rasterio.enums import Resampling
from rasterio.transform import from_origin
from rasterio.windows import from_bounds
from rasterio.warp import reproject
from PIL import Image,ImageDraw
from shapely.geometry import Polygon,Point
from lib.regional_map import load_map,save_map
ROOT=pathlib.Path(__file__).resolve().parents[1];D=ROOT/'dist';CACHE=pathlib.Path('/private/tmp/wainui-upper-hutt');CACHE.mkdir(exist_ok=True)
def load(name):return json.loads((D/name).read_text())
def save(name,data): (D/name).write_text(json.dumps(data,separators=(',',':')))
# Keep the established tiled OSM downloader, but use a distinct cache and outputs.
source=(ROOT/'scripts/prepare_regional_map.py').read_text().replace("'/private/tmp/wainui-regional-osm'","'/private/tmp/wainui-upper-osm'").replace('174.80,-41.345,175.015,-41.155','174.94,-41.19,175.16,-41.065')
source=source.replace('/6','/5').replace('range(6)','range(5)')
for name in ['map','waterways','coast-input']:source=source.replace('dist/regional-'+name+'.json','dist/upper-'+name+'.json')
ctx={'__file__':str(ROOT/'scripts/prepare_regional_map.py')};exec(compile(source,ctx['__file__'],'exec'),ctx)
new=load('upper-map.json');old=load_map();coords={str(p['node']):p for r in old['elements'] for p in r['geometry'] if p.get('node')};coords.update(ctx['coords']);merged={r['id']:r for r in old['elements']}
for r in new['elements']:
 # Reassemble cross-boundary ways from their original ordered node references.
 r['geometry']=[coords[n.attrib['ref']] for n in ctx['ways'][r['id']].findall('nd') if n.attrib['ref'] in coords];merged[r['id']]=r
old['elements']=list(merged.values());old['bounds'].update(maxX=20500,minZ=-23500);save_map(old)
water={r['id']:r for r in load('regional-waterways.json')}
for r in load('upper-waterways.json'):
 r['geometry']=[coords[n.attrib['ref']] for n in ctx['ways'][r['id']].findall('nd') if n.attrib['ref'] in coords];water[r['id']]=r
save('regional-waterways.json',list(water.values()))
extra=load('upper-coast-input.json');coastInput=load('regional-coast-input.json')
for key in ['forest','beaches','places']:
 coastInput[key]=list({json.dumps(p,sort_keys=True):p for p in coastInput[key]+extra[key]}.values())
coastInput['bounds'].update(maxX=20500,minZ=-23500);save('regional-coast-input.json',coastInput)
# Extend the elevation raster with correct offsets, retaining every old sample.
m=load('regional-terrain.json');oldBounds={k:m[k] for k in ['minX','minZ','maxX','maxZ']};terrainOld=np.fromfile(D/'regional-terrain.bin',dtype='<i4').reshape(m['height'],m['width']);ox,oy=load('geodata.json')['originNZTM'];datum=load('geodata.json')['originElevation'];step=25
if m['minZ']>-23500 or m['maxX']<20500:
 minx,minz,maxx,maxz=m['minX'],-23500,20500,m['maxZ'];nx=(maxx-minx)//step+1;nz=(maxz-minz)//step+1;transform=from_origin(ox+minx-step/2,oy-minz+step/2,step,step);out=np.full((nz,nx),-9999,dtype=np.float32)
 with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR',CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tiff',GDAL_HTTP_TIMEOUT='60',GDAL_HTTP_MAX_RETRY='2'):
  for sheet in ['BP31','BP32','BQ31','BQ32']:
   cache=CACHE/('dem-'+sheet+'.npz')
   if cache.exists(): c=np.load(cache);a,tr=c['a'],rasterio.Affine(*c['t'])
   else:
    url='https://nz-elevation.s3.ap-southeast-2.amazonaws.com/new-zealand/new-zealand-contour/dem_8m/2193/'+sheet+'.tiff'
    with rasterio.open(url) as src:
     l,b,r,t=max(ox+minx-25,src.bounds.left),max(oy-maxz-25,src.bounds.bottom),min(ox+maxx+25,src.bounds.right),min(oy-minz+25,src.bounds.top)
     if l>=r or b>=t:continue
     win=from_bounds(l,b,r,t,src.transform);h=max(1,round((t-b)/step));w=max(1,round((r-l)/step));a=src.read(1,window=win,out_shape=(h,w),resampling=Resampling.bilinear);tr=src.window_transform(win)*src.transform.scale(win.width/w,win.height/h);np.savez_compressed(cache,a=a,t=np.array(tuple(tr)[:6]))
   target=np.full_like(out,-9999);reproject(a,target,src_transform=tr,src_crs=2193,dst_transform=transform,dst_crs=2193,src_nodata=-9999,dst_nodata=-9999,resampling=Resampling.bilinear);valid=target>-1000;out[valid]=target[valid];print('Upper Hutt DEM',sheet,flush=True)
 out[out<-1000]=-3;terrain=np.round(out*100).astype('<i4');off=(m['minZ']-minz)//step;terrain[off:off+terrainOld.shape[0],:terrainOld.shape[1]]=terrainOld;terrain.tofile(D/'regional-terrain.bin');m.update(width=nx,height=nz,minZ=minz,maxX=maxx);m['bounds'].update(minZ=minz+500,maxX=maxx-500);m['sources']+='; Upper Hutt: LINZ national contour DEM (8m source / 25m grid)';save('regional-terrain.json',m)
else:terrain=terrainOld
# Preserve the existing shoreline exactly. All added north/east land is inland.
coast=load('regional-coast.json');b=coast['bounds'];nb={k:m[k] for k in ['minX','minZ','maxX','maxZ']}
if b!=nb:
 scale=7.8125;image=Image.new('L',(round((nb['maxX']-nb['minX'])/scale),round((nb['maxZ']-nb['minZ'])/scale)),255);image.paste(Image.open(D/coast['mask']),(round((b['minX']-nb['minX'])/scale),round((b['minZ']-nb['minZ'])/scale)));image.save(D/'coast-mask-upper.png',optimize=True)
 scale=31.25;fw,fh=round((nb['maxX']-nb['minX'])/scale),round((nb['maxZ']-nb['minZ'])/scale);forest=Image.new('L',(fw,fh));draw=ImageDraw.Draw(forest)
 for ring in coastInput['forest']:draw.polygon([((x-nb['minX'])/scale,(z-nb['minZ'])/scale) for x,z in ring],fill=255)
 oldForest=Image.fromarray(np.fromfile(D/'regional-forest.bin',dtype='uint8').reshape(coast['forest']['height'],coast['forest']['width']));forest.paste(oldForest,(round((b['minX']-nb['minX'])/scale),round((b['minZ']-nb['minZ'])/scale)));(D/'regional-forest.bin').write_bytes(np.array(forest).tobytes());coast.update(bounds=nb,mask='coast-mask-upper.png',forest={'width':fw,'height':fh})
coast['places']=coastInput['places'];save('regional-coast.json',coast)
def ground(x,z):return float(terrain[min(m['height']-1,max(0,round((z-m['minZ'])/25))),min(m['width']-1,max(0,round((x-m['minX'])/25)))])/100
# Official building footprints. Existing survey heights and photo roofs survive.
manifest=load('regional-buildings.json');chunks={c['id']:c for c in manifest['chunks']};existing=set();chunkData={}
for c in manifest['chunks']:
 data=load(c['file']);existing.update(b['id'] for b in data['buildings'])
existing.update(b['id'] for name in ['buildings.json','buildings-outer.json'] for b in load(name))
features=[]
for offset in range(0,100000,2000):
 cache=CACHE/f'footprints-{offset}.json'
 if not cache.exists():
  params={'f':'json','geometry':f'{ox+1800},{oy+10500},{ox+20000},{oy+22500}','geometryType':'esriGeometryEnvelope','inSR':2193,'outSR':2193,'spatialRel':'esriSpatialRelIntersects','outFields':'building_id,name,use_,suburb_locality,town_city','resultRecordCount':2000,'resultOffset':offset,'orderByFields':'OBJECTID'}
  subprocess.run(['curl','-sS','--fail','--retry','2','--max-time','90','https://services.arcgis.com/xdsHIIxuCWByZiCB/arcgis/rest/services/LINZ_NZ_Building_Outlines/FeatureServer/0/query?'+urllib.parse.urlencode(params),'-o',str(cache)],check=True)
 data=json.loads(cache.read_text());assert 'error' not in data,data;features+=data['features'];print('Upper Hutt footprints',len(features),flush=True)
 if not data.get('exceededTransferLimit'):break
far=[];added=0
for feature in features:
 at=feature['attributes'];id=at['building_id']
 if id in existing:continue
 parts=[]
 for ring in sorted(feature.get('geometry',{}).get('rings',[]),key=lambda r:abs(Polygon(r).area),reverse=True):
  p=Polygon([(x-ox,oy-y) for x,y in ring]).buffer(0)
  if p.is_empty or p.geom_type!='Polygon' or p.area<8:continue
  host=next((i for i,q in enumerate(parts) if q.contains(p.representative_point())),None)
  if host is None:parts.append(p)
  else:parts[host]=parts[host].difference(p)
 for p in parts:
  if p.is_empty or p.geom_type!='Polygon':continue
  x,z=p.representative_point().coords[0]
  if not(1800<x<20000 and -22500<z<-10500):continue
  height=3.8 if p.area<450 else 5.5 if p.area<1500 else 7.5;g=ground(x,z);key=f'{math.floor(x/512)},{math.floor(z/512)}'
  if key not in chunkData:chunkData[key]=load(chunks[key]['file']) if key in chunks else {'buildings':[]}
  rings=[list(p.exterior.coords)]+[list(q.coords) for q in p.interiors];building={'id':id,'rings':[[[round(a,2),round(b,2)] for a,b in ring] for ring in rings],'ground':round(g,2),'height':height,'heightSource':'inferred from footprint size; not surveyed','suburb':at.get('suburb_locality') or '', 'name':at.get('name') or ''};chunkData[key]['buildings'].append(building)
  rect=list(p.minimum_rotated_rectangle.exterior.coords);a,c,d=rect[:3];far.extend([sum(q[0] for q in rect[:4])/4,sum(q[1] for q in rect[:4])/4,g-datum,height,math.dist(a,c),math.dist(c,d),-math.atan2(c[1]-a[1],c[0]-a[0]),float(id%8)]);added+=1
for key,data in chunkData.items():
 ix,iz=map(int,key.split(','));c=chunks.get(key) or {'id':key,'file':'region-chunks/upper-'+key.replace(',','_')+'.json','x':(ix+.5)*512,'z':(iz+.5)*512}
 if c.get('roof') and any(not(c['roof']['minX']<=x<=c['roof']['maxX'] and c['roof']['minZ']<=z<=c['roof']['maxZ']) for bld in data['buildings'] for x,z in bld['rings'][0]):c.pop('roof')
 c['count']=len(data['buildings']);save(c['file'],data);chunks[key]=c
with (D/'regional-far.bin').open('ab') as f:f.write(np.array(far,dtype='<f4').tobytes())
manifest['chunks']=list(chunks.values());manifest['count']+=added;manifest['upperHutt']={'addedParts':manifest.get('upperHutt',{}).get('addedParts',0)+added,'heights':'Inferred 3.8–7.5m from footprint area; LINZ outlines with 25m national DEM ground.'};save('regional-buildings.json',manifest)
# Add mapped parks so suburban lawns/sports fields do not become forest.
spaces=load('open-spaces.json');ids={r['id'] for r in spaces['features']}
for id,w in ctx['ways'].items():
 tags=ctx['tags'](w);kind=tags.get('leisure');refs=[n.attrib['ref'] for n in w.findall('nd')];p=[ctx['coords'][n] for n in refs if n in ctx['coords']]
 if kind not in ['park','pitch','playground','recreation_ground','garden'] or len(p)<4 or refs[0]!=refs[-1] or len(p)!=len(refs):continue
 key='upper-way-'+id
 if key not in ids:spaces['features'].append({'id':key,'name':tags.get('name',''),'kind':kind,'rings':[[[q['x'],q['z']] for q in p]]})
save('open-spaces.json',spaces)
for name in ['upper-map.json','upper-waterways.json','upper-coast-input.json']:(D/name).unlink(missing_ok=True)
save('upper-hutt.json',{'bounds':nb,'source':'OpenStreetMap roads, waterways, parks and woodland; LINZ NZ Building Outlines; LINZ national contour DEM. OSM ODbL; LINZ CC BY 4.0.','buildingParts':manifest['upperHutt']['addedParts'],'terrain':'8m contour source sampled to 25m; building heights inferred','places':[p for p in extra['places'] if p['z']<-11000]})
print('Upper Hutt expansion ready:',added,'new building parts;',len(new['elements']),'road ways.',flush=True)
