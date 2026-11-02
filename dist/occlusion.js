import * as T from './vendor/three.js';

// Hardware occlusion culling. After the opaque pass, bounding boxes are drawn invisibly (no colour or depth writes)
// inside WebGL2 occlusion queries; a box with no samples passing is hidden. Results arrive a frame or two later and
// are never waited on.
// Two kinds of candidate:
// - Static scenery meshes (walls, roofs, terrain, trees). Hidden ones move to OCCLUDED_LAYER: the main camera skips
//   it, shadow cameras keep it, so an unseen building still casts its shadow into view. `visible` is left alone
//   because streaming and LOD code own it. Hidden ones are retested every frame; visible ones a few at a time.
// - Moving instances (cars, people) through instance(key, ...): the caller skips writing the instance when it returns
//   false. Each gets a tight box around its current position, so a car behind a shop costs nothing to draw.
export const OCCLUDED_LAYER=5;
const RESCAN=.5,MIN_TRIANGLES=1500,PAD=1,VISIBLE_BUDGET=48,HIDDEN_BUDGET=400,INSTANCE_BUDGET=320,INSTANCE_PAD=.6,FORGET=2000;
export function createOcclusion(renderer,scene,camera){
 const gl=renderer.getContext();
 if(typeof WebGL2RenderingContext==='undefined'||!(gl instanceof WebGL2RenderingContext))return{update(){},instance:()=>true,enabled:false,get stats(){return{candidates:0,hidden:0,instances:0,instancesHidden:0}}};
 const entries=new Map(),instances=new Map(),queries=[],probes=[],frustum=new T.Frustum(),viewProjection=new T.Matrix4(),box=new T.Box3(),size=new T.Vector3(),centre=new T.Vector3(),one=new T.Quaternion();
 const probeGeometry=new T.BoxGeometry(1,1,1),probeMaterial=new T.MeshBasicMaterial({colorWrite:false,depthWrite:false,side:T.DoubleSide,fog:false});
 const root=new T.Group();root.name='Occlusion probes';root.matrixAutoUpdate=false;root.frustumCulled=false;scene.add(root);
 let rescan=0,cursor=0,used=0,hiddenCount=0,lightScan=0,enabled=true,frame=-1,instanceTests=0,instancesHidden=0;
 const triangles=o=>{const g=o.geometry;let n=g.index?g.index.count:g.attributes.position?.count||0;if(g.drawRange.count!==Infinity)n=Math.min(n,g.drawRange.count);return n/3*(o.isInstancedMesh?o.count:1)};
 const opaque=m=>Array.isArray(m)?m.every(opaque):m&&!m.transparent&&m.colorWrite!==false;
 const isStatic=o=>{for(let x=o;x&&x!==scene;x=x.parent)if(x.matrixAutoUpdate)return false;return true};
 function worldBox(o){
  const g=o.geometry;if(o.isInstancedMesh){if(!o.boundingBox)o.computeBoundingBox();box.copy(o.boundingBox)}else{if(!g.boundingBox)g.computeBoundingBox();box.copy(g.boundingBox)}
  return box.isEmpty()?null:box.applyMatrix4(o.matrixWorld).expandByScalar(PAD).clone();
 }
 function hide(e,o){if(e.hidden||o.layers.mask===0)return;e.mask=o.layers.mask;o.layers.mask=1<<OCCLUDED_LAYER;e.hidden=true;hiddenCount++}
 function show(e,o){if(!e.hidden)return;if(o.layers.mask===1<<OCCLUDED_LAYER)o.layers.mask=e.mask;e.hidden=false;hiddenCount--}
 function release(e){if(e.query){queries.push(e.query);e.query=null;e.issued=false}}
 function drop(o){const e=entries.get(o);show(e,o);release(e);entries.delete(o)}
 function scan(){
  const seen=new Set();
  scene.traverseVisible(o=>{
   if(!(o.isMesh)||o.frustumCulled===false||o.parent===root||!opaque(o.material)||!isStatic(o))return;
   if(o.layers.mask!==1&&o.layers.mask!==1<<OCCLUDED_LAYER)return;
   const e=entries.get(o);
   if(e&&e.geometry===o.geometry&&e.count===o.count){seen.add(o);return}
   if(triangles(o)<MIN_TRIANGLES)return;
   const b=worldBox(o);if(!b)return;
   if(e){e.box=b;e.geometry=o.geometry;e.count=o.count}else entries.set(o,{box:b,geometry:o.geometry,count:o.count,hidden:false,mask:1,query:null,issued:false});
   seen.add(o);
  });
  // Objects that left the scene, turned invisible or stopped qualifying are restored and forgotten.
  for(const o of[...entries.keys()])if(!seen.has(o)&&o.layers.mask!==0)drop(o);
 }
 function enableShadowLayers(){scene.traverse(o=>{if(o.isLight&&o.shadow?.camera)o.shadow.camera.layers.enable(OCCLUDED_LAYER)})}
 // A finished query, if any, without stalling: true when any sample passed, null while still pending.
 function result(e){
  if(!e.query||!e.issued||!gl.getQueryParameter(e.query,gl.QUERY_RESULT_AVAILABLE))return null;
  const visible=gl.getQueryParameter(e.query,gl.QUERY_RESULT)>0;release(e);return visible;
 }
 function probe(e){
  let p=probes[used];
  if(!p){p=new T.Mesh(probeGeometry,probeMaterial);p.matrixAutoUpdate=false;p.frustumCulled=false;p.renderOrder=1e9;
   p.onBeforeRender=(r,s,cam)=>{const e=p.userData.entry;if(cam!==camera||!e||p.userData.active)return;gl.beginQuery(gl.ANY_SAMPLES_PASSED_CONSERVATIVE,e.query);p.userData.active=true};
   p.onAfterRender=()=>{if(!p.userData.active)return;gl.endQuery(gl.ANY_SAMPLES_PASSED_CONSERVATIVE);p.userData.active=false;p.userData.entry.issued=true;p.userData.entry=null};
   probes.push(p);root.add(p)}
  e.query=queries.pop()||gl.createQuery();e.issued=false;
  e.box.getCenter(centre);e.box.getSize(size);p.matrix.compose(centre,one,size);p.matrixWorld.copy(p.matrix);p.userData.entry=e;p.visible=true;used++;
 }
 // Frames are counted by renders, so probes scheduled by the update code before a render are drawn by it, and any
 // that were not drawn (paused, indoors) are recycled at the start of the next frame.
 function beginFrame(){
  const f=renderer.info.render.frame;if(f===frame)return;frame=f;
  for(const p of probes){p.visible=false;const e=p.userData.entry;if(e&&!p.userData.active){if(!e.issued)release(e);p.userData.entry=null}}
  used=0;instanceTests=0;
  camera.updateMatrixWorld();viewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(viewProjection);
 }
 return{
  get stats(){return{candidates:entries.size,hidden:hiddenCount,instances:instances.size,instancesHidden}},
  set enabled(v){enabled=v;if(!v){for(const o of[...entries.keys()])drop(o);for(const e of instances.values())release(e);instances.clear();instancesHidden=0;for(const p of probes)p.visible=false}},
  get enabled(){return enabled},
  // A moving instance standing at (x, y, z), `radius` across and `height` tall. False when it is off-screen or its
  // box was hidden last time it was tested; it is retested every frame while in view.
  instance(key,x,y,z,radius,height){
   if(!enabled)return true;beginFrame();
   let e=instances.get(key);if(!e)instances.set(key,e={box:new T.Box3(),visible:true,query:null,issued:false,seen:0});
   e.seen=performance.now();
   const r=result(e);if(r!==null){if(e.visible&&!r)instancesHidden++;else if(!e.visible&&r)instancesHidden--;e.visible=r}
   e.box.min.set(x-radius-INSTANCE_PAD,y-.3,z-radius-INSTANCE_PAD);e.box.max.set(x+radius+INSTANCE_PAD,y+height+INSTANCE_PAD,z+radius+INSTANCE_PAD);
   // Off-screen instances forget being hidden, so one coming into view is drawn rather than waiting on a test.
   if(!frustum.intersectsBox(e.box)){if(!e.visible){e.visible=true;instancesHidden--}return false}
   if(e.box.containsPoint(camera.position)){if(!e.visible){e.visible=true;instancesHidden--}return true}
   if(!e.query&&instanceTests<INSTANCE_BUDGET){probe(e);instanceTests++}
   return e.visible;
  },
  update(dt){
   beginFrame();if(!enabled)return;
   if((lightScan-=dt)<=0){
    lightScan=5;enableShadowLayers();
    const now=performance.now();for(const[k,e]of instances)if(now-e.seen>FORGET){if(!e.visible)instancesHidden--;release(e);instances.delete(k)}
   }
   if((rescan-=dt)<=0){rescan=RESCAN;scan()}
   for(const[o,e]of entries){const r=result(e);if(r===true)show(e,o);else if(r===false)hide(e,o)}
   const eye=camera.position,list=[...entries];let hiddenTests=0,visibleTests=0;
   for(const[o,e]of list){
    if(o.layers.mask===0)continue;
    // Off-screen or wrapped around the camera: draw it, so turning round never meets a stale hidden object.
    if(!frustum.intersectsBox(e.box)||e.box.containsPoint(eye)){show(e,o);continue}
    if(e.hidden&&!e.query&&hiddenTests<HIDDEN_BUDGET){probe(e);hiddenTests++}
   }
   for(let i=0;i<list.length&&visibleTests<VISIBLE_BUDGET;i++){
    const[o,e]=list[(cursor+i)%list.length];
    if(e.hidden||e.query||o.layers.mask===0||!frustum.intersectsBox(e.box)||e.box.containsPoint(eye))continue;
    probe(e);visibleTests++;
   }
   cursor=list.length?(cursor+VISIBLE_BUDGET)%list.length:0;
  },
 };
}
