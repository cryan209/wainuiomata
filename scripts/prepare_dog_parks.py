"""Package mapped dog exercise areas plus the traced Les Dalton Dog Park enclosures."""
import json,pathlib,xml.etree.ElementTree as E
from pyproj import Transformer
ROOT=pathlib.Path(__file__).resolve().parents[1]
def area(r):return abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(r,r[1:])))/2
ox,oy=json.loads((ROOT/'dist/geodata.json').read_text())['originNZTM'];project=Transformer.from_crs(4326,2193,always_xy=True)
# Les Dalton Dog Park (Waiu Street, beside Wainuiomata Hill Road) is not mapped in OSM.
# Outlines are traced from fence lines in the Hutt City Aerials_2025 export of
# NZTM bbox (ox-1560, oy+1000)–(ox-1360, oy+1300) at 0.25 m/pixel; pixel (px,py) → (x,z)=(-1560+px/4,-1300+py/4).
LES_DALTON=[
 ('les-dalton-main','Les Dalton Dog Park',[(185,640),(260,612),(380,605),(440,560),(490,440),(525,420),(550,480),(580,620),(600,780),(625,920),(660,1040),(675,1085),(630,1070),(540,1010),(430,930),(300,850),(220,770),(180,690)],(405,600)),
 ('les-dalton-small','Les Dalton Dog Park · Small dogs',[(430,335),(395,420),(380,500),(385,585),(300,596),(210,598),(172,612),(260,520),(350,410)],(380,590)),
]
nodes={};seen=set();features=[]
for d in ['wainui-osm-expanded','wainui-regional-osm','wainui-wellington-osm','wainui-south-osm','wainui-upper-osm']:
 for p in sorted(pathlib.Path('/private/tmp/'+d).glob('*.osm')):
  root=E.parse(p).getroot()
  for n in root.iter('node'):
   if 'lon' in n.attrib:nodes[n.attrib['id']]=(float(n.attrib['lon']),float(n.attrib['lat']))
  for e in root.findall('way'):
   t={x.attrib['k']:x.attrib['v'] for x in e.findall('tag')}
   if t.get('leisure')!='dog_park' or e.attrib['id'] in seen:continue
   refs=[n.attrib['ref'] for n in e.findall('nd')]
   if len(refs)<4 or refs[0]!=refs[-1] or any(r not in nodes for r in refs):continue
   seen.add(e.attrib['id']);ring=[]
   for r in refs:
    x,y=project.transform(*nodes[r]);ring.append((round(x-ox,2),round(oy-y,2)))
   if area(ring)<60:continue
   features.append({'id':'way-'+e.attrib['id'],'name':t.get('name','Dog exercise area'),'kind':'dog_park','source':'https://www.openstreetmap.org/way/'+e.attrib['id'],'rings':[ring]})
for id,name,pixels,gate in LES_DALTON:
 ring=[(-1560+px/4,-1300+py/4) for px,py in pixels];ring.append(ring[0])
 features.append({'id':id,'name':name,'kind':'dog_park','traced':True,'gate':[-1560+gate[0]/4,-1300+gate[1]/4],'source':'https://huttcitylibraries.co.nz/2021/08/12/the-new-les-dalton-dog-park-wainuiomata-dog-clubs/','rings':[ring]})
(ROOT/'dist/dog-parks.json').write_text(json.dumps({'source':'© OpenStreetMap contributors, ODbL (leisure=dog_park); Les Dalton Dog Park traced from Hutt City Aerials_2025 (© NZ Aerial Surveys and Hutt City Council, CC BY 4.0)','features':features},separators=(',',':')))
print('Dog parks:',len(features));print(', '.join(f['name'] for f in features))
