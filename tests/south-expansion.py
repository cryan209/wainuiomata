import pathlib,json,numpy as np
from PIL import Image
root=pathlib.Path(__file__).resolve().parents[1]/'dist';meta=json.loads((root/'regional-terrain.json').read_text());coast=json.loads((root/'regional-coast.json').read_text());terrain=np.fromfile(root/'regional-terrain.bin',dtype='<i4').reshape(meta['height'],meta['width']);mask=Image.open(root/coast['mask']);forest=np.fromfile(root/'regional-forest.bin',dtype='u1').reshape(coast['forest']['height'],coast['forest']['width']);bounds=meta['bounds']
def pixel(x,z,w,h):return int((x-meta['minX'])/(meta['maxX']-meta['minX'])*w),int((z-meta['minZ'])/(meta['maxZ']-meta['minZ'])*h)
for x,z in [(2031,1609),(3634,799),(-1463,9511),(-4467,16902)]:
 assert bounds['minX']<x<bounds['maxX'] and bounds['minZ']<z<bounds['maxZ'];assert mask.getpixel(pixel(x,z,mask.width,mask.height))>128;assert terrain[round((z-meta['minZ'])/25),round((x-meta['minX'])/25)]>0
assert mask.getpixel(pixel(-4400,17200,mask.width,mask.height))<128,'South-coast ocean is water'
x,z=pixel(5000,11000,forest.shape[1],forest.shape[0]);assert forest[z,x]>128,'Remutaka woodland multipolygon has forest coverage'
roads=json.loads((root/'regional-map.json').read_text())['elements'];coastRoad=[r for r in roads if r['tags'].get('name')=='Coast Road'];assert max(p['z'] for r in coastRoad for p in r['geometry'])>16900
print('PASS: expanded terrain dimensions, dry park/coast arrivals, offshore mask, Remutaka forest and Coast Road to the beach.')
