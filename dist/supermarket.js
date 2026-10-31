import * as T from './vendor/three.js';

// Fictional large-store layout, shared between mapped supermarket locations.
export function buildSupermarket(){
 const scene=new T.Scene();scene.background=new T.Color('#bdc5b7');const obstacles=[],materials=new Map();
 const mat=c=>{if(!materials.has(c))materials.set(c,new T.MeshLambertMaterial({color:c}));return materials.get(c);};
 function box(x,y,z,w,h,d,c,solid=false){const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),mat(c));mesh.position.set(x,y,z);scene.add(mesh);if(solid)obstacles.push({x,z,w,d});return mesh;}
 function label(text,x,y,z,width=5){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const c=canvas.getContext('2d');c.fillStyle='#345c4e';c.fillRect(0,0,512,96);c.fillStyle='#f4ecd6';c.font='bold 32px monospace';c.textAlign='center';c.fillText(text,256,62,490);const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;const mesh=new T.Mesh(new T.PlaneGeometry(width,width*96/512),new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}));mesh.position.set(x,y,z);scene.add(mesh);return mesh;}
 box(0,-.13,-12,33,.25,36,'#c3c3af');box(0,5,-12,33,.2,36,'#dfdfcb');
 for(const x of [-16.4,16.4])box(x,2.5,-12,.2,5,36,'#d2d6c3');box(0,2.5,-29.9,33,5,.2,'#d2d6c3');
 for(const x of [-9,9])box(x,2.5,5.9,15,5,.2,'#b5c4b8');box(0,4.2,5.9,3,1.6,.2,'#b5c4b8');
 scene.add(new T.HemisphereLight('#fff9e9','#819182',2.3));
 for(const x of [-10,0,10])for(const z of [-24,-12,0])box(x,4.85,z,5,.08,.3,'#ffffe3');
 const colours=['#b75242','#d4b559','#6f9875','#e2d8b4','#678c9e','#a47c99'];
 for(const x of [-12,-8,-4,4,8,12]){
  for(const z of [-19,-10]){
   obstacles.push({x,z,w:1.3,d:6.5});box(x,1.2,z,.15,2.4,6.5,'#78877e');
   for(let row=0;row<4;row++){box(x,.25+row*.55,z,1.3,.08,6.5,'#c4caba');for(const side of [-1,1])for(let i=0;i<13;i++)box(x+side*.4,.48+row*.55,z-2.9+i*.48,.4,.35,.35,colours[(i+row)%colours.length]);}
  }
  label('GROCERIES',x,3.2,-7,2.8);
 }
 for(const x of [-11,-6,6,11]){box(x,.9,.2,2,1.8,3.6,'#668a76',true);box(x,1.85,.2,2.1,.1,3.7,'#c3c8b6');box(x,1.93,.8,1.6,.06,1.6,'#35443f');box(x+.4,2.2,-.8,.55,.45,.35,'#455954');label('CHECKOUT',x,3,1.7,2.8);}
 for(const x of [-11,-6,0,6,11]){box(x,.65,-26,3.2,1.3,2,'#96764e',true);for(let i=0;i<5;i++)for(let j=0;j<3;j++){const fruit=new T.Mesh(new T.IcosahedronGeometry(.2,0),mat(colours[(i+j)%3]));fruit.position.set(x-1.1+i*.55,1.4,-26.5+j*.5);scene.add(fruit);}}
 for(const x of [-15.7,15.7])for(const z of [-20,-12]){box(x,1.3,z,1,2.6,5,'#8caaa3',true);for(let i=0;i<5;i++)box(x+(x<0?.52:-.52),1.5,z-2+i,.025,1.9,.035,'#d0dace');}
 label('FRESH PRODUCE',0,3.4,-29.6,7);label('SUPERMARKET',0,3.8,-3,8);label('EXIT · E',0,2.8,5.72,2).rotation.y=Math.PI;
 const clear=(x,z)=>x>-16.02&&x<16.02&&z>-29.52&&z<5.42&&!obstacles.some(b=>x>b.x-b.w/2-.28&&x<b.x+b.w/2+.28&&z>b.z-b.d/2-.28&&z<b.z+b.d/2+.28);
 return {scene,obstacles,clear};
}

export function matchSupermarket(site,buildings){
 if(site.buildingId!==undefined)return buildings.find(b=>b.id===site.buildingId&&b.faces?.length&&!b.railCanopy);
 let best=null;
 for(const b of buildings){const ring=b.rings?.[0];if(!ring||b.railCanopy)continue;
  const xs=ring.map(p=>p[0]),zs=ring.map(p=>p[1]);if(site.x<Math.min(...xs)-35||site.x>Math.max(...xs)+35||site.z<Math.min(...zs)-35||site.z>Math.max(...zs)+35)continue;
  let inside=false,area=0,distance=Infinity;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
   const a=ring[j],c=ring[i],dx=c[0]-a[0],dz=c[1]-a[1];area+=a[0]*c[1]-c[0]*a[1];
   if((a[1]>site.z)!==(c[1]>site.z)&&site.x<(c[0]-a[0])*(site.z-a[1])/(c[1]-a[1])+a[0])inside=!inside;
   const t=Math.max(0,Math.min(1,((site.x-a[0])*dx+(site.z-a[1])*dz)/(dx*dx+dz*dz||1)));distance=Math.min(distance,Math.hypot(site.x-a[0]-t*dx,site.z-a[1]-t*dz));
  }
  if(Math.abs(area)/2<300||!b.faces?.length)continue;
  const score=inside?0:distance;if(score>35)continue;
  if(!best||score<best.score)best={building:b,score};
 }
 return best?.building;
}
