import {addLargeHouseFacades} from './large-house-facades.js?v=release-1';
import * as T from './vendor/three.js';
import {hash} from './appearance.js?v=large-houses-94';
import {mergeFacadeBatchSteps} from './facade-array.js?v=paced-1';
import {splitMeshByCell,smallDetail,finishSteps} from './spatial-split.js?v=paced-1';
export function addSideWindows(scene,buildings,options){return finishSteps(addSideWindowSteps(scene,buildings,options))}
// The same, a building per step for paced builders (`yield*` it).
export function* addSideWindowSteps(scene,buildings,{ground,datum,textures,windowMaterials}){
 const large=addLargeHouseFacades(scene,buildings,{ground,datum,textures,windowMaterials});yield;
 const batches=Array.from({length:8},()=>({p:[],uv:[]}));let count=0;
 for(const b of buildings){if(!b.profile||!b.faces||b.profile.largeHouse&&!b.profile.shop&&!b.profile.industrial)continue;const base=b.ground-datum,height=b.eave-b.ground,style=b.profile.shop?5:b.profile.style%8;
  for(const f of b.faces){if(f.front||f.length<3)continue;const bays=Math.max(1,Math.round(f.length/5.5)),dx=(f.b[0]-f.a[0])/f.length,dz=(f.b[1]-f.a[1])/f.length;
   for(let floor=0;floor<Math.ceil(height/3.4);floor++)for(let bay=0;bay<bays;bay++){if((hash(b.id)+f.id*31+bay+floor)%(b.profile.shop?5:3)!==0)continue;
    const t=(bay+.5)/bays,x=f.a[0]+dx*f.length*t+f.nx*.025,z=f.a[1]+dz*f.length*t+f.nz*.025,y=base+floor*3.4+1.65,w=Math.min(2.2,f.length/bays*.64),h=Math.min(1.4,(base+height-y-.15)*2);if(h<.7||y-h/2<ground(x,z)+.35)continue;
    const sign=b.profile.flip,points=[[x-dx*w/2*sign,y-h/2,z-dz*w/2*sign],[x+dx*w/2*sign,y-h/2,z+dz*w/2*sign],[x+dx*w/2*sign,y+h/2,z+dz*w/2*sign],[x-dx*w/2*sign,y+h/2,z-dz*w/2*sign]],batch=batches[style];
    for(const i of [0,1,2,0,2,3]){batch.p.push(...points[i]);batch.uv.push(...[[0,1],[1,1],[1,0],[0,0]][i])}count++;
   }
  }
  yield;
 }
 // All eight styles share textures.sideDetails (already in windowMaterials) and split by area as small details.
 const g=yield* mergeFacadeBatchSteps(batches);if(g)for(const part of smallDetail(splitMeshByCell(new T.Mesh(g,textures.sideDetails.material()),600)))scene.add(part);
 return{count:count+large.count};
}
