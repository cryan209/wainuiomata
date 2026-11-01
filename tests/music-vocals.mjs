import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {createMusic,MUSIC_TRACKS} from '../dist/music.js';
import {createVocals} from '../dist/vocals.js';
import {VOCAL_HOOKS} from '../dist/vocal-hooks.js';
assert.equal(VOCAL_HOOKS.length,10);
assert.equal(new Set(VOCAL_HOOKS.map(h=>h.id)).size,10);
assert.deepEqual([...new Set(VOCAL_HOOKS.map(h=>h.track))].sort(),MUSIC_TRACKS.filter(t=>t.vocals).map(t=>t.id).sort());
for(const hook of VOCAL_HOOKS){
 assert.ok(hook.text.length>10&&hook.voice);
 assert.equal(hook.bpm,MUSIC_TRACKS.find(t=>t.id===hook.track).bpm);
 assert.ok(hook.duration>1&&hook.duration<hook.beats*60/hook.bpm,'Hooks fit inside their bar');
 const path=new URL(`../dist/${hook.file}`,import.meta.url);assert.ok(statSync(path).size>8000);assert.equal(readFileSync(path).subarray(0,3).toString(),'ID3');
}
const fetched=[],scheduled=[],sources=[];
const param=()=>({value:0,cancelled:0,setValueAtTime(v){this.value=v},setTargetAtTime(v){this.value=v},linearRampToValueAtTime(v){this.value=v},exponentialRampToValueAtTime(v){this.value=v},cancelScheduledValues(){this.cancelled++}});
const node=()=>({connect(n){this.target=n},disconnect(){this.disconnected=true}});
const ctx={currentTime:0,sampleRate:100,createGain:()=>({...node(),gain:param()}),createBiquadFilter:()=>({...node(),frequency:param()}),createBuffer:(c,n)=>({getChannelData:()=>new Float32Array(n)}),createOscillator:()=>({...node(),frequency:param(),start(){},stop(){}}),createBufferSource(){const s={...node(),start(time){assert.ok(time>=ctx.currentTime);this.time=time},stop(time){this.end=time}};sources.push(s);return s},async decodeAudioData(data){return {tag:new TextDecoder().decode(data),duration:1.4}}};
const fetchAudio=async url=>{fetched.push(String(url));return {ok:true,arrayBuffer:async()=>new TextEncoder().encode(String(url).split('/').at(-1)).buffer}};
const vocals=createVocals(ctx,{fetchAudio,schedule:(source,time,duration,volume)=>scheduled.push({source,time,duration,volume})});
const first=vocals.load('summit');assert.equal(vocals.load('summit'),first,'Concurrent loads share one promise');await first;assert.equal(fetched.length,2);
await vocals.load('coast');assert.equal(fetched.length,2,'Instrumental tracks fetch nothing');
vocals.play('summit',0,1,.5);assert.equal(scheduled.length,0,'Opening bars stay instrumental');
for(const bar of [4,12,20,28])vocals.play('summit',bar,bar*2,.5);
assert.deepEqual(scheduled.map(s=>s.source.buffer.tag),['summit-1.mp3','summit-2.mp3','summit-1.mp3','summit-2.mp3']);
assert.ok(scheduled.every(s=>s.duration>0&&s.duration<=2&&s.volume>0));
let failures=0;const unavailable=createVocals(ctx,{schedule:()=>assert.fail('No failed sample should play'),fetchAudio:async()=>{failures++;throw Error('offline')}});await unavailable.load('garage');unavailable.play('garage',4,1,.5);await unavailable.load('garage');assert.equal(failures,2,'Failed assets are not retried every frame');
const partial=createVocals(ctx,{schedule:source=>assert.equal(source.buffer.tag,'arcade-2.mp3'),fetchAudio:async url=>String(url).includes('arcade-1')?{ok:false}:fetchAudio(url)});await partial.load('arcade');partial.play('arcade',4,1,.5);
// Integrate actual music envelopes: cue at chorus, cancel on pause/tune and release nodes.
sources.length=0;const music=createMusic(ctx,{}, {fetchAudio});music.select('summit');await music.loaded;
const beat=60/132;
for(let t=0;t<17*beat;t+=.025){ctx.currentTime=t;music.update(true)}
const firstVocal=sources.find(s=>s.buffer?.tag);assert.ok(firstVocal);assert.ok(Math.abs(firstVocal.time-(.04+16*beat))<.001,'First hook starts precisely on bar five');
music.update(false);assert.ok(firstVocal.target.gain.cancelled>0,'Pause cancels scheduled vocal envelopes');
firstVocal.onended();assert.ok(firstVocal.disconnected&&firstVocal.target.disconnected,'Ended vocals release sources and envelopes');
let count=sources.filter(s=>s.buffer?.tag).length;ctx.currentTime+=10;music.update(false);assert.equal(sources.filter(s=>s.buffer?.tag).length,count,'Pause schedules no further vocals');
music.select('coast');for(let i=0;i<200;i++){ctx.currentTime+=.1;music.update(true)}assert.equal(sources.filter(s=>s.buffer?.tag).length,count,'Switching to an instrumental prevents old hooks');
music.select('garage');await music.loaded;for(let i=0;i<110;i++){ctx.currentTime+=.025;music.update(true)}music.select('arcade');await music.loaded;for(let i=0;i<300;i++){ctx.currentTime+=.025;music.update(true)}
const arcade=sources.find(s=>s.buffer?.tag?.startsWith('arcade'));assert.ok(arcade,'Switching to another vocal track loads and plays its own hooks');music.tune('coast');assert.ok(arcade.target.gain.cancelled>0,'Retuning silences the previous vocal');
console.log('PASS: ten packaged vocal hooks, valid track metadata, lazy/cached loading, failed/partial loads, alternating chorus cues, beat timing, pause/tune cancellation and voice cleanup.');
