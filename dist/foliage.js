import * as T from './vendor/three.js';

// Crossed alpha-tested cards give small leaf silhouettes without transparent sorting.
export async function createFoliage(){
 const map=await new T.TextureLoader().loadAsync('./assets/foliage-crowns-v3.webp');
 map.colorSpace=T.SRGBColorSpace;map.magFilter=T.LinearFilter;map.minFilter=T.LinearMipmapLinearFilter;map.anisotropy=4;
 const positions=[],uv=[];
 function card(points){for(const i of [0,1,2,0,2,3]){positions.push(...points[i]);uv.push(...[[0,0],[1,0],[1,1],[0,1]][i])}}
 for(let i=0;i<3;i++){const a=i*Math.PI/3,x=Math.cos(a),z=Math.sin(a);card([[-x,-1,-z],[x,-1,z],[x,1,z],[-x,1,-z]])}
 // Overlapping canopy slices also hold their shape when viewed from the drone.
 for(const y of [-.22,.32])card([[-.86,y,-.86],[.86,y,-.86],[.86,y,.86],[-.86,y,.86]]);
 const base=new T.BufferGeometry();base.setAttribute('position',new T.Float32BufferAttribute(positions,3));base.setAttribute('uv',new T.Float32BufferAttribute(uv,2));base.computeVertexNormals();
 const time={value:0},wind={value:1},material=new T.MeshLambertMaterial({map,color:'#ffffff',alphaTest:.42,side:T.DoubleSide});
 material.onBeforeCompile=shader=>{shader.uniforms.foliageTime=time;shader.uniforms.foliageWind=wind;shader.vertexShader='attribute vec2 foliageTile;\nuniform float foliageTime;\nuniform float foliageWind;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvMapUv=(vMapUv+foliageTile)*.5;').replace('#include <begin_vertex>','#include <begin_vertex>\n#ifdef USE_INSTANCING\ntransformed.x+=sin(foliageTime*1.15+instanceMatrix[3].x*.17+instanceMatrix[3].z*.13)*.025*foliageWind*max(0.,position.y+.25);\n#endif');shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>','#include <normal_fragment_begin>\nnormal=normalize(mat3(viewMatrix)*vec3(0.,1.,0.));')};
 const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,map,alphaTest:.42,side:T.DoubleSide});depth.onBeforeCompile=material.onBeforeCompile;
 return{setWind(value){wind.value=value},mesh(count,seed=0){const geo=base.clone(),tiles=new Float32Array(count*2);for(let i=0;i<count;i++){const tile=(i+seed)%4;tiles[i*2]=tile%2;tiles[i*2+1]=1-Math.floor(tile/2)}geo.setAttribute('foliageTile',new T.InstancedBufferAttribute(tiles,2));const mesh=new T.InstancedMesh(geo,material,count);mesh.customDepthMaterial=depth;return mesh},update(){time.value=performance.now()*.001}};
}
