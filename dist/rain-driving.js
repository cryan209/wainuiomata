import * as T from './vendor/three.js';
export const WIPER_MODES=['auto','off','slow','fast'];
export function wiperStep(state,dt,rain,mode='auto'){
 const rate=mode==='off'?0:mode==='fast'?1.5:mode==='slow'?.7:rain>.65?1.2:rain>.05?.5:0;
 state.phase=(state.phase+Math.max(0,dt)*rate)%1;
 state.angle=rate?-2.95+2.65*(.5-.5*Math.cos(state.phase*Math.PI*2)):-2.95;
 state.swish=rate?Math.abs(Math.sin(state.phase*Math.PI*2)):0;
 return state;
}
export function createRainDriving({scene,canvas=document.querySelector('#cockpit-rain'),button=document.querySelector('#wiper-mode')}){
 const c=canvas?.getContext('2d'),wiper={phase:0,angle:-2.95,swish:0};let mode='auto',clock=0,spawn=0,lastCar=null;
 try{const saved=localStorage.getItem('wainui-wipers');if(WIPER_MODES.includes(saved))mode=saved}catch{}
 const droplets=Array.from({length:130},()=>({x:Math.random(),y:Math.random()*.8,r:1+Math.random()*2,age:Math.random()*8}));
 const count=100,positions=new Float32Array(count*3),particles=Array.from({length:count},()=>({life:0,vx:0,vy:0,vz:0})),geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));
 const pixels=new Uint8Array(16*16*4);for(let y=0;y<16;y++)for(let x=0;x<16;x++){const k=(y*16+x)*4;pixels[k]=pixels[k+1]=pixels[k+2]=255;pixels[k+3]=Math.round(Math.max(0,1-Math.hypot(x-7.5,y-7.5)/7.5)*180)}const texture=new T.DataTexture(pixels,16,16);texture.needsUpdate=true;
 const spray=new T.Points(geometry,new T.PointsMaterial({color:'#b6cbd0',map:texture,transparent:true,opacity:.32,size:.65,depthWrite:false}));spray.frustumCulled=false;spray.userData.weatherEffect=true;scene.add(spray);
 for(let i=0;i<count;i++)positions[i*3+1]=-10000;
 function label(){if(button)button.textContent=`WIPERS · ${mode.toUpperCase()} · K`}
 function cycle(){mode=WIPER_MODES[(WIPER_MODES.indexOf(mode)+1)%WIPER_MODES.length];try{localStorage.setItem('wainui-wipers',mode)}catch{}label()}
 label();if(button)button.onclick=cycle;
 return {cycle,get mode(){return mode},get audioState(){return {swish:wiper.swish}},update(dt,{active,car,firstPerson,weather={},camera,sheltered=false}){
  const rain=sheltered?0:weather.rain||0,speed=Math.abs(car?.velocity||0);dt=active?Math.min(.05,Math.max(0,dt)):0;clock+=dt;
  const forward=car&&Math.abs(Math.atan2(Math.sin(camera.rotation.y-(car.renderYaw??car.yaw)),Math.cos(camera.rotation.y-(car.renderYaw??car.yaw))))<.9;
  const visible=active&&!!car&&!car.path&&firstPerson&&forward&&!car.inWater;
  if(canvas)canvas.hidden=!visible;if(button)button.hidden=!active||!car||!!car.path;
  const previous=wiper.angle;wiperStep(wiper,dt,rain,mode);
  if(!visible)wiper.swish=0;
  if(c&&visible){
   const w=Math.min(innerWidth,1280),h=Math.round(innerHeight*w/innerWidth);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}c.clearRect(0,0,w,h);
   c.save();c.beginPath();c.moveTo(.07*w,.27*h);c.lineTo(.93*w,.27*h);c.lineTo(w,.78*h);c.lineTo(0,.78*h);c.closePath();c.clip();
   for(const drop of droplets){drop.age+=dt;drop.y+=dt*(.004+speed*.0004);if(drop.age>3+6*(1-rain)||drop.y>.82){drop.x=Math.random();drop.y=Math.random()*.75;drop.age=0;drop.r=1+Math.random()*2}
    if(drop.age>rain*8||rain<.01)continue;
    let wiped=false;for(const pivot of [.23,.68]){const dx=drop.x*w-pivot*w,dy=drop.y*h-.79*h,a=Math.atan2(dy,dx),r=Math.hypot(dx,dy);if(wiper.swish>0&&r<h*.65&&r>h*.12&&a>=Math.min(previous,wiper.angle)-.04&&a<=Math.max(previous,wiper.angle)+.04){wiped=true;break}}
    if(wiped){drop.age=20;continue}
    c.strokeStyle='rgba(215,240,249,.52)';c.lineWidth=drop.r*.6;c.beginPath();c.ellipse(drop.x*w,drop.y*h,drop.r,drop.r*(1.3+speed*.03),-.15,0,Math.PI*2);c.stroke();
   }
   for(const pivot of [.23,.68]){const x=pivot*w,y=.79*h,length=h*.64,dx=Math.cos(wiper.angle),dy=Math.sin(wiper.angle);c.lineCap='round';c.strokeStyle='#232d30';c.lineWidth=4;c.beginPath();c.moveTo(x,y);c.lineTo(x+dx*length,y+dy*length);c.stroke();c.strokeStyle='#10191b';c.lineWidth=7;c.beginPath();c.moveTo(x+dx*length*.42,y+dy*length*.42);c.lineTo(x+dx*length,y+dy*length);c.stroke()}
   c.restore();
  }
  if(lastCar!==car){particles.forEach(p=>p.life=0);lastCar=car;spawn=0}
  const spraying=active&&car&&!car.path&&!car.inWater&&!car.airborne&&rain>.05&&speed>3;
  if(spraying){spawn+=dt*rain*Math.min(100,speed*5);while(spawn>=1){spawn--;const i=particles.findIndex(p=>p.life<=0);if(i<0)break;const p=particles[i],side=Math.random()<.5?-1:1,yaw=car.renderYaw??car.yaw,pose=car.renderPosition||car.position,back=(car.model?.wheelbase||2.6)/2;positions[i*3]=pose.x+Math.sin(yaw)*back+Math.cos(yaw)*side*(car.model?.width||1.8)/2;positions[i*3+1]=pose.y+.2;positions[i*3+2]=pose.z+Math.cos(yaw)*back-Math.sin(yaw)*side*(car.model?.width||1.8)/2;Object.assign(p,{life:.35+Math.random()*.4,vx:Math.sin(yaw)*2+Math.cos(yaw)*side,vy:1+Math.random()*1.5,vz:Math.cos(yaw)*2-Math.sin(yaw)*side})}}
  for(let i=0;i<count;i++){const p=particles[i];p.life-=dt;if(p.life>0){positions[i*3]+=p.vx*dt;positions[i*3+1]+=p.vy*dt;positions[i*3+2]+=p.vz*dt;p.vy-=dt*4}else positions[i*3+1]=-10000}
  spray.visible=active&&!firstPerson&&!!car&&rain>.05;spray.material.opacity=.3*rain;geometry.attributes.position.needsUpdate=true;
 }};
}
