import {VOCAL_HOOKS} from './vocal-hooks.js?v=vocals-1';
// Decode only the current song's short hooks; failed assets leave the backing playing.
export function createVocals(ctx,{schedule,fetchAudio=globalThis.fetch?.bind(globalThis)}={}){
 const loading=new Map(),ready=new Map();
 function load(trackId){
  if(loading.has(trackId))return loading.get(trackId);
  const hooks=VOCAL_HOOKS.filter(h=>h.track===trackId);
  const promise=(async()=>{
   if(!hooks.length||!fetchAudio||!ctx.decodeAudioData)return [];
   const results=await Promise.allSettled(hooks.map(async hook=>{
    const response=await fetchAudio(new URL(`./${hook.file}`,import.meta.url));if(!response.ok)throw Error('Vocal unavailable');
    const buffer=await ctx.decodeAudioData(await response.arrayBuffer());return {...hook,buffer};
   }));
   const loaded=results.filter(r=>r.status==='fulfilled').map(r=>r.value);ready.set(trackId,loaded);return loaded;
  })();
  loading.set(trackId,promise);return promise;
 }
 return {load,play(trackId,bar,time,beat){
  if(bar%8!==4)return;
  const hooks=ready.get(trackId);if(!hooks?.length)return;
  const hook=hooks[Math.floor(bar/8)%hooks.length],source=ctx.createBufferSource();source.buffer=hook.buffer;
  schedule(source,time,Math.min(hook.buffer.duration,beat*3.8),.40,.008);
 }};
}
