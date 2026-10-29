import * as T from './vendor/three.js';
function clip(poly,axis,level,above){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ia=above?a[axis]>=level:a[axis]<=level,ib=above?b[axis]>=level:b[axis]<=level;if(ia)out.push(a);if(ia!==ib){const t=(level-a[axis])/(b[axis]-a[axis]);out.push(a.map((v,j)=>v+(b[j]-v)*t))}}return out}
export function roofTileTriangles(positions,span,available){
 const batches=new Map();
 for(let i=0;i<positions.length;i+=9){
  const triangle=[Array.from(positions.slice(i,i+3)),Array.from(positions.slice(i+3,i+6)),Array.from(positions.slice(i+6,i+9))],xs=triangle.map(p=>p[0]),zs=triangle.map(p=>p[2]),x0=Math.floor(Math.min(...xs)/span),x1=Math.floor(Math.max(...xs)/span),z0=Math.floor(Math.min(...zs)/span),z1=Math.floor(Math.max(...zs)/span);
  if(x0===x1&&z0===z1){const key=x0+','+z0;if(available.has(key)){if(!batches.has(key))batches.set(key,[]);batches.get(key).push(...triangle[0],...triangle[1],...triangle[2])}continue}
  for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){const key=x+','+z;if(!available.has(key))continue;let poly=triangle;for(const [axis,level,above]of [[0,x*span,true],[0,(x+1)*span,false],[2,z*span,true],[2,(z+1)*span,false]]){poly=clip(poly,axis,level,above);if(poly.length<3)break}if(poly.length<3)continue;if(!batches.has(key))batches.set(key,[]);const p=batches.get(key);for(let j=1;j<poly.length-1;j++)p.push(...poly[0],...poly[j],...poly[j+1])}
 }
 return batches;
}
export function createRoofDetail(scene,manifest,photoMaterials){
 function append(target,values){for(let i=0;i<values.length;i+=8192)target.push(...values.slice(i,i+8192))}
 const meta=new Map(manifest.tiles.map(t=>[t.id,t])),positions=new Map(),tiles=[],loader=new T.TextureLoader();let next=0,inflight=0,selected=new Set(),disposed=0;
 function add(data){for(const [key,values]of roofTileTriangles(data,manifest.span,meta)){if(!positions.has(key))positions.set(key,[]);append(positions.get(key),values)}}
 function finish(){for(const [key,p]of positions){const t=meta.get(key),g=new T.BufferGeometry(),uv=[];for(let i=0;i<p.length;i+=3)uv.push((p[i]-t.minX)/manifest.span,(t.maxZ-p[i+2])/manifest.span);g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));const material=new T.MeshBasicMaterial({side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,depthWrite:false}),mesh=new T.Mesh(g,material);mesh.visible=false;mesh.renderOrder=1;scene.add(mesh);photoMaterials.push(material);tiles.push({...t,key,mesh,material,texture:null,pending:false,retry:0,x:(t.minX+t.maxX)/2,z:(t.minZ+t.maxZ)/2})}positions.clear()}
 function pump(){for(const t of tiles){if(inflight>=3)break;if(!selected.has(t.key)||t.texture||t.pending||performance.now()<t.retry)continue;t.pending=true;inflight++;loader.load('./'+t.image,map=>{inflight--;t.pending=false;if(!selected.has(t.key)){map.dispose();disposed++;pump();return}map.colorSpace=T.SRGBColorSpace;map.magFilter=T.LinearFilter;map.minFilter=T.LinearMipmapLinearFilter;map.anisotropy=8;t.texture=map;t.material.map=map;t.material.needsUpdate=true;t.mesh.visible=true;pump()},undefined,()=>{inflight--;t.pending=false;t.retry=performance.now()+30000;pump()})}}
 function update(camera){const now=performance.now();if(now<next)return;next=now+300;selected=new Set();let pixels=0;const near=[...tiles].map(t=>({t,d:Math.hypot(t.x-camera.x,t.z-camera.z)})).filter(v=>v.d<520).sort((a,b)=>a.d-b.d);for(const {t}of near){const cost=t.width*t.height;if(pixels+cost>18e6)continue;selected.add(t.key);pixels+=cost}for(const t of tiles)if(!selected.has(t.key)&&t.texture){t.mesh.visible=false;t.material.map=null;t.material.needsUpdate=true;t.texture.dispose();t.texture=null;disposed++}pump()}
 return{add,finish,update,get stats(){return{tiles:tiles.length,loaded:tiles.filter(t=>t.texture).length,inflight,disposed}}};
}
