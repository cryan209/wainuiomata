import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.js';
import {createRoadNetwork} from '../dist/water-roads.js';
import {createTraffic} from '../dist/traffic.js';
const terrain=(x,z)=>x*.65+z*.10+Math.sin(z*2)*.3;
const scene=new T.Scene(),network=createRoadNetwork(scene,{elements:[{id:1,tags:{highway:'secondary',name:'Queen Street'},geometry:[{x:0,z:-60,node:1},{x:0,z:0,node:2},{x:0,z:60,node:3}]}]},{ground:terrain,channel:()=>null},terrain,{asphalt:null,concrete:null});
const road=network.roads[0];
for(let i=0;i<2;i++)for(const t of [0,.15,.5,.99,1])assert.equal(network.height(road,i,t,-5,-60+i*60+t*60),network.height(road,i,t,5,-60+i*60+t*60),'Road cross section must stay level across a hillside');
assert.equal(network.height(road,0,1,0,0),network.height(road,1,0,0,0),'Road joins have identical heights');
for(const z of [-37,-10,10,35]){assert.ok(Math.abs(network.ground(4,z)-(network.walkHeight(4,z)-.16))<1e-8,'Terrain is graded below asphalt');assert.equal(network.ground(25,z),terrain(25,z),'Terrain beyond shoulder is retained')}
let maxStep=0;for(let z=-59;z<59;z+=.1)maxStep=Math.max(maxStep,Math.abs(network.walkHeight(2,z+.1)-network.walkHeight(2,z)));assert.ok(maxStep<.04,'Profile removes raw DEM ripples');
const traffic=createTraffic(new T.Scene(),network,1),car=traffic.cars[0];car.speed=8;let pitch=car.pitch;
for(let frame=0;frame<1800;frame++){traffic.update(1/60,new T.Vector3(1000,1000,1000));assert.ok(Number.isFinite(car.pitch));assert.ok(Math.abs(car.pitch-pitch)<.04,'Pitch is damped at joins and reversals');pitch=car.pitch}
const before={...car.position},oldPitch=car.pitch;traffic.update(0,new T.Vector3(1000,1000,1000));assert.deepEqual(car.position,before,'Paused traffic does not move');assert.equal(car.pitch,oldPitch);
console.log('PASS: level road cross sections, continuous joins, graded shoulders, smoothed DEM profile and stable traffic pitch across segment ends.');
