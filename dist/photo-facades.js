import * as T from './vendor/three.js';
import {FACADE_COUNT} from './appearance.js';
const glass=[[[.14,.21,.18,.43],[.40,.21,.23,.43]],[[.12,.23,.49,.41]],[[.12,.23,.50,.42]],[[.12,.23,.49,.39]],[[.12,.25,.49,.41]],[[.10,.24,.48,.41]],[[.12,.25,.49,.41]],[]];
const names=['Cream weatherboard','Red brick','Blue weatherboard','Grey roughcast','Timber','White stucco','Dark brick','Garage','Dairy','Bakery','Fish & Chips','Cafe','Books','Hardware','Market','Barber'];
function texture(canvas,color=true){const t=new T.CanvasTexture(canvas);t.flipY=false;t.colorSpace=color?T.SRGBColorSpace:T.NoColorSpace;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.anisotropy=8;return t}
export function makePhotoFacades(image){
 const walls=[],windowMasks=[],labels=[];
 for(let style=0;style<FACADE_COUNT;style++){
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
 return{walls,windowMasks,names:labels};
}
