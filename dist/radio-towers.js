import * as T from './vendor/three.js';
import {RADIO_TOWER_SITES} from './radio-tower-sites.js';
export {RADIO_TOWER_SITES};
// Batch each detailed tower into one vertex-colour mesh; distant silhouettes use lines.
export function towerGeometry(site,footingDepths=[]){
 const positions=[],normals=[],colours=[],lines=[],steel=new T.Color('#b3bab7'),red=new T.Color('#b95847'),white=new T.Color('#e0e0d4'),concrete=new T.Color('#777c74'),dark=new T.Color('#434d4c'),up=new T.Vector3(0,1,0),body=site.height-site.antenna;
 function add(geometry,colour){const g=geometry.index?geometry.toNonIndexed():geometry;positions.push(...g.attributes.position.array);normals.push(...g.attributes.normal.array);for(let i=0;i<g.attributes.position.count;i++)colours.push(colour.r,colour.g,colour.b);if(g!==geometry)g.dispose();geometry.dispose()}
 function colour(y){return site.paint==='red-white'?(Math.floor(y/7)%2?white:red):steel}
 function beam(a,b,r=.10,c=steel,silhouette=false){const from=new T.Vector3(...a),to=new T.Vector3(...b),g=new T.CylinderGeometry(r,r,from.distanceTo(to),5);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(up,to.clone().sub(from).normalize()));g.translate(...from.clone().add(to).multiplyScalar(.5).toArray());add(g,c);if(silhouette)lines.push(...a,...b)}
 function box(x,y,z,w,h,d,c){const g=new T.BoxGeometry(w,h,d);g.translate(x,y,z);add(g,c)}
 const half=y=>site.width/2*(.18+.82*(1-Math.min(1,y/body))**1.45),corners=[[-1,-1],[1,-1],[1,1],[-1,1]],levels=Math.ceil(body/6),dy=body/levels;
 corners.forEach(([sx,sz],i)=>{const depth=Math.max(.65,footingDepths[i]||0);box(sx*half(0),-depth/2,sz*half(0),1.4,depth,1.4,concrete)});
 for(let i=0;i<levels;i++){
  const y=i*dy,top=(i+1)*dy,c=colour(y);
  for(let j=0;j<4;j++){const [sx,sz]=corners[j],[nx,nz]=corners[(j+1)%4],a=[sx*half(y),y,sz*half(y)],b=[sx*half(top),top,sz*half(top)],q=[nx*half(y),y,nz*half(y)],r=[nx*half(top),top,nz*half(top)];beam(a,b,Math.max(.09,site.width*.012),c,true);beam(a,q,.07,c,true);beam(a,r,.055,c,true);beam(q,b,.055,c,true)}
 }
 // Service platforms, handrails and a continuous access ladder.
 for(const fraction of [.34,.60,.83]){const y=body*fraction,h=half(y)+.65;box(0,y,0,h*2,.12,h*2,dark);for(let j=0;j<4;j++){const [sx,sz]=corners[j],[nx,nz]=corners[(j+1)%4];beam([sx*h,y+1,sz*h],[nx*h,y+1,nz*h],.045,steel);beam([sx*h,y,sz*h],[sx*h,y+1,sz*h],.045,steel)}}
 for(const x of [-.23,.23])beam([x,0,half(0)+.15],[x,body,half(body)+.15],.035,dark);
 for(let y=.35;y<body;y+=.65)beam([-.23,y,half(y)+.15],[.23,y,half(y)+.15],.025,steel);
 // Microwave dishes and rectangular antenna panels have different silhouettes.
 for(let i=0;i<5;i++){const y=body*(.25+i*.115),side=i%2?1:-1,r=site.id==='kaukau'?1.7:1.0,x=side*(half(y)+r*.65),z=i%3-1;beam([side*half(y),y,z],[x,y,z],.08,steel);const g=new T.SphereGeometry(r,12,6,0,Math.PI*2,0,Math.PI/2);g.rotateZ(side*-Math.PI/2);g.translate(x,y,z);add(g,white);const rim=new T.TorusGeometry(r,.055,5,16);rim.rotateY(Math.PI/2);rim.translate(x,y,z);add(rim,dark)}
 for(const side of [-1,1])for(let i=0;i<3;i++){const y=body*.78+i*3;box(side*(half(y)+.4),y,0,.24,2.1,.7,white)}
 const mastRadius=site.id==='kaukau'?.85:.22;
 for(let i=0;i<site.antenna;i+=2){const height=Math.min(2,site.antenna-i),g=new T.CylinderGeometry(mastRadius*.8,mastRadius,height,8);g.translate(0,body+i+height/2,0);add(g,Math.floor(i/4)%2?red:white)}
 lines.push(0,body,0,0,site.height,0);
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colours,3));geometry.computeBoundingSphere();geometry.computeBoundingBox();
 const silhouette=new T.BufferGeometry();silhouette.setAttribute('position',new T.Float32BufferAttribute(lines,3));silhouette.computeBoundingSphere();
 return {geometry,silhouette};
}
export function towerDestinations(world){return RADIO_TOWER_SITES.map(site=>{const distance=site.height*1.25,x=site.x+distance*.7,z=site.z+distance*.7,base=world.ground(site.x,site.z),eye=world.walkHeight(x,z)+65,pitch=Math.atan2(base+site.height*.47-eye,distance);return ['tower-'+site.id,{name:site.name+' · Tower view',x,z,yaw:Math.PI/4,pitch,drone:true}]})}
export function createRadioTowers({scene,world}){
 const material=new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide}),lineMaterial=new T.LineBasicMaterial({color:'#afb6b4'}),entries=RADIO_TOWER_SITES.map(site=>{const feet=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([sx,sz])=>world.ground(site.x+sx*site.width/2,site.z+sz*site.width/2)),y=Math.max(world.ground(site.x,site.z),...feet),meshes=towerGeometry(site,feet.map(h=>y-h+.4)),near=new T.Mesh(meshes.geometry,material),far=new T.LineSegments(meshes.silhouette,lineMaterial);for(const object of [near,far]){object.position.set(site.x,y,site.z);object.name=site.name;object.userData.radioTower=site.id;scene.add(object)}return{site,near,far,y}});
 const beaconData=new Float32Array(entries.flatMap(e=>[e.site.x,e.y+e.site.height+.9,e.site.z])),beaconGeometry=new T.BufferGeometry();beaconGeometry.setAttribute('position',new T.BufferAttribute(beaconData,3));const beacons=new T.Points(beaconGeometry,new T.PointsMaterial({color:'#ff4136',toneMapped:false,size:4,sizeAttenuation:false,transparent:true,opacity:.9,depthWrite:false}));beacons.name='Transmitter obstruction lights';beacons.frustumCulled=false;scene.add(beacons);
 return {entries,
  update(position,night=0){for(const entry of entries){const d=Math.hypot(position.x-entry.site.x,position.z-entry.site.z);entry.near.visible=d<2200;entry.far.visible=d>=2200&&d<26000}beacons.visible=night>.25;beacons.material.opacity=Math.min(.95,night)},
  free(x,z,y){return !entries.some(e=>{if(y!==undefined&&(y<e.y-2||y>e.y+e.site.height+2))return false;const above=Math.max(0,(y??e.y)-e.y),body=e.site.height-e.site.antenna;if(above>body)return Math.hypot(x-e.site.x,z-e.site.z)<1;const half=e.site.width/2*(.18+.82*(1-Math.min(1,above/body))**1.45);return [-1,1].some(sx=>[-1,1].some(sz=>Math.hypot(x-e.site.x-sx*half,z-e.site.z-sz*half)<.8))})},
  drawMinimap(c,X,Y){for(const {site} of entries){const x=X(site.x),y=Y(site.z);if(x<0||x>210||y<0||y>170)continue;c.strokeStyle='#d4c0ec';c.lineWidth=1.5;c.beginPath();c.moveTo(x-4,y+5);c.lineTo(x,y-6);c.lineTo(x+4,y+5);c.moveTo(x-2,y+1);c.lineTo(x+2,y+1);c.stroke();c.beginPath();c.arc(x,y-4,6,Math.PI*1.15,Math.PI*1.85);c.stroke()}}
 };
}
