// Regional road ways ship as 10km region files listed by regional-map.json (see scripts/lib/regional_map.py),
// keeping every file well under static-host size limits. Ways carry their original position (i) so the merged
// list keeps the order the single file had.
export function assembleRegionalMap(index,parts){const elements=parts.flatMap(p=>p.elements).sort((a,b)=>a.i-b.i);for(const e of elements)delete e.i;return{bounds:index.bounds,elements}}
