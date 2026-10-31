"""Mapped streets, coastline and land cover for Lower Hutt–Petone–Eastbourne."""
import pathlib,json,subprocess,concurrent.futures,xml.etree.ElementTree as E,time,re
from pyproj import Transformer
from lib.regional_map import save_map
ROOT=pathlib.Path(__file__).resolve().parents[1];CACHE=pathlib.Path('/private/tmp/wainui-regional-osm');CACHE.mkdir(exist_ok=True)
west,south,east,north=174.80,-41.345,175.015,-41.155
jobs=[(i,j,(west+(east-west)*i/6,south+(north-south)*j/6,west+(east-west)*(i+1)/6,south+(north-south)*(j+1)/6)) for i in range(6) for j in range(6)]
def fetch(job):
 i,j,b=job
 def piece(b,key,depth=0):
  p=CACHE/(key+'.osm')
  if p.exists():return[E.parse(p).getroot()]
  temp=p.with_suffix('.part')
  for attempt in range(5):
   r=subprocess.run(['curl','-sS','--compressed','--fail-with-body','--retry','2','--max-time','70','https://www.openstreetmap.org/api/0.6/map?bbox='+','.join(map(str,b)),'-o',str(temp)],capture_output=True)
   reason=temp.read_text(errors='replace') if temp.exists() else ''
   cooldown=re.search(r'try again in (\d+) seconds',reason,re.I)
   if not cooldown:break
   print('Map service cooldown; retaining completed tiles',flush=True);time.sleep(int(cooldown.group(1))+3)
  if r.returncode==0:temp.replace(p);return[E.parse(p).getroot()]
  reason=temp.read_text(errors='replace') if temp.exists() else ''
  if 'too many nodes' not in reason or depth>=3:raise RuntimeError(reason[:200] or r.stderr.decode()[:200])
  temp.unlink(missing_ok=True);l,s,r,n=b;mx=(l+r)/2;my=(s+n)/2;out=[]
  for k,child in enumerate([(l,s,mx,my),(mx,s,r,my),(l,my,mx,n),(mx,my,r,n)]):out+=piece(child,key+'-'+str(k),depth+1)
  return out
 return piece(b,f'{i}-{j}')
nodes={};ways={};relations={}
with concurrent.futures.ThreadPoolExecutor(2) as pool:
 for i,roots in enumerate(pool.map(fetch,jobs)):
  for e in [e for root in roots for e in root]:
   if e.tag=='node':nodes[e.attrib['id']]=e
   elif e.tag=='way':ways[e.attrib['id']]=e
   elif e.tag=='relation':relations[e.attrib['id']]=e
  print('Regional OSM',i+1,'/',len(jobs),flush=True)
ox,oy=json.loads((ROOT/'dist/geodata.json').read_text())['originNZTM'];project=Transformer.from_crs(4326,2193,always_xy=True);coords={}
def tags(e):return{x.attrib['k']:x.attrib['v'] for x in e.findall('tag')}
for id,n in nodes.items():
 x,y=project.transform(float(n.attrib['lon']),float(n.attrib['lat']));coords[id]={'x':round(x-ox,3),'z':round(oy-y,3),'node':id}
roads=[];water=[];coast=[];forest=[];beaches=[];places=[]
for id,w in ways.items():
 t=tags(w);g=[coords[n.attrib['ref']] for n in w.findall('nd') if n.attrib['ref'] in coords]
 if len(g)<2:continue
 if 'highway' in t or t.get('man_made')=='pier':
  if t.get('man_made')=='pier':t={**t,'highway':'footway','bridge':'yes','width':t.get('width','5')}
  roads.append({'id':id,'tags':t,'geometry':g})
 if t.get('waterway') in ['river','stream','canal','riverbank'] or t.get('natural')=='water':
  if t.get('waterway')=='river' and 'Hutt' in t.get('name','') and 'width' not in t:t={**t,'width':'65'}
  water.append({'id':id,'tags':t,'geometry':g})
 if t.get('natural')=='coastline':coast.append([[p['x'],p['z']] for p in g])
 if g[0]['node']==g[-1]['node']:
  if t.get('natural') in ['wood','scrub'] or t.get('landuse')=='forest':forest.append([[p['x'],p['z']] for p in g])
  if t.get('natural')=='beach':beaches.append([[p['x'],p['z']] for p in g])
for id,n in nodes.items():
 t=tags(n)
 if t.get('place') in ['city','town','suburb','village'] and t.get('name'):places.append({'name':t['name'],'x':coords[id]['x'],'z':coords[id]['z']})
bounds={'minX':-10500,'maxX':5500,'minZ':-11500,'maxZ':9000}
# Expansion scripts re-run this file with another output path for a single-file intermediate map.
out=ROOT/'dist/regional-map.json'
if out.name=='regional-map.json':save_map({'bounds':bounds,'elements':roads})
else:out.write_text(json.dumps({'bounds':bounds,'elements':roads},separators=(',',':')))
(ROOT/'dist/regional-waterways.json').write_text(json.dumps(water,separators=(',',':')))
(ROOT/'dist/regional-coast-input.json').write_text(json.dumps({'bounds':bounds,'coastline':coast,'forest':forest,'beaches':beaches,'places':places,'source':'© OpenStreetMap contributors, ODbL'},separators=(',',':')))
print('Regional roads',len(roads),'coastline sections',len(coast),'woodland polygons',len(forest),'beaches',len(beaches),flush=True)
