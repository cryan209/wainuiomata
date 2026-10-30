import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.js';
import {createDriving} from '../dist/driving.js';
import {CLASSICS} from '../dist/classic-cars.js';
const model=CLASSICS[0],bounds={minX:-5000,maxX:5000,minZ:-5000,maxZ:5000};
function drive(walkHeight,keys,frames){const car={model,position:{x:0,y:walkHeight(0,0),z:0},yaw:0,velocity:0},camera=new T.PerspectiveCamera(),world={bounds,free:()=>true,walkHeight},driving=createDriving({traffic:{cars:[car]},railways:{trains:[]},world,camera,keys,status:{textContent:''}});driving.enter('car');driving.update(0);const log=[];for(let i=0;i<frames;i++){driving.update([1/120,1/30,1/60,.047][i%4]);log.push({camera:camera.position.clone(),yaw:new T.Euler().setFromQuaternion(camera.quaternion,'YXZ').y,car:{...car.position},carYaw:car.yaw})}return log}
// Rough kerb-like steps: the car body bounces, the camera should not.
const bumpy=(x,z)=>Math.sin(z*1.7)>0?.12:0,bumps=drive(bumpy,{w:true},400).slice(100),carRange=Math.max(...bumps.map(f=>f.car.y))-Math.min(...bumps.map(f=>f.car.y)),cameraRange=Math.max(...bumps.map(f=>f.camera.y))-Math.min(...bumps.map(f=>f.camera.y));
assert.ok(carRange>.015&&cameraRange<carRange*.6,`Chase camera filters suspension bumps (car ${carRange.toFixed(3)}m, camera ${cameraRange.toFixed(3)}m)`);
// Turning at mixed frame rates: the camera heading trails the car and never jumps between frames.
const turn=drive(()=>0,{w:true,d:true},600);for(let i=1;i<turn.length;i++){const step=Math.abs(Math.atan2(Math.sin(turn[i].yaw-turn[i-1].yaw),Math.cos(turn[i].yaw-turn[i-1].yaw)));assert.ok(step<.06,'Camera heading changes smoothly at every frame')}
const last=turn.at(-1);assert.ok(Math.abs(last.carYaw-0)>.5,'Car turned');const lag=Math.atan2(Math.sin(last.carYaw-last.yaw),Math.cos(last.carYaw-last.yaw));assert.ok(Math.abs(lag)>.005&&Math.abs(lag)<.35,'Camera heading eases after the car without losing it');
// A steep bank behind a stationary car: the camera rises clear of the slope instead of sitting inside it.
const bank=(x,z)=>Math.max(0,(z-3)*.9),parked=drive(bank,{},240).at(-1);assert.ok(parked.camera.y>bank(parked.camera.x,parked.camera.z)+1,'Chase camera stays above terrain behind the car');
console.log('PASS: chase camera bump filtering, smooth heading at mixed frame rates and terrain clearance.');
