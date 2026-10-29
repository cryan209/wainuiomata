"""On-demand regional roof images, half-metre pixels outside the detailed town."""
import json,pathlib,math,subprocess,urllib.parse,concurrent.futures
from PIL import Image,ImageDraw
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'dist/region-roofs';OUT.mkdir(exist_ok=True);CACHE=pathlib.Path('/private/tmp/wainui-region-roofs');CACHE.mkdir(exist_ok=True)
manifest=json.loads((ROOT/'dist/regional-buildings.json').read_text());meta=json.loads((ROOT/'dist/geodata.json').read_text());ox,oy=meta['originNZTM'];SERVICE='https://maps.huttcity.govt.nz/server02/rest/services/Aerials_2025/MapServer'
def build(chunk):
 if chunk['count']<8:return chunk
 buildings=json.loads((ROOT/'dist'/chunk['file']).read_text())['buildings'];ix,iz=map(int,chunk['id'].split(','));points=[p for b in buildings for p in b['rings'][0]];left=min(ix*512,min(p[0] for p in points)-4);top=min(iz*512,min(p[1] for p in points)-4);right=max((ix+1)*512,max(p[0] for p in points)+4);bottom=max((iz+1)*512,max(p[1] for p in points)+4);resolution=max(.5,(right-left)/4096,(bottom-top)/4096);width=math.ceil((right-left)/resolution);height=math.ceil((bottom-top)/resolution);right=left+width*resolution;bottom=top+height*resolution;name=chunk['id'].replace(',','_')+'.jpg';target=OUT/name
 if not target.exists():
  raw=CACHE/name
  if not raw.exists():
   query=urllib.parse.urlencode({'bbox':f'{ox+left},{oy-bottom},{ox+right},{oy-top}','bboxSR':2193,'imageSR':2193,'size':f'{width},{height}','format':'jpg','f':'image'})
   subprocess.run(['curl','-sS','--fail','--retry','2','--max-time','90',SERVICE+'/export?'+query,'-o',str(raw)],check=True)
  image=Image.open(raw).convert('RGB');assert image.size==(width,height);mask=Image.new('L',(width,height));draw=ImageDraw.Draw(mask)
  for b in buildings:
   p=[((x-left)/resolution,(z-top)/resolution) for x,z in b['rings'][0]];draw.polygon(p,fill=255);draw.line(p+[p[0]],fill=255,width=2*math.ceil(3/resolution)+1,joint='curve')
  blank=Image.new('RGB',image.size,'#777f80');blank.paste(image,(0,0),mask);temp=target.with_suffix('.part.jpg');blank.save(temp,quality=87,optimize=True);temp.replace(target)
 chunk['roof']={'image':'region-roofs/'+name,'minX':round(left,3),'maxX':round(right,3),'minZ':round(top,3),'maxZ':round(bottom,3),'width':width,'height':height,'metresPerPixel':resolution};return chunk
with concurrent.futures.ThreadPoolExecutor(6) as pool:
 manifest['chunks']=[]
 for i,chunk in enumerate(pool.map(build,json.loads((ROOT/'dist/regional-buildings.json').read_text())['chunks'])):
  manifest['chunks'].append(chunk)
  if i%30==0:print('Regional roof images',i+1,'/ 408',flush=True)
manifest['roofSource']='Hutt City 2025 urban / 2021 rural aerial imagery, CC BY 4.0; © NZ Aerial Surveys/Hutt City Council and AAM NZ/GWRC; roof-masked and resampled.'
(ROOT/'dist/regional-buildings.json').write_text(json.dumps(manifest,separators=(',',':')));print('Regional roof imagery ready:',len(list(OUT.glob('*.jpg'))),'images;',round(sum(p.stat().st_size for p in OUT.glob('*.jpg'))/1024**2,1),'MiB',flush=True)
