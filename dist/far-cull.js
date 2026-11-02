import * as T from './vendor/three.js';

// Static scenery far beyond the view distance still costs three.js a matrix update and a frustum test every frame,
// and with thousands of top-level objects that walk dominates render time on weak CPUs. Twice a second (or after the
// camera moves) this sweeps the scene's direct children and parks fully static ones whose bounds lie past the far
// plane plus a margin: layer mask 0 (never drawn, not even in shadow passes) and matrixWorldAutoUpdate off (three
// skips the subtree). `visible` is left alone because streaming and LOD code own it. Parked objects are restored
// before they can come into view, and any that leave the scene are restored so a re-added object is never stuck.
const MARGIN=300,INTERVAL=.5,MOVE=150;
export function createFarCull(scene,camera){
 const parked=new Map(),sphere=new T.Sphere(),box=new T.Box3(),last=new T.Vector3(Infinity,0,0);let timer=0,lastFar=0;
 const fullyStatic=o=>{let ok=true;o.traverse(x=>{if(x.matrixAutoUpdate)ok=false});return ok};
 function bounds(o){
  if(o.children.length){box.setFromObject(o);if(box.isEmpty())return null;return box.getBoundingSphere(sphere)}
  if(o.isInstancedMesh){if(!o.boundingSphere)o.computeBoundingSphere();sphere.copy(o.boundingSphere)}
  else if(o.geometry){const g=o.geometry;if(!g.boundingSphere)g.computeBoundingSphere();if(!g.boundingSphere)return null;sphere.copy(g.boundingSphere)}
  else return null;
  return sphere.applyMatrix4(o.matrix);
 }
 function park(o){parked.set(o,o.layers.mask);o.layers.mask=0;o.matrixWorldAutoUpdate=false}
 function restore(o){o.layers.mask=parked.get(o);o.matrixWorldAutoUpdate=true;parked.delete(o)}
 function sweep(){
  for(const o of parked.keys())if(o.parent!==scene)restore(o);
  const limit=camera.far+MARGIN,cx=camera.position.x,cz=camera.position.z;
  for(const o of scene.children){
   if(o.frustumCulled===false||!parked.has(o)&&(o.layers.mask===0||!fullyStatic(o)))continue;
   const s=bounds(o);if(!s)continue;
   const far=Math.hypot(s.center.x-cx,s.center.z-cz)-s.radius>limit;
   if(far&&!parked.has(o))park(o);else if(!far&&parked.has(o))restore(o);
  }
 }
 return{
  update(dt){
   timer-=dt;
   if(timer>0&&camera.far===lastFar&&Math.hypot(camera.position.x-last.x,camera.position.z-last.z)<MOVE)return;
   timer=INTERVAL;lastFar=camera.far;last.copy(camera.position);sweep();
  },
  get stats(){return{parked:parked.size}},
 };
}
