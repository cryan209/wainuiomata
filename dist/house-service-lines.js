import * as T from './vendor/three.js';
import {streamBudget} from './frame-budget.js?v=stream-3';
import {finishSteps} from './spatial-split.js?v=paced-1';
export const MAX_HOUSE_SERVICE_DISTANCE=8;
const clamp=t=>Math.max(0,Math.min(1,t));
function inside(ring,x,z){let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])hit=!hit}return hit}
export function houseEligible(b){
 if(!b.rings?.[0]?.length||b.landmark||b.railCanopy||b.profile?.shop||b.profile?.industrial)return false;
 const type=b.tags?.building||b.buildingType||'';if(type&&!['yes','house','residential','detached','semidetached_house','terrace','bungalow'].includes(type))return false;
 const ring=b.rings[0];let area=0;for(let i=0,j=ring.length-1;i<ring.length;j=i++)area+=ring[j][0]*ring[i][1]-ring[i][0]*ring[j][1];area=Math.abs(area)/2;
 const height=(b.eave??((b.ground||0)+(b.height||0)))-(b.ground||0);
 return area>=45&&area<=400&&height>=2.6&&height<=10;
}
function closestSegments(a,b,c,d){
 const ux=b[0]-a[0],uz=b[2]-a[2],vx=d[0]-c[0],vz=d[1]-c[1],ul=ux*ux+uz*uz,vl=vx*vx+vz*vz,candidates=[];
 const add=(t,u)=>{t=clamp(t);u=clamp(u);const x=a[0]+ux*t,z=a[2]+uz*t,hx=c[0]+vx*u,hz=c[1]+vz*u;candidates.push({x,z,y:a[1]+(b[1]-a[1])*t,hx,hz,distance:Math.hypot(x-hx,z-hz)})};
 add(0,((a[0]-c[0])*vx+(a[2]-c[1])*vz)/(vl||1));add(1,((b[0]-c[0])*vx+(b[2]-c[1])*vz)/(vl||1));add(((c[0]-a[0])*ux+(c[1]-a[2])*uz)/(ul||1),0);add(((d[0]-a[0])*ux+(d[1]-a[2])*uz)/(ul||1),1);
 const cross=ux*vz-uz*vx;if(Math.abs(cross)>1e-9){const wx=c[0]-a[0],wz=c[1]-a[2],t=(wx*vz-wz*vx)/cross,u=(wx*uz-wz*ux)/cross;if(t>=0&&t<=1&&u>=0&&u<=1)add(t,u)}
 return candidates.sort((p,q)=>p.distance-q.distance)[0];
}
function buildingIndex(buildings){const cells=new Map();for(const b of buildings){const ring=b.rings?.[0];if(!ring)continue;const box=b.bounds||[Math.min(...ring.map(p=>p[0])),Math.min(...ring.map(p=>p[1])),Math.max(...ring.map(p=>p[0])),Math.max(...ring.map(p=>p[1]))];for(let ix=Math.floor(box[0]/25);ix<=Math.floor(box[2]/25);ix++)for(let iz=Math.floor(box[1]/25);iz<=Math.floor(box[3]/25);iz++){const key=ix+','+iz;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(b)}}return cells}
// Feeders are the low-voltage polylines that street-furniture actually rendered, after clearance checks.
export function planHouseServices(buildings,feeders,world){return finishSteps(planHouseServiceSteps(buildings,feeders,world))}
// The same, a house per step, so the game can plan across frames (see createHouseServiceLines).
export function* planHouseServiceSteps(buildings,feeders,world){
 const datum=world.meta?.originElevation||0,segments=new Map(),obstacles=buildingIndex(buildings),result=[],unique=new Map();
 for(const b of buildings)if(!unique.has(b.id))unique.set(b.id,b);
 for(const feeder of feeders){if(feeder.supply!=='overhead')continue;for(let i=1;i<feeder.points.length;i++){const a=feeder.points[i-1],b=feeder.points[i],segment={a,b,feeder};for(let ix=Math.floor((Math.min(a[0],b[0])-8)/16);ix<=Math.floor((Math.max(a[0],b[0])+8)/16);ix++)for(let iz=Math.floor((Math.min(a[2],b[2])-8)/16);iz<=Math.floor((Math.max(a[2],b[2])+8)/16);iz++){const key=ix+','+iz;if(!segments.has(key))segments.set(key,[]);segments.get(key).push(segment)}}}
 for(const house of unique.values()){
  if(!houseEligible(house))continue;const ring=house.rings[0],near=new Set();for(const p of ring)for(const segment of segments.get(Math.floor(p[0]/16)+','+Math.floor(p[1]/16))||[])near.add(segment);
  // Also query edge midpoints so a span beside the middle of a long facade is found.
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[j],b=ring[i],steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/8));for(let k=0;k<=steps;k++)for(const segment of segments.get(Math.floor((a[0]+(b[0]-a[0])*k/steps)/16)+','+Math.floor((a[1]+(b[1]-a[1])*k/steps)/16))||[])near.add(segment)}
  const candidates=[];for(const segment of near)for(let i=0,j=ring.length-1;i<ring.length;j=i++){const hit=closestSegments(segment.a,segment.b,ring[j],ring[i]);if(hit.distance>=.15&&hit.distance<=MAX_HOUSE_SERVICE_DISTANCE+1e-9)candidates.push({...hit,feeder:segment.feeder})}
  candidates.sort((a,b)=>a.distance-b.distance||a.feeder.id.localeCompare(b.feeder.id));
  for(const hit of candidates){const endY=(house.eave??house.ground+house.height)-datum-.12,points=[],sag=Math.min(.2,hit.distance*.025);if(!Number.isFinite(endY)||endY>=hit.y-.15)continue;let okay=true;
   for(let j=0;j<=12;j++){const t=j/12,x=hit.x+(hit.hx-hit.x)*t,z=hit.z+(hit.hz-hit.z)*t,y=hit.y+(endY-hit.y)*t-sag*4*t*(1-t),road=world.network?.at?.(x,z),motor=road&&!['footway','path','cycleway','steps','pedestrian','bridleway'].includes(road.r.type)&&road.d<road.r.width/2+.1,rail=world.railways?.at?.(x,z,0),floor=world.walkHeight(x,z,y+2),minimum=Math.max(floor+(motor?5.5:2.5),rail&&rail.d<4?rail.y+(rail.s?.track?.electrified?8:6):-Infinity);
    if(y<minimum+.04||j<12&&inside(house.rings[0],x,z)){okay=false;break}
    if(j<12)for(const other of obstacles.get(Math.floor(x/25)+','+Math.floor(z/25))||[]){if(other.id===house.id)continue;const top=(other.ridge??other.eave??((other.ground||0)+(other.height||0)+(other.roof?.rise||0)))-datum;if(y<top+.15&&inside(other.rings[0],x,z)&&!other.rings.slice(1).some(r=>inside(r,x,z))){okay=false;break}}
    if(!okay)break;points.push([x,y,z]);
   }
   if(okay){result.push({houseId:house.id,feederId:hit.feeder.id,distance:hit.distance,points});break}
  }
  yield;
 }
 return result;
}
export function serviceLinePositions(drops){const positions=[];for(const drop of drops)for(const offset of [-.035,.035])for(let i=1;i<drop.points.length;i++){const a=drop.points[i-1],b=drop.points[i];positions.push(a[0],a[1]+offset,a[2],b[0],b[1]+offset,b[2])}return positions}
export function createHouseServiceLines(scene,world,{material,getFeeders}){
 let mesh=null,next=0,lastSignature='',lastX=Infinity,lastZ=Infinity,drops=[],job=null;
 function pump(){const end=performance.now()+streamBudget(2);let r;while(!(r=job.next()).done)if(performance.now()>=end)return;job=null;show(r.value)}
 function show(result){drops=result;const positions=serviceLinePositions(drops);
  if(mesh){scene.remove(mesh);mesh.geometry.dispose();mesh=null}if(positions.length){const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.computeBoundingSphere();mesh=new T.LineSegments(geometry,material);mesh.name='House overhead service drops';mesh.userData.houseServiceLines=true;scene.add(mesh)}}
 const local=world.buildings||[];const localCells=buildingIndex(local);
 return {get drops(){return drops},update(camera,revision){
  // Planning a dense suburb takes tens of milliseconds, so it runs a couple of milliseconds a frame and the old lines
  // stay up until the new plan is ready.
  if(job){pump();return}
  const now=performance.now();if(now<next)return;next=now+500;
  const feeders=getFeeders(),regional=world.region?.buildings||[],signature=revision+':'+feeders.map(f=>f.id).join(',')+':'+regional.map(b=>b.id).join(',');if(signature===lastSignature&&Math.hypot(camera.x-lastX,camera.z-lastZ)<30)return;lastSignature=signature;lastX=camera.x;lastZ=camera.z;
  const nearby=new Map();for(let ix=Math.floor((camera.x-700)/25);ix<=Math.floor((camera.x+700)/25);ix++)for(let iz=Math.floor((camera.z-700)/25);iz<=Math.floor((camera.z+700)/25);iz++)for(const b of localCells.get(ix+','+iz)||[])nearby.set(b.id,b);
  for(const b of regional){const p=b.rings?.[0]?.[0];if(p&&Math.hypot(p[0]-camera.x,p[1]-camera.z)<750&&!nearby.has(b.id))nearby.set(b.id,b)}
  job=planHouseServiceSteps([...nearby.values()],feeders,world);pump();
 },get planning(){return !!job},dispose(){job=null;if(mesh){scene.remove(mesh);mesh.geometry.dispose();mesh=null}drops=[]}};
}
