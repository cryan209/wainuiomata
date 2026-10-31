import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../dist/vendor/three.js';
import {createTunnelScenery,namedRoadTunnels} from '../dist/tunnel-scenery.js';
import {createRailways} from '../dist/railways.js';
import {createWaterWorld} from '../dist/water-world.js';
import {mapSource} from '../scripts/lib/map-source.mjs';
import {createHydrology,createRoadNetwork} from '../dist/water-roads.js';

const scene=new T.Scene(),definition={id:'bore',name:'Bore',rail:true,half:2.65,height:5.8,points:[{x:0,z:0,y:0},{x:120,z:0,y:1},{x:240,z:40,y:2}]};
const scenery=createTunnelScenery(scene,[definition]);
assert.ok(scenery.at(60,0,2));assert.equal(scenery.at(60,0,60),null,'A person above the tunnel stays on the hill');
assert.equal(scenery.at(60,0),null,'An unqualified terrain query never snaps into a tunnel');
assert.equal(scenery.canMove(60,4,2,{x:60,z:0}),false,'Tunnel walls block sideways movement');
assert.equal(scenery.canMove(-2,0,2,{x:1,z:0}),true,'The portal allows exit');
assert.ok(scenery.clearPortal(0,0));assert.equal(scenery.clearPortal(60,0),false,'Underground bores do not clear woodland above');
scenery.update({x:60,z:0});assert.ok(scenery.stats.chunks>0);
for(const surface of ['tunnel-lining','tunnel-portals','tunnel-lamps'])assert.ok(scene.children.some(g=>g.children.some(o=>o.userData.surface===surface)),surface);
scene.traverse(o=>{if(o.geometry?.attributes.position)assert.ok(o.geometry.attributes.position.array.every(Number.isFinite));});
const material=new T.MeshLambertMaterial();let prior=false;material.onBeforeCompile=()=>prior=true;scenery.applyTerrain(material);
const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <clipping_planes_fragment>'};material.onBeforeCompile(shader);assert.ok(prior);assert.ok(shader.uniforms.boreSegments);assert.ok(shader.fragmentShader.includes('discard'));
await new Promise(resolve=>setTimeout(resolve,110));scenery.update({x:20000,z:20000});assert.equal(scenery.stats.chunks,0,'Distant tunnel meshes release their geometry');

const railsScene=new T.Scene();railsScene.fog=new T.Fog('#aaa',100,1000);
const railData={gauge:1.067,tracks:[{id:'rail',name:'Test rail tunnel',tunnelName:'Bore',tunnel:true,electrified:false,p:[{x:0,z:0,h:10},{x:100,z:0,h:11}]}],platforms:[],stations:[],routes:[]};
const railways=createRailways(railsScene,railData,{datum:0,textures:{roadSurfaces:Array(6).fill(null),concrete:null}});
assert.ok(railsScene.children.some(o=>o.userData.surface==='road-rail-bed'),'Rail beds render inside tunnels');
assert.ok(railways.underpass(50,0,12));assert.ok(Math.abs(railways.walkHeight(50,0,12)-10.5)<.001);assert.equal(railways.walkHeight(50,0,50),null);
assert.ok(railways.clear(50,0,5),'Trees above underground track remain eligible');assert.equal(railways.clear(0,0,5),false,'Portals remain clear');
const water=createWaterWorld(railsScene,{hydro:{waterAt:()=>({y:30,depth:2,bed:28,kind:'river'})},railways,network:{onBridge:()=>false}}),camera=new T.PerspectiveCamera();camera.position.set(50,12,0);water.update(.1,camera,{day:1});assert.equal(water.underwater,false,'A river overhead does not flood a tunnel');assert.equal(water.supported(50,0,12),true);
assert.ok([...railways.destinations.values()].every(d=>d.drone),'Active rail portal travel uses a view from outside');

const data=JSON.parse(fs.readFileSync(new URL('../dist/railways.json',import.meta.url))),main=data.tracks.find(t=>t.tunnelName==='Rimutaka Tunnel');assert.ok(main);
const length=main.p.slice(1).reduce((s,p,i)=>s+Math.hypot(p.x-main.p[i].x,p.z-main.p[i].z),0);assert.ok(length>8700&&length<9000);
for(const p of [main.p[0],main.p.at(-1)]){
 const approach=data.tracks.find(t=>t!==main&&!t.tunnel&&[t.p[0],t.p.at(-1)].some(q=>q.node===p.node));assert.ok(approach,'Main tunnel connects to an approach');
 const q=[approach.p[0],approach.p.at(-1)].find(q=>q.node===p.node);assert.ok(Math.abs(q.h-p.h)<.01,'Rail portal has no vertical step');
}
const source=mapSource(),names=['Mangaroa Tunnel','Pakuratahi Tunnel',"Price's Tunnel",'Siberia Tunnel','Summit Tunnel'];
const trailNodes=new Set(source.elements.filter(r=>names.includes(r.tags.name)).flatMap(r=>r.geometry.map(p=>p.node)));
const elements=source.elements.filter(r=>r.geometry.some(p=>trailNodes.has(p.node)));
const hydro=createHydrology(new T.Scene(),[],source.raw),network=createRoadNetwork(new T.Scene(),{bounds:source.bounds,elements},hydro,source.raw,{},null,source.railways,{buildGeometry:false});
const trails=namedRoadTunnels(new T.Scene(),network);
for(const name of names){const d=trails.definitions.find(d=>d.name===name),road=network.roads.find(r=>r.name===name);assert.ok(d,name+' has an arched interior');assert.ok(d.half>2,name+' retains a railway-sized bore around the trail');assert.ok(d.height<road.headroom,'Lining clears the existing roof slab');assert.ok(d.points.every(p=>Number.isFinite(p.y)));}
trails.update({x:trails.definitions[0].points[0].x,z:trails.definitions[0].points[0].z});assert.ok(trails.stats.chunks>0,'Named tunnel aprons and interiors stream at their portals');
console.log('PASS: regional rail and trail bores, arched interiors/portals/lamps, streamed cleanup, wall/portal movement, terrain-hook chaining, surface separation, dry underground crossings and connected Rimutaka rail portals.');
