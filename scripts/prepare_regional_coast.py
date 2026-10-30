"""Polygonise mapped shoreline, retaining harbour islands and open beaches."""
import pathlib,json,math
import numpy as np
from PIL import Image,ImageDraw
from shapely.geometry import box,LineString,Point
from shapely.ops import unary_union,polygonize
ROOT=pathlib.Path(__file__).resolve().parents[1];data=json.loads((ROOT/'dist/regional-coast-input.json').read_text());m=json.loads((ROOT/'dist/regional-terrain.json').read_text());bounds=box(m['minX'],m['minZ'],m['maxX'],m['maxZ']);lines=[];segments=[]
for points in data['coastline']:
 line=LineString(points).intersection(bounds)
 if not line.is_empty:lines.append(line)
 for a,b in zip(points,points[1:]):
  dx=b[0]-a[0];dz=b[1]-a[1];length=math.hypot(dx,dz)
  if length>.01:segments.append((a,dx,dz,length))
def land_side(point):
 best=None
 for a,dx,dz,length in segments:
  t=max(0,min(1,((point.x-a[0])*dx+(point.y-a[1])*dz)/(length*length)));px=a[0]+dx*t;pz=a[1]+dz*t;distance=(point.x-px)**2+(point.y-pz)**2
  # OSM coastline land is on the left in geographic XY, hence right in X/Z.
  if best is None or distance<best[0]:best=(distance,(point.x-px)*dz-(point.y-pz)*dx)
 return best[1]>=0
polygons=list(polygonize(unary_union([bounds.boundary,*lines])));land=[];water=[]
for p in polygons:(land if land_side(p.representative_point()) else water).append(p)
land=unary_union(land);water=unary_union(water)
def polygons_of(g):return[g] if g.geom_type=='Polygon' else list(g.geoms)
def rings_of(p):return[[[round(x,2),round(z,2)] for x,z in r.coords] for r in [p.exterior,*p.interiors]]
width=round((m['maxX']-m['minX'])/7.8125);height=round((m['maxZ']-m['minZ'])/7.8125);mask=Image.new('L',(width,height));draw=ImageDraw.Draw(mask)
def image_points(r,w=width,h=height):return[((x-m['minX'])/(m['maxX']-m['minX'])*w,(z-m['minZ'])/(m['maxZ']-m['minZ'])*h) for x,z in r]
for p in polygons_of(land):
 draw.polygon(image_points(p.exterior.coords),fill=255)
 for ring in p.interiors:draw.polygon(image_points(ring.coords),fill=0)
mask.save(ROOT/'dist/coast-mask-south.png',optimize=True)
# Woodland evidence combines mapped woods with dark green, sloped aerial ground.
fw,fh=round(width/4),round(height/4);wood=Image.new('L',(fw,fh));wd=ImageDraw.Draw(wood)
for ring in data['forest']:wd.polygon(image_points(ring,fw,fh),fill=255)
for area in data.get('forestAreas',[]):
 layer=Image.new('L',(fw,fh));ld=ImageDraw.Draw(layer);ld.polygon(image_points(area[0],fw,fh),fill=255)
 for ring in area[1:]:ld.polygon(image_points(ring,fw,fh),fill=0)
 wood=Image.fromarray(np.maximum(np.array(wood),np.array(layer)));wd=ImageDraw.Draw(wood)
photoCanvas=Image.new('RGB',(fw,fh),(200,200,200));oldW=round(16000/(m['maxX']-m['minX'])*fw);oldH=round(20500/(m['maxZ']-m['minZ'])*fh);photoCanvas.paste(Image.open(ROOT/'dist/regional-aerial.jpg').resize((oldW,oldH)).convert('RGB'),(0,0));photo=np.asarray(photoCanvas,dtype=float);r,g,b=photo[:,:,0],photo[:,:,1],photo[:,:,2]
terrain=np.frombuffer((ROOT/'dist/regional-terrain.bin').read_bytes(),dtype='<i4').reshape(m['height'],m['width'])/100
sample=np.array(Image.fromarray(terrain.astype('float32')).resize((fw,fh)));dz,dx=np.gradient(sample,(m['maxZ']-m['minZ'])/fh,(m['maxX']-m['minX'])/fw);slope=np.hypot(dx,dz)
evidence=(g>r*.95)&(g>b*1.06)&((r+g+b)/3<140)&(sample>20)&(slope>.15)
forest=np.maximum(np.array(wood),evidence.astype('uint8')*210);forest[np.array(mask.resize((fw,fh)))<128]=0
(ROOT/'dist/regional-forest.bin').write_bytes(forest.tobytes())
info={'bounds':{k:m[k] for k in ['minX','maxX','minZ','maxZ']},'mask':'coast-mask-south.png','water':[rings_of(p) for p in polygons_of(water) if p.area>100],'beaches':data['beaches'],'places':data['places'],'forest':{'width':fw,'height':fh},'source':'Mapped OSM shoreline; harbour sea level is a visual approximation, not bathymetry. © OpenStreetMap contributors, ODbL; aerial land-cover evidence © Hutt City Council / NZ Aerial Surveys / AAM NZ / GWRC, CC BY 4.0.'}
(ROOT/'dist/regional-coast.json').write_text(json.dumps(info,separators=(',',':')))
# An ocean sample and the main named districts must fall on the expected side.
from pyproj import Transformer
t=Transformer.from_crs(4326,2193,always_xy=True);ox,oy=json.loads((ROOT/'dist/geodata.json').read_text())['originNZTM']
x,y=t.transform(174.86,-41.27);assert water.contains(Point(x-ox,oy-y)),'Harbour sample classified as land'
for place in data['places']:
 if place['name'] in ['Lower Hutt','Petone','Eastbourne']:assert land.buffer(10).contains(Point(place['x'],place['z'])),place
print('Shoreline ready:',len(polygons_of(water)),'water polygons,',len(info['beaches']),'mapped beaches;',round(float((forest>100).mean())*100,1),'% inferred woodland',flush=True)
