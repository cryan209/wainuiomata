import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../dist/vendor/three.js';
import {createStreetIndex,buildingFaces,wallStyle} from '../dist/building-faces.js';
import {addCanopies} from '../dist/canopies.js';
import {createOpenSpaces} from '../dist/open-spaces.js';
import {roofTileTriangles} from '../dist/roof-detail.js';
const building={id:42,rings:[[[0,0],[20,0],[20,12],[0,12],[0,0]]],profile:{shop:true,style:3},ground:0,eave:4};
const streets=createStreetIndex({elements:[{tags:{highway:'residential'},geometry:[{x:-100,z:-20},{x:100,z:-20}]}]});building.faces=buildingFaces(building,streets);
assert.deepEqual(building.faces.filter(f=>f.front).map(f=>f.id),[0],'Only the street-facing wall should receive a shopfront');
for(const face of building.faces.filter(f=>!f.front))for(let bay=0;bay<4;bay++)assert.ok(wallStyle(building.profile,42,face,bay,0)>=28,'Side/rear bays must never use shopfronts');
const scene=new T.Scene(),canopies=addCanopies(scene,[building],{ground:()=>0,datum:0,textures:{buildingSurfaces:Array(16).fill(null),concrete:null}});
assert.equal(canopies.count,1);assert.ok(canopies.posts>=2);assert.equal(canopies.free(.4,-2.5),false,'Support posts must block walking');assert.equal(canopies.free(10,-1),true,'Pedestrians must be able to walk under the veranda');
const open=createOpenSpaces(JSON.parse(fs.readFileSync(new URL('../dist/open-spaces.json',import.meta.url))));
for(const [name,x,z]of [['Queen Street Park',106.41,-38.01],['Frederick Wise Park',-27.03,-504.84],['Mary Crowther Park',304.69,-1760.96]]){assert.equal(open.at(x,z)?.name,name);assert.equal(open.allows(x,z,0),false,`${name} lawn must reject procedural trees`)}
assert.equal(open.allows(3200,3200,0),true,'An unrelated hillside must not be cleared');
const triangle=new Float32Array([250,10,10,270,20,10,250,10,30]),tiles=roofTileTriangles(triangle,256,new Set(['0,0','1,0']));assert.equal(tiles.size,2,'Roof triangles crossing a tile boundary must be clipped into both tiles');
let area=0;for(const [key,p]of tiles){const [ix,iz]=key.split(',').map(Number);for(let i=0;i<p.length;i+=9){const a=p.slice(i,i+3),b=p.slice(i+3,i+6),c=p.slice(i+6,i+9);area+=Math.abs((b[0]-a[0])*(c[2]-a[2])-(c[0]-a[0])*(b[2]-a[2]))/2;for(const v of [a,b,c]){assert.ok(v[0]>=ix*256-1e-6&&v[0]<=(ix+1)*256+1e-6);assert.ok(v[2]>=iz*256&&v[2]<=(iz+1)*256);assert.ok(Math.abs(v[1]-(10+(v[0]-250)*.5))<1e-6,'Clipping must preserve the measured roof slope')}}}assert.ok(Math.abs(area-200)<1e-6);
console.log('PASS: street-facing fronts, side/rear materials, veranda clearance and posts, real park exclusions, and roof-tile area/slope continuity.');
