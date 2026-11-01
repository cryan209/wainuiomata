"""Write the compact downloads the game loads in place of the build scripts' raw binaries. Run it after any script that
changes the regional terrain or regional buildings (tests/runtime-packs.mjs fails while a pack is stale).

dist/regional-terrain.pack (lossless) holds the Int32 centimetre heights of regional-terrain.bin as Int16 differences.
Each sample is stored minus its left neighbour; the first column is stored minus the row above. The low bytes of all
differences come first, then the high bytes. Neighbouring heights differ by little, so a host's gzip shrinks this to
about half the gzipped .bin (12.6 → 6.6 MB).

dist/regional-far.pack holds regional-far.bin (8 floats per building) and regional-roof-far.bin (2 per building). They
are quantised for the distant view: positions, sizes and ground to 0.1 m, yaw to 0.001 rad, roof rise to 0.01 m. Each
column is stored whole (x, z and ground as differences from the previous building) and split into byte planes. Gzipped,
5.1 MB becomes 2.0 MB.

dist/terrain-pack.js decodes both. The .bin files stay the source the build scripts read and append to.

The regional road map and waterways are also re-saved compactly (lib/regional_map.compact): coordinates rounded to 1cm
and OSM bookkeeping tags the game never reads (source, attribution, LINZ:*, note, ...) dropped."""
import json,pathlib
import numpy as np
from lib.regional_map import load_map,save_map,compact
D=pathlib.Path(__file__).resolve().parents[1]/'dist'
def planes(values,dtype):
 info=np.iinfo(dtype);assert values.min()>=info.min and values.max()<=info.max,(dtype,values.min(),values.max())
 b=values.astype(dtype).view(np.uint8).reshape(len(values),-1);return b''.join(b[:,k].tobytes() for k in range(b.shape[1]))
# Terrain.
m=json.loads((D/'regional-terrain.json').read_text())
t=np.fromfile(D/'regional-terrain.bin',dtype='<i4').reshape(m['height'],m['width']).astype(np.int64)
d=np.diff(t,axis=1,prepend=0);d[:,0]=np.diff(t[:,0],prepend=0)
(D/'regional-terrain.pack').write_bytes(planes(d.ravel(),'<i2'))
m['packed']={'file':'regional-terrain.pack','encoding':'int16 row differences (first column: difference from the row above); low bytes, then high bytes','source':'regional-terrain.bin'}
(D/'regional-terrain.json').write_text(json.dumps(m,indent=2))
# Distant buildings. Column layout: [scale, differenced, bytes per value]; dist/terrain-pack.js FAR_COLUMNS must match.
FAR=[(10,1,4),(10,1,4),(10,1,2),(10,0,2),(10,0,2),(10,0,2),(1000,0,2),(1,0,2)];ROOF=[(100,0,2),(1,0,1)]
manifest=json.loads((D/'regional-buildings.json').read_text());n=manifest['count']
far=np.fromfile(D/'regional-far.bin',dtype='<f4').reshape(-1,8);roof=np.fromfile(D/'regional-roof-far.bin',dtype='<f4').reshape(-1,2)
assert len(far)==len(roof)==n,(len(far),len(roof),n)
out=b''
for table,columns in [(far,FAR),(roof,ROOF)]:
 for c,(scale,diff,width) in enumerate(columns):
  q=np.round(table[:,c].astype(np.float64)*scale).astype(np.int64)
  out+=planes(np.diff(q,prepend=0) if diff else q,{1:'<i1',2:'<i2',4:'<i4'}[width])
(D/'regional-far.pack').write_bytes(out)
manifest['farPack']={'file':'regional-far.pack','count':n,'encoding':'quantised columns, byte planes; see scripts/pack_runtime.py','source':['regional-far.bin','regional-roof-far.bin']}
(D/'regional-buildings.json').write_text(json.dumps(manifest,separators=(',',':')))
save_map(load_map());(D/'regional-waterways.json').write_text(json.dumps([compact(w) for w in json.loads((D/'regional-waterways.json').read_text())],separators=(',',':')))
print('Packed terrain',m['width'],'x',m['height'],'and',n,'distant buildings:',(D/'regional-terrain.pack').stat().st_size//1024,'+',len(out)//1024,'KiB before gzip')
