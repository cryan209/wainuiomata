"""Package original, unmasked source aerial tiles for streamed ground detail."""
import pathlib,json,shutil
from PIL import Image
root=pathlib.Path(__file__).resolve().parents[1];cache=pathlib.Path('/private/tmp/wainui-roof-detail');out=root/'dist/ground-detail';out.mkdir(exist_ok=True);manifest=json.loads((root/'dist/roof-detail.json').read_text());tiles=[]
for tile in manifest['tiles']:
 ix,iz=tile['id'].split(',');source=cache/f"{ix}_{iz}_{tile['width']}.jpg"
 if not source.exists():continue
 with Image.open(source) as image:assert image.size==(tile['width'],tile['height'])
 target=out/f'{ix}_{iz}.jpg'
 if not target.exists():shutil.copyfile(source,target)
 tiles.append({**tile,'image':'ground-detail/'+target.name})
assert tiles
(root/'dist/ground-detail.json').write_text(json.dumps({**manifest,'tiles':tiles,'source':'Original unmasked Hutt City aerial export tiles; 0.125–0.25m per pixel. No upscaling.'},separators=(',',':')))
print('Packaged',len(tiles),'native aerial tiles')
