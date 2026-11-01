"""Stage 3 of the north/east expansion: the railway into Wellington and out to the new districts.
Adds mapped track, platforms and stations from the Wellington and north/east OSM caches: Wellington station and its
approaches, the Johnsonville line, the Kāpiti line through the Tawa tunnels and along the coast to Waikanae, and the
Wairarapa line on to Featherston and beyond. Existing tracks and their surveyed profiles are kept; new ways join them
at shared OSM nodes and take their end heights. Running routes are then rebuilt from Wellington to each terminus.
Run after expand_north_east_map.py with /private/tmp/wainui-gis/bin/python. Reruns replace the tracks this script added."""
import pathlib,json,math,heapq,re,statistics,xml.etree.ElementTree as E
import numpy as np
from pyproj import Transformer
ROOT=pathlib.Path(__file__).resolve().parents[1];D=ROOT/'dist'
FOLDERS=['wainui-regional-osm','wainui-upper-osm','wainui-wellington-osm','wainui-south-osm','wainui-north-east/osm','wainui-remutaka']
paths=[p for f in FOLDERS for p in sorted(pathlib.Path('/private/tmp',f).glob('*.osm'))]
def tags(e):return{x.attrib['k']:x.attrib['v'] for x in e.findall('tag')}
ways={};stationNodes={};wanted=set()
for p in paths:
 for e in E.parse(p).getroot():
  if e.tag=='way':
   t=tags(e)
   if t.get('railway') in ['rail','platform'] or t.get('railway')=='station':
    refs=[n.attrib['ref'] for n in e.findall('nd')];ways[e.attrib['id']]=(t,refs);wanted.update(refs)
  elif e.tag=='node' and e.find('tag') is not None:
   t=tags(e)
   if t.get('railway') in ['station','halt'] and t.get('name') and t.get('usage')!='tourism':stationNodes[e.attrib['id']]=(t,float(e.attrib['lon']),float(e.attrib['lat']))
lonlat={}
for p in paths:
 for e in E.parse(p).getroot():
  if e.tag=='node' and e.attrib['id'] in wanted:lonlat[e.attrib['id']]=(float(e.attrib['lon']),float(e.attrib['lat']))
geo=json.loads((D/'geodata.json').read_text());ox,oy=geo['originNZTM'];project=Transformer.from_crs(4326,2193,always_xy=True)
def xz(lon,lat):e,n=project.transform(lon,lat);return e-ox,oy-n
nodes={k:xz(*v) for k,v in lonlat.items()}
meta=json.loads((D/'regional-terrain.json').read_text());grid=np.fromfile(D/'regional-terrain.bin',dtype='<i4').reshape(meta['height'],meta['width'])/100;bounds=meta['bounds']
def ground(x,z):
 u=min(meta['width']-1.000001,max(0,(x-meta['minX'])/meta['step']));v=min(meta['height']-1.000001,max(0,(z-meta['minZ'])/meta['step']));i,j=int(u),int(v);du,dv=u-i,v-j
 return float(grid[j,i]*(1-du)*(1-dv)+grid[j,i+1]*du*(1-dv)+grid[j+1,i]*(1-du)*dv+grid[j+1,i+1]*du*dv)
def inbounds(x,z):return bounds['minX']<x<bounds['maxX'] and bounds['minZ']<z<bounds['maxZ']
data=json.loads((D/'railways.json').read_text())
mine=set(data.get('northEastTrackIds',[]));data['tracks']=[t for t in data['tracks'] if t['id'] not in mine]
# The first rail import cut ways at the old x=-10000 boundary (Hutt and Kāpiti lines short of Wellington); a way whose
# stored parts do not reach both of its mapped end nodes is rebuilt whole.
reach={}
for t in data['tracks']:reach.setdefault(t['id'].rsplit('-',1)[0],set()).update([t['p'][0]['node'],t['p'][-1]['node']])
clipped={k for k,e in reach.items() if k in ways and not {ways[k][1][0],ways[k][1][-1]}<=e}
data['tracks']=[t for t in data['tracks'] if t['id'].rsplit('-',1)[0] not in clipped]
existing=set(reach)-clipped;print('Rebuilding',len(clipped),'clipped track ways',flush=True)
anchors={p['node']:p['h'] for t in data['tracks'] for p in [t['p'][0],t['p'][-1]]}
# 1. Tracks: whole ways only (a tunnel is never cut at the boundary), sampled every 4m like prepare_railways.
added=[]
for key,(t,refs) in ways.items():
 if t.get('railway')!='rail' or key in existing or any(n not in nodes for n in refs) or len(refs)<2:continue
 pts=[(*nodes[n],n) for n in refs]
 if not all(inbounds(x,z) for x,z,_ in pts):continue
 dense=[];dist=[]
 total=0
 for a,b in zip(pts,pts[1:]):
  length=math.hypot(b[0]-a[0],b[1]-a[1]);steps=max(1,math.ceil(length/4))
  for k in range(steps):
   f=k/steps;x=a[0]+(b[0]-a[0])*f;z=a[1]+(b[1]-a[1])*f;dense.append({'x':round(x,3),'z':round(z,3),'h':round(ground(x,z)+.12,3),'node':a[2] if k==0 else f'{key}-{len(dense)}'});dist.append(total+length*f)
  total+=length
 x,z,n=pts[-1];dense.append({'x':round(x,3),'z':round(z,3),'h':round(ground(x,z)+.12,3),'node':n});dist.append(total)
 bridge,tunnel=t.get('bridge','no')!='no',t.get('tunnel','no')!='no'
 if bridge or tunnel:
  ha=anchors.get(dense[0]['node'],dense[0]['h']);hb=anchors.get(dense[-1]['node'],dense[-1]['h']);lift=max(0,1.8-min(ha,hb)) if bridge else 0
  for p,d in zip(dense,dist):p['h']=round(ha+(hb-ha)*d/max(.01,total)+lift,3)
 added.append({'id':key+'-0','name':t.get('name','Railway'),'tunnelName':t.get('tunnel:name',''),'service':t.get('service',''),'usage':t.get('usage',''),'bridge':bridge,'tunnel':tunnel,'electrified':t.get('electrified','no')!='no','p':dense})
# Smooth the new trackbed only: existing track ends and every bridge/tunnel height stay fixed.
values={};edges={};fixed=dict(anchors)
for t in added:
 for p in t['p']:
  values.setdefault(p['node'],[]).append(p['h'])
  if t['bridge'] or t['tunnel']:fixed[p['node']]=p['h']
 for a,b in zip(t['p'],t['p'][1:]):
  w=1/max(.1,math.hypot(b['x']-a['x'],b['z']-a['z']));edges.setdefault(a['node'],{})[b['node']]=w;edges.setdefault(b['node'],{})[a['node']]=w
heights={k:fixed.get(k,statistics.median(v)) for k,v in values.items()}
for _ in range(180):heights={k:fixed[k] if k in fixed else .3*h+.7*sum(heights[n]*w for n,w in edges[k].items())/sum(edges[k].values()) if k in edges else h for k,h in heights.items()}
for t in added:
 for p in t['p']:p['h']=round(heights[p['node']],3)
data['tracks']+=added;data['northEastTrackIds']=[t['id'] for t in added]
# 2. Platforms and stations in the new areas.
platformIds={str(p['id']) for p in data['platforms']}
for key,(t,refs) in ways.items():
 if t.get('railway')!='platform' or key in platformIds or any(n not in nodes for n in refs):continue
 raw=[nodes[n] for n in refs]
 if not any(inbounds(x,z) for x,z in raw):continue
 width=float(t['width'].split()[0]) if re.match(r'^\d',t.get('width','')) else 3
 data['platforms'].append({'id':key,'name':t.get('name','Platform'),'closed':refs[0]==refs[-1],'p':[[round(x,3),round(z,3)] for x,z in raw],'width':width})
names={s['name'] for s in data['stations']}
candidates=[(t['name'],*xz(lon,lat)) for t,lon,lat in stationNodes.values()]
candidates+=[(t['name'],*np.mean([nodes[n] for n in refs],axis=0)) for t,refs in ways.values() if t.get('railway')=='station' and t.get('name') and all(n in nodes for n in refs)]
for name,x,z in candidates:
 name=re.sub(r'\s+(railway\s+)?station$','',name,flags=re.I);name={'Paekakariki':'Paekākāriki','Paraparaumu Station':'Paraparaumu','Pukerua Bay Station':'Pukerua Bay'}.get(name,name)
 if 'bus' in name.lower() or name in names or not inbounds(x,z):continue
 names.add(name);data['stations'].append({'name':name,'x':round(float(x),3),'z':round(float(z),3),'h':round(ground(x,z),3)})
# 3. Running routes from Wellington over main and branch lines (no yards, sidings or industrial spurs).
graph={};points={}
for t in data['tracks']:
 if t['service'] in ['yard','siding','spur'] or t['usage']=='industrial' or t['name']=='Gracefield Branch':continue
 for a,b in zip(t['p'],t['p'][1:]):
  d=math.hypot(b['x']-a['x'],b['z']-a['z']);points[a['node']]=a;points[b['node']]=b;graph.setdefault(a['node'],[]).append((b['node'],d));graph.setdefault(b['node'],[]).append((a['node'],d))
station={s['name']:s for s in data['stations']}
def nearest(s):return min(points,key=lambda k:(points[k]['x']-s['x'])**2+(points[k]['z']-s['z'])**2)
def route(a,b):
 a,b=nearest(a),nearest(b);queue=[(0,a)];dist={a:0};prev={}
 while queue:
  d,n=heapq.heappop(queue)
  if n==b:break
  if d>dist[n]:continue
  for m,l in graph.get(n,[]):
   if d+l<dist.get(m,math.inf):dist[m]=d+l;prev[m]=n;heapq.heappush(queue,(d+l,m))
 if b not in dist:return[]
 path=[b]
 while path[-1]!=a:path.append(prev[path[-1]])
 return[points[k] for k in reversed(path)]
routes=[]
for name,a,b in [('Hutt Valley commuter','Wellington','Upper Hutt'),('Kāpiti commuter','Wellington','Waikanae'),('Johnsonville commuter','Wellington','Johnsonville'),('Wairarapa Connection','Wellington','Featherston'),('Melling commuter','Wellington','Melling')]:
 if a not in station or b not in station:print('Missing station for',name,flush=True);continue
 path=route(station[a],station[b]);end=station[b]
 if len(path)>20 and math.hypot(path[-1]['x']-end['x'],path[-1]['z']-end['z'])<150:routes.append({'name':name,'p':path});print(name,round(sum(math.hypot(q['x']-p['x'],q['z']-p['z']) for p,q in zip(path,path[1:]))/1000,1),'km',flush=True)
 else:print('No connected track for',name,flush=True)
assert routes and routes[0]['name']=='Hutt Valley commuter','The Hutt Valley route must stay first'
# Grade limit: the 25m DEM puts cuttings and embankments into the trackbed (15% pitches on the Johnsonville line).
# Forward and backward passes along every route clamp new track to 3% (the steepest Wellington lines are about 2.5%);
# the terrain then blends to the trackbed as cut or fill (railways.js ground()). The Remutaka approaches from
# expand_remutaka_rail.py and the line beyond Upper Hutt, first run by a train here, are graded too. Only the surveyed
# Petone–Upper Hutt running line (the original Hutt Valley route) stays fixed.
hutt=routes[0]['p'];petone=min(range(len(hutt)),key=lambda i:math.hypot(hutt[i]['x']-station['Petone']['x'],hutt[i]['z']-station['Petone']['z']));base={q['node'] for q in hutt[petone:]}
GRADE=.03;mutable={p['node'] for t in data['tracks'] for p in t['p']}-base;level={p['node']:p['h'] for t in data['tracks'] for p in t['p']}
for _ in range(4):
 for r in routes:
  for seq in (r['p'],r['p'][::-1]):
   for a,b in zip(seq,seq[1:]):
    if b['node'] in mutable:
     reach=GRADE*math.hypot(b['x']-a['x'],b['z']-a['z']);level[b['node']]=min(level[a['node']]+reach,max(level[a['node']]-reach,level[b['node']]))
for t in data['tracks']:
 for p in t['p']:p['h']=round(level[p['node']],3)
data['routes']=routes
data['northEastSource']='OpenStreetMap map API, 1 November 2026, ODbL; LINZ national 8m DEM. Tunnel grades interpolated between portals; service pattern fictional.'
(D/'railways.json').write_text(json.dumps(data,separators=(',',':')))
print('North/east rail:',len(added),'track ways added,',sum(t['tunnel'] for t in added),'tunnels;',len(data['stations']),'stations;',', '.join(r['name'] for r in routes),flush=True)
