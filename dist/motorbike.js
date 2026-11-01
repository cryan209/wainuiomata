import * as T from './vendor/three.js';
import {findLanding} from './movement.js?v=audio-music-58';
// Rideable motorbikes: a fast road sportbike and a long-travel dirt bike. Engine with gears and rpm, lean into turns, wheelies, and real airtime off crests and drops, using the walking collision rules.
export const MOTO_VARIANTS={
 road:{label:'MOTORBIKE',paint:'#c8102e',trim:'#f2f2f2',R:.31,base:1.42,top:44,boost:60,accel:7,boostAccel:10.5,gears:6,idle:1300,redline:11500,cylinders:4,stepUp:.45,landLoss:.35,grip:.35,dist:5.2},
 dirt:{label:'DIRT BIKE',paint:'#ff7a00',trim:'#f4f4f0',R:.36,base:1.48,top:27,boost:36,accel:8,boostAccel:11.5,gears:5,idle:1500,redline:10000,cylinders:1,stepUp:.8,landLoss:.1,grip:.75,dist:4.8}
};
export function createMotorbike({scene,world,camera,keys,variant='road'}){
 const V=MOTO_VARIANTS[variant],dirt=variant==='dirt',R=V.R,L=V.base;
 const mat=c=>new T.MeshLambertMaterial({color:c,flatShading:true}),paint=mat(V.paint),trim=mat(V.trim),dark=mat('#1b1d1f'),tyre=mat('#111214'),metal=mat('#b8bcc0'),chrome=mat('#d8dde2'),skin=mat('#c99a74'),suit=mat(dirt?'#2a3a8c':'#1d1f24'),suitTrim=mat(V.paint),helmet=mat(dirt?'#f4f4f0':V.paint),visor=new T.MeshLambertMaterial({color:'#20262e',transparent:true,opacity:.75}),lamp=new T.MeshBasicMaterial({color:'#fff6d8'}),tail=new T.MeshBasicMaterial({color:'#d01818'});
 const box=(w,h,d,m,x=0,y=0,z=0)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x,y,z);return o};
 const tube=(a,b,r,m)=>{const A=new T.Vector3(...a),B=new T.Vector3(...b),o=new T.Mesh(new T.CylinderGeometry(r,r,A.distanceTo(B),6),m);o.position.copy(A).add(B).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),B.sub(A).normalize());return o};
 const model=new T.Group(),bike=new T.Group(),body=new T.Group();model.add(bike);bike.add(body);model.rotation.order='YXZ';
 // Wheels: fat tyres on the road bike; knobbly, spoked and larger at the front on the dirt bike.
 const wheel=(z,r)=>{const w=new T.Group();w.position.set(0,r,z);const t=new T.Mesh(new T.TorusGeometry(r-.06,dirt?.07:.085,5,16),tyre);t.rotation.y=Math.PI/2;w.add(t);if(dirt)for(let i=0;i<14;i++){const a=i/14*Math.PI*2,k=box(.15,.05,.05,tyre,0,Math.cos(a)*(r-.01),Math.sin(a)*(r-.01));k.rotation.x=-a;w.add(k)}const spokes=dirt?6:3;for(let i=0;i<spokes;i++){const s=box(dirt?.012:.05,(r-.08)*2,dirt?.012:.04,dirt?metal:dark);s.rotation.x=i*Math.PI/spokes;w.add(s)}w.add(box(.12,.07,.07,chrome));bike.add(w);return w};
 const fr=dirt?R+.03:R,front=wheel(-L/2,fr),rear=wheel(L/2,R);
 if(dirt){
  // Tall forks, high fender, plastics, long flat seat, number board and a high pipe.
  const head=[0,1.12,-.42];body.add(tube(head,[.09,fr,-L/2],.03,chrome),tube(head,[-.09,fr,-L/2],.03,chrome),box(.2,.04,.5,trim,0,fr+.42,-L/2-.05),box(.36,.22,.44,paint,0,.98,-.14),box(.26,.07,.76,dark,0,1.04,.3),box(.3,.12,.52,trim,0,.94,.42),box(.32,.3,.05,trim,0,1.06,-.5),box(.14,.06,.4,trim,0,.93,.82),box(.18,.3,.36,metal,0,.6,-.02),tube([0,.62,.1],[0,R,L/2],.035,dark),tube([0,.62,.1],[0,.95,.5],.03,dark),tube([.14,.85,0],[.16,.98,.7],.04,chrome),box(.7,.03,.03,dark,0,1.24,-.38),tube(head,[0,1.24,-.38],.025,metal),box(.09,.07,.04,lamp,0,1.02,-.53))
 }else{
  // Sportbike: fairing nose, screen, tank, stepped seat, tail cowl, belly pan and an under-tail can.
  const head=[0,.98,-.5];body.add(tube(head,[.08,R,-L/2],.035,chrome),tube(head,[-.08,R,-L/2],.035,chrome),box(.18,.05,.4,paint,0,R+.36,-L/2+.02),box(.44,.36,.42,paint,0,.86,-.52),box(.32,.24,.24,paint,0,.98,-.78),box(.3,.2,.04,visor,0,1.16,-.66),box(.4,.24,.5,paint,0,.98,-.14),box(.3,.06,.36,dark,0,.96,.24),box(.28,.18,.5,paint,0,1.0,.58),box(.36,.2,.8,trim,0,.5,-.2),box(.24,.3,.4,metal,0,.58,.0),tube([0,.55,.15],[0,R,L/2],.04,dark),box(.12,.12,.4,chrome,.12,.62,.62),box(.6,.03,.03,dark,0,1.02,-.46),box(.16,.06,.04,lamp,0,.95,-.9),box(.14,.05,.03,tail,0,1.02,.84))
 }
 // Rider: helmeted, hands on the bars, feet on the pegs; tucked on the sportbike, upright on the dirt bike.
 const rider=new T.Group();rider.position.set(0,dirt?1.1:1.02,dirt?.18:.22);body.add(rider);const torso=box(.36,.58,.24,suit,0,.3,-.12);torso.rotation.x=dirt?-.35:-.95;rider.add(torso,box(.37,.12,.25,suitTrim,0,.12,-.05));const hel=new T.Group();hel.position.set(0,dirt?.7:.55,dirt?-.32:-.48);hel.add(box(.28,.28,.3,helmet),box(.24,.1,.04,visor,0,.02,-.16));if(dirt)hel.add(box(.2,.04,.14,suitTrim,0,.1,-.2));rider.add(hel);
 for(const s of [-1,1]){rider.add(tube([s*.19,dirt?.5:.42,dirt?-.24:-.36],[s*(dirt?.33:.28),dirt?.14:.02,dirt?-.56:-.68],.045,suit));const thigh=tube([s*.12,0,0],[s*.2,-.2,-.38],.07,suit),shin=tube([s*.2,-.2,-.38],[s*.2,dirt?-.62:-.52,-.04],.06,suit);rider.add(thigh,shin,box(.12,.1,.24,dark,s*.2,dirt?-.66:-.56,-.1))}
 model.visible=false;scene.add(model);
 const s={yaw:0,speed:0,vy:0,lean:0,steer:0,roll:0,pitch:0,wheelie:0,squash:0,rpm:V.idle,gear:1,lookYaw:0,camYaw:0,camY:0,air:false,airTime:0};let active=false,parked=false,flooded=false;const p=model.position,probe=new T.Vector3(),b=world.bounds,down=(...n)=>n.some(k=>keys[k]);
 const height=(x,z,y)=>world.walkHeight(x,z,y+2);
 const water=(x,z,y)=>{const w=world.water?.at?.(x,z);return w&&!world.water.supported(x,z,y+2)?w:null};
 const blocked=(x,z)=>{if(x<b.minX||x>b.maxX||z<b.minZ||z>b.maxZ)return true;const w=water(x,z,p.y);if(w&&w.depth>1.4)return true;probe.set(x,p.y+1.5,z);return height(x,z,p.y)-p.y>V.stepUp||!world.free(x,z,p.y+1.5,probe)};
 function pose(){
  model.rotation.set(s.pitch,s.yaw,0);bike.rotation.z=s.lean;
  // Wheelies pivot the chassis about the rear contact patch.
  const a=s.wheelie,pz=L/2;body.rotation.x=a;body.position.set(0,pz*Math.sin(a)-s.squash,pz-pz*Math.cos(a));front.position.set(0,fr+L*Math.sin(a)-s.squash*.5,pz-L*Math.cos(a));front.rotation.set(-s.roll,s.steer*.6,0,'YXZ');rear.rotation.x=-s.roll;rider.visible=active;
 }
 function enter(position,yaw){if(!parked||Math.hypot(p.x-position.x,p.z-position.z)>6){p.set(position.x,height(position.x,position.z,position.y-2),position.z);s.yaw=yaw}Object.assign(s,{speed:0,vy:0,lean:0,steer:0,pitch:0,wheelie:0,squash:0,gear:1,rpm:V.idle,lookYaw:0,camYaw:s.yaw,camY:p.y,air:false,airTime:0});active=true;parked=false;flooded=false;model.visible=true;pose();follow(1)}
 // Getting off leaves the bike on its side stand and stands the rider beside it.
 function exit(){if(!active)return null;active=false;parked=true;p.y=height(p.x,p.z,p.y);Object.assign(s,{speed:0,vy:0,air:false,lean:.16,steer:.35,pitch:0,wheelie:0,squash:0});pose();const side=findLanding(world,p.x+Math.cos(s.yaw)*1.2,p.z-Math.sin(s.yaw)*1.2,{x:p.x,z:p.z});return{x:side.x,z:side.z,yaw:s.yaw}}
 function look(dx){if(!active)return false;s.lookYaw=T.MathUtils.clamp(s.lookYaw-dx*.003,-2.6,2.6);return true}
 function follow(k){s.camYaw+=Math.atan2(Math.sin(s.yaw-s.camYaw),Math.cos(s.yaw-s.camYaw))*k;s.camY+=(p.y-s.camY)*k;const yaw=s.camYaw+s.lookYaw,d=V.dist+Math.min(1.6,Math.abs(s.speed)*.03),ox=Math.sin(yaw)*d,oz=Math.cos(yaw)*d;camera.position.set(p.x+ox,Math.max(s.camY+2.2,height(p.x+ox,p.z+oz,s.camY)+1.2),p.z+oz);camera.lookAt(p.x,p.y+1.2,p.z)}
 function update(dt){
  if(!active)return;dt=Math.min(dt,.05);
  const f=Number(down('w','arrowup'))-Number(down('s','arrowdown')),turn=Number(down('a','arrowleft'))-Number(down('d','arrowright')),boost=down('shift'),brake=down(' '),pull=down('e'),fx=-Math.sin(s.yaw),fz=-Math.cos(s.yaw),w=water(p.x,p.z,p.y);
  flooded=!!(w&&w.depth>.9);
  const ahead=height(p.x+fx*1.5,p.z+fz*1.5,p.y),behind=height(p.x-fx*1.5,p.z-fz*1.5,p.y),grade=s.air?0:T.MathUtils.clamp((ahead-behind)/3,-.6,.6);
  // Engine: drive tapers towards the top speed; gears and rpm follow road speed.
  const top=(boost?V.boost:V.top)*(w?.35:1),drive=!flooded&&f>0&&!s.air?(boost?V.boostAccel:V.accel)*Math.max(0,1-Math.max(0,s.speed)/top)*(1+(dirt?0:Math.max(0,-grade))):0;
  s.speed+=(drive-grade*9.81*(dirt?.7:1)-s.speed*Math.abs(s.speed)*.00028-s.speed*(w?1.2:.02))*dt;
  if(!s.air){if(brake||f<0&&s.speed>.3)s.speed-=Math.sign(s.speed)*Math.min(Math.abs(s.speed),(brake&&f<0?11:9)*dt);else if(f<0&&!flooded)s.speed=Math.max(-2.5,s.speed-dt*3);if(!f&&!brake&&Math.abs(s.speed)<.2)s.speed=0}
  s.speed=T.MathUtils.clamp(s.speed,-2.5,V.boost+8);
  const span=V.boost/V.gears,gear=T.MathUtils.clamp(Math.ceil(Math.abs(s.speed)/span),1,V.gears),low=(gear-1)*span*.55,band=T.MathUtils.clamp((Math.abs(s.speed)-low)/(gear*span-low),0,1),rev=s.air&&f>0?V.redline:V.idle+(V.redline-V.idle)*(.12+.88*band)*(f>0||Math.abs(s.speed)>1?1:.1);s.gear=gear;s.rpm+=(flooded?0:rev-s.rpm)*(1-Math.exp(-dt*(s.air?4:9)));
  const grip=s.air?.15:1;s.steer+=(turn*(.42/(1+Math.abs(s.speed)*(dirt?.3:.22))+.015)-s.steer)*(1-Math.exp(-dt*6));s.yaw+=(s.speed*Math.tan(s.steer)/L*grip+(Math.abs(s.speed)<.6&&!s.air?turn*.8:0))*dt;
  // Substeps keep collision and ground-following stable at speed.
  const n=Math.max(1,Math.ceil(Math.abs(s.speed)*dt/.4)),h=dt/n;let hit=false;
  for(let i=0;i<n;i++){
   const x=p.x+fx*s.speed*h,z=p.z+fz*s.speed*h;if(!blocked(x,p.z))p.x=x;else hit=true;if(!blocked(p.x,z))p.z=z;else hit=true;
   const g=height(p.x,p.z,p.y);
   if(s.air){s.vy-=9.81*h;p.y+=s.vy*h;if(p.y<=g){const impact=-s.vy;p.y=g;s.air=false;s.squash=Math.min(.22,impact*.02);s.speed*=1-V.landLoss*Math.min(1,impact/14)*(Math.abs(s.wheelie+s.pitch-Math.atan(grade))>.6?2:1);s.vy=0}}
   else{const want=(g-p.y)/h;if(want<s.vy-9.81*h-1.2&&Math.abs(s.speed)>7){s.air=true;s.airTime=0;s.vy=Math.max(s.vy,0);s.vy-=9.81*h;p.y+=s.vy*h}else{s.vy=T.MathUtils.clamp(want,-30,30);p.y=g}}
  }
  if(hit){s.speed*=-.2;s.vy=Math.min(s.vy,0)}
  s.airTime=s.air?s.airTime+dt:0;
  // Attitude: follow the slope on the ground; in the air the nose drifts down unless E pulls it back.
  const slope=Math.atan(grade);s.pitch+=((s.air?T.MathUtils.clamp(Math.atan2(s.vy,Math.max(4,Math.abs(s.speed)))*.6+(pull?.35:0),-.6,.7):slope)-s.pitch)*(1-Math.exp(-dt*(s.air?1.6:10)));
  const wheelie=!s.air&&pull&&s.speed>2&&!flooded?(dirt?.62:.5)*(f>0?1:.6):0;s.wheelie+=(wheelie-s.wheelie)*(1-Math.exp(-dt*(wheelie>s.wheelie?3:5)));s.squash*=Math.exp(-dt*8);
  s.lean+=((s.air?s.lean*.5:T.MathUtils.clamp(Math.atan(s.speed*Math.abs(s.speed)*Math.tan(s.steer)/L/9.81),-.75,.75))-s.lean)*(1-Math.exp(-dt*5));s.roll+=s.speed/R*dt;
  if(Math.abs(s.speed)>1)s.lookYaw*=Math.exp(-dt*1.2);pose();follow(1-Math.exp(-dt*(s.air?2.5:5)));
 }
 return{enter,exit,look,update,variant,label:V.label,get active(){return active},get parked(){return parked},get speed(){return s.speed},get gear(){return s.gear},get rpm(){return s.rpm},get airborne(){return s.air},get airTime(){return s.airTime},get position(){return p},get yaw(){return s.yaw},
  soundState(){return active?{kind:'moto',speed:Math.abs(s.speed),rpm:s.rpm,gear:s.gear,cylinders:V.cylinders,dirt,flooded,inWater:!!water(p.x,p.z,p.y)}:null},model};
}
