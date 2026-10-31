// Fixed voice pool: nearby traffic, birds, occasional distant dogs and shop bells.
export function createAmbientAudio(ctx,output,world){
 const make=(type,freq,noise=false)=>{const source=noise?ctx.createBufferSource():ctx.createOscillator(),filter=ctx.createBiquadFilter(),gain=ctx.createGain(),pan=ctx.createStereoPanner?.();filter.type='lowpass';filter.frequency.value=freq;gain.gain.value=0;if(noise){const buffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;source.buffer=buffer;source.loop=true}else{source.type=type;source.frequency.value=freq}source.connect(filter);filter.connect(gain);if(pan){gain.connect(pan);pan.connect(output)}else gain.connect(output);source.start();return{source,filter,gain,pan}};
 const traffic=Array.from({length:3},()=>make('sawtooth',200)),birds=make('sine',2200),dog=make('sawtooth',240),bell=make('sine',1900),leaves=make('',1000,true),rain=make('',3500,true);
 let clock=0,lastTime=ctx.currentTime,nextBird=2,nextDog=18,birdUntil=0,dogUntil=0,bellUntil=0,inside=false,nextScan=0,near=[];
 const set=(p,v,t=.08)=>p?.setTargetAtTime(v,ctx.currentTime,t);
 return {update({active,position,yaw=0,weather={},day=1,indoors=false,vehicle}){
  const dt=Math.max(0,Math.min(.1,ctx.currentTime-lastTime));lastTime=ctx.currentTime;if(active)clock+=dt;
  if(clock>=nextScan){nextScan=clock+.2;near=(world.traffic?.cars||[]).filter(c=>!c.controlled&&!c.parked&&c.position&&Math.abs(c.position.y-position.y)<10).map(c=>({car:c,d:Math.hypot(c.position.x-position.x,c.position.z-position.z)})).filter(c=>c.d<100).sort((a,b)=>a.d-b.d).slice(0,3)}
  const cabin=vehicle?.kind==='car'?.45:1,audible=active&&!indoors?cabin:0,trees=world.forestDensity?.(position.x,position.z)||0;
  if(active&&!indoors&&clock>nextBird){nextBird=clock+4+Math.random()*8;if(day>.2&&(weather.rain||0)<.5){birdUntil=clock+.65}}
  if(active&&!indoors&&clock>nextDog){nextDog=clock+28+Math.random()*35;if(near.length&&trees<.4)dogUntil=clock+.6}
  if(active&&indoors!==inside){bellUntil=clock+.6;inside=indoors}
  for(let i=0;i<traffic.length;i++){const item=near[i],speed=Math.abs(item?.car.velocity||0),attenuation=item?Math.max(0,1-item.d/100)**2:0;set(traffic[i].gain.gain,audible*attenuation*(.012+Math.min(.045,speed*.002)));set(traffic[i].source.frequency,45+speed*5+(item?.car.model?.bus?-12:0));const dx=(item?.car.position.x||0)-position.x,dz=(item?.car.position.z||0)-position.z;set(traffic[i].pan?.pan,Math.max(-1,Math.min(1,(dx*Math.cos(yaw)-dz*Math.sin(yaw))/35)))}
  const chirp=clock<birdUntil?Math.sin((birdUntil-clock)*28)**2:0;
  set(birds.gain.gain,audible*chirp*(.009+trees*.025),.025);set(birds.source.frequency,1800+Math.sin(clock*39)*650,.015);
  set(dog.gain.gain,audible*(clock<dogUntil?Math.sin(clock*20)**8*.018:0),.025);set(dog.filter.frequency,550);set(dog.source.frequency,110+Math.sin(clock*17)*30);
  set(bell.gain.gain,active&&clock<bellUntil?.05*Math.exp(-(clock-(bellUntil-.6))*7):0,.02);
  set(leaves.gain.gain,audible*trees*(.02+(weather.wind||0)*.035));
  set(rain.gain.gain,active&&!indoors?(weather.rain||0)*(vehicle?.kind==='car'?.065:.035):0);
 }};
}
