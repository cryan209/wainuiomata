"""Recover control-node tags from the cached OSM extracts used to build the map."""
import json,pathlib,xml.etree.ElementTree as ET,collections
ROOT=pathlib.Path(__file__).resolve().parents[1]
coords={str(p['node']):p for name in ['map','regional-map'] for r in json.load(open(ROOT/'dist'/f'{name}.json'))['elements'] for p in r['geometry'] if p.get('node')}
found={};files=[]
for folder in ['wainui-osm-expanded','wainui-regional-osm','wainui-south-osm','wainui-upper-osm']:
 for file in pathlib.Path('/private/tmp',folder).glob('*.osm'):
  files.append(str(file))
  for node in ET.parse(file).getroot().findall('node'):
   tags={t.attrib['k']:t.attrib['v'] for t in node.findall('tag')};id=node.attrib['id']
   if id in coords and tags.get('highway') in ['traffic_signals','stop','give_way','crossing']:found[id]={'id':id,'x':coords[id]['x'],'z':coords[id]['z'],'tags':tags}
if not found:raise SystemExit('No cached OSM control nodes found; keep the existing packaged asset.')
(ROOT/'dist/traffic-controls.json').write_text(json.dumps({'source':'Cached OpenStreetMap extracts; coordinates match the packaged projected road nodes. ODbL, OpenStreetMap contributors.','nodes':list(found.values())},separators=(',',':')))
print(collections.Counter(p['tags']['highway'] for p in found.values()))
