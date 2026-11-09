import * as T from './vendor/three.js';

// Subtract bore prisms from triangles rather than depending on a camera-sized
// shader uniform list. Normals, colours and georeferenced UVs follow cut edges.
const CELL=128;
const distance=(plane,p)=>plane[0]*p[0]+plane[1]*p[1]+plane[2]*p[2]-plane[3];
function hasArea(poly){
 if(poly.length<3)return false;const a=poly[0];for(let i=1;i<poly.length-1;i++){const b=poly[i],c=poly[i+1],x=b[0]-a[0],y=b[1]-a[1],z=b[2]-a[2],u=c[0]-a[0],v=c[1]-a[1],w=c[2]-a[2];if(Math.hypot(y*w-z*v,z*u-x*w,x*v-y*u)>1e-7)return true}return false;
}
function split(poly,plane,inside){
 const out=[];if(!poly.length)return out;
 if(poly.every(p=>Math.abs(distance(plane,p))<1e-7))return inside?poly:[];
 let p=poly.at(-1),dp=distance(plane,p);
 for(const q of poly){const dq=distance(plane,q),a=inside?dp>=0:dp<=0,b=inside?dq>=0:dq<=0;
  if(a!==b){const t=dp/(dp-dq);out.push(p.map((v,i)=>v+(q[i]-v)*t))}
  if(b)out.push(q);p=q;dp=dq;
 }return out;
}
export function createTerrainCutouts(definitions=[]){
 const cells=new Map();let count=0;
 for(const d of definitions){
  const dx=d.b.x-d.a.x,dz=d.b.z-d.a.z,len=Math.hypot(dx,dz);if(len<.001)continue;
  const ux=dx/len,uz=dz/len,lo=d.lo??0,hi=d.hi??len,half=d.half,sloped=(d.b.y-d.a.y)/len;
  const plane=(x,y,z,p)=>[x,y,z,x*p.x+y*p.y+z*p.z];
  const a={x:d.a.x+ux*lo,y:d.a.y+sloped*lo,z:d.a.z+uz*lo},b={x:d.a.x+ux*hi,y:d.a.y+sloped*hi,z:d.a.z+uz*hi};
  const bore={id:count++,planes:[plane(ux,0,uz,a),plane(-ux,0,-uz,b),plane(uz,0,-ux,{x:a.x-uz*half,y:0,z:a.z+ux*half}),plane(-uz,0,ux,{x:a.x+uz*half,y:0,z:a.z-ux*half}),plane(-ux*sloped,1,-uz*sloped,{...a,y:a.y-(d.depth??4)}),plane(ux*sloped,-1,uz*sloped,{...a,y:a.y+d.height})],minY:Math.min(a.y,b.y)-(d.depth??4),maxY:Math.max(a.y,b.y)+d.height,minX:Math.min(a.x,b.x)-Math.abs(uz*half),maxX:Math.max(a.x,b.x)+Math.abs(uz*half),minZ:Math.min(a.z,b.z)-Math.abs(ux*half),maxZ:Math.max(a.z,b.z)+Math.abs(ux*half)};
  for(let x=Math.floor((Math.min(a.x,b.x)-half)/CELL);x<=Math.floor((Math.max(a.x,b.x)+half)/CELL);x++)for(let z=Math.floor((Math.min(a.z,b.z)-half)/CELL);z<=Math.floor((Math.max(a.z,b.z)+half)/CELL);z++){const key=x+','+z;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(bore)}
 }
 function candidates(a,b,c){
  const found=new Set(),lowY=Math.min(a[1],b[1],c[1]),highY=Math.max(a[1],b[1],c[1]),lowX=Math.min(a[0],b[0],c[0]),highX=Math.max(a[0],b[0],c[0]),lowZ=Math.min(a[2],b[2],c[2]),highZ=Math.max(a[2],b[2],c[2]);
  for(let x=Math.floor(Math.min(a[0],b[0],c[0])/CELL);x<=Math.floor(Math.max(a[0],b[0],c[0])/CELL);x++)for(let z=Math.floor(Math.min(a[2],b[2],c[2])/CELL);z<=Math.floor(Math.max(a[2],b[2],c[2])/CELL);z++)for(const bore of cells.get(x+','+z)||[])if(highY>=bore.minY&&lowY<=bore.maxY&&highX>=bore.minX&&lowX<=bore.maxX&&highZ>=bore.minZ&&lowZ<=bore.maxZ)found.add(bore);
  return found;
 }
 function* carve(geometry){
  if(!count)return geometry;
  const attributes=Object.entries(geometry.attributes),position=geometry.attributes.position,index=geometry.index?.array;
  const sizes=attributes.map(([,a])=>a.itemSize),offsets=[];let stride=0;for(const size of sizes){offsets.push(stride);stride+=size}
  geometry.computeBoundingBox();const box=geometry.boundingBox;let relevant=false;
  for(let x=Math.floor(box.min.x/CELL);x<=Math.floor(box.max.x/CELL)&&!relevant;x++)for(let z=Math.floor(box.min.z/CELL);z<=Math.floor(box.max.z/CELL);z++)if(cells.has(x+','+z)){relevant=true;break}
  if(!relevant)return geometry;
  let out=null;const indices=[],sourceCount=index?.length??position.count;let changed=false,serial=position.count;
  const vertex=i=>attributes.flatMap(([,attribute])=>Array.from(attribute.array.subarray(i*attribute.itemSize,(i+1)*attribute.itemSize)));
  const emit=triangle=>{const a=triangle[0],b=triangle[1],c=triangle[2],u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],v=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];if(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])<1e-7)return;
   out??=attributes.map(([,a])=>Array.from(a.array));
   for(const p of triangle){indices.push(serial++);for(let j=0;j<attributes.length;j++){let values=p.slice(offsets[j],offsets[j]+sizes[j]);if(attributes[j][0]==='normal'){const length=Math.hypot(...values)||1;values=values.map(v=>v/length)}out[j].push(...values)}}
  };
  for(let i=0;i<sourceCount;i+=3){
   if(i%384===0)yield;
   const ids=[index?.[i]??i,index?.[i+1]??i+1,index?.[i+2]??i+2],points=ids.map(j=>[position.getX(j),position.getY(j),position.getZ(j)]),near=candidates(...points);
   if(!near.size){indices.push(...ids);continue}
   let pieces=[ids.map(vertex)],cut=false;
   for(const bore of near){const remaining=[];for(const piece of pieces){let overlap=piece;for(const plane of bore.planes){overlap=split(overlap,plane,true);if(overlap.length<3)break}if(!hasArea(overlap)){remaining.push(piece);continue}changed=true;cut=true;let inner=piece;for(const plane of bore.planes){const outside=split(inner,plane,false);if(hasArea(outside))remaining.push(outside);inner=split(inner,plane,true);if(!hasArea(inner))break}}pieces=remaining;if(!pieces.length)break}
   if(!cut)indices.push(...ids);else for(const piece of pieces)for(let j=1;j<piece.length-1;j++)emit([piece[0],piece[j],piece[j+1]]);
  }
  if(!changed)return geometry;
  const result=new T.BufferGeometry();for(let j=0;j<attributes.length;j++)result.setAttribute(attributes[j][0],out?new T.Float32BufferAttribute(out[j],sizes[j]):geometry.attributes[attributes[j][0]]);result.setIndex(indices);result.computeBoundingSphere();geometry.dispose();return result;
 }
 return{carve,get count(){return count}};
}
