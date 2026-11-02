// Solves the region's street and trail grades once and writes dist/street-grades.pack, which the game loads instead of solving them at
// startup (see dist/road-grades.js). Run it after any change to the map, terrain, waterways or railways; tests/street-grades.mjs
// fails while the pack is stale, and the game falls back to solving when the pack does not fit its map.
import fs from 'node:fs';
import {buildGameRoads,streetGradesFile} from './lib/game-roads.mjs';
import {packStreetGrades,isStreet} from '../dist/road-grades.js';
const t=performance.now(),network=buildGameRoads(),streets=network.roads.filter(isStreet),trails=network.roads.filter(r=>!isStreet(r));
// Trails are graded one at a time as heights on them are needed; grade them all so the pack covers every one.
for(const r of trails)r.lazyGrade?.();
const bytes=packStreetGrades(streets,network.junctions,trails);fs.writeFileSync(streetGradesFile,bytes);
console.log('Packed',streets.length,'streets,',trails.length,'trails,',network.junctions.length,'junctions:',bytes.length>>10,'KiB before gzip, in',Math.round(performance.now()-t),'ms');
