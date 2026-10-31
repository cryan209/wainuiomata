"""Validate the packaged regional data and every photographic roof tile."""
import pathlib,json,math
from PIL import Image
root=pathlib.Path(__file__).resolve().parents[1]/'dist'
manifest=json.loads((root/'regional-buildings.json').read_text());count=0;photos=0
for chunk in manifest['chunks']:
 buildings=json.loads((root/chunk['file']).read_text())['buildings']
 assert len(buildings)==chunk['count'];count+=len(buildings)
 for building in buildings:
  # Valid source returns are >1.6m; the packaged height rounds to centimetres. The tallest is the 116m Majestic Centre.
  assert 1.6<=building['height']<=120 and math.isfinite(building['ground'])
  for ring in building['rings']:assert ring[0]==ring[-1] and len(ring)>=4
 if 'roof' in chunk:
  roof=chunk['roof'];image=Image.open(root/roof['image']);image.load()
  assert image.size==(roof['width'],roof['height']);photos+=1
  for building in buildings:
   for x,z in building['rings'][0]:
    assert roof['minX']<=x<=roof['maxX'] and roof['minZ']<=z<=roof['maxZ']
assert count==manifest['count']
assert (root/'regional-far.bin').stat().st_size==count*8*4
print('PASS:',count,'regional building parts with closed rings, finite measured heights, and',photos,'decodable georeferenced roof images.')
