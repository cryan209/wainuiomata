import * as T from './vendor/three.js';

// Radiata-style pines: a furrowed bole, ascending bark limbs and a crown of needle clumps (crossed alpha cards with rounded normals).
// Four crown shapes share one generated atlas and draw as one instanced mesh each; trees pick a shape from their position.
// Atlas rows: bark 0–64, then four 256×224 needle-clump cells.
const W=512,H=512,BARK=64,CELL_W=256,CELL_H=224,GUTTER=16,INSET=10;
const SHAPES=[
 // Young plantation tree: needles nearly to the ground, conical.
 {base:.2,top:1,radius:.17,clumps:30,thick:.9,stubs:0,profile:t=>.12+.88*Math.pow(1-t,.9)},
 // Mature radiata: clean bole, rounded crown widest just above halfway.
 {base:.5,top:1,radius:.23,clumps:32,thick:1,stubs:5,profile:t=>Math.max(.22,Math.sin(Math.PI*(.12+.86*t)))},
 // Old shelter-belt pine: heavy forked bole and a broad, flat-topped crown.
 {base:.42,top:.93,radius:.31,clumps:38,thick:1.35,stubs:4,fork:true,profile:t=>t<.7?.45+.55*t/.7:1-(t-.7)/.3*.45},
 // Tall forest pine: long bare stem and a narrow, sparse crown.
 {base:.6,top:1,radius:.14,clumps:22,thick:.85,stubs:7,profile:t=>Math.max(.25,Math.sin(Math.PI*(.18+.8*t)))},
];
const WEIGHTS=[.22,.38,.18,.22];
function rng(seed){return()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646}}
let texture;
function pineTexture(){
 if(texture)return texture;
 const data=new Uint8Array(W*H*4),rand=rng(9187);
 const put=(x,y,c,b)=>{x=Math.round(x);y=Math.round(y);if(x<b[0]||x>=b[2]||y<b[1]||y>=b[3])return;const i=(y*W+x)*4;data[i]=c[0];data[i+1]=c[1];data[i+2]=c[2];data[i+3]=255};
 const line=(x0,y0,x1,y1,c,w,b)=>{const steps=Math.ceil(Math.hypot(x1-x0,y1-y0)*2)+1;for(let s=0;s<=steps;s++){const t=s/steps,x=x0+(x1-x0)*t,y=y0+(y1-y0)*t;for(let a=0;a<w;a++)for(let d=0;d<w;d++)put(x+a-(w>>1),y+d-(w>>1),c,b)}};
 const shade=(c,k)=>c.map(v=>Math.max(0,Math.min(255,v*k|0)));
 // Bark: vertical strips broken into grey-brown plates with dark fissures between them.
 const bark=[0,0,W,BARK];for(let x=0;x<W;){const sw=5+Math.floor(rand()*9);for(let y=-Math.floor(rand()*12);y<BARK;){const ph=7+Math.floor(rand()*14),k=.78+rand()*.34,warm=rand()<.3;for(let px=x;px<x+sw;px++)for(let py=y;py<y+ph;py++){const edge=px===x||py===y,ridge=1-Math.abs(px-x-sw/2)/sw*.35;put(px,py,edge?[46,38,33]:shade(warm?[126,98,76]:[104,92,82],k*ridge*(.94+rand()*.12)),bark)}y+=ph}x+=sw}
 // Needle clumps: overlapping brushes of long needles in threes, darker and denser at the heart, sunlit on top.
 const greens=[[22,42,30],[29,52,35],[37,62,40],[46,72,44],[58,84,50],[72,96,56]];
 for(let cell=0;cell<4;cell++){
  const x0=(cell%2)*CELL_W,y0=BARK+Math.floor(cell/2)*CELL_H,b=[x0+GUTTER,y0+GUTTER,x0+CELL_W-GUTTER,y0+CELL_H-GUTTER],cx=x0+CELL_W/2+(rand()-.5)*14,cy=y0+CELL_H*.45;
  const tone=(y,boost=0)=>{const h=(y-y0)/CELL_H,i=Math.max(0,Math.min(greens.length-1,Math.floor(h*4.2+rand()*2.2+boost)));return shade(greens[i],.88+rand()*.22+(cell===1?.06:cell===2?-.05:0))};
  for(let i=0;i<900;i++){const a=rand()*Math.PI*2,r=Math.sqrt(rand())*48,x=cx+Math.cos(a)*r*1.25,y=cy+Math.sin(a)*r,d=rand()*Math.PI*2,l=8+rand()*10;line(x,y,x+Math.cos(d)*l,y+Math.sin(d)*l,shade(greens[Math.floor(rand()*2)],.7+rand()*.25),1,b)}
  const brushes=10+Math.floor(rand()*4);
  for(let k=0;k<brushes;k++){
   // Brushes fan outward and upward; reach stops short of the cell edge so outlines stay ragged rather than cut.
   const a=-.35+rand()*(Math.PI+.7),dx=Math.cos(a),dy=Math.sin(a),room=Math.min(dx>0?(b[2]-cx)/dx:dx<0?(b[0]-cx)/dx:1e3,dy>0?(b[3]-cy)/dy:dy<0?(b[1]-cy)/dy:1e3)-24,len=Math.max(22,Math.min(room,48+rand()*44)),sx=cx+(rand()-.5)*20,sy=cy+(rand()-.5)*14,ex=sx+dx*len,ey=sy+dy*len;
   line(sx,sy,ex,ey,[70,54,40],2,b);
   for(let s=len*.2;s<len+6;s+=1.7){const px=sx+dx*Math.min(s,len),py=sy+dy*Math.min(s,len),f=s/len,tip=s>len;for(let n=0;n<3;n++){const side=rand()<.5?-1:1,ang=a+side*(tip?rand()*1.2:.35+rand()*1.15),l=(14+rand()*9)*(.75+.25*f);line(px,py,px+Math.cos(ang)*l,py+Math.sin(ang)*l,tone(py,tip?.8:0),1,b)}}
  }
 }
 texture=new T.DataTexture(data,W,H,T.RGBAFormat);texture.colorSpace=T.SRGBColorSpace;texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.anisotropy=4;texture.needsUpdate=true;return texture;
}
const geometries=[],lods=[];
export function pineGeometry(variant=1){
 if(geometries[variant])return geometries[variant];
 const shape=SHAPES[variant],rand=rng(4421+variant*977),positions=[],normals=[],uvs=[],colors=[],up=new T.Vector3(0,1,0);
 const vertex=(p,n,u,v,c)=>{positions.push(p.x,p.y,p.z);normals.push(n.x,n.y,n.z);uvs.push(u,v);colors.push(c[0],c[1],c[2])};
 // A tapered bark cylinder between two points; bark repeats down the limb.
 function limb(a,b,r0,r1,segments,shadeK=1){const len=a.distanceTo(b),g=new T.CylinderGeometry(r1,r0,len,segments,1,true),q=new T.Quaternion().setFromUnitVectors(up,b.clone().sub(a).normalize());g.applyQuaternion(q);g.translate((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);const flat=g.toNonIndexed(),p=flat.getAttribute('position'),n=flat.getAttribute('normal'),uv=flat.getAttribute('uv');for(let i=0;i<p.count;i++)vertex(new T.Vector3().fromBufferAttribute(p,i),new T.Vector3().fromBufferAttribute(n,i),uv.getX(i),uv.getY(i)*Math.min(1,len*4)*BARK/H,[shadeK,shadeK,shadeK]);g.dispose();flat.dispose()}
 // Bole: a gently leaning, slightly crooked stem in three pieces, flared at the root.
 const lean=new T.Vector3((rand()-.5)*.05,0,(rand()-.5)*.05),trunkAt=y=>new T.Vector3(lean.x*y*y+Math.sin(y*9+variant)*.004,y,lean.z*y*y),r=.024*shape.thick,stemTop=shape.top-.05;
 const knots=[0,.3,.62,stemTop];for(let i=0;i<3;i++)limb(trunkAt(knots[i]),trunkAt(knots[i+1]),r*(1-knots[i]*.8),r*(1-knots[i+1]*.8),8);
 for(let i=0;i<5;i++){const a=i*Math.PI*2/5+rand()*.4;limb(new T.Vector3(Math.cos(a)*r*1.45,0,Math.sin(a)*r*1.45),trunkAt(.045),r*.4,r*.2,4,.9)}
 const leaders=[];if(shape.fork){const from=trunkAt(.55),to=from.clone().add(new T.Vector3(.09+rand()*.04,.33,(rand()-.5)*.08));limb(from,to,r*.55,r*.2,6);leaders.push([from,to])}
 // Clumps fill the crown envelope, mostly near its surface with a few inside so it never reads hollow.
 const clumps=[],crownHeight=shape.top-shape.base;
 for(let i=0,count=Math.round(shape.clumps*1.3);i<count;i++){
  const t=Math.min(1,(i+rand()*.9)/count),y=shape.base+t*crownHeight,reach=shape.radius*shape.profile(t)*(.78+rand()*.4),inner=i%5===4,dist=reach*(inner?.25+rand()*.25:.6+rand()*.5),a=i*2.39996+(rand()-.5)*.7,lead=leaders.length&&rand()<.35?leaders[0]:null;
  let center=trunkAt(y).add(new T.Vector3(Math.cos(a)*dist,0,Math.sin(a)*dist));if(lead){const k=.5+rand()*.5;center=lead[0].clone().lerp(lead[1],k).add(new T.Vector3(Math.cos(a)*dist*.6,0,Math.sin(a)*dist*.6))}
  clumps.push({center,size:(.034+reach*.34)*(.75+rand()*.5),t,dist,reach,a,cell:Math.floor(rand()*4),spin:rand()*Math.PI,lead})}
 clumps.push({center:trunkAt(shape.top-.02).add(new T.Vector3(0,.012,0)),size:.045,t:1,dist:0,reach:.05,a:0,cell:1,spin:0});
 clumps.sort((p,q)=>q.size-p.size);
 // Ascending limbs from the stem to each outer clump, plus a few dead stubs below the crown.
 const branches=[];
 for(const c of clumps){if(c.dist<.03||c.lead)continue;const start=trunkAt(Math.max(.05,c.center.y-c.dist*(.45+rand()*.3)));branches.push([start,start.clone().lerp(c.center,.85),.004+c.size*.06,.0025])}
 for(let i=0;i<shape.stubs;i++){const y=.22+rand()*(shape.base-.24),a=rand()*Math.PI*2,l=.025+rand()*.04,s=trunkAt(y);branches.push([s,s.clone().add(new T.Vector3(Math.cos(a)*l,-l*.25,Math.sin(a)*l)),.004,.0015])}
 for(const c of clumps){const k=.55+c.t*.32+(c.dist/Math.max(.01,c.reach))*.1+(rand()-.5)*.08;c.col=[k*.97,k,k*.94]}
 function clumpCards(c,scale,uprights){
  const s=c.size*scale,cx=(c.cell%2)*CELL_W,cy=BARK+Math.floor(c.cell/2)*CELL_H,u0=(cx+INSET)/W,u1=(cx+CELL_W-INSET)/W,v0=(cy+INSET)/H,v1=(cy+CELL_H-INSET)/H,out=c.center.clone().sub(trunkAt(c.center.y)).setY(0);
  if(out.lengthSq()>1e-6)out.normalize();
  const normal=p=>p.clone().sub(c.center).add(new T.Vector3(0,s*.55,0)).addScaledVector(out,s*.6).normalize();
  const quad=(a,b,cc,d)=>{for(const[p,u,v]of [[a,u0,v0],[b,u1,v0],[cc,u1,v1],[a,u0,v0],[cc,u1,v1],[d,u0,v1]])vertex(p,normal(p),u,v,c.col)};
  // Crossed upright cards (clump heart sits 45% up each card) and one tilted cap for views from above.
  for(let j=0;j<uprights;j++){const a=c.spin+j*Math.PI/uprights,side=new T.Vector3(Math.cos(a),0,Math.sin(a)).multiplyScalar(s),low=c.center.clone().add(new T.Vector3(0,-s*.9,0)),high=c.center.clone().add(new T.Vector3(0,s*1.1,0));quad(low.clone().sub(side),low.clone().add(side),high.clone().add(side),high.clone().sub(side))}
  const f=new T.Vector3(Math.cos(c.spin),0,Math.sin(c.spin)).multiplyScalar(s),g=new T.Vector3(-Math.sin(c.spin),0,Math.cos(c.spin)).multiplyScalar(s),h=c.center.clone().add(new T.Vector3(0,s*.15,0)),tilt=new T.Vector3(0,s*.25,0);
  quad(h.clone().sub(f).sub(g).sub(tilt),h.clone().add(f).sub(g).sub(tilt),h.clone().add(f).add(g).add(tilt),h.clone().sub(f).add(g).add(tilt));
 }
 for(const c of clumps)clumpCards(c,1,3);
 for(const[a,b,r0,r1]of branches)limb(a,b,r0,r1,4,.85);
 // Distant model, drawn on its own from the end of the buffer: a three-sided stem and ten enlarged clumps spread up the crown (~70 triangles).
 const far=positions.length/3,byHeight=[...clumps].sort((p,q)=>p.center.y-q.center.y),keep=Math.min(10,byHeight.length);
 limb(trunkAt(0),trunkAt(stemTop),r,r*.3,3);if(leaders.length)limb(leaders[0][0],leaders[0][1],r*.55,r*.2,3);
 for(let i=0;i<keep;i++)clumpCards(byHeight[Math.round(i*(byHeight.length-1)/Math.max(1,keep-1))],1.45,2);
 lods[variant]={far,end:positions.length/3};
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.computeBoundingSphere();
 return geometries[variant]=geometry;
}
let material,depth;const time={value:0};
// Crowns sway a little more the higher they are.
const SWAY='#include <begin_vertex>\n#ifdef USE_INSTANCING\nfloat pineSeed=instanceMatrix[3].x*.13+instanceMatrix[3].z*.17;transformed.x+=sin(pineTime*.9+pineSeed)*.006*max(0.,position.y-.3);transformed.z+=cos(pineTime*.7+pineSeed)*.004*max(0.,position.y-.3);\n#endif';
function materials(){
 if(material)return;const map=pineTexture();
 const sway=shader=>{shader.uniforms.pineTime=time;shader.vertexShader='uniform float pineTime;\n'+shader.vertexShader.replace('#include <begin_vertex>',SWAY)};
 material=new T.MeshLambertMaterial({map,vertexColors:true,alphaTest:.45,side:T.DoubleSide});
 // Clump normals are authored to point out of a rounded crown, so they are not flipped for back faces.
 material.onBeforeCompile=shader=>{sway(shader);shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>','#include <normal_fragment_begin>\nnormal=normalize(vNormal);')};
 depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,map,alphaTest:.45,side:T.DoubleSide});depth.onBeforeCompile=sway;
}
const hash=(x,z,k)=>{const v=Math.sin(x*12.9898+z*78.233+k*37.719)*43758.5453;return v-Math.floor(v)};
const scaled=new T.Matrix4(),stretch=new T.Matrix4(),tint=new T.Color();
// A set of pines placed like one InstancedMesh: setMatrixAt(i, matrix), then computeBoundingSphere() once all are placed.
class PineSet extends T.Group{
 constructor(count){
  super();materials();this.name='Radiata pines';this.slots=new Map();
  // Instances carry the placement; the group and its meshes stay at the origin, so skip their per-frame matrix rebuild.
  this.matrixAutoUpdate=false;
  this.meshes=SHAPES.map((_,v)=>{const shared=pineGeometry(v),geo=new T.BufferGeometry();for(const name in shared.attributes)geo.setAttribute(name,shared.attributes[name]);geo.boundingSphere=shared.boundingSphere;const mesh=new T.InstancedMesh(geo,material,count);mesh.count=0;mesh.matrixAutoUpdate=false;mesh.customDepthMaterial=depth;mesh.name=this.name;this.add(mesh);return mesh});
  this.meshes[0].onBeforeRender=()=>{time.value=performance.now()*.001};
 }
 setMatrixAt(i,matrix){
  const x=matrix.elements[12],z=matrix.elements[14];let slot=this.slots.get(i);
  if(!slot){let pick=hash(x,z,1),v=0;while(v<WEIGHTS.length-1&&pick>WEIGHTS[v])pick-=WEIGHTS[v++];slot=[v,this.meshes[v].count++];this.slots.set(i,slot)}
  // Per-tree crown width, height and needle tint so neighbours of the same shape still differ.
  const width=.82+hash(x,z,2)*.36,height=.9+hash(x,z,3)*.2,green=hash(x,z,4);stretch.makeScale(width,height,width);scaled.multiplyMatrices(matrix,stretch);
  const mesh=this.meshes[slot[0]];mesh.setMatrixAt(slot[1],scaled);mesh.setColorAt(slot[1],tint.setRGB(.9+green*.14,.94+green*.1,.86+(1-green)*.12));
 }
 computeBoundingSphere(){for(const m of this.meshes){m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;m.computeBoundingSphere()}}
 setDetail(near){this.meshes.forEach((m,v)=>{const{far,end}=lods[v];m.geometry.setDrawRange(near?0:far,near?far:end-far)})}
}
export function createPines(count){return new PineSet(count)}
