import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from '../dist/vendor/three.js';
import {railRoute} from '../dist/railways.js';
import {createTrainRide} from '../dist/train-ride.js';
import {createTrainLineControls} from '../dist/train-lines.js';
const data=JSON.parse(readFileSync(new URL('../dist/railways.json',import.meta.url)));
const endpoints=new Map([['Hutt Valley commuter','Upper Hutt'],['Kāpiti commuter','Waikanae'],['Johnsonville commuter','Johnsonville'],['Wairarapa Connection','Featherston'],['Melling commuter','Melling']]);
assert.deepEqual(data.routes.map(r=>r.name),[...endpoints.keys()]);
const station=name=>data.stations.find(s=>s.name===name),start=station('Wellington');
for(const route of data.routes){
 const end=station(endpoints.get(route.name)),a=route.p[0],b=route.p.at(-1);
 assert.ok(Math.hypot(a.x-start.x,a.z-start.z)<150&&Math.hypot(b.x-end.x,b.z-end.z)<150,`${route.name} reaches both mapped termini`);
}
const melling=data.routes.at(-1),segments=new Set();
for(const track of data.tracks)for(let i=1;i<track.p.length;i++){const a=track.p[i-1].node,b=track.p[i].node;segments.add(a+'|'+b);segments.add(b+'|'+a)}
for(let i=1;i<melling.p.length;i++)assert.ok(segments.has(melling.p[i-1].node+'|'+melling.p[i].node),'Melling follows connected mapped rails');
const mellingPath=railRoute(melling.p);assert.ok(mellingPath.length>13000&&mellingPath.length<15000);assert.ok(mellingPath.nearest(station('Western Hutt').x,station('Western Hutt').z).distance<30);
for(const id of data.mellingService.trackIds){const track=data.tracks.find(t=>t.id===id);assert.ok(track.historic&&track.electrified);for(let i=1;i<track.p.length;i++){const a=track.p[i-1],b=track.p[i],d=Math.hypot(b.x-a.x,b.z-a.z);assert.ok(d<4.01&&Math.abs(b.h-a.h)/d<.031,'Restored Melling branch has continuous, modest grades')}}
const scene=new T.Scene(),camera=new T.PerspectiveCamera(50,1,.15,30000),status={textContent:''},trains=data.routes.map(route=>({name:route.name,path:railRoute(route.p),distance:1000,direction:1,wait:0}));
const world={bounds:{minX:-30000,maxX:50000,minZ:-50000,maxZ:20000},free:()=>true,walkHeight:()=>0},railways={trains,data};
const ride=createTrainRide({scene,railways,world,camera,status});
const doc={createElement:()=>({})},select=()=>({ownerDocument:doc,value:'',replaceChildren(...children){this.children=children}}),panel=select(),menu=select();
let controls;controls=createTrainLineControls({trains,selects:[panel,menu,null],onSelect:index=>{assert.ok(ride.enter(index));controls.update(ride.train)}});
assert.equal(panel.children.length,6);assert.deepEqual(panel.children.slice(1).map(o=>o.textContent),[...endpoints.keys()]);
for(let index=0;index<trains.length;index++){
 const input=index%2?menu:panel;input.value=String(index);input.onchange();
 assert.equal(ride.train,trains[index]);assert.equal(panel.value,String(index));assert.equal(menu.value,String(index));assert.equal(trains.filter(t=>t.passenger).length,1);
 assert.ok(ride.inside&&ride.model.visible);assert.match(status.textContent,/RIDING/);assert.ok(camera.position.toArray().every(Number.isFinite));assert.equal(scene.children.length,1,'All lines reuse the modeled carriage');
}
const active=ride.train;panel.value='';panel.onchange();assert.equal(ride.train,active);panel.value='99';panel.onchange();assert.equal(ride.train,active,'Invalid line selections do not change the service');
ride.exit();controls.update(null);assert.equal(panel.value,'');assert.equal(menu.value,'');
const empty=select();createTrainLineControls({trains:[],selects:[empty],onSelect:()=>assert.fail()});assert.equal(empty.disabled,true);
console.log('PASS: all five mapped services and termini, connected Wellington–Melling route via Western Hutt, restored branch grades, line selection from both controls, seat/interior boarding, synchronized selectors and carriage reuse.');
