// The game's road network built in Node from the same files and ground as dist/geoworld.js (without meshes).
// Used by scripts/pack_street_grades.mjs and tests/street-grades.mjs. Keep the inputs in step with geoworld.js.
import fs from 'node:fs';
import * as T from '../../dist/vendor/three.js';
import {createSurveyGround} from '../../dist/world-ground.js';
import {unpackTerrain} from '../../dist/terrain-pack.js';
import {assembleRegionalMap} from '../../dist/regional-map.js';
import {createRailways} from '../../dist/railways.js';
import {createHydrology,createRoadNetwork} from '../../dist/water-roads.js';
// GAME_DATA names another directory to read the data files from (default dist/).
const dist=process.env.GAME_DATA?process.env.GAME_DATA.replace(/\/?$/,'/'):new URL('../../dist/',import.meta.url).pathname,json=n=>JSON.parse(fs.readFileSync(dist+n)),bytes=n=>{const b=fs.readFileSync(dist+n);return new Uint8Array(b.buffer,b.byteOffset,b.byteLength)},int32=n=>{const b=bytes(n);return new Int32Array(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength))};
// Station signs draw on a canvas, which Node lacks; they do not affect the ground.
globalThis.document??={createElement:()=>({getContext:()=>new Proxy({},{get:()=>()=>{},set:()=>true})})};
export const streetGradesFile=new URL('../../dist/street-grades.pack',import.meta.url).pathname;
export function buildGameRoads({streetGrades=null}={}){
 const meta=json('geodata.json'),regionalMeta=json('regional-terrain.json'),regional=unpackTerrain(bytes(regionalMeta.packed.file),regionalMeta.width,regionalMeta.height);
 const index=json('regional-map.json'),regionalMap=assembleRegionalMap(index,index.parts.map(p=>json(p.file))),localMap=json('map.json'),controls=json('traffic-controls.json');
 const map={...regionalMap,controls:controls.nodes,seaLevel:-meta.originElevation,elements:[...new Map([...localMap.elements,...regionalMap.elements].map(r=>[r.id,r])).values()]};
 const waterways=[...new Map([...json('waterways.json'),...json('regional-waterways.json')].map(r=>[r.id,r])).values()];
 const datum=meta.originElevation,scene=new T.Scene(),surveyGround=createSurveyGround({meta,coarse:int32('terrain.bin'),fine:int32('terrain-fine.bin'),regional,regionalMeta});
 const railways=createRailways(scene,json('railways.json'),{datum,textures:{roadSurfaces:Array(6).fill(null),concrete:null}}),rawGround=(x,z)=>railways.ground(x,z,surveyGround(x,z));
 // The sea level createCoast reports (dist/coast.js).
 const hydro=createHydrology(scene,waterways,rawGround,{seaLevel:-datum+.08});
 return createRoadNetwork(scene,map,hydro,rawGround,{asphalt:null,concrete:null},null,railways,{buildGeometry:false,streetGrades});
}
