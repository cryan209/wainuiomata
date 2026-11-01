import * as T from './vendor/three.js';
import {addWaterlooFixtures} from './waterloo-fixtures.js?v=waterloo-reference-104';

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
 const height=(x,z)=>{const {v}=local(x,z);return v>=14?-Math.abs(v-21)*.018:-1.15-Math.abs(v+6)*.018;},positions=[],skylights=[],fascia=[];
 const clip=(poly,sign)=>{const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],c=poly[(i+1)%poly.length],av=(a.v-14)*sign,cv=(c.v-14)*sign;if(av>=0)out.push(a);if((av>=0)!==(cv>=0)){const t=av/(av-cv);out.push(Object.fromEntries(['x','z','u','v'].map(k=>[k,T.MathUtils.lerp(a[k],c[k],t)])));}}return out;};
 const quad=(out,a,c,d,e)=>out.push(...a,...c,...d,...a,...d,...e);
 const clipAxis=(poly,edge,sign,axis)=>{const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],c=poly[(i+1)%poly.length],av=(a[axis]-edge)*sign,cv=(c[axis]-edge)*sign;if(av>=0)out.push(a);if((av>=0)!==(cv>=0)){const t=av/(av-cv);out.push(Object.fromEntries(['x','z','u','v'].map(k=>[k,T.MathUtils.lerp(a[k],c[k],t)])));}}return out;};
 const minV0=Math.min(...all.map(p=>p.v)),maxV0=Math.max(...all.map(p=>p.v));
 for(const tri of triangles)for(const sign of [-1,1]){
  const poly=clip(tri.map(i=>all[i]),sign);if(poly.length<3)continue;
  for(let u=Math.floor(Math.min(...poly.map(p=>p.u))/12)*12;u<Math.max(...poly.map(p=>p.u));u+=12){
   for(const [lo,hi,light]of [[u,u+9.6,false],[u+9.6,u+12,true]]){
    const strip=clipAxis(clipAxis(poly,lo,1,'u'),hi,-1,'u');
    const bands=light?[[minV0,-24,false],[-24,-21,true],[-21,8,false],[8,11,true],[11,22,false],[22,25,true],[25,maxV0,false]]:[[minV0,maxV0,false]];
    for(const [a,b,glass]of bands){if(b<=a)continue;const panel=clipAxis(clipAxis(strip,a,1,'v'),b,-1,'v'),out=glass?skylights:positions;for(let i=1;i<panel.length-1;i++)for(const p of [panel[0],panel[i+1],panel[i]])out.push(p.x,sign===1?-Math.abs(p.v-21)*.018:-1.15-Math.abs(p.v+6)*.018,p.z);}
   }
  }
 }
 for(const ring of rings)for(let i=0;i<ring.length;i++){const a=ring[i],c=ring[(i+1)%ring.length],ha=height(a.x,a.z),hc=height(c.x,c.z);quad(fascia,[a.x,ha-.18,a.z],[c.x,hc-.18,c.z],[c.x,hc,c.z],[a.x,ha,a.z]);}
 const minU=Math.min(...all.map(p=>p.u)),maxU=Math.max(...all.map(p=>p.u)),minV=Math.min(...all.map(p=>p.v)),maxV=Math.max(...all.map(p=>p.v)),nodes=new Map(),beams=[],posts=[];
 for(let i=Math.ceil(minU/4);i<=Math.floor(maxU/4);i++)for(let j=Math.ceil(minV/4);j<=Math.floor(maxV/4);j++){const p=world(i*4,j*4);if(!insideStation(b.rings,p.x,p.z))continue;nodes.set(i+','+j,{...p,i,j,y:top+height(p.x,p.z)});}
 for(const p of nodes.values()){
  for(const [di,dj]of [[1,0],[0,1]]){const q=nodes.get((p.i+di)+','+(p.j+dj));if(!q||![.25,.5,.75].every(t=>insideStation(b.rings,T.MathUtils.lerp(p.x,q.x,t),T.MathUtils.lerp(p.z,q.z,t))))continue;
   for(const down of [.18,1.1])beams.push({a:new T.Vector3(p.x,p.y-down,p.z),b:new T.Vector3(q.x,q.y-down,q.z)});
   beams.push({a:new T.Vector3(p.x,p.y-1.1,p.z),b:new T.Vector3(q.x,q.y-.18,q.z)});
  }
 }
 // Photo-matched rows of blue columns; the visible umbrella braces sit below
 // an opaque ribbed ceiling. The dense spaceframe stays in the roof cavity.
 const fans=[];
 for(const v of [-22,4.5,24.5])for(let u=-80;u<=90;u+=15){
  const p=world(u,v);if(!insideStation(b.rings,p.x,p.z))continue;
  if(u>=-12&&u<=34&&v>7&&v<19)continue;
  const rail=railways.at(p.x,p.z,0),road=network?.at(p.x,p.z);
  if(rail&&rail.d<3.2||road&&!['path','footway','cycleway','pedestrian','steps'].includes(road.r.type)&&road.d<road.r.width/2+.6)continue;
  const floor=railways.walkHeight?.(p.x,p.z)??ground(p.x,p.z),ceiling=top+height(p.x,p.z)-1.15,head=ceiling-1.65;if(head-floor<2.4)continue;
  posts.push({x:p.x,z:p.z,y:floor,top:head,radius:.28});
  const anchors=[];for(const [du,dv]of [[-2.6,-2.6],[2.6,-2.6],[2.6,2.6],[-2.6,2.6]]){const q=world(u+du,v+dv);if(insideStation(b.rings,q.x,q.z)){const tip=new T.Vector3(q.x,top+height(q.x,q.z)-1.17,q.z);fans.push({a:new T.Vector3(p.x,head-.06,p.z),b:tip});anchors.push(tip);}else anchors.push(null);}
  for(let i=0;i<4;i++)if(anchors[i]&&anchors[(i+1)%4])fans.push({a:anchors[i],b:anchors[(i+1)%4]});
 }
 return{top,height,local,world,rings:b.rings,railways,network,ground,roof:{positions,fascia,walls:[]},skylights,beams,fans,posts};
}

function soffitTexture(){
 const pixels=new Uint8Array(256*32*4);for(let y=0;y<32;y++)for(let x=0;x<256;x++){const v=225+Math.round(9*Math.cos(x*Math.PI/2))+((x*17+y*23)%7);pixels.set([v,Math.round(v*.97),Math.round(v*.86),255],(y*256+x)*4);}
 const texture=new T.DataTexture(pixels,256,32);texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.anisotropy=4;texture.needsUpdate=true;return texture;
}
export function addWaterlooCanopy(group,plan){
 const texture=soffitTexture(),blue=new T.MeshLambertMaterial({color:'#243d61'}),steel=new T.MeshLambertMaterial({color:'#b4b5ad'}),wine=new T.MeshLambertMaterial({color:'#4d2733'}),soffit=new T.MeshStandardMaterial({map:texture,bumpMap:texture,bumpScale:.007,color:'#e5dfc8',roughness:.92,side:T.DoubleSide}),dummy=new T.Object3D();
 const positions=plan.roof.positions.map((v,i)=>i%3===1?v+plan.top-1.15:v),g=new T.BufferGeometry(),uv=[];for(let i=0;i<positions.length;i+=3){const p=plan.local(positions[i],positions[i+2]);uv.push(p.u/4,p.v/4);}g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();const underside=new T.Mesh(g,soffit);underside.userData.surface='station-canopy-soffit';underside.userData.ownedTextures=[texture];group.add(underside);
 if(plan.skylights.length){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(plan.skylights.map((v,i)=>i%3===1?v+plan.top-1.14:v),3));g.computeVertexNormals();const mesh=new T.Mesh(g,new T.MeshLambertMaterial({color:'#f1f0df',emissive:'#d7dfd6',emissiveIntensity:.12,transparent:true,opacity:.55,depthWrite:false,side:T.DoubleSide}));mesh.userData.surface='station-canopy-skylights';group.add(mesh);}
 if(plan.posts.length){const mesh=new T.InstancedMesh(new T.CylinderGeometry(.24,.28,1,12),blue,plan.posts.length);plan.posts.forEach((p,i)=>{dummy.position.set(p.x,(p.y+p.top)/2,p.z);dummy.rotation.set(0,0,0);dummy.scale.set(1,p.top-p.y,1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.computeBoundingSphere();mesh.userData.surface='station-canopy-columns';group.add(mesh);}
 function beams(items,material,size,surface){if(!items.length)return;const mesh=new T.InstancedMesh(new T.BoxGeometry(size,size,1),material,items.length);items.forEach((p,i)=>{dummy.position.copy(p.a).add(p.b).multiplyScalar(.5);dummy.quaternion.setFromRotationMatrix(new T.Matrix4().lookAt(p.a,p.b,new T.Vector3(0,1,0)));dummy.scale.set(1,1,p.a.distanceTo(p.b));dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.computeBoundingSphere();mesh.userData.surface=surface;group.add(mesh);}
 beams(plan.beams,steel,.06,'station-canopy-spaceframe');beams(plan.fans,wine,.09,'waterloo-umbrella-braces');
 return{posts:plan.posts,...addWaterlooFixtures(group,plan)};
}
