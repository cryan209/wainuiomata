import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../dist/vendor/three.js';
import {createBoats,seaSwell,FERRY_ROUTE} from '../dist/boats.js';
// Synthetic coast: land north of z=0. Boats must stay offshore while wandering and riding the swell.
const scene=new T.Scene(),fleet=createBoats(scene,{isLand:(x,z)=>z<0,bounds:{minX:-5000,maxX:5000,minZ:-5000,maxZ:5000},seaLevel:-90.77});
assert.equal(fleet.boats.length,28);assert.equal(scene.children.filter(o=>o.isInstancedMesh).length,4,'Three boat types and one wake mesh');
const start=fleet.boats.filter(b=>b.type!=='ferry').map(b=>[b.x,b.z]);let lowest=0,highest=-1e9;
for(let i=0;i<2400;i++){fleet.update(.05,1.6);for(const b of fleet.boats)if(b.type!=='ferry')assert.ok(b.z>100,'Boat ran aground at '+b.x+','+b.z)}
const moved=fleet.boats.filter(b=>b.type!=='ferry').filter((b,i)=>Math.hypot(b.x-start[i][0],b.z-start[i][1])>50).length;assert.ok(moved>20,'Boats travel');
const m=new T.Matrix4(),p=new T.Vector3();for(let i=0;i<16;i++){fleet.meshes.yacht.getMatrixAt(i,m);p.setFromMatrixPosition(m);lowest=Math.min(lowest,p.y);highest=Math.max(highest,p.y)}assert.ok(highest-lowest>.05&&highest<-88,'Hulls bob near sea level');
// Swell grows with wind and stays finite.
const calm=seaSwell(100,200,3,.6),storm=seaSwell(100,200,3,2.1);assert.ok(Math.abs(storm.h)>Math.abs(calm.h)&&Number.isFinite(storm.gx));
// The ferry route is inside the mapped sea polygons all the way from Aotea Quay into Cook Strait.
const coast=JSON.parse(fs.readFileSync(new URL('../dist/regional-coast.json',import.meta.url))),inside=(ring,x,z)=>{let c=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const[a,b]=ring[i],[e,f]=ring[j];if((b>z)!==(f>z)&&x<(e-a)*(z-b)/(f-b)+a)c=!c}return c},water=(x,z)=>coast.water.some(r=>inside(r[0],x,z)&&!r.slice(1).some(h=>inside(h,x,z)));
for(let i=1;i<FERRY_ROUTE.length;i++){const[a,b]=FERRY_ROUTE[i-1],[c,d]=FERRY_ROUTE[i],n=Math.ceil(Math.hypot(c-a,d-b)/100);for(let k=0;k<=n;k++)assert.ok(water(a+(c-a)*k/n,b+(d-b)*k/n),'Ferry leg '+i+' crosses land')}
console.log('PASS: 28 instanced boats in four draw calls, offshore wandering, swell bobbing, wind-driven swell and an in-water ferry route to Cook Strait.');
