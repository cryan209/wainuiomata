"""Fetch a larger street/hydrology map in small OSM API bounding boxes."""
import pathlib,subprocess,concurrent.futures,xml.etree.ElementTree as ET,json
from pyproj import Transformer
ROOT=pathlib.Path(__file__).resolve().parents[1];CACHE=pathlib.Path('/private/tmp/wainui-osm-expanded');CACHE.mkdir(exist_ok=True)
lon0,lat0,lon1,lat1=174.906,-41.292,174.984,-41.231
jobs=[]
for i in range(4):
 for j in range(4):
  b=(lon0+(lon1-lon0)*i/4,lat0+(lat1-lat0)*j/4,lon0+(lon1-lon0)*(i+1)/4,lat0+(lat1-lat0)*(j+1)/4);jobs.append((i,j,b))
def fetch(job):
 i,j,b=job;p=CACHE/f'{i}-{j}.osm'
 if not p.exists():subprocess.run(['curl','-sS','-L','--fail','--retry','2','--max-time','45','https://www.openstreetmap.org/api/0.6/map?bbox='+','.join(map(str,b)),'-o',str(p)],check=True)
 return ET.parse(p).getroot()
nodes={};ways={};rels={}
for i,root in enumerate(concurrent.futures.ThreadPoolExecutor(3).map(fetch,jobs)):
 for el in root:
  if el.tag=='node':nodes[el.attrib['id']]=el
  if el.tag=='way':ways[el.attrib['id']]=el
  if el.tag=='relation':rels[el.attrib['id']]=el
 print('Map tiles',i+1,'/',len(jobs),flush=True)
t=Transformer.from_crs(4326,2193,always_xy=True);ox,oy=json.load(open(ROOT/'dist/geodata.json'))['originNZTM']
coords={}
for id,n in nodes.items():
 x,y=t.transform(float(n.attrib['lon']),float(n.attrib['lat']));coords[id]={'x':round(x-ox,3),'z':round(oy-y,3),'node':id}
elements=[];water=[]
for id,w in ways.items():
 tags={el.attrib['k']:el.attrib['v'] for el in w.findall('tag')};g=[coords[n.attrib['ref']] for n in w.findall('nd') if n.attrib['ref'] in coords]
 if len(g)<2:continue
 if 'highway' in tags:elements.append({'id':id,'tags':tags,'geometry':g})
 if tags.get('waterway') in ['river','stream','canal','riverbank'] or tags.get('natural')=='water':water.append({'id':id,'tags':tags,'geometry':g})
(ROOT/'dist/map.json').write_text(json.dumps({'elements':elements},separators=(',',':')));(ROOT/'dist/waterways.json').write_text(json.dumps(water,separators=(',',':')))
print('Road ways',len(elements),'water ways',len(water),'bridge ways',sum(x['tags'].get('bridge','no')!='no' for x in elements),flush=True)
