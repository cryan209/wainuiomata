import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.js';
import {createRoadNetwork} from '../dist/water-roads.js';
import {createTraffic} from '../dist/traffic.js';
import {planDirectionSigns} from '../dist/direction-signs.js';
// A north-running arterial (the network clips at about 3.35 km) with a mapped destination to the west and a lane-marked approach from the south.
const p=(x,z,node)=>({x,z,node}),way=(id,name,type,geometry,tags={})=>({id,tags:{highway:type,name,width:'9',...tags},geometry});
const elements=[way(1,'Main Road','secondary',[p(0,200,'s'),p(0,100,'m'),p(0,0,'o')],{'turn:lanes:forward':'left|through;right'}),way(2,'Main Road','secondary',[p(0,0,'o'),p(0,-6000,'n')]),
 way(3,'West Road','secondary',[p(0,0,'o'),p(-5000,0,'w')],{destination:'Petone'}),way(4,'East Road','secondary',[p(0,0,'o'),p(5000,0,'e')])];
const scene=new T.Scene(),network=createRoadNetwork(scene,{elements,controls:[]},{ground:()=>0,channel:()=>null},()=>0,{asphalt:null,concrete:null},null,null,{buildGeometry:false}),traffic=createTraffic(scene,network,0);
const places=[{name:'Home',x:0,z:0},{name:'Northville',x:0,z:-3000},{name:'Eastbay',x:3000,z:0}],plans=planDirectionSigns(network,traffic,places);
const south=plans.find(q=>q.z>0);assert.ok(south,'The southern approach gets a board');
assert.ok(south.x<0&&Math.abs(south.dz+1)<.01,'Board stands on the left verge facing northbound traffic');
assert.ok(south.z>30&&south.z<60,'Board is posted in advance of the junction');
assert.deepEqual(south.lanes.map(l=>l.turns),[['left'],['through','right']],'Lane columns follow turn:lanes');
assert.ok(south.lanes[0].names.includes('Petone'),'Mapped destination tag labels the left lane');
assert.ok(south.lanes[1].names.includes('Northville')&&south.lanes[1].names.includes('Eastbay'),'Inferred suburbs label the shared lane');
assert.ok(!plans.some(q=>q.rows.some(r=>r.names.includes('Home'))),'The local suburb is never signposted');
console.log('PASS: direction signs placement, lane columns, mapped and inferred destinations.');
