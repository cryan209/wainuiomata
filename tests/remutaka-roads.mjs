import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.js';
import {mapSource} from '../scripts/lib/map-source.mjs';
import {createHydrology,createRoadNetwork} from '../dist/water-roads.js';
const source=mapSource(),drive=new Set(['motorway','trunk','primary','secondary','tertiary','unclassified','residential','living_street','motorway_link','trunk_link','primary_link','secondary_link','tertiary_link']);
const ways=source.elements.filter(r=>drive.has(r.tags.highway)&&!['no','private'].includes(r.tags.access));
const graph=new Map(),points=new Map();
for(const r of ways){
 for(const p of r.geometry)points.set(p.node,p);
 for(let i=1;i<r.geometry.length;i++){
  const a=r.geometry[i-1].node,b=r.geometry[i].node;
  if(!graph.has(a))graph.set(a,new Set());if(!graph.has(b))graph.set(b,new Set());
  if(r.tags.oneway!=='-1')graph.get(a).add(b);
  if(!['yes','1','true'].includes(r.tags.oneway)&&r.tags.junction!=='roundabout')graph.get(b).add(a);
 }
}
function nearest(x,z){return [...points.values()].reduce((a,b)=>Math.hypot(a.x-x,a.z-z)<Math.hypot(b.x-x,b.z-z)?a:b);}
const anchors=[{name:'Upper Hutt',x:10835,z:-14965},{name:'Remutaka summit',x:24403,z:-15671},{name:'Featherston',x:32269,z:-15424}];
const nodes=anchors.map(a=>{const p=nearest(a.x,a.z);assert.ok(Math.hypot(p.x-a.x,p.z-a.z)<450,a.name+' has a mapped road');return p.node;});
for(const start of [nodes[0],nodes[2]]){
 const seen=new Set([start]),queue=[start];
 for(let i=0;i<queue.length;i++)for(const next of graph.get(queue[i])||[])if(!seen.has(next)){seen.add(next);queue.push(next);}
 for(const node of nodes)assert.ok(seen.has(node),'Upper Hutt, the summit and Featherston connect in both directions');
}
const eastern=ways.filter(r=>r.geometry.some(p=>p.x>18000)&&(['2','SH 2'].includes(r.tags.ref)||/Remutaka|Rimutaka|Fitzherbert|Western Lake|Main Road/.test(r.tags.name||'')));
assert.ok(eastern.length>5);
const scene=new T.Scene(),hydro=createHydrology(scene,source.waterways,source.raw),network=createRoadNetwork(scene,{bounds:source.bounds,elements:eastern},hydro,source.raw,{asphalt:null,concrete:null},null,source.railways,{buildGeometry:false});
let highest=-Infinity,samples=0;
for(const r of network.roads)for(let i=0;i<r.p.length-1;i++)for(const t of [0,.5,1]){
 const a=r.p[i],b=r.p[i+1],x=T.MathUtils.lerp(a.x,b.x,t),z=T.MathUtils.lerp(a.y,b.y,t),h=network.height(r,i,t,x,z);
 assert.ok(Number.isFinite(h));
 if(x>23000&&x<27000){highest=Math.max(highest,h+source.meta.originElevation);samples++;}
}
assert.ok(samples>50);assert.ok(highest>450&&highest<700,'Hill road climbs over the measured range');
const summit=nearest(24403,-15671),hit=network.at(summit.x,summit.z);assert.ok(hit&&hit.d<.1,'Summit has a driveable road surface');
assert.ok(Number.isFinite(network.walkHeight(summit.x,summit.z)));
const geometryScene=new T.Scene(),geometryNetwork=createRoadNetwork(geometryScene,{bounds:source.bounds,elements:eastern},hydro,source.raw,{asphalt:null,concrete:null},null,source.railways,{streamGeometry:{x:summit.x,z:summit.z,radius:700}});
assert.ok(geometryNetwork.stats.chunks>0,'Summit road geometry is built near the camera');
let roadVertices=0;
geometryScene.traverse(o=>{if(o.geometry?.attributes.position){assert.ok(o.geometry.attributes.position.array.every(Number.isFinite));if(o.userData.surface?.startsWith('road'))roadVertices+=o.geometry.attributes.position.count;}});
assert.ok(roadVertices>100,'The summit has a rendered road surface');
console.log('PASS: mapped Remutaka/Featherston roads, two-way route from Upper Hutt over the summit, finite graded surfaces and measured hill elevations.');
