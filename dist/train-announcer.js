import {TRAIN_ANNOUNCEMENTS} from './train-announcement-clips.js?v=train-pa-1';
const canonical=name=>(name||'').replace(/\s+\([^)]*\)$/,'');
export function createTrainAnnouncer(ctx,output,{onCaption=()=>{},fetchAudio=globalThis.fetch?.bind(globalThis)}={}){
 const cache=new Map();let source=null,envelope=null,serial=0,enabled=true,captionUntil=0,pending=false;
 const clipFor=event=>TRAIN_ANNOUNCEMENTS.find(clip=>clip.kind===event.kind&&clip.station===canonical(event.station));
 function load(clip){
  if(!clip||!ctx.decodeAudioData||!fetchAudio)return Promise.resolve(null);
  if(!cache.has(clip.id))cache.set(clip.id,(async()=>{try{const response=await fetchAudio(new URL(`./${clip.file}`,import.meta.url));if(!response.ok)return null;return await ctx.decodeAudioData(await response.arrayBuffer())}catch{return null}})());
  return cache.get(clip.id);
 }
 function stop(){serial++;pending=false;if(source){source.onended=null;try{source.stop()}catch{}source.disconnect();envelope.disconnect();source=envelope=null}if(captionUntil){captionUntil=0;onCaption(null)}}
 return {
  preload(station){return Promise.all(TRAIN_ANNOUNCEMENTS.filter(clip=>clip.station===canonical(station)).map(load))},
  async announce(event){
   stop();if(!enabled||!event)return false;const clip=clipFor(event);if(!clip)return false;
   const token=serial;pending=true;captionUntil=ctx.currentTime+clip.duration;onCaption(clip.text);
   const buffer=await load(clip);if(token!==serial||!enabled)return false;pending=false;if(!buffer)return false;
   const voice=ctx.createBufferSource(),gain=ctx.createGain();source=voice;envelope=gain;voice.buffer=buffer;gain.gain.value=.8;voice.connect(gain);gain.connect(output);captionUntil=ctx.currentTime+buffer.duration;
   voice.onended=()=>{if(serial!==token)return;voice.disconnect();gain.disconnect();source=envelope=null;captionUntil=0;onCaption(null)};
   voice.start(ctx.currentTime);return true;
  },
  update(audible){if(enabled!==audible){enabled=audible;if(!enabled)stop()}if(captionUntil&&ctx.currentTime>=captionUntil&&!source&&!pending){captionUntil=0;onCaption(null)}},
  stop,
  get active(){return !!source||pending}
 };
}
