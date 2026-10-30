"""Recover mapped woodland multipolygons omitted by the original way-only importer."""
import pathlib,json,subprocess,xml.etree.ElementTree as E
from pyproj import Transformer
from shapely.geometry import LineString,box
from shapely.ops import unary_union,polygonize
ROOT=pathlib.Path(__file__).resolve().parents[1];DIST=ROOT/'dist';nodes={};ways={};relations={}
full=pathlib.Path('/private/tmp/wainui-south/remutaka-wood.osm');full.parent.mkdir(exist_ok=True)
if not full.exists():subprocess.run(['curl','--fail','--silent','--show-error','--max-time','90','https://www.openstreetmap.org/api/0.6/relation/13266223/full','-o',str(full)],check=True)
paths=[*pathlib.Path('/private/tmp/wainui-regional-osm').glob('*.osm'),*pathlib.Path('/private/tmp/wainui-south-osm').glob('*.osm'),pathlib.Path('/private/tmp/wainui-south/remutaka-wood.osm')]
for path in paths:
 if not path.exists():continue
 for e in E.parse(path).getroot():
  if e.tag=='node':nodes[e.attrib['id']]=(float(e.attrib['lon']),float(e.attrib['lat']))
  elif e.tag=='way':ways[e.attrib['id']]=[n.attrib['ref'] for n in e.findall('nd')]
  elif e.tag=='relation':
   tags={t.attrib['k']:t.attrib['v'] for t in e.findall('tag')}
   if tags.get('natural')=='wood' or tags.get('landuse')=='forest':relations[e.attrib['id']]=[(m.attrib['ref'],m.attrib.get('role')) for m in e.findall('member') if m.attrib['type']=='way']
project=Transformer.from_crs(4326,2193,always_xy=True);ox,oy=json.loads((DIST/'geodata.json').read_text())['originNZTM'];meta=json.loads((DIST/'regional-terrain.json').read_text());bounds=box(meta['minX'],meta['minZ'],meta['maxX'],meta['maxZ']);areas=[]
for members in relations.values():
 lines={role:[] for role in ['outer','inner']}
 for ref,role in members:
  ids=ways.get(ref,[])
  if len(ids)<2 or any(n not in nodes for n in ids):continue
  coords=[]
  for n in ids:
   x,y=project.transform(*nodes[n]);coords.append((x-ox,oy-y))
  lines['inner' if role=='inner' else 'outer'].append(LineString(coords))
 if not lines['outer']:continue
 outer=unary_union(list(polygonize(unary_union(lines['outer']))));inner=unary_union(list(polygonize(unary_union(lines['inner'])))) if lines['inner'] else None
 if inner is not None:outer=outer.difference(inner)
 clipped=outer.intersection(bounds)
 polygons=[clipped] if clipped.geom_type=='Polygon' else [p for p in getattr(clipped,'geoms',[]) if p.geom_type=='Polygon']
 for p in polygons:
  if p.area>50:areas.append([[[round(x,2),round(z,2)] for x,z in ring.coords] for ring in [p.exterior,*p.interiors]])
data=json.loads((DIST/'regional-coast-input.json').read_text());data['forestAreas']=areas;(DIST/'regional-coast-input.json').write_text(json.dumps(data,separators=(',',':')));print('Mapped woodland multipolygons:',len(areas))
