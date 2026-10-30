import * as T from './vendor/three.js';
function texture(canvas,repeatAcross=true){const t=new T.CanvasTexture(canvas);t.wrapS=repeatAcross?T.RepeatWrapping:T.ClampToEdgeWrapping;t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.anisotropy=8;t.colorSpace=T.SRGBColorSpace;return t}
export function makeRoadTextures(){
 const roads=[],n=1024,base=[[66,67,65],[79,79,74],[88,87,80],[78,77,72],[72,73,69],[139,133,114],[155,153,143]];
 for(let style=0;style<7;style++){const canvas=document.createElement('canvas');canvas.width=canvas.height=n;const c=canvas.getContext('2d'),image=c.createImageData(n,n);let seed=501+style*91;const r=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646},field=Float32Array.from({length:32*32},()=>r());
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){const gx=x/32,gy=y/32,ix=Math.floor(gx),iy=Math.floor(gy),fx=gx-ix,fy=gy-iy,at=(a,b)=>field[(b%32)*32+a%32],cloud=(at(ix,iy)*(1-fx)+at(ix+1,iy)*fx)*(1-fy)+(at(ix,iy+1)*(1-fx)+at(ix+1,iy+1)*fx)*fy,grain=r(),spark=r()>.976?14:0,variation=(grain-.5)*(style===2?32:style===5?45:17)+(cloud-.5)*9+spark,k=(y*n+x)*4;for(let ch=0;ch<3;ch++)image.data[k+ch]=base[style][ch]+variation;image.data[k+3]=255}c.putImageData(image,0,0);
  if(style<5){
   // Broad, soft wheel polishing; no painted-looking parallel rectangles.
   for(const x of [.22,.36,.64,.78]){const g=c.createLinearGradient((x-.045)*n,0,(x+.045)*n,0);g.addColorStop(0,'#10120f00');g.addColorStop(.5,style===0?'#10120f08':'#10120f10');g.addColorStop(1,'#10120f00');c.fillStyle=g;c.fillRect((x-.045)*n,0,.09*n,n)}
   if(style>0)for(let k=0;k<(style===3?7:3);k++){let x=r()*n,y=r()*n;c.strokeStyle=style===3?'#24251f65':'#34352e50';c.lineWidth=style===3?1.6:.8;c.beginPath();c.moveTo(x,y);for(let j=0;j<14;j++){x+=r()*18-9;y+=r()*13-3;c.lineTo(x,y)}c.stroke()}
   if(style===3||style===4)for(let k=0;k<2;k++){const x=80+r()*800,y=r()*n,w=35+r()*100,h=45+r()*90;c.save();c.translate(x,y);c.rotate((r()-.5)*.08);c.fillStyle='#292b2520';c.beginPath();c.moveTo(-w/2,-h/2);c.lineTo(w/2-4,-h/2+2);c.lineTo(w/2,h/2);c.lineTo(-w/2+3,h/2-2);c.closePath();c.shadowColor='#1e201b30';c.shadowBlur=5;c.fill();c.restore()}
  }
  if(style===5)for(let i=0;i<16000;i++){const x=r()*n,y=r()*n;c.fillStyle=['#c8bea4aa','#706e6090','#a89e8490','#e0d2b180'][i%4];c.beginPath();c.ellipse(x,y,1+r()*2.5,1+r()*1.4,r()*Math.PI,0,Math.PI*2);c.fill()}
  if(style===6){for(let y=0;y<n;y+=16)for(let x=(y/16)%2?-16:0;x<n;x+=32){const v=145+Math.floor(r()*18);c.fillStyle=`rgb(${v},${v-1},${v-9})`;c.fillRect(x+1,y+1,30,14);c.fillStyle='#ffffff0a';c.fillRect(x+2,y+2,28,1)}}
  roads.push(texture(canvas,false));
 }
 const paint=document.createElement('canvas');paint.width=paint.height=256;const pc=paint.getContext('2d');pc.fillStyle='#e4e0cd';pc.fillRect(0,0,256,256);let seed=81;for(let i=0;i<6500;i++){seed=seed*16807%2147483647;const x=seed%256;seed=seed*16807%2147483647;const y=seed%256;pc.fillStyle=i%9?'#67685e18':'#45474066';pc.fillRect(x,y,1,i%5?1:2)}roads.markings=texture(paint);
 return roads;
}
// World-space metre-scale detail remains consistent across road widths and junction UVs.
export function applyRoadDetail(material,style){
 const previous=material.onBeforeCompile,oldKey=material.customProgramCacheKey.bind(material);material.extensions??={};material.extensions.derivatives=true;
 material.onBeforeCompile=shader=>{previous?.call(material,shader);shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vRoadSurface;').replace('#include <project_vertex>','#include <project_vertex>\nvRoadSurface=(modelMatrix*vec4(transformed,1.)).xyz;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
varying vec3 vRoadSurface;
float roadHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float roadNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(roadHash(i),roadHash(i+vec2(1.,0.)),f.x),mix(roadHash(i+vec2(0.,1.)),roadHash(i+vec2(1.)),f.x),f.y);}
`).replace('#include <color_fragment>',`#include <color_fragment>
vec2 roadP=vRoadSurface.xz;
float roadCloud=(roadNoise(roadP*.19)-.5)*.13+(roadNoise(roadP*.051)-.5)*.10;
vec2 roadGrain=roadP*${style===5?'18.':'65.'};float roadFilter=1.-smoothstep(.35,1.3,max(length(dFdx(roadGrain)),length(dFdy(roadGrain))));
float roadAggregate=(roadNoise(roadGrain)-.5)*${style===2||style===5?'.22':'.12'}*roadFilter;
diffuseColor.rgb*=1.+roadCloud+roadAggregate;
`)};material.customProgramCacheKey=()=>oldKey()+'/road-surface-47/'+style;
}
