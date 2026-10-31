import * as T from './vendor/three.js';

// A unit-height pine: bark trunk, dense needle core and alpha-tested drooping branch sprays, batched into one draw call.
// One generated atlas: bark strip (v 0–.125), dense needles for the core (.125–.375), a single branch spray (.375–1).
const SIZE=256,BARK=.125,DENSE=.375,SPRAY=[.41,.98];
let geometry,texture,coreVertices=0;
function rng(seed){return()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646}}
function pineTexture(){
 if(texture)return texture;
 const data=new Uint8Array(SIZE*SIZE*4),rand=rng(9187);
 const put=(x,y,c,y0,y1)=>{x=Math.round(x);y=Math.round(y);if(x<0||x>=SIZE||y<y0||y>=y1)return;const i=(y*SIZE+x)*4;data[i]=c[0];data[i+1]=c[1];data[i+2]=c[2];data[i+3]=255};
 const line=(x0,y0,x1,y1,c,w,ya,yb)=>{const steps=Math.ceil(Math.hypot(x1-x0,y1-y0)*2)+1;for(let s=0;s<=steps;s++){const t=s/steps,x=x0+(x1-x0)*t,y=y0+(y1-y0)*t;for(let a=0;a<w;a++)for(let b=0;b<w;b++)put(x+a-(w>>1),y+b-(w>>1),c,ya,yb)}};
 const greens=[[38,62,40],[46,74,46],[56,86,52],[66,98,58],[80,112,66],[94,124,74]],shade=(c,k)=>c.map(v=>Math.min(255,v*k|0));
 // Bark: furrowed vertical plates with darker cracks.
 const barkTop=SIZE*BARK;for(let x=0;x<SIZE;x++){const furrow=.75+.25*Math.sin(x*.55+Math.sin(x*.13)*3);for(let y=0;y<barkTop;y++){const plate=(Math.floor(y/6+Math.sin(x*.21)*1.5)%2)?1:.9,k=furrow*plate*(.9+rand()*.2);put(x,y,shade([106,90,76],k),0,barkTop)}}
 for(let i=0;i<70;i++){const x=rand()*SIZE,y=rand()*barkTop;line(x,y,x+rand()*2-1,y+3+rand()*6,[62,48,38],1,0,barkTop)}
 // Dense core: overlapping needles on a dark ground so the cones never read as flat plastic.
 const denseTop=SIZE*DENSE;for(let x=0;x<SIZE;x++)for(let y=barkTop;y<denseTop;y++)put(x,y,[30,48,34],barkTop,denseTop);
 for(let i=0;i<2600;i++){const x=rand()*SIZE,y=barkTop+rand()*(denseTop-barkTop),a=-Math.PI/2+(rand()-.5)*1.6,l=3+rand()*5,c=shade(greens[Math.floor(rand()*greens.length)],.8+rand()*.35);line(x,y,x+Math.cos(a)*l,y+Math.sin(a)*l,c,1,barkTop,denseTop)}
 // Branch spray: trunk end at u=0, tip at u=1, drooping twigs clothed in needle pairs.
 const top=SIZE*SPRAY[1],bottom=SIZE*SPRAY[0],mid=(top+bottom)/2,needles=(x0,y0,x1,y1,scale)=>{const len=Math.hypot(x1-x0,y1-y0),dx=(x1-x0)/len,dy=(y1-y0)/len;for(let s=0;s<len;s+=1.6){const x=x0+dx*s,y=y0+dy*s,tip=s/len,l=(4+rand()*3)*scale*(1-tip*.35);for(const side of [-1,1]){const a=Math.atan2(dy,dx)+side*(.95+rand()*.35),c=shade(greens[Math.min(greens.length-1,Math.floor(rand()*3+tip*3))],.85+rand()*.3);line(x,y,x+Math.cos(a)*l,y+Math.sin(a)*l,c,1,bottom,top)}}};
 const tipX=SIZE-14,tipY=mid-12,branchAt=t=>[4+(tipX-4)*t,mid+(tipY-mid)*t*t];
 for(let t=.1;t<.95;t+=.045+rand()*.04){const[x,y]=branchAt(t),reach=((1-t)*44+10)*(.7+rand()*.45);for(const side of [-1,1]){if(rand()<.18)continue;const a=side*(.55+rand()*.6)-.1,bend=(rand()-.5)*.5,mx=x+Math.cos(a)*reach*.4,my=y+Math.sin(a)*reach*.4,ex=mx+Math.cos(a+bend)*reach*.4,ey=my+Math.sin(a+bend)*reach*.4;line(x,y,mx,my,[88,70,52],1,bottom,top);line(mx,my,ex,ey,[88,70,52],1,bottom,top);needles(x,y,mx,my,.9+(1-t)*.3);needles(mx,my,ex,ey,.8+(1-t)*.3)}}
 for(let s=0;s<1;s+=.01){const[x0,y0]=branchAt(s),[x1,y1]=branchAt(s+.01);line(x0,y0,x1,y1,[96,76,56],s<.5?3:2,bottom,top)}
 needles(...branchAt(.3),tipX,tipY,1.15);
 texture=new T.DataTexture(data,SIZE,SIZE,T.RGBAFormat);texture.colorSpace=T.SRGBColorSpace;texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.anisotropy=4;texture.needsUpdate=true;return texture;
}
export function pineGeometry(){
 if(geometry)return geometry;
 const positions=[],normals=[],uvs=[],colors=[],rand=rng(4421);
 function part(g,x,y,z,sx,sy,sz,shade,v0,v1){
  g.scale(sx,sy,sz);g.translate(x,y,z);const flat=g.toNonIndexed(),p=flat.getAttribute('position'),n=flat.getAttribute('normal'),uv=flat.getAttribute('uv'),c=new T.Color(shade);
  positions.push(...p.array);normals.push(...n.array);for(let i=0;i<p.count;i++){uvs.push(uv.getX(i),v0+uv.getY(i)*(v1-v0));colors.push(c.r,c.g,c.b)}g.dispose();flat.dispose();
 }
 part(new T.CylinderGeometry(.022,.045,1,9),0,.36,0,1,.72,1,'#ffffff',0,BARK);
 // Broad exposed roots and a long visible bole distinguish mature pines up close.
 for(let i=0;i<5;i++){const a=i*Math.PI*2/5;part(new T.ConeGeometry(.022,.12,4),Math.cos(a)*.026,.045,Math.sin(a)*.026,1,1,1,'#e4dccf',0,BARK)}
 // A slimmer opaque core fills the crown; the branch sprays below give it a ragged, needled outline.
 for(let i=0;i<5;i++){const r=.13-i*.022,h=.26-i*.017;part(new T.ConeGeometry(r,h,8),0,.5+i*.09,0,1,1,.88+(i%2)*.12,['#c9d4c4','#d4ddcc','#dde5d2','#e4ebd8','#ecf1de'][i],BARK+.03,DENSE-.03)}
 // Whorls of drooping branches, each a flattened spray crossed with a near-vertical one so it reads from the side and from above.
 const whorls=11,up=new T.Vector3(0,1,0);
 function quad(a,b,c,d,n,shade){for(const[q,u,v]of [[a,0,SPRAY[0]],[b,1,SPRAY[0]],[c,1,SPRAY[1]],[a,0,SPRAY[0]],[c,1,SPRAY[1]],[d,0,SPRAY[1]]]){positions.push(q.x,q.y,q.z);normals.push(n.x,n.y,n.z);uvs.push(u,v);colors.push(shade,shade*1.02,shade*.98)}}
 // Even whorls come first so distant pines keep the same outline with half the branch cards.
 for(const k of [...Array(whorls).keys()].sort((a,b)=>a%2-b%2||a-b)){
 if(k===1)coreVertices=positions.length/3;
  const t=k/(whorls-1),y=.42+t*.5,reach=.25*Math.pow(1-t*.9,.9)+.035,count=t<.5?7:t<.8?6:5,offset=k*2.39996;
  for(let j=0;j<count;j++){
   const angle=offset+j*Math.PI*2/count+(rand()-.5)*.5,length=reach*(.85+rand()*.3),droop=length*(.22+(1-t)*.25),d=new T.Vector3(Math.cos(angle),0,Math.sin(angle)),side=new T.Vector3(-d.z,0,d.x);
   const base=new T.Vector3(0,y,0).addScaledVector(d,.012),tip=base.clone().addScaledVector(d,length).add(new T.Vector3(0,-droop,0)),width=length*.62,shade=.78+t*.24+(rand()-.5)*.1,n=d.clone().multiplyScalar(.55).add(up).normalize();
   const flat=side.clone().multiplyScalar(width/2).add(new T.Vector3(0,width*.12,0));quad(base.clone().sub(flat),tip.clone().sub(flat),tip.clone().add(flat),base.clone().add(flat),n,shade);
   const rise=up.clone().multiplyScalar(.8).addScaledVector(side,.35).normalize().multiplyScalar(width*.4);quad(base.clone().sub(rise),tip.clone().sub(rise),tip.clone().add(rise),base.clone().add(rise),n,shade*.94);
  }
 }
 // Leader tuft at the crown tip.
 for(let j=0;j<3;j++){const a=j*Math.PI*2/3,d=new T.Vector3(Math.cos(a)*.03,.1,Math.sin(a)*.03),side=new T.Vector3(-Math.sin(a),0,Math.cos(a)).multiplyScalar(.03),base=new T.Vector3(0,.9,0),tip=base.clone().add(d);quad(base.clone().sub(side),tip.clone().sub(side),tip.clone().add(side),base.clone().add(side),up,1)}
 geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.computeBoundingSphere();return geometry;
}
// Vertex count of trunk, core and alternate whorls: a draw range for distant pines.
export function pineCoreVertices(){pineGeometry();return coreVertices}
let material,depth;
export function createPines(count){
 const shared=pineGeometry(),geo=new T.BufferGeometry();for(const name in shared.attributes)geo.setAttribute(name,shared.attributes[name]);geo.boundingSphere=shared.boundingSphere;
 if(!material){const map=pineTexture();material=new T.MeshLambertMaterial({map,vertexColors:true,alphaTest:.5,side:T.DoubleSide});depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,map,alphaTest:.5,side:T.DoubleSide})}
 const mesh=new T.InstancedMesh(geo,material,count);mesh.customDepthMaterial=depth;mesh.name='Mature thick-trunk pines';return mesh;
}
