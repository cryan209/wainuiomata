import assert from 'node:assert/strict';
import fs from 'node:fs';
import {unpackTerrain,unpackFar,FAR_COLUMNS,ROOF_COLUMNS} from '../dist/terrain-pack.js';
// The game downloads these packs instead of the build scripts' binaries; rerun scripts/pack_runtime.py after a rebuild.
const file=name=>fs.readFileSync(new URL('../dist/'+name,import.meta.url)),bytes=b=>new Uint8Array(b.buffer,b.byteOffset,b.byteLength),floats=(b,T)=>new T(b.buffer,b.byteOffset,b.byteLength/T.BYTES_PER_ELEMENT);
const meta=JSON.parse(file('regional-terrain.json')),expected=floats(file('regional-terrain.bin'),Int32Array),decoded=unpackTerrain(bytes(file(meta.packed.file)),meta.width,meta.height);
assert.equal(decoded.length,expected.length);for(let i=0;i<expected.length;i++)if(decoded[i]!==expected[i])assert.fail(`Terrain sample ${i}: ${decoded[i]} ≠ ${expected[i]}`);
assert.throws(()=>unpackTerrain(new Uint8Array(10),meta.width,meta.height),/does not match/);
const manifest=JSON.parse(file('regional-buildings.json')),{far,roof}=unpackFar(bytes(file(manifest.farPack.file)),manifest.farPack.count);
for(const [packed,source,columns] of [[far,floats(file('regional-far.bin'),Float32Array),FAR_COLUMNS],[roof,floats(file('regional-roof-far.bin'),Float32Array),ROOF_COLUMNS]]){
 assert.equal(packed.length,source.length,'One packed row per streamed building');
 // Differenced columns accumulate float32 rounding of the source; allow a little over half a step.
 for(let i=0;i<source.length;i++){const [scale]=columns[i%columns.length];if(Math.abs(packed[i]-source[i])>.6/scale+1e-3)assert.fail(`Value ${i}: ${packed[i]} vs ${source[i]}`)}
}
assert.equal(manifest.farPack.count,manifest.count);assert.throws(()=>unpackFar(new Uint8Array(7),3),/does not match/);
console.log('PASS: packed terrain decodes losslessly; packed distant buildings match within their quantisation step.');
