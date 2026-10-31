import * as T from './vendor/three.js';

// Shared, streamed lining for mapped rail bores and named road/trail tunnels.
// Dimensions, masonry and fittings are illustrative; alignments come from OSM.
export function createTunnelScenery(scene,definitions){
 const chunks=new Map(),loaded=new Map(),cells=new Map(),segments=[],portals=[];
 const lining=new T.MeshBasicMaterial({color:'#8b9391',vertexColors:true,side:T.DoubleSide}),trim=new T.MeshBasicMaterial({color:'#858e8d',side:T.DoubleSide}),lamp=new T.MeshBasicMaterial({color:'#fff1c9',toneMapped:false});
 const add=(x,z,item)=>{const key=Math.floor(x/512)+','+Math.floor(z/512);if(!chunks.has(key))chunks.set(key,{key,x:(Math.floor(x/512)+.5)*512,z:(Math.floor(z/512)+.5)*512,items:[]});chunks.get(key).items.push(item);};
 for(const d of definitions){
  d.length=0;d.points[0].s=0;
  for(let i=1;i<d.points.length;i++){const a=d.points[i-1],b=d.points[i],length=Math.hypot(b.x-a.x,b.z-a.z);d.length+=length;b.s=d.length;if(length<.001)continue;
   const count=Math.max(1,Math.ceil(length/12));
   for(let j=0;j<count;j++){
    const point=t=>({x:T.MathUtils.lerp(a.x,b.x,t),y:T.MathUtils.lerp(a.y,b.y,t),z:T.MathUtils.lerp(a.z,b.z,t),s:T.MathUtils.lerp(a.s,b.s,t)}),p=point(j/count),q=point((j+1)/count),len=length/count;
    const s={a:p,b:q,dx:q.x-p.x,dz:q.z-p.z,len,d,first:i===1&&j===0,last:i===d.points.length-1&&j===count-1};
    segments.push(s);add((p.x+q.x)/2,(p.z+q.z)/2,{segment:s});
    if(d.rail)for(let ix=Math.floor((Math.min(p.x,q.x)-d.half-1)/50);ix<=Math.floor((Math.max(p.x,q.x)+d.half+1)/50);ix++)for(let iz=Math.floor((Math.min(p.z,q.z)-d.half-1)/50);iz<=Math.floor((Math.max(p.z,q.z)+d.half+1)/50);iz++){
     const key=ix+','+iz;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(s);
    }
   }
  }
  for(const [p,q,sign]of [[d.points[0],d.points[1],-1],[d.points.at(-1),d.points.at(-2),1]]){
   const len=Math.hypot(q.x-p.x,q.z-p.z)||1,dx=(q.x-p.x)/len,dz=(q.z-p.z)/len;
   const portal={p,dx,dz,d,sign};portals.push(portal);add(p.x,p.z,{portal});
  }
 }
 function projection(s,x,z){const t=((x-s.a.x)*s.dx+(z-s.a.z)*s.dz)/(s.len*s.len),u=T.MathUtils.clamp(t,0,1),distance=Math.hypot(x-s.a.x-s.dx*u,z-s.a.z-s.dz*u);return{s,t,distance,floor:T.MathUtils.lerp(s.a.y,s.b.y,u),along:T.MathUtils.lerp(s.a.s,s.b.s,t)};}
 function at(x,z,y){if(y===undefined)return null;let best=null;for(const s of cells.get(Math.floor(x/50)+','+Math.floor(z/50))||[]){const hit=projection(s,x,z);if(hit.t<0&&s.first||hit.t>1&&s.last||hit.distance>s.d.half-.2||y<hit.floor-.7||y>hit.floor+s.d.height-.1)continue;if(!best||hit.distance<best.distance)best={...hit,roof:hit.floor+s.d.height,name:s.d.name};}return best;}
 function canMove(x,z,y,from){const current=at(from.x,from.z,y);if(!current)return true;let best=null;for(const s of segments){if(s.d!==current.s.d)continue;const h=projection(s,x,z);if(!best||h.distance<best.distance)best=h;}return !best||best.along<0||best.along>current.s.d.length||best.distance<current.s.d.half-.35;}
 const uniforms={boreSegments:{value:Array.from({length:24},()=>new T.Vector4())},boreHeights:{value:Array.from({length:24},()=>new T.Vector4(0,0,-1,0))}};
 function applyTerrain(material){const previous=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material),prior=key();material.onBeforeCompile=(shader,renderer)=>{previous?.call(material,shader,renderer);Object.assign(shader.uniforms,uniforms);shader.vertexShader='varying vec3 boreWorld;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nboreWorld=(modelMatrix*vec4(position,1.)).xyz;');shader.fragmentShader='varying vec3 boreWorld;uniform vec4 boreSegments[24];uniform vec4 boreHeights[24];\n'+shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
 for(int k=0;k<24;k++){vec4 h=boreHeights[k];if(h.z<0.)continue;vec4 s=boreSegments[k];vec2 delta=s.zw-s.xy;float len=length(delta);vec2 axis=delta/max(len,.001),rel=boreWorld.xz-s.xy;float along=dot(rel,axis),side=abs(rel.x*axis.y-rel.y*axis.x);float floor=mix(h.x,h.y,clamp(along/len,0.,1.));if(along>0.&&along<len&&side<h.z&&boreWorld.y<floor+h.w+.7&&boreWorld.y>floor-3.)discard;}
`);};material.customProgramCacheKey=()=>prior+'|rail-bores-v1';}
 function build(c){
  const shell=[],colors=[],frames=[],lights=[],group=new T.Group();group.name='Mapped tunnel '+c.key;
  const quad=(array,p)=>{for(const i of [0,1,2,0,2,3])array.push(...p[i]);};
  for(const item of c.items){
   if(item.segment){const s=item.segment,d=s.d,nx=s.dz/s.len,nz=-s.dx/s.len,wall=Math.max(2,d.height*.55),profile=[[-d.half,0],[-d.half,wall]];
    for(let i=1;i<=12;i++){const t=Math.PI-i*Math.PI/12;profile.push([Math.cos(t)*d.half,wall+Math.sin(t)*(d.height-wall)]);}profile.push([d.half,0]);
    const v=(p,side,h)=>[p.x+nx*side,p.y+h,p.z+nz*side];
    if(d.rail){quad(shell,[v(s.a,-d.half,-.03),v(s.b,-d.half,-.03),v(s.b,d.half,-.03),v(s.a,d.half,-.03)]);for(let k=0;k<6;k++)colors.push(.4,.42,.4);}
    for(let j=1;j<profile.length;j++){const a=profile[j-1],b=profile[j];quad(shell,[v(s.a,...a),v(s.b,...a),v(s.b,...b),v(s.a,...b)]);const brightness=(j<3||j>12?.7:.46)*(.78+.22*Math.cos(s.a.s*.15));for(let k=0;k<6;k++)colors.push(brightness,brightness*1.03,brightness);}
    if(Math.floor(s.a.s/24)!==Math.floor(s.b.s/24)){
     const p=s.b;for(let j=1;j<profile.length;j++){const a=profile[j-1],b=profile[j],back={...p,x:p.x-s.dx/s.len*.16,z:p.z-s.dz/s.len*.16};quad(frames,[v(p,a[0]*.98,a[1]*.99),v(back,a[0]*.98,a[1]*.99),v(back,b[0]*.98,b[1]*.99),v(p,b[0]*.98,b[1]*.99)]);}
     const y=d.height-.16;quad(lights,[v(p,-.25,y),v({...p,x:p.x-s.dx/s.len*.7,z:p.z-s.dz/s.len*.7},-.25,y),v({...p,x:p.x-s.dx/s.len*.7,z:p.z-s.dz/s.len*.7},.25,y),v(p,.25,y)]);
    }
   }else{
    const {p,dx,dz,d}=item.portal,nx=dz,nz=-dx,wall=Math.max(2,d.height*.55),v=(side,h)=>[p.x+nx*side,p.y+h,p.z+nz*side];
    for(let j=0;j<12;j++){const a=Math.PI-j*Math.PI/12,b=Math.PI-(j+1)*Math.PI/12;quad(frames,[v(Math.cos(a)*d.half,wall+Math.sin(a)*(d.height-wall)),v(Math.cos(a)*(d.half+.5),wall+Math.sin(a)*(d.height-wall+.5)),v(Math.cos(b)*(d.half+.5),wall+Math.sin(b)*(d.height-wall+.5)),v(Math.cos(b)*d.half,wall+Math.sin(b)*(d.height-wall))]);}
    for(const side of [-1,1])quad(frames,[v(side*d.half,0),v(side*(d.half+.5),0),v(side*(d.half+.5),wall),v(side*d.half,wall)]);
    if(d.ground)for(let k=0;k<4;k++){const point=(t,side)=>{const x=p.x-dx*t+nx*side,z=p.z-dz*t+nz*side;return[x,t===0?p.y+.015:d.ground(x,z)+.17,z];};quad(shell,[point(k*3,-d.half),point((k+1)*3,-d.half),point((k+1)*3,d.half),point(k*3,d.half)]);for(let j=0;j<6;j++)colors.push(.4,.42,.4);}
   }
  }
  for(const [points,material,surface]of [[shell,lining,'tunnel-lining'],[frames,trim,'tunnel-portals'],[lights,lamp,'tunnel-lamps']]){if(!points.length)continue;const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points,3));if(material===lining)g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();const mesh=new T.Mesh(g,material);mesh.userData.surface=surface;group.add(mesh);}
  scene.add(group);loaded.set(c.key,{...c,group});
 }
 let next=0;
 function update(camera){if(performance.now()<next)return;next=performance.now()+100;
  const nearby=segments.filter(s=>s.d.rail).map(s=>({s,d:Math.hypot((s.a.x+s.b.x)/2-camera.x,(s.a.z+s.b.z)/2-camera.z)})).sort((a,b)=>a.d-b.d).slice(0,24);
  for(let i=0;i<24;i++){const s=nearby[i]?.s;if(s){uniforms.boreSegments.value[i].set(s.a.x,s.a.z,s.b.x,s.b.z);uniforms.boreHeights.value[i].set(s.a.y,s.b.y,s.d.half+.15,s.d.height);}else uniforms.boreHeights.value[i].z=-1;}
  for(const [key,c]of loaded)if(Math.hypot(c.x-camera.x,c.z-camera.z)>2100){scene.remove(c.group);c.group.traverse(o=>o.geometry?.dispose());loaded.delete(key);}
  const c=[...chunks.values()].filter(c=>!loaded.has(c.key)&&Math.hypot(c.x-camera.x,c.z-camera.z)<1600).sort((a,b)=>Math.hypot(a.x-camera.x,a.z-camera.z)-Math.hypot(b.x-camera.x,b.z-camera.z))[0];if(c)build(c);
 }
 return{definitions,portals,at,canMove,applyTerrain,update,clearPortal(x,z){return portals.some(p=>Math.hypot(x-p.p.x,z-p.p.z)<p.d.half+12);},get stats(){return{tunnels:definitions.length,chunks:loaded.size};}};
}

export function namedRoadTunnels(scene,network){return createTunnelScenery(scene,network.roads.filter(r=>r.tunnel&&r.name&&!r.fullyShared&&r.length>40).map(r=>({id:r.id,name:r.name,rail:false,half:Math.max(.4,r.pavementWidth/2-.1),height:r.headroom-.16,ground:network.ground,points:r.p.map((p,i)=>({x:p.x,z:p.y,y:network.height(r,Math.min(i,r.p.length-2),i===r.p.length-1?1:0,p.x,p.y)}))})));}
