import * as T from './vendor/three.js';
import {RADIO_TOWER_SITES} from './radio-tower-sites.js';
// Structure dimensions are scenery estimates. RSM supplies licence-location anchors.
export function cellGeometry(kind){
 const positions=[],normals=[],colours=[],steel=new T.Color('#818d8e'),panel=new T.Color('#d5d8ce'),dark=new T.Color('#455453'),concrete=new T.Color('#878a7d'),up=new T.Vector3(0,1,0);
 function add(original,colour){const g=original.index?original.toNonIndexed():original;positions.push(...g.attributes.position.array);normals.push(...g.attributes.normal.array);for(let i=0;i<g.attributes.position.count;i++)colours.push(colour.r,colour.g,colour.b);if(g!==original)g.dispose();original.dispose()}
 function box(x,y,z,w,h,d,c=steel,angle=0){const g=new T.BoxGeometry(w,h,d);g.rotateY(angle);g.translate(x,y,z);add(g,c)}
 function beam(a,b,r=.05){const p=new T.Vector3(...a),q=new T.Vector3(...b),g=new T.CylinderGeometry(r,r,p.distanceTo(q),6);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(up,q.clone().sub(p).normalize()));g.translate(...p.clone().add(q).multiplyScalar(.5).toArray());add(g,steel)}
 if(kind==='monopole'||kind==='rooftop'){const height=kind==='rooftop'?5:20,r=kind==='rooftop'?.08:.35,g=new T.CylinderGeometry(r*.45,r,height,8);g.translate(0,height/2,0);add(g,steel);if(kind==='rooftop')for(let i=0;i<3;i++){const a=i*Math.PI*2/3;beam([0,1.7,0],[Math.cos(a)*.9,0,Math.sin(a)*.9],.045)}else box(0,.1,0,1.2,.2,1.2,concrete)}
 if(kind==='lattice'){const corners=[[-1,-1],[1,-1],[0,1]],half=y=>1.25-.75*y/26;for(let y=0;y<26;y+=5.2)for(let i=0;i<3;i++){const [x,z]=corners[i],[nx,nz]=corners[(i+1)%3],top=y+5.2;beam([x*half(y),y,z*half(y)],[x*half(top),top,z*half(top)],.07);beam([x*half(y),y,z*half(y)],[nx*half(top),top,nz*half(top)],.045);beam([x*half(y),y,z*half(y)],[nx*half(y),y,nz*half(y)],.04)}}
 if(kind==='head'){
  for(let i=0;i<3;i++){const a=i*Math.PI*2/3,dx=Math.sin(a),dz=Math.cos(a);beam([0,.8,0],[dx*1.1,.8,dz*1.1],.06);for(const side of [-1,1]){const x=dx*1.05+Math.cos(a)*side*.28,z=dz*1.05-Math.sin(a)*side*.28;box(x,1.05,z,.36,1.85,.19,panel,a);box(x-dx*.16,.55,z-dz*.16,.22,.6,.2,dark,a)}}
  const dish=new T.SphereGeometry(.42,10,6);dish.scale(.22,1,1);dish.translate(.65,.35,0);add(dish,panel);
 }
 if(kind==='cabinet'){box(1.9,.85,.8,.85,1.7,.7,panel);box(1.9,.06,.8,1.15,.12,.95,concrete);for(let i=0;i<5;i++)box(1.9,.5+i*.16,1.155,.55,.035,.012,dark)}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colours,3));geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
export function cellTowerPlacement(site,world){
 const ground=world.ground(site.x,site.z),datum=world.meta?.originElevation||0,building=(world.buildings||[]).find(b=>b.id===site.buildingId),roof=building?.ridge??building?.eave??site.roofElevation;
 const shared=site.mount!=='rooftop'&&RADIO_TOWER_SITES.find(t=>Math.hypot(t.x-site.x,t.z-site.z)<15);
 if(shared)return {...site,x:shared.x,z:shared.z,base:world.ground(shared.x,shared.z),height:shared.height*.65,mount:'attached',sharedTower:shared.id};
 return {...site,base:site.mount==='rooftop'?(Number.isFinite(roof)?roof-datum:ground+(site.buildingHeight||3)):ground};
}
// Frame a preview only after district buildings load, keeping the camera and sightline above roofs.
export function frameCellView(site,world){
 const datum=world.meta?.originElevation||0,inside=(ring,x,z)=>{let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])hit=!hit}return hit};
 const buildings=[...(world.buildings||[]),...(world.region?.buildings||[])].filter(b=>b.rings?.length).map(b=>{const p=b.rings[0],box=b.bounds||[Math.min(...p.map(v=>v[0])),Math.min(...p.map(v=>v[1])),Math.max(...p.map(v=>v[0])),Math.max(...p.map(v=>v[1]))];return {b,box,y:(b.ridge??b.eave??((b.ground||datum)+(b.height||0)+(b.roof?.rise||0)))-datum}}).filter(v=>v.box[0]<site.x+110&&v.box[2]>site.x-110&&v.box[1]<site.z+110&&v.box[3]>site.z-110);
 const roofAt=(x,z)=>{let y=world.walkHeight(x,z);for(const {b,box,y:roof} of buildings)if(x>=box[0]&&x<=box[2]&&z>=box[1]&&z<=box[3]&&inside(b.rings[0],x,z)&&!b.rings.slice(1).some(r=>inside(r,x,z)))y=Math.max(y,roof);return y};
 const targetY=site.base+site.height*.7;let best=null;
 for(const distance of [45,70])for(let i=0;i<12;i++){const yaw=Math.PI/4+i*Math.PI/6,x=site.x+Math.sin(yaw)*distance,z=site.z+Math.cos(yaw)*distance,ground=world.walkHeight(x,z);let eye=Math.max(ground+12,site.base+site.height+2,roofAt(x,z)+4);
  for(let j=1;j<20;j++){const t=j/20,roof=roofAt(x+(site.x-x)*t,z+(site.z-z)*t)+1;eye=Math.max(eye,(roof-targetY*t)/(1-t))}
  const score=eye+distance*.02+i*.001;if(!best||score<best.score)best={x,z,yaw,pitch:Math.atan2(targetY-eye,distance),altitude:eye-ground,score};
 }
 return best;
}
export async function createCellTowers({scene,world,data}){
 if(!data){const response=await fetch('./cell-sites.json?v=cells-90');if(!response.ok)throw Error('Could not load cell sites');data=await response.json()}
 const entries=data.sites.filter(s=>world.coast?.isLand?.(s.x,s.z)!==false||s.mount==='rooftop').map(s=>cellTowerPlacement(s,world)),material=new T.MeshLambertMaterial({vertexColors:true}),meshes={},dummy=new T.Object3D(),cells=new Map();
 for(const kind of ['monopole','lattice','rooftop','head','cabinet']){const mesh=new T.InstancedMesh(cellGeometry(kind),material,Math.max(1,entries.length));mesh.count=0;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.name='Cell sites / '+kind;mesh.userData.cellSites=true;scene.add(mesh);meshes[kind]=mesh}
 const farPositions=new Float32Array(entries.length*6),farGeometry=new T.BufferGeometry();farGeometry.setAttribute('position',new T.BufferAttribute(farPositions,3).setUsage(T.DynamicDrawUsage));const far=new T.LineSegments(farGeometry,new T.LineBasicMaterial({color:'#9aa9a7'}));far.frustumCulled=false;far.name='Distant cellular masts';farGeometry.setDrawRange(0,0);scene.add(far);
 for(const site of entries){const key=Math.floor(site.x/100)+','+Math.floor(site.z/100);if(!cells.has(key))cells.set(key,[]);cells.get(key).push(site)}
 let next=0,lastX=Infinity,lastZ=Infinity,nearby=0;
 function write(kind,site,y,scale=1){const mesh=meshes[kind];dummy.position.set(site.x,y,site.z);dummy.rotation.set(0,0,0);dummy.scale.set(1,scale,1);dummy.updateMatrix();mesh.setMatrixAt(mesh.count++,dummy.matrix)}
 function update(position){const now=performance.now();if(now<next&&Math.hypot(position.x-lastX,position.z-lastZ)<80)return;next=now+300;lastX=position.x;lastZ=position.z;for(const mesh of Object.values(meshes))mesh.count=0;let n=0;nearby=0;
  for(const site of entries){const d=Math.hypot(site.x-position.x,site.z-position.z);if(d>5500)continue;if(d>1600){farPositions.set([site.x,site.base,site.z,site.x,site.base+site.height,site.z],n++*6);continue}nearby++;
   if(site.mount!=='attached'){const nominal=site.mount==='rooftop'?5:site.mount==='lattice'?26:20;write(site.mount,site,site.base,site.height/nominal)}write('head',site,site.base+site.height-2.1);if(site.mount==='monopole'||site.mount==='lattice')write('cabinet',site,site.base);
  }
  for(const mesh of Object.values(meshes)){mesh.visible=mesh.count>0;mesh.instanceMatrix.needsUpdate=true}far.visible=n>0;farGeometry.setDrawRange(0,n*2);farGeometry.attributes.position.needsUpdate=true;
 }
 function neighbours(x,z){const found=[];for(let ix=-1;ix<=1;ix++)for(let iz=-1;iz<=1;iz++)found.push(...(cells.get((Math.floor(x/100)+ix)+','+(Math.floor(z/100)+iz))||[]));return found}
 return {entries,meshes,update,get stats(){return {mapped:data.siteCount,rendered:entries.length,nearby}},
  free(x,z,y){return !neighbours(x,z).some(s=>{if(s.mount==='attached'||y!==undefined&&(y<s.base-.5||y>s.base+s.height+1))return false;const pole=Math.hypot(x-s.x,z-s.z)<(s.mount==='lattice'?1.1:.55),cabinet=s.mount!=='rooftop'&&(y===undefined||y<s.base+2)&&Math.abs(x-s.x-1.9)<.65&&Math.abs(z-s.z-.8)<.6;return pole||cabinet})},
  frameDestination(destination){const site=entries.find(s=>s.id===destination.cellId);return site?frameCellView(site,world):destination},
  drawMinimap(c,X,Y){c.fillStyle='#89c8d5';for(const site of entries){const x=X(site.x),y=Y(site.z);if(x<0||x>210||y<0||y>170)continue;c.fillRect(x-1.5,y-1.5,3,3)}},
  destinations(){const chosen=[],anchors=[['wainui','Wainuiomata · Cell tower',0,0],['hutt','Lower Hutt · Cell tower',-3200,-5500],['wellington','Wellington · Rooftop antennas',-14000,2500]];for(const [id,name,x,z] of anchors){const site=entries.filter(s=>id==='wellington'?s.mount==='rooftop':s.mount!=='rooftop'&&s.mount!=='attached').sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z))[0];if(!site)continue;const distance=45,px=site.x+distance*.7,pz=site.z+distance*.7,ground=world.walkHeight(px,pz),altitude=Math.max(12,site.base+site.height+2-ground),eye=ground+altitude,pitch=Math.atan2(site.base+site.height*.6-eye,distance);chosen.push(['cell-'+id,{name,x:px,z:pz,yaw:Math.PI/4,pitch,drone:true,altitude,cellSite:true,cellId:site.id}])}return chosen}
 };
}
