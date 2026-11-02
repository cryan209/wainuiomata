import * as T from './vendor/three.js';
import {offsetRoadPoint} from './road-topology.js?v=smooth-junctions-25';
const footways=new Set(['footway','path','pedestrian']),streets=new Set(['residential','living_street','tertiary','secondary','unclassified']);
const clothes=['#4a626c','#6b4248','#72735c','#455c50','#9b8c74','#4d5366','#a3a3a0'];
const skins=['#d4ac8b','#b78260','#8c5d43','#e4c3a3','#674733'];
const hairs=['#302823','#4b3930','#8b7755','#59534c','#b3aba0'];
const colourCache=new Map(),trousers=['#343a45','#4c5053','#50554d','#454351'];
function colour(values,id){const hex=values[id%values.length];if(!colourCache.has(hex))colourCache.set(hex,new T.Color(hex));return colourCache.get(hex)}

// Rounded-rectangle rings (height, half width, front depth, back depth) shape the hips, chest and sloping shoulders.
function torsoGeometry(rings,around=20){
 const vertices=[],index=[];
 for(const[y,w,front,back]of rings)for(let i=0;i<around;i++){const a=i/around*Math.PI*2,c=Math.cos(a),s=Math.sin(a);vertices.push(w*Math.sign(c)*Math.abs(c)**.7,y,(s<0?front:back)*Math.sign(s)*Math.abs(s)**.7)}
 for(let r=0;r<rings.length-1;r++)for(let i=0;i<around;i++){const a=r*around+i,b=r*around+(i+1)%around;index.push(a,a+around,b,b,a+around,b+around)}
 const top=vertices.length/3;vertices.push(0,rings.at(-1)[0]+.01,0);for(let i=0;i<around;i++)index.push(top,top-around+(i+1)%around,top-around+i);
 const uv=[];for(let i=0;i<vertices.length;i+=3)uv.push(Math.acos(T.MathUtils.clamp(vertices[i+2]/Math.hypot(vertices[i],vertices[i+2]||1e-6),-1,1))/Math.PI,(vertices[i+1]-rings[0][0])/(rings.at(-1)[0]-rings[0][0]));
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();return g;
}
// Tapered limb with domed ends and a muscle swell nearer the proximal (-y) joint.
function limbGeometry(around=12){
 const profile=[[0,-.5],[.5,-.493],[.78,-.47]];for(let i=0;i<=8;i++){const t=.04+i/8*.92;profile.push([.6+.25*(1-t)+.17*Math.sin(Math.PI*Math.min(1,t/.75)),t-.5])}profile.push([.42,.488],[0,.5]);
 return new T.LatheGeometry(profile.map(([r,y])=>new T.Vector2(r*.088,y)),around);
}
function roundedBox(radius=.38,segments=5){
 const g=new T.BoxGeometry(2,2,2,segments,segments,segments),p=g.attributes.position,n=g.attributes.normal,v=new T.Vector3(),inner=new T.Vector3();
 for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);inner.set(...v.toArray().map(c=>T.MathUtils.clamp(c,radius-1,1-radius)));v.sub(inner).normalize();n.setXYZ(i,v.x,v.y,v.z);v.multiplyScalar(radius).add(inner);p.setXYZ(i,v.x,v.y,v.z)}
 return g;
}
// Sculpted head in metres: narrowing jaw, nose, brow, eye sockets, chin and ears. The seam sits at the back.
function headGeometry(around=28,rings=20){
 const g=new T.SphereGeometry(1,around,rings,Math.PI/2),p=g.attributes.position,bump=(a,b,ax,ay)=>Math.exp(-(a*a)/ax-(b*b)/ay);
 for(let i=0;i<p.count;i++){let x=p.getX(i),y=p.getY(i),z=p.getZ(i);const front=Math.max(0,-z),low=Math.max(0,-y);
  let X=x*(1-.13*low*low),Y=y<-.6?-.6+(y+.6)*.55:y,Z=z>0?z*(1-.4*low*low):z*(1-.08*low*low);
  Z-=front*(.3*bump(x,y+.1,.008,.03)+.07*bump(x,y-.22,.25,.006)+.07*bump(x,y+.78,.04,.02)+.03*bump(x,y+.35,.3,.02));
  for(const s of[-1,1]){Z+=front*.055*bump(x-s*.36,y-.08,.012,.009);X+=s*Math.max(0,s*x)*.2*bump(y+.02,z-.08,.025,.012)}
  p.setXYZ(i,X*.082,Y*.122,Z*.1)}
 g.computeVertexNormals();return g;
}
// Textures are painted near-white so each instance's colour still tints them, like PS2 ped skins with baked folds.
function paint(w,h,draw){
 if(typeof document==='undefined')return null;
 const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,w,h);let seed=w*7+h;const rnd=()=>((seed=seed*16807%2147483647)-1)/2147483646;draw(x,rnd);
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;
}
const grain=(x,rnd,w,h,amount)=>{for(let i=0;i<w*h/6;i++){const v=rnd()<.5?0:255;x.fillStyle=`rgba(${v},${v},${v},${rnd()*amount})`;x.fillRect(rnd()*w,rnd()*h,1+rnd()*2,1)}};
const crease=(x,points,width,alpha,blur,light=false)=>{x.save();x.filter=`blur(${blur}px)`;x.strokeStyle=light?`rgba(255,255,255,${alpha})`:`rgba(40,36,34,${alpha})`;x.lineWidth=width;x.lineCap='round';x.beginPath();x.moveTo(...points[0]);for(let i=1;i<points.length-1;i+=2)x.quadraticCurveTo(...points[i],...points[i+1]);x.stroke();x.restore()};
// Shirt: u runs back (0) to front (1), mirrored on both sides; v=1 is the neckline.
function shirtTexture(){return paint(256,256,(x,rnd)=>{
 x.fillStyle='#ececec';x.fillRect(0,0,256,256);grain(x,rnd,256,256,.07);
 const g=x.createLinearGradient(0,0,0,256);g.addColorStop(0,'rgba(0,0,0,.10)');g.addColorStop(.25,'rgba(0,0,0,0)');g.addColorStop(.85,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.16)');x.fillStyle=g;x.fillRect(0,0,256,256);
 for(let i=0;i<7;i++){const u=70+rnd()*120,y=185+rnd()*55;crease(x,[[u-30,y+10+rnd()*8],[u,y-8],[u+34,y-2-rnd()*14]],5+rnd()*5,.45,3);crease(x,[[u-28,y+3],[u,y-14],[u+30,y-8]],2.5,.55,2,true)}
 for(let i=0;i<4;i++){const y=60+i*14+rnd()*6;crease(x,[[100,y],[118,y+12],[128,y+30+rnd()*8]],5,.35,3)}
 crease(x,[[170,100],[215,110],[256,106]],12,.25,8);crease(x,[[0,70],[40,92],[85,78]],14,.22,9);for(let i=0;i<5;i++){const u=150+rnd()*100;crease(x,[[u,120],[u+6,160],[u-4,200]],4,.18,4)}
 x.fillStyle='rgba(30,30,30,.28)';x.fillRect(127,0,2,256);x.fillRect(0,247,256,9);x.fillStyle='rgba(255,255,255,.3)';x.fillRect(0,244,256,2);
 x.fillStyle='rgba(30,30,30,.32)';x.fillRect(0,0,256,7);x.fillStyle='rgba(30,30,30,.2)';x.fillRect(100,14,8,3);
 x.fillStyle='rgba(30,30,30,.22)';for(let u=150;u<200;u+=1)x.fillRect(u,30+Math.abs(u-175)*.35,1,2);
})}
// Sleeves, trousers and neck: vertical weave, an inseam and creases bunched at the joints.
function clothTexture(){return paint(256,256,(x,rnd)=>{
 x.fillStyle='#ebebeb';x.fillRect(0,0,256,256);for(let i=0;i<500;i++){x.fillStyle=`rgba(${rnd()<.5?0:255},${rnd()<.5?0:255},255,${rnd()*.05})`;x.fillRect(rnd()*256,rnd()*256,1,4+rnd()*14)}grain(x,rnd,256,256,.05);
 for(let i=0;i<26;i++){const end=i%2,y=end?rnd()*60:196+rnd()*60,u=rnd()*256;crease(x,[[u-50,y+rnd()*10],[u,y-8+rnd()*16],[u+50,y+rnd()*10]],4+rnd()*5,.42,2.5);crease(x,[[u-40,y+2],[u,y-7],[u+40,y+2]],2,.5,1.5,true)}
 for(let i=0;i<5;i++){const u=rnd()*256;crease(x,[[u,60],[u+8,128],[u-4,200]],6,.22,4)}
 x.fillStyle='rgba(30,30,30,.22)';x.fillRect(64,0,2,256);x.fillRect(192,0,1,256);
})}
// Hair strands run from the crown (top of the texture) down.
function hairTexture(){return paint(256,128,(x,rnd)=>{
 x.fillStyle='#d6d6d6';x.fillRect(0,0,256,128);
 for(let i=0;i<900;i++){const u=rnd()*256,v=rnd()*60,l=20+rnd()*70,a=rnd()*.35;x.strokeStyle=rnd()<.6?`rgba(0,0,0,${a})`:`rgba(255,255,255,${a})`;x.lineWidth=.6+rnd();x.beginPath();x.moveTo(u,v);x.quadraticCurveTo(u+rnd()*6-3,v+l/2,u+rnd()*8-4,v+l);x.stroke()}
 const g=x.createLinearGradient(0,0,0,128);g.addColorStop(0,'rgba(255,255,255,.15)');g.addColorStop(1,'rgba(0,0,0,.25)');x.fillStyle=g;x.fillRect(0,0,256,128);
})}
// Eyes, brows, lips, nostrils and facial shading; u=.5 is the front of the face.
function faceTexture(){return paint(512,256,(x,rnd)=>{
 const cx=256;grain(x,rnd,512,256,.04);
 const jaw=x.createLinearGradient(0,170,0,256);jaw.addColorStop(0,'rgba(90,60,50,0)');jaw.addColorStop(1,'rgba(90,60,50,.35)');x.fillStyle=jaw;x.fillRect(0,170,512,86);
 for(const s of[-1,1]){const g=x.createRadialGradient(cx+s*44,150,4,cx+s*44,150,40);g.addColorStop(0,'rgba(120,70,60,.14)');g.addColorStop(1,'rgba(120,70,60,0)');x.fillStyle=g;x.fillRect(cx+s*44-40,110,80,80);crease(x,[[cx+s*11,146],[cx+s*20,156],[cx+s*21,170]],2.5,.2,1.5)}
 x.fillStyle='rgba(60,50,45,.07)';for(let i=0;i<500;i++){const a=rnd()*Math.PI,r=30+rnd()*40;x.fillRect(cx+Math.cos(a)*r*1.2,150+Math.sin(a)*r*.9,1,1)}
 for(const s of[-1,1]){
  const g=x.createRadialGradient(cx+s*30,122,2,cx+s*30,122,22);g.addColorStop(0,'rgba(120,80,70,.28)');g.addColorStop(1,'rgba(120,80,70,0)');x.fillStyle=g;x.fillRect(cx+s*30-24,98,48,48);
  x.fillStyle='#f4efe8';x.beginPath();x.ellipse(cx+s*30,123,9,3.6,0,0,Math.PI*2);x.fill();
  x.fillStyle='#3b2a22';x.beginPath();x.arc(cx+s*29,123,3.4,0,Math.PI*2);x.fill();
  x.strokeStyle='#4a3028';x.lineWidth=1.6;x.beginPath();x.ellipse(cx+s*30,123.5,9.5,4,0,Math.PI*1.05,Math.PI*1.95);x.stroke();
  x.strokeStyle='rgba(70,48,36,.85)';x.lineWidth=3.6;x.lineCap='round';x.beginPath();x.moveTo(cx+s*18,113);x.quadraticCurveTo(cx+s*30,107,cx+s*42,112);x.stroke();
  x.fillStyle='rgba(90,55,45,.55)';x.beginPath();x.ellipse(cx+s*5,145,2.6,1.6,0,0,Math.PI*2);x.fill();
 }
 x.fillStyle='#b77d70';x.beginPath();x.moveTo(cx-17,163);x.quadraticCurveTo(cx,156,cx+17,163);x.quadraticCurveTo(cx,172,cx-17,163);x.fill();
 x.strokeStyle='#6a3e36';x.lineWidth=1.4;x.beginPath();x.moveTo(cx-16,163);x.quadraticCurveTo(cx,165,cx+16,163);x.stroke();
})}

export function createHumanRenderer(scene,capacity){
 const rings=[[.90,.158,.1,.108],[.96,.152,.098,.104],[1.08,.165,.11,.106],[1.20,.19,.13,.116],[1.29,.205,.132,.118],[1.355,.212,.112,.108],[1.40,.19,.085,.085],[1.435,.12,.065,.065],[1.455,.06,.05,.05]];
 const hairGeometry=(around,rows)=>new T.SphereGeometry(1,around,rows,Math.PI/2,Math.PI*2,0,Math.PI*.45).rotateX(.3);
 const shapes={torso:torsoGeometry(rings),limbs:limbGeometry(),head:headGeometry(),skin:roundedBox(.45),hair:hairGeometry(24,10),detail:roundedBox(),dark:roundedBox(.5)},maps={torso:shirtTexture(),limbs:clothTexture(),head:faceTexture(),hair:hairTexture()};
 // Distant figures (write with detailed=false) use about a fifth of the triangles and the same materials.
 const farShapes={torso:torsoGeometry(rings,10),limbs:limbGeometry(6),head:headGeometry(12,8),skin:roundedBox(.45,2),hair:hairGeometry(10,4),detail:roundedBox(.38,2),dark:roundedBox(.5,2)};
 const meshes={},farMeshes={},sets=[meshes,farMeshes];for(const[k,g]of Object.entries(shapes)){const material=new T.MeshStandardMaterial({color:'#ffffff',roughness:k==='head'||k==='skin'?.72:.92,map:maps[k]||null});for(const[set,geometry,suffix]of [[meshes,g,''],[farMeshes,farShapes[k],' far']]){const mesh=new T.InstancedMesh(geometry,material,capacity*({torso:1,limbs:10,head:1,skin:2,hair:3,detail:12,dark:6}[k]));mesh.count=0;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.name='People / '+k+suffix;scene.add(mesh);set[k]=mesh}}
 let target=meshes;
 const local=new T.Matrix4(),matrix=new T.Matrix4(),pos=new T.Vector3(),q=new T.Quaternion(),scale=new T.Vector3(),axis=new T.Vector3(0,1,0),delta=new T.Vector3();
 const put=(kind,root,p,s,c,rotation)=>{pos.set(...p);scale.set(...s);q.copy(rotation||identity);local.compose(pos,q,scale);matrix.multiplyMatrices(root,local);const mesh=target[kind],slot=mesh.count++;mesh.setMatrixAt(slot,matrix);mesh.setColorAt(slot,c)};
 const identity=new T.Quaternion(),shoe=new T.Color('#292c2d'),white=new T.Color('#e0dfd5');
 const bone=(kind,root,a,b,width,c)=>{pos.set(...a);delta.set(...b).sub(pos);const length=delta.length();pos.addScaledVector(delta,.5);q.setFromUnitVectors(axis,delta.multiplyScalar(1/(length||1)));scale.set(width,length+.05,width);local.compose(pos,q,scale);matrix.multiplyMatrices(root,local);const mesh=target[kind],slot=mesh.count++;mesh.setMatrixAt(slot,matrix);mesh.setColorAt(slot,c)};
 return{meshes,begin(){for(const set of sets)for(const m of Object.values(set))m.count=0},write(root,id,phase=0,walking=false,seated=null,detailed=true){
  target=detailed?meshes:farMeshes;
  const shirt=colour(clothes,id),skin=colour(skins,id*3),pants=colour(trousers,id),hair=colour(hairs,id);
  const build=[.91,1.02,1.13,.97,1.08][id%5],shortSleeves=id%3===0,legWidth=[1,1.10,1.18,.95,1.08][id%5];
  put('torso',root,[0,0,0],[build,1,1],shirt);
  put('limbs',root,[0,.89,.008],[1.84*build,.17,1.12],pants);
  put('head',root,[0,1.60,-.012],[1,1,1],skin);
  bone('limbs',root,[0,1.40,.008],[0,1.53,-.004],.7,skin);
  put('hair',root,[0,1.603,-.006],[.089,.13,.11],hair);
  if(detailed){
   if(id%4===0)put('hair',root,[0,1.53,.07],[.09,.13,.055],hair);
   if(id%7===0)put('hair',root,[0,1.575,.12],[.05,.055,.05],hair);
   if(id%2)put('dark',root,[0,.952,0],[.168*build,.013,.112],shoe);
   for(const side of [-1,1]){
    // Collar halves, jacket opening and pockets read clearly at walking distance.
    put('detail',root,[side*.046,1.425,-.054],[.036,.016,.013],shirt);
    if(id%3===1)put('detail',root,[side*.108,1.09,-.118],[.045,.008,.008],pants);
    if(id%6===0)put('dark',root,[side*.03,1.61,-.108],[.025,.013,.005],shoe);
   }
   if(id%3===1)put('detail',root,[0,1.20,-.132],[.005,.18,.005],pants);
  }
  for(const side of [-1,1]){
   const swing=walking?Math.sin(phase+(side===1?0:Math.PI))*.43:0,kneeBend=walking?Math.max(0,-Math.sin(phase+(side===1?0:Math.PI)))*.62:0;
   const hip=[side*.10*build,.88,0],knee=seated?[side*.105,.93,-.38]:[side*.105,.88-.38*Math.cos(swing),-.38*Math.sin(swing)],ankle=seated?[side*.105,.60,-.64]:[side*.105,Math.max(.095,knee[1]-.38*Math.cos(swing-kneeBend)),knee[2]-.38*Math.sin(swing-kneeBend)];
   bone('limbs',root,hip,knee,legWidth*1.06,pants);bone('limbs',root,knee,ankle,legWidth*.78,pants);
   put('dark',root,[ankle[0],seated?.55:ankle[1]-.05,ankle[2]-.045],[.047,.04,.122],shoe);
   if(detailed)put('detail',root,[ankle[0],seated?.512:ankle[1]-.08,ankle[2]-.045],[.054,.011,.124],id%2?shoe:white);
   if(detailed){const shoulder=[side*.195*build,1.345,0],elbow=seated?[side*.23,1.10,seated.z*.45]:[side*(.235*build+.03),1.095,.23*Math.sin(-swing)-.025],hand=seated?[side*.14,seated.y,seated.z]:[side*(.235*build+.035),.86,.36*Math.sin(-swing)-.06];bone('limbs',root,shoulder,elbow,.86*build,shirt);bone('limbs',root,elbow,hand,shortSleeves?.6:.72,shortSleeves?skin:shirt);put('skin',root,[hand[0],hand[1]-.05,hand[2]],[.025,.054,.042],skin)}
  }
  if(detailed&&!seated&&id%5===0)put('dark',root,[0,1.20,.17],[.13,.17,.06],colour(clothes,id+2));
 },finish(){for(const set of sets)for(const m of Object.values(set)){m.visible=m.count>0;m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true}},dispose(){for(const set of sets)for(const m of Object.values(set)){scene.remove(m);m.geometry.dispose();m.material.dispose()}}};
}

export function createPeople(scene,world,traffic={cars:[]},{count=56}={}){
 // detail scales the full-model and drawing distances; lower graphics tiers simplify walkers sooner.
 let detail=1;
 let seed=27361;const random=()=>((seed=seed*16807%2147483647)-1)/2147483646;
 const cells=new Map(),people=[],network=world.network;
 // Index references once; validate only the paths near the player.
 for(const r of network.roads){if(r.bridge||r.tags?.tunnel==='yes'||r.tags?.access==='private'||r.tags?.foot==='no'||r.tags?.footway==='crossing'||(!footways.has(r.type)&&!streets.has(r.type)))continue;const path=footways.has(r.type),shoulder=((r.pavementWidth||r.width)-r.width)/2;if(!path&&shoulder<.65)continue;for(let i=0;i<r.p.length-1;i++){if(r.sharedSegments?.has(i))continue;const a=r.p[i],b=r.p[i+1],length=a.distanceTo(b);if(length<9)continue;for(const side of path?[0]:[-1,1]){const item={r,i,length,side,path,offset:side*(r.width/2+Math.min(.65,shoulder/2))};for(let ix=Math.floor(Math.min(a.x,b.x)/160);ix<=Math.floor(Math.max(a.x,b.x)/160);ix++)for(let iz=Math.floor(Math.min(a.y,b.y)/160);iz<=Math.floor(Math.max(a.y,b.y)/160);iz++){const key=ix+','+iz;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(item)}}}}
 const closeToCar=(p,margin=.45)=>traffic.cars.some(car=>{const c=car.renderPosition||car.position;if(!c||Math.abs(c.y-p.y)>2)return false;const yaw=car.renderYaw??car.yaw,dx=p.x-c.x,dz=p.z-c.z,along=dx*Math.sin(yaw)+dz*Math.cos(yaw),across=dx*Math.cos(yaw)-dz*Math.sin(yaw);return Math.abs(along)<car.model.length/2+margin&&Math.abs(across)<car.model.width/2+margin});
 const sample=(route,t,direction=1)=>{if(route.crossing){const a=route.r.p[route.i],b=route.r.p[route.i+1],x=T.MathUtils.lerp(a.x,b.x,t),z=T.MathUtils.lerp(a.y,b.y,t);return{x,z,y:network.walkHeight(x,z,route.crossing.y+2),dx:(b.x-a.x)/route.length,dz:(b.y-a.y)/route.length}}const a=route.r.p[route.i],b=route.r.p[route.i+1],p=offsetRoadPoint(route.r,route.i,t,route.offset+direction*.13),hint=network.height(route.r,route.i,t,p.x,p.z);return{x:p.x,z:p.z,y:hint+(route.path?0:.08),dx:(b.x-a.x)/route.length,dz:(b.y-a.y)/route.length}};
 const safe=(p,route)=>{if(!Number.isFinite(p.y)||!world.free(p.x,p.z,p.y+1))return false;const hit=network.at(p.x,p.z);if(hit&&!footways.has(hit.r.type)&&hit.d<hit.r.width/2+.25&&!route?.crossing)return false;const rail=world.railways?.at(p.x,p.z,0);return !(rail&&rail.d<2.4&&Math.abs(rail.y-p.y)<2.5)};
 function validate(item,camera){const a=item.r.p[item.i],b=item.r.p[item.i+1],centre=T.MathUtils.clamp(((camera.x-a.x)*(b.x-a.x)+(camera.z-a.y)*(b.y-a.y))/(item.length*item.length),0,1);const trim=item.path?1.2:Math.max(3,item.r.width/2+.5),lo=Math.max(trim/item.length,centre-150/item.length),hi=Math.min(1-trim/item.length,centre+150/item.length);if(hi<=lo)return[];const runs=[];let start=null,previous=null;const n=Math.ceil((hi-lo)*item.length/2);for(let j=0;j<=n;j++){const t=lo+(hi-lo)*j/n,p=sample(item,t),good=safe(p)&&(!previous||Math.abs(p.y-previous.y)<.45);if(good&&start===null)start=t;if((!good||j===n)&&start!==null){const end=good?t:lo+(hi-lo)*(j-1)/n;if((end-start)*item.length>=6)runs.push({...item,lo:start,hi:end});start=null}previous=p}return runs}
 let nextRefresh=-1,clock=0,serial=0,walkingRoutes=[];
 function refill(camera){const nearby=new Set();for(let ix=-1;ix<=1;ix++)for(let iz=-1;iz<=1;iz++)for(const route of cells.get((Math.floor(camera.x/160)+ix)+','+(Math.floor(camera.z/160)+iz))||[])nearby.add(route);const candidates=[...nearby].map(r=>{const a=r.r.p[r.i],b=r.r.p[r.i+1];const t=T.MathUtils.clamp(((camera.x-a.x)*(b.x-a.x)+(camera.z-a.y)*(b.y-a.y))/(r.length*r.length),0,1);return{r,d:Math.hypot(a.x+(b.x-a.x)*t-camera.x,a.y+(b.y-a.y)*t-camera.z)}}).filter(r=>r.d<220).sort((a,b)=>a.d-b.d).slice(0,200),routes=[];
  for(const candidate of candidates)routes.push(...validate(candidate.r,camera));
  walkingRoutes=routes;const limit=traffic.rules?.crossings.length?Math.max(0,count-1):count;for(let attempt=0;people.length<limit&&attempt<count*25&&routes.length;attempt++){const route=routes[Math.floor(random()**1.6*routes.length)],direction=random()<.5?-1:1,t=route.lo+(route.hi-route.lo)*random(),p=sample(route,t,direction);if(Math.hypot(p.x-camera.x,p.z-camera.z)>200||closeToCar(p,.6)||people.some(o=>Math.hypot(o.position.x-p.x,o.position.z-p.z)<2.6))continue;people.push({id:serial++,route,t,direction,position:p,yaw:Math.atan2(-p.dx*direction,-p.dz*direction),speed:.85+random()*.45,size:.90+random()*.15,phase:random()*Math.PI*2,idle:random()<.22?2+random()*4:0,walking:false})}
  for(const crossing of traffic.rules?.crossings||[]){if(people.length>=count||people.some(p=>p.route.crossing))break;if((crossing.nextPedestrianAt||0)>clock)continue;if(Math.hypot(crossing.x-camera.x,crossing.z-camera.z)>150||people.some(p=>p.route.crossing===crossing))continue;const route={...crossing.route,lo:0,hi:1,crossing},direction=random()<.5?1:-1,t=direction===1?0:1,p=sample(route,t,direction);if(!safe(p,route)||!safe(sample(route,1-t,-direction),route)||closeToCar(p,.8))continue;crossing.nextPedestrianAt=clock+30+random()*30;people.push({id:serial++,route,t,direction,position:p,yaw:Math.atan2(-p.dx*direction,-p.dz*direction),speed:1.5,size:.95,phase:0,idle:3+random()*4,walking:false})}

 }
 function avoidVehicle(person,car){if(person.evasion)return true;const candidates=[],m=car.model||{},yaw=car.yaw||0;for(const radius of [.9,1.4,2,2.8,3.8])for(let i=0;i<16;i++){const a=i*Math.PI/8,x=person.position.x+Math.cos(a)*radius,z=person.position.z+Math.sin(a)*radius,y=network.walkHeight?.(x,z,person.position.y+2)??person.position.y,q={x,z,y};if(Math.abs(q.y-person.position.y)>.5||![.33,.66].every(t=>safe({x:person.position.x+(x-person.position.x)*t,z:person.position.z+(z-person.position.z)*t,y:person.position.y+(y-person.position.y)*t},person.route))||!safe(q,person.route)||closeToCar(q,.8)||people.some(p=>p!==person&&Math.hypot(p.position.x-x,p.position.z-z)<.75))continue;const dx=x-car.position.x,dz=z-car.position.z,across=Math.abs(dx*Math.cos(yaw)-dz*Math.sin(yaw));candidates.push({target:q,score:radius+(across<(m.width||1.8)/2+.8?4:0)})}candidates.sort((a,b)=>a.score-b.score);if(!candidates.length)return false;person.evasion=candidates[0].target;person.direction=1;person.idle=0;return true}
 function finishEvasion(person){if(person.route.crossing){const old=person.route,a=old.r.p[old.i],b=old.r.p[old.i+1],dx=(b.x-a.x)/old.length,dz=(b.y-a.y)/old.length,t=T.MathUtils.clamp(((person.position.x-a.x)*dx+(person.position.z-a.y)*dz)/old.length,0,1),ox=person.position.x-a.x-dx*t*old.length,oz=person.position.z-a.y-dz*t*old.length;person.route={...old,i:0,r:{p:[{x:a.x+ox,y:a.y+oz},{x:b.x+ox,y:b.y+oz}]}};person.t=t;person.direction=t<.5?-1:1;person.crossingCommitted=true;person.idle=0;return}const old=person.route,a=old.r.p[old.i],b=old.r.p[old.i+1],dx=(b.x-a.x)/old.length,dz=(b.y-a.y)/old.length,t=T.MathUtils.clamp(((person.position.x-a.x)*dx+(person.position.z-a.y)*dz)/old.length,old.lo,old.hi),offset=(person.position.x-a.x-dx*t*old.length)*dz-(person.position.z-a.y-dz*t*old.length)*dx;person.route={...old,offset};person.t=t;person.idle=.5}
 function leaveCrossing(person){const crossing=person.route.crossing;crossing.nextPedestrianAt=clock+35+random()*25;person.crossingCommitted=false;person.waiting=false;let best=null;for(const route of walkingRoutes){const a=route.r.p[route.i],b=route.r.p[route.i+1],dx=b.x-a.x,dz=b.y-a.y,t=T.MathUtils.clamp(((person.position.x-a.x)*dx+(person.position.z-a.y)*dz)/(route.length*route.length),route.lo,route.hi),point=sample(route,t,person.direction),d=Math.hypot(point.x-person.position.x,point.z-person.position.z);if(d<3&&safe(point,route)&&(!best||d<best.d))best={route,t,point,d}}if(best){person.route=best.route;person.t=best.t;person.position=best.point;person.idle=.3;person.speed=.9+random()*.4}else{person.crossingFinished=true;person.idle=120;person.t=person.direction>0?person.route.hi:person.route.lo;person.position=sample(person.route,person.t,person.direction)}}
 const render=createHumanRenderer(scene,count+traffic.cars.length),root=new T.Matrix4(),pos=new T.Vector3(),q=new T.Quaternion(),scale=new T.Vector3(),rotation=new T.Euler();
 function update(dt,camera){dt=Math.max(0,Math.min(dt,.05));clock+=dt;for(let i=people.length-1;i>=0;i--)if(Math.hypot(people[i].position.x-camera.x,people[i].position.z-camera.z)>285)people.splice(i,1);
  if(clock>=nextRefresh){nextRefresh=clock+2;if(people.length<count)refill(camera)}render.begin();
  const nearby=new Map();for(const p of people){const key=Math.floor(p.position.x/3)+','+Math.floor(p.position.z/3);if(!nearby.has(key))nearby.set(key,[]);nearby.get(key).push(p)}
  const clearOfPeople=(next,p)=>{for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const other of nearby.get((Math.floor(next.x/3)+dx)+','+(Math.floor(next.z/3)+dz))||[])if(other!==p&&Math.abs(other.position.y-next.y)<.8&&Math.hypot(other.position.x-next.x,other.position.z-next.z)<.68)return false;return true};
  for(const p of people){if(dt>0){p.walking=false;if(!p.evasion)for(const car of traffic.cars)if(car.controlled&&Math.abs(car.velocity||0)>.8&&car.position){const x=p.position.x-car.position.x,z=p.position.z-car.position.z,along=-x*Math.sin(car.yaw)-z*Math.cos(car.yaw),across=Math.abs(x*Math.cos(car.yaw)-z*Math.sin(car.yaw));if(along>0&&along<7&&across<car.model.width/2+.7&&Math.abs(p.position.y-car.position.y)<2)avoidVehicle(p,car)}if(p.evasion){const dx=p.evasion.x-p.position.x,dz=p.evasion.z-p.position.z,d=Math.hypot(dx,dz),step=Math.min(d,2.8*dt);p.position={...p.position,x:p.position.x+dx/Math.max(d,.001)*step,z:p.position.z+dz/Math.max(d,.001)*step,y:p.evasion.y,dx:dx/Math.max(d,.001),dz:dz/Math.max(d,.001)};p.walking=true;p.phase+=dt*12;if(d<.12){p.evasion=null;finishEvasion(p)}}else if(p.idle>0)p.idle-=dt;else{const t=p.t+p.direction*p.speed*dt/p.route.length;if(t<p.route.lo||t>p.route.hi){if(p.route.crossing)leaveCrossing(p);else{p.direction*=-1;p.idle=1+random()*3}}else{const next=sample(p.route,t,p.direction);if(safe(next,p.route)&&(!p.route.crossing||p.crossingCommitted||traffic.rules.pedestrianSafe(p.route.crossing))&&!closeToCar(next,.65)&&clearOfPeople(next,p)){p.t=t;p.position=next;p.phase+=p.speed*dt*6;p.walking=true;p.waiting=false;if(p.route.crossing)p.crossingCommitted=true}else{if(p.route.crossing){p.waiting=true;p.idle=0}else{p.direction*=-1;p.idle=.7+random()*1.5}}}}const target=Math.atan2(-p.position.dx*p.direction,-p.position.dz*p.direction),angle=Math.atan2(Math.sin(target-p.yaw),Math.cos(target-p.yaw));p.yaw+=angle*(1-Math.exp(-dt*7))}
   const distance=Math.hypot(p.position.x-camera.x,p.position.z-camera.z);if(distance>230*detail||world.visibility&&!world.visibility.instance(p,p.position.x,p.position.y,p.position.z,.5*p.size,1.9*p.size))continue;pos.set(p.position.x,p.position.y+.018+(p.walking?.010*Math.cos(p.phase*2):0),p.position.z);rotation.set(0,p.yaw,0);q.setFromEuler(rotation);scale.setScalar(p.size);root.compose(pos,q,scale);render.write(root,p.id,p.phase,p.walking,null,distance<80*detail*detail);
  }
  // Occupants use the same rig and the vehicle's current rendered transform.
  for(const car of traffic.cars){const p=car.renderPosition||car.position,m=car.model;if(car.cockpitView||!p||!m||!car.fleetMatrix||(!car.controlled&&(car.parked||car.manualPark))||car.fleetDetail===0||car.fleetHidden)continue;const distance=Math.hypot(p.x-camera.x,p.z-camera.z);if(distance>110*Math.max(.6,detail))continue;const commercial=m.bus||m.van,F=-m.length/2,[a,A,B]=m.cabin,floor=m.bus?.76:m.van?.53:m.ute?.55:.32,seatY=floor+(m.bus?.42:.22),seatZ=commercial?F+1.03:m.ute?(A+B)/2-.08:A+.53,driverX=m.bus?m.width*.31:m.width*.225,driverZ=seatZ+.04,driverScale=Math.min(.86,(m.roof-.07-seatY-.08)/.868),driverY=seatY+.08-.88*driverScale,dashZ=commercial?F+.32:a+.23;
   root.makeTranslation(driverX,driverY,driverZ);root.scale(new T.Vector3(driverScale,driverScale,driverScale));root.premultiply(car.fleetMatrix);render.write(root,car.index+401,0,false,{y:(m.body+.11-driverY)/driverScale,z:(dashZ+.34-driverZ)/driverScale},distance<80*detail*detail);
  }
  render.finish();
 }
 return{people,update,avoidVehicle,setDetail(k){detail=k},get stats(){return{walkers:people.length,draws:Object.values(render.meshes).filter(m=>m.count).length}},dispose:render.dispose};
}
