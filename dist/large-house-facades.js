import * as T from './vendor/three.js';
import {hash} from './appearance.js?v=large-houses-94';
import {mergeFacadeBatches} from './facade-array.js?v=paced-1';
import {splitMeshByCell,smallDetail} from './spatial-split.js?v=paced-1';
export function planLargeHouseOpenings(b,{ground,datum}){
 if(!b.profile?.largeHouse||b.profile.shop||b.profile.industrial||b.railCanopy||!b.faces)return [];
 const base=b.ground-datum,height=b.eave-b.ground,stories=Math.max(1,Math.round(height/3.1)),story=height/stories,front=b.faces.filter(f=>f.front&&f.length>=4).sort((a,b)=>b.length-a.length||a.id-b.id)[0],result=[];
 for(const face of b.faces){if(face.length<2.7)continue;
  const count=Math.max(1,Math.floor((face.length-.7)/(face.front?3.2:3.7))),spacing=face.length/count,doorBay=Math.min(count-1,Math.floor(count*.66));
  for(let floor=0;floor<stories;floor++)for(let bay=0;bay<count;bay++){
   const door=face===front&&floor===0&&bay===doorBay;
   // Quiet side/rear walls retain occasional blank bays instead of a uniform window grid.
   if(!door&&!face.front&&(hash(b.id)+face.id*13+bay+floor)%4===0)continue;
   const t=(bay+.5)/count,x=face.a[0]+(face.b[0]-face.a[0])*t,z=face.a[1]+(face.b[1]-face.a[1])*t;
   const bottom=door?Math.max(base,ground(x+face.nx*.1,z+face.nz*.1))+.035:base+floor*story+.88,h=door?2.12:Math.min(1.42,story-1.15),w=door?1.02:Math.min(spacing-.7,face.front?2.1:1.65);
   if(h<.8||w<.8||bottom+h>base+height-.14||bottom<ground(x,z)+.2&&!door)continue;
   result.push({kind:door?'door':'window',face,x,z,bottom,width:w,height:h,floor,style:b.profile.style%8});
  }
 }
 return result;
}
export function addLargeHouseFacades(scene,buildings,{ground,datum,textures,windowMaterials}){
 const windows=Array.from({length:8},()=>({p:[],uv:[]})),doors=Array.from({length:8},()=>({p:[],uv:[]})),trim={p:[],c:[]};let count=0;
 function quad(batch,f,along,bottom,width,height,offset,colour){
  const dx=(f.b[0]-f.a[0])/f.length,dz=(f.b[1]-f.a[1])/f.length,x=f.a[0]+dx*along+f.nx*offset,z=f.a[1]+dz*along+f.nz*offset;
  const points=[[x-dx*width/2,bottom,z-dz*width/2],[x+dx*width/2,bottom,z+dz*width/2],[x+dx*width/2,bottom+height,z+dz*width/2],[x-dx*width/2,bottom+height,z-dz*width/2]];
  for(const i of [0,1,2,0,2,3]){batch.p.push(...points[i]);if(batch.uv)batch.uv.push(...[[0,1],[1,1],[1,0],[0,0]][i]);if(batch.c)batch.c.push(...colour)}
 }
 for(const b of buildings){const openings=planLargeHouseOpenings(b,{ground,datum});if(!openings.length)continue;
  for(const o of openings){const f=o.face,along=Math.hypot(o.x-f.a[0],o.z-f.a[1]);
   // Recess shadow, a photo of the joinery, then projecting head/sill trim.
   quad(trim,f,along,o.bottom-.035,o.width+.09,o.height+.09,.018,[.20,.23,.22]);
   quad((o.kind==='door'?doors:windows)[o.style],f,along,o.bottom,o.width,o.height,.035);
   const colour=b.profile.style%8===4?[.47,.39,.29]:[.77,.79,.74];
   quad(trim,f,along,o.bottom+o.height+.012,o.width+.13,.055,.065,colour);
   if(o.kind==='window')quad(trim,f,along,o.bottom-.055,o.width+.15,.065,.085,colour);
   count++;
  }
  for(const f of b.faces){const base=b.ground-datum,h=b.eave-b.ground;
   quad(trim,f,f.length/2,base+h-.105,f.length,.09,.028,[.46,.49,.45]);
   const centerGround=ground((f.a[0]+f.b[0])/2,(f.a[1]+f.b[1])/2);if(Math.abs(centerGround-base)<.25)quad(trim,f,f.length/2,base+.015,f.length,.20,.023,[.39,.41,.37]);
  }
 }
 // Joinery photos share textures.houseDetails (windows then doors, already in windowMaterials); both batches split by area.
 function add(g,material){if(!g)return;const m=new T.Mesh(g,material);m.name='Large house facade details';for(const part of smallDetail(splitMeshByCell(m,600)))scene.add(part)}
 const joinery=mergeFacadeBatches([...windows,...doors]);if(joinery)add(joinery,textures.houseDetails.material());
 if(trim.p.length){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(trim.p,3));g.setAttribute('color',new T.Float32BufferAttribute(trim.c,3));g.computeVertexNormals();add(g,new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide}))}
 return {count};
}
