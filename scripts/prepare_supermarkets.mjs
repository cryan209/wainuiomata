import fs from 'node:fs';
import {playerCoordinates} from '../dist/astronomy.js';
const root=new URL('../dist/',import.meta.url),stores=new Map();
for(const file of fs.readdirSync(new URL('region-chunks/',root)).filter(f=>f.endsWith('.json'))){
 for(const b of JSON.parse(fs.readFileSync(new URL('region-chunks/'+file,root))).buildings||[]){
  if(!/^(Countdown|Woolworths|New World|PAK'nSAVE)\b/i.test(b.name||''))continue;
  const ring=b.rings[0];let twice=0;for(let i=1;i<ring.length;i++)twice+=ring[i-1][0]*ring[i][1]-ring[i][0]*ring[i-1][1];const area=Math.abs(twice)/2;
  if(area<300)continue;const old=stores.get(b.name);if(old&&old.area>=area)continue;
  stores.set(b.name,{id:'survey-'+b.id,buildingId:b.id,name:b.name,x:ring.reduce((a,p)=>a+p[0],0)/ring.length,z:ring.reduce((a,p)=>a+p[1],0)/ring.length,area});
 }
}
// OSM way 960045397, retrieved 2026-10-31 through the public map API.
// The older survey's named Wainuiomata supermarket is at a different footprint.
const p=JSON.parse(fs.readFileSync(new URL('data/supermarket-points.json',import.meta.url)));let x=0,z=0;
for(let i=0;i<6;i++){const a=playerCoordinates(x,z),b=playerCoordinates(x+1,z),c=playerCoordinates(x,z+1),u=p.lat-a.lat,v=p.lon-a.lon,det=(b.lat-a.lat)*(c.lon-a.lon)-(c.lat-a.lat)*(b.lon-a.lon);x+=(u*(c.lon-a.lon)-v*(c.lat-a.lat))/det;z+=((b.lat-a.lat)*v-(b.lon-a.lon)*u)/det;}
const sites=[{...p,x,z},...[...stores.values()].map(({area,...s})=>s)].sort((a,b)=>a.name.localeCompare(b.name));
fs.writeFileSync(new URL('supermarket-sites.js',root),'// Named LINZ building footprints and OSM supermarket coordinates. See scripts/prepare_supermarkets.mjs.\nexport const supermarketSites='+JSON.stringify(sites,null,2)+';\n');
console.log(`Prepared ${sites.length} mapped supermarket sites`);
