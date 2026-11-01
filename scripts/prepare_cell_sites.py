"""Build scenery from RSM's public read-only licence search. No credentials or extra reader required.
Use --fetch to refresh JSON search responses; without it, reuse --cache.
"""
import argparse,collections,concurrent.futures,datetime,json,math,subprocess
from pathlib import Path
from zoneinfo import ZoneInfo
ROOT=Path(__file__).resolve().parents[1]
PROVIDERS={'SPARK NEW ZEALAND TRADING LIMITED':'Spark','ONE NEW ZEALAND GROUP LIMITED':'One NZ','TWO DEGREES NETWORKS LIMITED':'2degrees','RURAL CONNECTIVITY GROUP LIMITED':'RCG'}
BANDS=[(758,803),(869,960),(1805,1880),(2110,2170),(2300,2400),(2500,2690),(3300,3800)]
API='https://rrf.rsm.govt.nz/api/public_search/licence'
def inside(ring,x,z):
 result=False
 for a,b in zip(ring,ring[1:]+ring[:1]):
  if (a[1]>z)!=(b[1]>z) and x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]:result=not result
 return result

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--fetch',action='store_true');parser.add_argument('--cache',type=Path,default=Path('/private/tmp/wainui-rsm'));parser.add_argument('--retrieved');args=parser.parse_args();args.cache.mkdir(parents=True,exist_ok=True)
 previous=ROOT/'scripts/data/cell-sites-rsm.json';retrieved=args.retrieved or (datetime.datetime.now(ZoneInfo('Pacific/Auckland')).date().isoformat() if args.fetch or not previous.exists() else json.loads(previous.read_text())['retrieved'])
 meta=json.loads((ROOT/'dist/geodata.json').read_text());bounds=json.loads((ROOT/'dist/regional-terrain.json').read_text())['bounds'];ox,oy=meta['originNZTM']
 query={'licenceStatus':['Current'],'georeference':{'type':'TM2000','easting':str(round(ox)),'northing':str(round(oy))},'suppressed':False,'includeLicencesWithoutGeorefInFreqRange':False,'radius':40,'orderBy':'distance','page':1,'displayGeorefType':'TM2000','pageSize':5000,'isRelevanceSort':True,'licenceType':[178],'configType':'TRN','refFrequencyFrom':700,'refFrequencyTo':3800}
 def fetch(item):
  key,text=item;src=args.cache/f'search-{key}.json';dest=args.cache/f'results-{key}.json';src.write_text(json.dumps({**query,'searchText':text}))
  subprocess.run(['curl','--silent','--show-error','--fail','--connect-timeout','10','--max-time','60',API,'-H','Content-Type: application/json','--data-binary','@'+str(src),'--output',str(dest)],check=True)
 if args.fetch:
  with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:list(pool.map(fetch,[('spark','Spark'),('one','One New Zealand'),('degrees','degrees'),('rcg','Rural Connectivity')]))
 rows={}
 for key in ['spark','one','degrees','rcg']:
  result=json.loads((args.cache/f'results-{key}.json').read_text())
  if result['totalPages']!=1 or len(result['results'])!=result['totalItems']:raise ValueError('Search is paginated; narrow the region or fetch every page before importing')
  for row in result['results']:
   if row['licensee'] not in PROVIDERS or row['configType']!='TRN' or row['licenceStatus']!='Current' or row.get('suppressed') or not any(a<=row['refFrequency']<=b for a,b in BANDS):continue
   geo=next((g for g in row['locationGeoReferences'] if g['type']=='TM2000'),None)
   if not geo:continue # Never mistake NZGD1949 latitude/longitude for NZGD2000.
   x,z=geo['easting']-ox,oy-geo['northing']
   if not(bounds['minX']+100<x<bounds['maxX']-100 and bounds['minZ']+100<z<bounds['maxZ']-100):continue
   rows[row['id']]={'licenceId':row['id'],'provider':PROVIDERS[row['licensee']],'location':row['location'],'easting':geo['easting'],'northing':geo['northing'],'frequencyMHz':row['refFrequency']}
 # Exact coordinate groups first; merge only anchors within 12 m of a retained RSM anchor.
 anchors=collections.defaultdict(list)
 for row in rows.values():anchors[(row['easting'],row['northing'])].append(row)
 groups=[]
 for (east,north),records in sorted(anchors.items(),key=lambda v:(-len(v[1]),v[0])):
  group=next((g for g in groups if math.hypot(east-g['easting'],north-g['northing'])<=12),None)
  if group:group['records'].extend(records)
  else:groups.append({'easting':east,'northing':north,'records':list(records)})
 # Find actual containing game footprints. Roof attachments never become ground poles inside buildings.
 building_cells=collections.defaultdict(list)
 manifest=json.loads((ROOT/'dist/regional-buildings.json').read_text())
 buildings=json.loads((ROOT/'dist/buildings.json').read_text())+json.loads((ROOT/'dist/buildings-outer.json').read_text())
 for chunk in manifest['chunks']:
  buildings.extend(json.loads((ROOT/'dist'/chunk['file']).read_text()).get('buildings',[]))
 for b in buildings:
  if not b.get('rings') or b.get('railCanopy'):continue
  ring=b['rings'][0];xs=[p[0] for p in ring];zs=[p[1] for p in ring];box=min(xs),min(zs),max(xs),max(zs)
  for ix in range(math.floor(box[0]/64),math.floor(box[2]/64)+1):
   for iz in range(math.floor(box[1]/64),math.floor(box[3]/64)+1):building_cells[(ix,iz)].append((b,box))
 sites=[]
 for group in groups:
  east,north=group['easting'],group['northing'];x,z=east-ox,oy-north;hits=[]
  for b,box in building_cells[(math.floor(x/64),math.floor(z/64))]:
   if box[0]<=x<=box[2] and box[1]<=z<=box[3] and inside(b['rings'][0],x,z) and not any(inside(r,x,z) for r in b['rings'][1:]):hits.append(b)
  roof=max(hits,key=lambda b:b.get('ridge',b.get('ground',-100000)+b.get('height',0)+b.get('roof',{}).get('rise',0))) if hits else None
  records=sorted(group['records'],key=lambda r:r['licenceId']);names=sorted(set(r['location'] for r in records));providers=sorted(set(r['provider'] for r in records));hill=any(any(word in name.upper() for word in ['HILL','MOUNT ','MT ','RIDGE','SUMMIT']) for name in names)
  mount='rooftop' if roof else 'lattice' if hill else 'monopole';bands=len({i for r in records for i,(a,b) in enumerate(BANDS) if a<=r['frequencyMHz']<=b})
  # More licensed bands means more antenna panels: 3-6 m rooftop masts, 14-26 m monopoles, 18-30 m lattices.
  height=2.5+.5*bands if roof else 16+2*bands if hill else 12+2*bands;base=round(roof.get('ridge',roof.get('ground',0)+roof.get('height',0)+roof.get('roof',{}).get('rise',0)),3) if roof and 'ground' in roof else None
  sites.append({'id':f'rsm-{round(east)}-{round(north)}','name':names[0],'names':names,'providers':providers,'x':round(x,3),'z':round(z,3),'easting':east,'northing':north,'mount':mount,'bandCount':bands,'height':height,'roofElevation':base,'buildingId':roof['id'] if roof else None,'buildingHeight':roof.get('height',0) if roof else 0,'licences':[[r['licenceId'],r['frequencyMHz']] for r in records]})
 source={'source':'Radio Spectrum Management / MBIE, public Register of Radio Frequencies','sourceUrl':'https://rrf.rsm.govt.nz/ui/search/licence','apiUrl':API,'copyright':'Crown copyright; source acknowledged. No logos or register software are reproduced.','retrieved':retrieved,'query':query,'bandsMHz':BANDS,'coordinateSystem':'NZTM2000 / EPSG:2193; world x=easting-originE, z=originN-northing','licenceCount':len(rows),'siteCount':len(sites),'groupingRadiusMetres':12,'geometryNote':'RSM coordinates are indicative licence-location points, not a survey of physical towers. Structure types are illustrative; heights scale with the number of licensed bands at each site. Rooftop mounting is inferred only at containing game building footprints. Current records do not reconstruct the network as it stood in 2002.','sites':sorted(sites,key=lambda s:s['id'])}
 (ROOT/'scripts/data/cell-sites-rsm.json').write_text(json.dumps(source,indent=2)+'\n')
 slim={k:source[k] for k in ['source','sourceUrl','retrieved','licenceCount','siteCount','geometryNote']};slim['sites']=[{k:s[k] for k in ['id','name','providers','x','z','mount','bandCount','height','roofElevation','buildingId','buildingHeight','licences']} for s in source['sites']]
 (ROOT/'dist/cell-sites.json').write_text(json.dumps(slim,separators=(',',':'))+'\n')
 print(f"{len(rows)} current RSM transmitter licences -> {len(sites)} in-bounds site clusters; {collections.Counter(s['mount'] for s in sites)}")
if __name__=='__main__':main()
