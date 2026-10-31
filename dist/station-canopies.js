import * as T from './vendor/three.js';

// LINZ outline 3468908 is Waterloo's broad interchange canopy, not an
// enclosed warehouse. Reference: Metlink/Harrison Grierson, May 2024 canopy
// reassessment, section 2 (two roof levels, spaceframe and circular columns).
export const isWaterlooCanopy=b=>String(b.id)==='3468908'||b.stationCanopy==='Waterloo';
export const isWaterlooFar=(x,z)=>Math.abs(x+1871.704)<.05&&Math.abs(z+5400.358)<.05;
export function insideStation(rings,x,z){let inside=false;for(const ring of rings)for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}

export function waterlooCanopyPlan(b,{datum,railways,network,ground}){
 const [cx,cz,ux,uz]=b.roof.frame,local=(x,z)=>({x,z,u:(x-cx)*ux+(z-cz)*uz,v:-(x-cx)*uz+(z-cz)*ux}),world=(u,v)=>({x:cx+ux*u-uz*v,z:cz+uz*u+ux*v});
 const rings=b.rings.map(r=>r.slice(0,-1).map(([x,z])=>local(x,z))),all=rings.flat(),triangles=T.ShapeUtils.triangulateShape(rings[0].map(p=>new T.Vector2(p.x,p.z)),rings.slice(1).map(r=>r.map(p=>new T.Vector2(p.x,p.z))));
 const samples=all.map(p=>railways.at(p.x,p.z,0)).filter(p=>p&&p.d<12&&!p.s.track.tunnel),top=Math.max(b.ground+b.height-datum,...samples.map(p=>p.y+9));
 const height=(x,z)=>{const {v}=local(x,z);return(v>0?-1:0)-Math.abs(v)*.015;},positions=[],skylights=[],fascia=[];
 const clip=(poly,sign)=>{const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],c=poly[(i+1)%poly.length],av=a.v*sign,cv=c.v*sign;if(av>=0)out.push(a);if((av>=0)!==(cv>=0)){const t=av/(av-cv);out.push(Object.fromEntries(['x','z','u','v'].map(k=>[k,T.MathUtils.lerp(a[k],c[k],t)])));}}return out;};
 const quad=(out,a,c,d,e)=>out.push(...a,...c,...d,...a,...d,...e);
 const clipU=(poly,edge,sign)=>{const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],c=poly[(i+1)%poly.length],av=(a.u-edge)*sign,cv=(c.u-edge)*sign;if(av>=0)out.push(a);if((av>=0)!==(cv>=0)){const t=av/(av-cv);out.push(Object.fromEntries(['x','z','u','v'].map(k=>[k,T.MathUtils.lerp(a[k],c[k],t)])));}}return out;};
 for(const tri of triangles)for(const sign of [-1,1]){const poly=clip(tri.map(i=>all[i]),sign);if(poly.length<3)continue;for(let u=Math.floor(Math.min(...poly.map(p=>p.u))/12)*12;u<Math.max(...poly.map(p=>p.u));u+=12)for(const [lo,hi,out]of [[u,u+10.8,positions],[u+10.8,u+12,skylights]]){const panel=clipU(clipU(poly,lo,1),hi,-1);for(let i=1;i<panel.length-1;i++)for(const p of [panel[0],panel[i+1],panel[i]])out.push(p.x,(sign===1?-1:0)-Math.abs(p.v)*.015,p.z);}}
 for(const ring of rings)for(let i=0;i<ring.length;i++){const a=ring[i],c=ring[(i+1)%ring.length],ha=height(a.x,a.z),hc=height(c.x,c.z);quad(fascia,[a.x,ha-.18,a.z],[c.x,hc-.18,c.z],[c.x,hc,c.z],[a.x,ha,a.z]);}
 const minU=Math.min(...all.map(p=>p.u)),maxU=Math.max(...all.map(p=>p.u)),minV=Math.min(...all.map(p=>p.v)),maxV=Math.max(...all.map(p=>p.v)),nodes=new Map(),beams=[],posts=[];
 for(let i=Math.ceil(minU/4);i<=Math.floor(maxU/4);i++)for(let j=Math.ceil(minV/4);j<=Math.floor(maxV/4);j++){const p=world(i*4,j*4);if(!insideStation(b.rings,p.x,p.z))continue;nodes.set(i+','+j,{...p,i,j,y:top+height(p.x,p.z)});}
 for(const p of nodes.values()){
  for(const [di,dj]of [[1,0],[0,1]]){const q=nodes.get((p.i+di)+','+(p.j+dj));if(!q||![.25,.5,.75].every(t=>insideStation(b.rings,T.MathUtils.lerp(p.x,q.x,t),T.MathUtils.lerp(p.z,q.z,t))))continue;
   for(const down of [.18,1.1])beams.push({a:new T.Vector3(p.x,p.y-down,p.z),b:new T.Vector3(q.x,q.y-down,q.z)});
   beams.push({a:new T.Vector3(p.x,p.y-1.1,p.z),b:new T.Vector3(q.x,q.y-.18,q.z)});
  }
  if(p.i%3||p.j%3)continue;
  const rail=railways.at(p.x,p.z,0),road=network?.at(p.x,p.z);
  if(rail&&rail.d<3.2||road&&!['path','footway','cycleway','pedestrian','steps'].includes(road.r.type)&&road.d<road.r.width/2+.6)continue;
  const floor=railways.walkHeight?.(p.x,p.z)??ground(p.x,p.z),head=p.y-1.15;if(head-floor<2.4)continue;
  posts.push({x:p.x,z:p.z,y:floor,top:head,radius:.25});
  for(const [du,dv]of [[1,1],[1,-1],[-1,1],[-1,-1]]){const q=world(p.i*4+du,p.j*4+dv);if(insideStation(b.rings,q.x,q.z))beams.push({a:new T.Vector3(p.x,head-.9,p.z),b:new T.Vector3(q.x,top+height(q.x,q.z)-.2,q.z)});}
 }
 return{top,height,roof:{positions,fascia,walls:[]},skylights,beams,posts};
}

export function addWaterlooCanopy(group,plan){
 const concrete=new T.MeshLambertMaterial({color:'#b7bcb2'}),steel=new T.MeshLambertMaterial({color:'#d2d7cd'}),soffit=new T.MeshLambertMaterial({color:'#c2c9be',side:T.DoubleSide}),dummy=new T.Object3D();
 const position=plan.roof.positions.map((v,i)=>i%3===1?v+plan.top-.08:v),g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(position,3));g.computeVertexNormals();const underside=new T.Mesh(g,soffit);underside.userData.surface='station-canopy-soffit';group.add(underside);
 if(plan.skylights.length){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(plan.skylights.map((v,i)=>i%3===1?v+plan.top:v),3));g.computeVertexNormals();const mesh=new T.Mesh(g,new T.MeshLambertMaterial({color:'#e3eee5',emissive:'#c1d0c8',emissiveIntensity:.16,transparent:true,opacity:.45,depthWrite:false,side:T.DoubleSide}));mesh.userData.surface='station-canopy-skylights';group.add(mesh);}
 if(plan.posts.length){const mesh=new T.InstancedMesh(new T.CylinderGeometry(.25,.31,1,10),concrete,plan.posts.length);plan.posts.forEach((p,i)=>{dummy.position.set(p.x,(p.y+p.top)/2,p.z);dummy.rotation.set(0,0,0);dummy.scale.set(1,p.top-p.y,1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.computeBoundingSphere();mesh.userData.surface='station-canopy-columns';group.add(mesh);}
 if(plan.beams.length){const mesh=new T.InstancedMesh(new T.BoxGeometry(.07,.07,1),steel,plan.beams.length);plan.beams.forEach((p,i)=>{dummy.position.copy(p.a).add(p.b).multiplyScalar(.5);dummy.quaternion.setFromRotationMatrix(new T.Matrix4().lookAt(p.a,p.b,new T.Vector3(0,1,0)));dummy.scale.set(1,1,p.a.distanceTo(p.b));dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.computeBoundingSphere();mesh.userData.surface='station-canopy-spaceframe';group.add(mesh);}
 return plan.posts;
}
