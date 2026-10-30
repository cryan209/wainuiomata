import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.js';
import {createRoadNetwork} from '../dist/water-roads.js';
import {stepCar} from '../dist/driving.js';
const map={elements:[{id:1,tags:{highway:'secondary',bridge:'yes',width:'7.2',lanes:'2'},geometry:[{x:0,z:-15,node:1},{x:0,z:15,node:2}]},...[-1,1].map((side,i)=>({id:i+2,tags:{highway:'footway',footway:'sidewalk',bridge:'yes',width:'1.2'},geometry:[{x:side*3.2,z:-15,node:i+3},{x:side*3.2,z:15,node:i+5}]}))]};
const network=createRoadNetwork(new T.Scene(),map,{ground:()=>0,channel:(x,z)=>Math.abs(z)<12?{y:0}:null},()=>0,{asphalt:null,concrete:null});assert.ok(network.roads.slice(1).every(r=>r.sharedDeck===network.roads[0]),'Both sidewalks reuse the main bridge');assert.equal(network.onBridge(4.2,0),true,'Narrower adjacent footpath cannot hide wider road deck');assert.equal(network.height(network.roads[1],0,.5,3.2,0),network.height(network.roads[0],0,.5,0,0));
const world={bounds:{minX:-100,maxX:100,minZ:-100,maxZ:100},walkHeight:(x,z)=>network.walkHeight(x,z),free:(x,z)=>Math.abs(z)>=12||network.onBridge(x,z)};
for(const side of [-1,1]){const car={model:{width:1.86,length:4.95},position:{x:side*1.8,z:side*10,y:2},yaw:side===1?0:Math.PI,velocity:0};for(let frame=0;frame<180;frame++)stepCar(car,{w:true},1/60,world);assert.ok(side*car.position.z<-10,'A full-size car can cross in each lane');}
console.log('PASS: shared bridge sidewalks, full-width deck collision, common walkway elevation and cars passing in both lanes.');
