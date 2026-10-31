import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../dist/vendor/three.js';
import {createHydrology} from '../dist/rivers.js';
import {createWaterWorld} from '../dist/water-world.js';

const polygon=(id,tags,points)=>({id,tags:{natural:'water',...tags},geometry:points.map(([x,z])=>({x,z}))});
const ring=[[12000,-16000],[12040,-16000],[12040,-15960],[12000,-15960],[12000,-16000]];
const scene=new T.Scene();scene.fog=new T.Fog('#aaa',100,1000);
const hydro=createHydrology(scene,[polygon(1,{water:'lake',name:'Lake'},ring),polygon(2,{covered:'yes'},ring),polygon(3,{},ring.slice(0,-1)),polygon(4,{water:'river'},ring)],()=>40);
assert.equal(hydro.inland.areas.length,1,'Only closed, exposed standing-water outlines become lakes');
const water=hydro.waterAt(12020,-15980);
assert.equal(water.kind,'lake');assert.equal(water.y,39.88);assert.ok(water.depth>2.5);assert.equal(water.flow.speed,0);
assert.equal(hydro.ground(12020,-15980),water.bed);assert.ok(hydro.terrainGround(12020,-15980)<water.y);
assert.ok(hydro.waterAt(12001,-15980).depth<water.depth,'Lake banks become shallow');
assert.equal(hydro.waterAt(11999,-15980),null,'Water stays within the mapped shore');
assert.equal(hydro.nearChannel(11997,-15980,4),true);assert.equal(hydro.nearChannel(11990,-15980,4),false);
const world={hydro,rawGround:()=>40,network:{onBridge:()=>false}},waterWorld=createWaterWorld(scene,world),camera=new T.PerspectiveCamera();
camera.position.set(12020,water.y-.5,-15980);waterWorld.update(.1,camera,{day:1});assert.equal(waterWorld.underwater,true);
camera.position.y=water.y+2;waterWorld.update(.1,camera,{day:1});assert.equal(waterWorld.underwater,false);
hydro.update(.1,{x:12020,z:-15980},{day:1});assert.equal(hydro.stats.waterAreas,1);
const mesh=scene.children.find(o=>o.userData.surface==='inland-water');assert.ok(mesh);
for(const y of Array.from(mesh.geometry.attributes.position.array).filter((_,i)=>i%3===1))assert.ok(Math.abs(y-water.y)<.0001,'Surface is level');
assert.ok(mesh.geometry.attributes.position.array.every(Number.isFinite));
await new Promise(resolve=>setTimeout(resolve,110));hydro.update(.1,{x:0,z:0},{day:1});assert.equal(hydro.inland.chunks,0);

const features=JSON.parse(fs.readFileSync(new URL('../dist/regional-waterways.json',import.meta.url)));
const regional=createHydrology(new T.Scene(),features.filter(f=>f.tags.natural==='water'),()=>10);
for(const name of ['Lake Kohangatera','Lake Kohangapiripiri','Lower Stuart Macaskill Reservoir','Upper Stuart Macaskill Reservoir','Lower Karori Reservoir','Butterfly Lake','Te Papa Lagoon']){
 const area=regional.inland.areas.find(a=>a.name===name);assert.ok(area,name);
 // A triangulated interior sample also works for concave shore outlines.
 const points=area.ring.map(p=>new T.Vector2(p.x,p.z)),triangles=T.ShapeUtils.triangulateShape(points,[]);
 assert.ok(triangles.length,name+' triangulates');
 const tri=triangles[0].map(i=>points[i]),x=tri.reduce((s,p)=>s+p.x,0)/3,z=tri.reduce((s,p)=>s+p.y,0)/3;
 assert.equal(regional.waterAt(x,z)?.kind,'lake',name+' has water physics');
 assert.ok(regional.nearChannel(x,z,2),name+' excludes vegetation');
}
console.log('PASS: mapped regional lakes/ponds/reservoirs, closed-outline exclusions, level surfaces, shallow shores, bed carving, water physics, underwater visibility and mesh cleanup.');
