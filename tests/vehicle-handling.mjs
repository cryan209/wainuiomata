import assert from 'node:assert/strict';
import {CLASSICS} from '../dist/classic-cars.js';
import {handlingFor} from '../dist/vehicle-handling.js';
import {stepCar} from '../dist/vehicle-physics.js';
const world={bounds:{minX:-10000,maxX:10000,minZ:-10000,maxZ:10000},free:()=>true,walkHeight:()=>0};
const car=id=>({model:CLASSICS.find(m=>m.id===id),position:{x:0,y:0,z:0},yaw:0,velocity:0});
const run=(c,keys,seconds,w=world)=>{for(let i=0;i<seconds*120;i++)stepCar(c,keys,1/120,w);return c};
const skyline=run(car('skyline'),{w:true},5),wagon=run(car('corolla-wagon'),{w:true},5),bus=run(car('city-bus'),{w:true},5);
assert.ok(skyline.velocity>wagon.velocity*1.4&&wagon.velocity>bus.velocity*1.5,'Sporty car, ordinary wagon and heavy bus have distinct acceleration');
const coast=car('commodore');coast.velocity=20;run(coast,{},1);assert.ok(coast.velocity>18,'Coasting preserves momentum instead of exponential braking');run(coast,{' ':true},4);assert.equal(coast.velocity,0,'Braking stops without changing into reverse');
const forward=car('corolla'),reverse=car('corolla');forward.velocity=4;reverse.velocity=-4;run(forward,{d:true},.4);run(reverse,{d:true},.4);assert.ok(forward.yaw<0&&reverse.yaw>0,'Reverse steering turns the opposite way');const before=Math.abs(forward.steeringAngle);run(forward,{},1);assert.ok(Math.abs(forward.steeringAngle)<before*.1,'Steering returns progressively toward centre');
const fast=car('skyline');fast.velocity=35;run(fast,{w:true,d:true},2);assert.ok(Math.abs(fast.yawRate*fast.velocity)<=handlingFor(fast.model).grip*9.81+.2,'High-speed cornering is bounded by tyre grip');assert.ok(Math.abs(fast.bodyRoll)>0&&Number.isFinite(fast.slipAngle));
const gravel={...world,network:{at:()=>({d:0,r:{width:8,type:'track',tags:{surface:'gravel'}}})}},road=car('corolla'),loose=car('corolla');road.velocity=loose.velocity=20;run(road,{' ':true},1);run(loose,{' ':true},1,gravel);assert.ok(loose.velocity>road.velocity,'Loose surfaces lengthen braking distance');
const uphill={...world,walkHeight:(x,z)=>-z*.08},hill=car('hilux'),flat=car('hilux');run(hill,{w:true},3,uphill);run(flat,{w:true},3);assert.ok(hill.velocity<flat.velocity,'Gravity reduces uphill acceleration');
const parked=car('commodore');parked.parkHold=true;run(parked,{},3,uphill);assert.equal(parked.velocity,0,'Parked cars hold against gravity until throttle releases the brake');run(parked,{w:true},1,uphill);assert.ok(parked.velocity>0&&!parked.parkHold);
const suspension=car('legacy');suspension.position.y=.15;run(suspension,{},2);assert.ok(Math.abs(suspension.position.y)<.002,'Suspension settles instead of oscillating indefinitely');
for(const m of CLASSICS){const c=run(car(m.id),{w:true,d:true},3);assert.ok([c.position.x,c.position.y,c.position.z,c.yaw,c.bodyPitch,c.bodyRoll,c.rpm].every(Number.isFinite));assert.ok(c.gear>=1&&c.gear<=5)}
console.log('PASS: model acceleration, momentum, braking, reverse steering, steering return, cornering grip, loose surfaces, slopes, suspension and all 14 handling profiles.');
