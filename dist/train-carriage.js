import * as T from './vendor/three.js';
// A carriage keeps its physical orientation when the service reverses direction.
export function trainCarPose(train,car=0){
 const distance=train.distance+(.5-car)*20,sample=train.path.sample(distance);
 const direction=train.path.sample(distance+6).position.clone().sub(train.path.sample(distance-6).position);
 if(direction.lengthSq()<1e-8)direction.copy(sample.direction);direction.normalize();
 const yaw=Math.atan2(-direction.x,-direction.z),pitch=Math.asin(T.MathUtils.clamp(direction.y,-1,1));
 return {position:sample.position,quaternion:new T.Quaternion().setFromEuler(new T.Euler(pitch,yaw,0,'YXZ')),direction};
}
export const TRAIN_SEATS=[
 {name:'Rear right window',x:.96,y:1.99,z:7.7,yaw:0},
 {name:'Rear left window',x:-.96,y:1.99,z:7.7,yaw:0},
 {name:'Middle right window',x:.96,y:1.99,z:3.6,yaw:0},
 {name:'Middle left window',x:-.96,y:1.99,z:3.6,yaw:0},
 {name:'Front left window',x:-.96,y:1.99,z:-7.7,yaw:Math.PI},
 {name:'Front right window',x:.96,y:1.99,z:-7.7,yaw:Math.PI},
 {name:'Middle left reverse',x:-.96,y:1.99,z:-3.6,yaw:Math.PI},
 {name:'Middle right reverse',x:.96,y:1.99,z:-3.6,yaw:Math.PI}
];
export function createTrainCarriage(){
 const group=new T.Group();group.name='Passenger train carriage';group.visible=false;
 const clothPixels=new Uint8Array(16*16*4);for(let y=0;y<16;y++)for(let x=0;x<16;x++){const i=(y*16+x)*4,v=(x*13+y*7)%11;clothPixels[i]=45+v;clothPixels[i+1]=91+v;clothPixels[i+2]=116+v;clothPixels[i+3]=255}
 const cloth=new T.DataTexture(clothPixels,16,16);cloth.colorSpace=T.SRGBColorSpace;cloth.magFilter=T.NearestFilter;cloth.wrapS=cloth.wrapT=T.RepeatWrapping;cloth.needsUpdate=true;
 const mat=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.72,emissive:color,emissiveIntensity:.10,...extra});
 const materials={shell:mat('#337b9b'),lining:mat('#dddcd0'),floor:mat('#485350'),trim:mat('#aab8b8',{metalness:.65,roughness:.32}),seat:mat('#ffffff',{map:cloth,emissive:'#284957'}),dark:mat('#243339'),yellow:mat('#d9b34a'),glass:new T.MeshStandardMaterial({color:'#d0ebed',transparent:true,opacity:.085,roughness:.18,metalness:.08,side:T.DoubleSide,depthWrite:false}),light:new T.MeshBasicMaterial({color:'#fff0ce'})};
 const batches=new Map();
 function box(category,material,x,y,z,w,h,d,yaw=0){const key=category+':'+material;if(!batches.has(key))batches.set(key,{category,material,items:[]});batches.get(key).items.push({x,y,z,w,h,d,yaw})}
 // Shell is built around actual open windows, rather than an opaque train-shaped box.
 box('floor','floor',0,.76,0,2.5,.16,18.3);
 box('aisle','dark',0,.85,0,.52,.018,17.8);
 box('ceiling','lining',0,2.83,0,2.5,.14,18.35);
 box('roof','trim',0,2.96,0,2.60,.13,18.65);
 for(const side of [-1,1]){
  box('lower wall','shell',side*1.24,1.16,0,.10,.65,18.3);
  box('inner lining','lining',side*1.176,1.16,0,.025,.63,18.1);
  box('upper wall','lining',side*1.24,2.67,0,.10,.23,18.3);
  box('window sill','trim',side*1.17,1.51,0,.11,.07,18.1);
  for(const z of [-9.05,-7.9,-6.6,-4.85,-4.2,-3,-1.8,0,1.8,3,4.2,4.85,6.6,7.9,9.05])box('window frame','lining',side*1.23,2.02,z,.12,1.04,.095);
  box('window glass','glass',side*1.245,2.025,0,.014,1.01,18.0);
  for(const z of [-5.6,5.6]){
   box('door panel','trim',side*1.18,1.24,z,.055,.78,1.34);
   box('door header','trim',side*1.18,2.48,z,.055,.19,1.34);
   for(const edge of [-1,1])box('door frame','trim',side*1.18,2.04,z+edge*.62,.055,.84,.10);
   box('door glass','glass',side*1.145,2.05,z,.014,.67,1.10);
   box('door seam','dark',side*1.10,1.62,z,.025,1.68,.018);
   box('door handle','yellow',side*1.085,1.48,z+.19,.045,.3,.035);
   box('door threshold','yellow',side*.97,.854,z,.39,.022,1.4);
   box('grab pole','yellow',side*.66,1.84,z-.94,.035,1.95,.035);
  }
  box('luggage rail','trim',side*.91,2.49,0,.035,.035,16.0);
  for(const z of [-7.8,-3.9,0,3.9,7.8]){
   box('rack bracket','trim',side*1.02,2.47,z,.32,.045,.045);
   for(let n=0;n<3;n++)box('luggage rack','trim',side*(.91+n*.10),2.49,z,.022,.022,3.8);
  }
  for(const z of [-6,0,6])box('light strip','light',side*.65,2.744,z,.14,.035,4.0);
 }
 // Forty upholstered seats in a 2+2 layout, with two clear door vestibules.
 for(const z of [-7.7,-6.7,-3.6,-2.4,-1.2,1.2,2.4,3.6,6.7,7.7])for(const x of [-.96,-.51,.51,.96]){
  const forward=z>0?1:-1;
  box('seat pedestal','dark',x,1.0,z,.20,.34,.32);
  box('seat cushion','seat',x,1.19,z,.39,.14,.48);
  box('seat back','seat',x,1.57,z+forward*.23,.39,.67,.11);
  box('seat headrest','dark',x,1.89,z+forward*.23,.33,.10,.12);
  for(const edge of [-1,1])box('armrest','trim',x+edge*.185,1.38,z,.022,.035,.37);
 }
 for(const end of [-1,1]){
  box('end wall','lining',0,1.80,end*9.08,2.5,2.0,.09);
  box('end door','trim',0,1.74,end*9.02,.72,1.82,.06);
  box('end window','dark',0,2.10,end*8.975,.49,.55,.02);
  box('end door handle','yellow',.26,1.60,end*8.94,.035,.22,.035);
  for(const side of [-1,1])box('front cab window','dark',side*.80,2.1,end*9.14,.59,.65,.035);
  box('cab face','yellow',0,1.45,end*9.15,2.5,.55,.055);
  for(const x of [-.8,.8])box('headlight','light',x,1.4,end*9.19,.19,.12,.035);
 }
 for(const z of [-6,6]){
  box('bogie','dark',0,.28,z,1.9,.4,1.7);
  for(const x of [-1,1])for(const offset of [-.55,.55])box('wheel','dark',x,.28,z+offset,.17,.54,.54);
 }
 const geometry=new T.BoxGeometry(1,1,1),dummy=new T.Object3D();
 for(const {category,material,items} of batches.values()){
  const mesh=new T.InstancedMesh(geometry,materials[material],items.length);mesh.name='Train '+category;mesh.userData.trainPart=category;mesh.frustumCulled=false;
  items.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.yaw,0);dummy.scale.set(p.w,p.h,p.d);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix)});group.add(mesh);
 }
 for(const z of [-5,5]){const light=new T.PointLight('#ffe7bd',9,13,2);light.position.set(0,2.56,z);group.add(light)}
 let sign=null,signContext=null,lastName='';
 if(globalThis.document){const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128;signContext=canvas.getContext('2d');if(signContext){sign=new T.CanvasTexture(canvas);sign.colorSpace=T.SRGBColorSpace;const material=new T.MeshBasicMaterial({map:sign});for(const end of [-1,1]){const mesh=new T.Mesh(new T.PlaneGeometry(1.85,.23),material);mesh.position.set(0,2.63,end*8.99);mesh.rotation.y=end>0?Math.PI:0;mesh.userData.trainPart='route display';group.add(mesh)}}}
 return {group,update(train,night=0){
  if(!train){group.visible=false;return}
  const pose=trainCarPose(train);group.position.copy(pose.position);group.quaternion.copy(pose.quaternion);group.visible=true;
  materials.lining.emissiveIntensity=.10+night*.20;materials.seat.emissiveIntensity=.12+night*.20;
  if(sign&&lastName!==train.name){lastName=train.name;signContext.fillStyle='#152421';signContext.fillRect(0,0,1024,128);signContext.fillStyle='#e8dd99';signContext.font='bold 36px sans-serif';signContext.textAlign='center';signContext.fillText((train.name||'VALLEY COMMUTER').toUpperCase(),512,52,980);signContext.font='24px sans-serif';signContext.fillText('PLEASE KEEP THE AISLE CLEAR',512,98,980);sign.needsUpdate=true}
 },dispose(){geometry.dispose();cloth.dispose();sign?.dispose();for(const material of Object.values(materials))material.dispose();group.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh){o.geometry.dispose();o.material.dispose()}});group.removeFromParent()}};
}
