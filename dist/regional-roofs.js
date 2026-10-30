import * as T from './vendor/three.js';
// Split footprint triangles where roof planes meet: ridges remain sharp and holes stay open.
export function regionalRoof(building,flat=false){
 const r=building.roof,frame=r?.frame||[0,0,1,0,1,1], [cx,cz,ux,uz,length,width]=frame,halfL=Math.max(.1,length/2),halfW=Math.max(.1,width/2),rise=flat?0:Math.max(0,r?.rise||0),kind=flat?'flat':r?.kind||'flat';
 const point=([x,z])=>({x,z,u:(x-cx)*ux+(z-cz)*uz,v:-(x-cx)*uz+(z-cz)*ux}),rings=building.rings.map(ring=>ring.slice(0,-1).map(point)),all=rings.flat(),triangles=T.ShapeUtils.triangulateShape(rings[0].map(p=>new T.Vector2(p.x,p.z)),rings.slice(1).map(r=>r.map(p=>new T.Vector2(p.x,p.z)))),positions=[],walls=[],fascia=[];
 const planes=kind==='flat'||!rise?[[0,0,0]]:kind==='hip'?[[0,1/halfW,1],[0,-1/halfW,1],[1/halfW,0,halfL/halfW],[-1/halfW,0,halfL/halfW]]:[[0,1/halfW,1],[0,-1/halfW,1]];
 const value=(p,q)=>q[0]*p.u+q[1]*p.v+q[2],height=p=>rise*Math.max(0,Math.min(1,...planes.map(q=>value(p,q)))),mix=(a,b,t)=>Object.fromEntries(['x','z','u','v'].map(k=>[k,a[k]+(b[k]-a[k])*t]));
 function clip(poly,fn){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],av=fn(a),bv=fn(b);if(av>=-1e-8)out.push(a);if((av>=0)!==(bv>=0))out.push(mix(a,b,av/(av-bv)))}return out}
 for(const tri of triangles)for(const plane of planes){let poly=tri.map(i=>all[i]);for(const other of planes)if(other!==plane)poly=clip(poly,p=>value(p,other)-value(p,plane));for(let i=1;i<poly.length-1;i++)for(const p of [poly[0],poly[i+1],poly[i]])positions.push(p.x,height(p),p.z)}
 const quad=(out,a,b,c,d)=>out.push(...a,...b,...c,...a,...c,...d);
 for(const ring of rings)for(let i=0;i<ring.length;i++){
  const a=ring[i],b=ring[(i+1)%ring.length],cuts=[0,1];for(let j=0;j<planes.length;j++)for(let k=j+1;k<planes.length;k++){const av=value(a,planes[j])-value(a,planes[k]),bv=value(b,planes[j])-value(b,planes[k]);if(av*bv<0)cuts.push(av/(av-bv))}cuts.sort((a,b)=>a-b);
  for(let j=1;j<cuts.length;j++){const p=mix(a,b,cuts[j-1]),q=mix(a,b,cuts[j]),hp=height(p),hq=height(q);if(hp+hq>.001)quad(walls,[p.x,0,p.z],[q.x,0,q.z],[q.x,hq,q.z],[p.x,hp,p.z]);quad(fascia,[p.x,hp-.14,p.z],[q.x,hq-.14,q.z],[q.x,hq,q.z],[p.x,hp,p.z]);}
  if(kind==='flat'&&!flat){const dx=b.x-a.x,dz=b.z-a.z,n=Math.hypot(dx,dz)||1;quad(fascia,[a.x,0,a.z],[b.x,0,b.z],[b.x,.3,b.z],[a.x,.3,a.z]);quad(fascia,[a.x,.3,a.z],[b.x,.3,b.z],[b.x-dz/n*.16,.3,b.z+dx/n*.16],[a.x-dz/n*.16,.3,a.z+dx/n*.16]);}
 }
 return{positions,walls,fascia,rise,height:(x,z)=>height(point([x,z]))};
}

export function farRoofGeometry(hip=false){
 const p=[],a=[-.5,0,-.5],b=[.5,0,-.5],c=[.5,0,.5],d=[-.5,0,.5],l=[hip?-.25:-.5,1,0],r=[hip?.25:.5,1,0];
 for(const t of [[a,l,r],[a,r,b],[d,c,r],[d,r,l],[a,d,l],[b,r,c]])p.push(...t.flat());const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.computeVertexNormals();return g;
}
