import assert from 'node:assert/strict';
import {RADIO_STATIONS,radioStation,nextRadioStation} from '../dist/radio-stations.js';
import {MUSIC_TRACKS,createMusic} from '../dist/music.js';
import {createDashboardRadio} from '../dist/dashboard-radio.js';
assert.equal(RADIO_STATIONS.length,8);
for(const field of ['id','frequency','name'])assert.equal(new Set(RADIO_STATIONS.map(s=>s[field])).size,RADIO_STATIONS.length,`Unique station ${field}`);
assert.equal(radioStation('missing').id,'valley');
assert.equal(nextRadioStation('valley',-1).id,'coast');
assert.equal(nextRadioStation('coast',1).id,'valley');
for(const [stationId,style] of [['summit','rock'],['pixel','chiptune']])assert.ok(radioStation(stationId).tracks.every(id=>MUSIC_TRACKS.find(t=>t.id===id)?.style===style),'Dedicated stations stick to their genre');
// Run each station long enough to wrap its whole playlist and reclaim voices.
const pending=[];
const param=()=>({value:0,setValueAtTime(){},setTargetAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}});
const node=()=>({connect(){},disconnect(){}});
const source=()=>{const s={...node(),frequency:param(),start(t){assert.ok(Number.isFinite(t)&&t>=ctx.currentTime)},stop(){}};pending.push(s);return s};
const ctx={currentTime:0,sampleRate:100,createOscillator:source,createBufferSource:source,createBuffer:(c,n)=>({getChannelData:()=>new Float32Array(n)}),createGain:()=>({...node(),gain:param()}),createBiquadFilter:()=>({...node(),frequency:param()})};
const music=createMusic(ctx,{});
for(const station of RADIO_STATIONS){
 assert.equal(new Set(station.tracks).size,station.tracks.length,'No duplicate playlist entries');
 const duration=station.tracks.reduce((sum,id)=>{const track=MUSIC_TRACKS.find(t=>t.id===id);assert.ok(track,'Every entry is playable');return sum+128*60/track.bpm},0);
 music.tune(station.id);const seen=[];const start=ctx.currentTime;
 for(let elapsed=0;elapsed<duration+2;elapsed+=.1){ctx.currentTime=start+elapsed;music.update(true);const id=music.currentTrack.id;if(seen.at(-1)!==id)seen.push(id);for(const s of pending.splice(0))s.onended?.()}
 assert.deepEqual(seen,[...station.tracks,station.tracks[0]],`${station.name} plays in order then wraps`);
}
// A small DOM fixture checks actual dashboard controls and state synchronization.
const element=()=>({attributes:{},setAttribute(k,v){this.attributes[k]=v}});
globalThis.document={createElement:element};
const selectors=['[data-radio-display]','[data-radio-track]','[data-radio-dial]','[data-radio-power]','[data-radio-volume]','[data-radio-prev]','[data-radio-next]'];
const controls=new Map(selectors.map(s=>[s,element()]));
const panel={replaceChildren(...buttons){this.buttons=buttons}};controls.set('.stereo-presets',panel);
const root={querySelector:s=>controls.get(s)};
const state={station:'valley',power:true,volume:.4,track:'Test track',ad:''};
const sound={radioState:state,tune(id){state.station=id},setRadioPower(on){state.power=on},setMusicVolume(value){state.volume=value}};
const dashboard=createDashboardRadio({sound,root});
assert.equal(panel.buttons.length,RADIO_STATIONS.length);
const dial=controls.get('[data-radio-dial]');assert.equal(dial.max,'7');
for(const [index,station] of RADIO_STATIONS.entries()){
 const button=panel.buttons[index];assert.ok(button.attributes['aria-label'].includes(station.name));button.onclick();dashboard.update({active:true,driving:true});
 assert.equal(state.station,station.id);assert.equal(dial.value,String(index));assert.equal(button.attributes['aria-pressed'],'true');
 assert.equal(panel.buttons.filter(b=>b.attributes['aria-pressed']==='true').length,1);
 assert.ok(controls.get('[data-radio-display]').textContent.includes(station.frequency));
 dial.value=String(index);state.station='valley';dial.oninput();assert.equal(state.station,station.id,'Dial reaches every station');
}
controls.get('[data-radio-next]').onclick();assert.equal(state.station,'valley');
controls.get('[data-radio-prev]').onclick();assert.equal(state.station,'coast');
controls.get('[data-radio-power]').onclick();dashboard.update({active:true,driving:true});assert.equal(controls.get('[data-radio-display]').textContent,'RADIO OFF');assert.ok(panel.buttons.every(b=>b.attributes['aria-pressed']==='false'));
dashboard.update({active:false,driving:true});assert.equal(root.hidden,true);
console.log('PASS: eight unique stations, dedicated rock/8-bit genres, full ordered playlist rotation, all presets and dial positions, wraparound tuning and dashboard power/state.');
