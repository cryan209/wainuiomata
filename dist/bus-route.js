export function busRoadGraph(network){
 const edges=[],nodes=new Map(),types=new Set(['residential','unclassified','tertiary','secondary','primary','living_street','tertiary_link','secondary_link','primary_link']);const id=p=>p.node||p.x.toFixed(2)+','+p.y.toFixed(2);
 for(const r of network.roads){if(!types.has(r.type)||r.tags.access==='private'||r.tags.motor_vehicle==='no')continue;for(let i=1;i<r.p.length;i++){const a=r.p[i-1],b=r.p[i],length=Math.hypot(b.x-a.x,b.y-a.y);if(length<.01)continue;for(const reverse of [false,true]){if(reverse&&(r.tags.oneway==='yes'||r.tags.junction==='roundabout')||!reverse&&r.tags.oneway==='-1')continue;const from=reverse?b:a,to=reverse?a:b,e={r,i:i-1,reverse,from,to,length,fromId:id(from),toId:id(to)};edges.push(e);if(!nodes.has(e.fromId))nodes.set(e.fromId,[]);nodes.get(e.fromId).push(e)}}}return{edges,nodes};
}
export function roadPath(nodes,start,end){
 if(start===end)return[];const queue=[[0,start]],distance=new Map([[start,0]]),previous=new Map();let visited=0;
 while(queue.length&&visited++<30000){queue.sort((a,b)=>b[0]-a[0]);const [d,id]=queue.pop();if(d!==distance.get(id))continue;if(id===end)break;for(const edge of nodes.get(id)||[]){if(edge.r.width<(edge.r.tags.oneway==='yes'||edge.r.tags.junction==='roundabout'?3.2:5.5))continue;const cost=d+edge.length;if(cost<(distance.get(edge.toId)??Infinity)){distance.set(edge.toId,cost);previous.set(edge.toId,edge);queue.push([cost,edge.toId])}}}
 if(!previous.has(end))throw Error('Bus stops are not connected by drivable streets');const path=[];let id=end;while(id!==start){const e=previous.get(id);if(!e)throw Error('Incomplete bus path');path.push(e);id=e.fromId}return path.reverse();
}
export function buildBusRoute(traffic,data){
 const stops=data.stops.map(s=>{let best;for(const e of traffic.edges){if(e.r.name!==s.road||e.r.width<6)continue;const dx=(e.to.x-e.from.x)/e.length,dz=(e.to.y-e.from.y)/e.length,t=Math.max(0,Math.min(1,((s.x-e.from.x)*dx+(s.z-e.from.y)*dz)/e.length)),x=e.from.x+dx*t*e.length,z=e.from.y+dz*t*e.length,side=(s.x-x)*dz-(s.z-z)*dx,score=Math.hypot(s.x-x,s.z-z)+(side<0?100:0);if(!best||score<best.score)best={...s,edge:e,t,dx,dz,x:x+dz*Math.min(e.r.width*.23,2.5),z:z-dx*Math.min(e.r.width*.23,2.5),yaw:Math.atan2(-dx,-dz),score}}if(!best||best.score>60)throw Error('Could not place bus stop '+s.name);return best});
 let due=20;for(let i=0;i<stops.length;i++){const s=stops[i],previous=stops[i-1];let connection=[];if(i){try{connection=roadPath(traffic.nodes,previous.edge.toId,s.edge.fromId)}catch(e){throw Error(previous.name+' → '+s.name+': '+e.message)}}s.path=i?[previous.edge,...connection,s.edge]:[s.edge];s.distance=i?previous.edge.length*(1-previous.t)+s.path.slice(1,-1).reduce((n,e)=>n+e.length,0)+s.t*s.edge.length:0;due+=i?s.distance/6.5+18:0;s.due=due;s.waiting=i===stops.length-1?0:s.waiting;}
 return{...data,stops,length:stops.reduce((n,s)=>n+s.distance,0)};
}
export function createBusJob(route){
 const state={phase:'idle',index:0,elapsed:0,dwell:0,boarded:0,picked:0,delivered:0,score:0,onboard:[],bus:null,visits:[],eligible:false,alighters:0};
 function start(bus){Object.assign(state,{phase:'running',index:0,elapsed:0,dwell:0,boarded:0,picked:0,delivered:0,score:0,onboard:[],bus,visits:[],eligible:false,alighters:0,alighted:false});return state}
 function update(dt,vehicle,braking){if(state.phase!=='running')return state;state.elapsed+=Math.max(0,dt);const s=route.stops[state.index],p=state.bus.position,distance=Math.hypot(p.x-s.x,p.z-s.z),aligned=-Math.sin(state.bus.yaw)*s.dx-Math.cos(state.bus.yaw)*s.dz>.65;state.eligible=vehicle===state.bus&&distance<10&&Math.abs(state.bus.velocity||0)<.35&&aligned&&braking&&!state.bus.airborne&&Math.abs(p.y-(s.y??p.y))<2&&!state.bus.inWater&&!state.bus.engineFlooded;
 if(!state.eligible){state.dwell=0;return state}state.dwell+=Math.max(0,dt);if(state.dwell<1)return state;
 if(!state.alighted){state.alighters=state.onboard.filter(p=>p.destination===state.index).length;state.delivered+=state.alighters;state.onboard=state.onboard.filter(p=>p.destination!==state.index);state.alighted=true;}
 while(state.boarded<s.waiting&&state.dwell>=1+(state.boarded+1)*.9){state.onboard.push({id:state.picked++,destination:Math.min(route.stops.length-1,state.index+1+state.boarded%3)});state.boarded++;}
 if(state.boarded===s.waiting&&state.dwell>=2+s.waiting*.9+state.alighters*.5){const late=Math.max(0,state.elapsed-s.due-25);state.score+=Math.max(0,20+s.waiting*5-Math.floor(late/5));state.visits.push({index:state.index,at:state.elapsed,boarded:state.boarded,alighted:state.alighters});state.index++;state.dwell=0;state.boarded=0;state.alighted=false;state.alighters=0;if(state.index===route.stops.length)state.phase='complete';}return state;
 }
 return{state,start,update,cancel(){state.phase='idle';state.bus=null;state.onboard=[]},route};
}
