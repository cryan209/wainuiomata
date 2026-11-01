import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.js';
import {railRoute} from '../dist/railways.js';
import {stepTrainService,trainCruiseSpeed,TRAIN_MOTION} from '../dist/train-service.js';
import {createTrainRide} from '../dist/train-ride.js';
const path=railRoute([{x:0,z:0,h:0},{x:0,z:-12000,h:40}]);
const stations=[{name:'Start',x:0,z:0},{name:'Petone',x:0,z:-4000},{name:'Finish',x:0,z:-12000}];
function run(frame){
 const train={name:'Hutt Valley commuter',path,distance:24,direction:1,wait:0,speed:0},arrivals=[],arrivalTimes=[];let previousSpeed=0,max=0,braked=false,lastSerial=0,zeroAtStop=false,departed=false;
 for(let time=0;time<1200;time+=frame){
  const before=train.distance,beforeWait=train.wait;stepTrainService(train,frame,stations);max=Math.max(max,train.speed);braked||=train.braking;
  assert.ok(Number.isFinite(train.distance)&&Number.isFinite(train.speed));assert.ok(train.distance>=24&&train.distance<=path.length-24);assert.ok(train.speed>=0&&train.speed<=trainCruiseSpeed(train.name)+1e-8);
  assert.ok(train.speed-previousSpeed<=TRAIN_MOTION.acceleration*frame+1e-6,'Acceleration is bounded');
  if(train.serviceArrivalSerial===lastSerial)assert.ok(previousSpeed-train.speed<=TRAIN_MOTION.brake*frame+.15,'Normal braking is progressive');
  if(train.serviceArrivalSerial!==lastSerial){assert.ok(previousSpeed<1,'Station arrivals reach walking speed before the final stop');lastSerial=train.serviceArrivalSerial;arrivals.push(train.serviceArrived.name);arrivalTimes.push(time+frame);assert.equal(train.speed,0);zeroAtStop=true;assert.ok(train.wait>0)}
  if(beforeWait>frame){assert.equal(train.distance,before,'Train holds its platform position during dwell');assert.equal(train.speed,0)}
  if(zeroAtStop&&beforeWait>0&&train.wait===0&&train.speed>0)departed=true;
  previousSpeed=train.speed;
  if(arrivals.length>=3)break;
 }
 assert.ok(max>29,'Main-line service cruises substantially faster than the old 13 m/s');assert.ok(braked&&departed);assert.deepEqual(arrivals.slice(0,3),['Petone','Finish','Petone'],'Service stops at stations, reverses and calls again on return');
 return {max,train,arrivalTimes};
}
const regular=run(1/60),variable=run(.137);assert.ok(Math.abs(regular.max-variable.max)<.01,'Cruise speed is consistent across frame rates');for(let i=0;i<3;i++)assert.ok(Math.abs(regular.arrivalTimes[i]-variable.arrivalTimes[i])<.5,'Station timing is consistent across frame rates');
assert.equal(trainCruiseSpeed('Johnsonville commuter')*3.6,70);assert.equal(trainCruiseSpeed('Melling commuter')*3.6,80);
const paused={name:'Test',path,distance:100,direction:1,wait:0,speed:10};stepTrainService(paused,0,stations);assert.equal(paused.distance,100);assert.equal(paused.speed,10);
// The ride camera observes the physics and announces a real zero-speed platform arrival.
const train={name:'Test',path,distance:3500,direction:1,wait:0,speed:15},events=[],scene=new T.Scene(),camera=new T.PerspectiveCamera(),status={},world={bounds:{minX:-100,maxX:100,minZ:-13000,maxZ:100},free:()=>true,walkHeight:()=>0};
const ride=createTrainRide({scene,railways:{trains:[train],data:{stations}},world,camera,status,onAnnouncement:e=>events.push(e)});ride.enter(0);
let previous=train.distance;for(let i=0;i<6000&&train.serviceArrivalSerial<1;i++){stepTrainService(train,1/60,stations);const physical=train.distance;ride.update(1/60);assert.equal(train.distance,physical,'Passenger camera never rewinds or teleports the service');assert.ok(train.distance>=previous);previous=train.distance;assert.equal(ride.soundState.speed,train.speed);assert.equal(ride.soundState.braking,!!train.braking)}
assert.equal(train.serviceArrived.name,'Petone');assert.equal(train.speed,0);assert.ok(events.some(e=>e?.kind==='approach'&&e.station==='Petone'));assert.ok(events.some(e=>e?.kind==='arrival'&&e.station==='Petone'));assert.match(status.textContent,/STOPPED/);
console.log('PASS: 110 km/h main-line cruise, branch limits, bounded acceleration/braking, zero-speed platform stops, dwell/departure, return service, frame-rate consistency and synchronized rider/announcer/audio telemetry.');
