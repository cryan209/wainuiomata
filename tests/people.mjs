import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.js';
import {createPeople} from '../dist/people.js';
import {CLASSICS} from '../dist/classic-cars.js';
const road={id:'street',type:'residential',name:'Queen Street',width:8,pavementWidth:10.2,tags:{},p:[new T.Vector2(0,0),new T.Vector2(0,160)],sharedSegments:new Map()};
const world={network:{roads:[road],height:()=>0,at:(x,z)=>({r:road,d:Math.abs(x),i:0,t:z/160})},free:(x,z)=>!(x>0&&z>30&&z<45),railways:{at:(x,z)=>({d:Math.abs(z-70),y:0})}};
const cars=[{index:0,model:CLASSICS[0],parked:true,position:{x:4.55,y:0,z:25},yaw:0,fleetMatrix:new T.Matrix4().makeTranslation(4.55,0,25)},{index:1,model:CLASSICS[1],position:{x:0,y:0,z:80},yaw:0,fleetMatrix:new T.Matrix4().makeTranslation(0,0,80)}];
const scene=new T.Scene(),crowd=createPeople(scene,world,{cars},{count:32}),camera={x:0,y:2,z:40};crowd.update(0,camera);assert.equal(crowd.people.length,32,'Local routes populate the requested crowd');assert.equal(scene.children.length,7,'People and vehicle occupants share seven instanced draws');
const initial=crowd.people.map(p=>({...p.position}));for(let i=0;i<600;i++)crowd.update(1/60,camera);
assert.ok(crowd.people.some((p,i)=>Math.hypot(p.position.x-initial[i].x,p.position.z-initial[i].z)>1),'Pedestrians walk');
for(const p of crowd.people){assert.ok(Math.abs(p.position.x)>4.25,'People stay off carriageways');assert.ok(world.free(p.position.x,p.position.z),'People avoid buildings');assert.ok(Math.abs(p.position.z-70)>=2.4,'People avoid tracks');assert.ok(!(Math.abs(p.position.x-4.55)<1.6&&Math.abs(p.position.z-25)<3.1),'People avoid the parked car');assert.ok(p.t>=p.route.lo&&p.t<=p.route.hi,'Walkers stay within safe path runs')}
for(let i=0;i<crowd.people.length;i++)for(let j=0;j<i;j++)assert.ok(Math.hypot(crowd.people[i].position.x-crowd.people[j].position.x,crowd.people[i].position.z-crowd.people[j].position.z)>=.67,'Walkers yield before overlapping');
const paused=scene.children.map(m=>Array.from(m.instanceMatrix.array));crowd.update(0,camera);assert.deepEqual(scene.children.map(m=>Array.from(m.instanceMatrix.array)),paused,'Pause preserves poses');
for(const mesh of scene.children){assert.ok([...mesh.instanceMatrix.array].every(Number.isFinite));assert.ok(mesh.count<=mesh.instanceMatrix.count)}
crowd.update(.05,{x:10000,y:2,z:10000});assert.equal(crowd.people.length,0,'Distant pedestrians are released');assert.ok(scene.children.every(m=>m.count===0),'Distant occupants and walkers are culled');crowd.dispose();assert.equal(scene.children.length,0);
console.log('PASS: safe footpath placement, walking, road/building/rail/car avoidance, frozen pause poses, seven instanced batches, occupants and distance culling.');
