"""Merge complete mapped Remutaka/Kaitoke/Featherston roads into the region.

Run with /private/tmp/wainui-gis/bin/python. Use --fetch to refresh the public
OSM download; otherwise reuse /private/tmp/wainui-remutaka/roads.json.
"""
import argparse
from datetime import datetime
from zoneinfo import ZoneInfo
import json
import pathlib
import subprocess
import concurrent.futures
import xml.etree.ElementTree as ET
from pyproj import Transformer
from lib.regional_map import load_map, save_map

ROOT = pathlib.Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
CACHE = pathlib.Path('/private/tmp/wainui-remutaka/roads.json')
QUERY = '[out:json][timeout:90];way[highway](-41.21,175.10,-41.065,175.40);out body geom;'

def fetch_map_api():
    """Small cached map tiles include complete ways and all referenced nodes."""
    def piece(bbox, key, depth=0):
        path = CACHE.parent / (key + '.osm')
        if not path.exists():
            temporary = path.with_suffix('.part')
            result = subprocess.run(['curl', '--fail-with-body', '--silent', '--show-error', '--retry', '2', '--max-time', '90', 'https://www.openstreetmap.org/api/0.6/map?bbox=' + ','.join(map(str, bbox)), '-o', str(temporary)], capture_output=True)
            if result.returncode:
                reason = temporary.read_text(errors='replace') if temporary.exists() else ''
                if 'too many nodes' not in reason.lower() or depth >= 3:
                    raise RuntimeError(reason[:300] or result.stderr.decode()[:300])
                l, b, r, t = bbox
                mx, my = (l+r)/2, (b+t)/2
                return [root for k, child in enumerate([(l,b,mx,my),(mx,b,r,my),(l,my,mx,t),(mx,my,r,t)]) for root in piece(child, key+'-'+str(k), depth+1)]
            temporary.replace(path)
        return [ET.parse(path).getroot()]
    def tile(job):
        i, j = job
        bbox = [175.10 + .30*i/4, -41.21 + .145*j/3, 175.10 + .30*(i+1)/4, -41.21 + .145*(j+1)/3]
        return piece(bbox, f'roads-{i}-{j}')
    nodes, ways = {}, {}
    with concurrent.futures.ThreadPoolExecutor(2) as pool:
        for roots in pool.map(tile, [(i,j) for i in range(4) for j in range(3)]):
            for e in (e for root in roots for e in root):
                if e.tag == 'node': nodes[e.attrib['id']] = {'lon': float(e.attrib['lon']), 'lat': float(e.attrib['lat'])}
                elif e.tag == 'way': ways[e.attrib['id']] = e
    elements = []
    for key, way in ways.items():
        tags = {t.attrib['k']: t.attrib['v'] for t in way.findall('tag')}
        if 'highway' not in tags: continue
        refs = [n.attrib['ref'] for n in way.findall('nd')]
        if any(n not in nodes for n in refs): raise SystemExit(f'Incomplete OSM way {key}')
        elements.append({'type': 'way', 'id': key, 'tags': tags, 'nodes': refs, 'geometry': [nodes[n] for n in refs]})
    CACHE.write_text(json.dumps({'elements': elements, 'retrieved': datetime.now(ZoneInfo('Pacific/Auckland')).date().isoformat(), 'endpoint': 'OpenStreetMap map API'}, separators=(',', ':')))

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fetch', action='store_true')
    parser.add_argument('--map-api', action='store_true', help='Download cached tiles from the primary OSM map API')
    args = parser.parse_args()
    if args.map_api:
        CACHE.parent.mkdir(parents=True, exist_ok=True)
        fetch_map_api()
    elif args.fetch or not CACHE.exists():
        CACHE.parent.mkdir(parents=True, exist_ok=True)
        temporary = CACHE.with_suffix('.part')
        for endpoint in ['https://overpass.kumi.systems/api/interpreter', 'https://overpass-api.de/api/interpreter']:
            result = subprocess.run(['curl', '--fail', '--silent', '--show-error', '--max-time', '120', '-A', 'wainuiomata-roads-build/1.0', '--data-urlencode', 'data=' + QUERY, endpoint, '-o', str(temporary)])
            if result.returncode == 0:
                temporary.replace(CACHE)
                break
        else:
            raise SystemExit('Road download failed; existing map unchanged.')
    source = json.loads(CACHE.read_text())
    if source.get('remark') or not source.get('elements'):
        raise SystemExit('Incomplete OSM response; existing map unchanged.')
    origin = json.loads((DIST / 'geodata.json').read_text())['originNZTM']
    project = Transformer.from_crs(4326, 2193, always_xy=True)
    regional = load_map()
    roads = {str(r['id']): r for r in regional['elements']}
    added = updated = 0
    for way in source['elements']:
        if way['type'] != 'way' or 'highway' not in way.get('tags', {}):
            continue
        geometry, nodes = way.get('geometry', []), way.get('nodes', [])
        if len(nodes) < 2 or len(nodes) != len(geometry) or any(p is None for p in geometry):
            raise SystemExit(f"Incomplete way {way['id']}; existing map unchanged.")
        x, y = project.transform([p['lon'] for p in geometry], [p['lat'] for p in geometry])
        points = [{'x': round(e - origin[0], 3), 'z': round(origin[1] - n, 3), 'node': str(node)} for e, n, node in zip(x, y, nodes)]
        key = str(way['id'])
        added += key not in roads
        updated += key in roads
        roads[key] = {'id': key, 'tags': way['tags'], 'geometry': points}
    regional['elements'] = list(roads.values())
    save_map(regional)
    metadata = {'source': '© OpenStreetMap contributors, ODbL', 'endpoint': source.get('endpoint', 'OpenStreetMap Overpass API'), 'query': QUERY, 'timestamp': source.get('osm3s', {}).get('timestamp_osm_base'), 'retrieved': source.get('retrieved'), 'ways': len(source['elements']), 'note': 'Full ordered way geometry and node IDs retained for cross-boundary routing; elevations use existing regional terrain.'}
    (DIST / 'remutaka-roads.json').write_text(json.dumps(metadata, indent=2) + '\n')
    print(f'Remutaka roads: {added} added, {updated} overlapping ways refreshed.')

if __name__ == '__main__':
    main()
