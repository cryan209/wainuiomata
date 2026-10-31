import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.js';
import {createRoadNetwork} from '../dist/water-roads.js';
import {gradeLimit,approachLimit} from '../dist/road-grades.js';
const way=(id,type,points,tags={})=>({id,tags:{highway:type,...tags},geometry:points.map(([x,z,node])=>({x,z,node}))});
const make=(elements,ground,options={buildGeometry:false})=>createRoadNetwork(new T.Scene(),{elements},{ground,channel:()=>null},ground,{asphalt:null,concrete:null},null,null,options);
// A link road dives under a main road through a short tunnel=yes underpass, joined to approach roads at both portals.
const ground=(x,z)=>x*.02,elements=[
 way(1,'secondary',[[-150,0,1],[0,0,2],[150,0,3]],{name:'Main Road'}),
 way(2,'secondary_link',[[0,-120,10],[0,-18,11]]),way(3,'secondary_link',[[0,-18,11],[0,0,12],[0,18,13]],{tunnel:'yes',layer:'-1'}),way(4,'secondary_link',[[0,18,13],[0,120,14]]),
 way(5,'service',[[300,-200,20],[300,200,21]],{tunnel:'yes',layer:'-1'})];
const network=make(elements,ground),tunnel=network.roads.find(r=>r.tunnel),main=network.roads.find(r=>r.name==='Main Road');
assert.ok(tunnel,'Short tunnel=yes way is built as a road');assert.equal(network.roads.filter(r=>r.tunnel).length,1,'A 400m bored tunnel is left to the tunnel interior');
assert.ok([10,14].every(node=>network.roads.some(r=>!r.tunnel&&r.p.some(p=>p.node===node)))&&[11,13].every(node=>tunnel.p.some(p=>p.node===node)&&network.roads.some(r=>!r.tunnel&&r.p.some(p=>p.node===node))),'Underpass shares its portal nodes with the approach roads');
// The floor is straight between the portals, inside the link grade limit.
const floorAt=z=>network.walkHeight(0,z,tunnel.floorStart+2),floor0=floorAt(0);
for(const z of [-12,-6,6,12]){const linear=tunnel.floorStart+(tunnel.floorEnd-tunnel.floorStart)*(z+18)/36;assert.ok(Math.abs(floorAt(z)-linear)<.05,'Underpass floor runs straight between its portals')}
for(const row of tunnel.gradeProfiles){const dx=36/(tunnel.gradeProfiles.length*(row.length-1));for(let j=1;j<row.length;j++)assert.ok(Math.abs(row[j]-row[j-1])<=gradeLimit(tunnel)*18/(row.length-1)+.02)}
assert.ok(tunnel.floorStart<ground(0,-18)-1,'Part of the shortfall is dug out of the floor');
// The road above clears the headroom and slab and its lift fades at the approach grade; the approaches ease down into the cutting within their limit.
const deck=network.walkHeight(0,0,floor0+8);assert.ok(deck>=floor0+tunnel.headroom+.9-.02,`Main Road clears the underpass (${(deck-floor0).toFixed(2)}m)`);assert.ok(deck<=floor0+tunnel.headroom+1.2,'Main Road is lifted no more than needed');
for(const r of [main,...network.roads.filter(r=>r.type==='secondary_link'&&!r.tunnel)])for(let i=0;i<r.p.length-1;i++){const row=r.gradeProfiles[i],a=r.p[i],b=r.p[i+1],dx=a.distanceTo(b)/(row.length-1),offset=j=>{const t=j/(row.length-1);return row[j]-ground(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t)};for(let j=1;j<row.length;j++){assert.ok(Math.abs(row[j]-row[j-1])<=gradeLimit(r)*dx+1e-6,'Ramps and cuttings stay within the road grade limit');if(r===main)assert.ok(Math.abs(offset(j)-offset(j-1))<=approachLimit(r)*dx+.02,'Lift over the underpass fades at the approach grade')}}
for(const x of [-140,140])assert.ok(Math.abs(network.walkHeight(x,0)-ground(x,0)-.16)<.3,'Main Road returns to its terrain away from the underpass');
// Surface picking: the floor below, the deck above, and the deck when no height is given. Terrain follows the deck, not the floor.
assert.ok(Math.abs(network.walkHeight(0,4,floor0+2)-floorAt(4))<.05&&Math.abs(network.walkHeight(0,4,deck+2)-deck)<.2&&Math.abs(network.walkHeight(0,4)-deck)<.2,'Height-aware surface picking separates the two levels');
assert.ok(network.ground(0,3)>deck-.3,'Terrain over the underpass is graded to the road above');assert.ok(network.ground(0,11)>ground(0,11)-.1,'Terrain beside the road above is not dug down to the floor')
// Walls: no leaving or entering the shell sideways below the roof; the portals and the road above stay open.
const inside={x:0,z:-6,y:floorAt(-6)+2},side=tunnel.pavementWidth/2+.3;
assert.equal(network.underpassWall(side+.2,-6,inside.y,inside),true,'Wall stops a car leaving sideways');assert.equal(network.underpassWall(0,-4,inside.y,inside),false,'Driving along the underpass is free');
assert.equal(network.underpassWall(side-1,-6,inside.y,{x:side+2,z:-6,y:inside.y}),true,'Wall stops entry from the side');
assert.equal(network.underpassWall(0,-20,floorAt(-18)+2,{x:0,z:-30,y:floorAt(-18)+2}),false,'Portal mouth is open');
assert.equal(network.underpassWall(side+.2,0,deck+2,{x:0,z:0,y:deck+2}),false,'Traffic on the road above is unaffected');
// Geometry: walls, slab and headwalls are emitted as structure.
{const scene=new T.Scene();createRoadNetwork(scene,{elements},{ground,channel:()=>null},ground,{asphalt:null,concrete:null},null,null);let structure=0;scene.traverse(o=>{if(o.isMesh&&o.userData.surface==='structure')structure+=o.geometry.attributes.position.count});assert.ok(structure>=36*12,'Underpass shell geometry is built')}
console.log('PASS: short underpasses built as connected roads, straight dug floors, clearance over them with design-grade ramps, height-aware surfaces, graded terrain, shell walls and geometry.');
