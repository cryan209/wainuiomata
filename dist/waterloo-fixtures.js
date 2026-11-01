import * as T from './vendor/three.js';
import {subtractFootprint,triangulateFragments} from './road-clipping.js';

const inside=(ring,u,v)=>{let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>v)!==(b[1]>v)&&u<(b[0]-a[0])*(v-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;};
const hall=[[-12,8.5],[24,8.5],[27,6.6],[31,8.5],[31,15.5],[27,17.4],[24,15.5],[-12,15.5],[-12,8.5]];

export function addWaterlooFixtures(group,plan){
 const {world,local,railways}=plan,batches=new Map(),blockers=[],textures=[],railCache=new Map(),yaw=Math.atan2(-world(1,0).z+world(0,0).z,world(1,0).x-world(0,0).x);
 const materials={cream:new T.MeshLambertMaterial({color:'#c8bfa3'}),bronze:new T.MeshLambertMaterial({color:'#48493b'}),olive:new T.MeshLambertMaterial({color:'#666d48'}),blue:new T.MeshLambertMaterial({color:'#184d9a'}),wood:new T.MeshLambertMaterial({color:'#8b6344'}),metal:new T.MeshLambertMaterial({color:'#919a90'}),yellow:new T.MeshBasicMaterial({color:'#dfc84e'}),white:new T.MeshLambertMaterial({color:'#dcd9c8'}),light:new T.MeshBasicMaterial({color:'#fff0c0',toneMapped:false})};
 function railInfo(u){const key=Math.round(u/2);if(railCache.has(key))return railCache.get(key);const hits=[-14,-8].map(v=>{const p=world(u,v),h=railways.at(p.x,p.z,1);return h?{v:local(h.s.a.x+h.s.dx*h.t,h.s.a.z+h.s.dz*h.t).v,y:h.y}: {v,y:plan.ground(p.x,p.z)};}).sort((a,b)=>a.v-b.v);railCache.set(key,hits);return hits;}
 function level(u,v){const p=world(u,v),h=railways.at(p.x,p.z,1);return(h?.y??plan.ground(p.x,p.z))+.72;}
 const hallFloor=level(10,11),openings=[];
 for(const r of plan.network?.roads||[]){if(!r.railUnderpass)continue;for(const [enabled,i,j]of [[r.portalStart,0,1],[r.portalEnd,r.p.length-1,r.p.length-2]]){if(!enabled)continue;const p=r.p[i],q=r.p[j],length=p.distanceTo(q)||1,dx=(p.x-q.x)/length,dz=(p.y-q.y)/length,half=r.width/2+.2,ring=[[0,-half],[7,-half],[7,half],[0,half]].map(([s,o])=>({x:p.x+dx*s+dz*o,z:p.y+dz*s-dx*o}));if(Math.hypot(p.x+1878,p.y+5376)<200)openings.push(ring);}}
 function openingAt(x,z){return openings.some(r=>inside(r.map(p=>[p.x,p.z]),x,z));}
 function floorAt(x,z){const p=local(x,z),r=railInfo(p.u);if(!inside(plan.rings[0],x,z)||openingAt(x,z)||p.v>r[0].v-1.45&&p.v<r[1].v+1.45)return null;return inside(hall,p.u,p.v)?hallFloor:level(p.u,p.v);}
 function box(u,v,du,dv,h,bottom,kind,rotation=0){const p=world(u,v),matrix=new T.Matrix4().compose(new T.Vector3(p.x,bottom+h/2,p.z),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),yaw+rotation),new T.Vector3(du,h,dv));if(!batches.has(kind))batches.set(kind,[]);batches.get(kind).push(matrix);}
 function beam(a,b,size,kind){const delta=b.clone().sub(a),matrix=new T.Matrix4().lookAt(a,b,new T.Vector3(0,1,0));matrix.setPosition(a.clone().add(b).multiplyScalar(.5));matrix.scale(new T.Vector3(size,size,delta.length()));if(!batches.has(kind))batches.set(kind,[]);batches.get(kind).push(matrix);}
 function wallBlock(u0,v0,u1,v1,radius=.16){const a=world(u0,v0),b=world(u1,v1);blockers.push({a,b,radius});}
 function clip(poly,edge,sign,axis){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],av=(a[axis]-edge)*sign,bv=(b[axis]-edge)*sign;if(av>=0)out.push(a);if((av>=0)!==(bv>=0)){const t=av/(av-bv);out.push(Object.fromEntries(['x','z','u','v'].map(k=>[k,T.MathUtils.lerp(a[k],b[k],t)])));}}return out;}
 const paving=[],pavingUV=[],roof=[...plan.roof.positions,...plan.skylights];
 for(let i=0;i<roof.length;i+=9){const tri=[0,3,6].map(k=>({...local(roof[i+k],roof[i+k+2]),x:roof[i+k],z:roof[i+k+2]}));
  for(let u=Math.floor(Math.min(...tri.map(p=>p.u))/4)*4;u<Math.max(...tri.map(p=>p.u));u+=4){const strip=clip(clip(tri,u,1,'u'),u+4,-1,'u'),r=railInfo(u+2);
   for(const [edge,sign]of [[r[0].v-1.45,-1],[r[1].v+1.45,1]]){const poly=clip(strip,edge,sign,'v');for(let j=1;j<poly.length-1;j++)for(const p of [poly[0],poly[j+1],poly[j]]){paving.push(p.x,(inside(hall,p.u,p.v)?hallFloor:level(p.u,p.v))-.015,p.z);pavingUV.push(p.u/2,p.v/2);}}
  }
 }
 const cleared=[];for(let i=0;i<paving.length;i+=9){let parts=[[paving.slice(i,i+3),paving.slice(i+3,i+6),paving.slice(i+6,i+9)]];for(const opening of openings)parts=parts.flatMap(poly=>subtractFootprint(poly,opening));for(const p of triangulateFragments(parts))cleared.push(...p);}
 const pavingGeo=new T.BufferGeometry();pavingGeo.setAttribute('position',new T.Float32BufferAttribute(cleared,3));pavingGeo.computeVertexNormals();const paved=new T.Mesh(pavingGeo,new T.MeshLambertMaterial({color:'#999b91',side:T.DoubleSide}));paved.userData.surface='waterloo-concourse-paving';group.add(paved);

 // The cream plinth and bronze-framed glazed hall include open public doors.
 const glazing=[],glassUV=[];const quad=(out,p)=>{for(const i of [0,1,2,0,2,3])out.push(...p[i]);};
 for(let i=1;i<hall.length;i++){
  const a=hall[i-1],b=hall[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]),count=Math.ceil(length/1.25),height=a[0]>=24&&b[0]>=24?5:3.55;
  for(let j=0;j<count;j++){const t0=j/count,t1=(j+1)/count,u0=T.MathUtils.lerp(a[0],b[0],t0),v0=T.MathUtils.lerp(a[1],b[1],t0),u1=T.MathUtils.lerp(a[0],b[0],t1),v1=T.MathUtils.lerp(a[1],b[1],t1),u=(u0+u1)/2,v=(v0+v1)/2;
   const door=Math.abs(v-8.5)<.01&&u>8&&u<11||Math.abs(v-15.5)<.01&&u>4&&u<7,p=world(u0,v0),q=world(u1,v1),bottom=door?3:.68;
   if(!door){beam(new T.Vector3(p.x,hallFloor+.32,p.z),new T.Vector3(q.x,hallFloor+.32,q.z),.64,'cream');wallBlock(u0,v0,u1,v1);}
   quad(glazing,[[p.x,hallFloor+bottom,p.z],[q.x,hallFloor+bottom,q.z],[q.x,hallFloor+height,q.z],[p.x,hallFloor+height,p.z]]);for(let k=0;k<6;k++)glassUV.push(k%2,Math.floor(k/3));
   beam(new T.Vector3(p.x,hallFloor+(door?3:.1),p.z),new T.Vector3(p.x,hallFloor+height,p.z),.075,'bronze');
   for(const h of [bottom,height])beam(new T.Vector3(p.x,hallFloor+h,p.z),new T.Vector3(q.x,hallFloor+h,q.z),.07,'bronze');
   if(height>4)beam(new T.Vector3(p.x,hallFloor+3.05,p.z),new T.Vector3(q.x,hallFloor+3.05,q.z),.24,'cream');
  }
 }
 const glassGeo=new T.BufferGeometry();glassGeo.setAttribute('position',new T.Float32BufferAttribute(glazing,3));glassGeo.computeVertexNormals();const glass=new T.Mesh(glassGeo,new T.MeshStandardMaterial({color:'#6b7869',roughness:.27,metalness:.12,transparent:true,opacity:.48,depthWrite:false,side:T.DoubleSide}));glass.userData.surface='waterloo-glazed-hall';group.add(glass);
 box(6,12,35,6.5,.12,hallFloor+3.55,'olive');
 const cap=[],bay=hall.slice(1,7);for(let i=0;i<bay.length;i++){const a=world(...bay[i]),b=world(...bay[(i+1)%bay.length]),c=world(27.5,12);cap.push(a.x,hallFloor+5,a.z,b.x,hallFloor+5,b.z,c.x,hallFloor+5.7,c.z);}const capGeo=new T.BufferGeometry();capGeo.setAttribute('position',new T.Float32BufferAttribute(cap,3));capGeo.computeVertexNormals();const capMesh=new T.Mesh(capGeo,new T.MeshLambertMaterial({color:'#656b45',side:T.DoubleSide}));capMesh.userData.surface='waterloo-faceted-office';group.add(capMesh);

 function bench(u,v,rotation=0){const floor=level(u,v);for(const offset of [-.21,-.07,.07,.21])box(u,v+offset,2,.09,.06,floor+.43,'wood',rotation);for(const offset of [.65,-.65]){box(u+offset,v,.1,.5,.44,floor,'blue',rotation);box(u+offset,v+.24,.08,.09,.76,floor+.1,'blue',rotation);}for(const h of [.65,.8])box(u,v+.25,2,.07,.1,floor+h,'wood',rotation);wallBlock(u-1,v,u+1,v,.32);}
 for(const u of [-4,12,38,57])bench(u,3.3);bench(2,12.9);bench(14,12.9);
 // Dark diagonal timber screen behind the older interchange sign.
 for(let u=-9;u<5;u+=.33){const floor=level(u,5.6),a=world(u,5.6),b=world(Math.min(5,u+1.3),5.6);beam(new T.Vector3(a.x,floor+.1,a.z),new T.Vector3(b.x,floor+1.6,b.z),.15,'bronze');}wallBlock(-9,5.6,5,5.6,.12);

 // White coping and a thin yellow edge line follow the actual track centres.
 for(let u=-5;u<95;u+=2){const rail=railInfo(u+1);for(const [side,index]of [[-1,0],[1,1]]){const v=rail[index].v+side*1.72,floor=level(u+1,v);box(u+1,v,2,.5,.04,floor-.02,'white');box(u+1,v+side*.37,2,.12,.02,floor+.01,'yellow');}}

 const meshWire=[];for(let u=-4;u<96;u+=2.5){const r=railInfo(u),next=railInfo(u+2.5),v=(r[0].v+r[1].v)/2,v1=(next[0].v+next[1].v)/2,p=world(u,v),q=world(u+2.5,v1),floor=(r[0].y+r[1].y)/2-.1,floor1=(next[0].y+next[1].y)/2-.1;
  if(Math.min(...r.map(h=>Math.abs(h.v-v)))<1.7)continue;
  beam(new T.Vector3(p.x,floor,p.z),new T.Vector3(p.x,floor+1.12,p.z),.055,'metal');beam(new T.Vector3(p.x,floor+1.08,p.z),new T.Vector3(q.x,floor1+1.08,q.z),.045,'metal');wallBlock(u,v,u+2.5,v1,.1);
  for(let t=0;t<1;t+=.08)for(const sign of [-1,1]){const ta=t,tb=Math.min(1,t+.08),x=T.MathUtils.lerp(p.x,q.x,ta),z=T.MathUtils.lerp(p.z,q.z,ta),x1=T.MathUtils.lerp(p.x,q.x,tb),z1=T.MathUtils.lerp(p.z,q.z,tb);for(let h=.1;h<1;h+=.2){meshWire.push(x,floor+h,z,x1,floor1+h+sign*.1,z1);}}
 }
 const wireGeo=new T.BufferGeometry();wireGeo.setAttribute('position',new T.Float32BufferAttribute(meshWire,3));const fence=new T.LineSegments(wireGeo,new T.LineBasicMaterial({color:'#9aaba1',transparent:true,opacity:.65}));fence.userData.surface='waterloo-centre-fence';group.add(fence);
 for(const u of [14,64]){const r=railInfo(u),v=(r[0].v+r[1].v)/2,p=world(u,v),base=(r[0].y+r[1].y)/2;
  beam(new T.Vector3(p.x,base-.15,p.z),new T.Vector3(p.x,base+5.7,p.z),.19,'metal');
  for(const side of [-1,1]){const q=world(u,v+side*2.5);beam(new T.Vector3(p.x,base+5.7,p.z),new T.Vector3(q.x,base+6.65,q.z),.16,'white');beam(new T.Vector3(q.x,base+6.65,q.z),new T.Vector3(q.x,base+5.35,q.z),.035,'metal');}
 }

 function labelTexture(kind){
  if(typeof document==='undefined'){const t=new T.DataTexture(new Uint8Array([36,88,166,255]),1,1);t.needsUpdate=true;textures.push(t);return t;}
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=160;const c=canvas.getContext('2d');c.fillStyle=kind==='sign'?'#175bcd':'#e2e0cf';c.fillRect(0,0,512,160);c.textAlign='center';
  if(kind==='sign'){c.fillStyle='#ffffff';c.font='34px sans-serif';c.fillText('Hutt Central',256,64);c.font='29px sans-serif';c.fillText('Waterloo Interchange',256,113);}
  else{c.fillStyle='#23446b';c.font='bold 28px sans-serif';c.fillText('HUTT VALLEY LINE',256,35);c.font='18px sans-serif';c.fillText('WELLINGTON  /  UPPER HUTT',256,65);for(let y=82;y<150;y+=13){c.fillStyle=y%2?'#b7c3bb':'#d4d8cf';c.fillRect(28,y,456,7);}}
  const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;textures.push(t);return t;
 }
 const signPositions=[],signUV=[];function signFace(u,v,w,h,bottom,reverse=false){const points=[world(u-w/2,v),world(u+w/2,v)],floor=level(u,v),p=[[points[0].x,floor+bottom,points[0].z],[points[1].x,floor+bottom,points[1].z],[points[1].x,floor+bottom+h,points[1].z],[points[0].x,floor+bottom+h,points[0].z]];for(const k of (reverse?[0,2,1,0,3,2]:[0,1,2,0,2,3])){signPositions.push(...p[k]);signUV.push(reverse?([0,3].includes(k)?1:0):([0,3].includes(k)?0:1),k<2?0:1);}}
 for(const [u,v]of [[-3,3.7],[47,2.6],[36,-18.5]]){signFace(u,v,2.6,.82,.88);signFace(u,v-.015,2.6,.82,.88,true);for(const side of [-1,1])box(u+side*1.12,v,.065,.065,1.3,level(u,v),'blue');}
 const signGeo=new T.BufferGeometry();signGeo.setAttribute('position',new T.Float32BufferAttribute(signPositions,3));signGeo.setAttribute('uv',new T.Float32BufferAttribute(signUV,2));signGeo.computeVertexNormals();const signMesh=new T.Mesh(signGeo,new T.MeshBasicMaterial({map:labelTexture('sign'),side:T.FrontSide}));signMesh.userData.surface='waterloo-interchange-signs';group.add(signMesh);
 const board=world(20,7.9),boardGeo=new T.PlaneGeometry(1.15,1.2),boardMesh=new T.Mesh(boardGeo,new T.MeshBasicMaterial({map:labelTexture('timetable'),side:T.DoubleSide}));boardMesh.position.set(board.x,hallFloor+1.75,board.z);boardMesh.rotation.y=yaw+Math.PI;boardMesh.userData.surface='waterloo-timetable';group.add(boardMesh);
 for(let u=-70;u<80;u+=12)for(const v of [-22,5,24]){const p=world(u,v);if(!inside(plan.rings[0],p.x,p.z))continue;box(u,v,1.15,.5,.07,plan.top+plan.height(p.x,p.z)-1.24,'light');}

 for(const [kind,matrices]of batches){const mesh=new T.InstancedMesh(new T.BoxGeometry(1,1,1),materials[kind],matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.computeBoundingSphere();mesh.userData.surface='waterloo-fixture-'+kind;group.add(mesh);}
 group.userData.ownedTextures=[...(group.userData.ownedTextures||[]),...textures];
 return{blockers,floorAt,hall,openings};
}

export function waterlooPlatformView(){const cx=-1871.704,cz=-5400.358,ux=-.747175,uz=.664627,point=(u,v)=>({x:cx+ux*u-uz*v,z:cz+uz*u+ux*v}),p=point(52,-16.6),q=point(15,8.8);return{name:'Waterloo station',...p,yaw:Math.atan2(p.x-q.x,p.z-q.z),pitch:.035};}
export function waterlooCatenaryArea(x,z){const dx=x+1871.704,dz=z+5400.358,u=dx*-.747175+dz*.664627,v=-dx*.664627+dz*-.747175;return u>-10&&u<100&&v>-30&&v<10;}
