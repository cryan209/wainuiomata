"""Add mapped eastern railway approaches and tunnels from cached OSM map tiles.

Run expand_remutaka_roads.py --map-api first to populate the public map cache.
Existing rail routes and surveyed track profiles are preserved.
"""
import json
import math
import pathlib
import xml.etree.ElementTree as ET
import numpy as np
from pyproj import Transformer

ROOT = pathlib.Path(__file__).resolve().parents[1]
D = ROOT / 'dist'
paths = sorted(pathlib.Path('/private/tmp/wainui-remutaka').glob('roads-*.osm'))
if not paths:
    raise SystemExit('Run scripts/expand_remutaka_roads.py --map-api first.')
nodes, ways = {}, {}
for path in paths:
    for e in ET.parse(path).getroot():
        if e.tag == 'node':
            nodes[e.attrib['id']] = (float(e.attrib['lon']), float(e.attrib['lat']))
        elif e.tag == 'way':
            tags = {t.attrib['k']: t.attrib['v'] for t in e.findall('tag')}
            if tags.get('railway') == 'rail':
                ways[e.attrib['id']] = (tags, [n.attrib['ref'] for n in e.findall('nd')])
meta = json.loads((D / 'geodata.json').read_text())
terrain = json.loads((D / 'regional-terrain.json').read_text())
grid = np.fromfile(D / 'regional-terrain.bin', dtype='<i4').reshape(terrain['height'], terrain['width']) / 100
project = Transformer.from_crs(4326, 2193, always_xy=True)
ox, oy = meta['originNZTM']
bounds = terrain['bounds']
def ground(x, z):
    u = min(terrain['width']-1.000001, max(0, (x-terrain['minX'])/terrain['step']))
    v = min(terrain['height']-1.000001, max(0, (z-terrain['minZ'])/terrain['step']))
    i, j = int(u), int(v)
    du, dv = u-i, v-j
    return float(grid[j,i]*(1-du)*(1-dv)+grid[j,i+1]*du*(1-dv)+grid[j+1,i]*(1-du)*dv+grid[j+1,i+1]*du*dv)
data = json.loads((D / 'railways.json').read_text())
imported = set(data.get('easternTrackIds', []))
data['tracks'] = [t for t in data['tracks'] if t['id'] not in imported]
existing = {t['id'].rsplit('-', 1)[0] for t in data['tracks']}
anchors = {p['node']: p['h'] for track in data['tracks'] for p in [track['p'][0], track['p'][-1]]}
added = []
for key, (tags, refs) in ways.items():
    if any(n not in nodes for n in refs):
        raise SystemExit(f'Incomplete railway way {key}; existing railways unchanged.')
    if key in existing:
        if tags.get('tunnel:name'):
            for track in data['tracks']:
                if track['id'].rsplit('-', 1)[0] == key:
                    track['tunnelName'] = tags['tunnel:name']
        continue
    coords = []
    for node in refs:
        x, y = project.transform(*nodes[node])
        coords.append((x-ox, oy-y, node))
    # Keep whole connected ways inside the playable area; do not fabricate an
    # exposed portal by cutting an underground way at the terrain boundary.
    if len(coords)<2 or not all(bounds['minX']<x<bounds['maxX'] and bounds['minZ']<z<bounds['maxZ'] for x,z,_ in coords):
        continue
    points, distance = [], 0
    for a,b in zip(coords, coords[1:]):
        length = math.hypot(b[0]-a[0], b[1]-a[1])
        count = max(1, math.ceil(length/8))
        for k in range(count):
            t = k/count
            x, z = a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t
            points.append({'x': round(x,3), 'z': round(z,3), 'h': round(ground(x,z)+.12,3), 'node': a[2] if k==0 else f'{key}-{len(points)}', 'd': distance+length*t})
        distance += length
    x,z,node = coords[-1]
    points.append({'x': round(x,3), 'z': round(z,3), 'h': round(ground(x,z)+.12,3), 'node': node, 'd': distance})
    bridge, tunnel = tags.get('bridge','no')!='no', tags.get('tunnel','no')!='no'
    start = anchors.get(points[0]['node'], points[0]['h'])
    end = anchors.get(points[-1]['node'], points[-1]['h'])
    if tunnel or bridge:
        for p in points:
            p['h'] = round(start+(end-start)*p['d']/max(.01,distance),3)
    else:
        da, db = start-points[0]['h'], end-points[-1]['h']
        for p in points:
            p['h'] = round(p['h']+da*max(0,1-p['d']/45)+db*max(0,1-(distance-p['d'])/45),3)
    for p in points: p.pop('d')
    track = {'id': key+'-0', 'name': tags.get('name','Railway'), 'tunnelName': tags.get('tunnel:name',''), 'service': tags.get('service',''), 'usage': tags.get('usage',''), 'bridge': bridge, 'tunnel': tunnel, 'electrified': tags.get('electrified','no')!='no', 'p': points}
    added.append(track)
data['tracks'].extend(added)
data['easternTrackIds'] = [t['id'] for t in added]
data['easternSource'] = 'OpenStreetMap map API, 1 November 2026, ODbL; LINZ regional DEM. Tunnel grades inferred between portal elevations, not surveyed interiors.'
(D / 'railways.json').write_text(json.dumps(data,separators=(',',':')))
print(f'Added {len(added)} connected eastern track ways; {sum(t["tunnel"] for t in added)} tunnels.')
