import fs from 'node:fs';
import assert from 'node:assert/strict';
import {buildGameRoads,streetGradesFile} from '../scripts/lib/game-roads.mjs';
import {packStreetGrades,isStreet,readStreetGradeHeader,streetGradesFit,trailGradesFit} from '../dist/road-grades.js';
const file=new Uint8Array(fs.readFileSync(streetGradesFile)),solved=buildGameRoads();
assert.ok(solved.stats.gradeNodes>1e6,'Without a pack the street grades are solved');
for(const r of solved.roads)r.lazyGrade?.();
const fresh=packStreetGrades(solved.roads.filter(isStreet),solved.junctions,solved.roads.filter(r=>!isStreet(r)));
assert.ok(Buffer.from(fresh).equals(Buffer.from(file)),'dist/street-grades.pack is stale: run node scripts/pack_street_grades.mjs');
const packed=buildGameRoads({streetGrades:file});
assert.equal(packed.stats.gradeNodes,0,'With a fitting pack nothing is solved');
assert.ok(packed.roads.filter(r=>!isStreet(r)).every(r=>!r.lazyGrade&&r.gradeProfiles),'With a fitting pack every trail grade comes from it, so none is graded at startup');
assert.equal(packed.roads.length,solved.roads.length);
// Heights from the pack (centimetres) match the solve, streets and trails to the rounding.
const worst={street:0,trail:0};let samples=0;
for(let k=0;k<solved.roads.length;k++){const a=solved.roads[k],b=packed.roads[k],kind=isStreet(a)?'street':'trail';assert.equal(a.id,b.id);for(let i=0;i<a.p.length-1;i++)for(const f of [0,.37,1]){const p=a.p[i],q=a.p[i+1],x=p.x+(q.x-p.x)*f,z=p.y+(q.y-p.y)*f;worst[kind]=Math.max(worst[kind],Math.abs(solved.height(a,i,f,x,z)-packed.height(b,i,f,x,z)));samples++}}
assert.ok(worst.street<=.0051,`Packed street heights within 5mm of the solve (worst ${worst.street})`);
assert.ok(worst.trail<=.0051,`Packed trail heights within 5mm of the solve (worst ${worst.trail})`);
solved.junctions.forEach((h,i)=>assert.ok(h.height===undefined?packed.junctions[i].height===undefined:Math.abs(h.height-packed.junctions[i].height)<=.0051));
// A pack for another map is ignored.
const header=readStreetGradeHeader(file),other=new TextEncoder().encode(JSON.stringify({...header,layout:'0'})),stale=new Uint8Array(4+other.length);new DataView(stale.buffer).setUint32(0,other.length,true);stale.set(other,4);
const warn=console.warn;console.warn=()=>{};const streets=solved.roads.filter(isStreet),fits=[streetGradesFit(file,streets,solved.junctions),streetGradesFit(stale,streets,solved.junctions)];console.warn=warn;
assert.deepEqual(fits,[true,false],'A pack for another map is rejected, so the network solves the grades as it did above');
// Trails are checked on their own: a pack whose trails do not fit still supplies the streets, and trails are graded as needed.
const trails=solved.roads.filter(r=>!isStreet(r)),otherTrails=new TextEncoder().encode(JSON.stringify({...header,trails:{...header.trails,layout:'0'}})),staleTrails=new Uint8Array(4+otherTrails.length);new DataView(staleTrails.buffer).setUint32(0,otherTrails.length,true);staleTrails.set(otherTrails,4);
console.warn=()=>{};const trailFits=[trailGradesFit(file,trails),trailGradesFit(staleTrails,trails),streetGradesFit(staleTrails,streets,solved.junctions)];console.warn=warn;
assert.deepEqual(trailFits,[true,false,true],'Stale trail grades are rejected without rejecting the street grades');
console.log(`PASS: street grade pack is current (${header.samples} samples, ${header.hubs} junctions), ${samples} heights within ${Math.round(worst.street*1000)}mm (streets) and ${Math.round(worst.trail*1000)}mm (trails) of the solve, stale packs fall back to solving.`);
