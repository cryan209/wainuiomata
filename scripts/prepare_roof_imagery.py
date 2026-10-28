"""Build a georeferenced roof texture from Hutt City's public 2025 aerial tiles."""
import pathlib,json,subprocess,concurrent.futures,math
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[1];CACHE=pathlib.Path('/private/tmp/wainui-aerial');CACHE.mkdir(exist_ok=True)
SERVICE='https://maps.huttcity.govt.nz/server02/rest/services/Aerials_2025/MapServer'
origin=(-4020900,19998100);resolution=.5971642835598172;span=256*resolution
meta=json.loads((ROOT/'dist/geodata.json').read_text());ox,oy=meta['originNZTM']
# Tile-aligned 16x16 mosaic, 4096px square; aligned to NZTM, north at the top.
col0=math.floor((ox-origin[0])/span)-8;row0=math.floor((origin[1]-oy)/span)-8
jobs=[(r,c) for r in range(row0,row0+17) for c in range(col0,col0+17)]
def tile(job):
 row,col=job;path=CACHE/f'13-{row}-{col}.jpg'
 if not path.exists():subprocess.run(['curl','-sS','-L','--fail','--retry','2','--max-time','25',f'{SERVICE}/tile/13/{row}/{col}','-o',str(path)],check=True)
 with Image.open(path) as image:
  image.load();assert image.size==(256,256);return row,col,image.convert('RGB')
mosaic=Image.new('RGB',(17*256,17*256))
for n,(row,col,im) in enumerate(concurrent.futures.ThreadPoolExecutor(8).map(tile,jobs)):
 mosaic.paste(im,((col-col0)*256,(row-row0)*256))
 if n%50==0:print('Aerial tiles',n+1,'/',len(jobs),flush=True)
# Crop to a 4096px, georeferenced square centered precisely on the game's origin.
left=ox-2048*resolution;top=oy+2048*resolution
mosaic_left=origin[0]+col0*span;mosaic_top=origin[1]-row0*span
cropx=round((left-mosaic_left)/resolution);cropy=round((mosaic_top-top)/resolution)
image=mosaic.crop((cropx,cropy,cropx+4096,cropy+4096));image.save(ROOT/'dist/roof-aerial-2025.jpg',quality=91,optimize=True)
actualleft=mosaic_left+cropx*resolution;actualtop=mosaic_top-cropy*resolution
info={'image':'roof-aerial-2025.jpg','width':4096,'height':4096,'metresPerPixel':resolution,'minX':actualleft-ox,'maxZ':oy-(actualtop-4096*resolution),'maxX':actualleft+4096*resolution-ox,'minZ':oy-actualtop,'source':'Hutt City 2025 aerial orthophotography','capture':'29 March 2025 (urban imagery, per service metadata)','service':SERVICE,'licence':'CC BY 4.0','attribution':'© NZ Aerial Surveys and Hutt City Council. Reused under CC BY 4.0. Cropped, resampled and mapped onto derived roof geometry.'}
(ROOT/'dist/roof-imagery.json').write_text(json.dumps(info,indent=2));print(json.dumps(info,indent=2),flush=True)
