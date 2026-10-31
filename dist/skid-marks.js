import * as T from './vendor/three.js';
// Rubber left by the rear tyres while the player's car slides or the handbrake locks them. One ring buffer of quads, so the
// oldest marks are overwritten instead of the mesh growing; each quad's darkness follows how hard the tyre was sliding.
// Quads face up or down depending on travel direction, so the material is double-sided.
// Heights come from the car's own ride height, pitch and roll, so marks sit under the tyres where the drawn ground is.
const SEGMENTS=1600,WIDTH=.24;
export function createSkidMarks({scene}){
 const positions=new Float32Array(SEGMENTS*4*3),colors=new Float32Array(SEGMENTS*4*4),index=[];for(let i=0;i<SEGMENTS;i++){const v=i*4;index.push(v,v+1,v+2,v+2,v+1,v+3)}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));geometry.setAttribute('color',new T.BufferAttribute(colors,4).setUsage(T.DynamicDrawUsage));geometry.setIndex(index);
 const mesh=new T.Mesh(geometry,new T.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));mesh.frustumCulled=false;mesh.renderOrder=1;scene.add(mesh);
 let next=0,trails=[null,null];
 function segment(from,to,strength){const dx=to.x-from.x,dz=to.z-from.z,length=Math.hypot(dx,dz);if(length<.05)return;const sx=-dz/length*WIDTH/2,sz=dx/length*WIDTH/2,v=next*4;
  [[from.x+sx,from.y,from.z+sz],[from.x-sx,from.y,from.z-sz],[to.x+sx,to.y,to.z+sz],[to.x-sx,to.y,to.z-sz]].forEach((p,i)=>{positions.set(p,(v+i)*3);colors.set([.05,.05,.05,i<2?from.strength:strength],(v+i)*4)});
  next=(next+1)%SEGMENTS;geometry.attributes.position.needsUpdate=geometry.attributes.color.needsUpdate=true}
 function update(car){
  if(!car||car.path||!(car.skid>.15)){trails=[null,null];return}
  const m=car.model||{},back=-(m.wheelbase||2.65)/2,track=(m.width||1.8)*.4,strength=Math.min(.85,car.skid*.85);
  trails=trails.map((last,i)=>{const side=i?track:-track,x=car.position.x-Math.sin(car.yaw)*back+Math.cos(car.yaw)*side,z=car.position.z-Math.cos(car.yaw)*back-Math.sin(car.yaw)*side,point={x,y:car.position.y+back*Math.tan(car.groundPitch||0)+side*Math.tan(car.groundRoll||0)+.05,z,strength};if(last&&Math.hypot(x-last.x,z-last.z)>4)return point;if(last)segment(last,point,strength);return point});
 }
 return{update,mesh};
}
