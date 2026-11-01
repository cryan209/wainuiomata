"""Stage 2 of the north/east expansion: OSM streets, paths, waterways, shoreline and parks, plus LINZ building outlines,
for Porirua, Tawa–Churton Park, Ōhāriu, the Kāpiti Coast to Waikanae and the Wairarapa (Featherston, Greytown,
Martinborough). Run after expand_north_east.py with /private/tmp/wainui-gis/bin/python, then package_regional_roofs.py.
OSM map API tiles are cached in /private/tmp/wainui-north-east/osm; tiles wholly inside an earlier import are skipped.
Reruns deduplicate by OSM way and LINZ building ID. Untagged building heights are inferred from footprint area."""
import pathlib,json,math,re,time,subprocess,urllib.parse,concurrent.futures,xml.etree.ElementTree as E
import numpy as np
from shapely.geometry import Polygon
from pyproj import Transformer
from lib.regional_map import load_map,save_map
from lib.osm_heights import tag_height,osm_polygon,HeightIndex
ROOT=pathlib.Path(__file__).resolve().parents[1];D=ROOT/'dist';CACHE=pathlib.Path('/private/tmp/wainui-north-east');OSM=CACHE/'osm';OSM.mkdir(parents=True,exist_ok=True)
def load(n):return json.loads((D/n).read_text())
def save(n,d):(D/n).write_text(json.dumps(d,separators=(',',':')))
# Earlier imports (prepare_regional_map, expand_wellington, expand_south, expand_upper_hutt) already hold complete data here.
DONE=[(174.80,-41.345,175.015,-41.155),(174.68,-41.43,174.84,-41.19),(174.84,-41.445,175.065,-41.30),(174.94,-41.19,175.16,-41.065)]
AREAS=[(174.64,-41.22,175.52,-40.85,.055,.05),(175.015,-41.45,175.52,-41.22,.063,.05)]
jobs=[]
for k,(w,s,e,n,dx,dy) in enumerate(AREAS):
 for i in range(round((e-w)/dx)):
  for j in range(round((n-s)/dy)):
   b=(round(w+dx*i,4),round(s+dy*j,4),round(min(e,w+dx*(i+1)),4),round(min(n,s+dy*(j+1)),4))
   if not any(b[0]>=l and b[1]>=bo and b[2]<=r and b[3]<=t for l,bo,r,t in DONE):jobs.append((f'{k}-{i}-{j}',b))
def piece(b,key,depth=0):
 p=OSM/(key+'.osm')
 if p.exists():return[E.parse(p).getroot()]
 if list(OSM.glob(key+'-*.osm')):reason='too many nodes'
 else:
  temp=p.with_suffix('.part')
  for attempt in range(6):
   r=subprocess.run(['curl','-sS','--compressed','--fail-with-body','--retry','2','--max-time','90','-A','wainuiomata-region-build/1.0','https://www.openstreetmap.org/api/0.6/map?bbox='+','.join(map(str,b)),'-o',str(temp)],capture_output=True)
   reason=temp.read_text(errors='replace') if temp.exists() else r.stderr.decode()
   if r.returncode==0:temp.replace(p);return[E.parse(p).getroot()]
   wait=re.search(r'try again in (\d+) seconds',reason,re.I)
   if wait:print('Map service cooldown',wait.group(1),'s',flush=True);time.sleep(int(wait.group(1))+3)
   elif 'too many nodes' in reason.lower() or attempt>=2:break
   else:time.sleep(10)
  temp.unlink(missing_ok=True)
 if 'too many nodes' not in reason.lower() or depth>=4:raise RuntimeError(key+': '+reason[:200])
 l,s,r,n=b;mx=(l+r)/2;my=(s+n)/2
 return[root for k,c in enumerate([(l,s,mx,my),(mx,s,r,my),(l,my,mx,n),(mx,my,r,n)]) for root in piece(c,key+'-'+str(k),depth+1)]
nodes={};ways={}
with concurrent.futures.ThreadPoolExecutor(2) as pool:
 for i,roots in enumerate(pool.map(lambda job:piece(job[1],job[0]),jobs)):
  for e in (e for root in roots for e in root):
   if e.tag=='node':nodes[e.attrib['id']]=e
   elif e.tag=='way':ways[e.attrib['id']]=e
  if i%10==9 or i==len(jobs)-1:print('North/east OSM',i+1,'/',len(jobs),'tiles,',len(ways),'ways',flush=True)
geo=load('geodata.json');ox,oy=geo['originNZTM'];datum=geo['originElevation'];project=Transformer.from_crs(4326,2193,always_xy=True)
ids=list(nodes);xs,ys=project.transform([float(nodes[i].attrib['lon']) for i in ids],[float(nodes[i].attrib['lat']) for i in ids])
coords={i:{'x':round(x-ox,3),'z':round(oy-y,3),'node':i} for i,x,y in zip(ids,xs,ys)}
def tags(e):return{x.attrib['k']:x.attrib['v'] for x in e.findall('tag')}
def geom(w):return[coords[n.attrib['ref']] for n in w.findall('nd') if n.attrib['ref'] in coords]
# 1. Streets, paths, waterways and land-cover inputs, merged by way ID (a way crossing into an earlier import is refreshed whole).
regional=load_map();roads={str(r['id']):r for r in regional['elements']};water={str(r['id']):r for r in load('regional-waterways.json')}
coast=load('regional-coast-input.json');extra={'coastline':[],'forest':[],'beaches':[],'places':[]};before=len(roads),len(water)
for id,w in ways.items():
 t=tags(w);g=geom(w)
 if len(g)<2:continue
 if 'highway' in t or t.get('man_made')=='pier':
  if t.get('man_made')=='pier':t={**t,'highway':'footway','bridge':'yes','width':t.get('width','5')}
  roads[id]={'id':id,'tags':t,'geometry':g}
 if t.get('waterway') in ['river','stream','canal','riverbank'] or t.get('natural')=='water':
  if t.get('waterway')=='river' and re.search('Ruamāhanga|Ruamahanga|Waikanae|Ōtaki',t.get('name','')) and 'width' not in t:t={**t,'width':'35'}
  water[id]={'id':id,'tags':t,'geometry':g}
 if t.get('natural')=='coastline':extra['coastline'].append([[p['x'],p['z']] for p in g])
 if g[0]['node']==g[-1]['node']:
  if t.get('natural') in ['wood','scrub'] or t.get('landuse')=='forest':extra['forest'].append([[p['x'],p['z']] for p in g])
  if t.get('natural')=='beach':extra['beaches'].append([[p['x'],p['z']] for p in g])
for id,n in nodes.items():
 t=tags(n)
 if t.get('place') in ['city','town','suburb','village'] and t.get('name'):extra['places'].append({'name':t['name'],'x':coords[id]['x'],'z':coords[id]['z']})
for key in extra:coast[key]=list({json.dumps(p,sort_keys=True):p for p in coast[key]+extra[key]}.values())
regional['elements']=list(roads.values());save_map(regional);save('regional-waterways.json',list(water.values()));save('regional-coast-input.json',coast)
print('Roads',before[0],'→',len(roads),'; waterways',before[1],'→',len(water),flush=True)
# 2. LINZ building outlines. Heights come from overlapping tagged OSM buildings, else are inferred from footprint area.
m=load('regional-terrain.json');terrain=np.fromfile(D/'regional-terrain.bin',dtype='<i4').reshape(m['height'],m['width'])
def ground(x,z):return float(terrain[min(m['height']-1,max(0,round((z-m['minZ'])/25))),min(m['width']-1,max(0,round((x-m['minX'])/25)))])/100
osmPolys=[];osmHeights=[]
for w in ways.values():
 t=tags(w)
 if not t.get('building'):continue
 h=tag_height(t);poly=osm_polygon([(p['x'],p['z']) for p in geom(w)])
 if h and poly:osmPolys.append(poly);osmHeights.append(h)
heights=HeightIndex(osmPolys,osmHeights)
manifest=load('regional-buildings.json');chunks={c['id']:c for c in manifest['chunks']}
existing={b['id'] for c in manifest['chunks'] for b in load(c['file'])['buildings']};existing.update(b['id'] for name in ['buildings.json','buildings-outer.json'] for b in load(name))
# North strip (the Tawa gap below Wellington's z>-11000 clip, Porirua, Kāpiti) and the Wairarapa east of the Remutaka summit.
ENVELOPES=[('north',-24000,-44000,46000,-11000),('east',20000,-11000,46000,19000)]
features=[]
for name,x0,z0,x1,z1 in ENVELOPES:
 for offset in range(0,400000,2000):
  cache=CACHE/f'footprints-{name}-{offset}.json'
  if not cache.exists():
   params={'f':'json','geometry':f'{ox+x0},{oy-z1},{ox+x1},{oy-z0}','geometryType':'esriGeometryEnvelope','inSR':2193,'outSR':2193,'spatialRel':'esriSpatialRelIntersects','outFields':'building_id,name,use_,suburb_locality,town_city','resultRecordCount':2000,'resultOffset':offset,'orderByFields':'OBJECTID'}
   subprocess.run(['curl','-sS','--fail','--retry','3','--max-time','120','https://services.arcgis.com/xdsHIIxuCWByZiCB/arcgis/rest/services/LINZ_NZ_Building_Outlines/FeatureServer/0/query?'+urllib.parse.urlencode(params),'-o',str(cache)],check=True)
  data=json.loads(cache.read_text());assert 'error' not in data,data;features+=data['features']
  if offset%20000==0:print('Footprints',name,len(features),flush=True)
  if not data.get('exceededTransferLimit'):break
inGrid=lambda x,z:m['minX']+300<x<m['maxX']-300 and m['minZ']+300<z<m['maxZ']-300
chunkData={};added=tagged=0;seen=set()
for feature in features:
 at=feature['attributes'];id=at['building_id']
 if id in existing or id in seen:continue
 seen.add(id);parts=[]
 for ring in sorted(feature.get('geometry',{}).get('rings',[]),key=lambda r:abs(Polygon(r).area),reverse=True):
  p=Polygon([(x-ox,oy-y) for x,y in ring]).buffer(0)
  if p.is_empty or p.geom_type!='Polygon' or p.area<8:continue
  host=next((i for i,q in enumerate(parts) if q.contains(p.representative_point())),None)
  if host is None:parts.append(p)
  else:parts[host]=parts[host].difference(p)
 for p in parts:
  if p.is_empty or p.geom_type!='Polygon':continue
  x,z=p.representative_point().coords[0];g=ground(x,z)
  if not inGrid(x,z) or g<=-2.9:continue
  matched=heights.match(p);height=matched or (3.8 if p.area<450 else 7.5 if p.area<1500 else 12);tagged+=bool(matched)
  key=f'{math.floor(x/512)},{math.floor(z/512)}'
  if key not in chunkData:chunkData[key]=load(chunks[key]['file']) if key in chunks else {'buildings':[]}
  rings=[list(p.exterior.coords)]+[list(q.coords) for q in p.interiors]
  chunkData[key]['buildings'].append({'id':id,'rings':[[[round(a,2),round(b,2)] for a,b in r] for r in rings],'ground':round(g,2),'height':round(height,2),'heightSource':'OSM height / building:levels' if matched else 'inferred from footprint area; not surveyed','suburb':at.get('suburb_locality') or '','name':at.get('name') or ''})
  added+=1
for key,data in chunkData.items():
 ix,iz=map(int,key.split(','));c=chunks.get(key) or {'id':key,'file':'region-chunks/ne-'+key.replace(',','_')+'.json','x':(ix+.5)*512,'z':(iz+.5)*512};c.pop('roof',None);c['count']=len(data['buildings']);save(c['file'],data);chunks[key]=c
manifest['chunks']=list(chunks.values());manifest['count']=sum(c['count'] for c in manifest['chunks'])
prev=manifest.get('northEast',{});manifest['northEast']={'addedParts':prev.get('addedParts',0)+added,'taggedHeights':prev.get('taggedHeights',0)+tagged,'heights':'OSM tags where matched; otherwise inferred from footprint area.'}
save('regional-buildings.json',manifest)
# 3. Parks and sports grounds join the open-space set (furnished by parks.js, kept clear of trees).
spaces=load('open-spaces.json');have={r['id'] for r in spaces['features']};parks=0
for id,w in ways.items():
 t=tags(w);kind=t.get('leisure');refs=[n.attrib['ref'] for n in w.findall('nd')];pts=geom(w);key='ne-way-'+id
 if key in have or kind not in ['park','pitch','playground','recreation_ground','garden'] or len(pts)<4 or refs[0]!=refs[-1] or len(pts)!=len(refs):continue
 spaces['features'].append({'id':key,'name':t.get('name',''),'kind':kind,'rings':[[[p['x'],p['z']] for p in pts]]});parks+=1
save('open-spaces.json',spaces)
save('north-east.json',{'bounds':{k:m[k] for k in ['minX','maxX','minZ','maxZ']},'buildingParts':manifest['northEast']['addedParts'],'roadWays':len(roads)-before[0],'osmTiles':len(jobs),'source':'OpenStreetMap streets, paths, waterways, shoreline, parks and height tags (ODbL); LINZ building outlines and national 8m contour DEM (CC BY 4.0). Untagged building heights inferred from footprint area.'})
print('North/east map ready:',added,'building parts (',tagged,'tagged heights ),',len(roads)-before[0],'new road ways,',parks,'parks',flush=True)
