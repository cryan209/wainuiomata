import * as T from './vendor/three.js';

// Mapped road/rail level crossings (railways.json levelCrossings, from scripts/rail_grade_separation.py).
// Rubber crossing panels, flashing lights with crossbucks and, on electrified urban roads, half barrier arms.
// Equipment is a generic NZ-style approximation, not a survey of each crossing's hardware.
const WARN_SECONDS=25,OCCUPIED=28,ARM_DELAY=3,ARM_SPEED=.32;
// Plain colours stand in where there is no 2D canvas (Node checks stub document).
function canvasTexture(width,height,draw){
 try{const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;draw(canvas.getContext('2d'));const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;return texture}catch{return null}
}
export function crossingActive(c,trains){
 for(const train of trains){const s=c.routeS?.get(train);if(s===undefined)continue;const ahead=(s-train.distance)*train.direction;
  if(Math.abs(ahead)<OCCUPIED)return true;
  if(ahead>0&&ahead<Math.max(150,(train.speed||0)*WARN_SECONDS)&&(train.speed||0)>.5)return true;}
 return false;
}
export function createLevelCrossings(scene,crossings=[],{datum=0,trains=[]}={}){
 if(!crossings?.length)return{list:[],update(){}};
 const dummy=new T.Object3D(),panels=[],list=[];
 const crossbuck=canvasTexture(256,256,c=>{c.translate(128,128);for(const a of [Math.PI/4,-Math.PI/4]){c.save();c.rotate(a);c.fillStyle='#b8272b';c.fillRect(-124,-22,248,44);c.fillStyle='#f3f1e8';c.fillRect(-118,-16,236,32);c.restore()}c.fillStyle='#b8272b';c.font='bold 15px sans-serif';c.textAlign='center';c.textBaseline='middle';c.save();c.rotate(-Math.PI/4);c.fillText('RAILWAY',0,1);c.restore();c.save();c.rotate(Math.PI/4);c.fillText('CROSSING',0,1);c.restore()});
 const stripes=canvasTexture(128,8,c=>{for(let i=0;i<8;i++){c.fillStyle=i%2?'#f2f0ea':'#c7262b';c.fillRect(i*16,0,16,8)}});
 const materials={panel:new T.MeshLambertMaterial({color:'#3a3a36'}),post:new T.MeshLambertMaterial({color:'#e9e8e1'}),board:new T.MeshLambertMaterial({color:'#1d1f1f'}),
  sign:new T.MeshLambertMaterial({color:crossbuck?'#ffffff':'#d9d6cc',map:crossbuck,transparent:!!crossbuck,alphaTest:.5,side:T.DoubleSide}),
  arm:new T.MeshLambertMaterial({color:stripes?'#ffffff':'#d8443f',map:stripes}),
  lampOff:new T.MeshLambertMaterial({color:'#4a1612'}),lampOn:new T.MeshBasicMaterial({color:'#ff3b24'})};
 const geometry={post:new T.BoxGeometry(.14,1,.14),board:new T.BoxGeometry(1.25,.55,.08),lamp:new T.CylinderGeometry(.17,.17,.06,16).rotateX(Math.PI/2),hood:new T.BoxGeometry(.4,.06,.22),sign:new T.PlaneGeometry(1.35,1.35),arm:new T.BoxGeometry(1,.12,.1).translate(.5,0,0),pedestal:new T.BoxGeometry(.5,1.1,.5)};
 for(const c of crossings){
  const y=c.h-datum,group=new T.Group(),lamps=[],arms=[];group.position.set(c.x,y,c.z);
  for(const t of c.tracks)panels.push({x:t.x,y:t.h-datum+.12,z:t.z,yaw:Math.atan2(t.tdx,t.tdz),length:t.panel*2});
  if(c.lights)for(const sign of [1,-1]){
   const vx=c.rdx*sign,vz=c.rdz*sign,lx=vz,lz=-vx,side=c.width/2+.9,px=-vx*(c.across+1.6)+lx*side,pz=-vz*(c.across+1.6)+lz*side,face=Math.atan2(-vx,-vz);
   const post=new T.Mesh(geometry.post,materials.post);post.scale.y=3.9;post.position.set(px,1.95,pz);group.add(post);
   const head=new T.Group();head.position.set(px,0,pz);head.rotation.y=face;group.add(head);
   const board=new T.Mesh(geometry.board,materials.board);board.position.set(0,2.55,.1);head.add(board);
   for(const k of [-1,1]){const lamp=new T.Mesh(geometry.lamp,materials.lampOff);lamp.position.set(k*.36,2.55,.17);head.add(lamp);lamps.push({mesh:lamp,phase:k>0?1:0});const hood=new T.Mesh(geometry.hood,materials.board);hood.position.set(k*.36,2.75,.22);head.add(hood)}
   const cross=new T.Mesh(geometry.sign,materials.sign);cross.position.set(0,3.45,.12);head.add(cross);
   if(c.barrier){const ped=new T.Mesh(geometry.pedestal,materials.board);ped.position.set(px-vx*1.1,.55,pz-vz*1.1);group.add(ped);
    // Local +x points across the approach lanes; rotating about local z raises the arm.
    const pivot=new T.Group();pivot.position.set(px-vx*1.1,1.05,pz-vz*1.1);pivot.rotation.set(0,face,Math.PI/2);
    const arm=new T.Mesh(geometry.arm,materials.arm);arm.scale.x=Math.max(2.5,c.width/2+.6);pivot.add(arm);group.add(pivot);arms.push(pivot)}
  }
  group.userData.surface='rail-level-crossing';group.traverse(o=>{o.updateMatrix();o.matrixAutoUpdate=false});scene.add(group);
  const routeS=new Map();for(const train of trains){const hit=train.path.nearest?.(c.x,c.z);if(hit&&hit.distance<6)routeS.set(train,hit.s)}
  list.push({x:c.x,z:c.z,y,across:c.across,width:c.width,name:c.name,barrier:c.barrier,closed:false,activeFor:0,armAngle:Math.PI/2,group,lamps,arms,routeS});
 }
 if(panels.length){const mesh=new T.InstancedMesh(new T.BoxGeometry(2.7,.14,1),materials.panel,panels.length);panels.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.yaw,0);dummy.scale.set(1,1,p.length);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix)});mesh.computeBoundingSphere();mesh.matrixAutoUpdate=false;mesh.userData.surface='rail-crossing-panels';scene.add(mesh)}
 let clock=0;
 function update(dt,camera){
  clock+=dt;const flash=Math.floor(clock*1.6)%2;
  for(const c of list){
   const near=!camera||Math.hypot(c.x-camera.x,c.z-camera.z)<1900;c.group.visible=near;if(!near){c.closed=false;continue}
   c.closed=crossingActive(c,trains);c.activeFor=c.closed?c.activeFor+dt:0;
   for(const lamp of c.lamps)lamp.mesh.material=c.closed&&lamp.phase===flash?materials.lampOn:materials.lampOff;
   const target=c.closed&&c.activeFor>ARM_DELAY?0:Math.PI/2;if(c.armAngle!==target){c.armAngle=target>c.armAngle?Math.min(target,c.armAngle+ARM_SPEED*dt):Math.max(target,c.armAngle-ARM_SPEED*dt);for(const pivot of c.arms){pivot.rotation.z=c.armAngle;pivot.updateMatrix()}}
  }
 }
 return{list,update};
}
