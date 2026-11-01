// Packaged synthetic voices: no speech service, microphone or network account needed.
export function createRadio(ctx,output,{onCaption=()=>{},fetchAudio=globalThis.fetch?.bind(globalThis)}={}){
 let ready=[],source=null,serial=0,nextAd=0,breaks=0,disposed=false;
 const controller=new AbortController();
 // Loading failures leave the uninterrupted instrumental playlist available.
 const loaded=(async()=>{
  if(!fetchAudio||!ctx.decodeAudioData)return;
  try{
   const response=await fetchAudio(new URL('./audio/radio/manifest.json?v=radio-ads-2',import.meta.url),{signal:controller.signal});if(!response.ok)return;
   const manifest=await response.json();
   const results=await Promise.allSettled(manifest.map(async ad=>{const res=await fetchAudio(new URL(`./${ad.file}`,import.meta.url),{signal:controller.signal});if(!res.ok)throw Error('Radio asset unavailable');const buffer=await ctx.decodeAudioData(await res.arrayBuffer());return {...ad,buffer}}));
   if(!disposed)ready=results.filter(r=>r.status==='fulfilled').map(r=>r.value);
  }catch{}
 })();
 function stop(){if(!source)return;serial++;if(source){source.onended=null;try{source.stop()}catch{}source.disconnect();source=null}onCaption(null)}
 return{
  loaded,
  get active(){return !!source},
  betweenTracks(time){
   breaks++;if(breaks<2||!ready.length||source)return false;breaks=0;
   const ad=ready[nextAd++%ready.length],token=++serial;
   try{source=ctx.createBufferSource();source.buffer=ad.buffer;source.connect(output);source.onended=()=>{if(token!==serial)return;source.disconnect();source=null;onCaption(null)};source.start(Math.max(time,ctx.currentTime));onCaption({title:ad.title,text:ad.text});return true}catch{stop();return false}
  },
  update(enabled){if(!enabled)stop()},
  stop,
  dispose(){disposed=true;controller.abort();stop();ready=[]}
 };
}
