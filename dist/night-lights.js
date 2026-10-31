import * as T from './vendor/three.js';
// Level-of-detail night lighting. Real spot lights stay near the player; beyond them a baked street-light map tints
// ground surfaces at any distance, coronas mark every lamp head, and traffic carries cheap headlight decals.
const placeholder=new T.DataTexture(new Uint8Array(1),1,1,T.RedFormat);placeholder.needsUpdate=true;
export const nightLightUniforms={nightLightMap:{value:placeholder},nightLightExtent:{value:new T.Vector4(0,0,1,1)},nightLightLevel:{value:0},nightLightColor:{value:new T.Color('#ffa94d')}};
export const LAMP_COLOR='#ffc27a';

// Adds the baked lamp map to a material: one texture fetch, added after lighting so it shows in darkness. The map also
// holds the lamps' mean height, so walls are lit up to about two storeys above the street and fade out above that.
export function applyNightLight(material){
 if(material.userData.nightLight)return;material.userData.nightLight=true;
 const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
 material.onBeforeCompile=shader=>{previous.call(material,shader);Object.assign(shader.uniforms,nightLightUniforms);
  shader.vertexShader='varying vec3 vNightPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvec4 nightPosition=vec4(transformed,1.);\n#ifdef USE_INSTANCING\nnightPosition=instanceMatrix*nightPosition;\n#endif\nvNightPosition=(modelMatrix*nightPosition).xyz;');
  shader.fragmentShader='uniform sampler2D nightLightMap;uniform vec4 nightLightExtent;uniform float nightLightLevel;uniform vec3 nightLightColor;varying vec3 vNightPosition;\n'+shader.fragmentShader.replace('#include <opaque_fragment>','if(nightLightLevel>0.){vec2 lampSample=texture2D(nightLightMap,(vNightPosition.xz-nightLightExtent.xy)/nightLightExtent.zw).rg;float lamp=lampSample.r,aboveStreet=vNightPosition.y-lampSample.g+7.6,reach=(1.-smoothstep(5.,17.,aboveStreet))*smoothstep(-7.,-1.,aboveStreet);outgoingLight+=diffuseColor.rgb*nightLightColor*(lamp*lamp*1.6+lamp*.3)*reach*nightLightLevel;}\n#include <opaque_fragment>')};
 material.customProgramCacheKey=()=>key+'-night-light';
}

// Splats a soft pool per lamp into a single-channel texture covering every lamp in the region.
export function bakeNightLightMap(lamps,{radius=16,maxSize=4096}={}){
 if(!lamps.length)return null;let minX=Infinity,minZ=Infinity,maxX=-Infinity,maxZ=-Infinity;
 for(const p of lamps){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minZ=Math.min(minZ,p.z);maxZ=Math.max(maxZ,p.z)}
 minX-=radius*2;minZ-=radius*2;maxX+=radius*2;maxZ+=radius*2;
 const step=Math.max(6,(maxX-minX)/maxSize,(maxZ-minZ)/maxSize),width=Math.ceil((maxX-minX)/step),height=Math.ceil((maxZ-minZ)/step),sum=new Float32Array(width*height),heights=new Float32Array(width*height),reach=Math.ceil(radius*1.6/step);
 for(const p of lamps){const u=(p.x-minX)/step,v=(p.z-minZ)/step,i0=Math.floor(u),j0=Math.floor(v);
  for(let j=j0-reach;j<=j0+reach;j++){if(j<0||j>=height)continue;for(let i=i0-reach;i<=i0+reach;i++){if(i<0||i>=width)continue;const d=Math.hypot(i+.5-u,j+.5-v)*step/radius;if(d<1.6){const w=Math.exp(-d*d*1.8);sum[j*width+i]+=w;heights[j*width+i]+=w*p.y}}}}
 // Half floats keep lamp heights to a few centimetres and still filter linearly. Cells without lamps borrow the
 // nearest lit height along their row so filtering at pool edges does not drag the height towards zero.
 const data=new Uint16Array(width*height*2);for(let j=0;j<height;j++){let last=0;for(let i=0;i<width;i++){const k=j*width+i;if(sum[k]>1e-4)last=heights[k]/sum[k];data[k*2]=T.DataUtils.toHalfFloat(1-Math.exp(-sum[k]*.85));data[k*2+1]=T.DataUtils.toHalfFloat(last)}}
 const texture=new T.DataTexture(data,width,height,T.RGFormat,T.HalfFloatType);texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearFilter;texture.needsUpdate=true;
 return{texture,extent:new T.Vector4(minX,minZ,width*step,height*step),width,height,step};
}

function glowTexture(){const n=64,data=new Uint8Array(n*n*4);for(let j=0;j<n;j++)for(let i=0;i<n;i++){const r=Math.hypot(i+.5-n/2,j+.5-n/2)/(n/2),k=(j*n+i)*4,core=Math.exp(-r*r*14),halo=Math.max(0,1-r)**2*.45;data[k]=data[k+1]=data[k+2]=255;data[k+3]=Math.min(255,Math.round(255*(core+halo)))}const t=new T.DataTexture(data,n,n);t.magFilter=t.minFilter=T.LinearFilter;t.needsUpdate=true;return t}

// Screen-space coronas: a few pixels at distance, faded in beyond the detailed near glows, depth-tested against hills.
export function createLampCoronas(scene,lamps){
 const positions=new Float32Array(lamps.length*3);lamps.forEach((p,i)=>{positions[i*3]=p.x;positions[i*3+1]=p.y;positions[i*3+2]=p.z});
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3));geometry.computeBoundingSphere();
 const material=new T.ShaderMaterial({uniforms:{...T.UniformsUtils.clone(T.UniformsLib.fog),glow:{value:glowTexture()},level:{value:0},color:{value:new T.Color(LAMP_COLOR)},pixelScale:{value:1}},fog:true,transparent:true,depthWrite:false,blending:T.AdditiveBlending,
  vertexShader:`uniform float pixelScale;varying float vFade;\n#include <fog_pars_vertex>\nvoid main(){vec4 mvPosition=modelViewMatrix*vec4(position,1.);float d=-mvPosition.z;gl_Position=projectionMatrix*mvPosition;gl_PointSize=clamp(2600./d,2.5,22.)*pixelScale;vFade=smoothstep(35.,90.,d);\n#include <fog_vertex>\n}`,
  fragmentShader:`uniform sampler2D glow;uniform float level;uniform vec3 color;varying float vFade;\n#include <fog_pars_fragment>\nvoid main(){float a=texture2D(glow,gl_PointCoord).a*level*vFade;if(a<.004)discard;gl_FragColor=vec4(color*a,1.);\n#ifdef USE_FOG\nfloat fogFactor=smoothstep(fogNear,fogFar*1.15,vFogDepth);gl_FragColor.rgb*=1.-fogFactor;\n#endif\n}`});
 const points=new T.Points(geometry,material);points.frustumCulled=false;points.renderOrder=3;points.userData.weatherEffect=true;points.name='Lamp coronas';scene.add(points);
 return{points,dispose(){scene.remove(points);geometry.dispose();material.uniforms.glow.value.dispose();material.dispose()},update(night,pixelScale=1){material.uniforms.level.value=night;material.uniforms.pixelScale.value=pixelScale;points.visible=night>.02}};
}

// Headlight pools: one instanced additive quad per car projected ahead of its bonnet, plus a dim red tail wash.
function beamTexture(){const w=64,h=128,data=new Uint8Array(w*h*4);for(let j=0;j<h;j++)for(let i=0;i<w;i++){const along=j/(h-1),across=(i+.5)/w*2-1,spread=.28+along*.72,side=Math.max(0,1-(across/spread)**2),k=(j*w+i)*4,v=side*Math.min(1,along*6)*(1-along)**1.4;data[k]=255;data[k+1]=Math.round(232);data[k+2]=Math.round(196);data[k+3]=Math.round(255*v)}const t=new T.DataTexture(data,w,h);t.magFilter=t.minFilter=T.LinearFilter;t.needsUpdate=true;return t}
export function createHeadlightPools(scene,capacity){
 const beamGeometry=new T.PlaneGeometry(1,1).rotateX(-Math.PI/2),beam=new T.InstancedMesh(beamGeometry,new T.MeshBasicMaterial({map:beamTexture(),transparent:true,depthWrite:false,blending:T.AdditiveBlending,opacity:0,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4,toneMapped:false}),capacity);
 const tail=new T.InstancedMesh(new T.CircleGeometry(.5,16).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:'#ff2a14',transparent:true,depthWrite:false,blending:T.AdditiveBlending,opacity:0,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4,toneMapped:false}),capacity);
 for(const m of [beam,tail]){m.count=0;m.frustumCulled=false;m.userData.weatherEffect=true;m.renderOrder=2;scene.add(m)}beam.name='Headlight pools';tail.name='Tail light pools';
 // A single real spot light follows the nearest car, so its beam also lights walls, people and other cars.
 const spot=new T.SpotLight('#fff1d6',0,48,Math.PI*.2,.55,1.4);spot.castShadow=false;scene.add(spot,spot.target);
 const local=new T.Matrix4(),out=new T.Matrix4(),origin=new T.Vector3(),ahead=new T.Vector3();
 return{update(cars,night,camera){beam.count=tail.count=0;beam.material.opacity=night*.85;tail.material.opacity=night*.2;beam.visible=tail.visible=night>.02;let nearest=null,best=60;
  if(night>.02)for(const car of cars){const p=car.renderPosition||car.position;if(!p||car.parked&&!car.lightsOn||!car.fleetMatrix)continue;const d=Math.hypot(p.x-camera.x,p.z-camera.z);if(d>700)continue;const half=(car.model?.length||4.4)/2,length=Math.min(22,10+(car.model?.width||1.7)*5);
   local.makeScale(5.2,1,length).setPosition(0,.06,-half-length/2+.6);out.multiplyMatrices(car.fleetMatrix,local);beam.setMatrixAt(beam.count++,out);
   local.makeScale(2.6,1,1.6).setPosition(0,.06,half+.5);out.multiplyMatrices(car.fleetMatrix,local);tail.setMatrixAt(tail.count++,out);if(d<best){best=d;nearest=car}}
  beam.instanceMatrix.needsUpdate=tail.instanceMatrix.needsUpdate=true;
  spot.intensity=nearest?night*90:0;if(nearest){const half=(nearest.model?.length||4.4)/2;origin.set(0,.75,-half).applyMatrix4(nearest.fleetMatrix);ahead.set(0,-.4,-half-16).applyMatrix4(nearest.fleetMatrix);spot.position.copy(origin);spot.target.position.copy(ahead);spot.target.updateMatrixWorld()}}};
}
