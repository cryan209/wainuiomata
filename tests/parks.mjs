import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../dist/vendor/three.js';
import {createParks,planPark,inside,edgeDistance,orientedRect,fencedDogPark} from '../dist/parks.js';
import {createOpenSpaces} from '../dist/open-spaces.js';
const read=name=>JSON.parse(fs.readFileSync(new URL('../dist/'+name,import.meta.url)));
const dogParks=read('dog-parks.json'),open=read('open-spaces.json'),flat=()=>0;
const main=dogParks.features.find(f=>f.id==='les-dalton-main'),small=dogParks.features.find(f=>f.id==='les-dalton-small');
assert.ok(main&&small,'Les Dalton Dog Park enclosures are packaged');
assert.ok(dogParks.features.filter(f=>f.id.startsWith('way-')).length>=10,'Mapped OSM dog parks are packaged');
// Les Dalton sits beside the Hill Road at the foot of Waiu Street, clear of the mountain-bike hub paddock.
const [gx,gz]=main.gate;assert.ok(gx>-1480&&gx<-1440&&gz>-1160&&gz<-1140,'Gate is at the shared-path junction');
assert.ok(!inside(main.rings[0],-1347,-1402),'The bike-park shelter paddock is not mistaken for the dog park');

const plan=planPark(main,{height:flat});
assert.ok(fencedDogPark(main)&&plan.panels.length>100,'The main enclosure is fully fenced');
assert.ok(plan.dogs>=4&&plan.walkers>=1,'Dogs and walkers populate the large enclosure');
assert.equal(plan.signs.length,1);assert.match(plan.signs[0].lines[0],/LES DALTON DOG PARK/);
const g=plan.gate,blocked=(p,x,z)=>p.colliders.some(c=>c.a&&Math.hypot(x-c.a[0],z-c.a[1])>=0&&(()=>{const dx=c.b[0]-c.a[0],dz=c.b[1]-c.a[1],l=dx*dx+dz*dz||1,t=Math.max(0,Math.min(1,((x-c.a[0])*dx+(z-c.a[1])*dz)/l));return Math.hypot(x-c.a[0]-t*dx,z-c.a[1]-t*dz)<c.r})());
assert.ok(!blocked(plan,g.x,g.z),'The gate opening is walkable');
// Walk the boundary: every point away from the gate is fenced.
const ring=main.rings[0];let fenced=0,total=0;for(let i=1;i<ring.length;i++)for(let t=.1;t<1;t+=.2){const x=ring[i-1][0]+(ring[i][0]-ring[i-1][0])*t,z=ring[i-1][1]+(ring[i][1]-ring[i-1][1])*t;if(Math.hypot(x-g.x,z-g.z)<1.5)continue;total++;if(blocked(plan,x,z))fenced++}
assert.equal(fenced,total,'No gaps in the fence besides the gate');
const smallPlan=planPark(small,{height:flat});assert.ok(smallPlan.smallDogs&&smallPlan.dogs===2&&smallPlan.panels.length>30,'Small-dog area is fenced with small dogs');
const beach=dogParks.features.find(f=>/beach/i.test(f.name));assert.ok(beach&&!fencedDogPark(beach)&&planPark(beach,{height:flat}).panels.length===0,'Open beach exercise zones are not fenced');

// Sports fields, playgrounds and lawns.
const pitch=open.features.find(f=>f.name==='Frederick Wise 1'),pitchPlan=planPark(pitch,{height:flat}),rect=orientedRect(pitch.rings[0]);
assert.ok(rect.length>rect.width&&pitchPlan.boxes.filter(b=>b.m==='line').length>20,'Pitch markings follow the field');
assert.ok(pitchPlan.boxes.filter(b=>b.m==='white'&&b.h>2).length>=4,'Both ends have goalposts');
const playground=open.features.find(f=>f.name==='Parkway Junior Playground'),playPlan=planPark(playground,{height:flat});
assert.ok(playPlan.boxes.some(b=>b.m==='rubber')&&playPlan.boxes.length>25&&playPlan.colliders.length>3,'Playground has safety surface and solid equipment');
const lawn=open.features.find(f=>f.name==='Hugh Sinclair Park'&&f.rings[0].length>40),lawnPlan=planPark(lawn,{height:flat});
assert.ok(lawnPlan.boxes.some(b=>b.m==='timber')&&lawnPlan.signs.length===1,'Named parks receive benches and a name sign');
for(const p of [plan,pitchPlan,playPlan,lawnPlan])for(const c of p.colliders)if(!c.a)assert.ok(edgeDistance(p.ring,c.x,c.z)<60,'Furniture stays with its park');
assert.deepEqual(planPark(main,{height:flat}),plan,'Plans are deterministic');

// Dog parks join the open-space set, so trees are kept off the lawn.
open.features.push(...dogParks.features);const spaces=createOpenSpaces(open);
assert.equal(spaces.at(-1435,-1100)?.id,'les-dalton-main');assert.equal(spaces.allows(-1435,-1100),false);

// Streamed runtime: furniture, collisions and dogs that never leave their enclosure.
const scene=new T.Scene(),parks=createParks(scene,{features:spaces.features,height:flat,clear:()=>true,roadDistance:()=>Infinity});
const player=new T.Vector3(g.x+g.nx*6,0,g.z+g.nz*6);parks.update(player,.016,null);
assert.ok(parks.plans().some(p=>p.id==='les-dalton-main'),'Nearby dog park streams in');assert.ok(parks.dogs>=6,'Dogs spawn near the player');
assert.equal(parks.free(g.x,g.z),true,'Gate stays open to walkers');
const post=plan.colliders.find(c=>c.a);assert.equal(parks.free((post.a[0]+post.b[0])/2,(post.a[1]+post.b[1])/2),false,'Fences block walking');
assert.equal(parks.free((post.a[0]+post.b[0])/2,(post.a[1]+post.b[1])/2,200),true,'Flight passes over fences');
for(let i=0;i<1800;i++)parks.update(player,1/30,i>900?player:null);
const dogs=scene.children.find(m=>m.isInstancedMesh&&m.count>0&&m.instanceColor);assert.ok(dogs,'Dogs render with coat colours');
const centre=new T.Vector3(),pos=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3(),mtx=new T.Matrix4();
for(let i=0;i<dogs.count;i+=12){dogs.getMatrixAt(i,mtx);mtx.decompose(pos,q,s);centre.copy(pos);assert.ok(inside(main.rings[0],pos.x,pos.z)||inside(small.rings[0],pos.x,pos.z),'Dogs stay inside the fence')}
assert.ok(parks.destinations().some(([id,p])=>id==='park-les-dalton'&&!inside(main.rings[0],p.x,p.z)),'Travel arrives outside the gate');
parks.update(new T.Vector3(5000,0,5000),.016,null);for(let i=0;i<3;i++)parks.update(new T.Vector3(5000,0,5000),.5,null);assert.equal(parks.dogs,0,'Dogs are released when leaving the area');
console.log('Parks: furniture, pitches, playgrounds, Les Dalton fences, gate access and dogs verified');
