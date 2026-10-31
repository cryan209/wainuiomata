import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../dist/vendor/three.js';
import {selectEntrances,buildRoom,createInteriors,roomClear} from '../dist/interiors.js';
import {buildingFaces,createStreetIndex} from '../dist/building-faces.js';
// Canvas textures are browser-only; scene geometry and interaction run without WebGL.
globalThis.document={createElement(){return {getContext(){return {fillRect(){},strokeRect(){},fillText(){}};}};}};
const buildings=[0,30,60].map((x,id)=>({id,rings:[[[x,0],[x+12,0],[x+12,12],[x,12],[x,0]]],faces:[{front:true,length:12,a:[x,0],b:[x+12,0],nx:0,nz:-1,score:0}]}));
const world={buildings,walkHeight:()=>0,free:(x,z)=>z<-1};
const entries=selectEntrances(world,{x:0,z:0});assert.equal(entries.length,3);assert.ok(entries.every(e=>world.free(e.x,e.z)));
assert.equal(selectEntrances({...world,free:()=>false},{x:0,z:0}).length,0);
for(const kind of ['dairy','cafe','lounge','library','arcade','takeaway','workshop','music','florist']){const room=buildRoom(kind);assert.ok(room.scene.children.length>35);assert.ok(room.clear(0,4.3),'Entrance must be clear');for(const b of room.obstacles)assert.equal(room.clear(b.x,b.z),false);assert.equal(room.clear(5,0),false);assert.equal(room.clear(0,-6),false);}
assert.equal(roomClear(0,0,[{x:0,z:0,w:1,d:1}]),false);
const camera=new T.PerspectiveCamera();camera.position.set(entries[0].x,2,entries[0].z);const original=camera.position.clone();const button={hidden:true};const hint={hidden:true};
const interiors=createInteriors({scene:new T.Scene(),world,camera,origin:{x:0,z:0},button,hint});
const update=(dt,keys={},enabled=true)=>interiors.update(dt,{enabled,yaw:0,pitch:0,keys});
update(0);assert.equal(hint.hidden,true);assert.equal(button.hidden,false);assert.equal(interiors.interact(),true);assert.equal(interiors.active,true);assert.equal(interiors.name,'Valley Dairy');update(0);assert.equal(hint.hidden,true);
update(.5,{w:true});assert.ok(interiors.view.position.z<4);assert.equal(interiors.interact(),false,'Exit only works by the door');
for(let i=0;i<250;i++)update(.05,{w:true,shift:true});assert.ok(interiors.view.position.z>-5.7,'Cannot escape the back wall');
interiors.view.position.set(0,1.7,4.5);update(0);assert.equal(button.hidden,false);assert.equal(interiors.interact(),true);assert.deepEqual(camera.position,original);assert.equal(interiors.active,false);
update(0,{},false);assert.equal(button.hidden,true);assert.equal(interiors.interact(),false,'Vehicle/paused state cannot enter');
update(0);interiors.interact();assert.equal(interiors.exit(),true);assert.deepEqual(camera.position,original);
// Real footprints and street-facing normals must also yield nine separate entrances.
const data=JSON.parse(fs.readFileSync(new URL('../dist/buildings.json',import.meta.url)));
const streets=createStreetIndex(JSON.parse(fs.readFileSync(new URL('../dist/map.json',import.meta.url))));
for(const b of data)b.faces=buildingFaces(b,streets);
const within=(ring,x,z)=>{let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};
const real=selectEntrances({buildings:data,walkHeight:()=>0,free:(x,z)=>!data.some(b=>within(b.rings[0],x,z))},{x:0,z:0});assert.equal(real.length,9);assert.equal(new Set(real.map(e=>e.buildingId)).size,9);
console.log('PASS: nine real building entrances, inaccessible entrances rejected, furnished rooms, furniture/wall collision, movement, door-only exits, vehicle guards and safe return');
// Copies appear as regional buildings stream in, retain district names, and reuse rooms.
const region={buildings:[]},copiedWorld={...world,region,free:()=>true},copyCamera=new T.PerspectiveCamera(),announced=[];
const copies=createInteriors({scene:new T.Scene(),world:copiedWorld,camera:copyCamera,origin:{x:0,z:0},button:{},onEntrance:e=>announced.push(e)});
const tick=()=>copies.update(1.1,{enabled:true,yaw:0,pitch:0,keys:{}});
const districtBuildings=(x,z,base)=>buildings.map((b,i)=>({...b,id:base+i,rings:b.rings.map(r=>r.map(([a,c])=>[a+i*15+x,c+z])),faces:b.faces.map(f=>({...f,a:[f.a[0]+i*15+x,f.a[1]+z],b:[f.b[0]+i*15+x,f.b[1]+z]}))}));
region.buildings=districtBuildings(220,-2350,100);copyCamera.position.set(220,2,-2352);tick();
assert.equal(copies.entrances.filter(e=>e.name.includes('Northern Wainuiomata')).length,3);
const north=copies.entrances.find(e=>e.name.includes('Northern')&&e.kind==='takeaway');copyCamera.position.set(north.x,2,north.z);tick();assert.equal(copies.interact(),true);const shared=copies.scene;copies.exit();
region.buildings=districtBuildings(1100,1600,200);copyCamera.position.set(1100,2,1598);tick();
assert.equal(copies.entrances.filter(e=>e.name.includes('Southern Wainuiomata')).length,3);
const south=copies.entrances.find(e=>e.name.includes('Southern')&&e.kind==='takeaway');copyCamera.position.set(south.x,2,south.z);tick();assert.equal(copies.interact(),true);assert.equal(copies.scene,shared,'Copied interiors share the furnished template');copies.exit();
const total=copies.entrances.length;tick();tick();assert.equal(copies.entrances.length,total);assert.equal(announced.length,total);
console.log('PASS: streamed district copies, duplicate prevention, travel callbacks and shared furnished rooms');
