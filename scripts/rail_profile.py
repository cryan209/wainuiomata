"""Remove DEM sampling steps while retaining bridge/tunnel rail elevations."""
import math,statistics
def smooth_profiles(tracks,iterations=36):
 values={};edges={};fixed={}
 for track in tracks:
  for p in track['p']:
   values.setdefault(p['node'],[]).append(p['h'])
   if track['bridge'] or track['tunnel']:fixed[p['node']]=p['h']
  for a,b in zip(track['p'],track['p'][1:]):
   d=max(.1,math.hypot(b['x']-a['x'],b['z']-a['z']));edges.setdefault(a['node'],{})[b['node']]=1/d;edges.setdefault(b['node'],{})[a['node']]=1/d
 heights={key:statistics.median(v) for key,v in values.items()};heights.update(fixed)
 for _ in range(iterations):
  heights={key:fixed[key] if key in fixed else .3*h+.7*sum(heights[n]*w for n,w in edges.get(key,{}).items())/sum(edges[key].values()) if key in edges else h for key,h in heights.items()}
 for track in tracks:
  for p in track['p']:p['h']=round(heights[p['node']],3)
 return heights
