export function regionalDestinations(world){
 const places=world.coast.meta.places,roads=world.network.roads;
 function nearestRoad(name,anchor){let best=null;for(const r of roads.filter(r=>r.name===name&&!['footway','path','cycleway','steps','service'].includes(r.type)))for(let i=1;i<r.p.length;i++){const a=r.p[i-1],b=r.p[i],dx=b.x-a.x,dz=b.y-a.y,t=Math.max(0,Math.min(1,((anchor.x-a.x)*dx+(anchor.z-a.y)*dz)/(dx*dx+dz*dz||1))),x=a.x+dx*t,z=a.y+dz*t,d=Math.hypot(x-anchor.x,z-anchor.z);if(!best||d<best.d)best={x,z,d,width:r.width||7,yaw:Math.atan2(-dx,-dz)}}return best}
 const lower=places.find(p=>p.name==='Lower Hutt')||{x:-3166,z:-5557},petone=places.find(p=>p.name==='Petone')||{x:-5436,z:-4230},eastbourne=places.find(p=>p.name==='Eastbourne')||{x:-3973,z:3175};
 const result=new Map();for(const [id,name,road,anchor,yaw]of [['lowerhutt','Lower Hutt','High Street',lower,0],['petone','Petone waterfront','The Esplanade',petone,Math.PI],['daysbay','Days Bay','Marine Drive',{x:-3280,z:2000},Math.PI/2],['eastbourne','Eastbourne','Marine Parade',eastbourne,Math.PI/2]]){
  const hit=nearestRoad(road,anchor)||nearestRoad(id==='eastbourne'?'Muritai Road':'Marine Drive',anchor);if(!hit)continue;let point=hit;
  // Stand on the verge rather than in a traffic lane; prefer the coastal side.
  for(const radius of [hit.width/2+.55,3,0]){const x=id==='lowerhutt'?hit.x+Math.cos(hit.yaw)*radius:hit.x-Math.sin(yaw)*radius,z=id==='lowerhutt'?hit.z-Math.sin(hit.yaw)*radius:hit.z-Math.cos(yaw)*radius;if(world.coast.isLand(x,z)&&!world.hydro.channel(x,z)){point={x,z};break}}
  if(id!=='lowerhutt'){
   let shore=null;for(const ring of world.coast.meta.beaches||[]){const centre={x:ring.reduce((s,p)=>s+p[0],0)/ring.length,z:ring.reduce((s,p)=>s+p[1],0)/ring.length},samples=[centre];for(let i=1;i<ring.length;i++)samples.push({x:(ring[i-1][0]+ring[i][0])/2,z:(ring[i-1][1]+ring[i][1])/2});for(const p of samples){const d=Math.hypot(p.x-anchor.x,p.z-anchor.z);if(d<850&&(!shore||d<shore.d)&&world.coast.isLand(p.x,p.z)&&!world.hydro.channel(p.x,p.z))shore={...p,d}}}if(shore)point=shore;
  }
  result.set(id,{name,x:point.x,z:point.z,yaw:id==='lowerhutt'?hit.yaw:yaw});
 }
 return result;
}
