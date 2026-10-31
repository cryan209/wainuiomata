"""Regional ground photography: an 8m overview, streamed 2m valley tiles and 0.5m urban tiles.

Uses the same Hutt City Aerials_2025 export service as the roofs. Pixels the service leaves white (sea,
outside coverage) are kept pure white so the terrain shader can fall back to procedural ground there.
Urban tiles reuse the unmasked raw exports cached by prepare_regional_roofs.py where available.
"""
import json,pathlib,math,subprocess,urllib.parse,concurrent.futures,time,threading
import numpy as np
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[1];DIST=ROOT/'dist';CACHE=pathlib.Path('/private/tmp/wainui-regional-ground');CACHE.mkdir(exist_ok=True)
ROOF_CACHE=pathlib.Path('/private/tmp/wainui-region-roofs');SERVICE='https://maps.huttcity.govt.nz/server02/rest/services/Aerials_2025/MapServer'
meta=json.loads((DIST/'geodata.json').read_text());ox,oy=meta['originNZTM'];region=json.loads((DIST/'regional-terrain.json').read_text())
MIN_X,MIN_Z,MAX_X,MAX_Z=region['minX'],region['minZ'],region['maxX'],region['maxZ']
DETAIL=json.loads((DIST/'ground-detail.json').read_text())['tiles'];DETAIL_BOX=(min(t['minX'] for t in DETAIL),min(t['minZ'] for t in DETAIL),max(t['maxX'] for t in DETAIL),max(t['maxZ'] for t in DETAIL))

def export(left,top,right,bottom,width,height,raw):
 if not raw.exists():
  query=urllib.parse.urlencode({'bbox':f'{ox+left},{oy-bottom},{ox+right},{oy-top}','bboxSR':2193,'imageSR':2193,'size':f'{width},{height}','format':'jpg','f':'image'})
  part=raw.with_suffix('.part')
  # The service sometimes answers 503 as a JSON body with HTTP 200; only keep real JPEG responses.
  for attempt in range(8):
   subprocess.run(['curl','-sS','--fail','--retry','3','--max-time','120',SERVICE+'/export?'+query,'-o',str(part)],check=True)
   if part.read_bytes()[:2]==b'\xff\xd8':break
   time.sleep(2+attempt*3)
  else:raise RuntimeError('export failed: '+part.read_text()[:200])
  part.replace(raw)
 image=Image.open(raw).convert('RGB');assert image.size==(width,height),(raw,image.size);return image

def clean(image):
 # Service no-data is near-white with almost no saturation; snap it to pure white so JPEG noise cannot leak.
 a=np.asarray(image).astype(np.int16);blank=(a.min(axis=2)>=244)&((a.max(axis=2)-a.min(axis=2))<10);a[blank]=255
 return Image.fromarray(a.astype(np.uint8)),float(blank.mean())

def save(image,target,quality):
 temp=target.with_suffix('.part.jpg');image.save(temp,quality=quality,optimize=True,progressive=True);temp.replace(target)

# 1. Overview mosaic over the whole regional terrain, 8m per pixel, fetched as 2048px pieces.
OVERVIEW_RES=8;ow,oh=math.ceil((MAX_X-MIN_X)/OVERVIEW_RES),math.ceil((MAX_Z-MIN_Z)/OVERVIEW_RES);overview=Image.new('RGB',(ow,oh),(255,255,255))
for py in range(0,oh,2048):
 for px in range(0,ow,2048):
  w,h=min(2048,ow-px),min(2048,oh-py);left,top=MIN_X+px*OVERVIEW_RES,MIN_Z+py*OVERVIEW_RES
  overview.paste(export(left,top,left+w*OVERVIEW_RES,top+h*OVERVIEW_RES,w,h,CACHE/f'overview_{px}_{py}.jpg'),(px,py))
overview,_=clean(overview);save(overview,DIST/'ground-overview.jpg',84)
overviewBlank=(np.asarray(overview).min(axis=2)==255)
def blank_share(left,top,right,bottom):
 a=overviewBlank[max(0,int((top-MIN_Z)/OVERVIEW_RES)):int(math.ceil((bottom-MIN_Z)/OVERVIEW_RES)),max(0,int((left-MIN_X)/OVERVIEW_RES)):int(math.ceil((right-MIN_X)/OVERVIEW_RES))]
 return float(a.mean()) if a.size else 1.
print('Overview',ow,'x',oh,flush=True)

# 2. Valley tiles: 2048m at 2m per pixel, skipping tiles that are entirely sea/outside coverage.
VALLEY_SPAN,VALLEY_RES=2048,2;(DIST/'ground-valley').mkdir(exist_ok=True)
def valley(cell):
 ix,iz=cell;left,top=MIN_X+ix*VALLEY_SPAN,MIN_Z+iz*VALLEY_SPAN;right,bottom=left+VALLEY_SPAN,top+VALLEY_SPAN
 if blank_share(left,top,right,bottom)>.985:return None
 name=f'{ix}_{iz}.jpg';target=DIST/'ground-valley'/name;size=VALLEY_SPAN//VALLEY_RES
 if not target.exists():
  image,share=clean(export(left,top,right,bottom,size,size,CACHE/('valley_'+name)))
  if share>.985:return None
  save(image,target,80)
 return{'id':f'v{ix},{iz}','image':'ground-valley/'+name,'minX':left,'minZ':top,'maxX':right,'maxZ':bottom,'width':size,'height':size,'metresPerPixel':VALLEY_RES}
cells=[(ix,iz) for iz in range(math.ceil((MAX_Z-MIN_Z)/VALLEY_SPAN)) for ix in range(math.ceil((MAX_X-MIN_X)/VALLEY_SPAN))]
with concurrent.futures.ThreadPoolExecutor(3) as pool:valleyTiles=[t for t in pool.map(valley,cells) if t]
print('Valley tiles',len(valleyTiles),flush=True)

# 3. Urban tiles: each 512m building chunk outside the native Wainuiomata detail, at 0.5m per pixel.
URBAN_SPAN,URBAN_RES=512,.5;(DIST/'ground-urban').mkdir(exist_ok=True)
def inside_detail(left,top):return left>=DETAIL_BOX[0] and top>=DETAIL_BOX[1] and left+URBAN_SPAN<=DETAIL_BOX[2] and top+URBAN_SPAN<=DETAIL_BOX[3]
def urban(chunk):
 ix,iz=map(int,chunk['id'].split(','));left,top=ix*URBAN_SPAN,iz*URBAN_SPAN;right,bottom=left+URBAN_SPAN,top+URBAN_SPAN
 if inside_detail(left,top) or blank_share(left,top,right,bottom)>.95:return None
 name=chunk['id'].replace(',','_')+'.jpg';target=DIST/'ground-urban'/name;size=int(URBAN_SPAN/URBAN_RES)
 if not target.exists():
  roof=chunk.get('roof');raw=ROOF_CACHE/name
  if roof and raw.exists():
   # Cached roof exports cover at least the chunk cell; crop the cell at the export's native 0.5m scale.
   source=Image.open(raw).convert('RGB');r=roof['metresPerPixel'];box=((left-roof['minX'])/r,(top-roof['minZ'])/r,(right-roof['minX'])/r,(bottom-roof['minZ'])/r)
   image=source.resize((size,size),Image.LANCZOS,box=box)
  else:image=export(left,top,right,bottom,size,size,CACHE/('urban_'+name))
  image,_=clean(image);save(image,target,80)
 return{'id':'u'+chunk['id'],'image':'ground-urban/'+name,'minX':left,'minZ':top,'maxX':right,'maxZ':bottom,'width':size,'height':size,'metresPerPixel':URBAN_RES}
chunks=[c for c in json.loads((DIST/'regional-buildings.json').read_text())['chunks'] if c['count']>=8]
with concurrent.futures.ThreadPoolExecutor(3) as pool:urbanTiles=[t for t in pool.map(urban,chunks) if t]
print('Urban tiles',len(urbanTiles),flush=True)

# 4. Outside Hutt City the export service only has coarse imagery. Rebuild blurry tiles from the GWRC 2021
# regional basemap cache (0.3m regional / 0.1m urban), downsampled, and keep whichever version is sharper.
GW='https://mapping.gw.govt.nz/arcgis/rest/services/Aerial_basemap_2021/MapServer';GW_ORIGIN=(-4020900,19998100);GW_RES={12:1.1943285668550503,14:0.29858214164761665}
GW_CACHE=pathlib.Path('/private/tmp/wainui-gwrc-tiles');GW_CACHE.mkdir(exist_ok=True);REPLACED=CACHE/'gwrc-replaced.json';LOCK=threading.Lock();replaced=set(json.loads(REPLACED.read_text())) if REPLACED.exists() else set()
def gw_tile(level,row,col):
 path=GW_CACHE/f'{level}_{row}_{col}.jpg'
 if not path.exists():
  part=path.with_suffix(f'.{threading.get_ident()}.part');result=subprocess.run(['curl','-sS','--fail','--retry','3','--max-time','60',f'{GW}/tile/{level}/{row}/{col}','-o',str(part)])
  if result.returncode or part.read_bytes()[:2] not in (b'\xff\xd8',b'\x89P'):part.unlink(missing_ok=True);return None
  part.replace(path)
 return Image.open(path).convert('RGB')
def gw_image(level,left,top,right,bottom,size):
 r=GW_RES[level];span=r*256;X0,Y0=ox+left,oy-top;X1,Y1=ox+right,oy-bottom
 c0,c1=int((X0-GW_ORIGIN[0])//span),int((X1-GW_ORIGIN[0])//span);r0,r1=int((GW_ORIGIN[1]-Y0)//span),int((GW_ORIGIN[1]-Y1)//span)
 mosaic=Image.new('RGB',((c1-c0+1)*256,(r1-r0+1)*256),(255,255,255))
 for row in range(r0,r1+1):
  for col in range(c0,c1+1):
   tile=gw_tile(level,row,col)
   if tile:mosaic.paste(tile,((col-c0)*256,(row-r0)*256))
 mx,my=GW_ORIGIN[0]+c0*span,GW_ORIGIN[1]-r0*span
 return mosaic.resize((size,size),Image.LANCZOS,box=((X0-mx)/r,(my-Y0)/r,(X1-mx)/r,(my-Y1)/r))
def sharpness(image):
 a=np.asarray(image.convert('L'),dtype=np.float32);d=np.abs(np.diff(a,axis=1));ok=(a[:,1:]<250)&(a[:,:-1]<250)
 return float(np.median(d[ok])) if ok.mean()>.05 else 0.
def sharpen(tile,level):
 target=DIST/tile['image']
 if tile['image'] in replaced:tile['source']='gwrc-2021';return
 current=Image.open(target).convert('RGB')
 if sharpness(current)>=8:return
 candidate,_=clean(gw_image(level,tile['minX'],tile['minZ'],tile['maxX'],tile['maxZ'],tile['width']))
 if sharpness(candidate)>sharpness(current)*1.25:
  save(candidate,target,80);tile['source']='gwrc-2021'
  with LOCK:replaced.add(tile['image']);REPLACED.write_text(json.dumps(sorted(replaced)))
with concurrent.futures.ThreadPoolExecutor(6) as pool:
 list(pool.map(lambda t:sharpen(t,14),urbanTiles));list(pool.map(lambda t:sharpen(t,12),valleyTiles))
REPLACED.write_text(json.dumps(sorted(replaced)));print('GWRC 2021 replacements',len(replaced),flush=True)

source='Hutt City Aerials_2025 export service: © NZ Aerial Surveys / Hutt City Council (2025 urban); NZ Aerial Surveys for GWRC (2025/26 rural). Tiles marked gwrc-2021: GWRC Aerial_basemap_2021 (GWRC, WAGGIS, LINZ, AAM NZ; 2021). CC BY 4.0. Cropped, resampled, no-data set to white.'
(DIST/'ground-regional.json').write_text(json.dumps({'source':source,'service':SERVICE,'overview':{'image':'ground-overview.jpg','minX':MIN_X,'minZ':MIN_Z,'maxX':MIN_X+ow*OVERVIEW_RES,'maxZ':MIN_Z+oh*OVERVIEW_RES,'width':ow,'height':oh,'metresPerPixel':OVERVIEW_RES},'valley':{'span':VALLEY_SPAN,'tiles':valleyTiles},'urban':{'span':URBAN_SPAN,'tiles':urbanTiles}},separators=(',',':')))
size=lambda d:sum(p.stat().st_size for p in (DIST/d).glob('*.jpg'))/1024**2
print('Regional ground ready: overview',round((DIST/'ground-overview.jpg').stat().st_size/1024**2,1),'MiB; valley',round(size('ground-valley'),1),'MiB; urban',round(size('ground-urban'),1),'MiB',flush=True)
