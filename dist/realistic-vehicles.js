import * as T from './vendor/three.js';
// Smooth shared meshes, in metres. Body curvature is independent of panel trim.
export function realisticCarGeometry(m){
 const parts={},w=m.width,L=m.length,b=m.body,H=m.roof,F=-L/2,R=L/2,[a,A,B,d]=m.cabin;
 const tyre=m.ute?.41:.315,rim=m.ute?.225:.195,bottom=m.ute?.49:.25,arch=tyre+.035;
 const add=(k,g,x=0,y=0,z=0)=>{g.translate(x,y,z);(parts[k]??=[]).push(g);return g};
 const surface=(k,us,vs,fn,flip=false,keep=()=>true)=>{const p=[],uv=[],ix=[];for(let i=0;i<=us;i++)for(let j=0;j<=vs;j++){p.push(...fn(i/us,j/vs));uv.push(i/us,j/vs)}for(let i=0;i<us;i++)for(let j=0;j<vs;j++){if(!keep((i+.5)/us,(j+.5)/vs))continue;const a=i*(vs+1)+j,c=(i+1)*(vs+1)+j;ix.push(...(flip?[a,c+1,c,a,a+1,c+1]:[a,c,c+1,a,c+1,a+1]))}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();add(k,g)};
 const rounded=(k,x,y,z,sx,sy,sz,r=.015)=>{r=Math.min(r,sx/3,sy/3,sz/3);const s=new T.Shape(),hw=sx/2-r,hh=sy/2-r;s.moveTo(-hw,-hh-r);s.lineTo(hw,-hh-r);s.quadraticCurveTo(hw+r,-hh-r,hw+r,-hh);s.lineTo(hw+r,hh);s.quadraticCurveTo(hw+r,hh+r,hw,hh+r);s.lineTo(-hw,hh+r);s.quadraticCurveTo(-hw-r,hh+r,-hw-r,hh);s.lineTo(-hw-r,-hh);s.quadraticCurveTo(-hw-r,-hh-r,-hw,-hh-r);const g=new T.ExtrudeGeometry(s,{depth:sz-2*r,steps:1,bevelEnabled:true,bevelSize:r*.35,bevelThickness:r,bevelSegments:2,curveSegments:3});g.translate(0,0,-sz/2+r);add(k,g,x,y,z);return g};
 const tube=(k,points,r=.003)=>add(k,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),Math.max(3,points.length*2),r,5,false));
 const sphere=(k,x,y,z,sx,sy,sz)=>{const g=new T.SphereGeometry(1,14,8);g.scale(sx,sy,sz);add(k,g,x,y,z)};
 const stations=[[F,.90,b-.035],[F+.07,.96,b-.012],[F+.27,.995,b+.015],[F+.60,1,b+.025],[R-.50,1,b+.025],[R-.20,.98,b+.015],[R-.05,.91,b-.005],[R,.90,b-.025]];
 const section=z=>{let i=0;while(i<stations.length-2&&z>stations[i+1][0])i++;const q=stations[i],n=stations[i+1],t=T.MathUtils.smoothstep(z,q[0],n[0]);return{half:w/2*T.MathUtils.lerp(q[1],n[1],t),h:T.MathUtils.lerp(q[2],n[2],t)}};
 const cut=z=>{let h=bottom;for(const wheel of [-m.wheelbase/2,m.wheelbase/2]){const dz=z-wheel;if(Math.abs(dz)<arch)h=Math.max(h,tyre+Math.sqrt(arch*arch-dz*dz))}return h};
 const zs=[...stations.map(s=>s[0]),...Array.from({length:49},(_,i)=>F+L*i/48)];for(const z of [-m.wheelbase/2,m.wheelbase/2])for(let j=0;j<=20;j++)zs.push(z+arch*Math.cos(Math.PI*j/20));zs.sort((a,b)=>a-b);const zlist=[...new Set(zs.map(z=>Math.round(z*1e6)/1e6))].filter(z=>z>=F&&z<=R);
 const zAt=u=>{const n=u*(zlist.length-1),i=Math.min(zlist.length-2,Math.floor(n));return T.MathUtils.lerp(zlist[i],zlist[i+1],n-i)};
 const sidePoint=(side,z,v)=>{const q=section(z),lo=cut(z);const y=T.MathUtils.lerp(lo,q.h-.065,v),full=(y-bottom)/(q.h-.065-bottom);return[side*q.half*(.96+.04*Math.sin(Math.PI*full)),y,z]};
 for(const side of [-1,1]){
  surface('paint',zlist.length-1,5,(u,v)=>sidePoint(side,zAt(u),v),side===1);
  surface('paint',zlist.length-1,4,(u,v)=>{const z=zAt(u),q=section(z),t=v*Math.PI/2;return[side*q.half*(.96-.09*(1-Math.cos(t))),q.h-.065+.095*Math.sin(t),z]},side===1);
  for(const wheel of [-m.wheelbase/2,m.wheelbase/2]){surface('dark',24,3,(u,v)=>{const theta=u*Math.PI,z=wheel+Math.cos(theta)*arch,x=sidePoint(side,z,0)[0];return[T.MathUtils.lerp(x,side*(w/2-.25),v),tyre+Math.sin(theta)*arch,z]},side===1);const g=new T.CircleGeometry(arch+.01,32);g.rotateY(side*Math.PI/2);add('dark',g,side*(w/2-.16),tyre,wheel)}
 }
 surface('paint',zlist.length-1,12,(u,v)=>{const z=zAt(u),q=section(z),x=2*v-1;return[q.half*.87*x,q.h+.03+.018*(1-x*x),z]},false,u=>zAt(u)<a+.02||(!m.ute&&zAt(u)>d-.02));
 // End skins close the body without a squared-off box bumper silhouette.
 for(const [z,back]of [[F,false],[R,true]]){const q=section(z),points=[];points.push([-q.half*.96,bottom,z],[q.half*.96,bottom,z]);for(let j=0;j<=8;j++){const t=j/8;points.push([q.half*(.96-.09*(1-Math.cos(t*Math.PI/2))),q.h-.065+.095*Math.sin(t*Math.PI/2),z])}for(let j=1;j<=12;j++){const x=1-j/6;points.push([q.half*.87*x,q.h+.03+.018*(1-x*x),z])}for(let j=7;j>=0;j--){const t=j/8;points.push([-q.half*(.96-.09*(1-Math.cos(t*Math.PI/2))),q.h-.065+.095*Math.sin(t*Math.PI/2),z])}const p=[],centre=[0,(bottom+q.h)/2,z];for(let i=0;i<points.length;i++){const next=points[(i+1)%points.length];p.push(...centre,...(back?points[i]:next),...(back?next:points[i]))}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.computeVertexNormals();add('paint',g)}
 const belt=b+.044,top=H-.072,xb=w*.437,xt=w*.363;
 const windowPoint=(side,u,v)=>{const front=T.MathUtils.lerp(a,A,v),rear=T.MathUtils.lerp(d,B,v),x=T.MathUtils.lerp(xb,xt,v)+.014*Math.sin(Math.PI*v);return[side*x*(1-.012*(2*u-1)**2),T.MathUtils.lerp(belt,top,v)+.026*Math.sin(Math.PI*u)*v,T.MathUtils.lerp(front,rear,u)]};
 for(const side of [-1,1]){
  surface('glass',16,6,(u,v)=>windowPoint(side,u,v),side===1);
  // Thin flush frames follow the glass; they do not project as square beams.
  for(const [end,width,kind]of [[0,.035,'paint'],[1,m.wagon?.085:.12,'paint']])surface(kind,2,12,(u,v)=>{const q=windowPoint(side,end===0?u*width/(d-a):1-u*width/(d-a),v);q[0]+=side*.004;return q},side===-1&&end===0||side===1&&end===1);
  const div=m.ute?.62:.47;surface('dark',2,10,(u,v)=>{const q=windowPoint(side,div+(u-.5)*.018,v);q[0]+=side*.005;return q},side===1);
  if(m.wagon)surface('paint',2,10,(u,v)=>{const q=windowPoint(side,.80+(u-.5)*.022,v);q[0]+=side*.005;return q},side===1);
  tube('dark',Array.from({length:17},(_,i)=>windowPoint(side,i/16,0)),.009);
  const doors=m.ute?[.54]:[.47,.88];for(const u of doors){const z=T.MathUtils.lerp(a,d,u),lo=cut(z)+.02,q=section(z);tube('dark',Array.from({length:9},(_,i)=>{const y=T.MathUtils.lerp(lo,q.h-.07,i/8),v=(y-cut(z))/(q.h-.065-cut(z));const p=sidePoint(side,z,v);p[0]+=side*.002;return p}),.002);
   const y=b-.075,v=(y-cut(z))/(q.h-.065-cut(z)),p=sidePoint(side,z-.14,T.MathUtils.clamp(v,0,1));rounded(m.plain?'dark':'chrome',p[0]+side*.009,y,z-.14,.016,.026,.135,.006);
  }
  const mx=side*(w/2+.035);tube('dark',[[side*xb,belt+.05,a+.14],[mx,belt+.11,a+.22]],.015);sphere('paint',mx,belt+.12,a+.22,.084,.052,.105);sphere('chrome',mx+side*.076,belt+.12,a+.24,.007,.038,.074);
  surface('paint',16,3,(u,v)=>{const q=windowPoint(side,u,1),z=T.MathUtils.lerp(A,B,u),roof=[side*xt*(1-.024*(2*u-1)**2),H-.045+.04*Math.sin(Math.PI*u),z];return q.map((n,i)=>T.MathUtils.lerp(n,roof[i],v))},side===1);
 }
 for(const back of [false,true])surface('glass',18,8,(u,v)=>{const x=2*u-1;return[x*T.MathUtils.lerp(xb*.988,xt*.988,v),T.MathUtils.lerp(belt,top,v)+.018*(1-x*x)*v,T.MathUtils.lerp(back?d:a,back?B:A,v)+(back?1:-1)*.035*(1-x*x)*Math.sin(Math.PI*v)]},!back);
 surface('paint',16,14,(u,v)=>{const x=2*v-1;return[xt*x*(1-.024*(2*u-1)**2),H-.045+.04*Math.sin(Math.PI*u)+.025*(1-x*x),T.MathUtils.lerp(A,B,u)]});
 for(const back of [false,true])surface('paint',16,3,(u,v)=>{const x=2*u-1,z=back?B:A;return[x*xt*(.988+.012*v),T.MathUtils.lerp(top+.018*(1-x*x),H-.045+.025*(1-x*x),v),z]},!back);
 // Fine bonnet shut lines, low-profile wipers and recessed side mouldings.
 for(const side of [-1,1]){
  tube('dark',Array.from({length:12},(_,i)=>{const z=T.MathUtils.lerp(F+.25,a-.10,i/11),q=section(z);return[side*q.half*.73,q.h+.03+.018*(1-.73**2)+.001,z]}),.0017);
  tube('dark',[[side*.12,belt+.015,a+.03],[side*.38,belt+.065,a+.10]],.006);
  const z0=a+.10,z1=m.ute?d+.03:R-.30;surface('dark',24,1,(u,v)=>{const z=T.MathUtils.lerp(z0,z1,u),q=section(z),y=b-.20+(v-.5)*.025,lo=cut(z);const t=T.MathUtils.clamp((y-lo)/(q.h-.065-lo),0,1);return[side*(Math.abs(sidePoint(side,z,t)[0])+.002),Math.max(y,lo+.006),z]},side===1);
 }
 if(m.ute){ // A separate tub with visible inner skins, not a raised solid block.
  rounded('dark',0,b-.14,1.30,w-.20,.035,1.62,.008);
  for(const side of [-1,1])rounded('paint',side*(w/2-.05),b+.075,1.32,.08,.30,1.76,.018);
  for(const z of [.45,R-.07])rounded('paint',0,b+.075,z,w-.10,.30,.06,.018);
  for(let j=0;j<8;j++)rounded('dark',-.58+j*.165,b-.11,1.30,.025,.015,1.48,.004);
 }
 // Rounded sidewalls, inset rims, brake discs, spokes/steel slots and five lug nuts.
 for(const side of [-1,1])for(const z of [-m.wheelbase/2,m.wheelbase/2]){
  const x=side*(w/2-.115),depth=m.ute?.23:.205,face=x+side*(depth/2-.01);
  const profile=[[rim-.015,-depth/2+.018],[tyre*.88,-depth/2],[tyre*.98,-depth*.36],[tyre,-depth*.20],[tyre,depth*.20],[tyre*.98,depth*.36],[tyre*.88,depth/2],[rim-.015,depth/2-.018]];
  const rubber=new T.LatheGeometry(profile.map(p=>new T.Vector2(...p)),32);rubber.rotateZ(Math.PI/2);add('rubber',rubber,x,tyre,z);
  const disk=(kind,radius,xx,thickness=.012)=>{const g=new T.CylinderGeometry(radius,radius,thickness,24);g.rotateZ(Math.PI/2);add(kind,g,xx,tyre,z)};
  disk('dark',rim,x,.18);disk('chrome',rim*.80,face-side*.032);
  const ring=new T.TorusGeometry(rim-.008,.011,6,32);ring.rotateY(Math.PI/2);add('chrome',ring,face,tyre,z);
  if(m.plain||m.ute){disk('chrome',rim-.022,face);for(let j=0;j<6;j++){const t=j*Math.PI/3;sphere('dark',face+side*.008,tyre+Math.cos(t)*rim*.64,z+Math.sin(t)*rim*.64,.003,.024,.033)}}
  else for(let j=0;j<5;j++){const t=j*Math.PI*2/5,g=rounded('chrome',0,0,0,.018,rim-.028,.032,.006);g.rotateX(t);g.translate(face,tyre+Math.cos(t)*rim*.48,z+Math.sin(t)*rim*.48)}
  disk('chrome',.046,face+side*.008,.025);for(let j=0;j<5;j++){const t=j*Math.PI*2/5;const g=new T.CylinderGeometry(.009,.009,.015,6);g.rotateZ(Math.PI/2);add('chrome',g,face+side*.023,tyre+Math.cos(t)*.031,z+Math.sin(t)*.031)}
 }
 // Shallow, curved lens skins share one contour with the indicator/reversing sections.
 const lampW=m.lights==='square'?.30:m.lights==='small'?.36:.49,lampH=m.lights==='square'?.17:.108,lightY=b-.125;
 const lens=(kind,side,cx,cy,width,height,back=false,from=0,to=1,pad=0)=>{const W=width+pad*2,H=height+pad*2;surface(kind,16,6,(u,v)=>{u=T.MathUtils.lerp(from,to,u);const edge=Math.min(u,1-u)*W,r=Math.min(.024,H*.28),half=edge<r?H/2-r+Math.sqrt(Math.max(0,r*r-(r-edge)**2)):H/2;const sweep=(back?.027:.010)*u**3,bulge=.0035*Math.sin(Math.PI*u)*Math.sin(Math.PI*v);return[side*(cx+(u-.5)*W),cy+(v-.5)*2*half+(m.ute?0:.008*(u-.5)),(back?R+.004:F-.004)+(back?-1:1)*sweep+(back?1:-1)*(bulge+(kind==='dark'?-.001:.001))]},back?side===-1:side===1)};
 for(const side of [-1,1]){
  const cx=w/2-lampW/2-.10;
  lens('dark',side,cx,lightY,lampW,lampH,false,0,1,.004);
  lens('front',side,cx,lightY,lampW,lampH,false,0,.85);
  lens('amber',side,cx,lightY,lampW,lampH,false,.855,1);
  if(m.lights==='round')for(const offset of [.30,.55]){const g=new T.SphereGeometry(1,28,10);g.scale(.087,.087,.006);add('rear',g,side*offset,b-.12,R+.005)}
  else{const width=m.verticalRear?.125:m.ute?.15:lampW,height=m.verticalRear?.29:m.ute?.25:.117,rearX=w/2-(m.verticalRear?.13:m.ute?.16:lampW/2+.10);
   lens('dark',side,rearX,b-.12,width,height,true,0,1,.004);
   if(m.verticalRear)lens('rear',side,rearX,b-.12,width,height,true);else for(const [from,to]of [[0,.04],[.20,.76],[.98,1]])lens('rear',side,rearX,b-.12,width,height,true,from,to);
   if(!m.verticalRear){lens('amber',side,rearX,b-.12,width,height,true,.76,.98);lens('chrome',side,rearX,b-.12,width,height,true,.04,.20)}
  }
 }
 const grilleW=w*(m.id==='skyline'?.23:.32);rounded('dark',0,lightY,F-.017,grilleW,.105,.028,.012);for(let j=0;j<2;j++)rounded('chrome',0,lightY-.025+j*.05,F-.034,grilleW-.035,.009,.008,.002);sphere('chrome',0,lightY,F-.045,.016,.021,.006);
 for(const [z,back]of [[F-.005,false],[R+.005,true]]){
  const y=m.ute?.60:.44;rounded('paint',0,y,z,w*.91,.18,.14,.035);rounded('dark',0,y+.015,z+(back?.065:-.065),w*.88,.047,.025,.010);
  const plate=new T.PlaneGeometry(.365,.105);if(!back)plate.rotateY(Math.PI);add('plate',plate,0,back&&!m.ute?b-.16:y-.015,z+(back?.082:-.082));
 }
 sphere('chrome',0,b-.025,R+.016,.022,.015,.005);
 if(!m.ute){for(const side of [-1,1])tube('dark',[[side*w*.31,.53,R+.002],[side*w*.31,b-.04,R+.002],[side*w*.24,b+.006,R-.010]],.0018);rounded('dark',0,b-.055,R+.020,.13,.015,.010,.003)}
 if(m.wagon||m.hatch){const v=.22,y=T.MathUtils.lerp(belt,top,v),z=T.MathUtils.lerp(d,B,v)+.035*Math.sin(Math.PI*v);tube('dark',[[.02,y,z+.008],[-.24,y+.015,z+.008]],.006);rounded('rear',0,top-.025,T.MathUtils.lerp(d,B,.94)+.012,.22,.020,.015,.004)}
 rounded('dark',0,m.ute?.47:.325,F-.045,w*.32,.070,.035,.012);
 if(m.spoiler&&m.id==='skyline'){rounded('paint',0,b+.16,R-.29,w*.78,.045,.16,.014);for(const x of [-.48,.48])rounded('paint',x,b+.10,R-.29,.035,.10,.06,.009)}
 if(m.wagon&&!m.plain)for(const x of [-.53,.53])tube('dark',[[x,H+.012,-.35],[x,H+.045,.20],[x,H+.045,1.10],[x,H+.01,1.38]],.013);
 const result={};for(const[k,items]of Object.entries(parts)){const pos=[],normal=[],uv=[];for(const source of items){const g=source.index?source.toNonIndexed():source;pos.push(...g.attributes.position.array);normal.push(...g.attributes.normal.array);if(g.attributes.uv)uv.push(...g.attributes.uv.array);else for(let i=0;i<g.attributes.position.count;i++)uv.push(0,0);if(g!==source)g.dispose();source.dispose()}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(normal,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeBoundingSphere();result[k]=g}return result;
}
// A shared daylight reflection environment; no external textures or network requests.
export function vehicleEnvironment(){const size=64,faces=[];for(let face=0;face<6;face++){const data=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const u=2*(x+.5)/size-1,v=2*(y+.5)/size-1,dir=[[1,-v,-u],[-1,-v,u],[u,1,v],[u,-1,-v],[u,-v,1],[-u,-v,-1]][face],n=Math.hypot(...dir),h=dir[1]/n;const sky=new T.Color(h>0?'#c4d0d8':'#555c58');if(h>0)sky.lerp(new T.Color('#6585a3'),Math.min(1,h));const band=Math.exp(-(((h-.12)/.12)**2))*.26;sky.addScalar(band);sky.convertLinearToSRGB();const i=(y*size+x)*4;data[i]=Math.min(255,sky.r*255);data[i+1]=Math.min(255,sky.g*255);data[i+2]=Math.min(255,sky.b*255);data[i+3]=255}faces.push(new T.DataTexture(data,size,size))}const env=new T.CubeTexture(faces);env.colorSpace=T.SRGBColorSpace;env.needsUpdate=true;return env}
export function vehiclePlateTexture(){if(typeof document==='undefined')return null;const canvas=document.createElement('canvas');canvas.width=512;canvas.height=160;const c=canvas.getContext('2d');c.fillStyle='#e8e9df';c.fillRect(0,0,512,160);c.strokeStyle='#545954';c.lineWidth=5;c.strokeRect(5,5,502,150);c.fillStyle='#171c1b';c.font='bold 113px monospace';c.textAlign='center';c.textBaseline='middle';c.fillText('NUI 02',256,84);const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;return map}

// Prismatic lens and reflector detail stays in a shared texture, rather than raised bars.
export function vehicleLensTexture(kind){
 if(typeof document==='undefined')return null;
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=96;const c=canvas.getContext('2d');
 const base=c.createLinearGradient(0,0,0,96);base.addColorStop(0,'#667178');base.addColorStop(.20,'#b9c1c3');base.addColorStop(.53,'#889398');base.addColorStop(.82,'#c4cbcd');base.addColorStop(1,'#535d64');c.fillStyle=base;c.fillRect(0,0,256,96);
 if(kind==='front')for(const x of [72,181]){const g=c.createRadialGradient(x-12,35,3,x,49,57);g.addColorStop(0,'#e1e5df');g.addColorStop(.30,'#acb6b7');g.addColorStop(.62,'#647078');g.addColorStop(.85,'#bfc8c7');g.addColorStop(1,'#6e7a80');c.fillStyle=g;c.beginPath();c.ellipse(x,48,54,40,0,0,Math.PI*2);c.fill();}
 c.lineWidth=1;for(let x=3;x<256;x+=kind==='front'?5:3){c.strokeStyle='rgba(240,246,247,.09)';c.beginPath();c.moveTo(x,4);c.lineTo(x,92);c.stroke()}
 for(let y=5;y<96;y+=kind==='front'?10:4){c.strokeStyle='rgba(27,38,43,.12)';c.beginPath();c.moveTo(1,y);c.lineTo(255,y);c.stroke()}
 const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;return map;
}
