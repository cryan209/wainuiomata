import * as T from './vendor/three.js';
import {findLanding} from './movement.js?v=audio-music-58';
// Rideable bicycle: pedal-powered ground vehicle using the walking collision rules, with a low-poly frame and rider, spinning wheels/cranks, lean into turns, coasting on hills and a low chase camera.
export function createBicycle({scene,world,camera,keys}){
 const mat=c=>new T.MeshLambertMaterial({color:c,flatShading:true}),frameM=mat('#2f7fb0'),dark=mat('#1f2224'),metal=mat('#b8bcc0'),skin=mat('#c99a74'),shirt=mat('#e3b23c'),pants=mat('#33415c');
 const box=(w,h,d,m,x=0,y=0,z=0)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x,y,z);return o};
 const tube=(a,b,r,m)=>{const A=new T.Vector3(...a),B=new T.Vector3(...b),o=new T.Mesh(new T.CylinderGeometry(r,r,A.distanceTo(B),5),m);o.position.copy(A).add(B).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),B.sub(A).normalize());return o};
 const R=.34,model=new T.Group(),bike=new T.Group();model.add(bike);
 const wheel=z=>{const w=new T.Group();w.position.set(0,R,z);const rim=new T.Mesh(new T.TorusGeometry(R,.035,4,14),dark);rim.rotation.y=Math.PI/2;w.add(rim);for(let i=0;i<3;i++){const s=box(.02,R*2,.02,metal);s.rotation.x=i*Math.PI/3;w.add(s)}bike.add(w);return w};
 const front=wheel(-.52),rear=wheel(.52),bb=[0,.36,.05],seat=[0,.92,.24],head=[0,.9,-.4];
 bike.add(tube(bb,seat,.022,frameM),tube(bb,head,.024,frameM),tube(seat,head,.02,frameM),tube(bb,[0,R,.52],.017,frameM),tube(seat,[0,R,.52],.017,frameM),tube(head,[0,R,-.52],.02,metal),box(.12,.05,.26,dark,0,.96,.26),box(.5,.03,.03,dark,0,1.04,-.44),tube(head,[0,1.04,-.44],.02,metal));
 const crank=new T.Group();crank.position.set(...bb);bike.add(crank);for(const s of [-1,1]){const arm=box(.02,.17,.03,metal,s*.07,s*.07,0);crank.add(arm,box(.09,.025,.06,dark,s*.11,s*.15,0))}
 // Rider: hips over the saddle, legs pivot at the hip and follow the crank phase.
 const rider=new T.Group();rider.position.set(0,1.02,.22);bike.add(rider);const torso=box(.34,.56,.2,shirt,0,.3,-.12);torso.rotation.x=-.5;rider.add(torso,box(.2,.22,.2,skin,0,.68,-.3),box(.22,.08,.22,pants,0,.79,-.29));
 for(const s of [-1,1]){const arm=tube([s*.18,.5,-.22],[s*.22,.02,-.66],.04,shirt);rider.add(arm)}
 const legs=[-1,1].map(s=>{const hip=new T.Group();hip.position.set(s*.11,0,0);const thigh=box(.13,.42,.14,pants,0,-.21,0),knee=new T.Group();knee.position.y=-.42;knee.add(box(.11,.4,.12,pants,0,-.2,0),box(.11,.07,.2,dark,0,-.42,-.04));hip.add(thigh,knee);rider.add(hip);return{hip,knee,s}});
 model.visible=false;scene.add(model);
 const s={yaw:0,speed:0,lean:0,steer:0,crank:0,roll:0,lookYaw:0,camYaw:0,camY:0};let active=false,parked=false;const p=model.position,probe=new T.Vector3(),b=world.bounds,down=(...n)=>n.some(k=>keys[k]);
 const height=(x,z,y)=>world.walkHeight(x,z,y+2);
 const water=(x,z,y)=>{const w=world.water?.at?.(x,z);return w&&!world.water.supported(x,z,y+2)?w:null};
 const allowed=(x,z)=>{probe.set(x,p.y+2,z);const w=water(x,z,p.y);if(w&&w.depth>.55)return false;return x>=b.minX&&x<=b.maxX&&z>=b.minZ&&z<=b.maxZ&&Math.abs(height(x,z,p.y)-p.y)<1.2&&world.free(x,z,p.y+2,probe)};
 function pose(){model.rotation.set(0,s.yaw,0);bike.rotation.set(0,0,s.lean);front.rotation.set(-s.roll,s.steer*.5,0,'YXZ');rear.rotation.x=-s.roll;crank.rotation.x=-s.crank;for(const l of legs){const a=s.crank+(l.s>0?0:Math.PI);l.hip.rotation.x=.7+Math.sin(a)*.4;l.knee.rotation.x=-1-Math.cos(a)*.4}rider.visible=active}
 function enter(position,yaw){if(!parked||Math.hypot(p.x-position.x,p.z-position.z)>6){p.set(position.x,height(position.x,position.z,position.y-2),position.z);s.yaw=yaw}Object.assign(s,{speed:0,lean:0,steer:0,lookYaw:0,camYaw:s.yaw,camY:p.y});active=true;parked=false;model.visible=true;pose();follow(1)}
 // Dismounting stands the rider beside the bike, which stays parked on its stand.
 function exit(){if(!active)return null;active=false;parked=true;s.speed=0;s.lean=.12;s.steer=.3;pose();const side=findLanding(world,p.x+Math.cos(s.yaw)*1.1,p.z-Math.sin(s.yaw)*1.1,{x:p.x,z:p.z});return{x:side.x,z:side.z,yaw:s.yaw}}
 function look(dx,dy){if(!active)return false;s.lookYaw=T.MathUtils.clamp(s.lookYaw-dx*.003,-2.6,2.6);return true}
 function follow(k){s.camYaw+=Math.atan2(Math.sin(s.yaw-s.camYaw),Math.cos(s.yaw-s.camYaw))*k;s.camY+=(p.y-s.camY)*k;const yaw=s.camYaw+s.lookYaw,d=4.4,ox=Math.sin(yaw)*d,oz=Math.cos(yaw)*d;camera.position.set(p.x+ox,Math.max(s.camY+2.1,height(p.x+ox,p.z+oz,s.camY)+1.2),p.z+oz);camera.lookAt(p.x,p.y+1.25,p.z)}
 function update(dt){
  if(!active)return;
  const f=Number(down('w','arrowup'))-Number(down('s','arrowdown')),turn=Number(down('a','arrowleft'))-Number(down('d','arrowright')),boost=down('shift'),brake=down(' ');
  const fx=-Math.sin(s.yaw),fz=-Math.cos(s.yaw),ahead=height(p.x+fx*1.5,p.z+fz*1.5,p.y),behind=height(p.x-fx*1.5,p.z-fz*1.5,p.y),grade=T.MathUtils.clamp((ahead-behind)/3,-.35,.35),w=water(p.x,p.z,p.y);
  const top=(boost?15:9)*(w?.45:1),push=f>0?(s.speed<top?(boost?4.2:2.8):0):0;
  s.speed+=(push-grade*9.81*.9-s.speed*(w?.9:.06))*dt;if(brake||f<0&&s.speed>.3)s.speed-=Math.sign(s.speed)*Math.min(Math.abs(s.speed),7*dt);else if(f<0)s.speed=Math.max(-2,s.speed-dt*3);if(!f&&!brake&&Math.abs(s.speed)<.15)s.speed=0;if(f>=0&&!brake&&s.speed<0&&grade>-.01)s.speed=Math.min(0,s.speed+dt*4);s.speed=T.MathUtils.clamp(s.speed,-2,22);
  s.steer+=(turn*(.4/(1+Math.abs(s.speed)*.5)+.02)-s.steer)*(1-Math.exp(-dt*7));s.yaw+=s.speed*Math.tan(s.steer)/1.04*dt+(Math.abs(s.speed)<.5?turn*dt*.9:0);
  const x=p.x+fx*s.speed*dt,z=p.z+fz*s.speed*dt;let hit=false;if(allowed(x,p.z))p.x=x;else hit=true;if(allowed(p.x,z))p.z=z;else hit=true;if(hit)s.speed*=-.15;
  const h=height(p.x,p.z,p.y);p.y+=(h-p.y)*(1-Math.exp(-dt*14));
  s.lean+=(T.MathUtils.clamp(Math.atan(s.speed*Math.abs(s.speed)*Math.tan(s.steer)/1.04/9.81),-.55,.55)-s.lean)*(1-Math.exp(-dt*5));s.roll+=s.speed/R*dt;if(f>0||s.speed>.5&&push)s.crank+=Math.max(2,s.speed/R/2.6)*dt;
  if(Math.abs(s.speed)>1)s.lookYaw*=Math.exp(-dt*1.2);pose();follow(1-Math.exp(-dt*4));
 }
 return{enter,exit,look,update,get active(){return active},get speed(){return s.speed},get position(){return p},
  // No engine: flooded mutes the engine voice and leaves the tyre rumble; H rings through the horn voice.
  soundState(){return active?{kind:'bike',speed:Math.abs(s.speed),flooded:true,inWater:!!water(p.x,p.z,p.y)}:null},model};
}
