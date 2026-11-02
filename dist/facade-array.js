import * as T from './vendor/three.js';
import {weldSteps,finishSteps} from './spatial-split.js?v=paced-1';

// One material for a family of same-sized facade images. Each vertex picks its image with a `facadeLayer`
// attribute, so walls of every style share one draw and can be split by area without multiplying draw calls.
// Layers below `repeatFrom` clamp at their edges, like the separate textures they replace; the rest tile.
// `bump(layer)` gives a layer's bump scale (0 for none), sampled from its own colour like the old bumpMap.
// A null mask leaves that layer unlit at night.
function pack(images,size,channels){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const c=canvas.getContext('2d',{willReadFrequently:true}),data=new Uint8Array(size*size*channels*images.length);
 images.forEach((image,layer)=>{c.clearRect(0,0,size,size);if(image)c.drawImage(image,0,0,size,size);const pixels=c.getImageData(0,0,size,size).data,offset=layer*size*size*channels;if(channels===4)data.set(pixels,offset);else for(let i=0,j=offset;i<pixels.length;i+=4,j++)data[j]=pixels[i]});
 const texture=new T.DataArrayTexture(data,size,size,images.length);texture.format=channels===4?T.RGBAFormat:T.RedFormat;
 texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.anisotropy=8;texture.needsUpdate=true;
 // The packed pixels are only needed for the first upload; dropping them frees tens of megabytes.
 texture.onUpdate=()=>{texture.image.data=null};return texture;
}
export function createFacadeArray(images,masks,{size=512,repeatFrom=images.length,bump=()=>0,color='#d1d3d0',nightBrightness=.85}={}){
 const maps=pack(images,size,4),glow=pack(masks,size,1);maps.colorSpace=T.SRGBColorSpace;
 const uniforms={facadeMaps:{value:maps},facadeMasks:{value:glow},facadeBump:{value:images.map((_,i)=>bump(i))},facadeRepeatFrom:{value:repeatFrom},facadeHalfTexel:{value:.5/size}};
 const count=images.length,hook=shader=>{
  Object.assign(shader.uniforms,uniforms);
  shader.vertexShader='attribute float facadeLayer;\nvarying float vFacadeLayer;\nvarying vec2 vFacadeUv;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvFacadeUv=uv;vFacadeLayer=facadeLayer;');
  shader.fragmentShader=`precision highp sampler2DArray;
uniform sampler2DArray facadeMaps;uniform sampler2DArray facadeMasks;uniform float facadeBump[${count}];uniform float facadeRepeatFrom;uniform float facadeHalfTexel;
varying float vFacadeLayer;varying vec2 vFacadeUv;
vec3 facadeUvw(){float layer=floor(vFacadeLayer+.5);return vec3(layer<facadeRepeatFrom?clamp(vFacadeUv,facadeHalfTexel,1.-facadeHalfTexel):vFacadeUv,layer);}
// three's bump mapping (dHdxy_fwd + perturbNormalArb), reading the height from the layer's own red channel.
vec3 facadeBumpNormal(vec3 surfPos,vec3 surfNorm,float faceDir){
 vec3 uvw=facadeUvw();float scale=facadeBump[int(uvw.z)];if(scale==0.)return surfNorm;
 vec2 dSTdx=dFdx(uvw.xy),dSTdy=dFdy(uvw.xy);float hll=scale*texture(facadeMaps,uvw).x;
 vec2 dHdxy=vec2(scale*texture(facadeMaps,vec3(uvw.xy+dSTdx,uvw.z)).x-hll,scale*texture(facadeMaps,vec3(uvw.xy+dSTdy,uvw.z)).x-hll);
 vec3 sx=normalize(dFdx(surfPos)),sy=normalize(dFdy(surfPos)),r1=cross(sy,surfNorm),r2=cross(surfNorm,sx);float det=dot(sx,r1)*faceDir;
 return normalize(abs(det)*surfNorm-sign(det)*(dHdxy.x*r1+dHdxy.y*r2));
}
`+shader.fragmentShader
   .replace('#include <map_fragment>','diffuseColor*=texture(facadeMaps,facadeUvw());')
   .replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal=facadeBumpNormal(-vViewPosition,normal,faceDirection);')
   .replace('#include <emissivemap_fragment>','totalEmissiveRadiance*=texture(facadeMasks,facadeUvw()).r;');
 };
 const materials=new Map();
 return{
  maps,masks:glow,
  // One shared material per tint mode; vertex colours carry the per-building paint where the old walls used them.
  material(vertexColors=false){
   if(materials.has(vertexColors))return materials.get(vertexColors);
   const m=new T.MeshLambertMaterial({color,emissive:'#ffd7ab',emissiveIntensity:0,vertexColors,side:T.DoubleSide});
   m.onBeforeCompile=hook;m.customProgramCacheKey=()=>'facade-array-'+count;m.userData.nightBrightness=nightBrightness;m.userData.keepShared=true;
   materials.set(vertexColors,m);return m;
  },
 };
}

// Merges per-style batches ({p, uv, c?}) into one indexed geometry with a facadeLayer per vertex.
export function mergeFacadeBatches(batches,withColour=false){return finishSteps(mergeFacadeBatchSteps(batches,withColour))}
// The same, as steps for paced builders (`yield*` it).
export function* mergeFacadeBatchSteps(batches,withColour=false){
 let vertices=0;for(const b of batches)vertices+=b.p.length/3;if(!vertices)return null;
 const position=new Float32Array(vertices*3),uv=new Float32Array(vertices*2),layer=new Float32Array(vertices),colour=withColour?new Float32Array(vertices*3):null;let v=0;
 batches.forEach((b,i)=>{const n=b.p.length/3;if(!n)return;position.set(b.p,v*3);uv.set(b.uv,v*2);layer.fill(i,v,v+n);if(colour)colour.set(b.c,v*3);v+=n});
 const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(position,3));g.setAttribute('uv',new T.BufferAttribute(uv,2));g.setAttribute('facadeLayer',new T.BufferAttribute(layer,1));if(colour)g.setAttribute('color',new T.BufferAttribute(colour,3));g.computeVertexNormals();yield;return yield* weldSteps(g);
}
