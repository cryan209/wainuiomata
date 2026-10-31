import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import * as T from '../dist/vendor/three.js';
import {createHydrology,createRoadNetwork} from '../dist/water-roads.js';
import {projectSegment} from '../dist/road-topology.js';
import {mapSource} from './lib/map-source.mjs';
// Geometry-free scan of street elevations: roadbed lift/cut against the survey, height disagreements between
// overlapping same-level carriageways, and vertical jumps in the graded terrain beside roads and junctions.
const paths=new Set(['track','path','footway','cycleway','bridleway','pedestrian','steps']);
export function auditRoadSteps({radius=Infinity}={}){
 const source=mapSource(),hydro=createHydrology(new T.Scene(),source.waterways,source.raw,{seaLevel:-source.meta.originElevation});
 const net=createRoadNetwork(new T.Scene(),{bounds:source.bounds,elements:source.elements,seaLevel:-source.meta.originElevation},hydro,source.raw,{},null,source.railways,{buildGeometry:false});
 const inside=(x,z)=>Math.abs(x)<radius&&Math.abs(z)<radius,layer=r=>+(r.tags.layer||0);
 const streets=net.roads.filter(r=>!paths.has(r.type)&&!r.fullyShared),grid=new Map();
 for(const r of streets)for(let i=0;i<r.p.length-1;i++){if(r.sharedSegments.has(i))continue;const a=r.p[i],b=r.p[i+1],m=r.width/2+1;for(let x=Math.floor((Math.min(a.x,b.x)-m)/25);x<=Math.floor((Math.max(a.x,b.x)+m)/25);x++)for(let z=Math.floor((Math.min(a.y,b.y)-m)/25);z<=Math.floor((Math.max(a.y,b.y)+m)/25);z++){const k=x+','+z;if(!grid.has(k))grid.set(k,[]);grid.get(k).push({r,i})}}
 const lift=[];let samples=0,maxLift=0,maxCut=0;
 for(const r of streets){if(r.bridge||r.tunnel||r.underpasses?.length||r.clearances?.length)continue;for(let i=0;i<r.p.length-1;i++){const row=r.gradeProfiles?.[i];if(!row)continue;const a=r.p[i],b=r.p[i+1];for(let j=0;j<row.length;j++){const t=j/(row.length-1),x=a.x+(b.x-a.x)*t,z=a.y+(b.y-a.y)*t;if(!inside(x,z)||hydro.channel(x,z))continue;samples++;const d=row[j]-(hydro.ground(x,z)+.16);maxLift=Math.max(maxLift,d);maxCut=Math.min(maxCut,d);if(Math.abs(d)>2)lift.push({name:r.name||'(unnamed '+r.type+')',id:r.id,x,z,d})}}}
 // Same-layer surfaces that overlap in plan must agree in height, or a visible ledge appears between them.
 const overlaps=[];let overlapSamples=0;
 for(const r of streets){if(r.bridge||r.tunnel)continue;for(let i=0;i<r.p.length-1;i++){if(r.sharedSegments.has(i))continue;const a=r.p[i],b=r.p[i+1],n=Math.max(1,Math.ceil(a.distanceTo(b)/3));for(let j=0;j<=n;j++){const t=j/n,x=a.x+(b.x-a.x)*t,z=a.y+(b.y-a.y)*t;if(!inside(x,z))continue;const h=net.height(r,i,t,x,z);for(const o of grid.get(Math.floor(x/25)+','+Math.floor(z/25))||[]){if(o.r===r||o.r.bridge||o.r.tunnel||layer(o.r)!==layer(r)||o.r.underpasses?.length||r.underpasses?.length)continue;const p=projectSegment(o.r,o.i,x,z);if(p.d>o.r.width/2-.25)continue;overlapSamples++;const dh=net.height(o.r,o.i,p.t,x,z)-h;if(Math.abs(dh)>.35)overlaps.push({name:r.name||r.type,other:o.r.name||o.r.type,id:r.id,otherId:o.r.id,x,z,dh})}}}}
 // Terrain is graded to the roadbed. Probe outward from road edges for jumps between 0.5m-spaced ground samples.
 const jumps=[];let probes=0;
 for(const r of streets){if(r.bridge||r.tunnel)continue;for(let i=0;i<r.p.length-1;i++){if(r.sharedSegments.has(i))continue;const a=r.p[i],b=r.p[i+1],len=a.distanceTo(b),n=Math.max(1,Math.ceil(len/4)),nx=-(b.y-a.y)/len,nz=(b.x-a.x)/len;for(let j=0;j<=n;j++){const t=j/n,cx=a.x+(b.x-a.x)*t,cz=a.y+(b.y-a.y)*t;if(!inside(cx,cz))continue;for(const side of [-1,1]){let prev=null,prevRaw=null;for(let s=0;s<=r.width/2+16;s+=.5){const x=cx+nx*s*side,z=cz+nz*s*side;if(hydro.channel(x,z)){prev=null;continue}const g=net.ground(x,z),raw=hydro.ground(x,z);probes++;if(prev!==null&&Math.abs(g-prev-(raw-prevRaw))>.5)jumps.push({name:r.name||r.type,id:r.id,x,z,dh:g-prev-(raw-prevRaw),offset:s,junction:net.junctionAt(x,z)||net.junctionAt(x-nx*side*.5,z-nz*side*.5)});prev=g;prevRaw=raw}}}}}
 const top=(list,k)=>[...list].sort((a,b)=>Math.abs(b[k])-Math.abs(a[k])),clusters=(list,k)=>{const seen=new Set(),out=[];for(const f of top(list,k)){const c=Math.floor(f.x/40)+','+Math.floor(f.z/40);if(seen.has(c))continue;seen.add(c);out.push({...f,x:+f.x.toFixed(1),z:+f.z.toFixed(1),[k]:+f[k].toFixed(2)})}return out};
 return{roads:net.roads.length,samples,maxLift,maxCut,liftCount:lift.length,lift:clusters(lift,'d'),overlapSamples,overlapCount:overlaps.length,overlaps:clusters(overlaps,'dh'),probes,jumpCount:jumps.length,junctionJumps:jumps.filter(j=>j.junction).length,jumps:clusters(jumps,'dh'),net,source,hydro};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(fs.realpathSync(process.argv[1])).href){const {net,source,hydro,...report}=auditRoadSteps({radius:+(process.argv[2]||Infinity)});const brief={...report};for(const k of ['lift','overlaps','jumps'])brief[k]=report[k].slice(0,12);console.log(JSON.stringify(brief,null,1));if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(report,null,1)+'\n')}
