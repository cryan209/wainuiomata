import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../dist/vendor/three.js';
import {gradeLimit} from '../dist/road-grades.js';
import {insideFootprint} from '../dist/road-clipping.js';
import {createRoadNetwork} from '../dist/water-roads.js';
const source=JSON.parse(fs.readFileSync(new URL('../dist/regional-map.json',import.meta.url))),bounds=source.bounds,elements=source.elements,scene=new T.Scene(),meta=JSON.parse(fs.readFileSync(new URL('../dist/regional-terrain.json',import.meta.url))),buffer=fs.readFileSync(new URL('../dist/regional-terrain.bin',import.meta.url)),data=new DataView(buffer.buffer,buffer.byteOffset,buffer.byteLength),ground=(x,z)=>{const u=Math.max(0,Math.min(meta.width-1,(x-meta.minX)/meta.step)),v=Math.max(0,Math.min(meta.height-1,(z-meta.minZ)/meta.step)),ix=Math.min(meta.width-2,Math.floor(u)),iz=Math.min(meta.height-2,Math.floor(v)),fx=u-ix,fz=v-iz,h=(i,j)=>data.getInt32((j*meta.width+i)*4,true)/100-meta.datum;return h(ix,iz)*(1-fx)*(1-fz)+h(ix+1,iz)*fx*(1-fz)+h(ix,iz+1)*(1-fx)*fz+h(ix+1,iz+1)*fx*fz},network=createRoadNetwork(scene,{bounds,elements},{ground,channel:()=>null},ground,{asphalt:null,concrete:null});
console.log(JSON.stringify({roads:network.roads.length,...network.stats,rssMB:Math.round(process.memoryUsage().rss/1024/1024)}));
