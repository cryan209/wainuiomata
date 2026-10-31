const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const roadLayer=r=>Number(r.tags.layer)||0;
const paths=new Set(['footway','path','cycleway','steps','pedestrian','bridleway']);
// One lane model for every road class, so tagged and untagged sections of one street match.
// Shoulders include kerbside parking on urban roads; roundabout rings and links carry a reduced share. Tagged cycle lanes add width.
const laneWidths={motorway:3.5,trunk:3.5,primary:3.4,secondary:3.3,tertiary:3.2,service:2.8},shoulders={motorway:3,trunk:2.4,primary:2.6,secondary:2.4,tertiary:2,residential:1.4,unclassified:1.4,living_street:.6,service:.4};
export const isOneway=tags=>['yes','1','-1'].includes(tags.oneway)||['roundabout','circular'].includes(tags.junction)||(tags.highway==='motorway'&&tags.oneway!=='no')||(tags.highway?.endsWith('_link')&&tags.oneway!=='no');
const isRing=tags=>['roundabout','circular'].includes(tags.junction);
const defaultLanes=tags=>{const base=tags.highway.replace('_link','');return tags.highway.endsWith('_link')||isRing(tags)?1:isOneway(tags)?(['motorway','trunk','primary','secondary'].includes(base)?2:1):2};
const cycleLanes=tags=>{const lane=v=>v==='lane'||v==='track';return(lane(tags.cycleway)?(isOneway(tags)?1:2):0)+(lane(tags['cycleway:both'])?2:0)+(lane(tags['cycleway:left'])?1:0)+(lane(tags['cycleway:right'])?1:0)};
export function roadLanes(tags){const lanes=parseFloat(tags.lanes);return lanes>0?Math.min(8,lanes):defaultLanes(tags)}
export const laneWidth=tags=>laneWidths[tags.highway.replace('_link','')]||3;
export function roadWidth(tags,lanes=roadLanes(tags)){
 const type=tags.highway,base=type.replace('_link',''),tagged=parseFloat(tags.width);
 if(['footway','path','cycleway','steps','track','bridleway','corridor','part'].includes(type))return clamp(tagged>=.8?tagged:2,1.2,6);
 if(type==='pedestrian')return clamp(tagged>=1?tagged:7,1.2,20);
 let computed;if(type==='service')computed={driveway:3,parking_aisle:5.5,alley:3.5,'drive-through':3.5}[tags.service]??4;
 else{
  // Added turn/climbing lanes mostly take kerbside space, so short lane additions do not step the kerb line out a full lane.
  const oneway=isOneway(tags),lane=laneWidths[base]||3,shoulder=(shoulders[base]??1.4)*(isRing(tags)||type.endsWith('_link')?.6:oneway?.8:1),extra=Math.max(0,lanes-defaultLanes(tags));
  computed=lanes*lane+Math.max(Math.min(.6,shoulder),shoulder-extra*lane*.6)+Math.min(2,cycleLanes(tags))*1.5;if(oneway&&!type.endsWith('_link')&&!['motorway','trunk'].includes(base))computed=Math.max(computed,isRing(tags)?4.5:6)}
 // Width tags on roads are often whole-corridor or typo values; accept them only near the lane estimate.
 return clamp(tagged>=computed*.55&&tagged<=computed*1.8?tagged:computed,1.2,20);
}
// Untagged continuation ways take the lane count of a same-named, same-class neighbour.
// Footpaths and tracks ending at a node must not break (or change) a street's lane chain.
export function inheritLanes(elements){const ends=new Map(),lanes=new Map(),ways=elements.filter(e=>e.tags.highway&&e.geometry?.length>1&&!paths.has(e.tags.highway)&&e.tags.highway!=='track');
 for(const e of ways){if(parseFloat(e.tags.lanes)>0)lanes.set(e,parseFloat(e.tags.lanes));for(const p of [e.geometry[0],e.geometry.at(-1)])if(p.node){if(!ends.has(p.node))ends.set(p.node,[]);ends.get(p.node).push(e)}}
 const queue=[...lanes.keys()];while(queue.length){const e=queue.shift();for(const p of [e.geometry[0],e.geometry.at(-1)]){const list=ends.get(p.node)||[];if(list.length!==2)continue;const o=list[0]===e?list[1]:list[0];if(lanes.has(o)||o.tags.highway!==e.tags.highway||(o.tags.name||'')!==(e.tags.name||'')||!o.tags.name||isOneway(o.tags)!==isOneway(e.tags)||o.tags.junction)continue;lanes.set(o,lanes.get(e));queue.push(o)}}
 return lanes}
export function projectSegment(r,i,x,z){const a=r.p[i],b=r.p[i+1],dx=b.x-a.x,dz=b.y-a.y,len=Math.hypot(dx,dz),t=clamp(((x-a.x)*dx+(z-a.y)*dz)/(len*len||1),0,1);return{r,i,t,d:Math.hypot(x-a.x-dx*t,z-a.y-dz*t),dx,dz,len}}
export function roadIndex(roads){const cells=new Map();for(const r of roads)for(let i=0;i<r.p.length-1;i++){const a=r.p[i],b=r.p[i+1],margin=r.width+4;for(let ix=Math.floor((Math.min(a.x,b.x)-margin)/50);ix<=Math.floor((Math.max(a.x,b.x)+margin)/50);ix++)for(let iz=Math.floor((Math.min(a.y,b.y)-margin)/50);iz<=Math.floor((Math.max(a.y,b.y)+margin)/50);iz++){const key=ix+','+iz;if(!cells.has(key))cells.set(key,[]);cells.get(key).push({r,i})}}return cells}
export function associatePaths(roads,cells){for(const r of roads){r.pavementWidth=paths.has(r.type)||r.type==='track'?r.width:r.width+2.2;r.sharedSegments=new Map()}
 for(const r of roads.filter(r=>paths.has(r.type)&&r.type!=='steps'))for(let i=0;i<r.p.length-1;i++){const a=r.p[i],b=r.p[i+1],dx=b.x-a.x,dz=b.y-a.y,len=Math.hypot(dx,dz);let best=null;
  for(const item of cells.get(Math.floor((a.x+b.x)/100)+','+Math.floor((a.y+b.y)/100))||[]){const host=item.r;if(paths.has(host.type)||host===r||roadLayer(host)!==roadLayer(r)||host.bridge!==r.bridge)continue;const sample=projectSegment(host,item.i,(a.x+b.x)/2,(a.y+b.y)/2),parallel=Math.abs(dx*sample.dx+dz*sample.dz)/(len*sample.len||1);const crossing=r.tags.footway==='crossing';if(parallel<.97&&!crossing)continue;const endpoint=p=>{let d=Infinity;for(let j=Math.max(0,item.i-2);j<Math.min(host.p.length-1,item.i+3);j++)d=Math.min(d,projectSegment(host,j,p.x,p.y).d);return d};
   const explicit=r.tags.footway==='sidewalk',limit=host.width/2+(explicit?3:1.1)-r.width/2;if(crossing){if(len>30||sample.d>host.width/2+2)continue}else if(sample.d>limit||endpoint(a)>limit+.4||endpoint(b)>limit+.4)continue;if(!best||sample.d<best.d)best={...sample,host};
  }
  if(best){r.sharedSegments.set(i,best.host);if(r.tags.footway!=='crossing')best.host.pavementWidth=Math.max(best.host.pavementWidth,2*(best.d+r.width/2+.15))}
 }
}
export function crossingPoint(a,b,c,d){const ux=b.x-a.x,uz=b.y-a.y,vx=d.x-c.x,vz=d.y-c.y,den=ux*vz-uz*vx;if(Math.abs(den)<1e-7)return null;const t=((c.x-a.x)*vz-(c.y-a.y)*vx)/den,u=((c.x-a.x)*uz-(c.y-a.y)*ux)/den;if(t<-.00001||t>1.00001||u<-.00001||u>1.00001)return null;return{x:a.x+ux*t,z:a.y+uz*t,t,u}}
export function planOverbridges(roads,cells,hydro,railways){
 const bridges=roads.filter(r=>r.bridge&&!r.sharedDeck&&r.tags.man_made!=='pier').sort((a,b)=>roadLayer(a)-roadLayer(b));
 for(const bridge of bridges){let raise=0;for(let i=0;i<bridge.p.length-1;i++){if(bridge.sharedSegments.has(i))continue;const a=bridge.p[i],b=bridge.p[i+1],seen=new Set();for(let ix=Math.floor(Math.min(a.x,b.x)/50);ix<=Math.floor(Math.max(a.x,b.x)/50);ix++)for(let iz=Math.floor(Math.min(a.y,b.y)/50);iz<=Math.floor(Math.max(a.y,b.y)/50);iz++)for(const item of cells.get(ix+','+iz)||[]){const lower=item.r,key=lower.id+':'+item.i;if(seen.has(key))continue;seen.add(key);if(lower===bridge||lower.tunnel||lower.sharedSegments.has(item.i)||roadLayer(lower)>=roadLayer(bridge)||lower.tags.man_made==='pier')continue;const c=lower.p[item.i],d=lower.p[item.i+1];if([a,b].some(p=>p.node&&[c,d].some(q=>q.node===p.node)))continue;const point=crossingPoint(a,b,c,d);if(!point)continue;bridge.overCrossings??=[];bridge.overCrossings.push({lower,x:point.x,z:point.z});
  const vx=d.x-c.x,vz=d.y-c.y,length=Math.hypot(vx,vz),dx=vx/length,dz=vz/length,sine=Math.abs((b.x-a.x)*dz-(b.y-a.y)*dx)/(a.distanceTo(b)||1),half=clamp((bridge.pavementWidth/2+3)/Math.max(.2,sine),8,40),span=half+12,ha=hydro.ground(point.x-dx*span,point.z-dz*span)+.16,hb=hydro.ground(point.x+dx*span,point.z+dz*span)+.16;
  let floor=(ha+hb)/2;if(lower.bridge)floor=lower.deckStart+(lower.deckEnd-lower.deckStart)*(lower.cumulative[item.i]+c.distanceTo(d)*point.u)/lower.length;else{lower.underpasses??=[];if(!lower.underpasses.some(p=>Math.hypot(p.x-point.x,p.z-point.z)<1))lower.underpasses.push({...point,dx,dz,span,half,ha,hb})}
  const along=(bridge.cumulative[i]+a.distanceTo(b)*point.t)/bridge.length,deck=bridge.deckStart+(bridge.deckEnd-bridge.deckStart)*along,clearance=paths.has(lower.type)?3:5;raise=Math.max(raise,floor+clearance+.72-deck);
 }}if(railways){for(let i=0;i<bridge.p.length-1;i++){if(bridge.sharedSegments.has(i))continue;const a=bridge.p[i],b=bridge.p[i+1],len=a.distanceTo(b),steps=Math.max(1,Math.ceil(len/2));for(let j=0;j<=steps;j++){const t=j/steps,x=a.x+(b.x-a.x)*t,z=a.y+(b.y-a.y)*t,hit=railways.at(x,z,0);if(!hit||hit.d>4||hit.s.track.bridge||hit.s.track.tunnel)continue;const parallel=Math.abs((b.x-a.x)*hit.s.dx+(b.y-a.y)*hit.s.dz)/(len*hit.s.length||1);if(parallel>.97)continue;const along=(bridge.cumulative[i]+len*t)/bridge.length,deck=bridge.deckStart+(bridge.deckEnd-bridge.deckStart)*along;raise=Math.max(raise,hit.y+(hit.s.track.electrified?6.2:5)+.72-deck);bridge.overCrossings??=[];if(!bridge.overCrossings.some(p=>p.rail))bridge.overCrossings.push({rail:true,x,z})}}}if(raise>0){bridge.deckStart+=raise;bridge.deckEnd+=raise}}
}
// Short road and path tunnels (tunnel=yes underpasses) are real roads. Each floor runs straight between its portal ground levels,
// interpolated through nodes where tunnel ways meet, and every road crossing above must clear the headroom plus a 0.7m slab and 0.2m roadbed.
// Half of any shortfall against the surveyed level of the road above is dug out of the floor (at most 2.5m, approached in cuttings), half built up.
export const tunnelHeadroom=r=>paths.has(r.type)?2.8:4.6;
export function planUnderpasses(roads,cells,ground){
 const tunnels=roads.filter(r=>r.tunnel);if(!tunnels.length)return tunnels;
 const key=p=>p.node||p.x.toFixed(2)+','+p.y.toFixed(2),ends=new Map(),end=p=>ends.get(key(p));
 for(const r of tunnels)for(const p of [r.p[0],r.p.at(-1)]){const k=key(p);if(!ends.has(k))ends.set(k,{x:p.x,z:p.y,links:[],portal:false});ends.get(k).links.push(r)}
 for(const r of roads)if(!r.tunnel)for(const p of r.p){const e=end(p);if(e)e.portal=true}
 for(const e of ends.values()){if(e.links.length<2)e.portal=true;e.h=ground(e.x,e.z)+.16}
 for(let pass=0;pass<30;pass++)for(const e of ends.values()){if(e.portal)continue;let sum=0,w=0;for(const r of e.links){const other=end(r.p[0])===e?end(r.p.at(-1)):end(r.p[0]);sum+=other.h/r.length;w+=1/r.length}e.h=sum/w}
 for(const r of tunnels){const fa=end(r.p[0]).h,fb=end(r.p.at(-1)).h;r.floorStart=fa;r.floorEnd=fb;r.headroom=tunnelHeadroom(r);r.portalStart=end(r.p[0]).portal;r.portalEnd=end(r.p.at(-1)).portal}
 for(const lower of tunnels)for(let i=0;i<lower.p.length-1;i++){const c=lower.p[i],d=lower.p[i+1],len=c.distanceTo(d)||1,dx=(d.x-c.x)/len,dz=(d.y-c.y)/len,seen=new Set();
  for(let ix=Math.floor(Math.min(c.x,d.x)/50);ix<=Math.floor(Math.max(c.x,d.x)/50);ix++)for(let iz=Math.floor(Math.min(c.y,d.y)/50);iz<=Math.floor(Math.max(c.y,d.y)/50);iz++)for(const item of cells.get(ix+','+iz)||[]){const upper=item.r,id=upper.id+':'+item.i;if(seen.has(id))continue;seen.add(id);if(upper.tunnel||upper.bridge||upper.sharedSegments.has(item.i)||roadLayer(upper)<roadLayer(lower))continue;const a=upper.p[item.i],b=upper.p[item.i+1];if([a,b].some(p=>p.node&&(p.node===c.node||p.node===d.node)))continue;const point=crossingPoint(a,b,c,d);if(!point)continue;
   const length=a.distanceTo(b)||1,ux=(b.x-a.x)/length,uz=(b.y-a.y)/length,sine=Math.max(.25,Math.abs(ux*dz-uz*dx)),cosine=Math.sqrt(1-Math.min(1,sine*sine)),half=Math.min(30,(lower.pavementWidth/2+1.1+upper.width/2*cosine)/sine),s=lower.cumulative[i]+len*point.u,floor=lower.floorStart+(lower.floorEnd-lower.floorStart)*s/lower.length;
   upper.clearances??=[];upper.clearances.push({x:point.x,z:point.z,dx:ux,dz:uz,half,s,lower});lower.shortfall=Math.max(lower.shortfall||0,floor+lower.headroom+.9-ground(point.x,point.z)-.16)}}
 for(const e of ends.values())e.dig=Math.max(0,...e.links.map(r=>Math.min(2.5,(r.shortfall||0)/2)));
 for(const r of tunnels){r.floorStart-=end(r.p[0]).dig;r.floorEnd-=end(r.p.at(-1)).dig}
 // A footway or cycleway tunnel alongside a road underpass shares its box: its floor sits at kerb height on the road's, under the same roof, with no dividing walls.
 const floorAt=(r,x,z)=>{let best=null;for(let i=0;i<r.p.length-1;i++){const p=projectSegment(r,i,x,z);if(!best||p.d<best.d)best=p}return{d:best.d,h:r.floorStart+(r.floorEnd-r.floorStart)*(r.cumulative[best.i]+best.len*best.t)/r.length}};
 for(const r of tunnels){if(!paths.has(r.type))continue;const a=r.p[0],b=r.p.at(-1),x=(a.x+b.x)/2,z=(a.y+b.y)/2;for(const o of tunnels){if(o===r||paths.has(o.type)||floorAt(o,x,z).d>=(r.pavementWidth+o.pavementWidth)/2+1.5)continue;r.floorStart=floorAt(o,a.x,a.y).h+.15;r.floorEnd=floorAt(o,b.x,b.y).h+.15;r.headroom=o.headroom-.15;break}}
 for(const r of roads)for(const c of r.clearances||[]){const lower=c.lower;c.need=lower.floorStart+(lower.floorEnd-lower.floorStart)*c.s/lower.length+lower.headroom+.9}
 return tunnels}
// Minimum roadbed level for a road crossing over an underpass: flat across the box, then falling away at `slope` (Infinity: the box only).
export function clearanceHeight(r,x,z,slope){let h=-Infinity;for(const p of r.clearances||[]){const along=Math.abs((x-p.x)*p.dx+(z-p.z)*p.dz),across=Math.abs((x-p.x)*p.dz-(z-p.z)*p.dx);if(across>r.width+2)continue;const over=along-p.half;h=Math.max(h,over<=0?p.need:p.need-over*slope)}return h}
export function underpassHeight(r,x,z,fallback){let h=fallback;for(const p of r.underpasses||[]){const along=(x-p.x)*p.dx+(z-p.z)*p.dz,across=Math.abs((x-p.x)*p.dz-(z-p.z)*p.dx);if(Math.abs(along)>p.span||across>r.width+2)continue;const t=clamp((along+p.span)/(p.span*2),0,1),target=p.ha+(p.hb-p.ha)*t,u=clamp((Math.abs(along)-p.half)/(p.span-p.half),0,1),blend=u*u*(3-2*u);h=target*(1-blend)+h*blend}return h}
export function offsetRoadPoint(r,i,t,side){const normal=index=>{const a=r.p[index],b=r.p[index+1],dx=b.x-a.x,dz=b.y-a.y,len=Math.hypot(dx,dz)||1;return{x:dz/len,z:-dx/len}};const current=normal(i),offset=node=>{let nx=current.x,nz=current.z;if(node>0&&node<r.p.length-1){const prev=normal(node-1),next=normal(node),sum=Math.hypot(prev.x+next.x,prev.z+next.z);if(sum>.2){nx=(prev.x+next.x)/sum;nz=(prev.z+next.z)/sum}}const scale=side/Math.max(.4,nx*current.x+nz*current.z);return{x:r.p[node].x+nx*scale,z:r.p[node].y+nz*scale}};const a=offset(i),b=offset(i+1);return{x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t}}
export function associateBridgeDecks(roads,cells){for(const r of roads)r.parallelDecks=new Set();for(const r of roads.filter(r=>r.bridge&&!paths.has(r.type))){for(let i=0;i<r.p.length-1;i++){const a=r.p[i],b=r.p[i+1],x=(a.x+b.x)/2,z=(a.y+b.y)/2,dx=b.x-a.x,dz=b.y-a.y,len=Math.hypot(dx,dz);for(const item of cells.get(Math.floor(x/50)+','+Math.floor(z/50))||[]){const other=item.r;if(other===r||!other.bridge||paths.has(other.type)||roadLayer(other)!==roadLayer(r)||other.name!==r.name)continue;const p=projectSegment(other,item.i,x,z),parallel=Math.abs(dx*p.dx+dz*p.dz)/(len*p.len||1);if(parallel>.86&&p.d<(r.pavementWidth+other.pavementWidth)/2+.2){r.parallelDecks.add(other);other.parallelDecks.add(r)}}}}}
