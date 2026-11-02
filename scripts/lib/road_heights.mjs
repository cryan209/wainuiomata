// Reads [{x,z}] points as JSON on stdin and prints the game's ground-level road surface height (absolute, metres) at each,
// or null where no carriageway/path covers the point. Used by scripts/rail_grade_separation.py.
import fs from 'node:fs';
import {buildGameRoads,streetGradesFile} from './game-roads.mjs';
const points=JSON.parse(fs.readFileSync(0,'utf8')),file=fs.existsSync(streetGradesFile)?new Uint8Array(fs.readFileSync(streetGradesFile)):null;
const warn=console.warn;console.warn=()=>{};const network=buildGameRoads({streetGrades:file});console.warn=warn;
const datum=JSON.parse(fs.readFileSync(new URL('../../dist/geodata.json',import.meta.url))).originElevation;
console.log(JSON.stringify(points.map(({x,z})=>{const hit=network.at(x,z,false,true);return hit&&hit.d<hit.r.width/2+1?Math.round((network.height(hit.r,hit.i,hit.t,x,z)+datum)*100)/100:null})));
