"""Extend Wellington City from OSM streets/coast and LINZ terrain/building outlines.
Run with /private/tmp/wainui-gis/bin/python. Downloads are cached and reruns deduplicate IDs.
Existing terrain samples and building heights are preserved. New heights use OSM tags
where an overlapping building supplies them, otherwise explicitly labelled estimates.
"""
import pathlib,json,math,subprocess,urllib.parse
import numpy as np,rasterio
from rasterio.enums import Resampling
from rasterio.transform import from_origin,from_bounds as raster_bounds
from rasterio.windows import from_bounds
from rasterio.warp import reproject
from shapely.geometry import Polygon,Point
from PIL import Image
from lib.regional_map import load_map,save_map
from lib.osm_heights import tag_height,osm_polygon,HeightIndex
ROOT=pathlib.Path(__file__).resolve().parents[1];D=ROOT/'dist';CACHE=pathlib.Path('/private/tmp/wainui-wellington');CACHE.mkdir(exist_ok=True)
def load(n):return json.loads((D/n).read_text())
def save(n,d):(D/n).write_text(json.dumps(d,separators=(',',':')))
source=(ROOT/'scripts/prepare_regional_map.py').read_text().replace("'/private/tmp/wainui-regional-osm'","'/private/tmp/wainui-wellington-osm'").replace('174.80,-41.345,175.015,-41.155','174.68,-41.43,174.84,-41.19')
for name in ['map','waterways','coast-input']:source=source.replace('dist/regional-'+name+'.json','dist/wellington-'+name+'.json')
# Existing regional assets already cover the northeast overlap. Reuse completed
# subdivided tiles before making another request for their oversized parent.
source=source.replace("  temp=p.with_suffix('.part')", """  if b[0]>=174.80 and b[1]>=-41.345 and b[2]<=175.015 and b[3]<=-41.155:return []
  if list(CACHE.glob(key+'-*.osm')):
   l,s,r,n=b;mx=(l+r)/2;my=(s+n)/2;out=[]
   for k,child in enumerate([(l,s,mx,my),(mx,s,r,my),(l,my,mx,n),(mx,my,r,n)]):out+=piece(child,key+'-'+str(k),depth+1)
   return out
  temp=p.with_suffix('.part')""")
ctx={'__file__':str(ROOT/'scripts/prepare_regional_map.py')};exec(compile(source,ctx['__file__'],'exec'),ctx)
nb={'minX':-24000,'maxX':20500,'minZ':-23500,'maxZ':19000}
old=load_map();new=load('wellington-map.json');coords={str(p['node']):p for r in old['elements'] for p in r['geometry'] if p.get('node')};coords.update(ctx['coords'])
for main,extra,key in [('regional-map.json','wellington-map.json','elements'),('regional-waterways.json','wellington-waterways.json',None)]:
 data=load_map() if key else load(main);rows={r['id']:r for r in (data[key] if key else data)}
 for r in (load(extra)[key] if key else load(extra)):
  r['geometry']=[coords[n.attrib['ref']] for n in ctx['ways'][r['id']].findall('nd') if n.attrib['ref'] in coords];rows[r['id']]=r
 if key:data[key]=list(rows.values());data['bounds']=nb
 else:data=list(rows.values())
 save_map(data) if key else save(main,data)
coastInput=load('regional-coast-input.json');extra=load('wellington-coast-input.json')
for key in ['coastline','forest','beaches','places']:coastInput[key]=list({json.dumps(p,sort_keys=True):p for p in coastInput[key]+extra[key]}.values())
coastInput['bounds']=nb;save('regional-coast-input.json',coastInput)
m=load('regional-terrain.json');ox,oy=load('geodata.json')['originNZTM'];datum=load('geodata.json')['originElevation'];terrainOld=np.fromfile(D/'regional-terrain.bin',dtype='<i4').reshape(m['height'],m['width']);step=25
if m['minX']>nb['minX']:
 nx=(nb['maxX']-nb['minX'])//step+1;nz=(nb['maxZ']-nb['minZ'])//step+1;out=np.full((nz,nx),-9999,dtype=np.float32);tr=from_origin(ox+nb['minX']-step/2,oy-nb['minZ']+step/2,step,step)
 with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR',CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tiff',GDAL_HTTP_TIMEOUT='60',GDAL_HTTP_MAX_RETRY='2'):
  for sheet in ['BP31','BQ31']:
   cache=CACHE/('dem-'+sheet+'.npz')
   if cache.exists():c=np.load(cache);a,srcTr=c['a'],rasterio.Affine(*c['t'])
   else:
    url='https://nz-elevation.s3.ap-southeast-2.amazonaws.com/new-zealand/new-zealand-contour/dem_8m/2193/'+sheet+'.tiff'
    with rasterio.open(url) as src:
     l,b,r,t=max(ox+nb['minX']-25,src.bounds.left),max(oy-nb['maxZ']-25,src.bounds.bottom),min(ox+m['minX']+25,src.bounds.right),min(oy-nb['minZ']+25,src.bounds.top)
     if l>=r or b>=t:continue
     win=from_bounds(l,b,r,t,src.transform);h=max(1,round((t-b)/step));w=max(1,round((r-l)/step));a=src.read(1,window=win,out_shape=(h,w),resampling=Resampling.bilinear);srcTr=raster_bounds(l,b,r,t,w,h);np.savez_compressed(cache,a=a,t=np.array(tuple(srcTr)[:6]))
   target=np.full_like(out,-9999);reproject(a,target,src_transform=srcTr,src_crs=2193,dst_transform=tr,dst_crs=2193,src_nodata=-9999,dst_nodata=-9999,resampling=Resampling.bilinear);valid=target>-1000;out[valid]=target[valid];print('Wellington terrain',sheet,flush=True)
 out[out<-1000]=-3;terrain=np.round(out*100).astype('<i4');offset=(m['minX']-nb['minX'])//step;terrain[:,offset:offset+terrainOld.shape[1]]=terrainOld;terrain.tofile(D/'regional-terrain.bin');m.update(nb,width=nx,height=nz);m['bounds']={k:v+(500 if k.startswith('min') else -500) for k,v in nb.items()};m['sources']+='; Wellington City: LINZ 8m contour DEM on a 25m grid';save('regional-terrain.json',m)
else:terrain=terrainOld
# Rebuild the western shoreline, preserving the established eastern land and forest masks.
previous=load('regional-coast.json');oldMask=Image.open(D/previous['mask']).copy();oldForest=Image.fromarray(np.fromfile(D/'regional-forest.bin',dtype='u1').reshape(previous['forest']['height'],previous['forest']['width']))
coastSource=(ROOT/'scripts/prepare_regional_coast.py').read_text().replace("coast-mask-south.png","coast-mask-wellington.png")
exec(compile(coastSource,str(ROOT/'scripts/prepare_regional_coast.py'),'exec'),{'__file__':str(ROOT/'scripts/prepare_regional_coast.py')})
coast=load('regional-coast.json');mask=Image.open(D/coast['mask']);offset=round((previous['bounds']['minX']-nb['minX'])/7.8125);mask.paste(oldMask,(offset,0));mask.save(D/coast['mask'],optimize=True)
forest=Image.fromarray(np.fromfile(D/'regional-forest.bin',dtype='u1').reshape(coast['forest']['height'],coast['forest']['width']));forest.paste(oldForest,(round((previous['bounds']['minX']-nb['minX'])/31.25),0));(D/'regional-forest.bin').write_bytes(np.array(forest).tobytes())
def ground(x,z):return float(terrain[min(m['height']-1,max(0,round((z-m['minZ'])/25))),min(m['width']-1,max(0,round((x-m['minX'])/25)))])/100
# Match tagged OSM building heights to official footprints where available (see lib/osm_heights.py).
osmPolys=[];osmHeights=[]
for way in ctx['ways'].values():
 tags=ctx['tags'](way)
 if not tags.get('building'):continue
 height=tag_height(tags);poly=osm_polygon([(p['x'],p['z']) for p in (ctx['coords'][n.attrib['ref']] for n in way.findall('nd') if n.attrib['ref'] in ctx['coords'])])
 if height and poly:osmPolys.append(poly);osmHeights.append(height)
heights=HeightIndex(osmPolys,osmHeights)
manifest=load('regional-buildings.json');chunks={c['id']:c for c in manifest['chunks']};existing={b['id'] for c in manifest['chunks'] for b in load(c['file'])['buildings']};existing.update(b['id'] for name in ['buildings.json','buildings-outer.json'] for b in load(name));chunkData={};features=[]
for offset in range(0,160000,2000):
 cache=CACHE/f'footprints-{offset}.json'
 if not cache.exists():
  params={'f':'json','geometry':f'{ox-23500},{oy-15000},{ox-9000},{oy+11000}','geometryType':'esriGeometryEnvelope','inSR':2193,'outSR':2193,'spatialRel':'esriSpatialRelIntersects','outFields':'building_id,name,use_,suburb_locality,town_city','resultRecordCount':2000,'resultOffset':offset,'orderByFields':'OBJECTID'}
  subprocess.run(['curl','-sS','--fail','--retry','2','--max-time','90','https://services.arcgis.com/xdsHIIxuCWByZiCB/arcgis/rest/services/LINZ_NZ_Building_Outlines/FeatureServer/0/query?'+urllib.parse.urlencode(params),'-o',str(cache)],check=True)
 data=json.loads(cache.read_text());assert 'error' not in data,data;features+=data['features'];print('Wellington footprints',len(features),flush=True)
 if not data.get('exceededTransferLimit'):break
far=[];added=0;tagged=0
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
  if not(-23500<x<-9000 and -11000<z<15000):continue
  matched=heights.match(p)
  height=matched or (3.8 if p.area<450 else 7.5 if p.area<1500 else 12)
  heightSource='OSM height / building:levels' if matched else 'inferred from footprint area; not surveyed';tagged+=bool(matched);g=ground(x,z);key=f'{math.floor(x/512)},{math.floor(z/512)}'
  if key not in chunkData:chunkData[key]=load(chunks[key]['file']) if key in chunks else {'buildings':[]}
  rings=[list(p.exterior.coords)]+[list(q.coords) for q in p.interiors];chunkData[key]['buildings'].append({'id':id,'rings':[[[round(a,2),round(b,2)] for a,b in ring] for ring in rings],'ground':round(g,2),'height':round(height,2),'heightSource':heightSource,'suburb':at.get('suburb_locality') or '', 'name':at.get('name') or ''})
  rect=list(p.minimum_rotated_rectangle.exterior.coords);a,c,d=rect[:3];far.extend([sum(q[0] for q in rect[:4])/4,sum(q[1] for q in rect[:4])/4,g-datum,height,math.dist(a,c),math.dist(c,d),-math.atan2(c[1]-a[1],c[0]-a[0]),float(id%8)]);added+=1
for key,data in chunkData.items():
 ix,iz=map(int,key.split(','));c=chunks.get(key) or {'id':key,'file':'region-chunks/wellington-'+key.replace(',','_')+'.json','x':(ix+.5)*512,'z':(iz+.5)*512};c.pop('roof',None);c['count']=len(data['buildings']);save(c['file'],data);chunks[key]=c
with (D/'regional-far.bin').open('ab') as f:f.write(np.array(far,dtype='<f4').tobytes())
manifest['chunks']=list(chunks.values());manifest['count']+=added;manifest['wellington']={'addedParts':manifest.get('wellington',{}).get('addedParts',0)+added,'heights':'OSM tags where matched; otherwise inferred from footprint area.','taggedHeights':tagged};save('regional-buildings.json',manifest)
spaces=load('open-spaces.json');ids={r['id'] for r in spaces['features']}
for id,way in ctx['ways'].items():
 tags=ctx['tags'](way);kind=tags.get('leisure');refs=[n.attrib['ref'] for n in way.findall('nd')];points=[ctx['coords'][n] for n in refs if n in ctx['coords']];key='wellington-way-'+id
 if key in ids or kind not in ['park','pitch','playground','recreation_ground','garden'] or len(points)<4 or refs[0]!=refs[-1] or len(points)!=len(refs):continue
 spaces['features'].append({'id':key,'name':tags.get('name',''),'kind':kind,'rings':[[[p['x'],p['z']] for p in points]]})
save('open-spaces.json',spaces)
save('wellington.json',{'bounds':nb,'buildingParts':manifest['wellington']['addedParts'],'roadWays':len(new['elements']),'source':'OpenStreetMap roads, shoreline, parks and height tags (ODbL); LINZ building outlines and national 8m DEM (CC BY 4.0). New terrain sampled at 25m; untagged building heights inferred.'})
for name in ['wellington-map.json','wellington-waterways.json','wellington-coast-input.json']:(D/name).unlink(missing_ok=True)
print('Wellington expansion ready:',added,'new building parts;',len(new['elements']),'road ways;',tagged,'tagged heights',flush=True)
