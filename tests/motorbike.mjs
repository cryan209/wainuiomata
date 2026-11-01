import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.js';
import {createMotorbike,MOTO_VARIANTS} from '../dist/motorbike.js';
// Flat ground at y=3 with a ramp up to a crest at z=-60, then a cliff back down to the flat; a wall at z=-200.
const ground=(x,z)=>z<-40&&z>-60?3+(-40-z)*.3:3;
const world={bounds:{minX:-500,maxX:500,minZ:-500,maxZ:500},free:(x,z)=>z>-200,walkHeight:(x,z)=>ground(x,z)};
const run=(m,keys,seconds,dt=1/60)=>{for(let t=0;t<seconds;t+=dt)m.update(dt)};
for(const variant of ['road','dirt']){
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(),keys={},m=createMotorbike({scene,world,camera,keys,variant});
 assert.equal(m.active,false);m.enter({x:0,y:5,z:0},0);assert.ok(m.active&&m.model.visible);assert.equal(m.position.y,3);
 keys.w=true;run(m,keys,1.5);assert.ok(m.speed>8,variant+' accelerates');assert.ok(m.position.z<0,'Forward is -z');assert.ok(m.soundState().rpm>MOTO_VARIANTS[variant].idle);
 // Crest at speed launches the bike; it lands back on the ground.
 let flew=false,peak=0;for(let t=0;t<4;t+=1/60){m.update(1/60);if(m.airborne){flew=true;peak=Math.max(peak,m.position.y-ground(m.position.x,m.position.z))}}
 assert.ok(flew&&peak>.5,variant+' gets airtime off the crest ('+peak.toFixed(2)+' m)');
 run(m,keys,4);assert.equal(m.airborne,false);assert.ok(Math.abs(m.position.y-ground(m.position.x,m.position.z))<.01,'Lands on the ground');
 assert.ok(m.position.z>-200,'Walls stop the bike');assert.ok([m.position.x,m.position.y,m.position.z,...camera.position.toArray()].every(Number.isFinite));
 keys.w=false;keys[' ']=true;run(m,keys,8);assert.ok(Math.abs(m.speed)<.3,'Brakes stop the bike');keys[' ']=false;
 keys.w=true;keys.d=true;const yaw=m.yaw;run(m,keys,1);assert.ok(m.yaw<yaw,'Right steer turns right');keys.d=false;
 keys.e=true;run(m,keys,1);assert.ok(m.model.children[0].children.find(c=>c.rotation.x>.2),'E lifts a wheelie');keys.e=false;keys.w=false;
 const spot=m.exit();assert.ok(spot&&!m.active&&m.parked&&m.model.visible,'Exit parks the bike');assert.equal(m.soundState(),null);assert.equal(m.exit(),null);
}
const road=MOTO_VARIANTS.road,dirt=MOTO_VARIANTS.dirt;assert.ok(road.boost>dirt.boost&&dirt.stepUp>road.stepUp&&dirt.landLoss<road.landLoss,'Road bike is faster; dirt bike climbs and lands better');
console.log('PASS: road and dirt motorbikes accelerate, steer, brake, jump crests, land, wheelie, collide and park.');
