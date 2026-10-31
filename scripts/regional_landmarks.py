"""Hand-modelled replacements for landmarks the footprint pipeline gets wrong. Applied by package_regional_roofs.package
before roofs are assigned, so every repackage keeps them. Each landmark removes its source footprint(s) and adds
marked parts; reruns find the marked parts already present and leave them alone.
The Beehive: LINZ merges the tower and its podium into one 4916 m² outline, and OSM tags it height=7, so it was built
as a 3.2 m gabled shed. It becomes a flat podium plus the drum on OSM way 26022581's footprint (centre and radius
measured from it), stepping in slightly each floor up to ten storeys, under a stepped roof that narrows to the crown.
Tier ids share hash(id)%16=5 (appearance.js) so every tier gets the white stucco facade; region-stream.js gives landmark
parts windowed facades on every face instead of industrial cladding, and draws roofColour where a part sets one (the
bronze crown).
"""
import math
from shapely.geometry import Polygon,Point
BEEHIVE_IDS=[350256404,350256409,350256450,350256463,350256481,350256492,350256497,350256552,350256570,350256586,350256594,350256599,350256633]
# (radius m, top above ground m): eight floors of drum, then the roof crown.
BEEHIVE_TIERS=[(27.2,9),(26.5,14),(25.8,19),(25.1,24),(24.4,29),(23.7,34),(23,39),(22.3,44),(19,48),(15.5,52),(11.5,55.5),(7,58.5),(3,61)]
def circle(x,z,r,n=40):return [[round(x+r*math.cos(2*math.pi*i/n),2),round(z+r*math.sin(2*math.pi*i/n),2)] for i in range(n+1)]
def frame(rings):
 p=Polygon(rings[0]);rect=list(p.minimum_rotated_rectangle.exterior.coords);a,b,c=rect[:3];l,w=math.dist(a,b),math.dist(b,c)
 if w>l:a,b,c=b,c,rect[3];l,w=w,l
 return [round(sum(q[0] for q in rect[:4])/4,3),round(sum(q[1] for q in rect[:4])/4,3),round((b[0]-a[0])/max(.01,l),6),round((b[1]-a[1])/max(.01,l),6),round(l,3),round(w,3)]
def part(id,rings,ground,height,suburb,box=None):return {'id':id,'rings':rings,'ground':ground,'height':height,'heightSource':'Landmark model: The Beehive (approximate tiered drum)','suburb':suburb,'name':'The Beehive','landmark':'beehive','roof':{'kind':'flat','rise':0,'frame':box or frame(rings)}}
BRONZE='#7d5f45'
def beehive(m,chunks):
 entry=next(c for c in m['chunks'] if c['id']=='-28,2');data=chunks[entry['id']]
 if any(b.get('landmark')=='beehive' for b in data['buildings']):return
 source=next(b for b in data['buildings'] if b['id']==3502564);x,z=-14141.6,1526.03
 podium=Polygon(source['rings'][0]).difference(Point(x,z).buffer(26.9,64))
 parts=[q for q in getattr(podium,'geoms',[podium]) if q.area>8]
 added=[part(int(source['id'])*10+i,[[[round(a,2),round(b,2)] for a,b in ring.coords] for ring in [q.exterior,*q.interiors]],source['ground'],7,source['suburb']) for i,q in enumerate(parts)]
 # A drum's frame is the axis-aligned square of equal area, so the far boxes stack instead of each tier spinning.
 added+=[part(BEEHIVE_IDS[i],[circle(x,z,r)],source['ground'],h,source['suburb'],[x,z,1,0,round(r*1.772,3),round(r*1.772,3)]) for i,(r,h) in enumerate(BEEHIVE_TIERS)]
 for b in added:
  if b['height']>44:b['roofColour']=BRONZE
 data['buildings']=[b for b in data['buildings'] if b['id']!=3502564]+added;entry['count']=len(data['buildings']);m['count']+=len(added)-1
def apply(m,chunks):beehive(m,chunks)
