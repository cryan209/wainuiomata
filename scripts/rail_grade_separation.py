"""Lift mapped rail bridges clear of the roads beneath them and record level crossings.

Runs in place on dist/railways.json after prepare_railways.py (and the later rail expansion
scripts). The coarse regional DEM has no embankments, so bridge-tagged track over a road
otherwise sits at road level. Required deck heights ramp out along the connected track at a
gentle grade; level-crossing nodes stay at road level. Re-running gives the same result.
"""
import collections, heapq, json, math, pathlib, re, subprocess
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
ROAD_CLEARANCE, PATH_CLEARANCE, DECK_DEPTH = 4.9, 2.8, .65  # rail top sits DECK_DEPTH above the beam soffit
RAMP_GRADE, PIN_GRADE = .015, .025
NOT_ROADS = {'proposed', 'construction', 'abandoned', 'disused', 'razed', 'platform', 'corridor', 'elevator'}
PATHS = {'footway', 'path', 'cycleway', 'steps', 'bridleway', 'pedestrian', 'track'}
CLASS_WIDTH = {'motorway': 11, 'trunk': 10, 'primary': 10, 'secondary': 9.5, 'tertiary': 9, 'unclassified': 7, 'residential': 8, 'living_street': 6, 'service': 5}

rail = json.loads((DIST / 'railways.json').read_text())
tm = json.loads((DIST / 'regional-terrain.json').read_text())
terrain = np.frombuffer((DIST / 'regional-terrain.bin').read_bytes(), dtype='<i4').reshape(tm['height'], tm['width']) / 100
survey_path = pathlib.Path('/private/tmp/wainui-regional-survey/surface.npz')
survey = np.load(survey_path)['dem'] if survey_path.exists() else None


def bilinear(grid, u, v):
    u = min(grid.shape[1] - 1.001, max(0, u)); v = min(grid.shape[0] - 1.001, max(0, v)); i, j = int(u), int(v); fx, fz = u - i, v - j
    return [float(grid[j, i]), float(grid[j, i + 1]), float(grid[j + 1, i]), float(grid[j + 1, i + 1])], fx, fz


def ground(x, z):
    """Same blend as prepare_railways.ground(): survey DEM inside its window, regional grid outside."""
    c, fx, fz = bilinear(terrain, (x - tm['minX']) / tm['step'], (z - tm['minZ']) / tm['step'])
    coarse = c[0] * (1 - fx) * (1 - fz) + c[1] * fx * (1 - fz) + c[2] * (1 - fx) * fz + c[3] * fx * fz
    if survey is None: return coarse
    edge = min(x + 10500, z + 11500, -10500 + (survey.shape[1] - 1) * 4 - x, -11500 + (survey.shape[0] - 1) * 4 - z)
    if edge < 0: return coarse
    s, fx, fz = bilinear(survey, (x + 10500) / 4, (z + 11500) / 4)
    if min(s) < -1000: return coarse
    blend = min(1, edge / 200)
    return coarse * (1 - blend) + (s[0] * (1 - fx) * (1 - fz) + s[1] * fx * (1 - fz) + s[2] * (1 - fx) * fz + s[3] * fx * fz) * blend


# Roads: the local town map plus every regional tile, keyed by way id as geoworld.js merges them.
roads = {}
for e in json.loads((DIST / 'map.json').read_text()).get('elements', []):
    roads[e['id']] = e
for part in json.loads((DIST / 'regional-map.json').read_text())['parts']:
    for e in json.loads((DIST / part['file']).read_text())['elements']:
        roads[e['id']] = e
roads = {k: r for k, r in roads.items() if r.get('tags', {}).get('highway') and r['tags']['highway'] not in NOT_ROADS and r['tags'].get('area') != 'yes' and len(r.get('geometry', [])) > 1}

# OSM level-crossing node tags (barrier/light hints) where the caches are available.
crossing_tags = {}
for folder in ['wainui-regional-osm', 'wainui-upper-osm']:
    for path in pathlib.Path('/private/tmp', folder).glob('*.osm'):
        text = path.read_text(errors='ignore')
        for m in re.finditer(r'<node id="(\d+)"[^>]*>(.*?)</node>', text, re.S):
            if 'v="level_crossing"' in m.group(2) or 'v="crossing"' in m.group(2):
                crossing_tags[m.group(1)] = dict(re.findall(r'k="([^"]+)" v="([^"]*)"', m.group(2)))

# Rail graph over every track point; heights are shared by node id.
points, edges, track_of = {}, collections.defaultdict(list), {}
for t in rail['tracks']:
    for p in t['p']:
        points[p['node']] = p; track_of.setdefault(p['node'], t)
    for a, b in zip(t['p'], t['p'][1:]):
        d = max(.1, math.hypot(b['x'] - a['x'], b['z'] - a['z'])); edges[a['node']].append((b['node'], d)); edges[b['node']].append((a['node'], d))
base = {n: p['h'] for n, p in points.items()}
# Undo a previous run so the script stays idempotent.
for n, h in rail.get('gradeBase', {}).items():
    if n in base: base[n] = h

grid = collections.defaultdict(list)
for t in rail['tracks']:
    for i, (a, b) in enumerate(zip(t['p'], t['p'][1:])):
        for gx in range(int(min(a['x'], b['x']) // 50), int(max(a['x'], b['x']) // 50) + 1):
            for gz in range(int(min(a['z'], b['z']) // 50), int(max(a['z'], b['z']) // 50) + 1):
                grid[gx, gz].append((t, i))


def intersect(p1, p2, p3, p4):
    d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0])
    if abs(d) < 1e-9: return None
    t = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d
    u = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / d
    return (t, u) if 0 <= t <= 1 and 0 <= u <= 1 else None


def road_width(tags):
    hw = tags['highway'].replace('_link', '')
    if hw in PATHS: return 3
    try: lanes = int(tags.get('lanes', '0'))
    except ValueError: lanes = 0
    return max(CLASS_WIDTH.get(hw, 7), lanes * 3.4 + 1.5)


seeds, separations, level_nodes = {}, [], collections.defaultdict(list)
for r in roads.values():
    tags, g = r['tags'], r['geometry']
    if tags.get('bridge', 'no') != 'no' or tags.get('tunnel', 'no') != 'no' or tags.get('covered') == 'yes': continue
    path = tags['highway'] in PATHS
    for i in range(len(g) - 1):
        A, B = g[i], g[i + 1]
        for node in (A.get('node'), B.get('node')):
            if node in points and not track_of[node]['bridge'] and not track_of[node]['tunnel']:
                level_nodes[r['id'], node].append(i)
        seen = set()
        for gx in range(int(min(A['x'], B['x']) // 50), int(max(A['x'], B['x']) // 50) + 1):
            for gz in range(int(min(A['z'], B['z']) // 50), int(max(A['z'], B['z']) // 50) + 1):
                for t, j in grid.get((gx, gz), []):
                    if (id(t), j) in seen or not t['bridge']: continue
                    seen.add((id(t), j)); a, b = t['p'][j], t['p'][j + 1]
                    if A.get('node') in (a['node'], b['node']) or B.get('node') in (a['node'], b['node']): continue
                    hit = intersect((A['x'], A['z']), (B['x'], B['z']), (a['x'], a['z']), (b['x'], b['z']))
                    if not hit: continue
                    x, z = A['x'] + (B['x'] - A['x']) * hit[0], A['z'] + (B['z'] - A['z']) * hit[0]
                    rl, tl = math.hypot(B['x'] - A['x'], B['z'] - A['z']) or 1, math.hypot(b['x'] - a['x'], b['z'] - a['z']) or 1
                    sine = max(.25, abs(((B['x'] - A['x']) * (b['z'] - a['z']) - (B['z'] - A['z']) * (b['x'] - a['x'])) / rl / tl))
                    width = road_width(tags); span = (width / 2 + (1 if path else 2.5)) / sine
                    if any(s['track'] == t['id'] and math.hypot(s['x'] - x, s['z'] - z) < 4 for s in separations): continue
                    along = [0]
                    for p, q in zip(t['p'], t['p'][1:]): along.append(along[-1] + math.hypot(q['x'] - p['x'], q['z'] - p['z']))
                    separations.append({'x': round(x, 2), 'z': round(z, 2), 'track': t['id'], 'road': tags.get('name', ''), 'highway': tags['highway'], 'roadDx': round((B['x'] - A['x']) / rl, 4), 'roadDz': round((B['z'] - A['z']) / rl, 4), 'span': round(span, 2), 'roadHeight': round(ground(x, z), 2), 'path': path, '_t': t, '_at': along[j] + tl * hit[1], '_along': along})

# Prefer the game's graded road surface (needs node); fall back to the DEM where no road answers or it disagrees badly.
try:
    measured = json.loads(subprocess.run(['node', str(ROOT / 'scripts/lib/road_heights.mjs')], input=json.dumps([{'x': s['x'], 'z': s['z']} for s in separations]), capture_output=True, text=True, check=True, cwd=ROOT).stdout)
except (OSError, subprocess.CalledProcessError, ValueError):
    measured = [None] * len(separations); print('Road heights: node unavailable, using the DEM')
for s, h in zip(separations, measured):
    if h is not None and abs(h - s['roadHeight']) < 4: s['roadHeight'] = h
    s['need'] = round(s['roadHeight'] + (PATH_CLEARANCE if s.pop('path') else ROAD_CLEARANCE) + DECK_DEPTH, 2)
    # Seed every point of this bridge within the road corridor.
    t, at, along = s.pop('_t'), s.pop('_at'), s.pop('_along')
    for p, d in zip(t['p'], along):
        if abs(d - at) <= s['span'] + 4: seeds[p['node']] = max(seeds.get(p['node'], -1e9), s['need'])

# Work in lift above the existing profile, so a ramp adds at most RAMP_GRADE to the mapped grade, uphill or down.
need = {n: h - base[n] for n, h in seeds.items() if h > base[n]}
lift = {n: 0. for n in points}; queue = []
for n, e in need.items():
    lift[n] = e; heapq.heappush(queue, (-e, n))
while queue:
    e, n = heapq.heappop(queue); e = -e
    if e < lift[n] - 1e-9: continue
    for m, d in edges[n]:
        if e - RAMP_GRADE * d > lift[m] + 1e-6:
            lift[m] = e - RAMP_GRADE * d; heapq.heappush(queue, (-lift[m], m))

# Level crossings and tunnels keep their mapped level; a steeper added grade is allowed next to them.
pins = {node for (_, node) in level_nodes} | {n for n in points if track_of[n]['tunnel']}
ceiling = {n: math.inf for n in points}; queue = []
for n in pins:
    ceiling[n] = 0.; heapq.heappush(queue, (0., n))
while queue:
    e, n = heapq.heappop(queue)
    if e > ceiling[n] + 1e-9: continue
    for m, d in edges[n]:
        if e + PIN_GRADE * d < ceiling[m] - 1e-6:
            ceiling[m] = e + PIN_GRADE * d; heapq.heappush(queue, (ceiling[m], m))

extra = {n: min(lift[n], ceiling[n]) for n in points}
conflicts = [n for n, e in need.items() if extra[n] < e - .05]

# Round the crests without giving up clearance, leaving the ramp envelope, or moving pins.
moved = {n for n in points if extra[n] > 1e-3}
for _ in range(30):
    nxt = {}
    for n in moved:
        if n in pins: continue
        total = sum(1 / d for _, d in edges[n])
        if not total: continue
        avg = sum(extra[m] / d for m, d in edges[n]) / total
        nxt[n] = max(0, min(need.get(n, 0), ceiling[n]), min(ceiling[n], lift[n], .5 * extra[n] + .5 * avg))
    extra.update(nxt)
final = {n: base[n] + extra[n] for n in points}

for t in rail['tracks']:
    for p in t['p']: p['h'] = round(final[p['node']], 3)
for route in rail['routes']:
    for p in route['p']:
        if p.get('node') in final: p['h'] = round(final[p['node']], 3)
rail['gradeBase'] = {n: round(base[n], 3) for n in points if final[n] > base[n] + 1e-3}
rail['gradeSeparations'] = separations

# Level crossings: one entry per road crossing, grouping adjacent tracks.
crossings = []
for (road_id, node), segs in level_nodes.items():
    r = roads[road_id]; tags = r['tags']; g = r['geometry']; i = segs[0]
    idx = next(k for k, q in enumerate(g) if q.get('node') == node)
    a, b = g[max(0, idx - 1)], g[min(len(g) - 1, idx + 1)]
    rl = math.hypot(b['x'] - a['x'], b['z'] - a['z']) or 1; rdx, rdz = (b['x'] - a['x']) / rl, (b['z'] - a['z']) / rl
    p = points[node]; t = track_of[node]; k = next(k for k, q in enumerate(t['p']) if q['node'] == node)
    q0, q1 = t['p'][max(0, k - 1)], t['p'][min(len(t['p']) - 1, k + 1)]
    tl = math.hypot(q1['x'] - q0['x'], q1['z'] - q0['z']) or 1; tdx, tdz = (q1['x'] - q0['x']) / tl, (q1['z'] - q0['z']) / tl
    sine = max(.3, abs(rdx * tdz - rdz * tdx)); path = tags['highway'] in PATHS; width = road_width(tags)
    entry = {'x': p['x'], 'z': p['z'], 'h': round(final[node], 3), 'tdx': round(tdx, 4), 'tdz': round(tdz, 4), 'panel': round((width / 2 + .6) / sine, 2), 'electrified': t['electrified']}
    group = next((c for c in crossings if c['road'] == road_id and math.hypot(c['x'] - p['x'], c['z'] - p['z']) < 18), None)
    if group:
        group['tracks'].append(entry); continue
    osm = crossing_tags.get(node, {})
    barrier = osm.get('crossing:barrier', 'no') not in ('no', '') or (not path and t['electrified'] and tags['highway'] not in ('service', 'track'))
    crossings.append({'road': road_id, 'name': tags.get('name', ''), 'highway': tags['highway'], 'kind': 'path' if path else 'road', 'width': round(width, 2), 'rdx': round(rdx, 4), 'rdz': round(rdz, 4), 'barrier': bool(barrier), 'lights': not path or osm.get('crossing:light') == 'yes', 'x': p['x'], 'z': p['z'], 'tracks': [entry]})
for c in crossings:
    c['x'] = round(sum(t['x'] for t in c['tracks']) / len(c['tracks']), 3); c['z'] = round(sum(t['z'] for t in c['tracks']) / len(c['tracks']), 3); c['h'] = round(sum(t['h'] for t in c['tracks']) / len(c['tracks']), 3)
    # Extent along the road covered by the tracks, used for stop lines and post placement.
    offsets = [(t['x'] - c['x']) * c['rdx'] + (t['z'] - c['z']) * c['rdz'] for t in c['tracks']]
    c['across'] = round(max(abs(min(offsets)), abs(max(offsets))) + 2.2, 2)
    del c['road']
rail['levelCrossings'] = crossings
(DIST / 'railways.json').write_text(json.dumps(rail, separators=(',', ':')))
raised = [n for n in points if final[n] > base[n] + .05]
print(f'Grade separations: {len(separations)} road/path crossings under {len({s["track"] for s in separations})} rail bridges; {len(raised)} track points raised (max {max([final[n] - base[n] for n in raised] or [0]):.2f} m)')
print(f'Level crossings: {sum(c["kind"] == "road" for c in crossings)} road, {sum(c["kind"] == "path" for c in crossings)} path; {sum(c["barrier"] for c in crossings)} with barrier arms')
if conflicts: print('Clearance limited by nearby level crossings/tunnels at', len(conflicts), 'bridge points')
