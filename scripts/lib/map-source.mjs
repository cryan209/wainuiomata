import fs from 'node:fs';
import * as T from '../../dist/vendor/three.js';
import {assembleRegionalMap} from '../../dist/regional-map.js';
const root=new URL('../../dist/',import.meta.url),json=n=>JSON.parse(fs.readFileSync(new URL(n+'.json',root))),read=n=>{const b=fs.readFileSync(new URL(n+'.bin',root));return new Int32Array(b.buffer,b.byteOffset,b.byteLength/4)};
export function regionalMap(){const index=json('regional-map');return assembleRegionalMap(index,index.parts.map(p=>json(p.file.replace(/\.json$/,''))))}
export function mapSource(){
 const meta=json('geodata'),coarse=read('terrain'),fine=read('terrain-fine'),regional=read('regional-terrain'),regionalMeta=json('regional-terrain'),cg={...meta.terrain,width:meta.terrain.size,height:meta.terrain.size};
 function sample(a,g,x,z){const u=T.MathUtils.clamp((x-g.minX)/g.step,0,g.width-1.000001),v=T.MathUtils.clamp((z-g.minZ)/g.step,0,g.height-1.000001),i=Math.floor(u),j=Math.floor(v),du=u-i,dv=v-j,k=j*g.width+i;return(du+dv<=1?a[k]+du*(a[k+1]-a[k])+dv*(a[k+g.width]-a[k]):a[k+g.width+1]+(1-du)*(a[k+g.width]-a[k+g.width+1])+(1-dv)*(a[k+1]-a[k+g.width+1]))/100-meta.originElevation}
 const regionalHeight=(x,z)=>sample(regional,regionalMeta,x,z),coarseHeight=(x,z)=>{const e=Math.min(x-cg.minX,z-cg.minZ,cg.minX+(cg.width-1)*cg.step-x,cg.minZ+(cg.height-1)*cg.step-z);return e<0?regionalHeight(x,z):T.MathUtils.lerp(regionalHeight(x,z),sample(coarse,cg,x,z),Math.min(1,e/100))},terrain=(x,z)=>{const f=meta.fine,e=Math.min(x-f.minX,z-f.minZ,f.minX+(f.width-1)*f.step-x,f.minZ+(f.height-1)*f.step-z);return e<0?coarseHeight(x,z):T.MathUtils.lerp(coarseHeight(x,z),sample(fine,f,x,z),Math.min(1,e/20))};
 const railways=railSource(json('railways'),meta.originElevation),raw=(x,z)=>railways.ground(x,z,terrain(x,z));
 return{meta,raw,railways,bounds:regionalMeta.bounds,elements:[...new Map([...json('map').elements,...regionalMap().elements].map(e=>[e.id,e])).values()],waterways:[...new Map([...json('waterways'),...json('regional-waterways')].map(e=>[e.id,e])).values()]};
}

// Data-only equivalent of the game's rail queries; audits do not build sleepers or train meshes.
function railSource(data,datum){const cells=new Map();for(const track of data.tracks)for(let i=1;i<track.p.length;i++){const a=track.p[i-1],b=track.p[i],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);if(length<.01)continue;const s={a,b,dx,dz,length,track};for(let x=Math.floor((Math.min(a.x,b.x)-6)/100);x<=Math.floor((Math.max(a.x,b.x)+6)/100);x++)for(let z=Math.floor((Math.min(a.z,b.z)-6)/100);z<=Math.floor((Math.max(a.z,b.z)+6)/100);z++){const key=x+','+z;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(s)}}
 function at(x,z,range=1){let best=null;for(let ix=-range;ix<=range;ix++)for(let iz=-range;iz<=range;iz++)for(const s of cells.get((Math.floor(x/100)+ix)+','+(Math.floor(z/100)+iz))||[]){const t=T.MathUtils.clamp(((x-s.a.x)*s.dx+(z-s.a.z)*s.dz)/(s.length*s.length),0,1),d=Math.hypot(x-s.a.x-s.dx*t,z-s.a.z-s.dz*t);if(!best||d<best.d)best={s,t,d,y:T.MathUtils.lerp(s.a.h,s.b.h,t)-datum}}return best}
 return{at,ground(x,z,h){const hit=at(x,z,0);if(!hit||hit.s.track.bridge||hit.s.track.tunnel||hit.d>5)return h;return T.MathUtils.lerp(h,hit.y-.12,1-T.MathUtils.smoothstep(hit.d,1.6,5))}}}
