import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.js';
import {createRailways} from '../dist/railways.js';
import {createTrainCarriage,trainCarPose,TRAIN_SEATS} from '../dist/train-carriage.js';
import {createTrainRide} from '../dist/train-ride.js';
const scene=new T.Scene(),camera=new T.PerspectiveCamera(50,1,.15,30000),status={textContent:''};camera.position.set(10,2,-800);
const route=[{x:0,z:0,h:0},{x:0,z:-1000,h:20},{x:300,z:-2000,h:32}];
const data={gauge:1.067,tracks:[{id:'test',name:'Test',p:route}],platforms:[],stations:[],routes:[{name:'Test Valley service',p:route},{name:'Other service',p:route.map(p=>({...p,x:p.x+1000}))}]};
const railways=createRailways(scene,data,{datum:0,textures:{roadSurfaces:Array(6).fill(null),concrete:null}});
const world={bounds:{minX:-4000,maxX:4000,minZ:-4000,maxZ:4000},free:(x,z)=>Math.abs(x)>2.8,walkHeight:()=>0};
const ride=createTrainRide({scene,railways,world,camera,status});assert.equal(ride.active,false);assert.equal(ride.model,undefined,'Interior builds only when boarding');
assert.equal(ride.enter(99),false);assert.ok(ride.enter(0));assert.equal(ride.train,railways.trains[0]);assert.equal(ride.train.controlled,false);assert.equal(ride.train.passenger,true);assert.equal(ride.inside,true);assert.match(status.textContent,/RIDING/);assert.ok(ride.model.visible);
const count=scene.children.length,train=ride.train,distance=train.distance;
railways.update(1,camera.position,{night:0});ride.update(1);assert.ok(train.distance>distance&&train.distance<distance+1&&train.speed>0,'Passenger train accelerates from rest');
let pose=trainCarPose(train),local=camera.position.clone().sub(pose.position).applyQuaternion(pose.quaternion.clone().invert());
assert.ok(local.distanceTo(new T.Vector3(TRAIN_SEATS[0].x,TRAIN_SEATS[0].y,TRAIN_SEATS[0].z))<1e-8,'Camera stays at the modeled seat on a gradient');
assert.ok(ride.model.position.distanceTo(pose.position)<1e-8,'Camera and carriage share the current route sample');
const body=scene.children.find(o=>o.isInstancedMesh&&o.geometry.parameters?.height===2.25),matrix=new T.Matrix4(),scale=new T.Vector3();body.getMatrixAt(0,matrix);scale.setFromMatrixScale(matrix);assert.equal(scale.length(),0,'Opaque proxy coach is hidden while riding');body.getMatrixAt(1,matrix);scale.setFromMatrixScale(matrix);assert.ok(scale.length()>1,'Other coach remains visible');
let seatCount=0,glassCount=0,lights=0;ride.model.traverse(o=>{if(o.userData.trainPart==='seat cushion')seatCount+=o.count;if(o.userData.trainPart==='window glass'){glassCount+=o.count;assert.ok(o.material.transparent&&o.material.opacity<.15)}if(o.isPointLight)lights++});assert.equal(seatCount,40);assert.equal(glassCount,2);assert.equal(lights,2);
// No opaque wall or neighboring seat intersects a seated eye looking through its window.
ride.model.updateMatrixWorld(true);
for(const seat of TRAIN_SEATS){const origin=new T.Vector3(seat.x,seat.y,seat.z).applyMatrix4(ride.model.matrixWorld),direction=new T.Vector3(Math.sign(seat.x),0,0).applyQuaternion(ride.model.quaternion);const ray=new T.Raycaster(origin,direction,.01,.6),hits=ray.intersectObjects(ride.model.children,true).filter(h=>h.object.isMesh&&!h.object.material.transparent);assert.equal(hits.length,0,'Every selectable window seat has an unobstructed window');}
const rotation=camera.quaternion.clone();assert.ok(ride.look(400,-180));ride.update(0);assert.ok(camera.quaternion.angleTo(rotation)>.1);for(let i=0;i<8;i++){assert.ok(ride.cycleSeat());assert.equal(ride.seatIndex,(i+1)%8)}assert.equal(scene.children.length,count,'Seat changes reuse one carriage');
ride.toggleView();assert.equal(ride.inside,false);assert.equal(camera.near,.15);assert.equal(ride.look(2,2),false);ride.toggleView();assert.equal(camera.near,.035);
const savedDistance=train.distance;train.distance=Math.hypot(1000,20)-10-.1;const beforeCorner=trainCarPose(train);train.distance+=.2;assert.ok(beforeCorner.quaternion.angleTo(trainCarPose(train).quaternion)<.03,'Coach heading blends smoothly across mapped route corners');train.distance=savedDistance;
// Reversing at a terminus does not teleport the physical carriage or rotate its seats.
pose=trainCarPose(train);train.direction=-1;const reversed=trainCarPose(train);assert.ok(reversed.position.distanceTo(pose.position)<1e-10);assert.ok(reversed.quaternion.angleTo(pose.quaternion)<1e-7);
train.distance=train.path.length-25;train.direction=1;train.speed=.5;for(let i=0;i<200&&train.wait<=0;i++){railways.update(.05,camera.position,{night:1});ride.update(.05,1);}assert.equal(train.direction,-1);assert.ok(train.wait>0);assert.equal(ride.soundState.speed,0);assert.ok(camera.position.toArray().every(Number.isFinite));
assert.ok(ride.exit());assert.equal(ride.active,false);assert.equal(train.passenger,undefined);assert.equal(ride.model.visible,false);assert.equal(camera.near,.15);assert.equal(camera.fov,50);assert.ok(world.free(camera.position.x,camera.position.z));railways.update(0,camera.position,{night:0});body.getMatrixAt(0,matrix);scale.setFromMatrixScale(matrix);assert.ok(scale.length()>1,'Exiting restores the exterior coach');
// Mapped intermediate stations get a dwell, and the train continues afterwards.
railways.data.stations=[{name:'Test stop',x:0,z:-600}];train.distance=580;train.wait=0;train.speed=0;train.direction=1;ride.enter(0);for(let i=0;i<500&&train.wait<=0;i++){railways.update(.05,camera.position,{night:0});ride.update(.05);}assert.ok(train.wait>0);assert.match(status.textContent,/Test stop/);assert.equal(ride.soundState.speed,0);const stopped=train.distance;railways.update(1,camera.position,{night:0});ride.update(1);assert.equal(train.distance,stopped);railways.update(8,camera.position,{night:0});ride.update(8);railways.update(1,camera.position,{night:0});ride.update(1);assert.ok(train.distance>stopped,'Automatic service resumes after station dwell');
ride.exit();assert.ok(ride.enter(1));assert.equal(ride.train,railways.trains[1]);ride.exit();assert.equal(scene.children.length,count,'Route changes reuse the carriage');
const empty=createTrainRide({scene,railways:{trains:[]},world,camera,status});assert.equal(empty.enter(),false);
const model=createTrainCarriage();model.update(train,1);assert.ok(model.group.visible);model.dispose();
console.log('PASS: modeled 40-seat carriage, unobstructed window seats, automatic passenger travel, graded/curved route camera, seat/look/view controls, frame synchronization, reversal/dwell, safe exit and model reuse.');
