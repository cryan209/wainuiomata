import * as T from './vendor/three.js';
// Ambient shipping: fictional yachts, launches and two unbranded inter-island ferries. Each type is one instanced mesh
// with baked vertex colours, so the whole fleet is four draw calls including wakes.
const WAVES=[[1,.32,52,.62],[.74,-.58,29,.38],[-.22,1,16,.24]].map(([dx,dz,len,amp])=>{const l=Math.hypot(dx,dz),k=Math.PI*2/len;return{dx:dx/l,dz:dz/l,k,w:Math.sqrt(9.81*k),amp}});
// Matches the three longest octaves of the sea shader: height and slope for bobbing hulls.
export function seaSwell(x,z,t,chop){let h=0,gx=0,gz=0;for(const v of WAVES){const ph=(v.dx*x+v.dz*z)*v.k-v.w*t,a=v.amp*chop;h+=a*Math.sin(ph);const c=a*v.k*Math.cos(ph);gx+=c*v.dx;gz+=c*v.dz}return{h,gx,gz}}
// Aotea Quay out through the harbour entrance, along the south coast and into Cook Strait (in-water route, 52km).
export const FERRY_ROUTE=[[-13050,550],[-10950,850],[-9150,2650],[-9150,3150],[-8950,3350],[-8950,6650],[-8750,6850],[-8750,7450],[-10950,9450],[-14150,9550],[-14450,9850],[-17850,9850],[-19250,10950],[-21850,10950],[-41950,31050]];
function build(parts){let count=0;const geos=parts.map(([g,colour,m])=>{g=g.index?g.toNonIndexed():g.clone();if(m)g.applyMatrix4(m);g.deleteAttribute('uv');count+=g.attributes.position.count;return[g,new T.Color(colour)]}),position=new Float32Array(count*3),normal=new Float32Array(count*3),color=new Float32Array(count*3);let o=0;
 for(const[g,c]of geos){position.set(g.attributes.position.array,o*3);normal.set(g.attributes.normal.array,o*3);for(let i=0;i<g.attributes.position.count;i++)color.set([c.r,c.g,c.b],(o+i)*3);o+=g.attributes.position.count;g.dispose()}
 const out=new T.BufferGeometry();out.setAttribute('position',new T.BufferAttribute(position,3));out.setAttribute('normal',new T.BufferAttribute(normal,3));out.setAttribute('color',new T.BufferAttribute(color,3));return out}
const M=(x,y,z,ry=0,sx=1,sy=1,sz=1)=>new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromEuler(new T.Euler(0,ry,0)),new T.Vector3(sx,sy,sz));
// Bow points to -z. Deck outline extruded downward, slightly narrower at the keel for a hull-like taper.
function hull(length,beam,depth){const s=new T.Shape(),h=length/2,b=beam/2;s.moveTo(0,-h);s.quadraticCurveTo(b,-h*.45,b,h*.15);s.lineTo(b*.85,h);s.lineTo(-b*.85,h);s.lineTo(-b,h*.15);s.quadraticCurveTo(-b,-h*.45,0,-h);const g=new T.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:5});g.rotateX(Math.PI/2);const p=g.attributes.position;for(let i=0;i<p.count;i++){const y=p.getY(i);if(y<-depth*.5){p.setX(i,p.getX(i)*.55)}}g.computeVertexNormals();return g}
function sail(foot,height,offset){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([0,0,offset,0,height,offset,0,0,offset+foot],3));g.computeVertexNormals();return g}
const TYPES={
 yacht:{length:11,speed:[3,5.5],draft:.35,parts:()=>[[hull(11,3.4,1.5),'#f2f0e8',M(0,.9,0)],[new T.BoxGeometry(2,.7,3),'#e8e4d8',M(0,1.2,.6)],[new T.CylinderGeometry(.09,.12,14,5),'#c9ccd0',M(0,7.9,-.6)],[sail(5.6,12.5,-.4),'#fbfbf6',M(0,1.6,0)],[sail(4.5,11,-5.4),'#f4f4ee',M(0,1.4,0)]]},
 launch:{length:10,speed:[5,9],draft:.4,parts:()=>[[hull(10,3.2,1.7),'#2f4f6f',M(0,1,0)],[new T.BoxGeometry(2.8,.12,9),'#d9d2c0',M(0,1.02,.3)],[new T.BoxGeometry(2.3,1.7,3.6),'#f0eee6',M(0,1.9,.6)],[new T.BoxGeometry(2.35,.55,3.65),'#26313a',M(0,2.25,.6)]]},
 ferry:{length:184,speed:[9,10],draft:3,parts:()=>[[hull(184,25,12),'#e9ebe6',M(0,7,0)],[new T.BoxGeometry(25.2,2.4,150),'#2c4a7a',M(0,1.4,8)],[new T.BoxGeometry(21,9,96),'#f3f4f0',M(0,11,22)],[new T.BoxGeometry(21.3,1.6,96.3),'#2a3540',M(0,13.2,22)],[new T.BoxGeometry(18,5,40),'#f3f4f0',M(0,17,-6)],[new T.BoxGeometry(18.3,1.3,8),'#26313a',M(0,18,-25)],[new T.CylinderGeometry(3,3.4,10,8),'#e9ebe6',M(0,22,50)],[new T.CylinderGeometry(3.05,3.05,2,8),'#c23b2e',M(0,26,50)]]}};
export function createBoats(scene,{isLand,bounds,seaLevel,count={yacht:16,launch:10,ferry:2}}){
 let seed=90211;const rand=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646};
 const inside=(x,z)=>x>bounds.minX+200&&x<bounds.maxX-200&&z>bounds.minZ+200&&z<bounds.maxZ-200;
 // Open water: in the grid and at least ~120m from any shore so hulls and sails never clip the land.
 const wet=(x,z)=>inside(x,z)&&!isLand(x,z)&&!isLand(x+120,z)&&!isLand(x-120,z)&&!isLand(x,z+120)&&!isLand(x,z-120);
 const clearRun=(ax,az,bx,bz)=>{const n=Math.ceil(Math.hypot(bx-ax,bz-az)/60);for(let i=1;i<=n;i++)if(!wet(ax+(bx-ax)*i/n,az+(bz-az)*i/n))return false;return true};
 const material=new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide}),meshes={},boats=[];
 const wakeGeo=new T.BufferGeometry();wakeGeo.setAttribute('position',new T.Float32BufferAttribute([0,0,0,-.5,0,1,.5,0,1, 0,0,0,-.16,0,1,.16,0,1],3));wakeGeo.computeVertexNormals();
 const wakeMat=new T.MeshBasicMaterial({color:'#e8f2f0',transparent:true,opacity:.42,depthWrite:false,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
 const total=Object.values(count).reduce((a,b)=>a+b,0),wakes=new T.InstancedMesh(wakeGeo,wakeMat,total);wakes.frustumCulled=false;wakes.userData.weatherEffect=true;scene.add(wakes);
 for(const[type,n]of Object.entries(count)){const spec=TYPES[type],mesh=new T.InstancedMesh(build(spec.parts()),material,n);mesh.frustumCulled=false;mesh.name='boats / '+type;scene.add(mesh);meshes[type]=mesh;
  for(let i=0;i<n;i++){const b={type,spec,mesh,slot:i,speed:spec.speed[0]+rand()*(spec.speed[1]-spec.speed[0]),heading:rand()*Math.PI*2,turn:0,x:0,z:0,target:null,leg:0,dir:1,heel:0};
   if(type==='ferry'){b.leg=i?FERRY_ROUTE.length-2:0;b.dir=i?-1:1;const p=FERRY_ROUTE[b.leg],q=FERRY_ROUTE[b.leg+b.dir];b.x=p[0];b.z=p[1];b.target=q;b.heading=Math.atan2(-(q[0]-p[0]),-(q[1]-p[1]))}
   else{for(let tries=0;tries<400;tries++){const x=bounds.minX+rand()*(bounds.maxX-bounds.minX),z=bounds.minZ+rand()*(bounds.maxZ-bounds.minZ);if(wet(x,z)){b.x=x;b.z=z;break}}}
   boats.push(b)}}
 function retarget(b){if(b.type==='ferry'){b.leg+=b.dir;if(b.leg+b.dir<0||b.leg+b.dir>=FERRY_ROUTE.length)b.dir*=-1;b.target=FERRY_ROUTE[b.leg+b.dir];return}
  for(let tries=0;tries<14;tries++){const a=rand()*Math.PI*2,r=500+rand()*3000,x=b.x+Math.cos(a)*r,z=b.z+Math.sin(a)*r;if(wet(x,z)&&clearRun(b.x,b.z,x,z)){b.target=[x,z];return}}b.target=[b.x+Math.sin(b.heading)*200,b.z+Math.cos(b.heading)*200]}
 for(const b of boats)if(!b.target)retarget(b);
 const dummy=new T.Object3D(),wakeDummy=new T.Object3D();let time=0;
 function update(dt,chop=1,t=time+dt){time=t;let w=0;
  for(const b of boats){const dx=b.target[0]-b.x,dz=b.target[1]-b.z,d=Math.hypot(dx,dz);if(d<(b.type==='ferry'?120:40))retarget(b);
   const want=Math.atan2(-dx,-dz),diff=Math.atan2(Math.sin(want-b.heading),Math.cos(want-b.heading)),rate=b.type==='ferry'?.06:.18;b.turn=T.MathUtils.clamp(diff,-rate,rate);b.heading+=b.turn*dt;
   const nx=b.x-Math.sin(b.heading)*b.speed*dt,nz=b.z-Math.cos(b.heading)*b.speed*dt;if(b.type==='ferry'||wet(nx,nz)){b.x=nx;b.z=nz}else{b.heading+=Math.PI*.6;retarget(b)}
   // Hulls ride the swell and lean into turns; yachts heel with the wind and the sea state.
   const s=seaSwell(b.x,b.z,t,chop),damp=b.type==='ferry'?.12:1,fx=-Math.sin(b.heading),fz=-Math.cos(b.heading),pitch=(s.gx*fx+s.gz*fz)*damp*.8,roll=(s.gx*fz-s.gz*fx)*damp*.8;
   b.heel+=((b.type==='yacht'?.18+.1*chop:0)-b.heel)*Math.min(1,dt);dummy.position.set(b.x,seaLevel+s.h*(b.type==='ferry'?.25:.8)-b.spec.draft,b.z);dummy.rotation.set(pitch,b.heading,roll+b.heel+b.turn*(b.type==='ferry'?2:.8),'YXZ');dummy.updateMatrix();b.mesh.setMatrixAt(b.slot,dummy.matrix);
   const len=b.spec.length;wakeDummy.position.set(b.x+Math.sin(b.heading)*len*.5,seaLevel+.06,b.z+Math.cos(b.heading)*len*.5);wakeDummy.rotation.set(0,b.heading,0);wakeDummy.scale.set(len*(.6+b.speed*.09),1,len*(1.4+b.speed*.35));wakeDummy.updateMatrix();wakes.setMatrixAt(w++,wakeDummy.matrix)}
  for(const m of Object.values(meshes))m.instanceMatrix.needsUpdate=true;wakes.instanceMatrix.needsUpdate=true}
 return{boats,update,meshes,wakes,get stats(){return{boats:boats.length}}};
}
