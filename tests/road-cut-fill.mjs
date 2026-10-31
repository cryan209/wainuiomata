import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.js';
import {createRoadNetwork} from '../dist/water-roads.js';
import {gradeLimit} from '../dist/road-grades.js';
const make=(elements,ground)=>createRoadNetwork(new T.Scene(),{elements},{ground,channel:()=>null},ground,{asphalt:null,concrete:null},null,null,{buildGeometry:false});
const way=(id,type,points,tags={})=>({id,tags:{highway:type,...tags},geometry:points.map(([x,z,node])=>({x,z,node}))});
const vertexSteps=network=>{let worst=0;for(const r of network.roads)for(let i=0;i+2<r.p.length;i++){const p=r.p[i+1];worst=Math.max(worst,Math.abs(network.height(r,i,1,p.x,p.y)-network.height(r,i+1,0,p.x,p.y)))}return worst};

// A short first segment inside a junction radius used to leave its far vertex tied to the hub and the next segment free.
{const ground=(x,z)=>z*.22,network=make([way(1,'residential',[[0,0,1],[0,5,2],[0,60,3],[0,120,4]]),way(2,'residential',[[0,0,1],[-60,0,5]]),way(3,'service',[[0,0,1],[40,-20,6]])],ground);
 assert.ok(vertexSteps(network)<1e-9,'Segments meeting at a vertex share one height');
 const r=network.roads[0];for(let z=10;z<=110;z+=10)assert.ok(Math.abs(network.walkHeight(0,z)-(ground(0,z)+.16))<1.2,'A 22% hill street follows its terrain instead of being lifted to a 12% grade')}

// One cliff-top spike in the survey is cut through rather than lifting the street over a long embankment.
{const ground=(x,z)=>Math.abs(z-100)<4?12:0,network=make([way(1,'residential',[[0,0,1],[0,100,2],[0,200,3]])],ground),r=network.roads[0];
 assert.ok(network.walkHeight(0,100)<6.5,'Spike is cut by at least half');for(const z of [40,160])assert.ok(network.walkHeight(0,z)<.5,'Street away from the spike stays on its terrain');
 for(let i=0;i<r.p.length-1;i++){const row=r.gradeProfiles[i],dx=r.p[i].distanceTo(r.p[i+1])/(row.length-1);for(let j=1;j<row.length;j++)assert.ok(Math.abs(row[j]-row[j-1])<=gradeLimit(r)*dx+1e-6)}}

// A cliff under one edge of the carriageway (or a slightly offset centre line) does not drag the roadbed up the face.
{const ground=(x,z)=>x>3?10:0,network=make([way(1,'residential',[[0,0,1],[0,120,2]])],ground);
 for(const z of [20,60,100])assert.ok(network.walkHeight(0,z)<.6,'Roadbed stays on the bench below the cliff')}

// Terrain beside a cutting grades back without a wall, and a footway beside the street shares its level.
{const ground=(x,z)=>Math.abs(z-60)<10?8:0,network=make([way(1,'residential',[[0,0,1],[0,60,2],[0,120,3]]),way(2,'footway',[[6.4,0,4],[6.4,120,5]])],ground);
 let wall=0;for(let x=0;x<24;x+=.5)wall=Math.max(wall,Math.abs(network.ground(x+.5,60)-network.ground(x,60))-Math.abs(ground(x+.5,60)-ground(x,60)));assert.ok(wall<.5,'Shoulder rises at most 1:1 between samples');
 const footway=network.roads.find(r=>r.type==='footway');assert.ok(Math.abs(network.height(footway,0,.5,6.4,60)-network.walkHeight(0,60))<.3,'Footway beside the street is pulled onto its level')}

// Overlapping parallel carriageways on the same layer cannot be graded apart into a ledge.
{const ground=(x,z)=>z*.12+(x>4?1:0),network=make([way(1,'residential',[[0,0,1],[0,150,2]]),way(2,'service',[[6,0,3],[6,75,4],[6,150,5]])],ground);
 for(const z of [30,75,120])assert.ok(Math.abs(network.walkHeight(6,z)-network.walkHeight(0,z))<.8,'Touching carriageways differ by at most half the surveyed step')}
// A divided road's two one-way carriageways are built level across the median, without flattening the climb.
{const ground=(x,z)=>z*.12+(x>5?3:0),tags={name:'Hill Road',oneway:'yes',lanes:'2'},network=make([way(1,'secondary',[[0,0,1],[0,100,2],[0,200,3]],tags),way(2,'secondary',[[12,200,4],[12,100,5],[12,0,6]],tags)],ground);
 for(const z of [40,100,160]){assert.ok(Math.abs(network.walkHeight(12,z)-network.walkHeight(0,z))<.3,'Twin carriageways share one level');assert.ok(Math.abs(network.walkHeight(0,z)-(z*.12+1.66))<1.2,'Divided road keeps its 12% climb')}}
console.log('PASS: shared vertex heights, steep streets on terrain, cliff spikes cut, cliff-edge benches, wall-free shoulders, sidewalks on the street level, parallel carriageways without ledges and level divided-road carriageways.');
