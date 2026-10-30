"""Package a fictional local job using six real mapped Wainuiomata bus stops."""
import pathlib,json,xml.etree.ElementTree as ET
from pyproj import Transformer
root=pathlib.Path(__file__).resolve().parents[1];meta=json.load(open(root/'dist/geodata.json'));ox,oy=meta['originNZTM'];project=Transformer.from_crs(4326,2193,always_xy=True)
wanted=['1007016898','1010243481','1010239962','1010240142','1010243229','1010244286','1010244036'];found={}
for file in pathlib.Path('/private/tmp/wainui-osm-expanded').glob('*.osm'):
 for n in ET.parse(file).getroot().findall('node'):
  if n.attrib['id'] not in wanted:continue
  tags={v.attrib['k']:v.attrib['v'] for v in n.findall('tag')};x,y=project.transform(float(n.attrib['lon']),float(n.attrib['lat']));found[n.attrib['id']]={'id':n.attrib['id'],'name':tags['name'],'road':'Fitzherbert Road' if n.attrib['id']==wanted[0] else 'Main Road','x':round(x-ox,3),'z':round(oy-y,3)}
assert len(found)==len(wanted),'Missing cached bus stops'
(root/'dist/bus-route.json').write_text(json.dumps({'id':'W01','name':'Wainui Village local','description':'Fictional gameplay service and timetable using mapped bus-stop locations.','source':'© OpenStreetMap contributors, ODbL','stops':[dict(found[id],waiting=0 if i==len(wanted)-1 else 3+i%3) for i,id in enumerate(wanted)]},separators=(',',':')))
