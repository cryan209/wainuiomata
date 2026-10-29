"""Download licensed native-detail aerials and retain pixels around roof footprints.

Spatial tiles are loaded on demand by the game; blank non-roof pixels compress
away. This improves sampling rather than enlarging the old low-resolution JPEG.
"""
import pathlib,json,math,subprocess,concurrent.futures,urllib.parse
from PIL import Image,ImageDraw,ImageFilter
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'dist/roof-detail';OUT.mkdir(exist_ok=True)
CACHE=pathlib.Path('/private/tmp/wainui-roof-detail');CACHE.mkdir(exist_ok=True)
SERVICE='https://maps.huttcity.govt.nz/server02/rest/services/Aerials_2025/MapServer'
ox,oy=json.loads((ROOT/'dist/geodata.json').read_text())['originNZTM']
buildings=json.loads((ROOT/'dist/buildings.json').read_text())+json.loads((ROOT/'dist/buildings-outer.json').read_text())
SPAN=256;groups={}
for b in buildings:
 r=b['rings'][0];xs=[p[0] for p in r];zs=[p[1] for p in r]
 for ix in range(math.floor((min(xs)-3)/SPAN),math.floor((max(xs)+3)/SPAN)+1):
  for iz in range(math.floor((min(zs)-3)/SPAN),math.floor((max(zs)+3)/SPAN)+1):
   if abs((ix+.5)*SPAN)>3456 or abs((iz+.5)*SPAN)>3456:continue
   groups.setdefault((ix,iz),[]).append(b)
def build(item):
 (ix,iz),parts=item;size=2048 if abs((ix+.5)*SPAN)<1152 and abs((iz+.5)*SPAN)<1152 else 1024
 name=f'{ix}_{iz}.jpg';target=OUT/name;path=CACHE/f'{ix}_{iz}_{size}.jpg'
 if not target.exists():
  left=ox+ix*SPAN;top=oy-iz*SPAN
  if not path.exists():
   query=urllib.parse.urlencode({'bbox':f'{left},{top-SPAN},{left+SPAN},{top}','bboxSR':2193,'imageSR':2193,'size':f'{size},{size}','format':'jpg','f':'image'})
   subprocess.run(['curl','-sS','--fail','--retry','2','--max-time','90',SERVICE+'/export?'+query,'-o',str(path)],check=True)
  image=Image.open(path).convert('RGB');assert image.size==(size,size)
  mask=Image.new('L',(size,size));draw=ImageDraw.Draw(mask)
  for b in parts:
   points=[((x-ix*SPAN)/SPAN*size,(z-iz*SPAN)/SPAN*size) for x,z in b['rings'][0]];draw.polygon(points,fill=255);draw.line(points+[points[0]],fill=255,width=2*math.ceil(3/SPAN*size)+1,joint='curve')
  # Keep overhang/parallax padding around outlines without retaining entire gardens.
  blank=Image.new('RGB',(size,size),'#747b7c');blank.paste(image,(0,0),mask);temporary=target.with_suffix('.part.jpg');blank.save(temporary,quality=92,optimize=True);temporary.replace(target)
 return{'id':f'{ix},{iz}','image':'roof-detail/'+name,'minX':ix*SPAN,'minZ':iz*SPAN,'maxX':(ix+1)*SPAN,'maxZ':(iz+1)*SPAN,'width':size,'height':size,'metresPerPixel':SPAN/size}
tiles=[]
with concurrent.futures.ThreadPoolExecutor(6) as pool:
 for i,tile in enumerate(pool.map(build,sorted(groups.items()))):
  tiles.append(tile)
  if i%20==0:print('Roof detail',i+1,'/',len(groups),flush=True)
metadata={'span':SPAN,'tiles':tiles,'service':SERVICE,'source':'Hutt City 2025 aerial orthophotography; urban capture 29 March 2025, rural 2021','licence':'CC BY 4.0','attribution':'© NZ Aerial Surveys / Hutt City Council; rural imagery AAM NZ Ltd / Greater Wellington Regional Council. Cropped, roof-masked and mapped onto derived geometry.'}
(ROOT/'dist/roof-detail.json').write_text(json.dumps(metadata,separators=(',',':')))
print('Saved',len(tiles),'roof tiles;',round(sum(p.stat().st_size for p in OUT.glob('*.jpg'))/1024**2,1),'MiB',flush=True)
