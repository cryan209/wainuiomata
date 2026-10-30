"""Extract mapped tracks/stations and a connected fictional commuter running path."""
import pathlib,json,xml.etree.ElementTree as E,math,heapq,re
import numpy as np
from pyproj import Transformer
ROOT=pathlib.Path(__file__).resolve().parents[1];paths=[p for folder in ['wainui-regional-osm','wainui-upper-osm'] for p in pathlib.Path('/private/tmp',folder).glob('*.osm')];ways={};relations={};station_nodes={};wanted=set()
def tags(e):return{x.attrib['k']:x.attrib['v'] for x in e.findall('tag')}
for i,p in enumerate(paths):
 for e in E.parse(p).getroot():
  t=tags(e)
  if e.tag=='way' and (t.get('railway') in ['rail','light_rail','platform','station'] or t.get('public_transport')=='station'):
   refs=[n.attrib['ref'] for n in e.findall('nd')];ways[e.attrib['id']]={'id':e.attrib['id'],'tags':t,'refs':refs};wanted.update(refs)
  elif e.tag=='node' and t.get('railway') in ['station','halt','stop'] and t.get('name'):station_nodes[e.attrib['id']]={'tags':t,'lon':float(e.attrib['lon']),'lat':float(e.attrib['lat'])}
  elif e.tag=='relation' and t.get('name') and (t.get('public_transport') in ['stop_area','station'] or t.get('railway')=='station'):
   members=[dict(m.attrib) for m in e.findall('member')];relations[e.attrib['id']]={'tags':t,'members':members};wanted.update(m['ref'] for m in members if m['type']=='node')
 print('Rail map cache',i+1,'/',len(paths),flush=True) if i%20==0 else None
meta=json.loads((ROOT/'dist/geodata.json').read_text());ox,oy=meta['originNZTM'];project=Transformer.from_crs(4326,2193,always_xy=True);nodes={};node_tags={}
for p in paths:
 for e in E.parse(p).getroot():
  if e.tag=='node' and e.attrib['id'] in wanted:
   x,y=project.transform(float(e.attrib['lon']),float(e.attrib['lat']));nodes[e.attrib['id']]=(x-ox,oy-y);node_tags[e.attrib['id']]=tags(e)
surface=np.load('/private/tmp/wainui-regional-survey/surface.npz')['dem'];terrainMeta=json.loads((ROOT/'dist/regional-terrain.json').read_text());terrain=np.frombuffer((ROOT/'dist/regional-terrain.bin').read_bytes(),dtype='<i4').reshape(terrainMeta['height'],terrainMeta['width'])/100
def ground(x,z):
 u=min(terrain.shape[1]-1.001,max(0,(x-terrainMeta['minX'])/terrainMeta['step']));v=min(terrain.shape[0]-1.001,max(0,(z-terrainMeta['minZ'])/terrainMeta['step']));i,j=int(u),int(v);fx,fz=u-i,v-j
 coarse=float(terrain[j,i]*(1-fx)*(1-fz)+terrain[j,i+1]*fx*(1-fz)+terrain[j+1,i]*(1-fx)*fz+terrain[j+1,i+1]*fx*fz)
 edge=min(x+10500,z+11500,-10500+(surface.shape[1]-1)*4-x,-11500+(surface.shape[0]-1)*4-z)
 if edge<0:return coarse
 u=min(surface.shape[1]-1.001,max(0,(x+10500)/4));v=min(surface.shape[0]-1.001,max(0,(z+11500)/4));i,j=int(u),int(v);fx,fz=u-i,v-j;values=[float(surface[j,i]),float(surface[j,i+1]),float(surface[j+1,i]),float(surface[j+1,i+1])]
 if min(values)<-1000:return coarse
 h=values[0]*(1-fx)*(1-fz)+values[1]*fx*(1-fz)+values[2]*(1-fx)*fz+values[3]*fx*fz
 blend=min(1,edge/200);return coarse*(1-blend)+h*blend
def inbounds(p):return terrainMeta['bounds']['minX']<p[0]<terrainMeta['bounds']['maxX'] and terrainMeta['bounds']['minZ']<p[1]<terrainMeta['bounds']['maxZ']
tracks=[];platforms=[];station_candidates=[]
for id,w in ways.items():
 t=w['tags'];raw=[(nodes[n][0],nodes[n][1],n) for n in w['refs'] if n in nodes]
 if len(raw)<2:continue
 if t.get('railway')=='platform':
  if any(inbounds(p) for p in raw):platforms.append({'id':id,'name':t.get('name','Platform'),'closed':raw[0][2]==raw[-1][2],'p':[[round(x,3),round(z,3)] for x,z,n in raw],'width':float(t.get('width','3').split()[0]) if re.match(r'^\d',t.get('width','3')) else 3})
  continue
 if t.get('railway')=='station' or t.get('public_transport')=='station' and t.get('train')=='yes':
  if t.get('name'):station_candidates.append((t['name'],sum(p[0] for p in raw)/len(raw),sum(p[1] for p in raw)/len(raw)))
  continue
 if t.get('railway') not in ['rail','light_rail']:continue
 parts=[];part=[]
 for p in raw:
  if inbounds(p):part.append(p)
  elif len(part)>1:parts.append(part);part=[]
  else:part=[]
 if len(part)>1:parts.append(part)
 for partindex,part in enumerate(parts):
  dense=[]
  for index,(a,b) in enumerate(zip(part,part[1:])):
   length=math.hypot(b[0]-a[0],b[1]-a[1]);steps=max(1,math.ceil(length/4))
   for k in range(steps):
    f=k/steps;x=a[0]+(b[0]-a[0])*f;z=a[1]+(b[1]-a[1])*f;dense.append({'x':round(x,3),'z':round(z,3),'h':round(ground(x,z)+.12,3),'node':a[2] if k==0 else f'{id}-{index}-{k}'})
  last=part[-1];dense.append({'x':round(last[0],3),'z':round(last[1],3),'h':round(ground(last[0],last[1])+.12,3),'node':last[2]})
  distance=[0]
  for a,b in zip(dense,dense[1:]):distance.append(distance[-1]+math.hypot(b['x']-a['x'],b['z']-a['z']))
  bridge=t.get('bridge','no')!='no';tunnel=t.get('tunnel','no')!='no'
  if bridge or tunnel:
   ha=dense[0]['h'];hb=dense[-1]['h'];raiseby=max(0,1.8-min(ha,hb)) if bridge else 0
   for p,d in zip(dense,distance):p['h']=round(ha+(hb-ha)*d/max(.01,distance[-1])+raiseby,3)
  tracks.append({'id':id+'-'+str(partindex),'name':t.get('name','Railway'),'service':t.get('service',''),'usage':t.get('usage',''),'bridge':bridge,'tunnel':tunnel,'electrified':t.get('electrified','no')!='no','p':dense})
# Share bridge-end elevations and feather the adjoining trackbed into them.
ends={}
for t in tracks:
 if t['bridge']:
  for p in [t['p'][0],t['p'][-1]]:ends[p['node']]=max(ends.get(p['node'],-9999),p['h'])
for t in tracks:
 if t['bridge'] or t['tunnel']:continue
 p=t['p'];raw=[q['h'] for q in p];dist=[0]
 for a,b in zip(p,p[1:]):dist.append(dist[-1]+math.hypot(b['x']-a['x'],b['z']-a['z']))
 for i,q in enumerate(p):
  smoothed=float(np.median(raw[max(0,i-2):min(len(raw),i+3)])) if 1<i<len(p)-2 else raw[i]
  start=(ends.get(p[0]['node'],raw[0])-raw[0])*max(0,1-dist[i]/45)
  end=(ends.get(p[-1]['node'],raw[-1])-raw[-1])*max(0,1-(dist[-1]-dist[i])/45)
  q['h']=round(smoothed+start+end,3)
for id,n in station_nodes.items():
 x,y=project.transform(n['lon'],n['lat']);station_candidates.append((n['tags']['name'],x-ox,oy-y))
for r in relations.values():
 points=[];rail=False
 for m in r['members']:
  if m['type']=='node' and m['ref'] in nodes:
   points.append(nodes[m['ref']]);rail|=node_tags[m['ref']].get('railway') in ['station','halt','stop']
  elif m['type']=='way' and m['ref'] in ways:
   w=ways[m['ref']];rail|=w['tags'].get('railway') in ['platform','station'];points +=[nodes[n] for n in w['refs'] if n in nodes]
 if points and rail:station_candidates.append((r['tags']['name'],sum(p[0] for p in points)/len(points),sum(p[1] for p in points)/len(points)))
stations={}
for name,x,z in station_candidates:
 name=re.sub(r'\s+(railway\s+)?station$','',name,flags=re.I);name=re.sub(r'\s+\d+$','',name);name={'Pomare':'Pōmare','Taita':'Taitā'}.get(name,name)
 if 'Bus' in name or 'bus' in name:continue
 if inbounds((x,z)):stations.setdefault(name,{'name':name,'x':round(x,3),'z':round(z,3),'h':round(ground(x,z),3)})
from rail_profile import smooth_profiles
smooth_profiles(tracks,iterations=180)
# Use only active main/branch tracks for the ambient train, not yards or industrial spurs.
graph={};points={}
for t in tracks:
 if t['service'] in ['yard','siding','spur'] or t['usage']=='industrial' or t['name']=='Gracefield Branch':continue
 for a,b in zip(t['p'],t['p'][1:]):
  d=math.hypot(b['x']-a['x'],b['z']-a['z']);points[a['node']]=a;points[b['node']]=b;graph.setdefault(a['node'],[]).append((b['node'],d));graph.setdefault(b['node'],[]).append((a['node'],d))
def nearest(station):return min(points,key=lambda k:(points[k]['x']-station['x'])**2+(points[k]['z']-station['z'])**2)
def route(start,end):
 a=nearest(start);b=nearest(end);queue=[(0,a)];dist={a:0};previous={}
 while queue:
  d,n=heapq.heappop(queue)
  if n==b:break
  if d>dist[n]:continue
  for nxt,length in graph.get(n,[]):
   nd=d+length
   if nd<dist.get(nxt,float('inf')):dist[nxt]=nd;previous[nxt]=n;heapq.heappush(queue,(nd,nxt))
 if b not in dist:return []
 path=[b]
 while path[-1]!=a:path.append(previous[path[-1]])
 return[points[k] for k in reversed(path)]
routes=[]
start=stations.get('Petone') or stations.get('Ngauranga') or stations.get('Ava');end=stations.get('Upper Hutt') or stations.get('Pōmare') or stations.get('Taitā') or stations.get('Naenae')
if start and end:
 path=route(start,end)
 if len(path)>20:routes.append({'name':'Hutt Valley commuter','p':path})
if stations.get('Western Hutt') and stations.get('Melling'):
 path=route(stations['Western Hutt'],stations['Melling'])
 if len(path)>20 and math.hypot(path[-1]['x']-stations['Melling']['x'],path[-1]['z']-stations['Melling']['z'])<100:routes.append({'name':'Melling commuter','p':path})
output={'gauge':1.067,'gaugeSource':'https://www.kiwirail.co.nz/about-us/glossary/','tracks':tracks,'platforms':platforms,'stations':list(stations.values()),'routes':routes,'source':'© OpenStreetMap contributors, ODbL; rail profiles inferred from smoothed LINZ DEM samples. Track structures, platforms and train service are fictional approximations.'}
(ROOT/'dist/railways.json').write_text(json.dumps(output,separators=(',',':')))
print('Rails ready:',len(tracks),'track ways,',len(platforms),'platforms,',len(stations),'stations;',len(routes),'connected running routes',flush=True);print('Stations:',', '.join(sorted(stations)),flush=True)
