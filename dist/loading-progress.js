// Loading bar under the start button: what is downloading, how far through it is, and a note when it goes quiet.
// Loaded before game.js so every fetch the world makes passes through here; response bodies are counted as they stream.
// Downloads fill the first 40% against the bytes the last completed load needed (or, on a first visit, the sizes announced
// so far); building the world from them fills the rest against how long that took last time. It stops short of full until
// #play is enabled. A download that goes quiet is called out; the build phase only counts its seconds.
const SAVED='wainui-load',STALL=15000,DOWNLOAD_SHARE=.4;
const NAMES=[[/regional-terrain|terrain-fine|terrain\.bin|geodata/,'Terrain'],[/regional-far|regional-roof-far/,'Distant buildings'],[/buildings|building-|roof-detail/,'Buildings'],[/regional-map|map\.json|railways|traffic-controls/,'Roads and railways'],[/waterways|coast/,'Rivers and coast'],[/forest|open-spaces|foliage/,'Bush and parks'],[/ground-|roof-aerial|roof-imagery|\.jpg$/,'Aerial imagery'],[/facade|surfaces|\.png$/,'Textures'],[/audio|\.mp3$|\.ogg$|\.m4a$/,'Sound'],[/\.json$/,'Map data']];
const label=url=>{const file=decodeURIComponent(new URL(url,location.href).pathname.split('/').pop());return (NAMES.find(([re])=>re.test(file))?.[1]||'Data')+' · '+file};
const mb=b=>(b/1048576).toFixed(b<1048576*10?1:0)+' MB';
let saved={bytes:0,build:0};try{saved={...saved,...JSON.parse(localStorage.getItem(SAVED)||'{}')}}catch{}
const active=new Map();let loaded=0,announced=0,finished=0,started=0,lastChange=performance.now(),last='',done=false,ui=null,building=0,stage='';
// Startup code names each heavy step: `await globalThis.loadingStage?.('Roads')`. The label is drawn at once and the promise
// waits one frame (or 50ms in a hidden tab) so it paints before the step blocks the page.
globalThis.loadingStage=name=>{stage=name;if(!building)building=performance.now();render();return new Promise(resolve=>{let gone=false;const go=()=>{if(!gone){gone=true;setTimeout(resolve)}};requestAnimationFrame(go);setTimeout(go,50)})};
const realFetch=globalThis.fetch.bind(globalThis);
globalThis.fetch=async(input,init)=>{
 const res=await realFetch(input,init);if(done||!res.ok||!res.body)return res;
 const url=res.url||String(input?.url||input),size=Number(res.headers.get('content-length'))||0,entry={name:label(url),size,got:0};active.set(entry,true);started++;announced+=size;changed(entry.name);
 const counter=new TransformStream({transform(chunk,c){entry.got+=chunk.byteLength;loaded+=chunk.byteLength;lastChange=performance.now();c.enqueue(chunk)},flush(){active.delete(entry);finished++;changed(entry.name)}});
 const out=new Response(res.body.pipeThrough(counter),{status:res.status,statusText:res.statusText,headers:res.headers});Object.defineProperty(out,'url',{value:res.url});return out};
function changed(name){last=name;lastChange=performance.now();if(!active.size&&!building)building=lastChange}
function mount(){
 const play=document.getElementById('play');if(!play||ui)return;
 const style=document.createElement('style');style.textContent='#load-progress{margin:14px 0 4px;max-width:360px;font:600 10px/1.5 "DM Sans",sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#f6f5e9cc;transition:opacity .6s}#load-progress .track{height:4px;background:#f6f5e926;overflow:hidden}#load-progress .fill{height:100%;width:0;background:var(--lime,#d9ed87);transition:width .3s}#load-progress p{margin:8px 0 0;min-height:3em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#load-progress p span{display:block;overflow:hidden;text-overflow:ellipsis}#load-progress .stall{color:#f2c58b}#load-progress.done{opacity:0}';document.head.append(style);
 ui=document.createElement('div');ui.id='load-progress';ui.setAttribute('role','progressbar');ui.setAttribute('aria-valuemin','0');ui.setAttribute('aria-valuemax','100');ui.innerHTML='<div class="track"><div class="fill"></div></div><p aria-live="polite"><span class="what">Starting up…</span><span class="detail"></span></p>';play.after(ui);
 new MutationObserver(()=>{if(!play.disabled&&!/LOADING/i.test(play.textContent))finish()}).observe(play,{attributes:true,childList:true,characterData:true,subtree:true});
 requestAnimationFrame(draw)}
function draw(){if(!done&&ui){render();requestAnimationFrame(draw)}}
function render(){
 if(done||!ui)return;const now=performance.now(),downloads=Math.min(1,loaded/Math.max(saved.bytes,announced,1)),build=building?(now-building)/Math.max(saved.build,8000):0,share=Math.min(.97,downloads*DOWNLOAD_SHARE+(building?Math.min(1,build)*(1-DOWNLOAD_SHARE):0));
 const current=[...active.keys()].sort((a,b)=>(b.size-b.got)-(a.size-a.got))[0],quiet=now-lastChange;
 ui.querySelector('.fill').style.width=(share*100).toFixed(1)+'%';ui.setAttribute('aria-valuenow',Math.round(share*100));
 const what=ui.querySelector('.what'),detail=ui.querySelector('.detail');
 if(current){what.textContent=current.name;detail.textContent=(current.size?mb(current.got)+' / '+mb(current.size):mb(current.got))+' · '+finished+' of '+started+' files · '+mb(loaded)+' total'}
 else{what.textContent=stage||(started?'Building the world…':'Starting up…');detail.textContent=started?finished+' files · '+mb(loaded)+' · '+Math.round((now-building)/1000)+'s':''}
 const stalled=current&&quiet>STALL;detail.classList.toggle('stall',!!stalled);if(stalled)detail.textContent='No data for '+Math.round(quiet/1000)+'s · waiting on '+current.name;
}
function finish(){
 if(done)return;done=true;try{localStorage.setItem(SAVED,JSON.stringify({bytes:loaded,build:building?performance.now()-building:saved.build}))}catch{}
 if(!ui)return;ui.querySelector('.fill').style.width='100%';ui.setAttribute('aria-valuenow','100');ui.querySelector('.what').textContent='Ready';ui.querySelector('.detail').textContent=finished+' files · '+mb(loaded);setTimeout(()=>ui.classList.add('done'),900);setTimeout(()=>ui.remove(),1600)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
