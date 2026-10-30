import * as T from './vendor/three.js';
import {withVehicleInterior,instrumentTexture} from './vehicle-interiors.js?v=cockpit-breakaway-52';
import {realisticCarGeometry,vehicleEnvironment,vehiclePlateTexture,vehicleLensTexture} from './realistic-vehicles.js?v=cabin-31';
// Era-inspired silhouettes in metres. Geometry is shared by each instanced model/material batch.
export const CLASSICS=[
 {id:'commodore',name:'Holden Commodore VN',width:1.81,length:4.85,height:1.40,wheelbase:2.73,cabin:[-1.10,-.57,.87,1.55],roof:1.43,body:.88,lights:'wide',paint:['#8d2637','#e7e4dc','#284843','#29364e'],spoiler:true},
 {id:'falcon',name:'Ford Falcon EB',width:1.86,length:4.95,height:1.43,wheelbase:2.79,cabin:[-1.12,-.51,.91,1.57],roof:1.46,body:.91,lights:'wide',paint:['#41616c','#e1d9bf','#6f2c38','#b6bcc0']},
 {id:'skyline',name:'Nissan Skyline R32',width:1.70,length:4.55,height:1.34,wheelbase:2.61,cabin:[-1.00,-.49,.72,1.26],roof:1.35,body:.82,lights:'round',paint:['#38404b','#b6bcc2','#edece4','#283957'],spoiler:true},
 {id:'corolla',name:'Toyota Corolla AE92 hatch',width:1.66,length:4.04,height:1.38,wheelbase:2.43,cabin:[-.93,-.48,.96,1.65],roof:1.42,body:.85,lights:'small',paint:['#d9d5c9','#8b343b','#627c85','#b4b8ad'],hatch:true},
 {id:'hilux',name:'Toyota Hilux LN106',width:1.69,length:4.70,height:1.78,wheelbase:2.85,cabin:[-1.14,-.89,.18,.29],roof:1.83,body:1.03,lights:'square',paint:['#d9d5c4','#a64238','#405d72','#e6e6dd'],ute:true},
 {id:'legacy',name:'Subaru Legacy BG wagon',width:1.69,length:4.60,height:1.47,wheelbase:2.63,cabin:[-1.03,-.52,1.47,1.94],roof:1.50,body:.85,lights:'small',paint:['#35554e','#b8bbc0','#e5e1d8','#35465e'],wagon:true},
 {id:'magna',name:'Mitsubishi Magna TR wagon',width:1.78,length:4.80,height:1.49,wheelbase:2.72,cabin:[-1.10,-.57,1.67,2.07],roof:1.51,body:.91,lights:'wide',paint:['#bcb7aa','#d8d5c9','#7d9295','#8c4545'],wagon:true,plain:true},
 {id:'lancer',name:'Mitsubishi Lancer wagon',width:1.67,length:4.31,height:1.46,wheelbase:2.50,cabin:[-.93,-.49,1.48,1.91],roof:1.48,body:.86,lights:'small',paint:['#d9d9cc','#a8adb0','#697e83','#b1a28c'],wagon:true,plain:true,verticalRear:true},
 {id:'corolla-wagon',name:'Toyota Corolla AE100 wagon',width:1.68,length:4.27,height:1.46,wheelbase:2.46,cabin:[-.96,-.53,1.43,1.89],roof:1.47,body:.87,lights:'small',paint:['#d7d2be','#c0c4c3','#e4e3d9','#738c87'],wagon:true,plain:true,verticalRear:true},
 {id:'caldina',name:'Toyota Caldina T190 wagon',width:1.70,length:4.55,height:1.48,wheelbase:2.58,cabin:[-1.02,-.55,1.54,1.99],roof:1.50,body:.89,lights:'wide',paint:['#b9bfc0','#dbd8ce','#4f6862','#788694'],wagon:true,plain:true},
 {id:'hiace',name:'Toyota Hiace van',width:1.79,length:4.70,height:2.05,wheelbase:2.59,cabin:[-2.2,-2,1.9,2.2],roof:2.05,body:1.1,paint:['#e4e2d9','#bfc3c3','#b6ae97','#597889'],van:true},
 {id:'l300',name:'Mitsubishi L300 van',width:1.69,length:4.29,height:1.95,wheelbase:2.24,cabin:[-2,-1.8,1.7,2],roof:1.95,body:1.06,paint:['#d8d6c9','#b9c4c5','#bfad8f','#8e4942'],van:true,panel:true},
 {id:'city-bus',name:'Valley city bus',width:2.45,length:10.5,height:3.05,wheelbase:5.30,cabin:[-5,-4.8,4.8,5],roof:3.05,body:1.35,paint:['#d9d5bd','#c5d4ce','#d3d9df','#bdc9bd'],bus:true,acceleration:3,topSpeed:21},
 {id:'school-bus',name:'Valley school bus',width:2.40,length:8.7,height:2.90,wheelbase:4.45,cabin:[-4,-3.8,3.8,4],roof:2.90,body:1.32,paint:['#d9b94f','#ded2a8','#c6b669','#dfd8ba'],bus:true,school:true,acceleration:3.4,topSpeed:20}
];
function merged(parts){const positions=[],normals=[],uv=[];for(const original of parts){const g=original.index?original.toNonIndexed():original;positions.push(...g.attributes.position.array);normals.push(...g.attributes.normal.array);if(g.attributes.uv)uv.push(...g.attributes.uv.array);else for(let i=0;i<g.attributes.position.count;i++)uv.push(0,0);if(g!==original)g.dispose();original.dispose()}const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.computeBoundingSphere();return geometry}
export function classicGeometry(m,detail=1){
 if(detail&&!m.van&&!m.bus)return withVehicleInterior(realisticCarGeometry(m),m);
 const parts={};const add=(kind,g,x=0,y=0,z=0,rx=0,ry=0,rz=0)=>{g.rotateX(rx);g.rotateY(ry);g.rotateZ(rz);g.translate(x,y,z);(parts[kind]??=[]).push(g)};
 const box=(kind,w,h,d,x,y,z)=>{
  if((m.van||m.bus)&&['front','rear','amber'].includes(kind)){
   const r=Math.min(.022,h*.23,w*.23),s=new T.Shape();s.moveTo(-w/2+r,-h/2);s.lineTo(w/2-r,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);s.lineTo(w/2,h/2-r);s.quadraticCurveTo(w/2,h/2,w/2-r,h/2);s.lineTo(-w/2+r,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);s.lineTo(-w/2,-h/2+r);s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);
   const g=new T.ShapeGeometry(s,6),p=g.attributes.position,uv=g.attributes.uv;for(let i=0;i<p.count;i++){const u=p.getX(i)/w+.5,v=p.getY(i)/h+.5;uv.setXY(i,u,v);p.setZ(i,.002*Math.sin(Math.PI*u)*Math.sin(Math.PI*v))}g.computeVertexNormals();if(z<0)g.rotateY(Math.PI);add(kind,g,x,y,z<0?-m.length/2-.004:m.length/2+.004);return;
  }
  add(kind,new T.BoxGeometry(w,h,d),x,y,z);
 };
 const profile=(kind,points,width)=>{const shape=new T.Shape();points.forEach(([z,y],i)=>i?shape.lineTo(z,y):shape.moveTo(z,y));shape.closePath();const g=new T.ExtrudeGeometry(shape,{depth:width,bevelEnabled:false});g.rotateY(-Math.PI/2);g.translate(width/2,0,0);add(kind,g)};
 const w=m.width,l=m.length,b=m.body,r=m.roof,front=-l/2,rear=l/2,[c0,c1,c2,c3]=m.cabin,ride=m.ute?.19:0;
 const panel=(kind,points)=>{const g=new T.BufferGeometry(),v=[];for(let i=1;i<points.length-1;i++)v.push(...points[0],...points[i],...points[i+1]);g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();add(kind,g)};
 const strut=(kind,a,q,width=.055,depth=width)=>{const start=new T.Vector3(...a),end=new T.Vector3(...q),g=new T.BoxGeometry(width,start.distanceTo(end),depth);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),end.clone().sub(start).normalize()));g.translate(...start.add(end).multiplyScalar(.5).toArray());add(kind,g)};
 const wheel=(tyre,rim,side,z,steel)=>{
  const depth=m.bus?.30:.22,x=side*(w/2-.015),face=side*(w/2+depth/2-.002);
  add('rubber',new T.CylinderGeometry(tyre,tyre,depth,20),x,tyre,z,0,0,Math.PI/2);
  add('dark',new T.CylinderGeometry(rim,rim,depth+.005,20),x,tyre,z,0,0,Math.PI/2);
  add('chrome',new T.TorusGeometry(rim-.012,.014,5,20),face,tyre,z,0,Math.PI/2);
  if(steel){
   add('chrome',new T.CircleGeometry(rim-.024,20),face,tyre,z,0,side*Math.PI/2);
   for(let j=0;j<6;j++){const a=j*Math.PI/3;add('dark',new T.CircleGeometry(.028,7),face+side*.002,tyre+Math.cos(a)*rim*.64,z+Math.sin(a)*rim*.64,0,side*Math.PI/2)}
  }else for(let j=0;j<5;j++){const a=j*Math.PI*2/5;add('chrome',new T.BoxGeometry(.022,rim-.018,.035),face,tyre+Math.cos(a)*rim*.48,z+Math.sin(a)*rim*.48,a)}
  add('chrome',new T.CylinderGeometry(m.bus?.085:.052,m.bus?.085:.052,depth+.03,10),x,tyre,z,0,0,Math.PI/2);
 };
 if(m.van||m.bus){
  const bus=m.bus,tyre=bus?.49:.35,belt=bus?1.43:1.04,windowTop=r-.22,windowCount=bus?(m.school?6:8):3,start=front+(bus?1.0:.17),end=rear-.20,step=(end-start)/windowCount;
  // Cab-over body: upright nose, long roof, inset window band and separate corner pillars.
  for(const side of [-1,1]){
   const outline=new T.Shape();outline.moveTo(front,.43);for(const [z,y]of [[front,belt],[front+.16,r-.13],[rear-.08,r-.13],[rear,.46],[rear,.43]])outline.lineTo(z,y);
   const arch=tyre+.05,alpha=Math.asin((.43-tyre)/arch);for(const centre of [m.wheelbase/2,-m.wheelbase/2])for(let j=0;j<=16;j++){const a=alpha+(Math.PI-2*alpha)*j/16;outline.lineTo(centre+Math.cos(a)*arch,tyre+Math.sin(a)*arch)}outline.closePath();
   for(let j=0;j<windowCount;j++)if(!m.panel||j===0){const base=start+step*j+.05,lo=base+(bus&&side===-1&&j===0?.10:0),hi=base+step-.10,hole=new T.Path();hole.moveTo(lo,belt);hole.lineTo(hi,belt);hole.lineTo(hi,windowTop);hole.lineTo(lo,windowTop);hole.closePath();outline.holes.push(hole)}
   if(bus&&side===-1){const centre=front+.75,hole=new T.Path();hole.moveTo(centre-.34,.685);hole.lineTo(centre+.34,.685);hole.lineTo(centre+.34,2.355);hole.lineTo(centre-.34,2.355);hole.closePath();outline.holes.push(hole)}
   const skin=new T.ShapeGeometry(outline),v=skin.attributes.position;for(let i=0;i<v.count;i++)v.setXYZ(i,side*w/2,v.getY(i),v.getX(i));if(side===1){const ix=skin.index.array;for(let i=0;i<ix.length;i+=3)[ix[i+1],ix[i+2]]=[ix[i+2],ix[i+1]]}skin.computeVertexNormals();add('paint',skin);
   for(const z of [-m.wheelbase/2,m.wheelbase/2])add('dark',new T.CircleGeometry(arch+.012,20),side*(w/2-.13),tyre,z,0,side*Math.PI/2);
  }
  panel('paint',[[w/2,.43,front],[-w/2,.43,front],[-w/2,belt,front],[w/2,belt,front]]);
  for(const back of [false,true]){
   const y0=back?.46:belt,y1=r-.13,z0=back?rear:front,z1=back?rear-.08:front+.16,glassLow=belt+.04,glassHigh=windowTop,half=(w-.18)/2;
   const rect=(kind,x0,x1,lo,hi)=>{const z=y=>T.MathUtils.lerp(z0,z1,(y-y0)/(y1-y0))+(kind==='glass'?(back?.003:-.003):0),points=[[x0,lo,z(lo)],[x1,lo,z(lo)],[x1,hi,z(hi)],[x0,hi,z(hi)]];panel(kind,back?points:points.reverse())};
   rect('paint',-w/2,w/2,y0,glassLow);rect('paint',-w/2,w/2,glassHigh,y1);rect('paint',-w/2,-half,glassLow,glassHigh);rect('paint',half,w/2,glassLow,glassHigh);rect('glass',-half,half,glassLow,glassHigh);
  }
  box('dark',w*.76,.12,l-.3,0,.46,0);
  box('paint',w-.06,.15,l-.18,0,r-.075,0);
  for(const side of [-1,1]){
   const x=side*(w/2+.012);
   for(let j=0;j<windowCount;j++)if(!m.panel||j===0){const base=start+step*j+.05,lo=base+(bus&&side===-1&&j===0?.10:0),hi=base+step-.10,points=[[x,belt,lo],[x,windowTop,lo],[x,windowTop,hi],[x,belt,hi]];panel('glass',side===1?points:points.reverse())}
   box('dark',.025,.09,l-.18,x,belt-.10,0);
   box('chrome',.032,.055,.19,x,belt-.16,front+.92);
   // Cargo sliding door seams on the L300; glazed passenger side doors on buses.
   const doorZ=bus?front+.75:front+1.9;
   for(const z of [doorZ-.38,doorZ+.38])box('dark',.027,bus?1.95:1.20,.025,x,bus?1.45:1.04,z);
   if(bus&&side===-1){panel('glass',[[x,.685,doorZ+.34],[x,2.355,doorZ+.34],[x,2.355,doorZ-.34],[x,.685,doorZ-.34]]);box('dark',.04,1.7,.035,x,1.52,doorZ)}
   box('dark',.15,bus?.32:.22,.24,side*(w/2+.23),belt+.29,front+.17);
   box('dark',.29,.035,.035,side*(w/2+.10),belt+.35,front+.17);
   if(bus){box('stripe',.028,.30,l-.16,x,.98,0);for(let j=0;j<7;j++)box('dark',.03,.025,.64,x,.67+j*.065,rear-.67)}
  }
  if(bus){box('dark',w-.32,.24,.035,0,r-.38,front+.14);box('sign',w*.58,.10,.041,0,r-.38,front+.12);box('dark',.06,windowTop-belt,.04,0,(windowTop+belt)/2,front-.02);box('paint',1.05,.16,1.8,0,r+.05,.65)}
  else{box('dark',.06,.39,.025,-.31,belt+.25,front-.025);box('dark',.06,.39,.025,.31,belt+.25,front-.025)}
  for(const side of [-1,1])for(const z of [-m.wheelbase/2,m.wheelbase/2])wheel(tyre,tyre*.61,side,z,true);
  for(const z of [front-.04,rear+.04]){box('dark',w-.08,.18,.12,0,.48,z);box('plate',.40,.14,.018,0,.59,z+(z<0?-.07:.07))}
  box('dark',w*.44,.17,.035,0,.85,front-.02);
  for(const side of [-1,1]){box('front',bus?.36:.41,.20,.04,side*(w/2-.32),.88,front-.025);box('amber',.10,.12,.045,side*(w/2-.10),1.08,front-.025);box('rear',.16,bus?.43:.32,.04,side*(w/2-.16),.88,rear+.025)}
  const geometry=Object.fromEntries(Object.entries(parts).map(([kind,items])=>[kind,merged(items)]));return detail?withVehicleInterior(geometry,m):geometry;
 }

 // Tapered nose/tail, a bevelled shoulder and genuine open wheel arches.
 const tyre=m.ute?.41:.32,rim=m.ute?.23:.205,bottom=.39+ride,arch=tyre+.045;
 const sections=[[front,.91,b-.055],[front+.20,.98,b-.025],[c0-.10,1,b+.015],...(m.ute?[[.45,1,b+.015]]:[]),[Math.max(c3+.10,m.ute?rear-.18:c3+.10),1,b+.015],[rear-.08,.96,b-.025],[rear,.91,b-.055]].sort((a,b)=>a[0]-b[0]);
 const widthAt=z=>{let i=0;while(i<sections.length-2&&z>sections[i+1][0])i++;const a=sections[i],q=sections[i+1],t=T.MathUtils.clamp((z-a[0])/(q[0]-a[0]||1),0,1);return w*T.MathUtils.lerp(a[1],q[1],t)};
 for(const side of [-1,1]){
  const shape=new T.Shape();shape.moveTo(front,bottom);
  for(const centre of [-m.wheelbase/2,m.wheelbase/2]){const alpha=Math.asin(T.MathUtils.clamp((bottom-tyre)/arch,-1,1));for(let j=0;j<=14;j++){const angle=Math.PI-alpha-(Math.PI-2*alpha)*j/14;shape.lineTo(centre+Math.cos(angle)*arch,tyre+Math.sin(angle)*arch)}}
  shape.lineTo(rear,bottom);for(const [z,_,y]of [...sections].reverse())shape.lineTo(z,y-.065);shape.closePath();
  const skin=new T.ShapeGeometry(shape),v=skin.attributes.position;for(let i=0;i<v.count;i++){const z=v.getX(i);v.setXYZ(i,side*widthAt(z)/2,v.getY(i),z)}if(side===1){const ix=skin.index.array;for(let i=0;i<ix.length;i+=3)[ix[i+1],ix[i+2]]=[ix[i+2],ix[i+1]]}skin.computeVertexNormals();add('paint',skin);
  for(const z of [-m.wheelbase/2,m.wheelbase/2]){
   add('dark',new T.CircleGeometry(arch+.015,20),side*(w/2-.13),tyre,z,0,side*Math.PI/2);
   for(let j=0;j<14;j++){const alpha=Math.asin(T.MathUtils.clamp((bottom-tyre)/arch,-1,1)),a=alpha+(Math.PI-2*alpha)*j/14,q=alpha+(Math.PI-2*alpha)*(j+1)/14;strut('paint',[side*(widthAt(z+Math.cos(a)*arch)/2+.006),tyre+Math.sin(a)*arch,z+Math.cos(a)*arch],[side*(widthAt(z+Math.cos(q)*arch)/2+.006),tyre+Math.sin(q)*arch,z+Math.cos(q)*arch],.025,.025)}
  }
 }
 for(let i=0;i<sections.length-1;i++){
  const [za,wa,ha]=sections[i],[zb,wb,hb]=sections[i+1];
  for(const side of [-1,1]){const p=[[side*w*wa/2,ha-.065,za],[side*w*wa*.46,ha,za],[side*w*wb*.46,hb,zb],[side*w*wb/2,hb-.065,zb]];panel('paint',side===1?p:p.reverse())}
  if(!m.ute||zb<=.45)panel('paint',[[-w*wa*.46,ha,za],[-w*wb*.46,hb,zb],[w*wb*.46,hb,zb],[w*wa*.46,ha,za]]);
 }
 for(const [z,ww,h]of [sections[0],sections.at(-1)]){const p=[[-w*ww/2,bottom,z],[w*ww/2,bottom,z],[w*ww/2,h-.065,z],[w*ww*.46,h,z],[-w*ww*.46,h,z],[-w*ww/2,h-.065,z]];panel('paint',z===front?p.reverse():p)}
 box('dark',w*.73,.10,l-.42,0,bottom+.015,0);
 // Glazing narrows toward the roof rather than extruding a rectangular glass block.
 const beltX=w*.445,roofX=w*.365,glassTop=r-.075,roofEnd=m.hatch||m.wagon?c2+.02:c2;
 for(const side of [-1,1]){
  const a=[side*beltX,b+.015,c0],q=[side*roofX,glassTop,c1],v=[side*roofX,glassTop,roofEnd],d=[side*beltX,b+.015,c3];
  panel('glass',side===1?[a,q,v,d]:[d,v,q,a]);
  strut('dark',a,q,.09);strut('paint',a,q,.065);strut('paint',d,[v[0],v[1]-.035,v[2]],.07,m.wagon?.13:.17);
  strut('dark',q,v,.045);strut('dark',a,d,.035);
  const divider=m.ute?(c1+c2)*.5:c1+(c2-c1)*.48;
  strut('dark',[side*beltX,b+.025,divider],[side*roofX,glassTop,divider],.075);
  if(m.wagon)strut('paint',[side*beltX,b+.025,c2-.30],[side*roofX,glassTop,c2-.30],.065);
  box('dark',.02,.055,c3-c0,side*(w/2+.006),b-.19,(c0+c3)/2);
  for(const z of m.ute?[-.3]:[divider-.18,Math.min(c3-.25,divider+.87)]){
   box('dark',.024,.065,.21,side*(w/2+.012),b-.10,z);
   box('chrome',.035,.026,.145,side*(w/2+.024),b-.09,z);
   strut('dark',[side*(widthAt(z+.24)/2+.004),bottom+.06,z+.24],[side*(widthAt(z+.24)/2+.004),b-.05,z+.24],.007,.007);
  }
  strut('dark',[side*(w*.43),b+.10,c0+.17],[side*(w/2+.08),b+.14,c0+.17],.045);
  box('paint',.16,.125,.23,side*(w/2+.09),b+.16,c0+.17);
  box('glass',.018,.08,.165,side*(w/2+.178),b+.165,c0+.19);
 }
 panel('glass',[[beltX,b+.015,c0],[-beltX,b+.015,c0],[-roofX,glassTop,c1],[roofX,glassTop,c1]]);
 panel('glass',[[-beltX,b+.015,c3],[beltX,b+.015,c3],[roofX,glassTop,roofEnd],[-roofX,glassTop,roofEnd]]);
 const roofSections=[[c1-.025,r-.045],[T.MathUtils.lerp(c1,roofEnd,.5),r-.005],[roofEnd+.025,r-.045]];
 for(let i=0;i<roofSections.length-1;i++){const [za,ya]=roofSections[i],[zb,yb]=roofSections[i+1];for(const side of [-1,1]){const edgeA=[side*roofX,ya,za],edgeB=[side*roofX,yb,zb];panel('paint',side===1?[[0,ya+.02,za],[0,yb+.02,zb],edgeB,edgeA]:[edgeA,edgeB,[0,yb+.02,zb],[0,ya+.02,za]]);const rimA=[side*(roofX+.025),glassTop-.005,za],rimB=[side*(roofX+.025),glassTop-.005,zb];panel('paint',side===1?[rimA,edgeA,edgeB,rimB]:[rimB,edgeB,edgeA,rimA])}}
 for(const [z,y,back]of [[c1-.025,r-.045,false],[roofEnd+.025,r-.045,true]]){const points=[[-roofX-.025,glassTop-.005,z],[roofX+.025,glassTop-.005,z],[roofX,y,z],[0,y+.02,z],[-roofX,y,z]];panel('paint',back?points:points.reverse())}
 for(const side of [-1,1])strut('dark',[side*w*.38,b-.017,front+.26],[side*w*.38,b+.013,c0-.12],.006);
 for(const side of [-1,1])strut('dark',[side*.16,b+.05,c0-.015],[side*.37,b+.15,c0+.04],.015);
 // The dark interior provides depth behind the reflections without transparent sorting.
 box('dark',w*.74,.10,.28,0,b+.035,c0+.20);
 if(m.wagon&&!m.plain){for(const x of [-.55,.55])box('dark',.045,.055,1.8,x,r+.04,.48)}
 if(m.ute){
  // Open tray with raised side rails, recessed dark floor and separate tailgate.
  box('dark',w-.20,.035,1.64,0,b-.14,1.29);
  for(let j=0;j<7;j++)box('dark',.035,.035,1.52,-w*.36+j*w*.12,b-.105,1.29);
  for(const side of [-1,1])box('paint',.025,.42,1.64,side*(w/2-.10),b+.065,1.29);
  for(const z of [.47,rear-.11])box('paint',w-.20,.42,.03,0,b+.065,z);
  for(const side of [-1,1])box('paint',.09,.30,1.78,side*(w/2-.045),b+.15,1.36);
  box('paint',w,.30,.10,0,b+.15,rear-.05);box('chrome',.28,.05,.025,0,b+.16,rear+.009);
  for(const side of [-1,1])box('dark',.12,.28,.16,side*(w/2-.13),.36,rear-.72);
 }
 for(const side of [-1,1])for(const z of [-m.wheelbase/2,m.wheelbase/2])wheel(tyre,rim,side,z,m.plain||m.ute);
 box('dark',w*.91,.18,.11,0,.47+ride,front-.025);box('dark',w*.91,.17,.11,0,.47+ride,rear+.025);
 box('dark',w*.39,.16,.04,0,b-.13,front-.045);
 for(let j=0;j<3;j++)box('chrome',w*.34,.016,.045,0,b-.18+j*.045,front-.07);
 box('plate',.38,.12,.018,0,.50+ride,front-.087);box('plate',.38,.12,.018,0,.52+ride,rear+.087);
 for(const side of [-1,1]){
  const lightWidth=m.lights==='square'?.31:m.lights==='small'?.40:.53;
  box('front',lightWidth,m.lights==='square'?.23:.14,.045,side*(w/2-lightWidth/2-.08),b-.17,front-.048);
  box('amber',.10,.13,.05,side*(w/2-.12),b-.17,front-.05);
  if(m.lights==='round')for(const offset of [0,.23])add('rear',new T.CylinderGeometry(.10,.10,.045,16),side*(.35+offset),b-.13,rear+.05,Math.PI/2);
  else box('rear',m.verticalRear?.15:m.ute?.17:lightWidth,m.verticalRear?.34:m.ute?.29:.16,.05,side*(w/2-(m.verticalRear?.13:m.ute?.16:lightWidth/2+.08)),b-.13,rear+.05);
 }
 if(m.spoiler){box('paint',w*.85,.065,.24,0,b+.23,rear-.33);for(const x of [-.53,.53])box('paint',.06,.18,.12,x,b+.12,rear-.33)}
 box('dark',.10,.08,.21,-.56,.32,rear+.04);
 const geometry=Object.fromEntries(Object.entries(parts).map(([kind,items])=>[kind,merged(items)]));return detail?withVehicleInterior(geometry,m):geometry;
}
function vehicleLampMaterial(material,kind){material.onBeforeCompile=shader=>{shader.vertexShader='attribute vec3 vehicleLamps;varying vec3 vVehicleLamps;varying float vVehicleLampSide;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvVehicleLamps=vehicleLamps;vVehicleLampSide=position.x;');shader.fragmentShader='varying vec3 vVehicleLamps;varying float vVehicleLampSide;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n'+(kind==='rear'?'totalEmissiveRadiance+=vec3(1.,.008,.003)*vVehicleLamps.x*2.2;':'totalEmissiveRadiance+=vec3(1.,.24,.008)*(vVehicleLampSide<0.?vVehicleLamps.y:vVehicleLamps.z)*2.5;'))};material.customProgramCacheKey=()=> 'vehicle-lamps-50-'+kind}
export function createClassicFleet(scene,cars,{maxDistance=Infinity}={}){
 const environment=vehicleEnvironment(),headLens=vehicleLensTexture('front'),tailLens=vehicleLensTexture('rear'),turnLens=vehicleLensTexture('amber');
 const materials={stripe:new T.MeshLambertMaterial({color:'#2c695e'}),sign:new T.MeshBasicMaterial({color:'#e2c876'}),paint:new T.MeshPhysicalMaterial({color:'#ffffff',metalness:.42,roughness:.30,clearcoat:.8,clearcoatRoughness:.19,envMap:environment,envMapIntensity:.8}),glass:new T.MeshStandardMaterial({color:'#849da4',metalness:.08,roughness:.10,envMap:environment,envMapIntensity:.35,transparent:true,opacity:.30,depthWrite:false,side:T.DoubleSide,forceSinglePass:true}),rubber:new T.MeshStandardMaterial({color:'#181b1d',roughness:.92}),chrome:new T.MeshStandardMaterial({color:'#b5b8ba',metalness:.92,roughness:.24,envMap:environment}),dark:new T.MeshLambertMaterial({color:'#283038'}),front:new T.MeshStandardMaterial({color:'#b9c1c0',map:headLens,emissiveMap:headLens,metalness:.12,roughness:.22,envMap:environment,envMapIntensity:.75,emissive:'#fff0c5',emissiveIntensity:0}),rear:new T.MeshStandardMaterial({color:'#a51624',map:tailLens,emissiveMap:tailLens,roughness:.20,envMap:environment,emissive:'#c62f34',emissiveIntensity:0}),amber:new T.MeshStandardMaterial({color:'#b48034',map:turnLens,roughness:.23,envMap:environment}),plate:new T.MeshStandardMaterial({color:'#ffffff',map:vehiclePlateTexture(),roughness:.55})};
 vehicleLampMaterial(materials.rear,'rear');vehicleLampMaterial(materials.amber,'amber');
 const distantGlass=new T.MeshStandardMaterial({color:'#243038',metalness:.32,roughness:.12,envMap:environment});
 materials.cabin=new T.MeshStandardMaterial({color:'#303536',roughness:.88});materials.upholstery=new T.MeshStandardMaterial({color:'#74746a',roughness:.98});materials.instruments=new T.MeshStandardMaterial({color:'#ffffff',map:instrumentTexture(),roughness:.8});
 const batches=CLASSICS.map((model,i)=>{const members=cars.filter((car,j)=>j%CLASSICS.length===i),levels=[0,1].map(detail=>Object.entries(classicGeometry(model,detail)).map(([kind,geometry])=>{const mesh=new T.InstancedMesh(geometry,kind==='glass'&&detail===0?distantGlass:materials[kind],Math.max(1,members.length));if(kind==='rear'||kind==='amber')geometry.setAttribute('vehicleLamps',new T.InstancedBufferAttribute(new Float32Array(Math.max(1,members.length)*3),3));mesh.count=0;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.name=model.name+' / '+kind;mesh.userData.vehicleDetail=detail;mesh.renderOrder=kind==='glass'&&detail===1?10:0;scene.add(mesh);return{mesh,kind}}));members.forEach(car=>{car.model=model;car.modelBatch=i;car.fleetMatrix=new T.Matrix4();car.fleetPaint=new T.Color(model.paint[Math.floor(car.index/CLASSICS.length)%model.paint.length])});return{members,levels}});
 const matrix=new T.Matrix4(),rotation=new T.Quaternion(),scale=new T.Vector3(1,1,1),position=new T.Vector3();
 return{write(car,pitch=0){const p=car.renderPosition||car.position;position.set(p.x,p.y,p.z);rotation.setFromEuler(new T.Euler(pitch,car.renderYaw??car.yaw,(car.inWater?car.waterRoll:car.bodyRoll)||0,'YXZ'));matrix.compose(position,rotation,scale);car.fleetMatrix.copy(matrix)},finish(night,camera,clock=0){materials.paint.envMapIntensity=.8*(1-night*.88);materials.glass.envMapIntensity=.35*(1-night*.8);distantGlass.envMapIntensity=1.15*(1-night*.8);materials.chrome.envMapIntensity=1-night*.85;materials.front.emissiveIntensity=night*1.6;materials.rear.emissiveIntensity=night*.65;for(const batch of batches){for(const level of batch.levels)for(const{mesh}of level)mesh.count=0;for(const car of batch.members){const p=car.renderPosition||car.position;if(!p)continue;const distance=camera?Math.hypot(p.x-camera.x,p.z-camera.z):0;if(!car.controlled&&distance>maxDistance)continue;const detail=car.controlled||distance<(car.fleetDetail===1?100:80)?1:0;car.fleetDetail=detail;for(const{mesh,kind}of batch.levels[detail]){const slot=mesh.count++;car.modelSlot=slot;mesh.setMatrixAt(slot,car.fleetMatrix);if(kind==='paint')mesh.setColorAt(slot,car.fleetPaint);const lamps=mesh.geometry.attributes.vehicleLamps;if(lamps){const on=clock%1<.5;lamps.setXYZ(slot,car.braking?1:0,on&&car.indicator==='left'?1:0,on&&car.indicator==='right'?1:0);lamps.needsUpdate=true}}}for(const level of batch.levels)for(const{mesh}of level){mesh.visible=mesh.count>0;if(!mesh.visible)continue;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true}}}};
}
