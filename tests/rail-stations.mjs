import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../dist/vendor/three.js';
import {mapSource} from '../scripts/lib/map-source.mjs';
import {createHydrology,createRoadNetwork} from '../dist/water-roads.js';
import {railTerrainGround,railCrossingCorridors,createRailTerrainClip} from '../dist/rail-clearance.js';
import {waterlooCanopyPlan,isWaterlooCanopy,addWaterlooCanopy,insideStation} from '../dist/station-canopies.js';
import {createRegionStream} from '../dist/region-stream.js';
import {createRailways} from '../dist/railways.js';

const track={electrified:true},rail={at(x,z){return{d:Math.abs(z),y:.12,t:(x+200)/400,s:{a:{x:-200,z:0},b:{x:200,z:0},dx:400,dz:0,length:400,track}};}};
const way=(id,points,tags={})=>({id,tags:{highway:'secondary',...tags},geometry:points.map(([x,z,node])=>({x,z,node}))});
const crossing=createRoadNetwork(new T.Scene(),{elements:[way('bridge',[[0,-6,1],[0,6,2]],{bridge:'yes',layer:'1'}),way('ramp',[[0,-100,3],[0,-6,1]]),way('ramp2',[[0,6,2],[0,100,4]])]},{ground:()=>0,channel:()=>null},()=>0,{},null,rail,{buildGeometry:false});
assert.ok(crossing.ground(0,0)<=-.039,'Bridge approaches cannot lift the rail bed');
assert.equal(railTerrainGround(rail,0,0,-4),-4,'Existing lower ground is preserved');
assert.equal(railTerrainGround({at:()=>({d:0,y:20,s:{track:{bridge:true}}})},0,0,0),0,'A rail bridge does not raise terrain beneath it');
const clip=createRailTerrainClip(rail);clip.setRoads(crossing.roads);clip.update({x:0,z:0});assert.ok(clip.crossings.length>0);
const material=new T.MeshLambertMaterial();material.onBeforeCompile=shader=>{shader.fragmentShader='varying vec3 boreWorld;\n'+shader.fragmentShader;};clip.applyTerrain(material);
const shader={uniforms:{},vertexShader:'',fragmentShader:'#include <clipping_planes_fragment>'};material.onBeforeCompile(shader);assert.ok(shader.uniforms.railCutCount.value>0);assert.ok(shader.fragmentShader.includes('discard'),'Rendered terrain receives rail clearance, including coarse triangles');

const previousDocument=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},fillText(){}})})};
try{
 const scene=new T.Scene(),tracks=[0,4.2].map((z,i)=>({id:'pair'+i,name:'Pair',electrified:true,p:[{x:-100,z,h:0},{x:100,z,h:2}]}));
 const railway=createRailways(scene,{gauge:1.067,tracks,platforms:[{closed:true,p:[[-100,-6],[100,-6],[100,-3],[-100,-3],[-100,-6]]}],stations:[{name:'Test',x:0,z:0}],routes:[]},{datum:0,textures:{roadSurfaces:Array(6).fill(null),concrete:null}});
 let poles=0,signs=0;scene.traverse(o=>{if(o.userData.surface==='rail-catenary-masts'){for(let i=0;i<o.count;i++){const m=new T.Matrix4();o.getMatrixAt(i,m);const p=new T.Vector3().setFromMatrixPosition(m);assert.ok(Math.min(Math.abs(p.z),Math.abs(p.z-4.2))>2.4,'Catenary poles clear adjacent lines');poles++;}}if(o.userData.surface==='station-sign-post'){assert.ok(Math.min(Math.abs(o.position.z),Math.abs(o.position.z-4.2))>3.7,'Station signs clear both train envelopes');signs++;}});
 assert.ok(poles>0&&signs>0);assert.ok(Math.abs(railway.walkHeight(-80,-4.5)-.92)<.001);assert.ok(Math.abs(railway.walkHeight(80,-4.5)-2.52)<.001,'Platform floors follow the local rail grade');
}finally{if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;}

const source=mapSource(),hydro=createHydrology(new T.Scene(),source.waterways,source.raw),network=createRoadNetwork(new T.Scene(),{bounds:source.bounds,elements:source.elements},hydro,source.raw,{},null,source.railways,{buildGeometry:false});
const corridors=railCrossingCorridors(network.roads,source.railways);assert.ok(corridors.length>10);
let probes=0;for(const c of corridors)for(const t of [-.7,-.3,0,.3,.7])for(const side of [-1,0,1]){
 const x=c.x+c.dx*c.span*t+c.dz*side,z=c.z+c.dz*c.span*t-c.dx*side,hit=source.railways.at(x,z,0);if(!hit||hit.s.track.bridge||hit.s.track.tunnel||hit.d>1.5)continue;
 assert.ok(network.ground(x,z)<=hit.y-.12+1e-5,`Rail corridor remains below tracks at ${c.road.name||c.road.id}`);probes++;
}
const building=JSON.parse(fs.readFileSync(new URL('../dist/region-chunks/-4_-11.json',import.meta.url))).buildings.find(b=>b.id===3468908);
assert.ok(isWaterlooCanopy(building));assert.equal(isWaterlooCanopy({...building,id:99}),false,'An unrelated large building is not opened');
const plan=waterlooCanopyPlan(building,{datum:source.meta.originElevation,railways:source.railways,network,ground:network.ground});
const subways=network.roads.filter(r=>r.railUnderpass&&r.p.some(p=>Math.hypot(p.x+1878,p.y+5376)<150));assert.ok(subways.length>=3,'Waterloo subway and stair branches share a solved underground profile');
const subwayJoints=new Map();for(const r of subways)for(let i=0;i<r.p.length;i++){const p=r.p[i],h=network.height(r,Math.min(i,r.p.length-2),i===r.p.length-1?1:0,p.x,p.y);if(!subwayJoints.has(p.node))subwayJoints.set(p.node,[]);subwayJoints.get(p.node).push(h);}
for(const heights of subwayJoints.values())assert.ok(Math.max(...heights)-Math.min(...heights)<.01,'Subway branches meet at the same floor height');
const structureScene=new T.Scene(),stationWays=source.elements.filter(r=>r.geometry.some(p=>Math.hypot(p.x+1878,p.z+5376)<180));
createRoadNetwork(structureScene,{bounds:source.bounds,elements:stationWays},hydro,source.raw,{asphalt:null,concrete:null},null,source.railways);
let obstructions=0;structureScene.traverse(o=>{if(o.userData.surface!=='structure')return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){const hit=source.railways.at(p.getX(i),p.getZ(i),0);if(hit&&!hit.s.track.bridge&&!hit.s.track.tunnel&&hit.d<1.7&&p.getY(i)>hit.y+.1&&p.getY(i)<hit.y+6.1)obstructions++;}});
assert.equal(obstructions,0,'Rendered subway slabs/headwalls leave the Waterloo train corridor open');
assert.ok(plan.posts.length>10);assert.ok(plan.beams.length>100);assert.equal(plan.roof.walls.length,0,'The station canopy has no full-height facade walls');
assert.ok(plan.skylights.length>0,'Translucent strips leave actual openings in the metal roof');
const area=positions=>{let total=0;for(let i=0;i<positions.length;i+=9)total+=Math.abs((positions[i+3]-positions[i])*(positions[i+8]-positions[i+2])-(positions[i+5]-positions[i+2])*(positions[i+6]-positions[i]))/2;return total;};
const outline=building.rings.reduce((total,ring)=>total+Math.abs(ring.slice(1).reduce((a,p,i)=>a+ring[i][0]*p[1]-p[0]*ring[i][1],0))/2,0);
assert.ok(Math.abs(area(plan.roof.positions)+area(plan.skylights)-outline)<.01,'Metal and skylights preserve the mapped canopy footprint');
assert.ok(new Set(plan.roof.positions.filter((_,i)=>i%3===1).map(v=>v<-1?'lower':'upper')).size===2,'The roof has two levels');
for(const p of plan.posts){assert.ok(insideStation(building.rings,p.x,p.z));assert.ok((source.railways.at(p.x,p.z,0)?.d??Infinity)>=3.2,'Columns clear every track');}
for(const beam of plan.beams)for(const p of [beam.a,beam.b]){const hit=source.railways.at(p.x,p.z,0);if(hit&&hit.d<2)assert.ok(p.y-hit.y>6.2,'Station spaceframe clears the overhead electrical envelope');}
const canopyScene=new T.Scene(),stationDetails=addWaterlooCanopy(canopyScene,plan);canopyScene.traverse(o=>{if(o.geometry?.attributes.position)assert.ok(o.geometry.attributes.position.array.every(Number.isFinite));});
const median=plan.world(40,-11),door=plan.world(9,8.5);assert.equal(stationDetails.floorAt(median.x,median.z),null,'Concourse paving never fills the railway');assert.ok(Number.isFinite(stationDetails.floorAt(door.x,door.z)),'The glazed hall has an accessible floor');
for(const opening of stationDetails.openings){const x=opening.reduce((s,p)=>s+p.x,0)/4,z=opening.reduce((s,p)=>s+p.z,0)/4;assert.equal(stationDetails.floorAt(x,z),null,'Paving leaves the subway entrances open');}
const paved=canopyScene.children.find(o=>o.userData.surface==='waterloo-concourse-paving').geometry.attributes.position;for(let i=0;i<paved.count;i++){const hit=source.railways.at(paved.getX(i),paved.getZ(i),0);if(hit)assert.ok(hit.d>1.3,'Platform paving clears the train envelope');}

// Load the actual regional renderer with Waterloo as its only building. This
// catches the original closed-box collision and its distant instanced proxy.
const scene=new T.Scene(),far=new Float32Array([-1871.704,-5400.358,building.ground-source.meta.originElevation,building.height,180.651,57.832,0,0]),textures={walls:Array(64).fill(null),windowMasks:Array(64).fill(null),metal:null,concrete:null};
const region=createRegionStream(scene,{chunks:[{id:'-4,-11',file:'waterloo-fixture',count:1,x:-1792,z:-5376}]},far,{ground:network.ground,datum:source.meta.originElevation,textures,streets:{closest:()=>null},network,coast:{meta:{bounds:{minX:-2048,maxX:-1536,minZ:-5632,maxZ:-5120}},density:()=>0,isLand:()=>true},openSpaces:{allows:()=>true},foliage:{mesh(){throw Error('Unexpected planting');}},windowMaterials:[],photoMaterials:[],freeLocal:()=>true,railways:{...source.railways,clear:()=>false},hydro});
const farBody=scene.children[0].children[0],matrix=new T.Matrix4(),position=new T.Vector3(),rotation=new T.Quaternion(),scale=new T.Vector3();farBody.getMatrixAt(0,matrix);matrix.decompose(position,rotation,scale);assert.ok(Math.abs(scale.y-.3)<.001,'Distant Waterloo is a roof plate, not a solid box');
const savedFetch=globalThis.fetch;globalThis.fetch=async()=>({ok:true,json:async()=>({buildings:[structuredClone(building)]})});
try{let done=false,error;const loaded=region.ensureAt(-1878,-5376).then(()=>done=true,e=>{error=e;done=true;});for(let i=0;i<1000&&!done;i++){region.update({x:-1878,z:-5376,y:-80});await new Promise(resolve=>setTimeout(resolve,0));}await loaded;if(error)throw error;assert.ok(done);assert.equal(region.buildings.length,0,'Canopy footprint is excluded from enclosed-building collisions');assert.ok(scene.children.some(g=>g.children?.some(o=>o.userData.surface==='station-canopy-spaceframe')));assert.ok(region.free(door.x,door.z),'The glazed hall doorway stays open');const wall=plan.world(18,8.5);assert.equal(region.free(wall.x,wall.z),false,'Glass walls have collision');}
finally{globalThis.fetch=savedFetch;}
console.log(`PASS: Waterloo open/two-level canopy, spaceframe, round columns, distant roof proxy and streamed collision; ${probes} rail-bed probes under ${corridors.length} mapped overbridge corridors and coarse-terrain shader clearance.`);
