import * as T from './vendor/three.js';
// Anchors use the shipped OSM Pukeatua parking aisle and named lookout paths.
// Furniture is illustrative; this is not a surveyed reconstruction of each site.
export const LOOKOUTS=[
 {id:'pukeatua',name:'Wainuiomata Hill · Pukeatua Lookout',x:-1851.5,z:-2194.8,view:{x:-5400,z:-4200},way:'16868680',description:'Over Seaview and Petone to Wellington Harbour.',source:'https://www.wellingtonnz.com/visit/trails/waiu-park'},
 {id:'kiwanis',name:'Kiwanis Lookout',x:1204.54,z:2211.34,view:{x:0,z:0},way:'234502136',description:'A hilltop pause above the Wainuiomata valley.',source:'https://ttc.org.nz/TararuaHistory/WainuiomataPlaceNameOrigins'},
 {id:'centenary',name:'Centenary Lookout · Korokoro',x:-6294.83,z:-5199.37,view:{x:-4500,z:-3600},way:'199293308',description:'Look back across Petone and the harbour.',source:'https://www.openstreetmap.org/way/199293308'}
];
export function lookoutDestinations(){return LOOKOUTS.map(p=>['lookout-'+p.id,{...p,yaw:Math.atan2(p.x-p.view.x,p.z-p.view.z),pitch:-.06,lookout:true}])}
export function createLookouts({scene,world,onDiscover=()=>{}}){
 let saved=[];try{const value=JSON.parse(localStorage.getItem('wainui-lookouts')||'[]');if(Array.isArray(value))saved=value}catch{}
 const found=new Set(saved.filter(id=>LOOKOUTS.some(p=>p.id===id))),furniture=[];
 const wood=new T.MeshLambertMaterial({color:'#75634a'}),metal=new T.MeshLambertMaterial({color:'#354d4c'}),groups=[];
 function box(group,mat,x,y,z,w,h,d){const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);mesh.castShadow=true;group.add(mesh)}
 for(const p of LOOKOUTS){const group=new T.Group();const y=world.walkHeight(p.x,p.z);group.position.set(p.x,y,p.z);group.rotation.y=Math.atan2(p.x-p.view.x,p.z-p.view.z);scene.add(group);groups.push(group);
  // Put the bench behind the arrival point, leaving the view and mapped path open.
  box(group,wood,0,.5,3,1.8,.10,.42);box(group,wood,0,.88,3.18,1.8,.45,.07);for(const x of [-.65,.65])box(group,metal,x,.25,3,.06,.5,.34);
  box(group,metal,-2,.7,.5,.065,1.4,.065);const sign=new T.Mesh(new T.PlaneGeometry(1.3,.5),new T.MeshBasicMaterial({color:'#b9c9ac',side:T.DoubleSide}));sign.position.set(-2,1.38,.5);group.add(sign);
  if(typeof document!=='undefined'){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=192;const c=canvas.getContext('2d');c.fillStyle='#223f3e';c.fillRect(0,0,512,192);c.fillStyle='#d8e6b4';c.font='bold 24px sans-serif';c.fillText('LOOKOUT / TIROHANGA',22,42);c.font='19px sans-serif';const title=p.name.split(' · ');title.forEach((t,i)=>c.fillText(t,22,84+i*27));c.font='15px sans-serif';c.fillText('Take a moment. Take in the valley.',22,166);const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;sign.material.map=texture;sign.material.needsUpdate=true}
  const v=new T.Vector3(0,0,3).applyAxisAngle(new T.Vector3(0,1,0),group.rotation.y);furniture.push({x:p.x+v.x,z:p.z+v.z,y});
 }
 return {
  get count(){return found.size},
  free(x,z,y){return !furniture.some(p=>Math.hypot(p.x-x,p.z-z)<1.1&&(y===undefined||Math.abs(y-p.y)<3))},
  update({position,active,onFoot}){groups.forEach((g,i)=>g.visible=Math.hypot(LOOKOUTS[i].x-position.x,LOOKOUTS[i].z-position.z)<1600);if(!active||!onFoot)return;for(const p of LOOKOUTS)if(!found.has(p.id)&&Math.hypot(position.x-p.x,position.z-p.z)<18&&Math.abs(position.y-world.walkHeight(p.x,p.z))<5){found.add(p.id);try{localStorage.setItem('wainui-lookouts',JSON.stringify([...found]))}catch{}onDiscover(p,found.size)}},
  drawMinimap(c,X,Y){for(const p of LOOKOUTS){const x=X(p.x),y=Y(p.z);if(x<0||x>210||y<0||y>170)continue;c.strokeStyle=found.has(p.id)?'#a5caaa':'#f2c77b';c.lineWidth=2;c.beginPath();c.moveTo(x-5,y+4);c.lineTo(x,y-5);c.lineTo(x+5,y+4);c.closePath();c.stroke()}}
 };
}
// Preserve a modest foreground opening so generated trees do not fill the viewpoint.
export function lookoutVegetationClear(x,z,radius=0){return !LOOKOUTS.some(p=>{const dx=x-p.x,dz=z-p.z,len=Math.hypot(p.view.x-p.x,p.view.z-p.z),vx=(p.view.x-p.x)/len,vz=(p.view.z-p.z)/len,along=dx*vx+dz*vz,side=Math.abs(dx*vz-dz*vx);return Math.hypot(dx,dz)<12+radius||along>0&&along<55+radius&&side<10+along*.22+radius})}
