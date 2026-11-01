"""Restore the cached mapped Melling alignment for the game's fictional 2002 service.
Requires pyproj and the retained local OSM cache. Existing tracks/routes are preserved.
"""
import heapq
import json
import math
from pathlib import Path
import subprocess
import xml.etree.ElementTree as ET
from pyproj import Transformer

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
WAY_IDS = {'182936271', '368369146', '1465516137'}
FOLDERS = ['wainui-regional-osm', 'wainui-upper-osm', 'wainui-wellington-osm', 'wainui-north-east/osm']
paths = []
for folder in FOLDERS:
    directory = Path('/private/tmp') / folder
    if directory.exists():
        result = subprocess.run(['rg', '-l', 'Melling Line', str(directory), '-g', '*.osm'], capture_output=True, text=True, check=False)
        if result.returncode not in (0, 1):
            raise RuntimeError(result.stderr)
        paths += [Path(p) for p in result.stdout.splitlines()]
ways, nodes = {}, {}
for path in paths:
    for element in ET.parse(path).getroot():
        if element.tag == 'node':
            nodes[element.attrib['id']] = (float(element.attrib['lon']), float(element.attrib['lat']))
        elif element.tag == 'way' and element.attrib['id'] in WAY_IDS:
            ways[element.attrib['id']] = [n.attrib['ref'] for n in element.findall('nd')]
    if set(ways) == WAY_IDS and all(n in nodes for refs in ways.values() for n in refs):
        break
assert set(ways) == WAY_IDS, 'Cached Melling construction alignment is required'
data = json.loads((DIST / 'railways.json').read_text())
old_ids = {key+'-historic' for key in WAY_IDS}
data['tracks'] = [t for t in data['tracks'] if t['id'] not in old_ids]
origin = json.loads((DIST / 'geodata.json').read_text())['originNZTM']
project = Transformer.from_crs(4326, 2193, always_xy=True)
positions = {}
for refs in ways.values():
    for node in refs:
        east, north = project.transform(*nodes[node])
        positions[node] = (east-origin[0], origin[1]-north)
# Order the mapped ways from the existing Western Hutt track to the terminal.
existing = {p['node']: p for t in data['tracks'] for p in t['p']}
remaining = dict(ways)
junction = next(n for refs in ways.values() for n in (refs[0], refs[-1]) if n in existing)
ordered, current = [], junction
while remaining:
    key, refs = next((key, refs if refs[0] == current else refs[::-1]) for key, refs in remaining.items() if current in (refs[0], refs[-1]))
    ordered.append((key, refs));current = refs[-1];remaining.pop(key)
chain = [ordered[0][1][0]] + [node for _, refs in ordered for node in refs[1:]]
distances = {chain[0]: 0.0}
for a,b in zip(chain,chain[1:]):
    distances[b] = distances[a]+math.dist(positions[a],positions[b])
station = next(s for s in data['stations'] if s['name'] == 'Melling')
start_h, end_h = existing[junction]['h'], station['h']+.12
total = distances[chain[-1]]
assert math.dist(positions[chain[-1]], (station['x'],station['z'])) < 150
assert abs(end_h-start_h)/total < .03
for key, refs in ordered:
    points = []
    for a,b in zip(refs,refs[1:]):
        ax,az = positions[a];bx,bz = positions[b]
        length = math.hypot(bx-ax,bz-az);steps = max(1,math.ceil(length/4))
        for index in range(steps):
            t = index/steps;distance = distances[a]+length*t
            points.append({'x':round(ax+(bx-ax)*t,3),'z':round(az+(bz-az)*t,3),'h':round(start_h+(end_h-start_h)*distance/total,3),'node':a if index==0 else f'{key}-historic-{len(points)}'})
    x,z = positions[refs[-1]]
    points.append({'x':round(x,3),'z':round(z,3),'h':round(start_h+(end_h-start_h)*distances[refs[-1]]/total,3),'node':refs[-1]})
    data['tracks'].append({'id':key+'-historic','name':'Melling Line','service':'','usage':'branch','bridge':False,'tunnel':False,'electrified':True,'historic':True,'p':points})
# Connect Wellington to Melling over actual shared source nodes, never a straight-line shortcut.
graph, points = {}, {}
for track in data['tracks']:
    if track['service'] in ['yard','siding','spur'] or track['usage']=='industrial' or track['name']=='Gracefield Branch':
        continue
    for a,b in zip(track['p'],track['p'][1:]):
        points[a['node']]=a;points[b['node']]=b
        length=math.hypot(b['x']-a['x'],b['z']-a['z'])
        graph.setdefault(a['node'],[]).append((b['node'],length));graph.setdefault(b['node'],[]).append((a['node'],length))
wellington = next(s for s in data['stations'] if s['name']=='Wellington')
start = min(points,key=lambda n: math.hypot(points[n]['x']-wellington['x'],points[n]['z']-wellington['z']))
end = chain[-1];queue=[(0,start)];cost={start:0};previous={}
while queue:
    distance,node=heapq.heappop(queue)
    if node==end:break
    if distance>cost[node]:continue
    for neighbor,length in graph[node]:
        if distance+length<cost.get(neighbor,math.inf):
            cost[neighbor]=distance+length;previous[neighbor]=node;heapq.heappush(queue,(distance+length,neighbor))
assert end in cost, 'Melling must connect to Wellington through the existing railway'
route=[end]
while route[-1]!=start:route.append(previous[route[-1]])
route=[points[node] for node in reversed(route)]
data['routes']=[r for r in data['routes'] if r['name']!='Melling commuter']
data['routes'].append({'name':'Melling commuter','p':route})
data['mellingService']={'trackIds':sorted(old_ids),'source':'OpenStreetMap cached mapped alignment, 1 November 2026, ODbL. Construction-tagged ways restored for the fictional 2002 service. New branch heights interpolate between the existing track and terminal ground; not surveyed rail levels.'}
(DIST / 'railways.json').write_text(json.dumps(data,separators=(',',':')))
print(f'Added Wellington–Melling service: {cost[end]/1000:.1f} km, {len(route)} route points; {total:.0f} m of restored mapped branch.')
