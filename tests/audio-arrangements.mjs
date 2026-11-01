import assert from 'node:assert/strict';
import {createMusic,MUSIC_TRACKS} from '../dist/music.js';
import {createVehicleAudio} from '../dist/vehicle-audio.js';
function audio(){
 const nodes=[],sources=[];
 const param=()=>({value:0,setValueAtTime(v){assert.ok(Number.isFinite(v));this.value=v},setTargetAtTime(v){assert.ok(Number.isFinite(v));this.value=v},linearRampToValueAtTime(v){assert.ok(Number.isFinite(v));this.value=v},exponentialRampToValueAtTime(v){assert.ok(v>0&&Number.isFinite(v));this.value=v},cancelScheduledValues(){}});
 const node=()=>({connect(){},disconnect(){}});
 const ctx={sampleRate:22050,currentTime:0,createGain(){const n={...node(),gain:param()};nodes.push(n);return n},createBiquadFilter(){return {...node(),frequency:param()}},createBuffer(c,n){return {getChannelData:()=>new Float32Array(n)}},createBufferSource(){const s={...node(),start(t=0){assert.ok(t>=ctx.currentTime)},stop(){}};sources.push(s);return s},createOscillator(){const s={...node(),frequency:param(),start(t=0){assert.ok(t>=ctx.currentTime)},stop(){}};sources.push(s);return s}};
 return {ctx,nodes,sources};
}
const a=audio(),music=createMusic(a.ctx,{});
assert.equal(MUSIC_TRACKS.length,12);assert.equal(new Set(MUSIC_TRACKS.map(t=>t.id)).size,12);
const visited=new Set();
for(let i=0;i<20000;i++){a.ctx.currentTime=i*.1;music.update(true);visited.add(music.currentTrack.id);for(const source of a.sources.splice(0))source.onended?.()}
assert.equal(visited.size,12,'Auto playlist reaches every arrangement');
for(const track of MUSIC_TRACKS){music.select(track.id);assert.equal(music.currentTrack.id,track.id);for(let i=0;i<25;i++){a.ctx.currentTime+=.1;music.update(true)}}
let count=a.sources.length;music.update(false);a.ctx.currentTime+=100;music.update(false);assert.equal(a.sources.length,count,'Disabled music schedules nothing');for(let i=0;i<20;i++){a.ctx.currentTime+=.1;music.update(true)}assert.ok(a.sources.length>count,'Long pause resumes without scheduling in the past');
music.select('missing');assert.equal(music.currentTrack.id,MUSIC_TRACKS[0].id);
const b=audio(),vehicles=createVehicleAudio(b.ctx,{}),levels=()=>b.nodes.map(n=>n.gain.value);
vehicles.update({kind:'car',speed:12,rpm:2800,cylinders:6,gear:2},{w:true});const loaded=levels();assert.ok(loaded[0]>0&&loaded[1]>0&&loaded[6]>0);
vehicles.update({kind:'car',speed:12,rpm:2000,cylinders:6,gear:3},{w:true});assert.ok(levels()[0]<loaded[0],'Gear changes briefly unload the engine');
vehicles.update({kind:'car',speed:0,flooded:true});assert.equal(levels()[0],0);assert.equal(levels()[1],0);
vehicles.update({kind:'heli',speed:8,rpm:1200});assert.ok(levels()[3]>0);assert.equal(levels()[0],0);assert.equal(levels()[6],0);
vehicles.update({kind:'bike',speed:5},{w:true,h:true});assert.ok(levels()[5]>0&&levels()[9]>0);assert.equal(levels()[0],0);
vehicles.update({kind:'moto',speed:20,rpm:9000,cylinders:1,gear:3,dirt:true},{w:true,h:true});assert.ok(levels()[0]>0&&levels()[1]>0&&levels()[6]>0,'Motorbikes run the engine and road layers');assert.equal(levels()[5],0,'Motorbikes use the horn, not the bicycle bell');
vehicles.update({kind:'train',speed:8},{s:true});assert.ok(levels()[4]>0&&levels()[8]>0);
vehicles.update({kind:'train',speed:0},{});assert.ok(levels()[8]>0,'Stopping releases the air brake');b.ctx.currentTime+=1;vehicles.update({kind:'train',speed:0},{});assert.equal(levels()[8],0);
vehicles.update({kind:'car',speed:15},{},{rain:1,wiperSwish:.8});assert.ok(levels()[10]>0&&levels()[11]>0,'Rain adds wet tyre hiss and wiper swishes');vehicles.update(null);assert.ok(levels().every(v=>v===0),'Exiting silences every vehicle layer');
assert.equal(b.nodes.length,12,'Vehicle updates reuse a fixed audio graph');
console.log('PASS: twelve arrangements, playlist rotation, selection, pause/resume, finite audio scheduling, vehicle-specific layers, shifts, flooding, air brakes and fixed graph.');
