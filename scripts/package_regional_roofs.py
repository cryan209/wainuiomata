"""Give every streamed regional building a stable footprint-aligned roof, and rewrite the far-view data to match.
regional-far.bin (8 floats per building) and regional-roof-far.bin (rise, kind per building) are written together
in chunk order, so they always have one row per building. Needs no downloads: run it after any expansion that adds
buildings (expand_wellington.py, expand_upper_hutt.py, ...). prepare_regional_profiles.py calls it after its survey.
Run with /private/tmp/wainui-gis/bin/python.
"""
import pathlib,json,math
import numpy as np
from shapely.geometry import Polygon
ROOT=pathlib.Path(__file__).resolve().parents[1];D=ROOT/'dist'
def package(m,chunks,datum):
 far=[];farRoofs=[];kinds={}
 for c in m['chunks']:
  data=chunks[c['id']]
  for b in data['buildings']:
   p=Polygon(b['rings'][0],b['rings'][1:]);rect=list(p.minimum_rotated_rectangle.exterior.coords);a,bb,cc=rect[:3];l,w=math.dist(a,bb),math.dist(bb,cc)
   if w>l:a,bb,cc=bb,cc,rect[3];l,w=w,l
   ux,uz=(bb[0]-a[0])/max(.01,l),(bb[1]-a[1])/max(.01,l);cx=sum(q[0] for q in rect[:4])/4;cz=sum(q[1] for q in rect[:4])/4;roof=b.get('roof',{});meas=roof.get('measured',False)
   if not roof.get('frame'):
    if meas:rise=roof['rise']
    elif p.area<650 and w>4 and b['height']<14:rise=min(w*.23,3.5,b['height']*.35);b['height']=round(max(2.2,b['height']-rise),2)
    else:rise=min(1.4,w*.065) if p.area>650 and b['height']<15 else 0
    kind='flat' if rise<.6 or b['height']>18 else 'gable' if p.area>650 or l/w>2.1 or int(b['id'])%3==0 else 'hip'
    if kind=='flat':rise=0
    roof.update(kind=kind,rise=round(rise,2),frame=[round(cx,3),round(cz,3),round(ux,6),round(uz,6),round(l,3),round(w,3)]);b['roof']=roof
   roof['rise']=round(min(roof['rise'],6,w*.55),2)
   farRoofs.extend([roof['rise'],{'flat':0,'gable':1,'hip':2}[roof['kind']]])
   kinds[roof['kind']]=kinds.get(roof['kind'],0)+1
   far.extend([cx,cz,b['ground']-datum,b['height'],l,w,-math.atan2(uz,ux),float(int(b['id'])%8)])
  (D/c['file']).write_text(json.dumps(data,separators=(',',':')))
 np.array(far,dtype='<f4').tofile(D/'regional-far.bin');np.array(farRoofs,dtype='<f4').tofile(D/'regional-roof-far.bin')
 m['roofProfiles']={'measuredUpperHutt':sum(1 for d in chunks.values() for b in d['buildings'] if b.get('roof',{}).get('measured')),'kinds':kinds,'source':'Upper Hutt heights: LINZ Wellington 2013–2014 LiDAR DSM−DEM. Gable/hip/flat geometry inferred from footprint and roof height distribution; no surveyed roof-plane classification.'}
 m['upperHutt']['heights']='LiDAR-derived eave/ridge heights for '+str(m['roofProfiles']['measuredUpperHutt'])+' parts; remaining heights inferred'
 (D/'regional-buildings.json').write_text(json.dumps(m,separators=(',',':')))
 print(m['roofProfiles'],len(far)//8,'buildings',flush=True)
if __name__=='__main__':
 m=json.load(open(D/'regional-buildings.json'));datum=json.load(open(D/'geodata.json'))['originElevation']
 package(m,{c['id']:json.load(open(D/c['file'])) for c in m['chunks']},datum)
