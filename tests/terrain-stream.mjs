import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.js';
import {terrainStep,terrainGeometry,createTerrainStream} from '../dist/terrain-stream.js';
function finish(g){let r;do{r=g.next()}while(!r.done);return r.value}
const ground=(x,z)=>x*.05+z*.02,near=finish(terrainGeometry({x:0,z:0,step:2,ground})),far=finish(terrainGeometry({x:0,z:0,step:100,ground}));assert.ok(near.index.count/far.index.count>500,'Far terrain uses substantially fewer triangles');assert.equal(terrainStep(0),2);assert.equal(terrainStep(700),8);assert.equal(terrainStep(1500),25);assert.equal(terrainStep(4000),100);
for(let i=0;i<201*201;i++){const p=near.attributes.position;assert.ok(Math.abs(p.getY(i)-ground(p.getX(i),p.getZ(i)))<1e-5,'Near terrain retains sampled roadbed elevations')}
assert.ok([...far.attributes.normal.array].every(Number.isFinite));assert.ok(near.boundingSphere.radius>0);
globalThis.requestAnimationFrame=cb=>setTimeout(()=>cb(performance.now()),0);
const scene=new T.Scene(),stream=createTerrainStream(scene,{bounds:{minX:-12000,maxX:12000,minZ:-12000,maxZ:12000},ground,density:()=>0,textures:{grass:null},budgetMs:10});await stream.ensureAt(0,0);const initial=stream.stats;assert.ok(initial.tiles>0&&initial.tiles<20,'Initial loading is limited to nearby terrain');assert.ok(initial.triangles<1500000,'Terrain triangle budget stays bounded');let disposed=0;for(const mesh of scene.children)mesh.geometry.addEventListener('dispose',()=>disposed++);stream.update({x:10000,z:10000});assert.ok(disposed>0,'Distant terrain releases GPU geometry');assert.ok(stream.stats.queued>0,'New area streams progressively');
console.log(`PASS: 4 terrain LODs, ${(near.index.count/far.index.count).toFixed(0)}× fewer triangles per far tile, exact near elevations, bounded initial load and GPU disposal.`);
