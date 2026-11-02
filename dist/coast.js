import * as T from './vendor/three.js';
import {createBoats} from './boats.js?v=boats-1';
export function sampleRegionalMask(pixels,width,height,bounds,x,z){const u=(x-bounds.minX)/(bounds.maxX-bounds.minX),v=(z-bounds.minZ)/(bounds.maxZ-bounds.minZ);if(u<0||v<0||u>1||v>1)return 0;const i=Math.min(width-1,Math.floor(u*width)),j=Math.min(height-1,Math.floor(v*height));return pixels[j*width+i]/255}
export async function createCoast(scene,meta,forestBytes,{ground,datum}){
 // The 7000×6300 greyscale mask is kept once, one byte per pixel: the land tests read it and the GPU gets it as a
 // single-channel texture (44 MB rather than 176 MB as RGBA, on each side).
 const image=await new T.ImageLoader().loadAsync('./'+meta.mask),width=image.width,height=image.height;
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);
 const rgba=context.getImageData(0,0,width,height).data,pixels=new Uint8Array(width*height);for(let i=0;i<pixels.length;i++)pixels[i]=rgba[i*4];canvas.width=canvas.height=0;
 const mask=new T.DataTexture(pixels,width,height,T.RedFormat,T.UnsignedByteType);mask.minFilter=mask.magFilter=T.LinearFilter;mask.unpackAlignment=1;mask.needsUpdate=true;
 const b=meta.bounds,seaLevel=-datum+.08;
 function isLand(x,z){return sampleRegionalMask(pixels,width,height,b,x,z)>.5}
 function density(x,z){const f=meta.forest,u=T.MathUtils.clamp((x-b.minX)/(b.maxX-b.minX)*(f.width-1),0,f.width-1.001),v=T.MathUtils.clamp((z-b.minZ)/(b.maxZ-b.minZ)*(f.height-1),0,f.height-1.001),i=Math.floor(u),j=Math.floor(v),dx=u-i,dz=v-j,k=j*f.width+i;return(forestBytes[k]*(1-dx)*(1-dz)+forestBytes[k+1]*dx*(1-dz)+forestBytes[k+f.width]*(1-dx)*dz+forestBytes[k+f.width+1]*dx*dz)/255}
 const time={value:0},day={value:1},chop={value:1},sunDirection=new T.Vector3(.4,.7,-.6).normalize(),bounds=new T.Vector4(b.minX,b.minZ,b.maxX-b.minX,b.maxZ-b.minZ);
 const waterMaterial=new T.ShaderMaterial({uniforms:{...T.UniformsUtils.clone(T.UniformsLib.fog),clock:time,daylight:day,chop,sunDirection:{value:sunDirection},coastMask:{value:mask},coastBounds:{value:bounds}},fog:true,side:T.DoubleSide,
 vertexShader:`varying vec3 vSeaWorld;\n#include <fog_pars_vertex>\nvoid main(){vSeaWorld=(modelMatrix*vec4(position,1.)).xyz;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;\n#include <fog_vertex>\n}`,
 fragmentShader:`uniform float clock;uniform float daylight;uniform float chop;uniform vec3 sunDirection;uniform sampler2D coastMask;uniform vec4 coastBounds;varying vec3 vSeaWorld;
#include <fog_pars_fragment>
// Wind-sea normals: deep-water sine octaves (height, d/dx, d/dz), each faded out before it can alias with distance.
vec3 sea(vec2 p,float t,float dist){vec3 s=vec3(0.);
#define WAVE(dx,dz,len,amp) {vec2 d=normalize(vec2(dx,dz));float k=6.2831853/len,ph=dot(d,p)*k-sqrt(9.81*k)*t,a=amp*(1.-smoothstep(len*18.,len*55.,dist));s+=vec3(a*sin(ph),a*k*cos(ph)*d);}
WAVE(1.,.32,52.,.62)WAVE(.74,-.58,29.,.38)WAVE(-.22,1.,16.,.24)WAVE(.93,.48,9.2,.13)WAVE(-.61,.8,5.1,.075)WAVE(.35,-.94,2.9,.042)WAVE(-.9,-.3,1.7,.022)
return s*chop;}
void main(){vec2 p=vSeaWorld.xz;vec3 toEye=cameraPosition-vSeaWorld;float dist=length(toEye);vec3 v=toEye/dist;vec3 w=sea(p,clock,dist);vec3 n=normalize(vec3(-w.y,1.,-w.z));
float fresnel=.02+.98*pow(1.-max(dot(n,v),0.),5.);vec3 r=reflect(-v,n);
vec3 deep=mix(vec3(.008,.019,.042),vec3(.03,.13,.17),daylight),scatter=mix(vec3(.01,.03,.04),vec3(.07,.26,.27),daylight);
vec3 sky=mix(mix(vec3(.025,.045,.085),vec3(.34,.48,.56),daylight),mix(vec3(.01,.02,.05),vec3(.24,.42,.62),daylight),clamp(r.y*1.6,0.,1.));
float crest=w.x/(1.5*max(chop,.01));vec3 colour=mix(deep,scatter,clamp(crest*.8+.3,0.,1.)*.55);colour=mix(colour,sky,clamp(fresnel*.75+.03,0.,1.));
float glint=pow(max(dot(r,sunDirection),0.),mix(90.,600.,smoothstep(0.,.25,sunDirection.y)))*smoothstep(-.02,.08,sunDirection.y);colour+=vec3(1.,.93,.8)*glint*(2.2*daylight+.1);
// Whitecaps break on the steepest crests and multiply with wind; fine sine products keep them streaky, not uniform.
float breakup=sin(p.x*2.7+p.y*1.1+clock*1.3)*sin(p.x*1.23-p.y*3.4-clock*.9)*.5+.5,whitecap=smoothstep(.6-(chop-1.)*.2,.9,crest+breakup*.14)*smoothstep(.7,1.4,chop)*(1.-smoothstep(1500.,6000.,dist));
vec2 uv=(p-coastBounds.xy)/coastBounds.zw;float edge=uv==clamp(uv,0.,1.)?texture2D(coastMask,uv).r:0.;float foam=max(smoothstep(.035,.38,edge)*(.6+.4*sin(clock*.65+p.x*.08+p.y*.11))*.65,whitecap*.8);
colour=mix(colour,vec3(.62,.7,.7)*(.12+daylight*.88),foam);gl_FragColor=vec4(colour,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
#include <fog_fragment>
}`});
 const waterBounds=[];
 for(const rings of meta.water){const shape=new T.Shape(rings[0].map(([x,z])=>new T.Vector2(x,-z)));for(const ring of rings.slice(1))shape.holes.push(new T.Path(ring.map(([x,z])=>new T.Vector2(x,-z))));const g=new T.ShapeGeometry(shape);g.rotateX(-Math.PI/2);for(let i=0;i<g.attributes.position.count;i++)g.attributes.position.setY(i,seaLevel);g.computeVertexNormals();scene.add(new T.Mesh(g,waterMaterial));const xs=rings[0].map(p=>p[0]),zs=rings[0].map(p=>p[1]);waterBounds.push({rings,minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs)})}
 const boats=createBoats(scene,{isLand,bounds:b,seaLevel});
 const sandCanvas=document.createElement('canvas');sandCanvas.width=sandCanvas.height=128;const paint=sandCanvas.getContext('2d');paint.fillStyle='#aaa58e';paint.fillRect(0,0,128,128);for(let i=0;i<2400;i++){paint.fillStyle=i%3?'#bcb7a2':'#7b7e71';paint.fillRect(i*37%128,i*17%128,1,1)}const sand=new T.CanvasTexture(sandCanvas);sand.colorSpace=T.SRGBColorSpace;sand.wrapS=sand.wrapT=T.RepeatWrapping;
 const sandMat=new T.MeshLambertMaterial({map:sand,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});
 for(const ring of meta.beaches){const shape=new T.Shape(ring.map(([x,z])=>new T.Vector2(x,-z))),g=new T.ShapeGeometry(shape);g.rotateX(-Math.PI/2);const uv=[];for(let i=0;i<g.attributes.position.count;i++){const x=g.attributes.position.getX(i),z=g.attributes.position.getZ(i);g.attributes.position.setY(i,Math.max(seaLevel+.05,ground(x,z)+.05));uv.push(x/8,z/8)}g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();scene.add(new T.Mesh(g,sandMat))}
 function applyTerrain(material){const previous=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);material.onBeforeCompile=shader=>{previous.call(material,shader);shader.uniforms.regionalCoastMask={value:mask};shader.uniforms.regionalCoastBounds={value:bounds};shader.vertexShader='varying vec2 vRegionalCoast;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRegionalCoast=position.xz;');shader.fragmentShader='uniform sampler2D regionalCoastMask;uniform vec4 regionalCoastBounds;varying vec2 vRegionalCoast;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nvec2 coastalUV=(vRegionalCoast-regionalCoastBounds.xy)/regionalCoastBounds.zw;\nif(texture2D(regionalCoastMask,coastalUV).r<.5)discard;')};const priorKey=key();material.customProgramCacheKey=()=>priorKey+'-regional-coast-v1'}
 function drawMinimap(ctx,X,Y,camera,scale){ctx.fillStyle='#355e72';for(const w of waterBounds){const margin=120/scale;if(camera.x+margin<w.minX||camera.x-margin>w.maxX||camera.z+margin<w.minZ||camera.z-margin>w.maxZ)continue;ctx.beginPath();for(const ring of w.rings){ring.forEach(([x,z],i)=>i?ctx.lineTo(X(x),Y(z)):ctx.moveTo(X(x),Y(z)));ctx.closePath()}ctx.fill('evenodd')}}
 return{meta,boats,isLand,density,seaLevel,applyTerrain,drawMinimap,update(dt,lighting,{sun,wind=.45}={}){time.value+=dt;day.value=lighting.day;if(sun)sunDirection.copy(sun).normalize();chop.value+=(.55+wind*.95-chop.value)*Math.min(1,dt*.5);boats.update(dt,chop.value,time.value)}};
}
