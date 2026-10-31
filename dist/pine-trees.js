import * as T from './vendor/three.js';

// A complete unit-height pine, batched into one draw call with bark and needle colours.
let geometry;
export function pineGeometry(){
 if(geometry)return geometry;
 const positions=[],normals=[],colors=[];
 function part(g,x,y,z,sx,sy,sz,shade){
  g.scale(sx,sy,sz);g.translate(x,y,z);const flat=g.toNonIndexed(),p=flat.getAttribute('position'),n=flat.getAttribute('normal'),c=new T.Color(shade);
  positions.push(...p.array);normals.push(...n.array);for(let i=0;i<p.count;i++)colors.push(c.r,c.g,c.b);g.dispose();flat.dispose();
 }
 part(new T.CylinderGeometry(.022,.045,1,9),0,.36,0,1,.72,1,'#75604b');
 // Broad exposed roots and a long visible bole distinguish mature pines up close.
 for(let i=0;i<5;i++){const a=i*Math.PI*2/5;part(new T.ConeGeometry(.022,.12,4),Math.cos(a)*.026,.045,Math.sin(a)*.026,1,1,1,'#68543f')}
 for(let i=0;i<5;i++){const r=.22-i*.037,h=.29-i*.018;part(new T.ConeGeometry(r,h,9),0,.49+i*.092,0,1,1,.88+(i%2)*.12,['#304d35','#395b3b','#426440','#486c44','#507447'][i])}
 geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.computeBoundingSphere();return geometry;
}
export function createPines(count){const mesh=new T.InstancedMesh(pineGeometry(),new T.MeshLambertMaterial({vertexColors:true,flatShading:true}),count);mesh.name='Mature thick-trunk pines';return mesh}
