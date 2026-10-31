import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.js';
import {buildHouse,houseStyles,selectHouseEntrances} from '../dist/house-interiors.js';
import {facadeProfile} from '../dist/appearance.js';
import {buildingFaces,createStreetIndex} from '../dist/building-faces.js';
import {planLargeHouseOpenings} from '../dist/large-house-facades.js';
import {createInteriors} from '../dist/interiors.js';
globalThis.document={createElement(){return{getContext(){return{fillRect(){},strokeRect(){},fillText(){}}}}}};
const streets=createStreetIndex({elements:[{tags:{highway:'residential'},geometry:[{x:900,z:-12},{x:3000,z:-12}]}]});
const buildings=Array.from({length:20},(_,id)=>{const x=1000+id*80,b={id,ground:0,eave:3.2,rings:[[[x,0],[x+20,0],[x+20,12],[x,12],[x,0]]]};b.profile=facadeProfile(b);b.faces=buildingFaces(b,streets);return b});
const world={buildings,ground:()=>0,walkHeight:()=>0,free:(x,z)=>z<0};
const entries=selectHouseEntrances(world,{x:1000,z:0});assert.equal(entries.length,6);assert.equal(new Set(entries.map(e=>e.buildingId)).size,6);
for(const e of entries){const b=buildings.find(b=>b.id===e.buildingId),door=planLargeHouseOpenings(b,{ground:()=>0,datum:0}).find(o=>o.kind==='door');assert.ok(Math.hypot(e.wallX-door.x,e.wallZ-door.z)<.08,'Entrance aligns with the actual facade door');assert.equal(e.residential,true);assert.equal(e.doorWidth,door.width)}
assert.equal(selectHouseEntrances({...world,free:()=>false},{x:1000,z:0}).length,0);
assert.equal(selectHouseEntrances({...world,water:{at:()=>({depth:1})}},{x:1000,z:0}).length,0);
assert.equal(selectHouseEntrances(world,{x:1000,z:0},0).length,0);
assert.ok(!selectHouseEntrances(world,{x:1000,z:0},6,{exclude:new Set([0])}).some(e=>e.buildingId===0));
assert.equal(selectHouseEntrances(world,{x:1000,z:0},6,{maxDistance:30}).length,1);
// Flood-fill free floor space: every furnished room must remain reachable from the entry.
for(const [kind]of houseStyles){const room=buildHouse(kind);assert.equal(room.rooms.length,6);assert.ok(room.clear(0,4.3));assert.equal(room.clear(6,0),false);
 for(const p of room.obstacles)assert.equal(room.clear(p.x,p.z),false,'Walls and furniture are solid');
 const step=.16,key=(i,j)=>i+','+j,queue=[[0,0]],visited=new Set([key(0,0)]);
 for(let n=0;n<queue.length;n++){const[i,j]=queue[n];for(const[di,dj]of [[1,0],[-1,0],[0,1],[0,-1]]){const a=i+di,b=j+dj,k=key(a,b);if(visited.has(k)||!room.clear(a*step,4.3+b*step))continue;visited.add(k);queue.push([a,b])}}
 for(const[x,z]of [[-3.5,1.1],[3.3,1.9],[-2,-2],[2.4,-1.7],[2.4,-4.8]])assert.ok(visited.has(key(Math.round(x/step),Math.round((z-4.3)/step))),kind+' has a reachable living/kitchen/bedroom/bathroom');
 room.scene.traverse(o=>{if(o.geometry?.attributes.position)assert.ok([...o.geometry.attributes.position.array].every(Number.isFinite))});
}
// Existing commercial rooms and house entrances coexist, with lazy room construction and safe return.
const camera=new T.PerspectiveCamera(),button={hidden:true},announced=[];
const interiors=createInteriors({scene:new T.Scene(),world,camera,origin:{x:1000,z:0},button,onEntrance:e=>announced.push(e)}),home=interiors.entrances.find(e=>e.residential);
assert.ok(home);assert.ok(announced.includes(home));camera.position.set(home.x,home.y,home.z);const outside=camera.position.clone();
const update=(dt,keys={},enabled=true)=>interiors.update(dt,{enabled,yaw:0,pitch:0,keys});update(0);assert.ok(button.textContent.includes('House'));assert.equal(interiors.interact(),true);assert.ok(interiors.name.includes('House'));const room=interiors.scene;
update(.5,{w:true});assert.equal(interiors.interact(),false,'Exit requires returning to the entry hall');
interiors.view.position.set(0,1.7,4.5);assert.equal(interiors.interact(),true);assert.deepEqual(camera.position,outside);update(0);assert.equal(interiors.interact(),true);assert.equal(interiors.scene,room,'Re-entering reuses the furnished scene');interiors.exit();update(0,{},false);assert.equal(interiors.interact(),false,'Paused/vehicle state cannot enter');
console.log('PASS: six aligned house entrances, access/water/distance/exclusion checks, three furnished styles, all rooms reachable, solid walls/furniture, shared room cache, door-only exit and exact outdoor return.');
