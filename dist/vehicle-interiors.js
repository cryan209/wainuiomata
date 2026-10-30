import * as T from './vendor/three.js';

// Right-hand-drive cabins. Interiors are added only to the nearby LOD.
export function withVehicleInterior(exterior,m){
 const parts={},w=m.width,H=m.roof,b=m.body,F=-m.length/2,R=m.length/2,[a,A,B,d]=m.cabin;
 const bus=!!m.bus,van=!!m.van,commercial=bus||van;
 const floor=bus?.76:van?.53:m.ute?.55:.32,start=commercial?F+.10:a+.05,end=commercial?R-.12:d-.05;
 const add=(kind,g,x=0,y=0,z=0)=>{g.translate(x,y,z);(parts[kind]??=[]).push(g);return g};
 const box=(kind,x,y,z,sx,sy,sz)=>add(kind,new T.BoxGeometry(sx,sy,sz),x,y,z);
 const soft=(kind,x,y,z,sx,sy,sz,tilt=0)=>{const r=Math.min(.025,sx*.15,sy*.15,sz*.25),shape=new T.Shape();shape.moveTo(-sx/2+r,-sy/2+r);shape.lineTo(sx/2-r,-sy/2+r);shape.lineTo(sx/2-r,sy/2-r);shape.lineTo(-sx/2+r,sy/2-r);shape.closePath();const g=new T.ExtrudeGeometry(shape,{depth:sz-2*r,bevelEnabled:true,bevelSize:r,bevelThickness:r,bevelSegments:3,curveSegments:1});g.translate(0,0,-sz/2+r);g.rotateX(tilt);return add(kind,g,x,y,z)};
 const beam=(kind,p,q,r=.013)=>{const from=new T.Vector3(...p),to=new T.Vector3(...q),g=new T.CylinderGeometry(r,r,from.distanceTo(to),8);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),to.clone().sub(from).normalize()));add(kind,g,...from.add(to).multiplyScalar(.5).toArray())};
 const ball=(kind,x,y,z,r)=>add(kind,new T.SphereGeometry(r,10,7),x,y,z);
 box('cabin',0,floor,(start+end)/2,w-.20,.065,end-start);
 for(const side of [-1,1]){
  box('cabin',side*(w/2-.11),(floor+b)/2,(start+end)/2,.07,b-floor,end-start);
  soft('upholstery',side*(w/2-.15),b-.16,(start+end)/2,.045,.13,Math.min(end-start-.12,2.35));
  box('chrome',side*(w/2-.19),b-.09,commercial?F+1.10:A+.45,.025,.025,.13);
 }
 for(const z of [-m.wheelbase/2,m.wheelbase/2])if(z>start&&z<end)for(const side of [-1,1])soft('cabin',side*(w/2-.22),floor+.10,z,.30,.23,bus?1.06:.78);
 const seatZ=commercial?F+(bus?1.03:1.02):m.ute?(A+B)/2-.08:A+.53;
 const seatY=floor+(bus?.42:.22),seatWidth=bus?.40:Math.min(.48,(w-.40)/2),backHeight=bus?.71:m.ute?.64:.54;
 const seat=(x,z,width=seatWidth,head=true)=>{
  soft('upholstery',x,seatY,z,width,.13,bus?.40:.43);
  soft('upholstery',x,seatY+backHeight/2+.065,z+.20,width,backHeight,.105,.10);
  // Separate centre inserts and side bolsters give the seats volume.
  for(const side of [-1,1])soft('upholstery',x+side*(width/2-.045),seatY+.07,z,.075,.095,.37);
  if(head){soft('upholstery',x,seatY+backHeight+.145,z+.225,width*.54,.14,.10);for(const dx of [-.055,.055])beam('chrome',[x+dx,seatY+backHeight+.05,z+.22],[x+dx,seatY+backHeight+.10,z+.22],.006)}
  box('cabin',x,seatY-.12,z,width*.65,.14,.30);
 };
 const driverX=bus?w*.31:w*.225;
 seat(driverX,seatZ);if(!bus)seat(-driverX,seatZ);
 if(bus){
  for(let z=F+2.05;z<R-.55;z+=.80)for(const side of [-1,1])for(const x of [.45,.88])seat(side*x,z,.39,false);
  // Centre aisle remains open. Rails sit beside the seats, not through the aisle.
  for(const side of [-1,1])beam('chrome',[side*.26,floor+.05,F+1.65],[side*.26,H-.12,F+1.65],.018);
 }else if(!m.ute&&!m.panel){
  const headTop=seatY+backHeight+.21,glassFraction=T.MathUtils.clamp((headTop-(b+.044))/(H-.072-(b+.044)),0,1),rearLimit=T.MathUtils.lerp(d,B,glassFraction)-.34;
  const rearZ=commercial?F+2.25:Math.min(d-.53,seatZ+.96,rearLimit),width=w-.34;
  soft('upholstery',0,seatY,rearZ,width,.13,.43);
  soft('upholstery',0,seatY+backHeight/2+.065,rearZ+.20,width,backHeight,.11,.08);
  for(const x of [-driverX,driverX])soft('upholstery',x,seatY+backHeight+.14,rearZ+.22,.25,.13,.10);
  box('cabin',0,floor+.055,(rearZ+.35+end)/2,w-.25,.055,Math.max(.1,end-rearZ-.35));
 }
 const dashZ=commercial?F+.32:a+.23,dashY=b-.035;
 soft('cabin',0,dashY,dashZ,w-.28,.16,commercial?.36:.37);
 soft('cabin',driverX,b+.026,dashZ+.16,.34,.095,.11);
 // An angled instrument face, stereo and heater controls.
 const gauges=new T.PlaneGeometry(.27,.067);gauges.rotateX(-.16);add('instruments',gauges,driverX,b+.027,dashZ+.22);
 box('cabin',0,b-.105,dashZ+.17,.18,.16,.12);
 for(let i=0;i<3;i++)ball('chrome',-.045+i*.045,b-.125,dashZ+.235,.012);
 box('chrome',0,b-.067,dashZ+.236,.13,.009,.003);
 for(const x of [-w*.30,w*.30])for(let j=0;j<4;j++)box('chrome',x,b+.005-j*.013,dashZ+.19,.13,.003,.003);
 const wheelY=b+.11,wheelZ=dashZ+.34,wheelR=bus?.185:.145;
 const steering=new T.TorusGeometry(wheelR,.014,7,28);steering.rotateX(-.40);add('cabin',steering,driverX,wheelY,wheelZ);
 for(let i=0;i<3;i++){const theta=i*Math.PI*2/3;beam('cabin',[driverX,wheelY,wheelZ],[driverX+Math.sin(theta)*wheelR*.91,wheelY+Math.cos(theta)*wheelR*.91*Math.cos(.40),wheelZ-Math.cos(theta)*wheelR*.91*Math.sin(.40)],.011)}
 soft('cabin',driverX,wheelY,wheelZ,.085,.065,.045,-.40);
 beam('cabin',[driverX,wheelY-.025,wheelZ-.02],[driverX,dashY-.10,dashZ+.02],.035);
 const leverX=bus?driverX-.30:0;
 soft('cabin',leverX,floor+.13,seatZ-.17,.15,.20,.32);
 beam('cabin',[leverX,floor+.23,seatZ-.28],[leverX,floor+.42,seatZ-.32],.010);ball('cabin',leverX,floor+.44,seatZ-.32,.030);
 soft('cabin',0,floor+.23,seatZ+.10,.035,.035,.19,-.18);
 for(const dx of [-.07,.045]){const g=new T.BoxGeometry(.06,.035,.11);g.rotateX(-.12);add('cabin',g,driverX+dx,floor+.08,dashZ+.20)}
 // Interior roof lining, visors and a rear-view mirror close the visible cabin.
 if(commercial)box('upholstery',0,H-.18,(start+end)/2,w-.18,.035,end-start);
 else{
  const p=[],ix=[],nu=12,nv=10;for(let i=0;i<=nu;i++)for(let j=0;j<=nv;j++){const u=i/nu,x=2*j/nv-1;p.push(w*.363*x*(1-.024*(2*u-1)**2),H-.075+.04*Math.sin(Math.PI*u)+.025*(1-x*x),T.MathUtils.lerp(A,B,u))}for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){const a=i*(nv+1)+j,c=(i+1)*(nv+1)+j;ix.push(a,c+1,c,a,a+1,c+1)}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();add('upholstery',g);
 }
 const roofFront=commercial?F+.35:A+.10;
 for(const x of [-driverX,driverX])soft('upholstery',x,H-.085,roofFront,.30,.035,.14);
 soft('cabin',0,H-.14,roofFront+.05,.21,.07,.035);box('chrome',0,H-.14,roofFront+.075,.18,.045,.004);
 for(const[k,items]of Object.entries(parts)){
  const pos=[],norm=[],uv=[];if(exterior[k])items.unshift(exterior[k]);for(const original of items){const g=original.index?original.toNonIndexed():original;pos.push(...g.attributes.position.array);norm.push(...g.attributes.normal.array);if(g.attributes.uv)uv.push(...g.attributes.uv.array);else for(let i=0;i<g.attributes.position.count;i++)uv.push(0,0);if(g!==original)g.dispose();original.dispose()}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(norm,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeBoundingSphere();exterior[k]=g;
 }
 return exterior;
}
export function instrumentTexture(){if(typeof document==='undefined')return null;const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;const c=canvas.getContext('2d');c.fillStyle='#101a1d';c.fillRect(0,0,256,64);for(const [x,r]of [[68,27],[172,27]]){c.strokeStyle='#aeb9ad';c.lineWidth=2;c.beginPath();c.arc(x,34,r,.7,5.6);c.stroke();for(let j=0;j<11;j++){const a=.7+j*4.9/10;c.beginPath();c.moveTo(x+Math.cos(a)*r*.8,34+Math.sin(a)*r*.8);c.lineTo(x+Math.cos(a)*r,34+Math.sin(a)*r);c.stroke()}c.strokeStyle='#bf6049';c.beginPath();c.moveTo(x,34);c.lineTo(x-12,14);c.stroke()}const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;return t}
