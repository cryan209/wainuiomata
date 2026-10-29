import * as T from './vendor/three.js';
import {FACADE_COUNT} from './appearance.js';
const glass=[[[.14,.21,.18,.43],[.40,.21,.23,.43]],[[.12,.23,.49,.41]],[[.12,.23,.50,.42]],[[.12,.23,.49,.39]],[[.12,.25,.49,.41]],[[.10,.24,.48,.41]],[[.12,.25,.49,.41]],[]];
const names=['Cream weatherboard','Red brick','Blue weatherboard','Grey roughcast','Timber','White stucco','Dark brick','Garage','Dairy','Bakery','Fish & Chips','Cafe','Books','Hardware','Market','Barber'];
function texture(canvas,color=true){const t=new T.CanvasTexture(canvas);t.flipY=false;t.colorSpace=color?T.SRGBColorSpace:T.NoColorSpace;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.anisotropy=8;return t}
export function makePhotoFacades(image,surfaceImage){
 const walls=[],windowMasks=[],labels=[];
 for(let style=0;style<44;style++){
  const upper=style>=28,house=style<16||upper,index=upper?(style-28)%8:house?style%8:8+(style-16)%8;
  const source=upper&&index===7?6:index,crop=upper?[.06,.08,.60,.77]:[.008,.012,.984,.976],size=512;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const c=canvas.getContext('2d');
  c.drawImage(image,(source%4+crop[0])*image.width/4,(Math.floor(source/4)+crop[1])*image.height/4,crop[2]*image.width/4,crop[3]*image.height/4,0,0,size,size);
  // A second restrained paint treatment adds house variety while retaining material grain.
  if(house&&(upper?style-28:style)>=8){c.globalCompositeOperation='soft-light';c.fillStyle=['#bcc8b5','#bbc2cc','#d3c7ba','#bbc9ca'][style%4];c.globalAlpha=.22;c.fillRect(0,0,size,size);c.globalAlpha=1;c.globalCompositeOperation='source-over'}
  const mask=document.createElement('canvas');mask.width=mask.height=size;const mc=mask.getContext('2d'),pixels=c.getImageData(0,0,size,size),out=mc.createImageData(size,size),rects=house?glass[source]:[[.06,.33,.64,.49],[.81,.34,.12,.47]];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const k=(y*size+x)*4,u=crop[0]+x/size*crop[2],v=crop[1]+y/size*crop[3];const inside=rects.some(([rx,ry,rw,rh])=>u>rx&&u<rx+rw&&v>ry&&v<ry+rh),l=(pixels.data[k]+pixels.data[k+1]+pixels.data[k+2])/3;const value=inside&&l<195?Math.round(l*.58):0;out.data[k]=out.data[k+1]=out.data[k+2]=value;out.data[k+3]=255}
  mc.putImageData(out,0,0);walls.push(texture(canvas));windowMasks.push(texture(mask,false));labels.push(names[index]+(upper?' upper windows':''));
 }
 const sideWindows=[],sideWindowMasks=[];
 for(let i=0;i<8;i++){const source=i===7?6:i;for(const [out,input]of [[sideWindows,walls[source]],[sideWindowMasks,windowMasks[source]]]){const canvas=document.createElement('canvas');canvas.width=canvas.height=256;canvas.getContext('2d').drawImage(input.image,.08*512,.20*512,.59*512,.48*512,0,0,256,256);out.push(texture(canvas,out===sideWindows))}}
 const surfaces=[];
 for(let i=0;i<16;i++){const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d');c.drawImage(surfaceImage,(i%4+.008)*surfaceImage.width/4,(Math.floor(i/4)+.008)*surfaceImage.height/4,.984*surfaceImage.width/4,.984*surfaceImage.height/4,0,0,512,512);const t=texture(canvas);t.wrapS=t.wrapT=T.RepeatWrapping;surfaces.push(t)}
 const dark=document.createElement('canvas');dark.width=dark.height=1;const black=texture(dark,false);
 for(let i=0;i<18;i++){const index=i<16?i%8:14+i%2,canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d');c.drawImage(surfaces[index].image,0,0);if(i>=8&&i<16){c.globalCompositeOperation='soft-light';c.globalAlpha=.22;c.fillStyle=['#bcc8b5','#bbc2cc','#d3c7ba','#bbc9ca'][i%4];c.fillRect(0,0,512,512)}const t=texture(canvas);t.wrapS=t.wrapT=T.RepeatWrapping;walls.push(t);windowMasks.push(black);labels.push('Side/rear '+(i<16?names[index]:'commercial cladding'))}
 if(walls.length!==FACADE_COUNT)throw Error('Facade material count mismatch');
 return{walls,windowMasks,names:labels,surfaces,sideWindows,sideWindowMasks};
}
