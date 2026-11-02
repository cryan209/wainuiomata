import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.js';
import {planUtilityScenery,utilityContains,utilityDestinations} from '../dist/utility-scenery.js';
import {createStreetFurniture} from '../dist/street-furniture.js';
const road={id:'utilities-test',name:'Utility Test Street',type:'residential',width:6.4,pavementWidth:8.6,p:[new T.Vector2(0,0),new T.Vector2(0,4000)],tags:{'power:location':'underground'}};
const world={network:{roads:[road],junctions:[],at:(x,z)=>({r:road,d:Math.abs(x)}),height:()=>0,junctionAt:()=>false},walkHeight:()=>0,free:()=>true,hydro:{channel:()=>null},railways:{at:()=>null}};
const poles=Array.from({length:100},(_,id)=>({id,name:road.name,r:road,supply:'underground',x:3.52,z:id*34+10,dx:0,dz:1,nx:1,nz:0,i:0,t:0}));
const plan=planUtilityScenery(poles,world);
assert.deepEqual(planUtilityScenery(poles,world),plan,'Repeatable placements');
assert.equal(new Set(plan.map(p=>p.kind)).size,5,'Cabinets, pillars, transformers and both access-cover styles are present');
for(const p of plan){
 assert.ok(p.x-p.depth/2>road.width/2+.55,'Equipment footprint leaves the road clear');
 assert.equal(utilityContains(p,p.x,p.z),p.solid,'Cabinets are solid; flush covers can be walked over');
 assert.equal(utilityContains(p,p.x+10,p.z+10),false);
 for(const q of plan)if(p!==q)assert.ok(Math.hypot(p.x-q.x,p.z-q.z)>=10,'Fixtures do not cluster');
}
const views=utilityDestinations(plan,world);assert.equal(views.size,1);assert.ok(Number.isFinite(views.get('verge-utilities').yaw));
assert.equal(utilityDestinations(plan,{...world,free:()=>false}).size,0,'No obstructed preview destination');
assert.ok(!planUtilityScenery(poles.map(p=>({...p,supply:'overhead'})),world).some(p=>p.kind==='transformer'),'Ground transformers belong to underground supply');
for(const patch of [
 {free:()=>false},
 {hydro:{channel:()=>({y:0})}},
 {railways:{at:()=>({d:2})}},
 {walkHeight:(x,z)=>z},
 {network:{...world.network,junctionAt:()=>true}},
 {network:{...world.network,at:()=>null}},
 {network:{...world.network,at:()=>({r:road,d:1})}},
 {network:{...world.network,onBridge:()=>true}},
])assert.equal(planUtilityScenery(poles,{...world,...patch}).length,0,'Obstructed, wet, railway, steep, junction and bridge sites stay empty');
assert.equal(planUtilityScenery(poles.map(p=>({...p,r:{...road,bridge:true}})),world).length,0);
// Validate real chunk integration, shared geometry, pre-stream collisions and cleanup.
let cornerBlock=null;world.free=(x,z)=>!cornerBlock||x<=cornerBlock.x+.05||z<=cornerBlock.z+.05;
const scene=new T.Scene(),furniture=createStreetFurniture(scene,world),solid=furniture.utilities.find(p=>p.solid&&p.z<200),cover=furniture.utilities.find(p=>!p.solid);
assert.ok(solid&&cover);
assert.equal(furniture.free(solid.x,solid.z),false,'Cabinet collisions apply before streaming');
cornerBlock=solid;assert.equal(furniture.free(solid.x,solid.z),true,'A later corner obstruction suppresses cabinet collisions too');cornerBlock=null;
assert.equal(furniture.free(cover.x,cover.z),true,'Flat covers are passable');
assert.equal(furniture.parkingClear({x:solid.x,z:solid.z,dx:0,dz:1},{width:1.8,length:4.8}),false,'Parked cars clear cabinets');
furniture.update({x:solid.x,y:2,z:solid.z});while(furniture.stats.building)furniture.update({x:solid.x,y:2,z:solid.z});
assert.ok(furniture.stats.utilities>0,'Nearby utilities load');
const groups=scene.children.filter(o=>o.name.startsWith('Street furniture'));
assert.ok(groups.length);
assert.ok(groups.every(g=>g.children.filter(o=>o.material?.vertexColors).length===1),'Equipment shares the opaque furniture batch');
scene.traverse(o=>{if(o.geometry?.attributes.position)assert.ok([...o.geometry.attributes.position.array].every(Number.isFinite))});
await new Promise(resolve=>setTimeout(resolve,135));furniture.update({x:10000,y:2,z:10000});assert.equal(furniture.stats.utilities,0);
furniture.dispose();assert.equal(scene.children.length,0);
console.log('PASS: five utility styles, deterministic verge placement, underground transformers, obstacle/water/rail/slope/junction/bridge exclusions, solid cabinets, passable covers, parking clearance, shared batches and streaming disposal.');
