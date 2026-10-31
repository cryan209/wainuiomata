import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from '../dist/vendor/three.js';
import {RADIO_TOWER_SITES,towerGeometry,towerDestinations,createRadioTowers} from '../dist/radio-towers.js';
import {radioTowerVegetationClear} from '../dist/radio-tower-sites.js';
import {mapSource} from '../scripts/lib/map-source.mjs';
const source=JSON.parse(readFileSync(new URL('../scripts/data/radio-towers-osm.json',import.meta.url))),terrain=mapSource();
assert.equal(RADIO_TOWER_SITES.length,3);
for(const site of RADIO_TOWER_SITES){assert.ok(source.sites[site.id]);assert.ok(site.x>terrain.bounds.minX&&site.x<terrain.bounds.maxX&&site.z>terrain.bounds.minZ&&site.z<terrain.bounds.maxZ);assert.ok(terrain.raw(site.x,site.z)+terrain.meta.originElevation>170);const {geometry,silhouette}=towerGeometry(site);assert.ok(geometry.attributes.position.count>1000&&geometry.attributes.position.count<50000);for(const attr of Object.values(geometry.attributes))assert.ok(attr.array.every(Number.isFinite));assert.equal(geometry.attributes.color.count,geometry.attributes.position.count);assert.ok(Math.abs(geometry.boundingBox.max.y-site.height)<.01);assert.ok(silhouette.attributes.position.count>100);assert.equal(radioTowerVegetationClear(site.x,site.z,3),false);geometry.dispose();silhouette.dispose()}
assert.equal(RADIO_TOWER_SITES.find(s=>s.id==='kaukau').height,122,'Kaukau retains its pre-2022 upper mast for the game era');
const scene=new T.Scene(),world={ground:(x,z)=>terrain.raw(x,z),walkHeight:(x,z)=>terrain.raw(x,z)},towers=createRadioTowers({scene,world});
assert.equal(scene.children.length,7,'Three batched near meshes, three distant silhouettes and one light batch');
for(const entry of towers.entries){const {site,y}=entry,position={x:site.x+50,z:site.z};towers.update(position,0);assert.ok(entry.near.visible&&!entry.far.visible);towers.update({x:site.x+3000,z:site.z},1);assert.ok(!entry.near.visible&&entry.far.visible);const corner={x:site.x+site.width/2,z:site.z+site.width/2};assert.equal(towers.free(corner.x,corner.z,y),false,'Tower feet block walking through supports');assert.equal(towers.free(corner.x,corner.z,y+site.height+5),true,'Collision respects height');assert.equal(towers.free(site.x,site.z,y+site.height-2),false,'Upper antenna has collision');}
assert.ok(scene.children.at(-1).visible,'Obstruction lights appear at night');towers.update({x:0,z:0},0);assert.equal(scene.children.at(-1).visible,false);
for(const [id,d] of towerDestinations(world)){assert.ok(id.startsWith('tower-'));assert.ok(d.drone&&Number.isFinite(d.pitch)&&Number.isFinite(d.yaw));assert.ok(d.x>terrain.bounds.minX&&d.x<terrain.bounds.maxX&&d.z>terrain.bounds.minZ&&d.z<terrain.bounds.maxZ)}
console.log('PASS: three sourced in-bounds transmitter sites, finite detailed geometry, historical Kaukau height, fixed draw-call budget, distance LOD, night lights, support collisions and tower-view destinations.');
