import {buildHouse,selectHouseEntrances,houseStyles} from './house-interiors.js?v=release-1';
import * as T from './vendor/three.js';
import {buildSupermarket,matchSupermarket} from './supermarket.js';
import {supermarketSites} from './supermarket-sites.js';
import {regionalDestinations} from './regional-destinations.js';

export function selectEntrances(world,origin,limit=9,{maxDistance=Infinity,exclude=new Set()}={}){
 const chosen=[];
 const buildings=[...world.buildings].filter(b=>b.faces&&b.rings?.[0]&&!exclude.has(b.id)&&Math.hypot(b.rings[0][0][0]-origin.x,b.rings[0][0][1]-origin.z)<maxDistance).sort((a,b)=>Math.hypot(a.rings[0][0][0]-origin.x,a.rings[0][0][1]-origin.z)-Math.hypot(b.rings[0][0][0]-origin.x,b.rings[0][0][1]-origin.z));
 for(const b of buildings){
  for(const f of [...b.faces].filter(f=>f.front&&f.length>4).sort((a,b)=>a.score-b.score)){
   const mx=(f.a[0]+f.b[0])/2,mz=(f.a[1]+f.b[1])/2;
   if(chosen.some(p=>Math.hypot(p.x-mx,p.z-mz)<22))continue;
   let entry;
   for(const offset of [2,3,4,5]){const x=mx+f.nx*offset,z=mz+f.nz*offset,y=world.walkHeight(x,z)+2;
    if(!world.free(x,z,y)||world.water?.at(x,z)?.depth>.25||Math.abs(world.walkHeight(x+f.nx,z+f.nz)-y+2)>.6)continue;
    entry={x,z,y,wallX:mx+f.nx*.12,wallZ:mz+f.nz*.12,nx:f.nx,nz:f.nz,buildingId:b.id};break;
   }
   if(entry){chosen.push(entry);break;}
  }
  if(chosen.length===limit)break;
 }
 return chosen;
}

export function roomClear(x,z,obstacles,radius=.28){
 return x>-4.7+radius&&x<4.7-radius&&z>-5.7+radius&&z<5.7-radius&&!obstacles.some(b=>x>b.x-b.w/2-radius&&x<b.x+b.w/2+radius&&z>b.z-b.d/2-radius&&z<b.z+b.d/2+radius);
}
function sign(text,colour='#ead9aa',width=512){
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=128;
 const c=canvas.getContext('2d');c.fillStyle='#172a28';c.fillRect(0,0,width,128);c.strokeStyle=colour;c.lineWidth=6;c.strokeRect(8,8,width-16,112);c.fillStyle=colour;c.textAlign='center';c.textBaseline='middle';c.font='bold 32px monospace';c.fillText(text,width/2,66,width-32);
 const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.magFilter=T.NearestFilter;return new T.MeshBasicMaterial({map,side:T.DoubleSide});
}
export function buildRoom(kind){
 if(kind.startsWith('house-'))return buildHouse(kind);
 if(kind==='supermarket')return buildSupermarket();
 const scene=new T.Scene();scene.background=new T.Color('#18211e');const obstacles=[];
 const materials=new Map();const material=colour=>{if(!materials.has(colour))materials.set(colour,new T.MeshLambertMaterial({color:colour}));return materials.get(colour);};
 function box(x,y,z,w,h,d,colour,solid=false){const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),material(colour));mesh.position.set(x,y,z);scene.add(mesh);if(solid)obstacles.push({x,z,w,d});return mesh;}
 box(0,-.12,0,10,.24,12,'#605648');box(0,3.5,0,10,.2,12,'#d8ceaf');box(-4.9,1.7,0,.2,3.4,12,'#afbaa2');box(4.9,1.7,0,.2,3.4,12,'#afbaa2');box(0,1.7,-5.9,10,3.4,.2,'#c7c2a5');box(-2.95,1.7,5.9,3.9,3.4,.2,'#afbaa2');box(2.95,1.7,5.9,3.9,3.4,.2,'#afbaa2');box(0,3.05,5.9,2, .7,.2,'#afbaa2');
 // Skirting, a tiled floor and ceiling fittings keep the small rooms readable.
 for(const x of [-4.76,4.76])box(x,.12,0,.08,.24,11.8,'#45564e');
 for(let x=-4;x<=4;x+=2)for(let z=-5;z<=5;z+=2)box(x,.009,z,1.96,.015,1.96,(x+z)%4===1?'#807968':'#716b5c');
 scene.add(new T.HemisphereLight('#fff1cd','#5a6555',2.1));
 for(const z of [-3,2]){box(0,3.32,z,1.4,.08,.4,'#fff4cc');const light=new T.PointLight('#ffdf9a',12,12,2);light.position.set(0,3,z);scene.add(light);}
 const board=(text,x,y,z,w=3)=>{const m=new T.Mesh(new T.PlaneGeometry(w,w/4),sign(text));m.position.set(x,y,z);scene.add(m);return m;};
 board('EXIT · E',0,2.55,5.76,1.6).rotation.y=Math.PI;
 // Bright window panels with timber mullions along both side walls.
 for(const x of [-4.77,4.77])for(const z of [-2,2]){box(x,2.05,z,.03,1.25,2,'#93b9bb');box(x* .997,2.05,z,.05,1.3,.06,'#d5c4a0');box(x*.997,2.05,z,.05,.06,2.1,'#d5c4a0');}
 if(kind==='dairy'){
  board('VALLEY DAIRY',0,2.7,-5.76,3.8);
  box(-2.8,.65,-3.6,3.4,1.3,1,'#ba7950',true);box(-2.8,1.34,-3.6,3.6,.12,1.15,'#e3d4ac');box(-2.5,1.6,-3.6,.65,.45,.5,'#3c504a');
  for(const x of [1.2,3.5]){obstacles.push({x,z:-3.4,w:1.4,d:1.2});box(x,1.1,-3.95,1.3,2.2,.1,'#435b57');for(const side of [-.67,.67])box(x+side,1.1,-3.4,.08,2.2,1.2,'#435b57');for(let shelf=0;shelf<4;shelf++){box(x,.3+shelf*.52,-3.4,1.4,.07,1.2,'#d3c5a4');for(let i=0;i<4;i++)box(x-.45+i*.3,.48+shelf*.52,-3.1,.22,.3,.28,['#e0b55a','#b95848','#61937a','#c8c9a4'][(i+shelf)%4]);}}
  box(-2.4,.8,.3,2.2,1.6,.9,'#6e8b79',true);box(-2.4,1.63,.3,2.3,.06,1,'#dad5ba');board('ICE CREAM',-2.4,1.1,.77,1.8);
 }else if(kind==='cafe'){
  board('THE LONG WAY HOME',0,2.7,-5.76,4.2);box(0,.62,-4.4,6.4,1.24,1.2,'#846449',true);box(0,1.29,-4.4,6.6,.1,1.35,'#d2bea0');box(1.8,1.64,-4.4,1.1,.6,.65,'#7a8980');
  for(const x of [-2.5,2.5])for(const z of [-.8,2.5]){box(x,.76,z,1.5,.12,1.25,'#bc9160',true);box(x,.35,z,.15,.7,.15,'#3a5246');for(const offset of [-1,1]){box(x,.42,z+offset*.9,.8,.12,.65,'#657c64',true);box(x,.83,z+offset*1.15,.8,.8,.1,'#657c64');}box(x,.9,z,.2,.2,.2,'#e8debc');}
 }else if(kind==='lounge'){
  board('VALLEY LOUNGE',0,2.7,-5.76,3.8);box(-3,.48,-1.6,1.3,.96,3.6,'#596e60',true);box(-3.65,.95,-1.6,.3,.9,3.6,'#4a5b51');box(-2.98,.8,-3.25,1.4,.5,.3,'#4a5b51');box(-2.98,.8,.05,1.4,.5,.3,'#4a5b51');box(-.7,.4,-1.6,1.6,.8,2,'#a17b52',true);
  box(2.7,.45,-3.9,2.8,.9,1,'#7a6044',true);box(2.7,1.35,-3.9,1.7,1.05,.55,'#273b38');box(2.7,1.36,-3.6,1.4,.77,.03,'#7f9e8b');
  obstacles.push({x:3.7,z:1.3,w:1.3,d:2.3});box(4.3,1.2,1.3,.1,2.4,2.3,'#846e50');for(const z of [.15,2.45])box(3.7,1.2,z,1.3,2.4,.1,'#846e50');for(let row=0;row<4;row++){box(3.7,.07+row*.55,1.3,1.3,.08,2.3,'#846e50');for(let i=0;i<7;i++)box(3.7,.3+row*.55,.4+i*.28,1,.4,.16,['#8d4640','#b6aa78','#5e7d78'][i%3]);}
  box(.6,.012,1.7,4,.02,3.5,'#956454');
 }
 if(kind==='library'){
  board('VALLEY READING ROOM',0,2.7,-5.76,4);
  for(const x of [-3.4,3.4])for(const z of [-3,1]){
   obstacles.push({x,z,w:1.2,d:2.7});box(x,1.25,z+(x<0?-.0:0),1.2,2.5,.12,'#66533e');
   for(let row=0;row<4;row++){box(x,.15+row*.57,z+.25,1.2,.08,.7,'#9d8159');for(let i=0;i<6;i++)box(x-.46+i*.18,.4+row*.57,z+.25,.13,.4,.5,['#7a4840','#6a8274','#b39d60'][i%3]);}
  }
  box(0,.78,-1,2.5,.12,1.5,'#af8b59',true);for(const x of [-.7,.3])box(x,.88,-1,.6,.08,.8,'#b7c8a0');
 }else if(kind==='arcade'){
  board('VALLEY ARCADE · 02',0,2.7,-5.76,4);
  for(const x of [-3,-1,1,3]){box(x,.8,-3.8,1.4,1.6,1.1,'#303647',true);box(x,1.8,-4,1.4,.8,.65,'#45425b');box(x,1.8,-3.66,1.12,.6,.03,'#69b9b2');box(x,2.35,-4,1.45,.25,.7,'#b886b6');box(x,1.25,-3.2,1.4,.15,.6,'#6a6384');for(const dx of [-.35,.2,.4])box(x+dx,1.37,-3.15,.1,.12,.1,'#e7b45f');}
  for(const x of [-2.5,2.5]){box(x,.8,.4,1.6,1.6,2.4,'#8c4253',true);box(x,1.64,.4,1.5,.08,2.3,'#739f8d');}
 }else if(kind==='takeaway'){
  board('FISH & CHIPS',0,2.7,-5.76,4);box(0,.65,-2.8,7,1.3,1.2,'#acbbb0',true);box(0,1.33,-2.8,7.2,.08,1.4,'#d7d1b4');
  for(const x of [-2.6,0,2.6]){box(x,1.65,-4.8,1.7,.8,1,'#72837f',true);box(x,2.15,-4.8,1.8,.12,1.1,'#c5c8af');board('FRESH · HOT',x,2.55,-5.75,1.8);}
  for(const x of [-3.5,3.5])box(x,.5,1.5,1,1,3,'#966d48',true);
 }else if(kind==='workshop'){
  board('VALLEY CYCLE WORKS',0,2.7,-5.76,4);box(0,.9,-4.5,7,1.8,1.2,'#92714c',true);box(0,1.84,-4.5,7.2,.08,1.4,'#adb4a5');
  for(const x of [-3,3]){obstacles.push({x,z:0,w:1.1,d:2.8});for(const z of [-.9,.9]){const wheel=new T.Mesh(new T.TorusGeometry(.65,.075,6,20),material('#293d37'));wheel.rotation.y=Math.PI/2;wheel.position.set(x,.72,z);scene.add(wheel);}box(x,1.1,0,.15,.15,1.8,'#c58a46');box(x,1.55,-.3,.45,.12,.6,'#394941');}
  for(let i=0;i<10;i++)box(-3+i*.65,2.25,-5.7,.12,.5,.12,'#687f7d');
 }else if(kind==='music'){
  board('VALLEY RECORDS',0,2.7,-5.76,4);for(const x of [-2.8,2.8])for(const z of [-2.8,1.1]){box(x,.65,z,1.8,1.3,1.8,'#906749',true);for(let i=0;i<8;i++)box(x,1.38,z-.65+i*.18,1.45,.35,.08,['#bd7959','#4e716b','#c2b783'][i%3]);}
  for(const x of [-2,2]){box(x,.8,-4.9,1,1.6,.7,'#35443f',true);for(const y of [.45,1.1]){const speaker=new T.Mesh(new T.CylinderGeometry(.28,.28,.05,16),material('#1c2828'));speaker.rotation.x=Math.PI/2;speaker.position.set(x,y,-4.51);scene.add(speaker);}}
 }else if(kind==='florist'){
  board('VALLEY FLOWERS',0,2.7,-5.76,4);for(const x of [-3,3])for(const z of [-3,0,2.8]){box(x,.45,z,1.2,.9,1.2,'#a67c58',true);for(const dx of [-.3,0,.3]){box(x+dx,1.1,z,.05,.8,.05,'#5b825c');const flower=new T.Mesh(new T.IcosahedronGeometry(.22,0),material(dx<0?'#c785a0':'#e5c875'));flower.position.set(x+dx,1.55,z);scene.add(flower);}}
  box(0,.65,-4.4,2.8,1.3,1,'#8f9e79',true);
 }

 return {scene,obstacles,clear:(x,z)=>roomClear(x,z,obstacles)};
}

export function createInteriors({scene,world,camera,origin,button,hint,onEntrance}){
 const styles=[['dairy','Valley Dairy'],['cafe','The Long Way Home Café'],['lounge','Valley Lounge'],['library','Valley Reading Room'],['arcade','Valley Arcade'],['takeaway','Valley Fish & Chips'],['workshop','Valley Cycle Works'],['music','Valley Records'],['florist','Valley Flowers']];
 const reserved=new Set(supermarketSites.map(site=>matchSupermarket(site,world.buildings)?.id).filter(id=>id!==undefined));
 const entrances=selectEntrances(world,origin,styles.length,{exclude:reserved}).map((entry,i)=>({...entry,kind:styles[i][0],name:styles[i][1]}));
 const houseNames=['Rimu House','Kōwhai House','Tawa House','Kauri House','Rātā House','Mānuka House'];
 const houseExclude=new Set([...reserved,...entrances.map(e=>e.buildingId)]);for(const [i,entry]of selectHouseEntrances(world,origin,6,{exclude:houseExclude,avoid:entrances}).entries())entrances.push({...entry,kind:houseStyles[i%houseStyles.length][0],name:houseNames[i]});
 const view=new T.PerspectiveCamera(camera.fov,camera.aspect,.08,90);view.rotation.order='YXZ';let current=null,near=null,saved=null,clock=0,scanAt=0;const beacons=[],rooms=new Map();
 const areaIds=['lowerhutt','petone','daysbay','eastbourne','upperhutt','silverstream','trentham','totara-park','wellington-cbd','wellington-cuba','oriental-bay','newtown','karori','island-bay','miramar','kilbirnie'];
 const destinations=world.coast&&world.network?regionalDestinations(world):new Map();
 const areas=areaIds.map(id=>destinations.get(id)).filter(Boolean).map((p,i)=>({...p,styleOffset:i,added:0}));
 areas.push({name:'Northern Wainuiomata',x:220,z:-2350,styleOffset:2,added:0},{name:'Southern Wainuiomata',x:1100,z:1600,styleOffset:5,added:0});
 function addSupermarkets(buildings){
  for(const site of supermarketSites){if(Math.hypot(site.x-camera.position.x,site.z-camera.position.z)>2000||entrances.some(e=>e.storeId===site.id))continue;
   const building=matchSupermarket(site,buildings);if(!building)continue;
   const existing=entrances.find(e=>e.buildingId===building.id);if(existing)continue;
   const entry=selectEntrances({...world,buildings:[building]},site,1)[0];if(!entry)continue;
   const place={...entry,kind:'supermarket',name:site.name,storeId:site.id};entrances.push(place);addEntrance(place);
  }
 }
 function discover(){
  const buildings=[...world.buildings,...(world.region?.buildings||[])];addSupermarkets(buildings);const exclude=new Set([...entrances.map(e=>e.buildingId),...supermarketSites.map(site=>matchSupermarket(site,buildings)?.id).filter(id=>id!==undefined)]);
  for(const area of areas){if(area.added>=3||Math.hypot(area.x-camera.position.x,area.z-camera.position.z)>1800)continue;
   const candidates=selectEntrances({...world,buildings},area,9,{maxDistance:1000,exclude});
   for(const entry of candidates){if(area.added>=3)break;if(entrances.some(e=>Math.hypot(e.x-entry.x,e.z-entry.z)<35))continue;
    const [kind,label]=styles[(area.styleOffset+area.added*3)%styles.length];
    const place={...entry,kind,name:label+' · '+area.name};entrances.push(place);exclude.add(entry.buildingId);area.added++;addEntrance(place);
   }
  }
 }
 function addEntrance(entry){
  const door=new T.Group();door.position.set(entry.wallX,entry.doorBase??entry.y-2,entry.wallZ);door.rotation.y=Math.atan2(entry.nx,entry.nz);
  // A modest shop door with a different painted panel for each interior.
  if(!entry.residential){
  const colours=['#657e70','#826e56','#6d7780','#786c59','#68647e','#72857c','#686f61','#755f57','#788363'];
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=256;const c=canvas.getContext('2d');
  c.fillStyle=entry.kind==='supermarket'?'#677d64':colours[styles.findIndex(s=>s[0]===entry.kind)];c.fillRect(0,0,128,256);
  c.fillStyle='#344743';c.fillRect(12,14,104,146);c.fillStyle='#839a91';c.fillRect(18,20,92,130);
  c.fillStyle='#4a5c54';for(let y=176;y<238;y+=24)c.fillRect(14,y,100,2);
  c.fillStyle='#c2b9a0';c.fillRect(104,158,5,27);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.magFilter=T.NearestFilter;
  const panel=new T.Mesh(new T.PlaneGeometry(1.5,2.4),new T.MeshLambertMaterial({map:texture,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));panel.position.set(0,1.2,.015);door.add(panel);
  }
  const doorWidth=entry.doorWidth||1.5,doorHeight=entry.doorHeight||2.4;
  const frameMaterial=new T.MeshBasicMaterial({color:entry.residential?'#e9d6ac':'#b6c9a6',transparent:true,opacity:.18,depthWrite:false});
  for(const x of [-doorWidth/2-.04,doorWidth/2+.04]){const post=new T.Mesh(new T.BoxGeometry(.035,doorHeight+.05,.035),frameMaterial);post.position.set(x,(doorHeight+.05)/2,.04);door.add(post);}
  const lintel=new T.Mesh(new T.BoxGeometry(doorWidth+.115,.035,.035),frameMaterial);lintel.position.set(0,doorHeight+.05,.04);door.add(lintel);scene.add(door);beacons.push({door,frameMaterial,entry});onEntrance?.(entry,entrances.indexOf(entry));

 }
 for(const entry of entrances)addEntrance(entry);
 addSupermarkets(world.buildings);
 function exit(){if(!current)return false;camera.position.copy(saved);current=null;near=null;button.hidden=true;return true;}
 function interact(){if(current){if(view.position.z>4&&Math.abs(view.position.x)<1.5)return exit();return false;}if(!near)return false;saved=camera.position.clone();current=near;if(!rooms.has(current.kind))rooms.set(current.kind,buildRoom(current.kind));current.room=rooms.get(current.kind);view.position.set(0,1.7,4.3);return true;}
 button.onclick=interact;
 return {entrances,view,exit,interact,get active(){return !!current;},get name(){return current?.name;},get scene(){return current?.room.scene;},
 update(dt,{enabled,yaw,pitch,keys}){
  clock+=dt;if(clock>=scanAt&&!current){scanAt=clock+1;discover();}
  for(const b of beacons){const distance=Math.hypot(b.entry.x-camera.position.x,b.entry.z-camera.position.z);b.door.visible=!current&&distance<160;b.frameMaterial.opacity=.12+.13*(.5+.5*Math.sin(clock*2));}
  if(hint)hint.hidden=true;

  if(current){
   view.aspect=camera.aspect;view.updateProjectionMatrix();view.rotation.set(pitch,yaw,0);
   const f=Number(!!(keys.w||keys.arrowup))-Number(!!(keys.s||keys.arrowdown)),s=Number(!!(keys.d||keys.arrowright))-Number(!!(keys.a||keys.arrowleft)),length=Math.hypot(f,s)||1,speed=keys.shift?4:2.7;
   const dx=(-Math.sin(yaw)*f+Math.cos(yaw)*s)/length*speed*dt,dz=(-Math.cos(yaw)*f-Math.sin(yaw)*s)/length*speed*dt;
   // Substeps prevent walking through thin furniture at low frame rates.
   const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.12));for(let i=0;i<steps;i++){if(current.room.clear(view.position.x+dx/steps,view.position.z))view.position.x+=dx/steps;if(current.room.clear(view.position.x,view.position.z+dz/steps))view.position.z+=dz/steps;}
   const atDoor=view.position.z>4&&Math.abs(view.position.x)<1.5;button.hidden=!enabled||!atDoor;button.textContent='E · Return outside';
  }else{near=enabled?entrances.find(e=>Math.hypot(e.x-camera.position.x,e.z-camera.position.z)<3.5&&Math.abs(e.y-camera.position.y)<2):null;button.hidden=!near;button.textContent=near?'E · Enter '+near.name:'';}
 },drawMinimap(ctx,X,Y){for(const e of entrances){const x=X(e.x),y=Y(e.z);ctx.fillStyle='#152e28';ctx.fillRect(x-6,y-7,12,14);ctx.strokeStyle=e.residential?'#e6cd95':'#70ffd4';ctx.lineWidth=2;ctx.strokeRect(x-5,y-6,10,12);ctx.fillStyle=e.residential?'#e6cd95':'#70ffd4';ctx.fillRect(x+1,y,2,2);}}};
}
