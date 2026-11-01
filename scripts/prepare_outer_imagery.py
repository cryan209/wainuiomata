"""A 20m/pixel photo layer for the whole regional terrain grid, drawn beneath the 8m Hutt overview.
Covers Wellington, Porirua/Tawa and the Remutaka/Wairarapa strip that the 8m overview misses, and fills its
no-data holes. One texture for the whole grid: the terrain shader has no spare texture unit for more layers.
Source: GWRC Aerial_basemap_2021 level 8 tiles (~19.1m), cached in /private/tmp/wainui-gwrc-tiles.
Run with /private/tmp/wainui-gis/bin/python after any change to the regional terrain extent."""
import pathlib,json,subprocess,concurrent.futures
import numpy as np
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[1];D=ROOT/'dist';CACHE=pathlib.Path('/private/tmp/wainui-gwrc-tiles');CACHE.mkdir(exist_ok=True)
def load(n):return json.loads((D/n).read_text())
LEVEL=8;GW=f'https://mapping.gw.govt.nz/arcgis/rest/services/Aerial_basemap_2021/MapServer/tile/{LEVEL}';GW_ORIGIN=(-4020900,19998100);GW_RES=19.10925707126831;RES=20
def tile(rc):
 row,col=rc;path=CACHE/f'{LEVEL}_{row}_{col}.jpg'
 if not path.exists():
  part=path.with_suffix('.part')
  if subprocess.run(['curl','-sS','--fail','--retry','3','--max-time','60',f'{GW}/{row}/{col}','-o',str(part)]).returncode or part.read_bytes()[:2] not in (b'\xff\xd8',b'\x89P'):part.unlink(missing_ok=True);return rc,None
  part.replace(path)
 return rc,Image.open(path).convert('RGB')
ox,oy=load('geodata.json')['originNZTM'];m=load('regional-terrain.json');w,h=round((m['maxX']-m['minX'])/RES),round((m['maxZ']-m['minZ'])/RES)
span=GW_RES*256;X0,Y0,X1,Y1=ox+m['minX'],oy-m['minZ'],ox+m['minX']+w*RES,oy-m['minZ']-h*RES
c0,c1=int((X0-GW_ORIGIN[0])//span),int((X1-GW_ORIGIN[0])//span);r0,r1=int((GW_ORIGIN[1]-Y0)//span),int((GW_ORIGIN[1]-Y1)//span)
mosaic=Image.new('RGB',((c1-c0+1)*256,(r1-r0+1)*256),(255,255,255))
with concurrent.futures.ThreadPoolExecutor(4) as pool:
 for (row,col),image in pool.map(tile,[(r,c) for r in range(r0,r1+1) for c in range(c0,c1+1)]):
  if image:mosaic.paste(image,((col-c0)*256,(row-r0)*256))
mx,my=GW_ORIGIN[0]+c0*span,GW_ORIGIN[1]-r0*span;outer=mosaic.resize((w,h),Image.LANCZOS,box=((X0-mx)/GW_RES,(my-Y0)/GW_RES,(X1-mx)/GW_RES,(my-Y1)/GW_RES))
a=np.asarray(outer).astype(np.float32)
# Match colour to the 8m overview where both have imagery, so the layers meet without a tonal seam.
o=load('ground-regional.json')['overview'];ref=Image.open(D/o['image']).convert('RGB');px=lambda x:round((x-m['minX'])/RES);pz=lambda z:round((z-m['minZ'])/RES)
box=(px(o['minX']),pz(o['minZ']),min(w,px(o['maxX'])),min(h,pz(o['maxZ'])));ref=np.asarray(ref.resize((box[2]-box[0],box[3]-box[1]),Image.BOX,box=(0,0,(box[2]-box[0])*RES/o['metresPerPixel'],(box[3]-box[1])*RES/o['metresPerPixel'])),dtype=np.float32);src=a[box[1]:box[3],box[0]:box[2]]
ok=(ref.min(axis=2)<235)&(src.min(axis=2)<235)
for c in range(3):gain=ref[...,c][ok].std()/src[...,c][ok].std();a[...,c]=(a[...,c]-src[...,c][ok].mean())*gain+ref[...,c][ok].mean()
# Near-white, unsaturated pixels are service no-data; keep them pure white so the shader keeps procedural ground.
white=np.asarray(outer).min(axis=2)>235;a=np.clip(a,0,255).astype(np.uint8);a[white&(np.asarray(outer).max(axis=2)-np.asarray(outer).min(axis=2)<12)]=255
Image.fromarray(a).save(D/'ground-overview-outer.webp',quality=80,method=6)
ground=load('ground-regional.json');ground.pop('overviewEast',None);(D/'ground-overview-east.jpg').unlink(missing_ok=True)
ground['overviewOuter']={'image':'ground-overview-outer.webp','minX':m['minX'],'minZ':m['minZ'],'maxX':m['minX']+w*RES,'maxZ':m['minZ']+h*RES,'width':w,'height':h,'metresPerPixel':RES,'source':'GWRC Aerial_basemap_2021 (GWRC, WAGGIS, LINZ, AAM NZ; 2021), CC BY 4.0. Resampled to 20m/pixel.'}
(D/'ground-regional.json').write_text(json.dumps(ground,separators=(',',':')))
print('Outer overview',w,'x',h,round((D/'ground-overview-outer.webp').stat().st_size/1024),'KiB; blank',round(float((a.min(axis=2)==255).mean())*100,1),'%',flush=True)
