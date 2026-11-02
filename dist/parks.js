import * as T from './vendor/three.js';
import {createHumanRenderer} from './people.js?v=crowd-1';
// Park furniture, play equipment, pitch markings, dog-park fencing and the dogs themselves are
// illustrative and placed procedurally inside mapped open-space outlines; they are not a survey of council assets.
const FURNISHED=new Set(['park','playground','pitch','recreation_ground','dog_park']);
export function seeded(id){let a=2166136261;for(const c of String(id))a=Math.imul(a^c.charCodeAt(0),16777619);return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
export function inside(ring,x,z){let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])hit=!hit}return hit}
export function ringArea(r){let s=0;for(let i=1;i<r.length;i++)s+=r[i-1][0]*r[i][1]-r[i][0]*r[i-1][1];return Math.abs(s)/2}
function segDist(x,z,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz||1,t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/l));return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)}
export function edgeDistance(ring,x,z){let d=Infinity;for(let i=1;i<ring.length;i++)d=Math.min(d,segDist(x,z,ring[i-1],ring[i]));return d}
// Inward-facing samples spaced along the outline, `inset` metres inside it.
function perimeter(ring,spacing,inset,start=spacing/2){const out=[];let carry=start;for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);if(l<.01)continue;let nx=-dz/l,nz=dx/l;const mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2;if(!inside(ring,mx+nx*.3,mz+nz*.3)){nx=-nx;nz=-nz}for(let s=carry;s<l;s+=spacing){const x=a[0]+dx*s/l+nx*inset,z=a[1]+dz*s/l+nz*inset;if(inside(ring,x,z)&&edgeDistance(ring,x,z)>inset*.8)out.push({x,z,nx,nz,ex:dx/l,ez:dz/l})}carry=((carry-l)%spacing+spacing)%spacing}return out}
export function orientedRect(ring){let best=null;for(let i=1;i<ring.length;i++){const dx=ring[i][0]-ring[i-1][0],dz=ring[i][1]-ring[i-1][1],l=Math.hypot(dx,dz);if(l<.5)continue;const ux=dx/l,uz=dz/l;let a0=Infinity,a1=-Infinity,b0=Infinity,b1=-Infinity;for(const[x,z]of ring){const a=x*ux+z*uz,b=-x*uz+z*ux;a0=Math.min(a0,a);a1=Math.max(a1,a);b0=Math.min(b0,b);b1=Math.max(b1,b)}const area=(a1-a0)*(b1-b0);if(!best||area<best.area)best={area,ux,uz,a0,a1,b0,b1}}
 if(!best)return null;const{ux,uz,a0,a1,b0,b1}=best,ca=(a0+a1)/2,cb=(b0+b1)/2;let length=a1-a0,width=b1-b0,ax=ux,az=uz;if(width>length){[length,width]=[width,length];ax=-uz;az=ux}
 return{x:ca*ux-cb*uz,z:ca*uz+cb*ux,ux:ax,uz:az,length,width,fill:ringArea(ring)/best.area}}
function interiorPoint(ring){const xs=ring.map(p=>p[0]),zs=ring.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),z0=Math.min(...zs),z1=Math.max(...zs);let best={x:(x0+x1)/2,z:(z0+z1)/2,d:-1};for(let i=0;i<=14;i++)for(let j=0;j<=14;j++){const x=x0+(x1-x0)*i/14,z=z0+(z1-z0)*j/14;if(!inside(ring,x,z))continue;const d=edgeDistance(ring,x,z);if(d>best.d)best={x,z,d}}return best}
// A dog area is fenced unless it is an open beach/zone or a shared parade ground.
export const fencedDogPark=f=>f.kind==='dog_park'&&!/beach|zone|parade ground/i.test(f.name||'');
export function planPark(feature,{height,clear=()=>true,roadDistance=()=>Infinity}){
 const ring=feature.rings[0],area=ringArea(ring),random=seeded(feature.id),boxes=[],panels=[],colliders=[],signs=[],plan={id:feature.id,name:feature.name,kind:feature.kind,ring,area,boxes,panels,colliders,signs,dogs:0,smallDogs:false};
 const level=(x,z)=>{const y=height(x,z),slope=Math.max(Math.abs(height(x+1,z)-y),Math.abs(height(x,z+1)-y));return slope<.28?y:null};
 // Items are authored facing local -z (sign faces read along local +z, towards approaching visitors); yaw follows the pedestrian convention (atan2(-dx,-dz)).
 function item(x,z,yaw,build,radius=.6,force=false){if(!force&&(!clear(x,z)||roadDistance(x,z)<4))return false;const y=level(x,z);if(y===null&&!force)return false;const base=y??height(x,z),c=Math.cos(yaw),s=Math.sin(yaw);
  const put=(m,u,h,v,w,hh,d,tilt=0,turn=0)=>boxes.push({m,x:x+u*c+v*s,y:base+h,z:z-u*s+v*c,w,h:hh,d,yaw:yaw+turn,tilt});
  const block=(u,v,r)=>colliders.push({x:x+u*c+v*s,z:z-u*s+v*c,r,y:base});build(put,block,base);if(radius)block(0,0,radius);return true}
 const facing=(p)=>Math.atan2(-p.nx,-p.nz);
 const bench=(put,block)=>{put('timber',0,.46,0,1.8,.07,.42);put('timber',0,.78,.2,1.8,.3,.05);for(const u of[-.75,.75])put('metal',u,.22,0,.07,.44,.4);block(-.5,0,.45);block(.5,0,.45)};
 const bin=(put)=>{put('green',0,.45,0,.5,.9,.5);put('dark',0,.93,0,.56,.06,.56)};
 const picnic=(put,block)=>{put('timber',0,.74,0,1.9,.06,.8);for(const v of[-.62,.62])put('timber',0,.45,v,1.9,.05,.28);for(const u of[-.7,.7]){put('timber',u,.37,-.35,.08,.8,.08,-.45);put('timber',u,.37,.35,.08,.8,.08,.45)}block(-.5,0,.8);block(.5,0,.8)};
 const sign=(x,z,yaw,lines)=>item(x,z,yaw,(put,block,base)=>{for(const u of[-.7,.7]){put('post',u,.75,0,.1,1.5,.1);block(u,0,.2)}signs.push({x,z,y:base+1.22,yaw,lines})},0,true);
 if(feature.kind==='dog_park')planDogPark();
 else if(feature.kind==='playground')planPlayground();
 else if(feature.kind==='pitch')planPitch();
 else planLawn();
 return plan;
 function planLawn(){if(area<350)return;const edge=perimeter(ring,Math.max(45,Math.sqrt(area)*.9),2.5);let placed=0;
  for(const p of edge){if(placed>=6)break;if(item(p.x,p.z,facing(p),bench)){placed++;if(placed%2)item(p.x+p.ex*1.6,p.z+p.ez*1.6,facing(p),bin,.35)}}
  const tables=area>3000?1+(area>15000):0;for(let i=0,n=0;i<40&&n<tables;i++){const xs=ring.map(p=>p[0]),zs=ring.map(p=>p[1]),x=Math.min(...xs)+random()*(Math.max(...xs)-Math.min(...xs)),z=Math.min(...zs)+random()*(Math.max(...zs)-Math.min(...zs));if(inside(ring,x,z)&&edgeDistance(ring,x,z)>5&&item(x,z,random()*Math.PI,picnic,0))n++}
  if(feature.name&&feature.kind==='park'&&edge.length){const p=edge.reduce((a,b)=>roadDistance(b.x,b.z)<roadDistance(a.x,a.z)?b:a);sign(p.x+p.ex*3,p.z+p.ez*3,facing(p),[feature.name.toUpperCase(),'Hutt reserves · Please keep it tidy'])}}
 function planPlayground(){const rect=orientedRect(ring);if(!rect||rect.length<4)return;const L=Math.min(rect.length-1.5,20),W=Math.min(rect.width-1.5,14),yaw=Math.atan2(-rect.uz,rect.ux)-Math.PI/2,colors=[['red','yellow'],['blue','yellow'],['green','red'],['yellow','blue']][Math.floor(random()*4)];
  item(rect.x,rect.z,Math.atan2(-rect.ux,-rect.uz),put=>put('rubber',0,.02,0,W,.04,L),0,true);
  const at=u=>({x:rect.x+rect.ux*u,z:rect.z+rect.uz*u});
  const tower=(put,block)=>{for(const u of[-.6,.6])for(const v of[-.6,.6])put(colors[0],u,.95,v,.1,1.9,.1);put('timber',0,1.4,0,1.3,.08,1.3);put(colors[1],0,2,0,1.5,.12,1.5);put('timber',0,.9,-.62,1.2,.08,.05);
   put(colors[1],0,.75,1.95,.6,.06,2.9,.49);for(const u of[-.32,.32])put(colors[1],u,.85,1.95,.04,.2,2.9,.49);for(const u of[-.25,.25])put('metal',u,.7,-1,.05,1.6,.05,-.3);for(let i=1;i<5;i++)put('metal',0,i*.3,-.84-i*.09,.5,.04,.04);block(0,0,1);block(0,2.4,.5)};
  const swing=(put,block)=>{for(const u of[-1.8,1.8]){put('metal',u,1.15,-.5,.08,2.5,.08,-.41);put('metal',u,1.15,.5,.08,2.5,.08,.41);block(u,-1,.2);block(u,1,.2)}put('metal',0,2.3,0,3.8,.1,.1);for(const u of[-.8,.8]){for(const k of[-.2,.2])put('galv',u+k,1.55,0,.03,1.5,.03);put('rubber',u,.62,0,.45,.05,.2)}};
  const rider=(put)=>{put('galv',0,.25,0,.12,.5,.12);put(colors[0],0,.62,0,.3,.32,.8);put('dark',0,.9,-.28,.4,.05,.05)};
  if(L>=11){const s=at(-L/4),t=at(L/4);item(s.x,s.z,yaw,swing,0,true);item(t.x,t.z,yaw+Math.PI/2,tower,0,true);const r=at(L/4+3.2);if(L>=16)item(r.x+rect.uz*2.5,r.z-rect.ux*2.5,yaw,rider,.4,true)}
  else{item(rect.x,rect.z,yaw+Math.PI/2,tower,0,true);if(W>=6){const r=at(0);item(r.x+rect.uz*2.6,r.z-rect.ux*2.6,yaw,rider,.4,true)}}
  const edge=perimeter(ring,30,1.2);if(edge.length)item(edge[0].x,edge[0].z,facing(edge[0]),bench)}
 function planPitch(){const rect=orientedRect(ring);if(!rect||rect.fill<.75)return;const L=rect.length-8,W=rect.width-8;if(L<22||W<14||L>150)return;
  const{ux,uz}=rect,vx=-uz,vz=ux,P=(u,v)=>[rect.x+ux*u+vx*v,rect.z+uz*u+vz*v];
  const line=(a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz),n=Math.max(1,Math.ceil(l/6));for(let i=0;i<n;i++){const x=a[0]+dx*(i+.5)/n,z=a[1]+dz*(i+.5)/n;boxes.push({m:'line',x,y:height(x,z)+.015,z,w:.1,h:.03,d:l/n+.05,yaw:Math.atan2(dx,dz),tilt:0})}};
  const rect2=(u0,u1,v0,v1)=>{line(P(u0,v0),P(u1,v0));line(P(u1,v0),P(u1,v1));line(P(u1,v1),P(u0,v1));line(P(u0,v1),P(u0,v0))};
  rect2(-L/2,L/2,-W/2,W/2);line(P(0,-W/2),P(0,W/2));const rugby=L>=88&&W>=50;
  if(rugby){for(const u of[-L/2+22,L/2-22])line(P(u,-W/2),P(u,W/2))}
  else{const r=Math.min(9.15,W/6);for(let i=0;i<20;i++){const a=i/20*Math.PI*2,b=(i+1)/20*Math.PI*2;line(P(Math.cos(a)*r,Math.sin(a)*r),P(Math.cos(b)*r,Math.sin(b)*r))}const d=Math.min(16.5,L*.16),w=Math.min(40.3,W*.6);for(const s of[-1,1])rect2(s*L/2,s*(L/2-d),-w/2,w/2)}
  const scale=L>=70?1:.7;
  for(const s of[-1,1]){const[x,z]=P(s*(L/2+(rugby?0:.6*scale)),0),yaw=Math.atan2(s*ux,s*uz);
   if(rugby)item(x,z,yaw,(put,block)=>{for(const u of[-2.8,2.8]){put('white',u,4.5,0,.14,9,.14);put(s>0?'red':'blue',u,.9,0,.45,1.8,.45);block(u,0,.35)}put('white',0,3,0,5.74,.14,.14)},0,true);
   else item(x,z,yaw,(put,block)=>{const h=2.44*scale,w=3.66*scale,deep=1.5*scale;for(const u of[-w,w]){put('white',u,h/2,0,.12,h,.12);put('white',u,h/2,deep/2,.05,.05,Math.hypot(h,deep),Math.atan2(h,deep));block(u,0,.2)}put('white',0,h,0,w*2+.12,.12,.12);put('white',0,.03,deep,w*2,.06,.06)},0,true)}}
 function planDogPark(){if(area<120)return;const fenced=fencedDogPark(feature),small=/small/i.test(feature.name||'');plan.smallDogs=small;plan.dogs=small?2:Math.max(2,Math.min(7,Math.round(area/1400)));
  // Gate: the traced entrance, otherwise the outline point nearest a road.
  const edge=perimeter(ring,1,0,.5);if(!edge.length)return;const want=feature.gate?{x:feature.gate[0],z:feature.gate[1]}:edge.reduce((a,b)=>roadDistance(b.x,b.z)<roadDistance(a.x,a.z)?b:a),gate=edge.reduce((a,b)=>Math.hypot(b.x-want.x,b.z-want.z)<Math.hypot(a.x-want.x,a.z-want.z)?b:a);plan.gate={x:gate.x,z:gate.z,nx:gate.nx,nz:gate.nz};
  if(fenced){for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);if(l<.05)continue;const n=Math.max(1,Math.round(l/2.5));
   for(let k=0;k<n;k++){const t0=k/n,t1=(k+1)/n,g=((gate.x-a[0])*dx+(gate.z-a[1])*dz)/(l*l),half=.6/l,cut=[];
    // Clip panels against the 1.2 m gate opening.
    if(segDist(gate.x,gate.z,a,b)<.3&&g+half>t0&&g-half<t1){if(g-half>t0)cut.push([t0,g-half]);if(g+half<t1)cut.push([g+half,t1])}else cut.push([t0,t1]);
    for(const[c0,c1]of cut){const x0=a[0]+dx*c0,z0=a[1]+dz*c0,x1=a[0]+dx*c1,z1=a[1]+dz*c1,mx=(x0+x1)/2,mz=(z0+z1)/2,len=l*(c1-c0);if(len<.08)continue;const y=height(mx,mz);
     panels.push({x:mx,y:y+.62,z:mz,w:len,h:1.15,yaw:Math.atan2(-dz,dx)});boxes.push({m:'galv',x:mx,y:y+1.22,z:mz,w:.04,h:.04,d:len,yaw:Math.atan2(dx,dz),tilt:0});colliders.push({a:[x0,z0],b:[x1,z1],r:.18,y})}
    const px=a[0]+dx*t0,pz=a[1]+dz*t0;if(Math.hypot(px-gate.x,pz-gate.z)>.65)boxes.push({m:'galv',x:px,y:height(px,pz)+.66,z:pz,w:.06,h:1.32,d:.06,yaw:0,tilt:0})}}
   // Gate leaf hinged on one post and propped open into the park.
   const y=height(gate.x,gate.z),hx=gate.x+gate.ex*.6,hz=gate.z+gate.ez*.6,lx=-gate.ex*Math.cos(1.2)+gate.nx*Math.sin(1.2),lz=-gate.ez*Math.cos(1.2)+gate.nz*Math.sin(1.2);
   panels.push({x:hx+lx*.55,y:y+.6,z:hz+lz*.55,w:1.1,h:1.1,yaw:Math.atan2(-lz,lx)});boxes.push({m:'green',x:hx+lx*.55,y:y+1.17,z:hz+lz*.55,w:.05,h:.05,d:1.1,yaw:Math.atan2(lx,lz),tilt:0});
   for(const s of[-.62,.62])boxes.push({m:'green',x:gate.x+gate.ex*s,y:y+.72,z:gate.z+gate.ez*s,w:.1,h:1.44,d:.1,yaw:0,tilt:0})}
  const out={x:gate.x-gate.nx*1.6,z:gate.z-gate.nz*1.6},inn={x:gate.x+gate.nx*2.2,z:gate.z+gate.nz*2.2};
  if(!small)sign(out.x+gate.ex*1.6,out.z+gate.ez*1.6,Math.atan2(-gate.nx,-gate.nz),[(feature.name||'Dog exercise area').toUpperCase(),fenced?'Fenced dog exercise area · Off-leash':'Dog exercise area · Under voice control','Close the gate · Pick up after your dog']);
  item(inn.x+gate.ex*1.5,inn.z+gate.ez*1.5,Math.atan2(-gate.ex,-gate.ez),(put)=>{put('post',0,.7,0,.08,1.4,.08);put('green',0,1.25,-.08,.28,.36,.16);put('dark',0,1.1,-.17,.2,.04,.02)},.2,true);
  item(inn.x+gate.ex*2.3,inn.z+gate.ez*2.3,Math.atan2(gate.nx,gate.nz),bin,.35,true);
  const fx=inn.x-gate.ex*2.2+gate.nx*1.5,fz=inn.z-gate.ez*2.2+gate.nz*1.5;item(fx,fz,Math.atan2(gate.nx,gate.nz),(put)=>{put('concrete',0,.45,0,.32,.9,.32);put('galv',0,.92,0,.36,.06,.36);put('galv',0,.08,-.4,.55,.1,.38);put('water',0,.13,-.4,.45,.02,.28)},.35,true);
  const inner=perimeter(ring,Math.max(26,Math.sqrt(area)*.75),2.4);let benches=0;for(const p of inner){if(benches>=(small?1:3))break;if(Math.hypot(p.x-gate.x,p.z-gate.z)<8)continue;if(item(p.x,p.z,facing(p),bench))benches++}
  plan.walkers=small?1:Math.max(1,Math.ceil(plan.dogs/2.5))}
}
const BOX_COLORS={timber:'#7a6047',metal:'#2f3a3a',green:'#2f5d46',dark:'#26292a',post:'#5e5446',galv:'#a3abab',red:'#c2412f',yellow:'#e2b13c',blue:'#2f6fa8',rubber:'#46403b',white:'#eeeee8',line:'#f4f4ee',concrete:'#a39f97',water:'#5d8fa8'};
const COATS=['#1d1b19','#c89443','#6b4528','#e8e2d6','#8b8a86','#b98a5a','#3b2a1e','#d9c3a0'];
// Dog rig in metres, facing -z with paws on y=0: [pivot, offset from pivot, size, swing role].
const DOG_PARTS=[['body',[0,.5,0],[0,0,0],[.28,.26,.72]],['chest',[0,.5,-.26],[0,0,0],[.3,.3,.22]],['head',[0,.74,-.43],[0,0,0],[.22,.22,.26]],['snout',[0,.68,-.6],[0,0,0],[.12,.1,.14]],['nose',[0,.71,-.675],[0,0,0],[.05,.04,.02]],
 ['ear',[-.075,.86,-.39],[0,0,0],[.06,.11,.05]],['ear',[.075,.86,-.39],[0,0,0],[.06,.11,.05]],['leg',[-.09,.42,-.26],[0,-.21,0],[.08,.42,.08],0],['leg',[.09,.42,-.26],[0,-.21,0],[.08,.42,.08],1],['leg',[-.09,.42,.27],[0,-.21,0],[.08,.42,.08],1],['leg',[.09,.42,.27],[0,-.21,0],[.08,.42,.08],0],['tail',[0,.58,.35],[0,0,.15],[.06,.06,.3]]];
export function createParks(scene,{features,height,clear,roadDistance,radius=420,dogRadius=220}){
 const cells=new Map(),plans=new Map(),active=new Map(),materials={},meshes={},box=new T.BoxGeometry(1,1,1),panelGeometry=new T.PlaneGeometry(1,1),signCache=new Map(),colliderCells=new Map();
 for(const f of features){if(!FURNISHED.has(f.kind)||!f.rings?.[0]||f.rings[0].length<4)continue;const xs=f.rings[0].map(p=>p[0]),zs=f.rings[0].map(p=>p[1]);f.bounds=[Math.min(...xs),Math.min(...zs),Math.max(...xs),Math.max(...zs)];if(f.kind!=='dog_park'&&(f.bounds[2]-f.bounds[0])*(f.bounds[3]-f.bounds[1])>400000)continue;
  for(let x=Math.floor(f.bounds[0]/250);x<=Math.floor(f.bounds[2]/250);x++)for(let z=Math.floor(f.bounds[1]/250);z<=Math.floor(f.bounds[3]/250);z++){const k=x+','+z;if(!cells.has(k))cells.set(k,[]);cells.get(k).push(f)}}
 let mesh=null;if(typeof document!=='undefined'){const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d');c.fillStyle='#000000';c.fillRect(0,0,128,128);c.strokeStyle='#ffffff';c.lineWidth=4;for(let i=-128;i<256;i+=16){c.beginPath();c.moveTo(i,0);c.lineTo(i+128,128);c.stroke();c.beginPath();c.moveTo(i+128,0);c.lineTo(i,128);c.stroke()}mesh=new T.CanvasTexture(canvas);mesh.wrapS=mesh.wrapT=T.RepeatWrapping;mesh.repeat.set(5,2.5)}
 // Wire pattern is an alpha map, so distant mipmaps fade the mesh out instead of darkening it.
 const wire=new T.MeshLambertMaterial({color:'#b7bdbb',alphaMap:mesh,transparent:!mesh,opacity:mesh?1:.35,alphaTest:mesh?.35:0,side:T.DoubleSide});
 for(const[k,c]of Object.entries(BOX_COLORS))materials[k]=new T.MeshLambertMaterial({color:c});
 const m4=new T.Matrix4(),q=new T.Quaternion(),e=new T.Euler(0,0,0,'YXZ'),pos=new T.Vector3(),scl=new T.Vector3();
 function pool(key,geometry,material,count){let m=meshes[key];if(m&&m.instanceMatrix.count>=count)return m;if(m){scene.remove(m);m.dispose()}let cap=64;while(cap<count)cap*=2;m=new T.InstancedMesh(geometry,material,cap);m.frustumCulled=false;m.castShadow=key!=='line'&&key!=='rubber';m.receiveShadow=true;m.count=0;scene.add(m);meshes[key]=m;return m}
 function signMesh(s,id){const key=id+':'+s.lines[0];let m=signCache.get(key);if(m)return m;const material=new T.MeshLambertMaterial({color:'#e7efe2',side:T.DoubleSide});
  if(typeof document!=='undefined'){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const c=canvas.getContext('2d');c.fillStyle='#1f4a37';c.fillRect(0,0,512,256);c.strokeStyle='#d8e6b4';c.lineWidth=6;c.strokeRect(10,10,492,236);c.fillStyle='#f1f5e6';let size=34;c.font=`bold ${size}px sans-serif`;while(c.measureText(s.lines[0]).width>460&&size>16){size-=2;c.font=`bold ${size}px sans-serif`}c.fillText(s.lines[0],26,72);c.font='22px sans-serif';s.lines.slice(1).forEach((t,i)=>c.fillText(t,26,130+i*40));if(/dog/i.test(s.lines[0])){c.fillStyle='#d8e6b4';for(const[x,y,r]of[[452,196,14],[434,176,6],[446,170,6],[460,170,6],[472,176,6]]){c.beginPath();c.arc(x,y,r,0,7);c.fill()}}const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;material.map=tex;material.color.set('#ffffff')}
  m=new T.Mesh(new T.PlaneGeometry(1.6,.8),material);m.position.set(s.x,s.y,s.z);m.rotation.y=s.yaw;m.castShadow=true;signCache.set(key,m);return m}
 function rebuild(){const counts={},list=[...active.values()];for(const p of list)for(const b of p.boxes)counts[b.m]=(counts[b.m]||0)+1;
  for(const k of Object.keys(BOX_COLORS)){const m=pool(k,box,materials[k],counts[k]||0);m.count=0}
  for(const p of list)for(const b of p.boxes){const m=meshes[b.m];e.set(b.tilt,b.yaw,0);q.setFromEuler(e);m4.compose(pos.set(b.x,b.y,b.z),q,scl.set(b.w,b.h,b.d));m.setMatrixAt(m.count++,m4)}
  const panelCount=list.reduce((n,p)=>n+p.panels.length,0),fence=pool('fence',panelGeometry,wire,panelCount);fence.count=0;fence.castShadow=false;
  for(const p of list)for(const b of p.panels){e.set(0,b.yaw,0);q.setFromEuler(e);m4.compose(pos.set(b.x,b.y,b.z),q,scl.set(b.w,b.h,1));fence.setMatrixAt(fence.count++,m4)}
  for(const m of Object.values(meshes))m.instanceMatrix.needsUpdate=true;
  const wanted=new Set();for(const p of list)for(const s of p.signs){const m=signMesh(s,p.id);wanted.add(m);if(!m.parent)scene.add(m)}for(const[k,m]of signCache)if(!wanted.has(m)){scene.remove(m);m.geometry.dispose();m.material.map?.dispose();m.material.dispose();signCache.delete(k)}
  colliderCells.clear();for(const p of list)for(const c of p.colliders){const x0=c.a?Math.min(c.a[0],c.b[0])-c.r:c.x-c.r,x1=c.a?Math.max(c.a[0],c.b[0])+c.r:c.x+c.r,z0=c.a?Math.min(c.a[1],c.b[1])-c.r:c.z-c.r,z1=c.a?Math.max(c.a[1],c.b[1])+c.r:c.z+c.r;for(let x=Math.floor(x0/20);x<=Math.floor(x1/20);x++)for(let z=Math.floor(z0/20);z<=Math.floor(z1/20);z++){const k=x+','+z;if(!colliderCells.has(k))colliderCells.set(k,[]);colliderCells.get(k).push(c)}}}
 function planFor(f){let p=plans.get(f.id);if(!p){p=planPark(f,{height,clear,roadDistance});plans.set(f.id,p);if(plans.size>400)for(const k of plans.keys()){if(!active.has(k)){plans.delete(k);break}}}return p}
 // Dogs and their walkers only exist while the player is close to a dog park.
 const dogMesh=new T.InstancedMesh(box,new T.MeshLambertMaterial({color:'#ffffff'}),64*DOG_PARTS.length);dogMesh.count=0;dogMesh.frustumCulled=false;dogMesh.castShadow=true;scene.add(dogMesh);
 const walkers=createHumanRenderer(scene,32),packs=new Map(),color=new T.Color(),root=new T.Matrix4(),part=new T.Matrix4(),tmp=new T.Matrix4(),up=new T.Vector3(0,1,0),hq=new T.Quaternion();
 function spawn(p){const random=seeded(p.id+':dogs'),pick=(d=1.2)=>{const[x0,z0,x1,z1]=[Math.min(...p.ring.map(r=>r[0])),Math.min(...p.ring.map(r=>r[1])),Math.max(...p.ring.map(r=>r[0])),Math.max(...p.ring.map(r=>r[1]))];for(let i=0;i<60;i++){const x=x0+random()*(x1-x0),z=z0+random()*(z1-z0);if(inside(p.ring,x,z)&&edgeDistance(p.ring,x,z)>d)return{x,z}}return interiorPoint(p.ring)};
  const dogs=[];for(let i=0;i<p.dogs;i++){const at=pick(),size=p.smallDogs?.45+random()*.15:.62+random()*.5,coat=COATS[Math.floor(random()*COATS.length)];dogs.push({...at,yaw:random()*6.28,speed:0,want:0,target:pick(),mode:'trot',timer:random()*3,phase:random()*6,size,coat,trim:COATS[(COATS.indexOf(coat)+3+Math.floor(random()*3))%COATS.length],earUp:random()<.45,lift:0})}
  const people=[];for(let i=0;i<(p.walkers||0);i++){const at=p.gate&&i===0?{x:p.gate.x+p.gate.nx*4,z:p.gate.z+p.gate.nz*4}:pick(2.5);people.push({...at,yaw:random()*6.28,target:at,timer:2+random()*6,phase:0,walking:false,id:2600+Math.floor(random()*900)})}
  return{p,dogs,people,random,pick}}
 function stepDog(d,pack,dt,player){const{p,random,pick}=pack;d.timer-=dt;
  if(d.timer<=0){const r=random(),near=player&&Math.hypot(player.x-d.x,player.z-d.z)<24&&inside(p.ring,player.x,player.z);
   if(near&&r<.3){d.mode='greet';d.timer=5+random()*4;d.want=3.2}
   else if(r<.45){d.mode='trot';d.target=pick();d.want=1.2+random()*1.1;d.timer=4+random()*5}
   else if(r<.62){d.mode='sniff';d.want=0;d.timer=2+random()*4}
   else if(r<.8&&pack.dogs.length>1){d.mode='chase';d.buddy=pack.dogs[(pack.dogs.indexOf(d)+1+Math.floor(random()*(pack.dogs.length-1)))%pack.dogs.length];d.want=3.8+random()*1.6;d.timer=2.5+random()*2.5}
   else if(r<.9){d.mode='sit';d.want=0;d.timer=3+random()*5}
   else{d.mode='zoom';d.target=pick(2);d.want=5.5;d.timer=3}}
  if(d.mode==='greet'&&player)d.target={x:player.x+Math.sin(d.phase)*.2,z:player.z};if(d.mode==='chase'&&d.buddy)d.target={x:d.buddy.x,z:d.buddy.z};
  const dx=d.target.x-d.x,dz=d.target.z-d.z,dist=Math.hypot(dx,dz),stop=d.mode==='greet'?1.3:d.mode==='chase'?.9:.4;let want=d.want*(dist>stop?Math.min(1,(dist-stop)/1.2+.3):0);
  if(dist>.05&&want>0){let turn=Math.atan2(-dx,-dz)-d.yaw;turn=Math.atan2(Math.sin(turn),Math.cos(turn));d.yaw+=Math.max(-5*dt,Math.min(5*dt,turn))}
  else if(d.mode==='greet'&&player){let turn=Math.atan2(-(player.x-d.x),-(player.z-d.z))-d.yaw;turn=Math.atan2(Math.sin(turn),Math.cos(turn));d.yaw+=turn*Math.min(1,dt*4)}
  d.speed+=(want-d.speed)*Math.min(1,dt*3);const nx=d.x-Math.sin(d.yaw)*d.speed*dt,nz=d.z-Math.cos(d.yaw)*d.speed*dt;
  if(inside(p.ring,nx,nz)&&edgeDistance(p.ring,nx,nz)>.45){d.x=nx;d.z=nz}else{d.target=pick();d.speed*=.3;if(d.mode!=='greet')d.mode='trot'}
  d.phase+=dt*(d.speed*7.5/Math.max(.5,d.size)+2);d.lift=d.mode==='greet'&&dist<1.6?Math.max(0,Math.sin(d.phase*.9))*.25:0}
 function writeDog(d){const y=height(d.x,d.z),run=Math.min(1,d.speed/4),gait=Math.min(1,d.speed/1.2),sit=d.mode==='sit'&&d.speed<.2,sniff=d.mode==='sniff'&&d.speed<.2;
  root.compose(pos.set(d.x,y+d.lift*d.size,d.z),hq.setFromAxisAngle(up,d.yaw),scl.setScalar(d.size));
  for(const[name,pivot,offset,size,pair]of DOG_PARTS){let rx=0,ry=0,px=pivot[1],pz=pivot[2];
   if(name==='leg'){const front=pivot[2]<0;rx=Math.sin(d.phase+(pair?Math.PI:0)+(front?0:run*1.2))*.6*gait;if(sit&&!front){rx=-1.2;px=.28}}
   else if(name==='tail'){rx=-.9+(sit?.5:0);ry=Math.sin(d.phase*(d.mode==='greet'?3.4:1.6))*(d.mode==='greet'?.8:.35)}
   else if(name==='ear'){rx=d.earUp?0:.9;if(!d.earUp)px-=.06}
   else if(sniff&&(name==='head'||name==='snout'||name==='nose'||name==='ear')){px-=.26;pz-=.06}
   if(sit&&name==='body'){rx=-.45;px-=.08;pz+=.04}else if(sit&&name!=='leg'&&name!=='tail'&&name!=='chest'){px+=.02}
   e.set(rx,ry,0);q.setFromEuler(e);part.compose(pos.set(pivot[0],px,pz),q,new T.Vector3(1,1,1));tmp.makeTranslation(offset[0],offset[1],offset[2]);part.multiply(tmp);tmp.makeScale(size[0],size[1],size[2]);part.multiply(tmp);part.premultiply(root);
   const i=dogMesh.count++;dogMesh.setMatrixAt(i,part);dogMesh.setColorAt(i,color.set(name==='snout'||name==='ear'?d.trim:name==='nose'?'#111111':d.coat))}}
 let clock=0,next=0;const bounds=f=>f.bounds;
 return{
  get count(){return active.size},
  get dogs(){let n=0;for(const k of packs.values())n+=k.dogs.length;return n},
  plans:()=>[...active.values()],
  update(position,dt=0,player=null){clock+=dt;if(clock>=next){next=clock+.4;const seen=new Set(),cx=Math.floor(position.x/250),cz=Math.floor(position.z/250);let built=0,changed=false;
    for(let x=cx-2;x<=cx+2;x++)for(let z=cz-2;z<=cz+2;z++)for(const f of cells.get(x+','+z)||[]){if(seen.has(f.id))continue;seen.add(f.id);const[b0,b1,b2,b3]=bounds(f),d=Math.hypot(Math.max(b0-position.x,0,position.x-b2),Math.max(b1-position.z,0,position.z-b3));
     if(d<radius&&!active.has(f.id)&&(plans.has(f.id)||built++<6)){active.set(f.id,planFor(f));changed=true}}
    for(const[k,p]of active){const f=p;const xs=f.ring.map(r=>r[0]),zs=f.ring.map(r=>r[1]),d=Math.hypot(Math.max(Math.min(...xs)-position.x,0,position.x-Math.max(...xs)),Math.max(Math.min(...zs)-position.z,0,position.z-Math.max(...zs)));if(d>radius+200){active.delete(k);changed=true}}
    if(changed)rebuild();
    for(const p of active.values())if(p.dogs&&!packs.has(p.id)){const[x0,z0]=p.ring[0];if(Math.hypot(x0-position.x,z0-position.z)<dogRadius+Math.sqrt(p.area))packs.set(p.id,spawn(p))}
    for(const[k,pack]of packs){const[x0,z0]=pack.p.ring[0];if(!active.has(k)||Math.hypot(x0-position.x,z0-position.z)>dogRadius+Math.sqrt(pack.p.area)+80)packs.delete(k)}}
   dogMesh.count=0;walkers.begin();
   for(const pack of packs.values()){for(const d of pack.dogs){stepDog(d,pack,Math.min(dt,.1),player);if(Math.hypot(d.x-position.x,d.z-position.z)<dogRadius&&dogMesh.count+DOG_PARTS.length<=dogMesh.instanceMatrix.count)writeDog(d)}
    for(const w of pack.people){w.timer-=dt;if(w.timer<=0){w.walking=!w.walking;w.timer=w.walking?6+pack.random()*8:4+pack.random()*8;if(w.walking)w.target=pack.pick(2.5)}
     if(w.walking){const dx=w.target.x-w.x,dz=w.target.z-w.z,l=Math.hypot(dx,dz);if(l<.5)w.walking=false;else{w.yaw=Math.atan2(-dx,-dz);w.x+=dx/l*.95*Math.min(dt,.1);w.z+=dz/l*.95*Math.min(dt,.1);w.phase+=Math.min(dt,.1)*6}}
     else{const dog=pack.dogs[pack.people.indexOf(w)%pack.dogs.length];if(dog){let turn=Math.atan2(-(dog.x-w.x),-(dog.z-w.z))-w.yaw;turn=Math.atan2(Math.sin(turn),Math.cos(turn));w.yaw+=turn*Math.min(1,dt*1.5)}}
     if(Math.hypot(w.x-position.x,w.z-position.z)<dogRadius){root.compose(pos.set(w.x,height(w.x,w.z)+.02,w.z),hq.setFromAxisAngle(up,w.yaw),scl.setScalar(.92));walkers.write(root,w.id,w.phase,w.walking,null,Math.hypot(w.x-position.x,w.z-position.z)<80)}}}
   dogMesh.instanceMatrix.needsUpdate=true;if(dogMesh.instanceColor)dogMesh.instanceColor.needsUpdate=true;walkers.finish()},
  free(x,z,y){for(const c of colliderCells.get(Math.floor(x/20)+','+Math.floor(z/20))||[]){if(y!==undefined&&Math.abs(y-c.y)>3.5)continue;if(c.a?segDist(x,z,c.a,c.b)<c.r:Math.hypot(x-c.x,z-c.z)<c.r)return false}return true},
  destinations(){const out=[];for(const[id,name,label]of[['les-dalton-main','Les Dalton Dog Park · Waiu Street','park-les-dalton'],['way-1489003792','Hikoikoi Reserve Dog Park · Petone','park-hikoikoi']]){const f=features.find(f=>f.id===id);if(!f)continue;const p=planPark(f,{height:()=>0}),g=p.gate;if(!g)continue;out.push([label,{name,x:g.x-g.nx*5,z:g.z-g.nz*5,yaw:Math.atan2(-g.nx,-g.nz),pitch:-.08,park:true}])}return out},
  drawMinimap(c,X,Y){c.strokeStyle='#b5d68a';c.lineWidth=1.5;for(const p of active.values()){if(p.kind!=='dog_park')continue;c.beginPath();p.ring.forEach(([x,z],i)=>i?c.lineTo(X(x),Y(z)):c.moveTo(X(x),Y(z)));c.stroke()}}
 };
}
