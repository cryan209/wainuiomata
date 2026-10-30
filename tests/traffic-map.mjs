import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../dist/vendor/three.js';
import {mapSource} from '../scripts/lib/map-source.mjs';
import {createRoadNetwork,createHydrology} from '../dist/water-roads.js';
import {createTraffic} from '../dist/traffic.js';
import {createIntersectionScenery} from '../dist/intersection-scenery.js';
const source=mapSource(),controls=JSON.parse(fs.readFileSync(new URL('../dist/traffic-controls.json',import.meta.url))).nodes,scene=new T.Scene(),hydro=createHydrology(scene,source.waterways,source.raw),network=createRoadNetwork(scene,{...source,controls},hydro,source.raw,{},null,source.railways,{buildGeometry:false}),traffic=createTraffic(scene,network,144),camera={x:0,z:0,y:source.raw(0,0)+2},scenery=createIntersectionScenery(scene,network,traffic.rules),before=traffic.cars.map(c=>({...c.position}));
for(let i=0;i<600;i++)traffic.update(.05,camera);scenery.update(camera);const moved=traffic.cars.filter((c,i)=>!c.parked&&Math.hypot(c.position.x-before[i].x,c.position.z-before[i].z)>5).length;assert.ok(moved>=15,'Real-map traffic continues to flow through controlled junctions');assert.ok(traffic.stats.signalNodes>10&&traffic.stats.crossings>30);assert.ok(scenery.plans.some(p=>p.kind==='stop')&&scenery.plans.some(p=>p.kind==='signal'));assert.ok(traffic.cars.every(c=>[c.position.x,c.position.y,c.position.z,c.velocity].every(Number.isFinite)));for(const p of scenery.plans)assert.ok([p.x,p.y,p.z,p.yaw].every(Number.isFinite));console.log(`PASS: real-map simulation; ${moved} nearby AI vehicles advanced, ${traffic.stats.signalNodes} mapped signal nodes, ${traffic.stats.crossings} crossings and finite control geometry.`);
