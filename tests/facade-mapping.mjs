import assert from 'node:assert/strict';
import {faceMapping,splitFacade} from '../dist/facade-mapping.js';
import {facadeStyle,FACADE_COUNT} from '../dist/appearance.js';
const ring=[[0,0],[12,0],[12,8],[0,8],[0,0]],face=faceMapping([ring],6,0,1);
assert.equal(face.count,2);
const parts=splitFacade([[4,-.5,0],[8,-.5,0],[8,6.8,0],[4,6.8,0]],face,0);
assert.equal(parts.length,4,'A mesh panel spanning a bay and storey boundary must split both');
let area=0;
for(const part of parts){for(const p of part.poly){const uv=part.uv(p);assert.ok(uv.every(v=>Number.isFinite(v)&&v>=0&&v<=1));assert.ok(p[0]>=4&&p[0]<=8&&p[1]>=-.5&&p[1]<=6.8)}for(let i=0;i<part.poly.length;i++){const a=part.poly[i],b=part.poly[(i+1)%part.poly.length];area+=(a[0]*b[1]-b[0]*a[1])/2}}
assert.ok(Math.abs(Math.abs(area)-4*7.3)<1e-8,'Texture cuts must preserve the original wall surface');
const seam=parts.filter(p=>p.floor===0);assert.equal(seam[0].uv([6,0,0])[0],1);assert.equal(seam[1].uv([6,0,0])[0],0);
assert.equal(faceMapping([ring],6,0,-1).u([0,0,0]),2,'Reverse winding must keep the facade readable outside');
assert.equal(facadeStyle({shop:true,style:3},42,0,4),31,'Upper floors must use window bays rather than shop signs or doors');
assert.ok(facadeStyle({shop:true,style:3},42,0,0)>=16);assert.equal(FACADE_COUNT,62);
console.log('PASS: corner-anchored facade bays, storey splits, continuous wall area, readable winding and upper-floor materials.');
