import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../dist/vendor/three.js';
import {roadWidth,inheritLanes} from '../dist/road-topology.js';
import {selectGroundTiles,createGroundDetail} from '../dist/ground-detail.js';
import {applyGroundImagery} from '../dist/ground-imagery.js';

// Road widths: tagged and untagged sections of one street agree; one-way and roundabout ways are not two-way wide.
assert.equal(roadWidth({highway:'secondary'}),roadWidth({highway:'secondary',lanes:'2'}),'Untagged two-way arterial matches its lanes=2 neighbour');
assert.ok(roadWidth({highway:'secondary',junction:'roundabout'})<6,'Untagged roundabout ring is a single lane');
assert.ok(roadWidth({highway:'tertiary',oneway:'yes'})<=6,'Untagged one-way tertiary is not given two-way width');assert.ok(roadWidth({highway:'secondary',oneway:'yes','cycleway:left':'lane'})>roadWidth({highway:'secondary',oneway:'yes'}),'Tagged cycle lanes add width');
assert.ok(roadWidth({highway:'trunk_link'})<6,'Links default to one lane');
assert.ok(roadWidth({highway:'secondary',lanes:'3'})-roadWidth({highway:'secondary',lanes:'2'})<2,'A turn lane mostly uses kerbside space');
assert.equal(roadWidth({highway:'secondary',width:'8'}),8,'Plausible width tags are kept');
assert.equal(roadWidth({highway:'residential',width:'40'}),roadWidth({highway:'residential'}),'Implausible width tags fall back to the lane model');
assert.equal(roadWidth({highway:'path',width:'0.1m'}),2,'Typo path widths fall back');
assert.equal(roadWidth({highway:'service',service:'driveway'}),3);
const way=(id,tags,a,b)=>({id,tags:{highway:'secondary',name:'Main Road',...tags},geometry:[{x:a,z:0,node:'n'+a},{x:b,z:0,node:'n'+b}]});
const ways=[way(1,{lanes:'2',oneway:'yes'},0,10),way(2,{oneway:'yes'},10,20),way(3,{oneway:'yes',name:'Other'},20,30)],lanes=inheritLanes(ways);
assert.equal(lanes.get(ways[1]),2,'Untagged continuation inherits lanes');assert.equal(lanes.has(ways[2]),false,'Different street does not inherit');

// Regional ground: whole-region overview, valley and urban tiers cover the regional terrain without overlapping Wainuiomata detail.
const dist=new URL('../dist/',import.meta.url),region=JSON.parse(fs.readFileSync(new URL('regional-terrain.json',dist))),ground=JSON.parse(fs.readFileSync(new URL('ground-regional.json',dist))),detail=JSON.parse(fs.readFileSync(new URL('ground-detail.json',dist)));
const o=ground.overview;assert.ok(o.minX<=region.minX&&o.minZ<=region.minZ&&o.maxX>=region.maxX&&o.maxZ>=region.maxZ,'Overview covers the regional terrain');
for(const tier of ['valley','urban'])for(const t of ground[tier].tiles){assert.ok(fs.existsSync(new URL(t.image,dist)),t.image);assert.equal(t.maxX-t.minX,ground[tier].span)}
assert.ok(ground.urban.tiles.some(t=>t.minX>8000&&t.minZ<-14000),'Upper Hutt has urban ground tiles');
const inner=detail.tiles;assert.ok(!ground.urban.tiles.some(t=>inner.some(d=>t.minX>=d.minX&&t.maxX<=d.maxX+256&&t.minZ>=d.minZ&&t.maxZ<=d.maxZ+256&&t.minX>=-3328&&t.maxX<=3328&&t.minZ>=-3328&&t.maxZ<=3328)),'Native Wainuiomata detail is not duplicated');
const near=selectGroundTiles(ground.valley.tiles,{x:8416,z:-14079},4*1024*1024,{range:2600});assert.ok(near.length>=1&&near.length<=4&&near.some(t=>8416>=t.minX&&8416<=t.maxX&&-14079>=t.minZ&&-14079<=t.maxZ),'Valley tile under the camera is selected');
const streamed=createGroundDetail(detail,ground);assert.equal(streamed.layers.length,4);assert.equal(streamed.valleyLayers.length,4);assert.ok(streamed.valleyLayers.every(l=>l.blank&&l.detail>0));

// Shader: blank (white no-data) and grain options compile into the terrain fragment.
const material=new T.MeshLambertMaterial(),texture=new T.Texture();applyGroundImagery(material,[{texture,bounds:o,blank:true,detail:.35},{texture,bounds:o}]);const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <color_fragment>'};material.onBeforeCompile(shader);
assert.ok(shader.fragmentShader.includes('smoothstep(.93,.98'),'White no-data falls back to procedural ground');assert.ok(shader.fragmentShader.includes('groundGrain,0.35'),'Coarse imagery keeps procedural grain');assert.notEqual(material.customProgramCacheKey(),'');
console.log(`PASS: consistent lane-based road widths, lane inheritance, regional overview/valley/urban ground coverage (${ground.valley.tiles.length} valley, ${ground.urban.tiles.length} urban tiles), no-data fallback and grain.`);
