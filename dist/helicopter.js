import * as T from './vendor/three.js';
import {findLanding} from './movement.js?v=audio-music-58';
// Fast-travel helicopter: free flight like the drone (no building/water collision), but flown as a vehicle with a visible low-poly airframe, spinning rotors, banked turns and a chase camera.
export function createHelicopter({scene,world,camera,keys}){
 const mat=c=>new T.MeshLambertMaterial({color:c,flatShading:true}),paint=mat('#c8402e'),trim=mat('#f1ead2'),dark=mat('#2a2e30'),glass=new T.MeshLambertMaterial({color:'#7fb2c8',transparent:true,opacity:.72,flatShading:true});
 const box=(w,h,d,m,x=0,y=0,z=0)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x,y,z);return o};
 const body=new T.Group(),model=new T.Group();model.add(body);
 const cabin=new T.Mesh(new T.SphereGeometry(1.25,8,6),paint);cabin.scale.set(1,1,1.65);cabin.position.set(0,1.75,-.2);
 const canopy=new T.Mesh(new T.SphereGeometry(1.08,8,5,0,Math.PI*2,0,Math.PI*.55),glass);canopy.scale.set(1,.95,1.2);canopy.rotation.x=-1.05;canopy.position.set(0,1.95,-1.05);
 const stripe=box(2.52,.22,3.4,trim,0,1.45,-.1),engine=box(1.1,.6,1.8,dark,0,3,.55);
 const boom=new T.Mesh(new T.CylinderGeometry(.18,.38,5.4,6),paint);boom.rotation.x=Math.PI/2;boom.position.set(0,2.15,4);
 const fin=box(.12,1.4,.9,paint,0,2.8,6.6),stab=box(1.8,.08,.5,trim,0,2.2,6.2);
 const mast=new T.Mesh(new T.CylinderGeometry(.1,.1,.55,6),dark);mast.position.y=3.5;
 body.add(cabin,canopy,stripe,engine,boom,fin,stab,mast);
 for(const s of [-1,1]){body.add(box(.12,.12,3.8,dark,s*.95,.08,-.15));for(const z of [-1.1,.8]){const strut=box(.08,.9,.08,dark,s*.82,.5,z);strut.rotation.z=s*.28;body.add(strut)}}
 const rotor=new T.Group();rotor.position.y=3.8;for(let i=0;i<2;i++){const blade=box(.3,.05,10.4,dark);blade.rotation.y=i*Math.PI/2;rotor.add(blade)}rotor.add(box(.5,.18,.5,trim));
 const disc=new T.Mesh(new T.CircleGeometry(5.2,16),new T.MeshBasicMaterial({color:'#222',transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide}));disc.rotation.x=-Math.PI/2;rotor.add(disc);body.add(rotor);
 const tail=new T.Group();tail.position.set(.14,2.85,6.75);for(let i=0;i<2;i++){const b=box(.04,1.5,.16,dark);b.rotation.x=i*Math.PI/2;tail.add(b)}body.add(tail);
 model.visible=false;scene.add(model);
 const s={yaw:0,vx:0,vz:0,vy:0,bank:0,tilt:0,spin:0,rotorSpeed:0,camYaw:0,camPitch:-.18,camY:0};let active=false,parked=false;const p=model.position;
 const floor=(x,z)=>Math.max(world.ground(x,z),world.water?.at?.(x,z)?.y??-Infinity);
 const b=world.bounds,down=(...n)=>n.some(k=>keys[k]);
 function enter(position,yaw){if(!parked||Math.hypot(p.x-position.x,p.z-position.z)>30){p.set(position.x,Math.max(floor(position.x,position.z)+.05,position.y??-Infinity),position.z);s.yaw=yaw}else s.yaw=model.rotation.y;Object.assign(s,{vx:0,vz:0,vy:0,bank:0,tilt:0,camYaw:s.yaw,camPitch:-.18,camY:p.y});active=true;parked=false;model.visible=true;s.rotorSpeed=Math.max(s.rotorSpeed,6);place(0)}
 // Leaving the helicopter sets it down on nearby free ground and stands the pilot beside it, like the drone landing.
 function exit(fallback){if(!active)return null;active=false;const l=findLanding(world,p.x,p.z,fallback||{x:p.x,z:p.z});p.set(l.x,floor(l.x,l.z)+.05,l.z);model.rotation.set(0,s.yaw,0);body.rotation.set(0,0,0);parked=true;const side=findLanding(world,l.x+Math.cos(s.yaw)*4.5,l.z-Math.sin(s.yaw)*4.5,l);return{x:side.x,z:side.z,yaw:s.yaw}}
 function look(dx,dy){if(!active)return false;s.yaw-=dx*.0022;s.camPitch=T.MathUtils.clamp(s.camPitch-dy*.002,-.9,.35);return true}
 function place(dt){model.rotation.set(0,s.yaw,0);body.rotation.set(s.tilt,0,s.bank,'YXZ');s.spin+=s.rotorSpeed*dt;rotor.rotation.y=s.spin;tail.rotation.x=s.spin*1.6;disc.material.opacity=Math.min(.22,s.rotorSpeed*.012)}
 function update(dt){
  if(!active){if(parked&&s.rotorSpeed>0){s.rotorSpeed=Math.max(0,s.rotorSpeed-dt*4);place(dt)}return}
  const f=Number(down('w','arrowup'))-Number(down('s','arrowdown')),turn=Number(down('a','arrowleft'))-Number(down('d','arrowright')),lift=Number(down(' ','e'))-Number(down('c','q','control')),boost=down('shift');
  const cruise=boost?160:75;s.rotorSpeed+=(26-s.rotorSpeed)*(1-Math.exp(-dt*1.5));s.yaw+=turn*dt*(1.1-Math.min(.5,Math.hypot(s.vx,s.vz)/400));
  const fx=-Math.sin(s.yaw),fz=-Math.cos(s.yaw),k=1-Math.exp(-dt*(f?1.1:.7));s.vx+=(fx*f*cruise*(f<0?.35:1)-s.vx)*k;s.vz+=(fz*f*cruise*(f<0?.35:1)-s.vz)*k;s.vy+=(lift*(boost?80:32)-s.vy)*(1-Math.exp(-dt*2.5));
  const warm=s.rotorSpeed>18;p.x=T.MathUtils.clamp(p.x+(warm?s.vx:0)*dt,b.minX,b.maxX);p.z=T.MathUtils.clamp(p.z+(warm?s.vz:0)*dt,b.minZ,b.maxZ);p.y=Math.min(3000,p.y+(warm||s.vy<0?s.vy:0)*dt);
  const ng=floor(p.x,p.z);if(p.y<ng+.05){p.y=ng+.05;s.vy=Math.max(0,s.vy)}else if(p.y<ng+1.5&&!lift&&Math.hypot(s.vx,s.vz)>8)p.y+=(ng+1.5-p.y)*(1-Math.exp(-dt*3));
  const speed=Math.hypot(s.vx,s.vz),fwd=s.vx*fx+s.vz*fz;s.bank+=(turn*Math.min(.45,.12+speed/260)-s.bank)*(1-Math.exp(-dt*3));s.tilt+=(-T.MathUtils.clamp(fwd/cruise,-.4,1)*.22-s.tilt)*(1-Math.exp(-dt*2.5));place(dt);
  // Chase camera trails the heading with easing, climbs with the aircraft and stays clear of terrain behind it.
  s.camYaw+=Math.atan2(Math.sin(s.yaw-s.camYaw),Math.cos(s.yaw-s.camYaw))*(1-Math.exp(-dt*3.5));s.camY+=(p.y-s.camY)*(1-Math.exp(-dt*5));
  const dist=11.5+speed*.04,ox=Math.sin(s.camYaw)*Math.cos(s.camPitch)*dist,oz=Math.cos(s.camYaw)*Math.cos(s.camPitch)*dist,cy=s.camY+3.2-Math.sin(s.camPitch)*dist;
  camera.position.set(p.x+ox,Math.max(cy,floor(p.x+ox,p.z+oz)+2.5),p.z+oz);camera.lookAt(p.x-ox*.12,p.y+3.4,p.z-oz*.12);
 }
 return{enter,exit,look,update,get active(){return active},get altitude(){return p.y-floor(p.x,p.z)},get speed(){return Math.hypot(s.vx,s.vz)},
  // Rotor drone through the shared engine voice; inWater silences the car tyre rumble.
  soundState(){return active?{kind:'heli',speed:Math.hypot(s.vx,s.vz)*.2,rpm:s.rotorSpeed*36,cylinders:4,inWater:true}:null},model};
}
