import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.js';
import {createHydrology,createRoadNetwork} from '../dist/water-roads.js';
import {mapSource} from '../scripts/lib/map-source.mjs';
// Real long bored tunnels in the merged map: each is built, roofed, and drivable through both portal joins without a step.
// Steps further out on the approach roads (such as the slip-road junction 14m outside the Terrace Tunnel) are not part of the tunnel.
const source=mapSource(),hydro=createHydrology(new T.Scene(),source.waterways,source.raw,{seaLevel:-source.meta.originElevation});
const network=createRoadNetwork(new T.Scene(),{bounds:source.bounds,elements:source.elements,seaLevel:-source.meta.originElevation},hydro,source.raw,{},null,source.railways,{buildGeometry:false});
const names=['Terrace Motorway Tunnel','Mount Victoria Tunnel','Hataitai Tunnel','Moa Point Road'],report=[];
for(const name of names){const tunnel=network.roads.find(r=>r.tunnel&&r.name===name&&r.length>150);assert.ok(tunnel,`${name} is built as a road`);
 const approach=node=>network.roads.find(r=>!r.tunnel&&r!==tunnel&&(r.p[0].node===node||r.p.at(-1).node===node)&&!['footway','path','cycleway','steps'].includes(r.type));
 const lead=(r,node)=>!r?[]:r.p[0].node===node?r.p:r.p.slice().reverse(),before=lead(approach(tunnel.p[0].node),tunnel.p[0].node).slice().reverse(),after=lead(approach(tunnel.p.at(-1).node),tunnel.p.at(-1).node);
 // Walk the centre line at 1m steps, from 30m before the first portal to 30m past the last, following the surface as a car would.
 const line=[...before.slice(0,-1),...tunnel.p,...after.slice(1)],start=before.length?before.length-1:0,cum=[0];for(let i=1;i<line.length;i++)cum.push(cum[i-1]+line[i].distanceTo(line[i-1]));
 const from=Math.max(0,cum[start]-30),to=Math.min(cum.at(-1),cum[start]+tunnel.length+30);let y=null,step=0,roofed=0,samples=0;
 for(let s=from;s<=to;s+=1){let i=0;while(i<line.length-2&&cum[i+1]<s)i++;const t=(s-cum[i])/(cum[i+1]-cum[i]||1),x=line[i].x+(line[i+1].x-line[i].x)*t,z=line[i].y+(line[i+1].y-line[i].y)*t,h=network.walkHeight(x,z,y===null?undefined:y+2);const atTunnel=s>=cum[start]-3&&s<=cum[start]+tunnel.length+3;if(y!==null&&atTunnel)step=Math.max(step,Math.abs(h-y));y=h;samples++;if(network.underpass(x,z,h+1))roofed++}
 report.push({name,length:Math.round(tunnel.length),step:+step.toFixed(2),roofed:+(roofed/samples).toFixed(2)});
 assert.ok(step<.35,`${name}: no step through the portals and bore (largest ${step.toFixed(2)}m between 1m samples)`);
 assert.ok(roofed>tunnel.length*.9,`${name}: the bore is under its roof`)}
console.log(`PASS: ${report.map(r=>`${r.name} ${r.length}m (max step ${r.step}m)`).join(', ')} built through the hills and drivable portal to portal.`);
