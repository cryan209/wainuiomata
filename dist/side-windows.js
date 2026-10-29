import * as T from './vendor/three.js';
import {hash} from './appearance.js';
export function addSideWindows(scene,buildings,{ground,datum,textures,windowMaterials}){
 const batches=Array.from({length:8},()=>({p:[],uv:[]}));let count=0;
 for(const b of buildings){if(!b.profile||!b.faces)continue;const base=b.ground-datum,height=b.eave-b.ground,style=b.profile.shop?5:b.profile.style%8;
  for(const f of b.faces){if(f.front||f.length<3)continue;const bays=Math.max(1,Math.round(f.length/5.5)),dx=(f.b[0]-f.a[0])/f.length,dz=(f.b[1]-f.a[1])/f.length;
   for(let floor=0;floor<Math.ceil(height/3.4);floor++)for(let bay=0;bay<bays;bay++){if((hash(b.id)+f.id*31+bay+floor)%(b.profile.shop?5:3)!==0)continue;
    const t=(bay+.5)/bays,x=f.a[0]+dx*f.length*t+f.nx*.025,z=f.a[1]+dz*f.length*t+f.nz*.025,y=base+floor*3.4+1.65,w=Math.min(2.2,f.length/bays*.64),h=Math.min(1.4,(base+height-y-.15)*2);if(h<.7||y-h/2<ground(x,z)+.35)continue;
    const sign=b.profile.flip,points=[[x-dx*w/2*sign,y-h/2,z-dz*w/2*sign],[x+dx*w/2*sign,y-h/2,z+dz*w/2*sign],[x+dx*w/2*sign,y+h/2,z+dz*w/2*sign],[x-dx*w/2*sign,y+h/2,z-dz*w/2*sign]],batch=batches[style];
    for(const i of [0,1,2,0,2,3]){batch.p.push(...points[i]);batch.uv.push(...[[0,1],[1,1],[1,0],[0,0]][i])}count++;
   }
  }
 }
 for(let i=0;i<8;i++){const b=batches[i];if(!b.p.length)continue;const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(b.p,3));g.setAttribute('uv',new T.Float32BufferAttribute(b.uv,2));g.computeVertexNormals();const material=new T.MeshLambertMaterial({map:textures.sideWindows[i],color:'#d1d3d0',emissive:'#ffd7ab',emissiveMap:textures.sideWindowMasks[i],emissiveIntensity:0,side:T.DoubleSide});material.userData.nightBrightness=.85;windowMaterials.push(material);scene.add(new T.Mesh(g,material))}
 return{count};
}
