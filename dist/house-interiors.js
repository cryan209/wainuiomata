import * as T from './vendor/three.js';
import {planLargeHouseOpenings} from './large-house-facades.js?v=release-1';
export const houseStyles=[['house-family','Rimu House'],['house-bungalow','Kōwhai House'],['house-retro','Tawa House']];
export function selectHouseEntrances(world,origin,limit=6,{exclude=new Set(),maxDistance=Infinity,avoid=[]}={}){
 if(limit<=0)return [];
 const result=[],buildings=world.buildings.filter(b=>b.profile?.largeHouse&&!b.profile.shop&&!b.profile.industrial&&!exclude.has(b.id)).sort((a,b)=>Math.hypot(a.profile.x-origin.x,a.profile.z-origin.z)-Math.hypot(b.profile.x-origin.x,b.profile.z-origin.z));
 for(const b of buildings){if(Math.hypot(b.profile.x-origin.x,b.profile.z-origin.z)>maxDistance)continue;
  const door=planLargeHouseOpenings(b,{ground:world.ground||world.walkHeight,datum:world.meta?.originElevation||0}).find(o=>o.kind==='door');if(!door)continue;
  const {nx,nz}=door.face;
  for(const offset of [1.8,2.4,3.2]){const x=door.x+nx*offset,z=door.z+nz*offset,floor=world.walkHeight(x,z),y=floor+2;
   if(!world.free(x,z,y)||world.water?.at(x,z)?.depth>.25||Math.abs(floor-door.bottom)>.65||Math.abs(world.walkHeight(x+nx*.5,z+nz*.5)-floor)>.4||avoid.some(e=>Math.hypot(e.x-x,e.z-z)<8)||result.some(e=>Math.hypot(e.x-x,e.z-z)<65))continue;
   result.push({x,z,y,wallX:door.x+nx*.075,wallZ:door.z+nz*.075,nx,nz,buildingId:b.id,residential:true,doorBase:door.bottom,doorWidth:door.width,doorHeight:door.height});break;
  }
  if(result.length>=limit)break;
 }
 return result;
}
export function buildHouse(kind='house-family'){
 const themes={
  'house-family':{wall:'#e0d7bd',accent:'#688777',sofa:'#6d8170',rug:'#9c6659',wood:'#9c7951'},
  'house-bungalow':{wall:'#e7dcc5',accent:'#799396',sofa:'#6e8d9a',rug:'#b19164',wood:'#aa8758'},
  'house-retro':{wall:'#ddd0ae',accent:'#9a8059',sofa:'#9b7350',rug:'#87764d',wood:'#8a6846'}
 },theme=themes[kind]||themes['house-family'],scene=new T.Scene(),obstacles=[],materials=new Map();scene.background=new T.Color('#cad1c5');
 function texture(paint,repeat=1){if(typeof document==='undefined')return null;const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');paint(ctx);const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;map.repeat.set(repeat,repeat);map.anisotropy=4;return map;}
 const floorMap=texture(c=>{c.fillStyle=theme.wood;c.fillRect(0,0,256,256);for(let x=0;x<256;x+=24){c.fillStyle='#43382c60';c.fillRect(x,0,1,256);for(let y=(x%48)*2;y<256;y+=96)c.fillRect(x,y,24,1);for(let i=0;i<14;i++){c.fillStyle=i%2?'#e2bc7c20':'#422d2215';c.fillRect(x+3+i%17,(i*53+x)%256,1,15+i%7)}}},5);
 const fabric=texture(c=>{c.fillStyle=theme.sofa;c.fillRect(0,0,256,256);for(let i=0;i<256;i+=3){c.fillStyle='#e6e5c415';c.fillRect(i,0,1,256);c.fillStyle='#172d2914';c.fillRect(0,i,256,1)}},2);
 const woodMat=new T.MeshLambertMaterial({map:floorMap,color:'#e0c69d'}),sofaMat=new T.MeshLambertMaterial({map:fabric,color:theme.sofa});
 const mat=c=>{if(c?.isMaterial)return c;if(!materials.has(c))materials.set(c,new T.MeshLambertMaterial({color:c}));return materials.get(c)};
 function box(x,y,z,w,h,d,c,solid=false){const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),mat(c));mesh.position.set(x,y,z);scene.add(mesh);if(solid)obstacles.push({x,z,w,d});return mesh}
 function cylinder(x,y,z,r,h,c){const mesh=new T.Mesh(new T.CylinderGeometry(r,r,h,16),mat(c));mesh.position.set(x,y,z);scene.add(mesh);return mesh}
 const wall=(x,z,w,d)=>box(x,1.38,z,w,2.76,d,theme.wall,true);
 box(0,-.09,-.55,12,.18,13.7,woodMat);box(0,2.83,-.55,12,.14,13.7,'#ece7d7');
 wall(-5.9,-.55,.2,13.7);wall(5.9,-.55,.2,13.7);wall(0,-7.3,12,.2);
 wall(-3.28,6.2,5.44,.2);wall(3.28,6.2,5.44,.2);box(0,2.46,6.2,2,.6,.2,theme.wall);
 box(0,1.08,6.16,1.04,2.16,.10,theme.wood);box(0,1.63,6.095,.76,.62,.025,'#96aaa2');box(.36,1.03,6.075,.035,.15,.035,'#c7b076');for(const x of [-.565,.565])box(x,1.12,6.08,.065,2.24,.09,'#eee4cf');box(0,.012,5.2,1.10,.022,.8,'#6f715c');
 // A central passage joins living/dining, two bedrooms and a bathroom.
 function partition(x,openings){let start=-7.2;for(const [lo,hi]of openings){if(lo>start)wall(x,(lo+start)/2,.14,lo-start);box(x,2.47,(lo+hi)/2,.14,.58,hi-lo,theme.wall);for(const z of [lo,hi])box(x,1.08,z,.20,2.16,.065,'#ede6d3');start=hi}if(start<6.1)wall(x,(start+6.1)/2,.14,6.1-start)}
 partition(-1.12,[[-2.9,-1.5],[1.45,4.35]]);partition(1.12,[[-5.6,-4.15],[-2.3,-.8],[1.45,4.35]]);
 wall(-3.52,0,4.65,.14);wall(3.52,0,4.65,.14);wall(3.52,-3.25,4.65,.14);
 for(const x of [-5.76,5.76])box(x,.07,-.55,.07,.14,13.45,'#f0e4cc');
 for(const x of [-1.22,1.22])for(const [z,d]of [[5.22,1.75],[.7,1.2],[-3.5,.8],[-6.5,1.15]])box(x,.07,z,.045,.14,d,'#ece4d1');
 // Rugs and room-specific floor finishes are flush and remain passable.
 box(-3.5,.009,3.05,3.6,.016,3.7,theme.rug);box(0,.011,.05,1.25,.018,9.4,'#9b7e5c');
 box(3.5,.011,-5.25,4.55,.018,3.85,'#adb8b2');for(let x=1.4;x<5.7;x+=.5)box(x,.023,-5.25,.012,.005,3.85,'#d4d7c9');for(let z=-7;z<-3.3;z+=.5)box(3.5,.023,z,4.55,.005,.012,'#d4d7c9');
 // Living room: fabric sofa, cushions, coffee table, books and a period CRT television.
 box(-5.05,.35,3.05,1.05,.7,2.8,sofaMat,true);box(-5.5,.83,3.05,.22,.9,2.8,sofaMat);for(const z of [1.7,4.4])box(-5,.66,z,1.1,.62,.18,sofaMat);for(const z of [2.4,3.55])box(-4.94,.75,z,.72,.17,1.02,theme.accent);
 box(-3.25,.42,3.05,1.05,.12,1.7,theme.wood,true);for(const x of [-3.62,-2.88])for(const z of [2.5,3.6])box(x,.2,z,.07,.4,.07,'#544735');box(-3.25,.51,2.85,.42,.06,.55,'#d5b47c');cylinder(-3.3,.57,3.4,.10,.16,'#e4dfd1');
 box(-1.65,.35,.75,.78,.7,1.15,theme.wood,true);box(-1.64,1.05,.75,.68,.65,.85,'#323c3a');box(-1.275,1.08,.75,.035,.47,.62,'#708f90');
 for(let i=0;i<5;i++)box(-1.24,.84,.48+i*.1,.02,.07,.025,'#bfc6b5');
 // Kitchen and dining nook.
 box(5.25,.45,3.1,.88,.9,5.2,'#d4ceb5',true);box(5.2,.94,3.1,1.03,.08,5.28,'#7b8883');
 for(const z of [1.05,2.15,3.25,4.35,5.4]){box(4.79,.48,z,.025,.72,.96,theme.accent);box(4.76,.68,z,.04,.035,.24,'#c3c9b8')}
 box(5.17,1.003,2.35,.60,.035,.72,'#aeb9b7');box(5.17,1.026,2.35,.46,.02,.57,'#5b6d6b');cylinder(5.42,1.15,2.35,.028,.28,'#a7b4b0');
 box(5.17,1.004,4.8,.68,.032,.78,'#e3e0ce');for(const x of [4.99,5.34])for(const z of [4.6,5.0])cylinder(x,1.03,z,.105,.025,'#343e3b');
 box(4.785,.48,4.8,.03,.53,.64,'#3b4845');box(4.76,.48,4.8,.024,.34,.48,'#202e2c');
 box(2.0,1.02,.67,1.1,2.04,.94,'#d8ded3',true);box(1.98,1.02,1.16,.94,.025,.025,'#7e9089');box(2.39,1.3,1.18,.035,.42,.035,'#70847d');box(1.8,1.53,1.19,.25,.24,.012,'#dbbf76');
 box(3.05,.76,3.2,1.4,.12,1.45,theme.wood,true);for(const x of [2.55,3.55])for(const z of [2.7,3.7])box(x,.36,z,.08,.72,.08,theme.wood);
 for(const x of [2.02,4.08]){box(x,.44,3.2,.58,.12,.65,theme.accent,true);box(x,.86,3.5,.6,.82,.09,theme.accent);for(const dx of [-.22,.22])for(const dz of [-.23,.23])box(x+dx,.19,3.2+dz,.05,.38,.05,theme.wood)}
 cylinder(3.05,.9,3.2,.17,.15,'#d1b78b');
 // Bedrooms, with bedside cabinets, wardrobes and a writing desk.
 box(-3.5,.25,-5.05,2.05,.5,2.9,theme.wood,true);box(-3.5,.57,-5.05,2.0,.25,2.83,'#ddd9c6');box(-3.5,.73,-4.65,2.02,.10,2.0,theme.accent);box(-3.5,.7,-6.15,1.7,.22,.55,'#ece5d5');box(-3.5,.7,-6.57,2.2,1.4,.10,theme.wood);
 for(const x of [-4.9,-2.08]){box(x,.42,-6.0,.58,.84,.6,theme.wood,true);cylinder(x,.98,-6,.15,.26,'#e0cda4')}
 box(-5.25,1.15,-1.55,.85,2.3,2.3,theme.wood,true);for(const z of [-2.1,-1])box(-4.79,1.25,z,.035,.18,.035,'#d1c9b0');
 box(4.6,.3,-1.58,1.5,.6,2.45,theme.wood,true);box(4.6,.66,-1.58,1.5,.18,2.4,'#d8d1b9');box(4.6,.79,-1.25,1.52,.08,1.7,theme.rug);box(4.6,.79,-2.42,1.2,.18,.45,'#e3e4d6');
 box(2.3,.76,-.58,1.6,.10,.72,theme.wood,true);box(2.3,.84,-.58,.48,.035,.37,'#e6dbc1');box(2.3,1.0,-.74,.12,.28,.10,'#7b8b78');
 // Bathroom: shower tray, basin, mirror and toilet.
 box(5,.09,-6.35,1.38,.18,1.45,'#e2e4da',true);for(const x of [4.3,5.7])box(x,1.05,-6.35,.035,2.1,1.45,'#9fb7b2');box(5,2.13,-6.35,1.43,.05,1.5,'#d3d8ca');
 box(5.32,.43,-4.2,.74,.86,1.05,'#d7d8c4',true);box(5.27,.91,-4.2,.89,.10,1.12,'#e9e9df');box(5.28,.97,-4.2,.5,.03,.68,'#809992');box(5.74,1.67,-4.2,.026,.85,.76,'#9ab5b5');
 box(3.1,.25,-6.6,.65,.5,.83,'#e7e7da',true);box(3.1,.6,-6.95,.62,.7,.2,'#e4e6d9');cylinder(3.1,.53,-6.46,.31,.08,'#d7dbd0');
 // Daylit window panels, curtain rails, framed hill scenes and warm domestic lamps.
 for(const [x,z]of [[-5.77,3.0],[-5.77,-4.5],[5.77,3.1],[5.77,-1.5]]){box(x,1.72,z,.035,1.35,1.9,'#91b9bc');for(const edge of [-1,1])box(x*.998,1.72,z+edge*.98,.075,1.48,.10,'#e8e3cf');box(x*.998,1.72,z,.075,.07,1.98,'#e7dfc9');box(x*.998,2.47,z,.12,.07,2.3,theme.wood);for(const edge of [-1,1])box(x*.994,1.68,z+edge*.93,.10,1.65,.25,theme.accent)}
 for(const z of [4.8,-.6,-5.8]){box(0,2.71,z,.45,.08,.45,'#ece2c2');const l=new T.PointLight('#ffdfad',9,8,2);l.position.set(0,2.4,z);scene.add(l)}
 const loungeLight=new T.PointLight('#ffe4b8',9,7,2);loungeLight.position.set(-3.5,2.3,3.1);scene.add(loungeLight);scene.add(new T.HemisphereLight('#fff3d4','#818d7c',2.25));
 for(const z of [1,-3.5]){box(-1.028,1.65,z,.06,.85,.65,theme.wood);box(-.987,1.65,z,.015,.66,.47,'#9da98a');box(-.975,1.55,z,.018,.18,.45,'#55756a')}
 box(.68,.63,5.15,.46,1.26,.85,theme.wood,true);cylinder(.68,1.4,5.1,.16,.28,'#ae7d5c');const leaves=new T.Mesh(new T.IcosahedronGeometry(.27,1),mat('#63856a'));leaves.position.set(.68,1.75,5.1);scene.add(leaves);
 const clear=(x,z)=>x>-5.8+.28&&x<5.8-.28&&z>-7.2+.28&&z<6.1-.28&&!obstacles.some(b=>x>b.x-b.w/2-.28&&x<b.x+b.w/2+.28&&z>b.z-b.d/2-.28&&z<b.z+b.d/2+.28);
 return {scene,obstacles,clear,kind,rooms:['Entry hall','Living room','Kitchen / dining','Main bedroom','Second bedroom','Bathroom']};
}
