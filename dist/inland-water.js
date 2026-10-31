import * as T from './vendor/three.js';

// Standing water uses mapped closed outlines. Open ways and covered tanks are
// deliberately excluded; closing a partial outline would invent a flooded area.
export function createInlandWater(scene,features,rawGround,material,{seaLevel=-Infinity}={}){
 const areas=[],cells=new Map(),loaded=new Map();
 for(const f of features){
  const t=f.tags,p=f.geometry;
  if(t.natural!=='water'||['river','stream','drain'].includes(t.water)||t.tunnel||t.covered==='yes'||['underground','roof'].includes(t.location)||t.man_made==='storage_tank')continue;
  if(p.length<4||p[0].x!==p.at(-1).x||p[0].z!==p.at(-1).z)continue;
  const ring=p.slice(0,-1),xs=ring.map(p=>p.x),zs=ring.map(p=>p.z),bounds=[Math.min(...xs),Math.min(...zs),Math.max(...xs),Math.max(...zs)];
  const heights=ring.map(p=>rawGround(p.x,p.z)).filter(Number.isFinite).sort((a,b)=>a-b);
  if(!heights.length)continue;
  const area={id:f.id,name:t.name||'Pond',ring,bounds,y:Math.max(seaLevel,heights[Math.floor((heights.length-1)*.2)]-.12),depth:['lake','reservoir'].includes(t.water)?2.5:1.1};
  areas.push(area);
  for(let ix=Math.floor(bounds[0]/100);ix<=Math.floor(bounds[2]/100);ix++)for(let iz=Math.floor(bounds[1]/100);iz<=Math.floor(bounds[3]/100);iz++){
   const key=ix+','+iz;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(area);
  }
 }
 function hit(x,z){
  for(const a of cells.get(Math.floor(x/100)+','+Math.floor(z/100))||[]){
   const b=a.bounds;if(x<b[0]||x>b[2]||z<b[1]||z>b[3])continue;
   let inside=false,distance=Infinity;
   for(let i=0,j=a.ring.length-1;i<a.ring.length;j=i++){
    const p=a.ring[i],q=a.ring[j],dx=q.x-p.x,dz=q.z-p.z,t=T.MathUtils.clamp(((x-p.x)*dx+(z-p.z)*dz)/(dx*dx+dz*dz||1),0,1);
    distance=Math.min(distance,Math.hypot(x-p.x-dx*t,z-p.z-dz*t));
    if((p.z>z)!==(q.z>z)&&x<(q.x-p.x)*(z-p.z)/(q.z-p.z)+p.x)inside=!inside;
   }
   if(!inside&&distance>.001)continue;
   const depth=a.depth*T.MathUtils.smoothstep(distance,0,6)+.03;
   const bed=Math.min(rawGround(x,z),a.y-depth);
   return{area:a,y:a.y,depth:a.y-bed,distance,bed,kind:'lake',flow:{x:0,z:0,speed:0}};
  }
  return null;
 }
 function near(x,z,margin=0){
  if(hit(x,z))return true;
  for(let ix=Math.floor((x-margin)/100);ix<=Math.floor((x+margin)/100);ix++)for(let iz=Math.floor((z-margin)/100);iz<=Math.floor((z+margin)/100);iz++)for(const a of cells.get(ix+','+iz)||[])
   for(let i=0,j=a.ring.length-1;i<a.ring.length;j=i++){
    const p=a.ring[i],q=a.ring[j],dx=q.x-p.x,dz=q.z-p.z,t=T.MathUtils.clamp(((x-p.x)*dx+(z-p.z)*dz)/(dx*dx+dz*dz||1),0,1);
    if(Math.hypot(x-p.x-dx*t,z-p.z-dz*t)<=margin)return true;
   }
  return false;
 }
 const distance=(a,c)=>{const b=a.bounds;return Math.hypot(Math.max(b[0]-c.x,0,c.x-b[2]),Math.max(b[1]-c.z,0,c.z-b[3]));};
 function update(camera){
  for(const [a,mesh]of loaded)if(distance(a,camera)>1600){scene.remove(mesh);mesh.geometry.dispose();loaded.delete(a);}
  const a=areas.find(a=>!loaded.has(a)&&distance(a,camera)<1100);if(!a)return;
  const shape=new T.Shape(a.ring.map(p=>new T.Vector2(p.x,-p.z))),g=new T.ShapeGeometry(shape);g.rotateX(-Math.PI/2);
  const p=g.attributes.position,uv=[],depth=[];
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);p.setY(i,a.y);uv.push(x/4,0);depth.push(a.depth);}
  g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('waterDepth',new T.Float32BufferAttribute(depth,1));g.computeVertexNormals();
  const mesh=new T.Mesh(g,material);mesh.name=a.name;mesh.userData.surface='inland-water';scene.add(mesh);loaded.set(a,mesh);
 }
 function drawMinimap(ctx,X,Y,camera,scale){ctx.fillStyle='#427e9b';for(const a of areas){if(distance(a,camera)>140/scale)continue;ctx.beginPath();a.ring.forEach((p,i)=>i?ctx.lineTo(X(p.x),Y(p.z)):ctx.moveTo(X(p.x),Y(p.z)));ctx.closePath();ctx.fill();}}
 return{areas,hit,near,update,drawMinimap,get chunks(){return loaded.size}};
}
