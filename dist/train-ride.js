import * as T from './vendor/three.js';
import {findLanding} from './movement.js?v=cockpit-breakaway-53';
import {createTrainCarriage,TRAIN_SEATS,trainCarPose} from './train-carriage.js?v=train-ride-1';
export function createTrainRide({scene,railways,world,camera,status}){
 let train=null,carriage=null,seatIndex=0,inside=true,lookYaw=0,lookPitch=0,boarding=null,projection=null,stops=[],lastDistance=0,lastStop=null;
 function enter(routeIndex){
  if(!railways.trains.length)return false;
  exit();
  const selected=Number.isInteger(routeIndex)?railways.trains[routeIndex]:[...railways.trains].sort((a,b)=>trainCarPose(a).position.distanceToSquared(camera.position)-trainCarPose(b).position.distanceToSquared(camera.position))[0];
  if(!selected)return false;
  train=selected;boarding={x:camera.position.x,z:camera.position.z};projection={near:camera.near,fov:camera.fov};
  seatIndex=0;inside=true;lookYaw=.28;lookPitch=-.06;train.passenger=true;train.controlled=false;lastDistance=train.distance;lastStop=null;
  stops=[];
  if(train.path.nearest)for(const station of railways.data?.stations||[]){const hit=train.path.nearest(station.x,station.z);if(hit.distance<65&&hit.s-10>24&&hit.s-10<train.path.length-24&&!stops.some(s=>Math.abs(s.s-(hit.s-10))<90))stops.push({name:station.name,s:hit.s-10})}
  carriage??=createTrainCarriage();if(!carriage.group.parent)scene.add(carriage.group);update(0);return true;
 }
 function exit(){
  if(!train)return false;
  const pose=trainCarPose(train),side=new T.Vector3(3.6,0,0).applyQuaternion(pose.quaternion).add(pose.position);
  const safeWorld={bounds:world.bounds,free(x,z){const rail=railways.at?.(x,z,0),water=world.water?.at(x,z);return world.free(x,z)&&(!rail||rail.d>2.8)&&(!water||water.depth<.7||world.water.supported?.(x,z,world.walkHeight(x,z)+2))}};
  const p=findLanding(safeWorld,side.x,side.z,boarding);camera.position.set(p.x,world.walkHeight(p.x,p.z)+2,p.z);
  camera.near=projection.near;camera.fov=projection.fov;camera.updateProjectionMatrix();delete train.passenger;train=null;carriage?.update(null);status.textContent='ON FOOT';return true;
 }
 function cycleSeat(){if(!train)return false;seatIndex=(seatIndex+1)%TRAIN_SEATS.length;inside=true;lookYaw=TRAIN_SEATS[seatIndex].x>0?.28:-.28;lookPitch=-.06;update(0);return true}
 function toggleView(){if(!train)return false;inside=!inside;update(0);return inside}
 function look(dx,dy){if(!train||!inside)return false;lookYaw=Math.atan2(Math.sin(lookYaw-dx*.0025),Math.cos(lookYaw-dx*.0025));lookPitch=T.MathUtils.clamp(lookPitch-dy*.0025,-1.05,1.05);return true}
 function update(dt,night=0){
  if(!train)return false;
  // Dwell at mapped stations crossed by the automatic service; no player throttle is used.
  if(lastStop&&Math.abs(train.distance-lastStop.s)>50)lastStop=null;
  const crossed=stops.find(s=>s!==lastStop&&(train.direction>0?s.s>lastDistance&&s.s<=train.distance:s.s<lastDistance&&s.s>=train.distance));
  if(crossed){train.distance=crossed.s;train.wait=8;lastStop=crossed}
  lastDistance=train.distance;
  carriage.update(train,night);const pose=trainCarPose(train);
  if(inside){const seat=TRAIN_SEATS[seatIndex];camera.position.copy(new T.Vector3(seat.x,seat.y,seat.z).applyQuaternion(pose.quaternion).add(pose.position));camera.quaternion.copy(pose.quaternion).multiply(new T.Quaternion().setFromEuler(new T.Euler(lookPitch,seat.yaw+lookYaw,0,'YXZ')));camera.near=.035;camera.fov=72}
  else{camera.position.copy(new T.Vector3(7,5,17).applyQuaternion(pose.quaternion).add(pose.position));camera.lookAt(pose.position.clone().add(new T.Vector3(0,1.6,0)));camera.near=projection.near;camera.fov=projection.fov}
  camera.updateProjectionMatrix();
  status.textContent=`RIDING · ${train.name} · ${train.wait>0?'STOPPED'+(lastStop&&Math.abs(train.distance-lastStop.s)<1?' · '+lastStop.name:' · TERMINUS'):Math.round(13*3.6)+' KM/H'} · ${inside?TRAIN_SEATS[seatIndex].name:'EXTERIOR'} · E SEAT · V VIEW · F GET OFF`;
  return true;
 }
 return {enter,exit,update,cycleSeat,toggleView,look,get active(){return !!train},get train(){return train},get inside(){return !!train&&inside},get seatName(){return TRAIN_SEATS[seatIndex].name},get seatIndex(){return seatIndex},get model(){return carriage?.group},get soundState(){return train?{kind:'train',speed:train.wait>0?0:13,passenger:true}:null}};
}
