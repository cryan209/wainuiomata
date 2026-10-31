// Original instrumental arrangements, synthesised locally without audio downloads.
export const MUSIC_TRACKS = [
 {id:'valley',name:'Valley Afterglow',bpm:86,chords:[[50,53,57,60],[46,50,53,57],[53,57,60,64],[48,52,55,60]],melody:[0,7,12,7,3,10,7,5],voice:'sine',style:'laidback'},
 {id:'harbour',name:'Harbour Lights',bpm:104,chords:[[48,52,55,59],[45,48,52,55],[53,57,60,64],[55,59,62,65]],melody:[7,12,16,14,12,7,4,2],voice:'triangle',style:'house'},
 {id:'hill',name:'Hill Road FM',bpm:118,chords:[[45,48,52,55],[53,57,60,64],[48,52,55,59],[55,59,62,65]],melody:[0,12,7,15,12,19,7,10],voice:'triangle',style:'breaks'},
 {id:'coast',name:'Coast Road Sunday',bpm:76,chords:[[55,59,62,66],[52,55,59,62],[48,52,55,59],[50,54,57,60]],melody:[12,7,4,7,11,9,4,2],voice:'sine',style:'laidback'},
 {id:'mist',name:'Morning in the Ranges',bpm:68,chords:[[50,57,60,64],[48,55,59,62],[46,53,57,60],[53,60,64,67]],melody:[0,7,14,12,7,9,5,2],voice:'sine',style:'ambient'}
];
export function createMusic(ctx,output){
 let next=0,tick=0,running=false,selection='auto',trackIndex=0;
 const voices=new Set(),drums=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.2),ctx.sampleRate),data=drums.getChannelData(0);
 for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
 function connect(source,time,duration,volume,attack=.01){
  const envelope=ctx.createGain();envelope.gain.setValueAtTime(0,time);envelope.gain.linearRampToValueAtTime(volume,time+attack);envelope.gain.exponentialRampToValueAtTime(.0001,time+duration);source.connect(envelope);envelope.connect(output);const voice={source,envelope};voices.add(voice);source.onended=()=>{source.disconnect();envelope.disconnect();voices.delete(voice)};source.start(time);source.stop(time+duration+.03);
 }
 function note(midi,time,duration,volume,type='sine'){const o=ctx.createOscillator();o.type=type;o.frequency.value=440*2**((midi-69)/12);connect(o,time,duration,volume,.025)}
 function kick(time){const o=ctx.createOscillator();o.frequency.setValueAtTime(110,time);o.frequency.exponentialRampToValueAtTime(42,time+.15);connect(o,time,.23,.13,.003)}
 function percussion(time,snare){const s=ctx.createBufferSource(),f=ctx.createBiquadFilter();s.buffer=drums;f.type='highpass';f.frequency.value=snare?1100:6500;s.connect(f);const wrapper={connect:n=>f.connect(n),disconnect:()=>{s.disconnect();f.disconnect()},start:t=>s.start(t),stop:t=>s.stop(t),set onended(fn){s.onended=fn}};connect(wrapper,time,snare?.13:.045,snare?.035:.018,.002)}
 function silence(){for(const {envelope} of voices){envelope.gain.cancelScheduledValues(ctx.currentTime);envelope.gain.setTargetAtTime(.0001,ctx.currentTime,.025)}}
 return{
  select(id){const value=id==='auto'||MUSIC_TRACKS.some(t=>t.id===id)?id:'auto';if(value===selection)return;silence();selection=value;trackIndex=value==='auto'?0:MUSIC_TRACKS.findIndex(t=>t.id===value);tick=0;running=false},
  get currentTrack(){return MUSIC_TRACKS[trackIndex]},
  update(enabled){if(!enabled){if(running)silence();running=false;return}if(!running||next<ctx.currentTime-.2){next=ctx.currentTime+.04;running=true}while(next<ctx.currentTime+.16){
   if(tick>=256){tick=0;if(selection==='auto')trackIndex=(trackIndex+1)%MUSIC_TRACKS.length}
   const track=MUSIC_TRACKS[trackIndex],beat=60/track.bpm,index=tick%8,bar=Math.floor(tick/8),chord=track.chords[Math.floor(bar/2)%4],ambient=track.style==='ambient';
   if(index===0){for(const midi of chord)note(midi+12,next,beat*3.8,ambient?.035:.03,'triangle');note(chord[0]-12,next,beat*1.7,.12)}
   if(index===4)note(chord[0]-12,next,beat*1.5,.10);
   if(!ambient){if(track.style==='house'?index%2===0:index===0||index===4||track.style==='breaks'&&index===7)kick(next);if(index===2||index===6)percussion(next,true);if(index%2===1)percussion(next,false)}
   if(tick%(ambient?4:2)===0)note(chord[0]+24+track.melody[Math.floor(tick/2)%track.melody.length],next,beat*(ambient?2.4:1),.038,track.voice);
   tick++;next+=beat/2;
  }}
 };
}
