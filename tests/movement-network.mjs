import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.js';
import {movePlayer,findLanding} from '../dist/movement.js';
import {createRoadNetwork} from '../dist/water-roads.js';
import {createTraffic} from '../dist/traffic.js';
let collisionCalls=0;const world={bounds:{minX:-3200,maxX:3200,minZ:-3200,maxZ:3200},ground:()=>10,walkHeight:()=>14,free:()=>{collisionCalls++;return false}};
let position={x:1000,y:50,z:1000};movePlayer({position,yaw:0,pitch:0,keys:{w:true},dt:1,drone:true,world,clock:0});assert.equal(position.z,968);assert.equal(collisionCalls,0,'Drone must bypass all building/water collision checks');assert.equal(position.y,50,'Drone must retain altitude');
movePlayer({position,yaw:0,pitch:0,keys:{' ':true},dt:1,drone:true,world,clock:0});assert.equal(position.y,82);movePlayer({position,yaw:0,pitch:0,keys:{c:true},dt:1,drone:true,world,clock:0});assert.equal(position.y,50);
position={x:1000,y:50,z:1000};movePlayer({position,yaw:0,pitch:0,keys:{w:true},dt:1,drone:false,world,clock:0});assert.equal(position.z,1000,'Walking must still respect collisions');assert.equal(position.y,16);
position={x:0,y:50,z:0};movePlayer({position,yaw:0,pitch:0,keys:{w:true,shift:true},dt:1,drone:true,world,clock:0});assert.equal(position.z,-100);position.z=-3199;movePlayer({position,yaw:0,pitch:0,keys:{w:true},dt:1,drone:true,world,clock:0});assert.equal(position.z,-3200);
const landing=findLanding({...world,free:(x,z)=>x>1010},1000,1000,{x:0,z:0});assert.ok(landing.x>1010&&landing.x<1041,'Exiting the drone above a building must find nearby walkable ground');
const map={elements:[{id:'approach',tags:{highway:'secondary',name:'Approach'},geometry:[{x:0,z:40,node:'a'},{x:0,z:10,node:'b'}]},{id:'bridge',tags:{highway:'secondary',name:'Test Bridge',bridge:'yes'},geometry:[{x:0,z:10,node:'b'},{x:0,z:-10,node:'c'}]},{id:'exit',tags:{highway:'secondary',name:'Exit'},geometry:[{x:0,z:-10,node:'c'},{x:0,z:-40,node:'d'}]}]};
const hydro={ground:(x,z)=>Math.abs(z)<8?7:10,channel:(x,z)=>Math.abs(z)<8?{y:9}:null};
const network=createRoadNetwork(new T.Scene(),map,hydro,()=>10,{asphalt:null,concrete:null});const bridge=network.roads.find(r=>r.bridge),approach=network.roads.find(r=>r.name==='Approach');assert.ok(network.walkHeight(0,0)>=10.69999,'Bridge deck must clear the channel');assert.equal(network.height(approach,0,1,0,10),network.height(bridge,0,0,0,10),'Road approach must meet bridge deck without a step');assert.equal(network.onBridge(0,0),true);assert.equal(network.onBridge(30,0),false);
const traffic=createTraffic(new T.Scene(),network,6);assert.ok(traffic.edges.length>=6);assert.ok(traffic.nodes.get('b').length>=2,'Traffic graph must connect at the bridge abutment');for(let frame=0;frame<600;frame++)traffic.update(.05,new T.Vector3(100,100,100),0);for(const car of traffic.cars){assert.ok(Number.isFinite(car.position.y));assert.ok(car.position.x>=-3&&car.position.x<=3,'Traffic must stay in its lane corridor')}
console.log('PASS: drone free flight / altitude / larger bounds; walking collision; bridge clearance and approach continuity; connected traffic routing.');
