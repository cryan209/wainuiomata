import {radioStation} from './radio-stations.js';
// Original instrumental arrangements, synthesised locally without audio downloads.
export const MUSIC_TRACKS = [
 {id:'valley',name:'Valley Afterglow',bpm:86,chords:[[50,53,57,60],[46,50,53,57],[53,57,60,64],[48,52,55,60]],melody:[0,7,12,7,3,10,7,5],voice:'sine',style:'laidback'},
 {id:'harbour',name:'Harbour Lights',bpm:104,chords:[[48,52,55,59],[45,48,52,55],[53,57,60,64],[55,59,62,65]],melody:[7,12,16,14,12,7,4,2],voice:'triangle',style:'house'},
 {id:'hill',name:'Hill Road FM',bpm:118,chords:[[45,48,52,55],[53,57,60,64],[48,52,55,59],[55,59,62,65]],melody:[0,12,7,15,12,19,7,10],voice:'triangle',style:'breaks'},
 {id:'coast',name:'Coast Road Sunday',bpm:76,chords:[[55,59,62,66],[52,55,59,62],[48,52,55,59],[50,54,57,60]],melody:[12,7,4,7,11,9,4,2],voice:'sine',style:'laidback'},
 {id:'mist',name:'Morning in the Ranges',bpm:68,chords:[[50,57,60,64],[48,55,59,62],[46,53,57,60],[53,60,64,67]],melody:[0,7,14,12,7,9,5,2],voice:'sine',style:'ambient'},
 {id:'queen',name:'Queen Street Shuffle',bpm:96,chords:[[52,55,59,62],[57,60,64,67],[50,54,57,60],[55,59,62,65]],melody:[0,3,7,10,12,10,7,3],voice:'triangle',style:'funk',swing:.16},
 {id:'petone',name:'Petone Sunset Dub',bpm:82,chords:[[45,48,52,55],[50,53,57,60],[43,47,50,53],[52,55,59,62]],melody:[7,0,12,10,7,3,0,5],voice:'sine',style:'dub',swing:.08},
 {id:'express',name:'Midnight Express',bpm:124,chords:[[42,49,54,57],[45,52,57,61],[47,54,59,62],[40,47,52,55]],melody:[0,7,12,19,14,12,7,2],voice:'triangle',style:'synth'},
 {id:'rain',name:'Rain on the Veranda',bpm:72,chords:[[53,57,60,64],[50,53,57,60],[55,59,62,65],[48,52,55,59]],melody:[16,12,7,4,9,7,4,2],voice:'sine',style:'laidback',swing:.22},
 {id:'seaview',name:'Seaview Warehouse',bpm:130,chords:[[48,51,55,58],[44,48,51,55],[46,50,53,56],[43,46,50,53]],melody:[0,12,7,10,15,12,19,7],voice:'triangle',style:'garage',swing:.20},
 {id:'rata',name:'Rata Street Daydream',bpm:90,chords:[[57,60,64,67],[53,57,60,64],[48,52,55,59],[55,59,62,65]],melody:[12,16,19,16,14,12,7,9],voice:'sine',style:'funk',swing:.12},
 {id:'stars',name:'Stars over Eastbourne',bpm:64,chords:[[52,59,62,66],[55,62,66,69],[50,57,61,64],[48,55,59,62]],melody:[7,14,19,12,16,9,14,7],voice:'sine',style:'ambient'}
];
export function createMusic(ctx,output,{onTrackEnd=()=>false}={}){
 let next=0,tick=0,running=false,selection='auto',trackIndex=0,station=radioStation('valley');
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
  tune(id){station=radioStation(id);silence();selection='auto';trackIndex=MUSIC_TRACKS.findIndex(t=>t.id===station.tracks[0]);tick=0;running=false},
  select(id){const value=id==='auto'||MUSIC_TRACKS.some(t=>t.id===id)?id:'auto';if(value===selection)return;silence();selection=value;trackIndex=value==='auto'?MUSIC_TRACKS.findIndex(t=>t.id===station.tracks[0]):MUSIC_TRACKS.findIndex(t=>t.id===value);tick=0;running=false},
  get currentTrack(){return MUSIC_TRACKS[trackIndex]},
  update(enabled){if(!enabled){if(running)silence();running=false;return}if(!running||next<ctx.currentTime-.2){next=ctx.currentTime+.04;running=true}while(next<ctx.currentTime+.16){
   if(tick>=256){tick=0;if(selection==='auto'){trackIndex=MUSIC_TRACKS.findIndex(t=>t.id===station.tracks[(station.tracks.indexOf(MUSIC_TRACKS[trackIndex].id)+1)%station.tracks.length]);if(onTrackEnd(next)){silence();running=false;return}}}
   const track=MUSIC_TRACKS[trackIndex],beat=60/track.bpm,index=tick%8,bar=Math.floor(tick/8),chord=track.chords[Math.floor(bar/2)%4],ambient=track.style==='ambient';
   if(index===0){for(const midi of chord)note(midi+12,next,beat*3.8,ambient?.035:.03,'triangle');note(chord[0]-12,next,beat*1.7,.12)}
   if(index===4)note(chord[0]-12,next,beat*1.5,.10);
   if(!ambient){
    const four=track.style==='house'||track.style==='synth';
    if(four?index%2===0:index===0||index===4&&track.style!=='dub'||(track.style==='breaks'||track.style==='garage')&&index===7)kick(next);
    if(index===2||index===6)percussion(next,true);
    if(index%2===1||track.style==='garage'&&index===4)percussion(next,false);
    if(['dub','funk','garage'].includes(track.style)&&index%2===1)for(const midi of chord.slice(1))note(midi+12,next,beat*.3,.025,'triangle');
    if(track.style==='synth')note(chord[index%4]+12,next,beat*.4,.04,'triangle');
    if(track.style==='funk'&&(index===3||index===7))note(chord[0],next,beat*.35,.08);
   }
   if(tick%(ambient?4:2)===0)note(chord[0]+24+track.melody[Math.floor(tick/2)%track.melody.length],next,beat*(ambient?2.4:1),.038,track.voice);
   tick++;next+=beat/2*(1+(index%2===0?1:-1)*(track.swing||0));
  }}
 };
}
