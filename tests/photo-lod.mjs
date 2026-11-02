import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TIERS} from '../dist/quality.js';
const dist=new URL('../dist/',import.meta.url);
function webpSize(file){const b=fs.readFileSync(new URL(file,dist)),kind=b.toString('latin1',12,16);
 if(kind==='VP8X')return[1+b.readUIntLE(24,3),1+b.readUIntLE(27,3)];
 if(kind==='VP8L'){const bits=b.readUInt32LE(21);return[1+(bits&0x3fff),1+((bits>>14)&0x3fff)]}
 return[b.readUInt16LE(26)&0x3fff,b.readUInt16LE(28)&0x3fff]}
const imagery=['roof-imagery.json','roof-imagery-wide.json'].map(f=>JSON.parse(fs.readFileSync(new URL(f,dist))).image),regional=JSON.parse(fs.readFileSync(new URL('ground-regional.json',dist)));
for(const image of[...imagery,regional.overview.image,regional.overviewOuter.image]){
 const[w,h]=webpSize(image);
 for(const[level,d]of[['half',2],['quarter',4]]){const copy=image.replace(/\.webp$/,`-${level}.webp`);assert.ok(fs.existsSync(new URL(copy,dist)),`${copy} exists (scripts/make_photo_levels.sh)`);
  assert.deepEqual(webpSize(copy),[Math.ceil(w/d),Math.ceil(h/d)],`${copy} is 1/${d} of ${image}; rerun scripts/make_photo_levels.sh`)}
}
assert.deepEqual(TIERS.map(t=>t.photos),['quarter','half','full','full'],'Low loads quarter-resolution photos, Reduced half');
console.log('PASS photo LOD: half and quarter copies match every large photo; lower tiers use them');
