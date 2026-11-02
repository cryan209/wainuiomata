import * as T from './vendor/three.js';

// Re-indexes one static, untransformed mesh into a mesh per cell-sized square of the ground plane. The parts share
// the original vertex buffers and material; only the index and bounding sphere are new, so frustum and far-plane
// culling can skip squares out of view. Parts never move, so they skip three's per-frame matrix rebuild, and their
// vertex data is released from JavaScript once uploaded.
// The caller adds the parts and drops the original.
export function splitMeshByCell(mesh,cell){
 const g=mesh.geometry,pos=g.attributes.position,index=g.index,count=index?index.count:pos.count,cells=new Map();
 // Normals computed later on a part would allocate a full-size array per part, so settle them once here.
 if(!g.attributes.normal)g.computeVertexNormals();
 for(let t=0;t<count;t+=3){
  const a=index?index.getX(t):t,b=index?index.getX(t+1):t+1,c=index?index.getX(t+2):t+2;
  const x=(pos.getX(a)+pos.getX(b)+pos.getX(c))/3,z=(pos.getZ(a)+pos.getZ(b)+pos.getZ(c))/3,key=Math.floor(x/cell)+','+Math.floor(z/cell);
  let list=cells.get(key);if(!list)cells.set(key,list=[]);list.push(a,b,c);
 }
 const parts=[],box=new T.Box3(),point=new T.Vector3();
 for(const list of cells.values()){
  const geo=new T.BufferGeometry();for(const[name,attr]of Object.entries(g.attributes))geo.setAttribute(name,attr);geo.setIndex(list);
  box.makeEmpty();for(const i of list)box.expandByPoint(point.fromBufferAttribute(pos,i));
  geo.boundingBox=box.clone();geo.boundingSphere=box.getBoundingSphere(new T.Sphere());
  const part=new T.Mesh(geo,mesh.material);part.name=mesh.name;part.userData={...mesh.userData};part.renderOrder=mesh.renderOrder;part.matrixAutoUpdate=false;part.customDepthMaterial=mesh.customDepthMaterial;releaseAfterUpload(geo);parts.push(part);
 }
 return parts;
}

// Turns a triangle soup (three vertices per triangle) into indexed geometry by merging vertices whose every
// attribute is bit-identical. Normals are compared too, so faceted surfaces stay faceted: call it after normals are
// computed. Shared vertices let the GPU reuse transformed corners and roughly halve memory for merged walls and roofs.
// Geometry that is already indexed, interleaved or not 32-bit throughout is returned unchanged.
// `smooth` ignores normals when matching and recomputes them afterwards, for surfaces lying on the ground (roads,
// pavements) where faceted normals on sloping strips would otherwise keep every corner separate.
export function weldVertices(g,options){return finishSteps(weldSteps(g,options))}
// The same, as steps of about 32k vertices for builders that pace their work across frames (`yield*` it).
export function* weldSteps(g,{smooth=false}={}){
 if(g.index)return g;
 const attrs=Object.entries(g.attributes).filter(([name])=>!smooth||name!=='normal');
 if(!attrs.length||attrs.some(([,a])=>a.isInterleavedBufferAttribute||a.array.BYTES_PER_ELEMENT!==4))return g;
 const count=g.attributes.position.count,views=attrs.map(([,a])=>new Uint32Array(a.array.buffer,a.array.byteOffset,a.array.length)),sizes=attrs.map(([,a])=>a.itemSize);
 let slots=1;while(slots<count*2)slots<<=1;const mask=slots-1,table=new Int32Array(slots).fill(-1),first=new Uint32Array(count),remap=new Uint32Array(count);let unique=0;
 // -0 and +0 differ in bits but not in value (flat normals often carry -0), so both read as +0.
 const bits=w=>w===2147483648?0:w,same=(a,b)=>{for(let k=0;k<views.length;k++){const v=views[k],n=sizes[k];for(let j=0;j<n;j++)if(bits(v[a*n+j])!==bits(v[b*n+j]))return false}return true};
 for(let i=0;i<count;i++){
  let h=2166136261;for(let k=0;k<views.length;k++){const v=views[k],n=sizes[k];for(let j=0;j<n;j++)h=Math.imul(h^bits(v[i*n+j]),16777619)}
  let s=h&mask;
  for(;;){const u=table[s];if(u<0){table[s]=unique;first[unique]=i;remap[i]=unique++;break}if(same(first[u],i)){remap[i]=u;break}s=(s+1)&mask}
  if((i&32767)===32767)yield;
 }
 if(unique>count*.9)return g;
 const out=new T.BufferGeometry();
 attrs.forEach(([name,a],k)=>{const n=sizes[k],src=a.array,dst=new src.constructor(unique*n);for(let u=0;u<unique;u++){const i=first[u];for(let j=0;j<n;j++)dst[u*n+j]=src[i*n+j]}out.setAttribute(name,new T.BufferAttribute(dst,n,a.normalized))});
 out.setIndex(new T.BufferAttribute(unique<65536?new Uint16Array(remap):remap,1));
 for(const group of g.groups)out.addGroup(group.start,group.count,group.materialIndex);
 out.setDrawRange(g.drawRange.start,g.drawRange.count);out.userData=g.userData;if(smooth&&g.attributes.normal)out.computeVertexNormals();return out;
}

// Runs a step generator to its end and returns its result, for callers that build in one go.
export function finishSteps(steps){let r;while(!(r=steps.next()).done);return r.value}

// Static scenery only needs its vertex data in JavaScript until the GPU has a copy. Bounds are settled first (culling
// reads them), then each attribute and index drops its array right after upload, roughly halving the memory this
// geometry costs. Only for geometry nothing reads or rewrites after it is built.
function dropArray(){this.array=null}
export function releaseAfterUpload(g){
 if(!g.boundingBox)g.computeBoundingBox();if(!g.boundingSphere)g.computeBoundingSphere();
 for(const a of Object.values(g.attributes))if(!a.isInterleavedBufferAttribute)a.onUpload(dropArray);
 g.index?.onUpload(dropArray);return g;
}

// Parts registered as small details hide beyond the graphics tier's detail range in metres (Infinity shows all).
const detailParts=new Set();let detailRange=Infinity;
export function smallDetail(parts){for(const p of parts){detailParts.add(p);p.geometry.addEventListener('dispose',()=>detailParts.delete(p))}return parts}
export function setDetailRange(metres){detailRange=metres;if(metres===Infinity)for(const p of detailParts)p.visible=true}
export function updateDetailRange(camera){if(detailRange===Infinity)return;for(const p of detailParts){const s=p.geometry.boundingSphere;p.visible=Math.hypot(s.center.x-camera.x,s.center.z-camera.z)-s.radius<detailRange}}
