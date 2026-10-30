const states=new WeakMap();
export function movePlayer({position,yaw,pitch,keys,dt,drone,world,clock}){
 const down=(...names)=>names.some(n=>keys[n]),f=Number(down('w','arrowup'))-Number(down('s','arrowdown')),s=Number(down('d','arrowright'))-Number(down('a','arrowleft')),boost=down('shift'),length=Math.hypot(f,s)||1,b=world.bounds;
 let state=states.get(position);if(!state){state={mode:'walking',vy:0,wet:false};states.set(position,state)}
 const current=world.water?.at(position.x,position.z),supported=world.water?.supported(position.x,position.z,position.y),dive=down('c','q','control'),swimming=!drone&&current&&!supported&&(current.depth>1.05||dive&&current.depth>.45||position.y<current.y-.08);
 const speed=drone?(boost?100:32):swimming?(boost?3.6:2.25):current&&!supported?3:boost?13:6;
 let dx=(-Math.sin(yaw)*(swimming||drone?Math.cos(pitch):1)*f+Math.cos(yaw)*s)/length*speed*dt,dz=(-Math.cos(yaw)*(swimming||drone?Math.cos(pitch):1)*f-Math.sin(yaw)*s)/length*speed*dt;
 if(swimming){dx+=(current.flow?.x||0)*(current.flow?.speed||0)*dt*.30;dz+=(current.flow?.z||0)*(current.flow?.speed||0)*dt*.30}
 const x=Math.max(b.minX,Math.min(b.maxX,position.x+dx)),z=Math.max(b.minZ,Math.min(b.maxZ,position.z+dz));
 if(drone){position.x=x;position.z=z;const dy=(Math.sin(pitch)*f/length+Number(down(' ','e'))-Number(dive))*speed*dt;position.y=Math.max(world.ground(x,z)+2,Math.min(750,position.y+dy));state.mode='walking';state.wet=false;state.vy=0}
 else{
  const allowed=(x,z)=>{const water=world.water?.at(x,z),bridge=world.water?.supported(x,z,position.y);if(water&&!bridge)return(world.freeSpace||world.free)(x,z,position.y,position);if(swimming&&world.walkHeight(x,z,position.y)>position.y+.65)return false;return world.free(x,z,position.y,position)};
  if(allowed(x,position.z))position.x=x;if(allowed(position.x,z))position.z=z;
  const water=world.water?.at(position.x,position.z),bridge=world.water?.supported(position.x,position.z,position.y),wet=water&&!bridge;
  if(wet){const deep=water.depth>1.05||dive&&water.depth>.45||position.y<water.y-.08;
   if(deep){state.mode='swimming';if(position.y>water.y+.25){state.vy-=9.81*dt;position.y=Math.max(water.y+.16,position.y+state.vy*dt)}else{state.vy=0;const vertical=Number(down(' ','e'))-Number(dive),look=Math.sin(pitch)*f/length;position.y+=(vertical*2.2+look*speed)*dt;if(!vertical&&!f&&position.y>water.y-.12)position.y+=(water.y+.16-position.y)*(1-Math.exp(-dt*5));position.y=Math.min(water.y+.20,Math.max(water.bed+.30,position.y))}
    if(!state.wet&&position.y<=water.y+.25)world.water.splash(position.x,water.y,position.z,Math.max(2,Math.abs(state.vy)));state.wet=position.y<=water.y+.25;
   }else{state.mode='wading';state.vy=0;position.y+=(water.bed+1.80-position.y)*(1-Math.exp(-dt*8));state.wet=true}
  }else{const h=world.walkHeight(position.x,position.z,position.y)+2+((f||s)?Math.sin(clock*11)*.065:0);position.y=state.mode!=='walking'?position.y+(h-position.y)*(1-Math.exp(-dt*8)):h;if(Math.abs(position.y-h)<.02)state.mode='walking';state.wet=false;state.vy=0}
 }
 const water=world.water?.at(position.x,position.z),underwater=water&&position.y<water.y-.08;
 return{mode:drone?'drone':underwater?'diving':state.mode,depth:underwater?water.y-position.y:0,atBoundary:Math.abs(position.x-b.minX)<1||Math.abs(position.x-b.maxX)<1||Math.abs(position.z-b.minZ)<1||Math.abs(position.z-b.maxZ)<1};
}
export function findLanding(world,x,z,fallback){for(const radius of [0,3,6,12,20,40])for(let i=0;i<(radius?16:1);i++){const a=i/16*Math.PI*2,px=x+Math.cos(a)*radius,pz=z+Math.sin(a)*radius;if(px>=world.bounds.minX&&px<=world.bounds.maxX&&pz>=world.bounds.minZ&&pz<=world.bounds.maxZ&&world.free(px,pz))return{x:px,z:pz}}return fallback}
