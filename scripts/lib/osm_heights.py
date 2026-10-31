"""Heights for official building footprints from overlapping OSM buildings.
A LINZ outline often merges a tower with its podium or annex, and OSM may map them separately. Taking whichever OSM
building happened to cover the outline's centre point built 60–80m towers as 9m sheds, so the outline takes the tallest
OSM building that covers a real share of it, falling back to the centre point only when none does.
Towers are often mapped as building:part ways inside a height-less outline (Plimmer Tower: an 80m part over its carpark).
PartIndex.split cuts a footprint into one piece per ground-standing part with its own height, plus the remainder.
"""
from shapely.geometry import Polygon
from shapely.strtree import STRtree
from shapely.ops import unary_union
SHARE=.4
def tag_height(tags):
 """Metres from height or building:levels. A height tag far below the levels count (the Beehive: height=7, 10 levels)
 is a mistyped tag, so the levels win. None when neither is usable."""
 def num(v):
  try:return float(str(v).replace('m','').strip())
  except (TypeError,ValueError):return None
 height,levels=num(tags.get('height')),num(tags.get('building:levels'))
 if levels and (not height or height<levels*2):height=levels*3.2
 return height if height and 2<height<220 else None
class HeightIndex:
 def __init__(self,polys,heights):self.polys=polys;self.heights=heights;self.tree=STRtree(polys)
 def match(self,footprint):
  near=[int(i) for i in self.tree.query(footprint)]
  shared=[self.heights[i] for i in near if self.polys[i].intersection(footprint).area>=SHARE*footprint.area]
  if shared:return max(shared)
  point=footprint.representative_point();covering=[self.heights[i] for i in near if self.polys[i].covers(point)]
  return max(covering) if covering else None
def osm_polygon(points):
 """points: [(x,z),...] in game coordinates. None for degenerate ways."""
 if len(points)<4:return None
 poly=Polygon(points).buffer(0)
 return None if poly.is_empty else poly
class PartIndex:
 """building:part ways that stand on the ground (no min_height), with their heights."""
 def __init__(self,polys,heights):self.polys=polys;self.heights=heights;self.tree=STRtree(polys) if polys else None
 def split(self,footprint):
  """[(piece, height)] for parts inside footprint, tallest first, plus (remainder, None); [] when no part belongs to it.
  A part belongs when most of it lies inside, or it covers most of the footprint. Pieces may overlap: walls start at the
  ground, so a taller part simply rises out of a lower one."""
  if not self.tree:return []
  pieces=[]
  for i in self.tree.query(footprint):
   i=int(i);piece=self.polys[i].intersection(footprint)
   if piece.area>=8 and (piece.area>=.5*self.polys[i].area or piece.area>=.5*footprint.area):pieces.append((piece,self.heights[i]))
  if not pieces:return []
  pieces.sort(key=lambda q:-q[1]);rest=footprint.difference(unary_union([q for q,_ in pieces]))
  return [(q,h) for piece,h in pieces for q in getattr(piece,'geoms',[piece]) if q.geom_type=='Polygon' and q.area>=8]+[(q,None) for q in getattr(rest,'geoms',[rest]) if q.geom_type=='Polygon' and q.area>=8]
