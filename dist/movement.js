// Keep free flight separate from ground collision and bridge/water rules.
export function movePlayer({position,yaw,pitch,keys,dt,drone,world,clock}){
 const down=(...names)=>names.some(n=>keys[n]);const f=Number(down('w','arrowup'))-Number(down('s','arrowdown')),s=Number(down('d','arrowright'))-Number(down('a','arrowleft')),boost=down('shift'),speed=drone?(boost?100:32):(boost?13:6),length=Math.hypot(f,s)||1;
 let dx=(-Math.sin(yaw)*f+Math.cos(yaw)*s)/length*speed*dt,dz=(-Math.cos(yaw)*f-Math.sin(yaw)*s)/length*speed*dt,dy=0;
 if(drone){dx=(-Math.sin(yaw)*Math.cos(pitch)*f+Math.cos(yaw)*s)/length*speed*dt;dz=(-Math.cos(yaw)*Math.cos(pitch)*f-Math.sin(yaw)*s)/length*speed*dt;dy=(Math.sin(pitch)*f/length+Number(down(' ','e'))-Number(down('c','q','control')))*speed*dt}
 const b=world.bounds,x=Math.max(b.minX,Math.min(b.maxX,position.x+dx)),z=Math.max(b.minZ,Math.min(b.maxZ,position.z+dz));
 if(drone){position.x=x;position.z=z;position.y=Math.max(world.ground(x,z)+2,Math.min(750,position.y+dy))}else{if(world.free(x,position.z,position.y,position))position.x=x;if(world.free(position.x,z,position.y,position))position.z=z;position.y=world.walkHeight(position.x,position.z,position.y)+2+((f||s)?Math.sin(clock*11)*.065:0)}
 return{atBoundary:Math.abs(position.x-b.minX)<1||Math.abs(position.x-b.maxX)<1||Math.abs(position.z-b.minZ)<1||Math.abs(position.z-b.maxZ)<1};
}
export function findLanding(world,x,z,fallback){for(const radius of [0,3,6,12,20,40])for(let i=0;i<(radius?16:1);i++){const a=i/16*Math.PI*2,px=x+Math.cos(a)*radius,pz=z+Math.sin(a)*radius;if(px>=world.bounds.minX&&px<=world.bounds.maxX&&pz>=world.bounds.minZ&&pz<=world.bounds.maxZ&&world.free(px,pz))return{x:px,z:pz}}return fallback}
