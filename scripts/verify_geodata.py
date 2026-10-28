"""Validate the geometry and its correspondence with the source survey."""
import json,pathlib,numpy as np
root=pathlib.Path(__file__).resolve().parents[1]/'dist'
m=json.loads((root/'geodata.json').read_text());bs=json.loads((root/'buildings.json').read_text());roads=json.loads((root/'map.json').read_text())
assert m['verticalScale']==1
for path,shape in [('terrain.bin',(m['terrain']['size'],)*2),('terrain-fine.bin',(m['fine']['height'],m['fine']['width']))]:
 a=np.fromfile(root/path,dtype='<i4').reshape(shape)/100
 assert np.isfinite(a).all() and (a>-10).all() and (a<1000).all()
 print(path,shape,'elevation range',round(a.min(),2),round(a.max(),2))
assert m['counts']['minimumRoofCoverage']>=.99999
assert len(bs)==m['counts']['buildings'] and len(bs)>3000
for path in ['building-roofs.bin','building-walls.bin']:
 a=np.fromfile(root/path,dtype='<f4').reshape(-1,3)
 assert np.isfinite(a).all() and a.shape[0]%3==0
 assert np.max(a[:,1])<200 and np.min(a[:,1])>-40
 print(path,len(a)//3,'triangles')
for b in bs:
 assert b['ridge']>=b['ground']+1.5
 for r in b['rings']:assert len(r)>=4 and r[0]==r[-1]
assert all('x' in p and 'z' in p for r in roads['elements'] for p in r['geometry'])
# Compare the packaged 2m samples against the original 2025 DEM cache.
cache=np.load('/private/tmp/wainui-linz/local-dem.npz');src=cache['a'];a,b,c,d,e,f=cache['t'];fine=np.fromfile(root/'terrain-fine.bin',dtype='<i4').reshape(m['fine']['height'],m['fine']['width'])/100
for i,j in [(500,550),(250,300),(700,800),(100,900),(800,100)]:
 x=m['originNZTM'][0]+m['fine']['minX']+i*2;y=m['originNZTM'][1]-(m['fine']['minZ']+j*2);col=(x-c)/a-.5;row=(y-f)/e-.5;cc,rr=int(col),int(row);dx,dy=col-cc,row-rr
 survey=src[rr,cc]*(1-dx)*(1-dy)+src[rr,cc+1]*dx*(1-dy)+src[rr+1,cc]*(1-dx)*dy+src[rr+1,cc+1]*dx*dy
 assert abs(fine[j,i]-survey)<.006
print('PASS: source survey samples agree within 6mm; roof meshes cover 100% of included outlines.')
