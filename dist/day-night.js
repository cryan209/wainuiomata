import * as T from './vendor/three.js';
import {skyState,valleyTime,valleyInstant,solarTimes} from './astronomy.js';
const $=s=>document.querySelector(s);
export function createDayNight({scene,renderer,camera,sky,sun,ambient,windowMaterials,photoMaterials=[]}){
 let instant=new Date(),hour=valleyTime(instant).hour,running=true,uiClock=-1;
 const dateInput=$('#sky-date');
 function setHour(value){instant=valleyInstant(valleyTime(instant).date,value);hour=value;}
 function presetTimes(){const t=solarTimes(valleyInstant(valleyTime(instant).date,12),camera.position.x,camera.position.z);return [t.dawn,t.solarNoon,t.dusk,valleyInstant(valleyTime(instant).date,23)];}
 dateInput.onchange=()=>{if(!dateInput.value)return;instant=valleyInstant(dateInput.value,hour);uiClock=-1;update(0);};
 // An analytic sky driven by the sun: zenith/horizon gradient, a warm glow on the sun's side, sun and moon halos, and the weather cloud layer lit by the sun. Near the horizon it fades to the fog colour, so distant terrain blends into it.
 const skyMaterial=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,fog:false,uniforms:{weatherAmount:{value:0},weatherTint:{value:new T.Color('#a2afb5')},daylight:{value:1},sunDirection:{value:new T.Vector3(0,1,0)},moonDirection:{value:new T.Vector3(0,1,0)},sunColor:{value:new T.Color()},zenithColor:{value:new T.Color()},horizonColor:{value:new T.Color()},glowColor:{value:new T.Color()},glowAmount:{value:0},sunHalo:{value:1},moonHalo:{value:0},fogColor:{value:scene.fog.color},cloudMap:{value:null},cloudOffset:{value:new T.Vector2()},cloudCoverage:{value:0},cloudHeight:{value:850},cloudTint:{value:new T.Color()},cloudShadow:{value:new T.Color()},lowOffset:{value:new T.Vector2()},altoOffset:{value:new T.Vector2()},highOffset:{value:new T.Vector2()},lowAmount:{value:0},altoAmount:{value:0},lightning:{value:0}},vertexShader:`varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,fragmentShader:`uniform float weatherAmount;uniform vec3 weatherTint;uniform float daylight;uniform vec3 sunDirection;uniform vec3 moonDirection;uniform vec3 sunColor;uniform vec3 zenithColor;uniform vec3 horizonColor;uniform vec3 glowColor;uniform float glowAmount;uniform float sunHalo;uniform float moonHalo;uniform vec3 fogColor;uniform sampler2D cloudMap;uniform vec2 cloudOffset;uniform float cloudCoverage;uniform float cloudHeight;uniform vec3 cloudTint;uniform vec3 cloudShadow;uniform vec2 lowOffset;uniform vec2 altoOffset;uniform vec2 highOffset;uniform float lowAmount;uniform float altoAmount;uniform float lightning;varying vec3 vDirection;
// One flat cloud sheet at a fixed height, sampled where the view ray crosses it. Low scud and altocumulus use this;
// each sheet has its own scale and wind offset, so the levels drift independently and show parallax.
void cloudSheet(vec3 dir,float mu,float height,float scale,vec2 offset,float threshold,float amount,vec3 tint,vec3 shadow,inout float transmittance,inout vec3 cloudLight){
 float travel=(height-cameraPosition.y)/dir.y;if(travel<=0.0||amount<=0.001)return;
 vec2 uv=(cameraPosition.xz+dir.xz*travel)/scale+offset;
 float mass=texture2D(cloudMap,uv).a*.78+texture2D(cloudMap,uv*2.63-offset*.4).a*.22;
 float density=smoothstep(threshold,threshold+.13,mass)*amount*(1.0-smoothstep(8000.0,26000.0,travel));
 float sunMass=texture2D(cloudMap,uv+sunDirection.xz*.04).a;
 vec3 shade=mix(shadow,tint,clamp(.55+(mass-sunMass)*2.5,.2,1.0))+sunColor*pow(mu,8.0)*(1.0-density)*sunHalo*.5+vec3(.75,.8,1.0)*lightning*density*1.6;
 float opacity=1.0-exp(-density*1.3);cloudLight+=transmittance*opacity*shade;transmittance*=1.0-opacity;
}
// Six height slices approximate the depth of the main cumulus deck, including when flying through it.
void cumulusDeck(vec3 dir,float mu,inout float transmittance,inout vec3 cloudLight){
 for(int step=0;step<6;step++){
  float layer=float(step)/5.0;
  float height=cloudHeight+mix(0.0,320.0,dir.y>0.0?layer:1.0-layer);
  float travel=(height-cameraPosition.y)/dir.y;
  if(travel>0.0){
   vec2 uv=(cameraPosition.xz+dir.xz*travel)/4000.0+cloudOffset;
   float mass=texture2D(cloudMap,uv).a;
   float detail=texture2D(cloudMap,uv*3.07+vec2(layer*.035,-layer*.023)).a;
   float profile=sin(layer*3.14159)*0.13;
   float shape=mass*.83+detail*.17+profile;
   float threshold=mix(.65,.20,cloudCoverage);
   float density=smoothstep(threshold,threshold+.16,shape);
   density*=1.0-smoothstep(12000.0,38000.0,travel);
   float sunMass=texture2D(cloudMap,uv+sunDirection.xz*.055).a;
   float lighting=clamp(.42+layer*.40+(mass-sunMass)*3.0,.18,1.0);
   vec3 shade=mix(cloudShadow,cloudTint,lighting);
   float rim=pow(mu,8.0)*(1.0-density)*sunHalo;
   shade+=sunColor*rim*.65;
   // Lightning lights the deck from inside: the thickest, lowest slices glow most.
   shade+=vec3(.75,.8,1.0)*lightning*density*(1.6-layer*.6);
   float opacity=1.0-exp(-density*.62);
   cloudLight+=transmittance*opacity*shade;
   transmittance*=1.0-opacity;
  }
 }
}
void main(){vec3 dir=normalize(vDirection);float up=max(dir.y,0.0);vec3 color=mix(horizonColor,zenithColor,pow(up,0.55));
vec2 across=normalize(dir.xz+vec2(1e-5)),sunAcross=normalize(sunDirection.xz+vec2(1e-5));float toward=max(0.0,dot(across,sunAcross));color=mix(color,glowColor,glowAmount*(0.25+0.75*toward*toward)*pow(1.0-up,5.0));
float mu=max(dot(dir,sunDirection),0.0);color+=sunColor*(pow(mu,10.0)*0.22+pow(mu,90.0)*0.35+pow(mu,900.0)*1.2)*sunHalo;
float moon=max(dot(dir,moonDirection),0.0);color+=vec3(0.32,0.4,0.55)*(pow(moon,40.0)*0.18+pow(moon,600.0)*0.5)*moonHalo;
// Levels are composited nearest-first: upward rays meet low scud, the cumulus deck, then altocumulus; downward rays the reverse.
if(abs(dir.y)>0.012){
 float transmittance=1.0;vec3 cloudLight=vec3(0.0);
 vec3 scudTint=mix(cloudShadow,cloudTint,.5),scudShadow=cloudShadow*.78,altoShadow=mix(cloudShadow,cloudTint,.55);
 float scudThreshold=mix(.74,.46,lowAmount),altoThreshold=mix(.72,.56,altoAmount);
 if(dir.y>0.0){
  cloudSheet(dir,mu,cloudHeight-430.0,1500.0,lowOffset,scudThreshold,lowAmount,scudTint,scudShadow,transmittance,cloudLight);
  cumulusDeck(dir,mu,transmittance,cloudLight);
  cloudSheet(dir,mu,cloudHeight+2600.0,2200.0,altoOffset,altoThreshold,altoAmount,cloudTint,altoShadow,transmittance,cloudLight);
 }else{
  cloudSheet(dir,mu,cloudHeight+2600.0,2200.0,altoOffset,altoThreshold,altoAmount,cloudTint,altoShadow,transmittance,cloudLight);
  cumulusDeck(dir,mu,transmittance,cloudLight);
  cloudSheet(dir,mu,cloudHeight-430.0,1500.0,lowOffset,scudThreshold,lowAmount,scudTint,scudShadow,transmittance,cloudLight);
 }
 color=color*transmittance+cloudLight;
 // Thin wind-stretched cirrus far above everything else; at that height its fast wind reads as a slow crawl.
 float highTravel=(cloudHeight+6200.0-cameraPosition.y)/dir.y;
 if(highTravel>0.0){
  vec2 highUV=(cameraPosition.xz+dir.xz*highTravel)/vec2(15000.0,2600.0)+highOffset;
  float wisps=smoothstep(.56,.76,texture2D(cloudMap,highUV).a);
  wisps*=.19*(1.0-cloudCoverage*.6)*smoothstep(.015,.20,abs(dir.y));
  color=mix(color,cloudTint,wisps*transmittance);
 }
}
color=mix(color,weatherTint,weatherAmount);color+=vec3(.42,.46,.6)*lightning*(.35+.65*up);gl_FragColor=vec4(color,1.0);
#include <tonemapping_fragment>
gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,1.0-smoothstep(-0.02,0.1,dir.y));
#include <colorspace_fragment>
}`});sky.material=skyMaterial;
 const moonLight=new T.DirectionalLight('#a9c9ff',.35);scene.add(moonLight,moonLight.target);
 // Sky objects sit a fixed distance from the camera; placing their depth on the far plane lets terrain at any distance hide them.
 const atInfinity=material=>{material.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\n\tgl_Position.z=gl_Position.w;')};return material}
 const sunDisc=new T.Mesh(new T.SphereGeometry(85,12,8),atInfinity(new T.MeshBasicMaterial({color:'#fff0c7',fog:false,toneMapped:false})));
 const moonDisc=new T.Mesh(new T.SphereGeometry(63,12,8),atInfinity(new T.MeshBasicMaterial({color:'#dce9ff',fog:false,toneMapped:false})));scene.add(sunDisc,moonDisc);
 const starPositions=[],starColors=[];let seed=1701;const random=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646};for(let i=0;i<650;i++){let az=random()*Math.PI*2,y=.03+random()*.97,r=Math.sqrt(1-y*y);starPositions.push(Math.cos(az)*r*9200,y*9200,Math.sin(az)*r*9200);const b=.5+.5*random()**2,warm=random();starColors.push(b*(.9+warm*.1),b*(.92+warm*.04),b*(1-warm*.12))}const starGeometry=new T.BufferGeometry();starGeometry.setAttribute('position',new T.Float32BufferAttribute(starPositions,3));starGeometry.setAttribute('color',new T.Float32BufferAttribute(starColors,3));
 // Round, soft stars of varied brightness instead of uniform square points.
 const dot=document.createElement('canvas');dot.width=dot.height=32;const dc=dot.getContext('2d'),glow=dc.createRadialGradient(16,16,0,16,16,16);glow.addColorStop(0,'rgba(255,255,255,1)');glow.addColorStop(.25,'rgba(255,255,255,.85)');glow.addColorStop(1,'rgba(255,255,255,0)');dc.fillStyle=glow;dc.fillRect(0,0,32,32);
 const stars=new T.Points(starGeometry,atInfinity(new T.PointsMaterial({color:'#e6efff',map:new T.CanvasTexture(dot),vertexColors:true,size:3.2,sizeAttenuation:false,transparent:true,opacity:0,depthWrite:false,fog:false,toneMapped:false})));stars.renderOrder=-5;scene.add(stars);
 const slider=$('#time-slider'),toggle=$('#time-running'),readout=$('#time-value'),phase=$('#time-phase');
 function sync(){dateInput.value=valleyTime(instant).date;const state=skyState(instant,camera.position.x,camera.position.z);const minutes=Math.floor(hour*60)%1440;const label=String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');readout.textContent=label;$('#game-clock').textContent=label+' · VALLEY TIME';slider.value=minutes;slider.setAttribute('aria-valuetext',label);phase.textContent=state.sun.altitude>0?'DAYLIGHT':state.sun.altitude<-.105?'NIGHT':hour<12?'DAWN':'DUSK';toggle.textContent=running?'Ⅱ':'▶';toggle.setAttribute('aria-label',running?'Pause time':'Resume time');toggle.setAttribute('aria-pressed',String(!running))}
 toggle.onclick=()=>{running=!running;sync()};slider.addEventListener('input',()=>{setHour(Number(slider.value)/60);running=false;sync();update(0)});
 document.querySelectorAll('[data-hour]').forEach(button=>button.onclick=()=>{instant=presetTimes()[[5.5,12,18.5,23].indexOf(Number(button.dataset.hour))];hour=valleyTime(instant).hour;sync();update(0)});
 function skip(){const phases=presetTimes();instant=phases.find(t=>t.getTime()>instant.getTime()+360000)??new Date(phases[0].getTime()+86400000);hour=valleyTime(instant).hour;sync();update(0)}
 const C=hex=>new T.Color(hex),palette={zenithDay:C('#2f69b8'),zenithTwilight:C('#2a3a78'),zenithNight:C('#030817'),horizonDay:C('#b4d0e2'),horizonGolden:C('#e8d6bd'),horizonTwilight:C('#d79a86'),horizonNight:C('#070f22'),glowGolden:C('#ffcf95'),glowTwilight:C('#ff7e45'),sunHigh:C('#fff6e8'),sunGolden:C('#ffd08f'),sunLow:C('#ff8a4c'),cloudDay:C('#fbfbf8'),cloudGolden:C('#ffd9b0'),cloudTwilight:C('#e98a74'),cloudNight:C('#1b2436'),skyLightDay:C('#d4e6ff'),skyLightNight:C('#41598a'),groundLightDay:C('#8a8a72'),groundLightNight:C('#141f30')};
 // three.js applies fog after tone mapping (it sRGB-encodes the fog colour itself), so the fog colour is the tone-mapped horizon colour.
 function displayed(color,exposure,out){const k=exposure/.6,r=color.r*k,g=color.g*k,b=color.b*k,i=[.59719*r+.35458*g+.04823*b,.076*r+.90834*g+.01566*b,.0284*r+.13383*g+.83777*b].map(v=>(v*(v+.0245786)-.000090537)/(v*(.983729*v+.432951)+.238081)),o=[1.60475*i[0]-.53108*i[1]-.07367*i[2],-.10208*i[0]+1.10813*i[1]-.00605*i[2],-.00327*i[0]-.07276*i[1]+1.07602*i[2]].map(v=>Math.min(1,Math.max(0,v)));return out.setRGB(o[0],o[1],o[2],T.LinearSRGBColorSpace)}
 function update(dt,advance=true){if(running&&advance)instant=new Date(instant.getTime()+dt*120000);hour=valleyTime(instant).hour;const state=skyState(instant,camera.position.x,camera.position.z),altitude=state.sunDirection.y,day=T.MathUtils.smoothstep(altitude,-.35,.3),night=1-T.MathUtils.smoothstep(altitude,-.4,.05),twilight=Math.exp(-Math.pow(altitude/.24,2));const golden=1-T.MathUtils.smoothstep(altitude,.05,.45),light=T.MathUtils.smoothstep(altitude,-.12,.2),glowing=Math.exp(-Math.pow(altitude/.2,2)),u=skyMaterial.uniforms;
// Ephemerides follow the observer and simulated date, independently for each body.
const direction=new T.Vector3().copy(state.sunDirection),moonDirection=new T.Vector3().copy(state.moonDirection);sun.position.copy(direction).multiplyScalar(1000);
// A stronger, warmer sun against a softer sky light gives shape to buildings and long golden mornings and evenings.
sun.intensity=3.1*T.MathUtils.smoothstep(altitude,-.02,.25);sun.color.copy(palette.sunHigh).lerp(palette.sunGolden,golden).lerp(palette.sunLow,glowing*.8);ambient.intensity=T.MathUtils.lerp(.22,.95,day);ambient.color.copy(palette.skyLightNight).lerp(palette.skyLightDay,day);ambient.groundColor.copy(palette.groundLightNight).lerp(palette.groundLightDay,day);moonLight.target.position.copy(camera.position);moonLight.position.copy(camera.position).addScaledVector(moonDirection,1000);moonLight.target.updateMatrixWorld();moonLight.intensity=.45*night*state.illumination.fraction*T.MathUtils.smoothstep(moonDirection.y,-.02,.15);
u.zenithColor.value.copy(palette.zenithNight).lerp(palette.zenithDay,light).lerp(palette.zenithTwilight,glowing*.45*(1-light*.6));u.horizonColor.value.copy(palette.horizonNight).lerp(palette.horizonDay,light).lerp(palette.horizonGolden,golden*light*.5).lerp(palette.horizonTwilight,glowing*.6);u.glowColor.value.copy(palette.glowGolden).lerp(palette.glowTwilight,glowing);u.glowAmount.value=Math.max(golden*light*.35,glowing*.85);u.sunColor.value.copy(sun.color);u.sunDirection.value.copy(direction);u.daylight.value=day;u.sunHalo.value=T.MathUtils.smoothstep(altitude,-.08,.02);u.moonDirection.value.copy(moonDirection);u.moonHalo.value=state.illumination.fraction*(.15+.85*night)*T.MathUtils.smoothstep(moonDirection.y,-.02,.08);u.cloudTint.value.copy(palette.cloudNight).lerp(palette.cloudDay,light).lerp(palette.cloudGolden,golden*light*.6).lerp(palette.cloudTwilight,glowing*.7);u.cloudShadow.value.copy(u.cloudTint.value).multiplyScalar(.62).lerp(u.zenithColor.value,.25);
renderer.toneMappingExposure=T.MathUtils.lerp(1.22,1,day);displayed(u.horizonColor.value,renderer.toneMappingExposure,scene.fog.color);scene.fog.near=T.MathUtils.lerp(300,800,day);sunDisc.position.copy(direction).multiplyScalar(8500).add(camera.position);sunDisc.visible=altitude>-.04;sunDisc.material.color.set('#fff2cc').lerp(new T.Color('#ffad70'),twilight);moonDisc.position.copy(moonDirection).multiplyScalar(8500).add(camera.position);moonDisc.visible=moonDirection.y>-.01;moonDisc.material.color.set('#dce9ff').multiplyScalar(.08+.92*state.illumination.fraction);stars.material.opacity=night*.85;stars.position.copy(camera.position);for(const material of windowMaterials)material.emissiveIntensity=night*(material.userData.nightBrightness??1.7);for(const material of photoMaterials)material.color.set('#101b32').lerp(new T.Color('#ffffff'),day);const now=Math.floor(hour*60);if(now!==uiClock){uiClock=now;sync()}return{night,day,hour}}
 update(0);return{update,skip};
}
