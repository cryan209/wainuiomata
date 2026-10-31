"""Package original, unmasked source aerial tiles for streamed ground detail."""
import pathlib,json
from PIL import Image
root=pathlib.Path(__file__).resolve().parents[1];cache=pathlib.Path('/private/tmp/wainui-roof-detail');out=root/'dist/ground-detail';out.mkdir(exist_ok=True);manifest=json.loads((root/'dist/roof-detail.json').read_text());tiles=[]
for tile in manifest['tiles']:
 ix,iz=tile['id'].split(',');source=cache/f"{ix}_{iz}_{tile['width']}.jpg"
 if not source.exists():continue
 target=out/f'{ix}_{iz}.webp'
 with Image.open(source) as image:
  assert image.size==(tile['width'],tile['height'])
  # WebP at q78 is roughly 60% of the source JPEG with no visible loss at play distance.
  if not target.exists():image.convert('RGB').save(target,'WEBP',quality=78,method=5)
 tiles.append({**tile,'image':'ground-detail/'+target.name})
assert tiles
(root/'dist/ground-detail.json').write_text(json.dumps({**manifest,'tiles':tiles,'source':'Original unmasked Hutt City aerial export tiles; 0.125–0.25m per pixel. No upscaling.'},separators=(',',':')))
print('Packaged',len(tiles),'native aerial tiles')
