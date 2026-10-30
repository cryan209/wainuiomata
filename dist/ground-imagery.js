import * as T from './vendor/three.js';
export function aerialUV(bounds,x,z){return{u:(x-bounds.minX)/(bounds.maxX-bounds.minX),v:(bounds.maxZ-z)/(bounds.maxZ-bounds.minZ)}}
export function applyGroundImagery(material,layers){
 const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
 material.onBeforeCompile=shader=>{previous.call(material,shader);let declarations='varying vec2 vGroundPhotoXZ;\n',fragment='';
  layers.forEach(({texture,bounds,fade=50,textureUniform,extentUniform},i)=>{shader.uniforms['groundPhoto'+i]=textureUniform||{value:texture};shader.uniforms['groundExtent'+i]=extentUniform||{value:new T.Vector4(bounds.minX,bounds.minZ,bounds.maxX-bounds.minX,bounds.maxZ-bounds.minZ)};declarations+=`uniform sampler2D groundPhoto${i};uniform vec4 groundExtent${i};\n`;fragment+=`{vec2 uv=(vGroundPhotoXZ-groundExtent${i}.xy)/groundExtent${i}.zw;float edge=min(min(uv.x*groundExtent${i}.z,(1.-uv.x)*groundExtent${i}.z),min(uv.y*groundExtent${i}.w,(1.-uv.y)*groundExtent${i}.w));float weight=smoothstep(0.,${Number(fade).toFixed(1)},edge);if(weight>0.){vec3 photo=texture2D(groundPhoto${i},vec2(uv.x,1.-uv.y)).rgb;diffuseColor.rgb=mix(diffuseColor.rgb,photo,weight);}}\n`});
  shader.vertexShader='varying vec2 vGroundPhotoXZ;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvGroundPhotoXZ=position.xz;');shader.fragmentShader=declarations+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+fragment);
 };material.customProgramCacheKey=()=>key+'-ground-aerial-'+layers.length;
}
