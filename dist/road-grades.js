import * as T from './vendor/three.js';
import {convexFootprint} from './road-clipping.js';
const path=new Set(['footway','path','cycleway','steps','pedestrian','bridleway','track']);
const key=p=>p.node?'n'+p.node:'p'+p.x.toFixed(3)+','+p.y.toFixed(3);
export function buildJunctions(roads){const nodes=new Map();for(const r of roads){r.junctions=new Map();if(path.has(r.type)||r.fullyShared)continue;for(let i=0;i<r.p.length;i++){const p=r.p[i],id=key(p);if(!nodes.has(id))nodes.set(id,{id,x:p.x,z:p.y,legs:[],roads:new Set()});const hub=nodes.get(id);hub.roads.add(r);for(const j of [i-1,i+1])if(j>=0&&j<r.p.length){const q=r.p[j],len=p.distanceTo(q);if(len>.1)hub.legs.push({r,i,j,dx:(q.x-p.x)/len,dz:(q.y-p.y)/len})}}}
 const hubs=[];for(const hub of nodes.values()){if(hub.roads.size<2||hub.legs.length<2)continue;hub.radius=Math.min(10,Math.max(...hub.legs.map(l=>l.r.width))/2+(hub.legs.length===2?.5:2));const corners=[];for(const l of hub.legs){const half=l.r.width/2;for(const d of [0,hub.radius])for(const side of [-1,1])corners.push({x:hub.x+l.dx*d+l.dz*half*side,z:hub.z+l.dz*d-l.dx*half*side});l.r.junctions.set(l.i,hub)}hub.outline=convexFootprint(corners);hubs.push(hub)}
 const parent=new Map(hubs.map(h=>[h,h]));const root=h=>{while(parent.get(h)!==h){parent.set(h,parent.get(parent.get(h)));h=parent.get(h)}return h};for(const r of roads)for(let i=0;i<r.p.length-1;i++){const a=r.junctions.get(i),b=r.junctions.get(i+1);if(a&&b&&a!==b&&r.p[i].distanceTo(r.p[i+1])<a.radius+b.radius+4)parent.set(root(b),root(a))}for(const hub of hubs)hub.group=root(hub);return hubs}
export function gradeLimit(r){return r.type==='track'?.45:path.has(r.type)?.25:['motorway','trunk','primary','motorway_link','trunk_link','primary_link'].includes(r.type)?.08:.12}
function solveStreetGrades(roads,hubs,sample){
 // Only real map nodes need a hash entry. Interior samples and adjacency use packed arrays.
 const canonical=new Map(),initial=[],from=[],to=[],rise=[],entries=[];
 const node=(id,h)=>{if(id!==null&&canonical.has(id)){const n=canonical.get(id);initial[n]=Math.max(initial[n],h);return n}const n=initial.length;initial.push(h);if(id!==null)canonical.set(id,n);return n};
 const getHub=(r,i,j,n)=>{for(const endpoint of [i,i+1]){const hub=r.junctions.get(endpoint);if(hub&&r.p[i].distanceTo(r.p[i+1])*(endpoint===i?j/n:1-j/n)<=hub.radius+2)return hub}return null};
 for(const r of roads){r.gradeProfiles=[];if(r.type==='steps')continue;for(let i=0;i<r.p.length-1;i++){if(r.sharedSegments.has(i))continue;const a=r.p[i],b=r.p[i+1],length=a.distanceTo(b),n=Math.max(1,Math.ceil(length/2)),row=new Int32Array(n+1);for(let j=0;j<=n;j++){const t=j/n,x=T.MathUtils.lerp(a.x,b.x,t),z=T.MathUtils.lerp(a.y,b.y,t),hub=getHub(r,i,j,n),id=hub?hub.group.id:j===0?key(a):j===n?key(b):null;row[j]=node(id,sample(r,i,t,x,z))}entries.push({r,i,row});for(let j=1;j<row.length;j++)if(row[j-1]!==row[j]){from.push(row[j-1]);to.push(row[j]);rise.push(length/n*gradeLimit(r))}}}
 const heights=Float64Array.from(initial),count=heights.length,head=new Int32Array(count).fill(-1),dest=new Int32Array(from.length*2),next=new Int32Array(from.length*2),cost=new Float64Array(from.length*2);initial.length=0;
 for(let i=0;i<from.length;i++){let e=i*2;dest[e]=to[i];cost[e]=rise[i];next[e]=head[from[i]];head[from[i]]=e;e++;dest[e]=from[i];cost[e]=rise[i];next[e]=head[to[i]];head[to[i]]=e}from.length=to.length=rise.length=0;
 const ids=[],values=[];function push(id){let i=ids.length,h=heights[id];ids.push(id);values.push(h);while(i){const p=(i-1)>>1;if(values[p]>=h)break;ids[i]=ids[p];values[i]=values[p];i=p}ids[i]=id;values[i]=h}
 function pop(){const id=ids[0],h=values[0],lastId=ids.pop(),last=values.pop();if(ids.length){let i=0;while(i*2+1<ids.length){let c=i*2+1;if(c+1<ids.length&&values[c+1]>values[c])c++;if(values[c]<=last)break;ids[i]=ids[c];values[i]=values[c];i=c}ids[i]=lastId;values[i]=last}return{id,h}}
 for(let n=0;n<count;n++)for(let e=head[n];e!==-1;e=next[e])if(heights[n]>heights[dest[e]]+cost[e]+1e-6){push(n);break}
 let raised=0;while(ids.length){const{id,h}=pop();if(h<heights[id]-1e-6)continue;for(let e=head[id];e!==-1;e=next[e]){const target=h-cost[e],n=dest[e];if(heights[n]<target-1e-6){heights[n]=target;raised++;push(n)}}}
 for(const{r,i,row}of entries)r.gradeProfiles[i]=Float64Array.from(row,n=>heights[n]);for(const hub of hubs)hub.height=heights[canonical.get(hub.group.id)];for(const r of roads)if(r.type!=='steps')r.profiles=null;return{nodes:count,raised,graphBytes:head.byteLength+dest.byteLength+next.byteLength+cost.byteLength+heights.byteLength}}

// Trails follow terrain and attach to streets. They cannot impose their hill grades on streets.
export function solveRoadGrades(roads,hubs,sample){
 const streets=roads.filter(r=>!path.has(r.type)),trails=roads.filter(r=>path.has(r.type)),stats=solveStreetGrades(streets,hubs,sample),anchors=new Map();
 for(const r of streets)for(let i=0;i<r.p.length;i++){const p=r.p[i],segment=Math.min(i,r.p.length-2),t=i===r.p.length-1?1:0,h=sample(r,segment,t,p.x,p.y),id=key(p);anchors.set(id,Math.max(anchors.get(id)??-Infinity,h))}
 const streetNodes=new Set(anchors.keys());
 for(const r of trails)for(let i=0;i<r.p.length;i++){const p=r.p[i],id=key(p);if(streetNodes.has(id))continue;const h=sample(r,Math.min(i,r.p.length-2),i===r.p.length-1?1:0,p.x,p.y);anchors.set(id,Math.max(anchors.get(id)??-Infinity,h))}
 let trailSamples=0;
 for(const r of trails){r.gradeProfiles=[];for(let i=0;i<r.p.length-1;i++){if(r.sharedSegments.has(i))continue;const a=r.p[i],b=r.p[i+1],length=a.distanceTo(b),n=Math.max(1,Math.ceil(length/2)),start=sample(r,i,0,a.x,a.y),end=sample(r,i,1,b.x,b.y),d0=(anchors.get(key(a))??start)-start,d1=(anchors.get(key(b))??end)-end,span=Math.min(15,length),values=new Float64Array(n+1);
  for(let j=0;j<=n;j++){const t=j/n,x=T.MathUtils.lerp(a.x,b.x,t),z=T.MathUtils.lerp(a.y,b.y,t);values[j]=sample(r,i,t,x,z)+d0*(1-T.MathUtils.smoothstep(t*length,0,span))+d1*(1-T.MathUtils.smoothstep((1-t)*length,0,span))}r.gradeProfiles[i]=values;trailSamples+=values.length}r.profiles=null}
 return{...stats,nodes:stats.nodes+trailSamples,trailSamples};
}
