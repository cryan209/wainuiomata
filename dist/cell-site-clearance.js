// Filled once from the same RSM snapshot the renderer uses, before vegetation is planted.
const cells=new Map();
export function setCellSiteClearance(sites){cells.clear();for(const site of sites){if(site.mount==='rooftop')continue;const key=Math.floor(site.x/100)+','+Math.floor(site.z/100);if(!cells.has(key))cells.set(key,[]);cells.get(key).push(site)}}
export function cellSiteVegetationClear(x,z,radius=0){const range=Math.max(1,Math.ceil((radius+5)/100));for(let ix=-range;ix<=range;ix++)for(let iz=-range;iz<=range;iz++)for(const s of cells.get((Math.floor(x/100)+ix)+','+(Math.floor(z/100)+iz))||[])if(Math.hypot(x-s.x,z-s.z)<radius+(s.mount==='lattice'?4:2))return false;return true}
