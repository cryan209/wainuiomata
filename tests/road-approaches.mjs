import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.js';
import {createRoadNetwork} from '../dist/water-roads.js';
import {approachLimit} from '../dist/road-grades.js';
const road=(id,points,bridge=false)=>({id,tags:{highway:'primary',...(bridge?{bridge:'yes'}:{})},geometry:points.map(([z,node])=>({x:0,z,node}))});
const network=createRoadNetwork(new T.Scene(),{elements:[road(1,[[-200,1],[0,2]]),road(2,[[0,2],[30,3]],true),road(3,[[30,3],[230,4]])]},{ground:()=>0,channel:(x,z)=>z>0&&z<30?{y:6}:null},()=>0,{asphalt:null,concrete:null});
const approach=network.roads[0],bridge=network.roads[1],deck=network.height(bridge,0,0,0,0),far=network.walkHeight(0,-70);assert.ok(deck>7,'Fixture requires a raised deck');assert.ok(far>.5,'Approach extends beyond former 25m ramp');for(const r of network.roads)for(let i=0;i<r.p.length-1;i++){const values=r.gradeProfiles[i],dx=r.p[i].distanceTo(r.p[i+1])/(values.length-1);for(let j=1;j<values.length;j++)assert.ok(Math.abs(values[j]-values[j-1])<=dx*approachLimit(r)+1e-6)}assert.equal(approachLimit(approach),.08,'Primary approaches keep an 8% design grade');assert.equal(network.height(approach,0,1,0,0),deck);
console.log('PASS: a raised bridge has a gradual 8% approach extending beyond 25m, with no endpoint step.');
