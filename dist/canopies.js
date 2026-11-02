import * as T from './vendor/three.js';
import {hash} from './appearance.js';
export function addCanopies(scene,buildings,{ground,datum,textures}){
 const batches=new Map(),posts=[],cells=new Map();let count=0;
 function quad(points,uv,key){if(!batches.has(key))batches.set(key,{p:[],uv:[]});const out=batches.get(key);for(const j of [0,1,2,0,2,3]){out.p.push(...points[j]);out.uv.push(...uv[j])}}
 for(const b of buildings){if(!b.profile?.shop||!b.faces)continue;const base=b.ground-datum;
  for(const f of b.faces){if(!f.front||f.length<4||!f.road)continue;const depth=Math.min(2.6,f.road.d-f.road.width/2-.7);if(depth<1.1)continue;
   const seed=hash(b.id),y=Math.max(base+2.65,Math.min(base+3.05,b.eave-datum-.2)),sloped=f.length<12&&seed%4===0,drop=sloped?.35:.08,roof=sloped?10+seed%2:8+seed%2,soffit=12+seed%2,a=[f.a[0],y,f.a[1]],c=[f.b[0],y,f.b[1]],d=[c[0]+f.nx*depth,y-drop,c[2]+f.nz*depth],e=[a[0]+f.nx*depth,y-drop,a[2]+f.nz*depth];
   quad([a,c,d,e],[[0,0],[f.length,0],[f.length,depth],[0,depth]],roof);
   const steps=Math.ceil(f.length/2);for(let j=0;j<steps;j++){const points=[];for(const [t,v]of [[j/steps,0],[(j+1)/steps,0],[(j+1)/steps,depth+.25],[j/steps,depth+.25]]){const x=a[0]+(c[0]-a[0])*t+f.nx*v,z=a[2]+(c[2]-a[2])*t+f.nz*v;points.push([x,ground(x,z)+.04,z])}quad(points,points.map(p=>[p[0]/3,p[2]/3]),19)}
   const down=p=>[p[0],p[1]-.17,p[2]];quad([down(e),down(d),down(c),down(a)],[[0,depth],[f.length,depth],[f.length,0],[0,0]],soffit);
   quad([e,d,down(d),down(e)],[[0,0],[f.length,0],[f.length,.17],[0,.17]],16+seed%3);
   quad([a,e,down(e),down(a)],[[0,0],[depth,0],[depth,.17],[0,.17]],16+seed%3);quad([d,c,down(c),down(d)],[[0,0],[depth,0],[depth,.17],[0,.17]],16+seed%3);
   const n=Math.max(1,Math.ceil((f.length-.8)/6));for(let j=0;j<=n;j++){const t=(.4+(f.length-.8)*j/n)/f.length,x=a[0]+(c[0]-a[0])*t+f.nx*(depth-.1),z=a[2]+(c[2]-a[2])*t+f.nz*(depth-.1),floor=ground(x,z),height=y-drop-floor-.17;if(height<2.1)continue;const post={x,z,y:floor+height/2,height};posts.push(post);const key=Math.floor(x/10)*65536+Math.floor(z/10);if(!cells.has(key))cells.set(key,[]);cells.get(key).push(post)}count++;
  }
 }
 for(const [key,b]of batches){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(b.p,3));g.setAttribute('uv',new T.Float32BufferAttribute(b.uv,2));g.computeVertexNormals();const material=new T.MeshLambertMaterial({map:key===19?textures.concrete:key<16?textures.buildingSurfaces[key]:null,color:key===19?'#b8bcb8':key<16?'#d0d2c9':['#75948b','#c6ad56','#9aaca7'][key-16],side:T.DoubleSide,polygonOffset:key===19,polygonOffsetFactor:-2,polygonOffsetUnits:-2});const surface=new T.Mesh(g,material);surface.userData.surface=key===19?'pavement':'canopy';scene.add(surface)}
 if(posts.length){const mesh=new T.InstancedMesh(new T.BoxGeometry(.13,1,.13),new T.MeshLambertMaterial({color:'#70867b'}),posts.length),dummy=new T.Object3D();for(let i=0;i<posts.length;i++){const p=posts[i];dummy.position.set(p.x,p.y,p.z);dummy.scale.set(1,p.height,1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix)}mesh.computeBoundingSphere();scene.add(mesh)}
 return{count,posts:posts.length,free(x,z){if(!posts.length)return true;const cx=Math.floor(x/10),cz=Math.floor(z/10);for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const p of cells.get((cx+dx)*65536+cz+dz)||[])if((x-p.x)**2+(z-p.z)**2<.0625)return false;return true}};
}
