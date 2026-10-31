import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../dist/vendor/three.js';
import {regionalMap} from '../scripts/lib/map-source.mjs';
import {buildJunctions} from '../dist/road-grades.js';
import {roadIndex,projectSegment} from '../dist/road-topology.js';
import {insideFootprint} from '../dist/road-clipping.js';
import {planStreetFurniture,createStreetFurniture,streetLabel,streetServiceStyle} from '../dist/street-furniture.js';
const source=regionalMap();
const roads=source.elements.filter(r=>['Short Street','Bledisloe Crescent'].includes(r.tags?.name)).map(r=>({...r,name:r.tags.name,type:r.tags.highway,width:6.4,pavementWidth:8.6,bridge:false,p:r.geometry.map(p=>Object.assign(new T.Vector2(p.x,p.z),{node:p.node}))}));
const junctions=buildJunctions(roads),cells=roadIndex(roads),network={roads,junctions,height:()=>0,at(x,z){let best=null;for(const item of cells.get(Math.floor(x/50)+','+Math.floor(z/50))||[]){const h=projectSegment(item.r,item.i,x,z);if(!best||h.d<best.d)best=h}return best},junctionAt(x,z){return junctions.some(h=>insideFootprint(x,z,h.outline))}};
const plan=planStreetFurniture(network);assert.ok(plan.poles.length>8);assert.ok(plan.links.length>3);assert.equal(streetLabel('Bledisloe Crescent'),'Bledisloe Cres');assert.equal(streetLabel('Short Street'),'Short St');
const signs=plan.signs.filter(s=>s.name==='Short Street'||s.name==='Bledisloe Crescent');assert.equal(signs.length,2,'Real mapped junction receives both road-name blades');assert.equal(signs[0].pole,signs[1].pole,'Blades share a pole');assert.equal(signs[0].pole.kind,'concrete');assert.ok(signs.find(s=>s.name==='Short Street').height>signs.find(s=>s.name==='Bledisloe Crescent').height,'Blade heights match the reference');
for(const p of plan.poles){const h=network.at(p.x,p.z);assert.ok(!h||h.d>h.r.width/2+.2,'Poles stay outside carriageways');assert.ok(!network.junctionAt(p.x,p.z),'Poles stay out of junction asphalt')}
const scene=new T.Scene(),world={network,free:()=>true,walkHeight:(x,z)=>z*.025,hydro:{channel:()=>null},railways:{at:()=>null}},furniture=createStreetFurniture(scene,world),camera={x:431,y:18,z:637};const plannedPole=furniture.plan.signs.find(s=>s.name==='Short Street').pole;assert.equal(furniture.free(plannedPole.x,plannedPole.z),false,'Landing and pedestrian checks avoid poles before their chunks load');furniture.update(camera,1);assert.ok(furniture.stats.poles>0&&furniture.stats.signs===2);const pole=furniture.plan.signs.find(s=>s.name==='Short Street').pole;assert.equal(furniture.free(pole.x,pole.z),false,'Loaded poles are solid');assert.equal(furniture.parkingClear({x:pole.x,z:pole.z,dx:1,dz:0},{width:1.8,length:4.8}),false,'Parked vehicles must clear planned poles');assert.equal(scene.children.filter(o=>o.isSpotLight).length,2,'Night lighting has a fixed light budget');assert.ok(scene.children.some(o=>o.isSpotLight&&o.intensity>0));
scene.traverse(o=>{if(o.geometry?.attributes.position)assert.ok([...o.geometry.attributes.position.array].every(Number.isFinite),'All furniture, labels and sagging wires have finite geometry')});
scene.traverse(o=>{if(!o.isLineSegments)return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)assert.ok(p.getY(i)-world.walkHeight(p.getX(i),p.getZ(i))>=5.49,'Sagging wires preserve ground clearance');if(p.count>=24)assert.ok(p.getY(12)<(p.getY(0)+p.getY(23))/2-.10,'Spans sag between their anchors')});
await new Promise(resolve=>setTimeout(resolve,130));furniture.update({x:10000,y:2,z:10000},0);assert.equal(furniture.stats.chunks,0,'Distant furniture chunks unload');
furniture.dispose();assert.equal(scene.children.length,0);
console.log('PASS: real Short/Bledisloe signs, concrete shared mounting, verge clearance, sagging-wire geometry, streamed furniture, pole collisions and a two-light night budget.');

const plain={id:'public-unnamed',type:'residential',width:6,pavementWidth:8.2,p:[new T.Vector2(0,0),new T.Vector2(0,140)],tags:{'power:location':'underground'}};
const simple=r=>({roads:[r],junctions:[],at:(x,z)=>({r,d:Math.abs(x)}),height:()=>0,junctionAt:()=>false});
const buried=planStreetFurniture(simple(plain));assert.ok(buried.poles.length>=3,'Unnamed public streets receive lighting');assert.ok(buried.poles.every(p=>p.kind==='lamp'&&!p.transformer),'Underground supply uses plain lamp columns');assert.equal(buried.links.length,0,'Standalone lamps have no overhead wires');
assert.equal(streetServiceStyle({...plain,bridge:true,tags:{}}).mode,'underground','Bridge lighting has concealed supply');
for(const patch of [{tags:{access:'private'}},{type:'service',tags:{service:'driveway'}},{type:'unclassified',tags:{maxspeed:'100',lit:'no'}},{tags:{'power:location':'underground',lit:'no'}}])assert.equal(planStreetFurniture(simple({...plain,...patch})).poles.length,0,'Excluded/unlit roads do not get blanket lamps');
assert.deepEqual(streetServiceStyle({name:'Example Crescent',id:'1'}),streetServiceStyle({name:'Example Crescent',id:'2'}),'The visual mix stays consistent along a named street');
const undergroundScene=new T.Scene(),undergroundWorld={network:simple(plain),free:()=>true,walkHeight:()=>0,hydro:{channel:()=>null},railways:{at:()=>null}},standalone=createStreetFurniture(undergroundScene,undergroundWorld);standalone.update({x:0,y:2,z:60},1);assert.ok(standalone.stats.standalone>0);let wireMeshes=0;undergroundScene.traverse(o=>{if(o.isLineSegments)wireMeshes++});assert.equal(wireMeshes,0,'Concealed-supply columns render without wire geometry');standalone.dispose();
console.log('PASS: underground/overhead styles, unnamed public streets, concealed bridge lighting, unlit/private exclusions, consistent street-level defaults and wire-free standalone meshes.');

const bridgeNetwork=simple({...plain,bridge:true,tags:{}});bridgeNetwork.onBridge=()=>true;const bridgeWorld={...undergroundWorld,network:bridgeNetwork,walkHeight:()=>8,hydro:{channel:()=>({y:0})}},bridgeScene=new T.Scene(),bridgeLights=createStreetFurniture(bridgeScene,bridgeWorld);assert.ok(bridgeLights.plan.poles.length>0,'Supported bridge decks can receive lamps above water');assert.equal(bridgeLights.plan.links.length,0);bridgeLights.dispose();
