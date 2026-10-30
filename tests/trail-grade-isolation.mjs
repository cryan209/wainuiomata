import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.js';
import {createRoadNetwork} from '../dist/water-roads.js';
const raw=(x,z)=>Math.max(0,z)*.85,hydro={ground:raw,channel:()=>null},street={id:1,tags:{highway:'residential',name:'Valley Street'},geometry:[{x:-60,z:0,node:1},{x:0,z:0,node:2},{x:60,z:0,node:3}]},types=['track','path','footway','cycleway','bridleway','steps'];
const make=(elements,geometry=false)=>createRoadNetwork(new T.Scene(),{elements},hydro,raw,{asphalt:null,concrete:null},null,null,{buildGeometry:geometry});
const baseline=make([street]);
for(const type of types){const trail={id:2,tags:{highway:type},geometry:[{x:0,z:0,node:2},{x:0,z:30,node:4},{x:0,z:100,node:5}]},network=make([street,trail]),road=network.roads[0],path=network.roads[1];for(let i=0;i<2;i++)for(let j=0;j<=20;j++){const t=j/20,x=road.p[i].x+(road.p[i+1].x-road.p[i].x)*t;assert.ok(Math.abs(network.height(road,i,t,x,0)-baseline.height(baseline.roads[0],i,t,x,0))<1e-8,type+' must not raise the adjoining street')}
 assert.ok(Math.abs(network.height(path,0,0,0,0)-network.height(road,0,1,0,0))<1e-8,'Trail meets the fixed street height');assert.ok(Math.abs(network.height(path,1,1,0,100)-(raw(0,100)+.16))<.01,'Steep trail retains the hill elevation');assert.ok(Math.abs(network.height(path,0,1,0,30)-network.height(path,1,0,0,30))<1e-8,'Trail segments meet without steps')}
const rendered=make([street],true),planned=make([street]);assert.equal(rendered.height(rendered.roads[0],0,.5,-30,0),planned.height(planned.roads[0],0,.5,-30,0),'Geometry-free audits use the same street solver');assert.equal(planned.stats.chunks,0);
console.log('PASS: all six trail types leave adjoining streets unchanged, meet fixed road/segment endpoints, retain hill elevations and support geometry-free audits.');
