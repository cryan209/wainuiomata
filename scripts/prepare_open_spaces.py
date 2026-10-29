"""Extract open lawns, sports fields and playgrounds from the retained OSM map."""
import json,pathlib,xml.etree.ElementTree as E
from pyproj import Transformer
from shapely.geometry import Polygon,LineString,mapping
from shapely.ops import unary_union,polygonize
ROOT=pathlib.Path(__file__).resolve().parents[1];nodes={};ways={};rels={}
for p in [*pathlib.Path('/private/tmp/wainui-osm-expanded').glob('*.osm'),*pathlib.Path('/private/tmp/wainui-regional-osm').glob('*.osm')]:
 for e in E.parse(p).getroot():
  if e.tag=='node':nodes[e.attrib['id']]=(float(e.attrib['lon']),float(e.attrib['lat']))
  elif e.tag=='way':ways[e.attrib['id']]=e
  elif e.tag=='relation':rels[e.attrib['id']]=e
ox,oy=json.loads((ROOT/'dist/geodata.json').read_text())['originNZTM'];project=Transformer.from_crs(4326,2193,always_xy=True)
coords={}
for key,p in nodes.items():
 x,y=project.transform(*p);coords[key]=(x-ox,oy-y)
def tags(e):return{x.attrib['k']:x.attrib['v'] for x in e.findall('tag')}
def line(w):return[coords[n.attrib['ref']] for n in w.findall('nd') if n.attrib['ref'] in coords]
def geometry(e):
 if e.tag=='way':
  p=line(e)
  return Polygon(p).buffer(0) if len(p)>3 and p[0]==p[-1] else None
 groups={'outer':[],'inner':[]}
 for m in e.findall('member'):
  if m.attrib['type']!='way' or m.attrib['ref'] not in ways:continue
  p=line(ways[m.attrib['ref']])
  if len(p)>1:groups['inner' if m.attrib.get('role')=='inner' else 'outer'].append(LineString(p))
 if not groups['outer']:return None
 outer=unary_union(list(polygonize(unary_union(groups['outer']))));inner=unary_union(list(polygonize(unary_union(groups['inner']))))
 return outer.difference(inner).buffer(0)
woods=[];candidates=[]
for e in list(ways.values())+list(rels.values()):
 t=tags(e);kind=t.get('leisure') or t.get('landuse');wood=t.get('natural') in ['wood','scrub'] or t.get('landuse')=='forest'
 if not wood and kind not in ['park','pitch','playground','grass','recreation_ground','village_green']:continue
 g=geometry(e)
 if g is None or g.is_empty:continue
 if g.bounds[2]<-10500 or g.bounds[0]>5500 or g.bounds[3]<-11500 or g.bounds[1]>9000:continue
 if wood:woods.append(g)
 else:candidates.append((e,t,kind,g))
woodland=unary_union(woods);features=[]
for e,t,kind,g in candidates:
 # Retain wooded reserves; keep park edge trees while opening the lawn interior.
 if kind=='park':
  if g.area>500000:continue
  g=g.buffer(-8).difference(woodland)
 else:g=g.buffer(4 if kind=='pitch' else 1.5)
 if g.is_empty:continue
 polygons=[g] if g.geom_type=='Polygon' else list(g.geoms)
 for i,p in enumerate(polygons):
  if p.geom_type!='Polygon' or p.area<4:continue
  rings=[list(p.exterior.coords)]+[list(r.coords) for r in p.interiors]
  features.append({'id':e.tag+'-'+e.attrib['id']+'-'+str(i),'name':t.get('name',''),'kind':kind,'rings':[[[round(x,2),round(z,2)] for x,z in r] for r in rings]})
(ROOT/'dist/open-spaces.json').write_text(json.dumps({'source':'© OpenStreetMap contributors, ODbL; open-space interiors inferred from mapped boundaries, with woodland exclusions','features':features},separators=(',',':')))
print('Open-space clearings:',len(features));print('Named parks:',', '.join(sorted(set(f['name'] for f in features if f['kind']=='park' and f['name']))))
