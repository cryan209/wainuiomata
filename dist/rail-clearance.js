import * as T from './vendor/three.js';

// Apply after road/junction grading so bridge approaches cannot refill a cutting.
export function railTerrainGround(railways,x,z,h){
 const hit=railways?.at(x,z,0);
 if(!hit||hit.s.track.bridge||hit.s.track.tunnel||hit.d>=6)return h;
 const weight=1-T.MathUtils.smoothstep(hit.d,2.6,6);
 return T.MathUtils.lerp(h,Math.min(h,hit.y-.16),weight);
}

// Rail subways often have stairs branching from the middle of a mapped way.
// Join every mapped node, not just way ends, and keep the roof below the rails.
export function planRailSubways(tunnels,roads,railways){
 if(!railways)return;
 const nodes=new Map(),edges=[],key=p=>p.node||p.x.toFixed(3)+','+p.y.toFixed(3);
 for(const r of tunnels)for(let i=0;i<r.p.length;i++){
  const p=r.p[i],id=key(p),h=T.MathUtils.lerp(r.floorStart,r.floorEnd,r.cumulative[i]/r.length);
  if(!nodes.has(id))nodes.set(id,{id,x:p.x,z:p.y,h,edges:[],outside:false,seed:false});else nodes.get(id).h=Math.min(nodes.get(id).h,h);
  if(i){const a=nodes.get(key(r.p[i-1])),b=nodes.get(id),edge={a,b,r,length:r.p[i-1].distanceTo(p)};a.edges.push(edge);b.edges.push(edge);edges.push(edge);}
 }
 for(const r of roads)if(!r.tunnel)for(const p of r.p){const n=nodes.get(key(p));if(n)n.outside=true;}
 for(const e of edges){const dx=e.b.x-e.a.x,dz=e.b.z-e.a.z,n=Math.max(1,Math.ceil(e.length/2));
  for(let j=0;j<=n;j++){
   const hit=railways.at(e.a.x+dx*j/n,e.a.z+dz*j/n,0);if(!hit||hit.d>4||hit.s.track.bridge||hit.s.track.tunnel||!hit.s.a)continue;
   const s=hit.s,den=dx*s.dz-dz*s.dx;if(Math.abs(den)<1e-6)continue;
   const rx=s.a.x-e.a.x,rz=s.a.z-e.a.z,t=(rx*s.dz-rz*s.dx)/den,u=(rx*dz-rz*dx)/den;if(t<0||t>1||u<0||u>1)continue;
   const floor=railways.at(e.a.x+dx*t,e.a.z+dz*t,0).y-e.r.headroom-.95;
   e.a.h=Math.min(e.a.h,floor);e.b.h=Math.min(e.b.h,floor);e.a.seed=e.b.seed=true;
  }
 }
 const affected=new Set(),queue=[...nodes.values()].filter(n=>n.seed);for(const n of queue)affected.add(n);
 for(let i=0;i<queue.length;i++)for(const e of queue[i].edges){const n=e.a===queue[i]?e.b:e.a;if(!affected.has(n)){affected.add(n);queue.push(n);}}
 for(let pass=0;pass<40;pass++){let changed=false;for(const e of edges){if(!affected.has(e.a))continue;const rise=e.length*(e.r.type==='steps'||e.r.tags.stairs==='yes'?.6:.25);for(const [a,b]of [[e.a,e.b],[e.b,e.a]])if(a.h>b.h+rise){a.h=b.h+rise;changed=true;}}if(!changed)break;}
 for(const r of tunnels){if(!affected.has(nodes.get(key(r.p[0]))))continue;r.railUnderpass=true;r.tunnelFloorHeights=r.p.map(p=>nodes.get(key(p)).h);r.floorStart=r.tunnelFloorHeights[0];r.floorEnd=r.tunnelFloorHeights.at(-1);const a=nodes.get(key(r.p[0])),b=nodes.get(key(r.p.at(-1)));r.portalStart=a.outside||a.edges.length===1;r.portalEnd=b.outside||b.edges.length===1;}
}

export function subwayFloorAt(r,s){if(!r.tunnelFloorHeights)return T.MathUtils.lerp(r.floorStart,r.floorEnd,s/r.length);let i=0;while(i<r.p.length-2&&r.cumulative[i+1]<s)i++;return T.MathUtils.lerp(r.tunnelFloorHeights[i],r.tunnelFloorHeights[i+1],T.MathUtils.clamp((s-r.cumulative[i])/(r.cumulative[i+1]-r.cumulative[i]||1),0,1));}

export function railCrossingCorridors(roads,railways){
 const crossings=[];
 for(const r of roads){if(!r.bridge||r.sharedDeck||r.fullyShared)continue;
  for(let i=0;i<r.p.length-1;i++){
   const a=r.p[i],b=r.p[i+1],length=a.distanceTo(b),steps=Math.max(1,Math.ceil(length/2));
   for(let j=0;j<=steps;j++){
    const t=j/steps,hit=railways.at(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,0);
    if(!hit||hit.d>3||hit.s.track.bridge||hit.s.track.tunnel)continue;
    const dx=hit.s.dx/hit.s.length,dz=hit.s.dz/hit.s.length,sine=Math.abs((b.x-a.x)*dz-(b.y-a.y)*dx)/(length||1);
    if(sine<.2)continue;
    const x=hit.s.a.x+hit.s.dx*hit.t,z=hit.s.a.z+hit.s.dz*hit.t;
    if(crossings.some(c=>c.road===r&&c.track===hit.s.track&&Math.hypot(c.x-x,c.z-z)<12))continue;
    const span=Math.min(90,((r.pavementWidth||r.width)/2+4)/sine+12),start=railways.at(x-dx*span,z-dz*span,0),end=railways.at(x+dx*span,z+dz*span,0);
    crossings.push({road:r,track:hit.s.track,x,z,dx,dz,span,half:2.5,ha:start&&start.d<2?start.y:hit.y,hb:end&&end.d<2?end.y:hit.y,clearance:hit.s.track.electrified?6.2:5});
   }
  }
 }
 return crossings;
}

export function createRailTerrainClip(railways){
 let crossings=[],next=0;
 const uniforms={railCuts:{value:Array.from({length:16},()=>new T.Vector4())},railCutLevels:{value:Array.from({length:16},()=>new T.Vector4())},railCutCount:{value:0}};
 function update(camera){if(performance.now()<next)return;next=performance.now()+200;const nearby=crossings.map(c=>({c,d:Math.hypot(c.x-camera.x,c.z-camera.z)})).filter(c=>c.d<1800).sort((a,b)=>a.d-b.d).slice(0,16);uniforms.railCutCount.value=nearby.length;nearby.forEach(({c},i)=>{uniforms.railCuts.value[i].set(c.x,c.z,c.dx,c.dz);uniforms.railCutLevels.value[i].set(c.ha,c.hb,c.span,c.clearance);});}
 function applyTerrain(material){const previous=material.onBeforeCompile,prior=material.customProgramCacheKey();material.onBeforeCompile=(shader,renderer)=>{previous?.call(material,shader,renderer);Object.assign(shader.uniforms,uniforms);shader.fragmentShader='uniform vec4 railCuts[16];uniform vec4 railCutLevels[16];uniform int railCutCount;\n'+shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
 for(int k=0;k<16;k++){if(k>=railCutCount)break;vec4 c=railCuts[k],h=railCutLevels[k];vec2 rel=boreWorld.xz-c.xy;float along=dot(rel,c.zw),side=abs(rel.x*c.w-rel.y*c.z);float floor=mix(h.x,h.y,clamp((along+h.z)/(2.*h.z),0.,1.));if(abs(along)<h.z&&side<2.5&&boreWorld.y>floor-.16&&boreWorld.y<floor+h.w)discard;}
`);};material.customProgramCacheKey=()=>prior+'|rail-crossing-clearance-v1';}
 return{applyTerrain,update,setRoads(roads){crossings=railCrossingCorridors(roads,railways);next=0;},get crossings(){return crossings;}};
}
