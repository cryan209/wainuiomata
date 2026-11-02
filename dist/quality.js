import {setDetailRange} from './spatial-split.js?v=paced-1';
import {setStreamBudgetScale} from './frame-budget.js?v=1';
// Graphics tiers, lowest first. scale: render resolution; far: view distance in metres (fog follows it);
// vegetation: multiplier on forest, town tree and fence distances; terrain: [distance-band multiplier, nearest ground step in metres];
// detailRange: metres beyond which small facade details (joinery, side windows) are hidden; stream: multiplier on the
// milliseconds per frame that scenery builders may spend; shadowLevel: the shadow quality Auto picks. Shadows re-render every caster several times a second,
// so they are the first thing a weak GPU loses.
export const TIERS=[
 {id:'low',label:'Low · 50% resolution, no shadows, 2 km view',scale:.5,shadows:false,far:2000,vegetation:.45,terrain:[.3,5],detailRange:400,stream:.4},
 {id:'reduced',label:'Reduced · 65% resolution, no shadows, 6 km view',scale:.65,shadows:false,far:6000,vegetation:.65,terrain:[.75,2],detailRange:900,stream:.6},
 {id:'balanced',shadowLevel:'low',label:'Balanced · 75% resolution, 12 km view',scale:.75,shadows:true,far:12000,vegetation:.85,terrain:[1,2],detailRange:Infinity,stream:.85},
 {id:'quality',shadowLevel:'medium',label:'Quality · native resolution, full view',scale:1,shadows:true,far:30000,vegetation:1,terrain:[1,2],detailRange:Infinity,stream:1},
];
const CHOICE_KEY='wainui-graphics',AUTO_KEY='wainui-graphics-auto',SHADOW_KEY='wainui-shadow-quality';
const load=key=>{try{return localStorage.getItem(key)}catch{return null}},save=(key,value)=>{try{localStorage.setItem(key,value)}catch{}};

// A first guess before any frames are measured: software rasterisers and very small machines start on Low; common
// integrated/mobile GPUs (including Iris and the unnumbered Radeon/Vega APU graphics) start on Reduced.
function guessTier(renderer){
 let gpu='';try{const gl=renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');gpu=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):''}catch{}
 if(/swiftshader|llvmpipe|softpipe|software|basic render/i.test(gpu)||(navigator.hardwareConcurrency||8)<=2||(navigator.deviceMemory||8)<=2)return 0;
 if(/mali|adreno|powervr|videocore|intel.*((hd|uhd) graphics|iris)|intel\(r\) graphics|radeon(\(tm\))? (graphics|vega)/i.test(gpu)||(navigator.hardwareConcurrency||8)<=4||(navigator.deviceMemory||8)<=4)return 1;
 return 2;
}

// Auto mode measures frame rate in two-second windows. It steps down below 40 FPS and tries one step up after
// six seconds at the refresh cap; a tier that fails twice is not retried. The settled tier is remembered.
export function createQuality({renderer,camera,sky,vegetation=[],terrain,setScale,select,shadowToggle,shadowQuality,setShadowQuality}){
 let shadowChoice=load(SHADOW_KEY)||'auto';
 const saved=load(AUTO_KEY);let auto=true,tier=saved!==null&&TIERS[saved]?Number(saved):guessTier(renderer),shadowsOffByUs=false;
 const failures=TIERS.map(()=>0);let elapsed=0,frames=0,settle=3,fastWindows=0;
 function apply(){
  const t=TIERS[tier];setScale(t.scale);camera.far=t.far;camera.updateProjectionMatrix();
  // The sky dome is 10 km across; shrink it inside the far plane so it is never clipped.
  sky.scale.setScalar(Math.min(1,t.far*.9/10000));for(const v of vegetation)v?.setDetail?.(t.vegetation);terrain?.setDetail?.(...t.terrain,Math.min(5000,t.far+400));setStreamBudgetScale(t.stream);setDetailRange(t.detailRange);setShadowQuality?.(shadowChoice==='auto'?t.shadowLevel||'low':shadowChoice);
  if(shadowToggle){
   if(!t.shadows&&shadowToggle.checked){shadowToggle.checked=false;shadowsOffByUs=true;shadowToggle.dispatchEvent(new Event('change'))}
   else if(t.shadows&&shadowsOffByUs&&!shadowToggle.checked){shadowToggle.checked=true;shadowsOffByUs=false;shadowToggle.dispatchEvent(new Event('change'))}
  }
  elapsed=frames=fastWindows=0;settle=1.5;
 }
 function set(next){next=Math.max(0,Math.min(TIERS.length-1,next));if(next===tier)return;tier=next;if(auto)save(AUTO_KEY,String(tier));apply()}
 if(select){
  select.innerHTML='<option value="auto">Auto · adjusts to keep the frame rate up</option>'+TIERS.map((t,i)=>`<option value="${i}">${t.label}</option>`).join('');
  const choice=load(CHOICE_KEY);if(choice!==null&&choice!=='auto'&&TIERS[Number(choice)]){auto=false;tier=Number(choice)}
  select.value=auto?'auto':String(tier);
  select.onchange=()=>{save(CHOICE_KEY,select.value);auto=select.value==='auto';if(auto){failures.fill(0);elapsed=frames=fastWindows=0}else set(Number(select.value))};
 }
 if(shadowQuality){
  shadowQuality.innerHTML='<option value="auto">Auto · follows graphics</option><option value="low">Low · 110 m, hard edges, 4× a second</option><option value="medium">Medium · 170 m, soft edges</option><option value="high">High · 220 m, sharper, every few frames</option>';
  shadowQuality.value=shadowChoice;shadowQuality.onchange=()=>{shadowChoice=shadowQuality.value;save(SHADOW_KEY,shadowChoice);setShadowQuality?.(shadowChoice==='auto'?TIERS[tier].shadowLevel||'low':shadowChoice)};
 }
 // A player's own shadow choice wins until the tier next turns them off.
 shadowToggle?.addEventListener('change',e=>{if(e.isTrusted)shadowsOffByUs=false});
 apply();
 return{
  get tier(){return TIERS[tier]},get auto(){return auto},
  update(dt,running){
   if(!auto||!running||dt>.5)return;if(settle>0){settle-=dt;return}
   elapsed+=dt;frames++;if(elapsed<2)return;
   const fps=frames/elapsed;elapsed=frames=0;
   if(fps<40&&tier>0){failures[tier]++;fastWindows=0;set(tier-1)}
   else if(fps>57&&tier<TIERS.length-1&&failures[tier+1]<2){if(++fastWindows>=3)set(tier+1)}
   else fastWindows=0;
  },
 };
}
