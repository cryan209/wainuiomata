// Continuous layers are reused; envelopes follow the player's vehicle telemetry.
export function createVehicleAudio(ctx,output){
 const layers={};
 function tone(name,type,frequency,cutoff){const source=ctx.createOscillator(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();source.type=type;source.frequency.value=frequency;filter.type='lowpass';filter.frequency.value=cutoff;gain.gain.value=0;source.connect(filter);filter.connect(gain);gain.connect(output);source.start();return layers[name]={source,filter,gain}}
 function noise(name,frequency){const source=ctx.createBufferSource(),buffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;source.buffer=buffer;source.loop=true;const filter=ctx.createBiquadFilter(),gain=ctx.createGain();filter.type='bandpass';filter.frequency.value=frequency;gain.gain.value=0;source.connect(filter);filter.connect(gain);gain.connect(output);source.start();return layers[name]={source,filter,gain}}
 tone('engine','triangle',40,650);tone('exhaust','sawtooth',80,350);tone('intake','sine',120,1800);tone('rotor','sine',24,150);tone('rail','triangle',90,1600);tone('bell','sine',1175,4000);noise('road',850);noise('air',1400);noise('brake',2600);noise('chain',2200);noise('wetTyres',3500);noise('wipers',650);
 let previousKind=null,previousGear=null,shiftUntil=0,brakeUntil=0,wasBraking=false;
 const target=(p,v,t=.07)=>p.setTargetAtTime(v,ctx.currentTime,t);
 return {update(vehicle,keys={},weather={}){
  const now=ctx.currentTime,kind=vehicle?.kind,speed=Math.abs(vehicle?.speed||0),car=kind==='car',train=kind==='train',heli=kind==='heli',bike=kind==='bike',moto=kind==='moto',throttle=!!(keys.w||keys.arrowup),braking=!!(keys.s||keys.arrowdown||keys[' ']),diesel=vehicle?.diesel||vehicle?.bus,alive=(car||moto)&&!vehicle.flooded;
  if(kind!==previousKind){previousGear=null;shiftUntil=brakeUntil=0;wasBraking=false;previousKind=kind}
  if(alive&&previousGear!=null&&vehicle.gear!==previousGear)shiftUntil=now+.16;
  previousGear=vehicle?.gear;
  if((train||vehicle?.bus)&&wasBraking&&!braking&&speed<2)brakeUntil=now+.45;
  wasBraking=braking;
  const rpm=Math.max(650,Math.min(moto?12000:7500,vehicle?.rpm||800+speed*95)),firing=rpm/120*(vehicle?.cylinders||4),load=throttle&&!braking?1:.25,shift=now<shiftUntil?.45:1;
  const levels={wetTyres:car&&!vehicle.inWater?Math.min(.13,speed*.005)*(weather.rain||0):0,wipers:car?(weather.wiperSwish||0)*.03:0,engine:alive?(.11+load*.045)*shift:0,exhaust:alive?(diesel?.065:moto?.06:.045)*(.4+load)*shift:0,intake:alive?load*(moto?.035:.025):0,rotor:heli?.20*(.65+.35*Math.sin(now*36)**2):0,rail:train?.06+Math.min(.10,speed*.003):0,bell:bike&&keys.h?.12*(.65+.35*Math.sin(now*28)):0,road:(car||train||moto)&&!vehicle.inWater?Math.min(.17,speed*.004)*(train?.6+.4*Math.sin(now*Math.max(1,speed)*1.8)**8:1):0,air:heli?.10:Math.min(.12,speed*.0025),brake:now<brakeUntil?.12:(train&&braking&&speed>1?.035:0),chain:bike?Math.min(.045,speed*.004)*(throttle?1:.35)*(.6+.4*Math.sin(now*Math.max(1,speed)*3)**2):0};
  if(!vehicle)for(const name in levels)levels[name]=0;
  for(const name in levels)target(layers[name].gain.gain,levels[name]);
  target(layers.engine.source.frequency,firing,.12);target(layers.exhaust.source.frequency,firing*(diesel||vehicle?.dirt?1:2),.12);target(layers.exhaust.filter.frequency,(diesel?220:350)+load*650+rpm*.07,.15);target(layers.intake.source.frequency,firing*3,.12);target(layers.rotor.source.frequency,22+Math.min(12,(vehicle?.rpm||0)/120),.2);target(layers.rail.source.frequency,65+speed*7,.12);target(layers.road.filter.frequency,train?450:550+speed*35,.15);
 }};
}
