import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../dist/vendor/three.js';
import {createTraffic} from '../dist/traffic.js';
import {createDriving} from '../dist/driving.js';
const a=new T.Vector2(0,0),b=new T.Vector2(0,-1000);a.node=1;b.node=2;
const scene=new T.Scene(),traffic=createTraffic(scene,{roads:[{type:'secondary',name:'Queen Street',width:11,tags:{},p:[a,b]}],height:()=>0,walkHeight:()=>0},1),camera=new T.PerspectiveCamera(),keys={w:true},status={textContent:''};
const world={bounds:{minX:-5000,maxX:5000,minZ:-5000,maxZ:5000},free:()=>true,walkHeight:()=>0};
const driving=createDriving({traffic,railways:{trains:[]},world,camera,keys,status});driving.enter('car');driving.update(0);const car=traffic.cars.find(c=>c.controlled),offset=camera.position.clone().sub((car.renderPosition||new T.Vector3(car.position.x,car.position.y,car.position.z))),matrix=new T.Matrix4(),rendered=new T.Vector3();
for(let i=0;i<600;i++){const dt=[1/120,1/30,1/60,.047][i%4];driving.update(dt);traffic.update(dt,camera.position);const relative=camera.position.clone().sub((car.renderPosition||new T.Vector3(car.position.x,car.position.y,car.position.z)));assert.ok(relative.distanceTo(offset)<1e-8,'Chase distance stays constant under variable frame times');const mesh=scene.children.find(m=>m.name===car.model.name+' / paint'&&m.userData.vehicleDetail===car.fleetDetail);mesh.getMatrixAt(car.modelSlot,matrix);rendered.setFromMatrixPosition(matrix);assert.ok(rendered.distanceTo((car.renderPosition||new T.Vector3(car.position.x,car.position.y,car.position.z)))<.0001,'Rendered vehicle matches current simulation position');}
const source=fs.readFileSync(new URL('../dist/game.js',import.meta.url),'utf8');assert.ok(source.indexOf('driving.update(dt)')<source.indexOf('traffic.update(moving?dt:0'),'Player movement runs before vehicle instance upload');
console.log('PASS: current-frame vehicle rendering and constant chase distance at changing frame rates.');
