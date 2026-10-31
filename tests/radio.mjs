import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {createRadio} from '../dist/radio.js';
import {createMusic} from '../dist/music.js';
const manifest=JSON.parse(readFileSync(new URL('../dist/audio/radio/manifest.json',import.meta.url)));
assert.equal(manifest.length,6);
for(const ad of manifest){assert.ok(ad.text.length>80&&ad.duration>5&&ad.duration<20);assert.ok(statSync(new URL(`../dist/${ad.file}`,import.meta.url)).size>20000)}
const sources=[],captions=[];
const param=()=>({setValueAtTime(){},setTargetAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}});
const ctx={currentTime:0,sampleRate:100,async decodeAudioData(){return {duration:10}},createGain:()=>({gain:param(),connect(){},disconnect(){}}),createBiquadFilter:()=>({frequency:param(),connect(){},disconnect(){}}),createOscillator:()=>({frequency:param(),connect(){},disconnect(){},start(){},stop(){}}),createBuffer:(c,n)=>({getChannelData:()=>new Float32Array(n)}),createBufferSource(){const s={connect(){},disconnect(){this.disconnected=true},start(time){this.time=time},stop(){this.stopped=true}};sources.push(s);return s}};
const fetchAudio=async url=>({ok:true,json:async()=>manifest,arrayBuffer:async()=>new ArrayBuffer(10)});
const radio=createRadio(ctx,{}, {fetchAudio,onCaption:ad=>captions.push(ad)});
await radio.loaded;
assert.equal(radio.betweenTracks(.1),false,'No ad after the first track');
assert.equal(radio.betweenTracks(.2),true);assert.equal(radio.active,true);assert.equal(captions.at(-1).title,manifest[0].title);assert.equal(sources.at(-1).time,.2);
const first=sources.at(-1);radio.update(false);assert.equal(radio.active,false);assert.ok(first.stopped&&first.disconnected);assert.equal(captions.at(-1),null);
radio.betweenTracks(1);assert.equal(radio.betweenTracks(1),true);assert.equal(captions.at(-1).title,manifest[1].title,'Ads rotate');sources.at(-1).onended();assert.equal(radio.active,false);assert.equal(captions.at(-1),null);
let breaks=0;const music=createMusic(ctx,{}, {onTrackEnd:time=>{breaks++;return true}});
for(let i=0;i<1500&&!breaks;i++){ctx.currentTime=i*.1;music.update(true)}
assert.equal(breaks,1,'Automatic track boundary hands off to radio');
const oscillatorTrack=music.currentTrack.id;music.update(false);ctx.currentTime+=15;music.update(true);assert.equal(music.currentTrack.id,oscillatorTrack,'Music resumes on the following track');
music.select('valley');const before=breaks;for(let i=0;i<1600;i++){ctx.currentTime+=.1;music.update(true)}assert.equal(breaks,before,'Individual track repeat is ad-free');
const failed=createRadio(ctx,{}, {fetchAudio:async()=>{throw Error('offline')}});await failed.loaded;assert.equal(failed.betweenTracks(0),false);assert.equal(failed.betweenTracks(0),false,'Failed loads leave music uninterrupted');
radio.dispose();failed.dispose();
console.log('PASS: six packaged voiced spots, captions, ad cadence and rotation, pause/mute cancellation, music handoff, ad-free manual tracks and missing-audio fallback.');
