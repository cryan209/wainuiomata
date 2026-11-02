import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.js';
import {facadeProfile} from '../dist/appearance.js';
import {buildingFaces,createStreetIndex,wallStyle} from '../dist/building-faces.js';
import {planLargeHouseOpenings,addLargeHouseFacades} from '../dist/large-house-facades.js';
const streets=createStreetIndex({elements:[{tags:{highway:'residential'},geometry:[{x:900,z:-12},{x:1100,z:-12}]}]});
function house(height=6.2){const b={id:42,ground:0,eave:height,rings:[[[1000,0],[1020,0],[1020,12],[1000,12],[1000,0]]]};b.profile=facadeProfile(b);b.faces=buildingFaces(b,streets);return b}
const b=house(),options={ground:()=>0,datum:0},openings=planLargeHouseOpenings(b,options);
assert.ok(b.profile.largeHouse);
assert.equal(openings.filter(o=>o.kind==='door').length,1,'One front entrance across a wide house');
assert.ok(openings.filter(o=>o.kind==='window'&&o.face.front).length>=6);
for(const o of openings){
 assert.ok(o.width>=1&&o.width<=2.1&&o.height>=1&&o.height<=2.12,'Joinery uses metre dimensions instead of stretched facade bays');
 assert.ok(o.bottom+o.height<b.eave);
 assert.ok(o.kind!=='door'||o.floor===0&&o.face.front,'No doors upstairs or on repeated side bays');
 const along=Math.hypot(o.x-o.face.a[0],o.z-o.face.a[1]);assert.ok(along-o.width/2>=.3&&along+o.width/2<=o.face.length-.3,'Openings clear corners');
 for(const other of openings)if(other!==o&&other.face===o.face&&other.floor===o.floor)assert.ok(Math.hypot(o.x-other.x,o.z-other.z)>(o.width+other.width)/2,'No overlapping windows or doors');
}
for(const face of b.faces)for(let floor=0;floor<2;floor++)assert.equal(wallStyle(b.profile,b.id,face,0,floor),44+b.profile.style,'Large-house cladding stays continuous on every wall and storey');
assert.equal(planLargeHouseOpenings(house(2.7),options).filter(o=>o.kind==='door').length,1,'Single-storey houses retain one correctly sized door');
assert.deepEqual(planLargeHouseOpenings(b,options),openings,'Layout is stable');
for(const patch of [{landmark:true},{railCanopy:true},{tags:{building:'church'}},{facade:'plain'},{eave:15}]){const x={...b,...patch};x.profile=facadeProfile(x);assert.equal(x.profile.largeHouse,false)}
const shop={...b,profile:{...b.profile,shop:true}};assert.equal(planLargeHouseOpenings(shop,options).length,0);
const scene=new T.Scene(),windowMaterials=[],textures={houseDetails:{material:()=>new T.MeshLambertMaterial()}};
const rendered=addLargeHouseFacades(scene,[b,house()],{...options,textures,windowMaterials});assert.equal(rendered.count,openings.length*2);
assert.equal(new Set(scene.children.map(m=>m.material)).size,2,'Two houses share one joinery material and one trim material');
assert.equal(windowMaterials.length,0,'Night lighting comes from the shared joinery material, registered once by the world');
scene.traverse(o=>{if(o.geometry)assert.ok([...o.geometry.attributes.position.array].every(Number.isFinite))});
console.log('PASS: continuous large-house cladding, metre-scale windows, one street-facing entrance, storey/corner clearance, no overlapping openings, exclusions, stable layout, shared batches and glass-only night lighting.');
