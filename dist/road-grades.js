import * as T from './vendor/three.js';
import {convexFootprint} from './road-clipping.js';
const path=new Set(['footway','path','cycleway','steps','pedestrian','bridleway','track']),sidewalk=new Set(['footway','path','cycleway','pedestrian']);
// Streets are graded together (solveStreetGrades or a precomputed pack); trails are graded one at a time.
export const isStreet=r=>!path.has(r.type);
const key=p=>p.node?'n'+p.node:'p'+p.x.toFixed(3)+','+p.y.toFixed(3);
export function buildJunctions(roads){const nodes=new Map();for(const r of roads){r.junctions=new Map();if(path.has(r.type)||r.fullyShared)continue;for(let i=0;i<r.p.length;i++){const p=r.p[i],id=key(p);if(!nodes.has(id))nodes.set(id,{id,x:p.x,z:p.y,legs:[],roads:new Set()});const hub=nodes.get(id);hub.roads.add(r);for(const j of [i-1,i+1])if(j>=0&&j<r.p.length){const q=r.p[j],len=p.distanceTo(q);if(len>.1)hub.legs.push({r,i,j,dx:(q.x-p.x)/len,dz:(q.y-p.y)/len})}}}
 const hubs=[];for(const hub of nodes.values()){if(hub.roads.size<2||hub.legs.length<2)continue;hub.radius=Math.min(10,Math.max(...hub.legs.map(l=>l.r.width))/2+(hub.legs.length===2?.5:2));const corners=[];for(const l of hub.legs){const half=l.r.width/2;for(const d of [0,hub.radius])for(const side of [-1,1])corners.push({x:hub.x+l.dx*d+l.dz*half*side,z:hub.z+l.dz*d-l.dx*half*side});l.r.junctions.set(l.i,hub)}hub.outline=convexFootprint(corners);hubs.push(hub)}
 const parent=new Map(hubs.map(h=>[h,h]));const root=h=>{while(parent.get(h)!==h){parent.set(h,parent.get(parent.get(h)));h=parent.get(h)}return h};for(const r of roads)for(let i=0;i<r.p.length-1;i++){const a=r.junctions.get(i),b=r.junctions.get(i+1);if(a&&b&&a!==b&&r.p[i].distanceTo(r.p[i+1])<a.radius+b.radius+4)parent.set(root(b),root(a))}for(const hub of hubs)hub.group=root(hub);return hubs}
// Limits only reject DEM noise; real hill streets and driveways are far steeper than highway design grades.
const highway=new Set(['motorway','trunk','motorway_link','trunk_link']),arterial=new Set(['primary','secondary','primary_link','secondary_link']),collector=new Set(['tertiary','tertiary_link']),local=new Set(['residential','unclassified','living_street','road']);
// Bridge approaches keep design grades, so raised decks still get long, gentle ramps.
export function approachLimit(r){return Math.min(gradeLimit(r),highway.has(r.type)||arterial.has(r.type)?.08:.12)}
export function gradeLimit(r){return r.type==='track'?.45:path.has(r.type)?.25:highway.has(r.type)?.1:arterial.has(r.type)?.14:collector.has(r.type)?.18:local.has(r.type)?.25:.33}
// Street centre samples in 12m cells, for parallel-carriageway links and for trails that snap onto a street beside them.
const cellOf=(x,z)=>(Math.floor(x/12)+4096)*8192+Math.floor(z/12)+4096;
function spotCells(sx,sz){const cells=new Map(),packed=Float64Array.from(sx,(x,k)=>cellOf(x,sz[k])*4194304+k).sort(),order=Int32Array.from(packed,v=>v%4194304);for(let k=0;k<order.length;){const c=Math.floor(packed[k]/4194304);let e=k+1;while(e<order.length&&Math.floor(packed[e]/4194304)===c)e++;cells.set(c,order.subarray(k,e));k=e}return cells}
function streetLookup(sx,sz,sh,sl,spotHeight,cells){return{
  // Nearest graded street centre sample, for footpaths that run alongside.
  streetNear(a,b){for(let x=Math.floor((Math.min(a.x,b.x)-12)/12);x<=Math.floor((Math.max(a.x,b.x)+12)/12);x++)for(let z=Math.floor((Math.min(a.y,b.y)-12)/12);z<=Math.floor((Math.max(a.y,b.y)+12)/12);z++)if(cells.has((x+4096)*8192+z+4096))return true;return false},
  street(x,z,r){const c=cellOf(x,z),level=+(r.tags?.layer||0);let best=-1,d=Infinity;for(const dc of [-8193,-8192,-8191,-1,0,1,8191,8192,8193])for(const v of cells.get(c+dc)||[]){if(sl[v]!==level)continue;const dx=sx[v]-x,dz=sz[v]-z,reach=sh[v]+r.width/2+3;if(dx*dx+dz*dz>=reach*reach)continue;const e=Math.hypot(dx,dz)-sh[v];if(e<d){d=e;best=v}}return best<0?null:{h:spotHeight[best],gap:d-r.width/2}}}}
function solveStreetGrades(roads,hubs,sample,minimum){
 // Only real map nodes need a hash entry. Interior samples and adjacency use packed arrays.
 const canonical=new Map(),sum=[],count=[],pin=[],exact=new Map(),clearance=new Map(),from=[],to=[],rise=[],gentle=[],side=[],entries=[],spot={x:[],z:[],half:[],layer:[],road:[],node:[],dx:[],dz:[]},meta=[null];
 const node=(id,h,fixed)=>{let n=id===null?undefined:canonical.get(id);if(n===undefined){n=sum.length;sum.push(0);count.push(0);pin.push(-Infinity);if(id!==null)canonical.set(id,n)}sum[n]+=h;count[n]++;if(fixed)pin[n]=Math.max(pin[n],h);return n};
 // Hubs are matched by distance along the road, so both segments meeting at a vertex resolve to the same graph node.
 const hubAt=(stations,s)=>{let best=null,gap=Infinity;for(const v of stations){const d=Math.abs(s-v.s);if(d<=v.hub.radius+2&&d<gap){best=v.hub;gap=d}}return best};
 let roadIndex=0;for(const r of roads){roadIndex++;meta.push({name:r.name,oneway:!!r.oneway,limit:gradeLimit(r)});r.gradeProfiles=[];if(r.type==='steps')continue;const half=r.width/2+1,level=+(r.tags?.layer||0),stations=[...r.junctions].map(([k,hub])=>({s:r.cumulative[k],hub}));for(let i=0;i<r.p.length-1;i++){if(r.sharedSegments.has(i))continue;const a=r.p[i],b=r.p[i+1],length=a.distanceTo(b),n=Math.max(1,Math.ceil(length/2)),row=new Int32Array(n+1);for(let j=0;j<=n;j++){const t=j/n,x=T.MathUtils.lerp(a.x,b.x,t),z=T.MathUtils.lerp(a.y,b.y,t),hub=hubAt(stations,j===n?r.cumulative[i+1]:r.cumulative[i]+length*t),id=hub?hub.group.id:j===0?key(a):j===n?key(b):null;const h=sample(r,i,t,x,z);row[j]=node(id,h,r.bridge);if(r.tunnel){if(!hub)exact.set(row[j],h)}else if(minimum){const m=minimum(r,x,z);if(m>(clearance.get(row[j])??-Infinity))clearance.set(row[j],m)}if(!r.bridge&&!r.tunnel){spot.x.push(x);spot.z.push(z);spot.half.push(half);spot.layer.push(level);spot.road.push(roadIndex);spot.node.push(row[j]);spot.dx.push((b.x-a.x)/(length||1));spot.dz.push((b.y-a.y)/(length||1))}}entries.push({r,i,row});for(let j=1;j<row.length;j++)if(row[j-1]!==row[j]){from.push(row[j-1]);to.push(row[j]);rise.push(length/n*gradeLimit(r));gentle.push(length/n*approachLimit(r));side.push(0)}}}
 const total=sum.length,initial=Float64Array.from(sum,(v,n)=>v/count[n]);sum.length=count.length=0;
 // Parallel carriageways whose pavements touch may differ by at most half what the survey shows between them; otherwise grading opens a ledge.
 // Only samples directly across from each other are linked: chained diagonal links would flatten a hill. Twins also allow the grade over any along-road offset.
 const sx=Float64Array.from(spot.x),sz=Float64Array.from(spot.z),sh=Float64Array.from(spot.half),sl=Int8Array.from(spot.layer),sr=Int32Array.from(spot.road),sn=Int32Array.from(spot.node),sdx=Float32Array.from(spot.dx),sdz=Float32Array.from(spot.dz),cells=spotCells(sx,sz);
 // Opposing one-way carriageways of the same named road (a divided road) are built level with each other across the median,
 // even where the survey samples each centre line on a different part of the embankment between them.
 const twins=(a,b)=>{const p=meta[sr[a]],q=meta[sr[b]];return p.oneway&&q.oneway&&!!p.name&&p.name===q.name&&sdx[a]*sdx[b]+sdz[a]*sdz[b]<-.8};
 const single=list=>sr[list[0]]===sr[list[list.length-1]]&&list.every(v=>sr[v]===sr[list[0]]),lone=new Set();for(const[c,list]of cells)if(single(list))lone.add(c);
 for(const[c,list]of cells)for(const dc of [-8193,-8192,-8191,-1,0,1,8191,8192,8193]){const others=cells.get(c+dc);if(!others||lone.has(c)&&lone.has(c+dc)&&sr[list[0]]===sr[others[0]])continue;for(const a of list){const ax=sx[a],az=sz[a],ux=sdx[a],uz=sdz[a],ra=sr[a];for(const b of others){const dx=ax-sx[b],dz=az-sz[b],along=Math.abs(dx*ux+dz*uz);if(along>1.05||sr[b]===ra||dx*dx+dz*dz>(sh[a]+sh[b]+6)**2||sn[a]===sn[b]||sl[a]!==sl[b])continue;const gap=Math.abs(initial[sn[a]]-initial[sn[b]]),twin=twins(a,b),reach=sh[a]+sh[b]+(twin?6:1);if((gap>2.5&&!(twin&&gap<6))||dx*dx+dz*dz>reach*reach)continue;from.push(sn[a]);to.push(sn[b]);const slack=twin?.15+along*Math.min(meta[sr[a]].limit,meta[sr[b]].limit):gap*.5+.2;rise.push(slack);gentle.push(twin?slack:0);side.push(twin?2:1)}}}
 const head=new Int32Array(total).fill(-1),dest=new Int32Array(from.length*2),next=new Int32Array(from.length*2),cost=new Float64Array(from.length*2),ramp=new Float64Array(from.length*2),lateral=Uint8Array.from({length:from.length*2},(_,e)=>side[e>>1]===1);
 for(let i=0;i<from.length;i++){let e=i*2;dest[e]=to[i];cost[e]=rise[i];ramp[e]=gentle[i];next[e]=head[from[i]];head[from[i]]=e;e++;dest[e]=from[i];cost[e]=rise[i];ramp[e]=gentle[i];next[e]=head[to[i]];head[to[i]]=e}from.length=to.length=rise.length=gentle.length=side.length=0;
 // Raise (sign 1) or lower (sign -1) nodes until every edge is within its grade limit, moving each node as little as possible.
 function relax(heights,sign,{sideways=true,costs=cost,seeds=null,locked=null}={}){const ids=[],values=[];let moved=0;function push(id){let i=ids.length,h=heights[id]*sign;ids.push(id);values.push(h);while(i){const p=(i-1)>>1;if(values[p]>=h)break;ids[i]=ids[p];values[i]=values[p];i=p}ids[i]=id;values[i]=h}
  function pop(){const id=ids[0],h=values[0],lastId=ids.pop(),last=values.pop();if(ids.length){let i=0;while(i*2+1<ids.length){let c=i*2+1;if(c+1<ids.length&&values[c+1]>values[c])c++;if(values[c]<=last)break;ids[i]=ids[c];values[i]=values[c];i=c}ids[i]=lastId;values[i]=last}return{id,h}}
  if(seeds)for(const n of seeds)push(n);else for(let n=0;n<total;n++)for(let e=head[n];e!==-1;e=next[e])if((sideways||!lateral[e])&&heights[n]*sign>heights[dest[e]]*sign+costs[e]+1e-6){push(n);break}
  while(ids.length){const{id,h}=pop();if(h<heights[id]*sign-1e-6)continue;for(let e=head[id];e!==-1;e=next[e]){if(!sideways&&lateral[e])continue;const target=h-costs[e],n=dest[e];if(heights[n]*sign<target-1e-6&&!locked?.[n]){heights[n]=target*sign;moved++;push(n)}}}return moved}
 // Raise-only grading turned one cliff-top sample or steep driveway into metres of embankment along every connected street.
 // The midpoint of the raised and lowered envelopes satisfies the same limits with balanced cut and fill.
 const raised=Float64Array.from(initial),lowered=Float64Array.from(initial),heights=new Float64Array(total);relax(raised,1);relax(lowered,-1);
 for(let n=0;n<total;n++)heights[n]=Math.max((raised[n]+lowered[n])/2,pin[n]);
 // Bridge decks keep their inferred clearance; approaches climb to meet them at design grade without dragging up parallel roads below.
 const pins=[];for(let n=0;n<total;n++)if(pin[n]>-Infinity)pins.push(n);const moved=relax(heights,1,{sideways:false,costs:ramp,seeds:pins});
 // Underpass floors are exact, and roads over them rise to their clearance (opposing carriageways of a divided road together).
 // A long bored tunnel's portal can sit above an approach graded into its cutting, so approaches also rise to meet a floor, at the same grades.
 // The cut into each portal and the lift over each crossing fade by the approach grade per metre relative to the graded road, never steeper than
 // its limit: a plain 8% ramp on a steeper hill would never meet the road again and spread along the whole street.
 if(exact.size||clearance.size){const locked=new Uint8Array(total),fade=(sign,base)=>Float64Array.from(cost,(c,e)=>Math.min(c,sign*(base[dest[e^1]]-base[dest[e]])+ramp[e]));
  if(exact.size){const base=Float64Array.from(heights),seeds=new Set(exact.keys());for(const[n,h]of exact){heights[n]=h;locked[n]=1;for(let e=head[n];e!==-1;e=next[e])if(!lateral[e])seeds.add(dest[e])}relax(heights,-1,{sideways:false,costs:fade(-1,base),seeds:[...seeds],locked});relax(heights,1,{sideways:false,costs:fade(1,base),seeds:[...seeds],locked})}
  if(clearance.size){const base=Float64Array.from(heights),seeds=[];for(const[n,h]of clearance)if(h>heights[n]&&!locked[n]){heights[n]=h;seeds.push(n)}relax(heights,1,{sideways:false,costs:fade(1,base),seeds,locked})}}
 for(const{r,i,row}of entries)r.gradeProfiles[i]=Float64Array.from(row,n=>heights[n]);for(const hub of hubs)hub.height=heights[canonical.get(hub.group.id)];for(const r of roads)if(r.type!=='steps')r.profiles=null;return{nodes:total,raised:moved,graphBytes:head.byteLength+dest.byteLength+next.byteLength+cost.byteLength*2+lateral.byteLength+heights.byteLength*4,...streetLookup(sx,sz,sh,sl,Float64Array.from(sn,n=>heights[n]),cells)}}

// Precomputed grades (scripts/pack_street_grades.mjs): every street and trail sample's graded height and every junction's
// height, in centimetres, so the game skips profiling 4600km of streets, solving a two-million-node graph and grading the
// trails that startup placement touches. Layout: 4-byte header length, a JSON header, the street sample heights, the hub heights
// (int32 byte planes, -2^31 for none), then the trail sample heights. Sample heights are differences from the previous sample as
// zigzag varints: samples 2m apart rarely differ by 64cm, so most take one byte. Each section's layout hash names every road and
// its sample counts, so a pack for another map is ignored; trails can be ignored on their own and are then graded as needed.
const segmentSamples=(r,i)=>Math.max(1,Math.ceil(r.p[i].distanceTo(r.p[i+1])/2))+1;
function gradeLayout(roads,suffix=''){let h=2166136261,samples=0;const mix=v=>{for(const c of String(v))h=Math.imul(h^c.charCodeAt(0),16777619)};
 for(const r of roads){mix(r.id+':');for(let i=0;i<r.p.length-1;i++){if(r.sharedSegments.has(i))continue;const n=segmentSamples(r,i);samples+=n;mix(n+',')}}mix(suffix);return{layout:(h>>>0).toString(16),samples}}
export function streetGradeLayout(streets,hubs){return{...gradeLayout(streets,'#'+hubs.length),hubs:hubs.length}}
const varints=values=>{const out=new Uint8Array(values.length*5);let n=0,last=0;for(let k=0;k<values.length;k++){const d=values[k]-last|0;last=values[k];let z=(d<<1^d>>31)>>>0;while(z>=128){out[n++]=z&127|128;z>>>=7}out[n++]=z}return out.slice(0,n)};
const unvarint=(bytes,offset,count)=>{const out=new Int32Array(count);let p=offset,last=0;for(let k=0;k<count;k++){let z=0,shift=0,b;do{b=bytes[p++];z|=(b&127)<<shift;shift+=7}while(b&128);out[k]=last=last+(z>>>1^-(z&1))|0}return out};
const profileCM=roads=>{const cm=[];for(const r of roads)for(let i=0;i<r.p.length-1;i++){if(r.sharedSegments.has(i))continue;for(const h of r.gradeProfiles[i])cm.push(Math.round(h*100))}return Int32Array.from(cm)};
const planes=(values,diff)=>{const n=values.length,out=new Uint8Array(n*4);let last=0;for(let k=0;k<n;k++){const v=diff?values[k]-last|0:values[k];last=values[k];out[k]=v&255;out[n+k]=v>>>8&255;out[2*n+k]=v>>>16&255;out[3*n+k]=v>>>24}return out};
const unplane=(bytes,offset,n,diff)=>{const out=new Int32Array(n);let last=0;for(let k=0;k<n;k++){const v=bytes[offset+k]|bytes[offset+n+k]<<8|bytes[offset+2*n+k]<<16|bytes[offset+3*n+k]<<24;out[k]=last=diff?last+v|0:v}return out};
// trails must all be graded (their gradeProfiles set) before packing.
export function packStreetGrades(streets,hubs,trails=[]){const layout=streetGradeLayout(streets,hubs),hubCM=Int32Array.from(hubs,h=>Number.isFinite(h.height)?Math.round(h.height*100):-2147483648),body=[varints(profileCM(streets)),planes(hubCM,false),varints(profileCM(trails))];
 const header=new TextEncoder().encode(JSON.stringify({format:3,...layout,streetBytes:body[0].length,trails:trails.length?gradeLayout(trails):null}));
 const out=new Uint8Array(4+header.length+body.reduce((n,b)=>n+b.length,0));new DataView(out.buffer).setUint32(0,header.length,true);out.set(header,4);let at=4+header.length;for(const b of body){out.set(b,at);at+=b.length}return out}
export function readStreetGradeHeader(bytes){const length=new DataView(bytes.buffer,bytes.byteOffset).getUint32(0,true);return JSON.parse(new TextDecoder().decode(bytes.subarray(4,4+length)))}
export function streetGradesFit(bytes,streets,hubs){const header=readStreetGradeHeader(bytes),layout=streetGradeLayout(streets,hubs),fit=header.format===3&&header.layout===layout.layout&&header.samples===layout.samples&&header.hubs===layout.hubs;
 if(!fit)console.warn('Precomputed street grades do not match this map; solving them instead (run scripts/pack_street_grades.mjs).');return fit}
export function trailGradesFit(bytes,trails){const header=readStreetGradeHeader(bytes),layout=gradeLayout(trails),fit=header.format===3&&header.trails?.layout===layout.layout&&header.trails.samples===layout.samples;
 if(!fit)console.warn('Precomputed trail grades do not match this map; grading trails as they are needed instead (run scripts/pack_street_grades.mjs).');return fit}
function applyTrailGrades(trails,bytes){const header=readStreetGradeHeader(bytes),cm=unvarint(bytes,4+new DataView(bytes.buffer,bytes.byteOffset).getUint32(0,true)+header.streetBytes+header.hubs*4,header.trails.samples);let k=0;
 for(const r of trails){r.gradeProfiles=[];for(let i=0;i<r.p.length-1;i++){if(r.sharedSegments.has(i))continue;const values=new Float64Array(segmentSamples(r,i));for(let j=0;j<values.length;j++)values[j]=cm[k++]/100;r.gradeProfiles[i]=values}}return k}
// The street height lookup (street, streetNear) only serves trail grading, so it is skipped when the trails are packed too.
function applyStreetGrades(roads,hubs,bytes,lookup=true){const header=readStreetGradeHeader(bytes),offset=4+new DataView(bytes.buffer,bytes.byteOffset).getUint32(0,true),cm=unvarint(bytes,offset,header.samples),hubCM=unplane(bytes,offset+header.streetBytes,header.hubs,false);
 const spot={x:[],z:[],half:[],layer:[],h:[]};let k=0;
 for(const r of roads){r.gradeProfiles=[];const half=r.width/2+1,level=+(r.tags?.layer||0);for(let i=0;i<r.p.length-1;i++){if(r.sharedSegments.has(i))continue;const a=r.p[i],b=r.p[i+1],n=segmentSamples(r,i)-1,values=new Float64Array(n+1);
  for(let j=0;j<=n;j++){values[j]=cm[k++]/100;if(!lookup||r.bridge||r.tunnel)continue;spot.x.push(T.MathUtils.lerp(a.x,b.x,j/n));spot.z.push(T.MathUtils.lerp(a.y,b.y,j/n));spot.half.push(half);spot.layer.push(level);spot.h.push(values[j])}r.gradeProfiles[i]=values}}
 hubs.forEach((hub,i)=>{hub.height=hubCM[i]===-2147483648?undefined:hubCM[i]/100});
 if(!lookup)return{nodes:0,raised:0,graphBytes:0,packed:true};
 const sx=Float64Array.from(spot.x),sz=Float64Array.from(spot.z);return{nodes:0,raised:0,graphBytes:0,packed:true,...streetLookup(sx,sz,Float64Array.from(spot.half),Int8Array.from(spot.layer),Float64Array.from(spot.h),spotCells(sx,sz))}}

// Trails follow terrain and attach to streets. They cannot impose their hill grades on streets.
// Sidewalks and cycleways running beside a street (within 3m of its pavement, under 4m apart vertically) are pulled onto its level instead of leaving a ledge.
// packedTrails (trailGradesFit) takes the trail grades from the pack too, so none are graded here or later.
export function solveRoadGrades(roads,hubs,sample,minimum,ungraded=sample,packed=null,packedTrails=false){
 const streets=roads.filter(isStreet),trails=roads.filter(r=>path.has(r.type)),usePack=packed&&streetGradesFit(packed,streets,hubs),{street,streetNear,...stats}=usePack?applyStreetGrades(streets,hubs,packed,!packedTrails):solveStreetGrades(streets,hubs,sample,minimum),anchors=new Map();
 if(usePack&&packedTrails){const trailSamples=applyTrailGrades(trails,packed);return{...stats,trailSamples}}
 for(const r of streets)for(let i=0;i<r.p.length;i++){const p=r.p[i],segment=Math.min(i,r.p.length-2),t=i===r.p.length-1?1:0,h=ungraded(r,segment,t,p.x,p.y),id=key(p);anchors.set(id,Math.max(anchors.get(id)??-Infinity,h))}
 const streetNodes=new Set(anchors.keys());
 // Trails are graded one at a time, when a height on one is first needed. A shared trail node takes the highest
 // ungraded height of the trails meeting there, exactly as when every trail was graded up front.
 const trailNodes=new Map();for(const r of trails)for(let i=0;i<r.p.length;i++){const id=key(r.p[i]);if(streetNodes.has(id))continue;if(!trailNodes.has(id))trailNodes.set(id,[]);trailNodes.get(id).push([r,i])}
 const anchor=id=>{if(anchors.has(id)||!trailNodes.has(id))return anchors.get(id);let h=-Infinity;for(const[r,i]of trailNodes.get(id)){const p=r.p[i];h=Math.max(h,ungraded(r,Math.min(i,r.p.length-2),i===r.p.length-1?1:0,p.x,p.y))}anchors.set(id,h);return h};
 let trailSamples=0;
 function grade(r){r.gradeProfiles=[];for(let i=0;i<r.p.length-1;i++){if(r.sharedSegments.has(i))continue;const a=r.p[i],b=r.p[i+1],length=a.distanceTo(b),n=Math.max(1,Math.ceil(length/2)),start=ungraded(r,i,0,a.x,a.y),end=ungraded(r,i,1,b.x,b.y),d0=(anchor(key(a))??start)-start,d1=(anchor(key(b))??end)-end,span=Math.min(15,length),values=new Float64Array(n+1);let side=null;const beside=!r.tunnel&&sidewalk.has(r.type)&&streetNear(a,b);
  for(let j=0;j<=n;j++){const t=j/n,x=T.MathUtils.lerp(a.x,b.x,t),z=T.MathUtils.lerp(a.y,b.y,t);let h=ungraded(r,i,t,x,z)+d0*(1-T.MathUtils.smoothstep(t*length,0,span))+d1*(1-T.MathUtils.smoothstep((1-t)*length,0,span));if(beside&&(j%2===0||j===n))side=street(x,z,r);if(side){const pull=(1-T.MathUtils.smoothstep(side.gap,0,3))*(1-T.MathUtils.smoothstep(Math.abs(side.h-h),2.5,4));h+=(side.h-h)*pull}values[j]=h}r.gradeProfiles[i]=values;trailSamples+=values.length}if(r.lazyProfile)r.profiles=null}
 for(const r of trails)r.lazyGrade=()=>{r.lazyGrade=null;grade(r)};
 return{...stats,get trailSamples(){return trailSamples}};
}
