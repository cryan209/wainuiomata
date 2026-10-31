"""Re-match Wellington City building heights against the cached OSM import with lib/osm_heights.py, then repackage
roofs. expand_wellington.py skips buildings it already added, so run this after it; reruns change nothing.
Only heights that came from OSM or the area fallback change; LiDAR-measured and landmark parts are left alone.
A footprint holding OSM building:parts is cut into one building per part (ids footprint*100+n, the remainder keeping the
footprint's id); otherwise it takes the tallest OSM building covering a real share of it. A changed building drops its
inferred roof so packaging picks the roof again for the new height (towers come out flat).
Needs the OSM tiles expand_wellington.py cached in /private/tmp/wainui-wellington-osm. Run with /private/tmp/wainui-gis/bin/python.
"""
import pathlib,json,glob,sys
import xml.etree.ElementTree as ET
from pyproj import Transformer
from shapely.geometry import Polygon
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent))
from lib.osm_heights import tag_height,osm_polygon,HeightIndex,PartIndex
from package_regional_roofs import package
ROOT=pathlib.Path(__file__).resolve().parents[1];D=ROOT/'dist';OSM='/private/tmp/wainui-wellington-osm'
SOURCES={'OSM height / building:levels','inferred from footprint area; not surveyed'}
meta=json.loads((D/'geodata.json').read_text());ox,oy=meta['originNZTM'];project=Transformer.from_crs(4326,2193,always_xy=True)
whole=([],[]);parts=([],[]);seen=set()
for f in sorted(glob.glob(OSM+'/*.osm')):
 root=ET.parse(f).getroot();nodes={n.get('id'):(float(n.get('lon')),float(n.get('lat'))) for n in root.iter('node')}
 for way in root.iter('way'):
  tags={t.get('k'):t.get('v') for t in way.findall('tag')};part='building:part' in tags
  if not(tags.get('building') or part) or way.get('id') in seen or (part and tags.get('min_height','0') not in ('0','0m')) or (part and tags.get('building:min_level','0')!='0'):continue
  refs=[n.get('ref') for n in way.findall('nd') if n.get('ref') in nodes];height=tag_height(tags)
  if not height or len(refs)<4:continue
  xs,ys=project.transform([nodes[r][0] for r in refs],[nodes[r][1] for r in refs]);poly=osm_polygon([(x-ox,oy-y) for x,y in zip(xs,ys)])
  if poly:seen.add(way.get('id'));target=parts if part else whole;target[0].append(poly);target[1].append(height)
assert whole[0],'no cached OSM buildings in '+OSM
index=HeightIndex(*whole);partIndex=PartIndex(*parts)
def ring(coords):return [[round(a,2),round(b,2)] for a,b in coords]
m=json.loads((D/'regional-buildings.json').read_text());chunks={c['id']:json.loads((D/c['file']).read_text()) for c in m['chunks']};changed=[];split=0
for c in m['chunks']:
 if not c['file'].startswith('region-chunks/wellington-'):continue
 out=[]
 for b in chunks[c['id']]['buildings']:
  roof=b.get('roof',{});out.append(b)
  if b.get('landmark') or b.get('split') or roof.get('measured') or b.get('heightSource') not in SOURCES:continue
  footprint=Polygon(b['rings'][0],b['rings'][1:]).buffer(0);total=b['height']+roof.get('rise',0);height=index.match(footprint)
  pieces=partIndex.split(footprint)
  if pieces:
   out.pop();split+=1;n=0
   for poly,h in pieces:
    if h is None:piece={**b,'height':round(height or total,2),'id':b['id'],'split':True}
    else:n+=1;piece={**b,'id':int(b['id'])*100+n,'height':round(h,2),'heightSource':'OSM building:part height','split':True}
    piece['rings']=[ring(poly.exterior.coords)]+[ring(r.coords) for r in poly.interiors];piece.pop('roof',None);out.append(piece)
   changed.append((b.get('name') or b['id'],round(total,1),max(h or 0 for _,h in pieces)));continue
  if not height or abs(height-total)<.5:continue
  changed.append((b.get('name') or b['id'],round(total,1),round(height,1)));b['height']=round(height,2);b['heightSource']='OSM height / building:levels';b.pop('roof',None)
 chunks[c['id']]['buildings']=out;m['count']+=len(out)-c['count'];c['count']=len(out)
print(len(changed),'buildings changed,',split,'split into OSM parts; largest:',sorted(changed,key=lambda q:-abs(q[2]-q[1]))[:12],flush=True)
package(m,chunks,meta['originElevation'])
