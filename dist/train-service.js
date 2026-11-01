// Fictional game service tuning, in metres and seconds; not real railway limits.
export const TRAIN_MOTION={acceleration:.8,brake:1,dwell:8};
export function trainCruiseSpeed(name=''){return (/Johnsonville/i.test(name)?70:/Melling/i.test(name)?80:110)/3.6}
export function configureTrainService(train,stations=[]){
 if(train.serviceStations===stations&&train.serviceStops)return train.serviceStops;
 const low=24,high=Math.max(low,train.path.length-24),stops=[];
 if(train.path.nearest)for(const station of stations){
  const hit=train.path.nearest(station.x,station.z);if(hit.distance>=65)continue;
  const s=Math.max(low,Math.min(high,hit.s-10));if(stops.some(stop=>Math.abs(stop.s-s)<90))continue;
  stops.push({name:station.name,s,station:true});
 }
 for(const s of [low,high])if(!stops.some(stop=>Math.abs(stop.s-s)<.01))stops.push({name:'Terminus',s,station:false});
 stops.sort((a,b)=>a.s-b.s);train.serviceStations=stations;train.serviceStops=stops;
 train.speed=Number.isFinite(train.speed)?Math.max(0,train.speed):0;train.wait=Math.max(0,train.wait||0);train.serviceArrivalSerial??=0;
 return stops;
}
export function stepTrainService(train,dt,stations){
 const stops=configureTrainService(train,stations);let remaining=Math.max(0,Number.isFinite(dt)?dt:0);const {acceleration,brake,dwell}=TRAIN_MOTION;
 while(remaining>1e-8){
  if(train.wait>0){const waiting=Math.min(remaining,train.wait);train.wait-=waiting;remaining-=waiting;train.speed=0;train.braking=false;if(remaining<1e-8)break}
  const step=Math.min(remaining,.05);remaining-=step;
  const stop=train.direction>0?stops.find(s=>s.s>train.distance+.001):[...stops].reverse().find(s=>s.s<train.distance-.001);
  if(!stop){train.direction*=-1;train.speed=0;train.wait=dwell;train.braking=false;continue}
  const distance=Math.abs(stop.s-train.distance),speed=train.speed;
  // This envelope allows for travel during the next integration step as well as braking.
  const target=Math.min(trainCruiseSpeed(train.name),Math.max(0,Math.sqrt(brake*brake*step*step+2*brake*distance)-brake*step));
  const next=speed<target?Math.min(target,speed+acceleration*step):Math.max(target,speed-brake*step);
  train.braking=next<speed-1e-6;train.speed=next;
  const travel=(speed+next)*.5*step;
  if(travel>=distance||distance<.08&&next<.5){
   train.distance=stop.s;train.speed=0;train.wait=dwell;train.braking=false;train.serviceArrived=stop;train.serviceArrivalSerial++;
   if(Math.abs(stop.s-24)<.01||Math.abs(stop.s-(train.path.length-24))<.01)train.direction*=-1;
  }else train.distance+=travel*train.direction;
 }
}
