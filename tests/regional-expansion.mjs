import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../dist/vendor/three.js';
import {movePlayer} from '../dist/movement.js';
import {createRoadNetwork} from '../dist/water-roads.js';
import {sampleRegionalMask} from '../dist/coast.js';
import {regionalDestinations} from '../dist/regional-destinations.js';
const meta=JSON.parse(fs.readFileSync(new URL('../dist/regional-terrain.json',import.meta.url))),data=new Int32Array(fs.readFileSync(new URL('../dist/regional-terrain.bin',import.meta.url)).buffer.slice(0));
assert.equal(meta.verticalScale,1);assert.equal(data.length,meta.width*meta.height);
const world={bounds:meta.bounds,ground:()=>10,walkHeight:()=>10,free:()=>true};let position={x:-6000,y:50,z:-4000};movePlayer({position,yaw:Math.PI/2,pitch:0,keys:{w:true},dt:1,drone:true,world,clock:0});assert.equal(position.x,-6032,'The former 3.2km wall must not clamp the Petone area');position.x=meta.bounds.minX+1;movePlayer({position,yaw:Math.PI/2,pitch:0,keys:{w:true},dt:1,drone:true,world,clock:0});assert.equal(position.x,meta.bounds.minX);
const pixels=new Uint8Array(4*4*4);for(let z=0;z<4;z++)for(let x=2;x<4;x++)pixels[(z*4+x)*4]=255;const bounds={minX:-10,maxX:10,minZ:-10,maxZ:10};assert.equal(sampleRegionalMask(pixels,4,4,bounds,-8,0),0);assert.equal(sampleRegionalMask(pixels,4,4,bounds,8,0),1);assert.equal(sampleRegionalMask(pixels,4,4,bounds,100,0),0);
const pierMap={seaLevel:-90,bounds:meta.bounds,elements:[{id:'pier',tags:{highway:'footway',man_made:'pier',bridge:'yes',width:'5'},geometry:[{x:-5000,z:-4000,node:'a'},{x:-5100,z:-4000,node:'b'}]}]},network=createRoadNetwork(new T.Scene(),pierMap,{ground:()=>-94,channel:()=>null},()=>-94,{asphalt:null,concrete:null});assert.equal(network.walkHeight(-5050,-4000),-88.5,'A pier must remain above the harbour rather than follow seabed samples');assert.ok(network.onBridge(-5050,-4000));
const map=JSON.parse(fs.readFileSync(new URL('../dist/regional-map.json',import.meta.url))),coast=JSON.parse(fs.readFileSync(new URL('../dist/regional-coast.json',import.meta.url))),roads=map.elements.filter(r=>r.tags.name).map(r=>({name:r.tags.name,p:r.geometry.map(p=>new T.Vector2(p.x,p.z))})),dest=regionalDestinations({coast:{meta:coast,isLand:()=>true},network:{roads},hydro:{channel:()=>null}});
assert.deepEqual([...dest.keys()],['lowerhutt','petone','daysbay','eastbourne']);for(const p of dest.values()){assert.ok(p.x>meta.bounds.minX&&p.x<meta.bounds.maxX&&p.z>meta.bounds.minZ&&p.z<meta.bounds.maxZ);assert.ok(Number.isFinite(p.yaw))}
const buildings=JSON.parse(fs.readFileSync(new URL('../dist/regional-buildings.json',import.meta.url))),far=fs.statSync(new URL('../dist/regional-far.bin',import.meta.url));assert.equal(far.size,buildings.count*8*4);assert.ok(buildings.count>40000);assert.ok(buildings.chunks.every(c=>fs.existsSync(new URL('../dist/'+c.file,import.meta.url))));
console.log('PASS: expanded movement bounds, coast-mask orientation, above-water pier traversal, four mapped destinations and complete streamed-building index.');
