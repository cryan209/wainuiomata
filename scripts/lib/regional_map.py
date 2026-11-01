"""Read and write the regional road map, stored as 10km region files.

dist/<name>.json is an index ({bounds, cell, parts}); each part in dist/<name>/ holds the ways whose
centre falls in that cell. The single merged file passed 30MB, beyond some static hosts' per-file limit.
Ways keep their original position as 'i' so loaders (dist/regional-map.js) rebuild the same order.
"""
import json,math,pathlib
DIST=pathlib.Path(__file__).resolve().parents[2]/'dist';CELL=10000

def load_map(name='regional-map',dist=DIST):
 index=json.loads((dist/f'{name}.json').read_text())
 if 'elements' in index:return index
 elements=[e for p in index['parts'] for e in json.loads((dist/p['file']).read_text())['elements']];elements.sort(key=lambda e:e['i'])
 for e in elements:del e['i']
 return{'bounds':index['bounds'],'elements':elements}

# OSM bookkeeping tags the game never reads (dist/*.js has no use of them); dropped on save to shrink the download.
UNUSED=('attribution','source','note','fixme','FIXME','description','check_date','survey:date','created_by','wikidata','wikipedia','wikimedia_commons','mapillary','LINZ:','LINZ2OSM:')

def compact(e):
 """Drop unused tags and round coordinates to 1cm (OSM positions are not more precise than that)."""
 tags={k:v for k,v in e.get('tags',{}).items() if not any(k==u or k.startswith(u if u.endswith(':') else u+':') for u in UNUSED)}
 geometry=[{**p,'x':round(p['x'],2),'z':round(p['z'],2)} for p in e['geometry']]
 return{**e,'tags':tags,'geometry':geometry}

def save_map(data,name='regional-map',dist=DIST):
 folder=dist/name;folder.mkdir(exist_ok=True);cells={}
 data={**data,'elements':[compact(e) for e in data['elements']]}
 for i,e in enumerate(data['elements']):
  g=e['geometry'];x=sum(p['x'] for p in g)/len(g);z=sum(p['z'] for p in g)/len(g)
  cells.setdefault((math.floor(x/CELL),math.floor(z/CELL)),[]).append({**e,'i':i})
 parts=[]
 for (ix,iz),rows in sorted(cells.items()):
  file=f'{name}/{ix}_{iz}.json';(dist/file).write_text(json.dumps({'elements':rows},separators=(',',':')))
  parts.append({'file':file,'count':len(rows),'minX':ix*CELL,'minZ':iz*CELL,'maxX':(ix+1)*CELL,'maxZ':(iz+1)*CELL})
 for old in folder.glob('*.json'):
  if f'{name}/{old.name}' not in {p['file'] for p in parts}:old.unlink()
 (dist/f'{name}.json').write_text(json.dumps({'bounds':data['bounds'],'cell':CELL,'parts':parts},separators=(',',':')))
