import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../dist/vendor/three.js';
import {createHydrology} from '../dist/rivers.js';

const read=name=>JSON.parse(fs.readFileSync(new URL('../dist/'+name,import.meta.url)));
// The lower Hutt catchment as first imported. The north/east grid adds upper headwaters (Eastern/Western Hutt, upper Akatārawa).
const HUTT_CATCHMENT=['213661648','213661652','29103731','30261394','601472602','29085609','216991480'];
const features=read('regional-waterways.json').filter(f=>
 /Hutt River|Mangaroa River|Whakatīkei River|Akatārawa River|Pākuratahi River/.test(f.tags.name||'')&&f.tags.waterway==='river'&&HUTT_CATCHMENT.includes(f.id));
const meta=read('regional-terrain.json'),data=fs.readFileSync(new URL('../dist/regional-terrain.bin',import.meta.url));
const terrain=new Int32Array(data.buffer,data.byteOffset,data.byteLength/4);
function raw(x,z){
 const u=T.MathUtils.clamp((x-meta.minX)/meta.step,0,meta.width-1.000001),v=T.MathUtils.clamp((z-meta.minZ)/meta.step,0,meta.height-1.000001);
 const i=Math.floor(u),j=Math.floor(v),du=u-i,dv=v-j,k=j*meta.width+i;
 return (du+dv<=1?terrain[k]+du*(terrain[k+1]-terrain[k])+dv*(terrain[k+meta.width]-terrain[k]):terrain[k+meta.width+1]+(1-du)*(terrain[k+meta.width]-terrain[k+meta.width+1])+(1-dv)*(terrain[k+1]-terrain[k+meta.width+1]))/100-meta.datum;
}
const scene=new T.Scene(),hydro=createHydrology(scene,features,raw);
assert.equal(hydro.rivers.length,features.length,'All regional river ways survive');
for(const feature of features){
 const river=hydro.rivers.find(r=>r.mapPoints===feature.geometry);
 assert.ok(river,feature.tags.name);
 assert.deepEqual([river.p[0].x,river.p[0].z],[feature.geometry[0].x,feature.geometry[0].z]);
 assert.deepEqual([river.p.at(-1).x,river.p.at(-1).z],[feature.geometry.at(-1).x,feature.geometry.at(-1).z]);
 for(const point of river.p.filter((_,i)=>i%100===0)){
  assert.ok(hydro.waterAt(point.x,point.z)?.depth>0,'Mapped channels have water physics');
  assert.ok(hydro.nearChannel(point.x,point.z,4),'Vegetation clearance follows regional channels');
  assert.ok(hydro.terrainGround(point.x,point.z)<hydro.channel(point.x,point.z).y,'Terrain clears the water surface');
 }
}
const hutt=hydro.rivers.filter(r=>r.name.includes('Hutt River'));
assert.equal(hutt.length,3);
for(const a of hutt)for(const b of hutt)if(a!==b&&a.p.at(-1).node===b.p[0].node)
 assert.equal(a.p.at(-1).y,b.p[0].y,'Hutt River sections meet at the same water level');
const upper=hutt.flatMap(r=>r.p).filter(p=>p.x>8500&&p.z<-14000);
assert.ok(upper.length>100,'Upper Hutt has a continuous sampled channel');
const camera=upper[Math.floor(upper.length/2)];
hydro.update(.1,camera,{day:1});
assert.ok(hydro.stats.chunks>0,'Upper Hutt river meshes stream near the camera');
scene.traverse(o=>{if(o.geometry?.attributes.position)assert.ok(o.geometry.attributes.position.array.every(Number.isFinite));});
await new Promise(resolve=>setTimeout(resolve,110));
hydro.update(.1,{x:100000,z:100000},{day:1});
assert.equal(hydro.stats.chunks,0,'Distant regional river meshes unload');
console.log('PASS: complete Hutt River and tributaries, measured terrain carving, water physics, vegetation clearance, confluences and regional mesh streaming.');
