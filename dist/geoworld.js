import {setCellSiteClearance} from './cell-site-clearance.js?v=cells-90';
import * as T from './vendor/three.js';
import {createPropertyFences} from './fences.js?v=low-end-1';
import {applyRoadImagery} from './road-imagery.js?v=intersections-50';
import {createGroundDetail} from './ground-detail.js?v=regional-ground-65';
import {applyGroundImagery} from './ground-imagery.js?v=regional-ground-65';
import {applyNightLight} from './night-lights.js?v=night-walls-73';
import {createTerrainStream} from './terrain-stream.js?v=low-end-2';
import {makeTextures} from './textures.js?v=large-houses-94';
import {createHydrology,createRoadNetwork} from './water-roads.js?v=low-end-3';
import {facadeProfile,facadeStyle,FACADE_COUNT} from './appearance.js?v=large-houses-94';
import {createTunnels} from './tunnels.js?v=perf-59';
import {addGreenery} from './greenery.js?v=static-1';
import {forestSampler,addHillsideForest} from './forest.js?v=static-1';
import {createFoliage} from './foliage.js?v=runtime-packs-113';
import {faceMapping,splitFacade} from './facade-mapping.js';
import {splitMeshByCell,weldVertices} from './spatial-split.js?v=paced-1';
import {createFacadeArray,mergeFacadeBatches} from './facade-array.js?v=paced-1';
import {createOpenSpaces} from './open-spaces.js';
import {createStreetIndex,buildingFaces,wallStyle,wallTextureScale} from './building-faces.js?v=large-houses-94';
import {addCanopies} from './canopies.js?v=low-end-3';
import {addSideWindows} from './side-windows.js?v=paced-1';
import {createRoofDetail} from './roof-detail.js?v=smooth-junctions-25';
import {createCoast} from './coast.js?v=boats-81';
import {createRegionStream} from './region-stream.js?v=low-end-3';
import {createRailways} from './railways.js?v=low-end-3';
import {assembleRegionalMap} from './regional-map.js?v=regions-1';
import {unpackTerrain,unpackFar} from './terrain-pack.js?v=runtime-packs-1';
import {createSurveyGround} from './world-ground.js?v=street-grades-1';
const fetchAsset=url=>fetch(url,{cache:'no-cache'});
const loadPhoto=url=>new T.TextureLoader().loadAsync(url);
const loadRegionalMap=async()=>{const index=await fetchAsset('./regional-map.json').then(r=>r.json());return assembleRegionalMap(index,await Promise.all(index.parts.map(p=>fetchAsset('./'+p.file).then(r=>r.json()))))};
const read=async(url,type)=>{const r=await fetchAsset(url);if(!r.ok)throw Error(`Could not load ${url}`);return new type(await r.arrayBuffer())};
export async function loadWorld(scene){
 // The regional terrain and distant buildings download as compact packs (scripts/pack_runtime.py, dist/terrain-pack.js).
 // Street grades are precomputed (scripts/pack_street_grades.mjs); ?solve-grades solves them here instead, and a missing pack falls back to that.
 const streetGradesPack=new URLSearchParams(location.search).has('solve-grades')?Promise.resolve(null):read('./street-grades.pack',Uint8Array).catch(()=>null);
 const regionalTerrainMeta=fetchAsset('./regional-terrain.json').then(r=>r.json()),regionalBuildingMeta=fetchAsset('./regional-buildings.json').then(r=>r.json());
 // Photographs start downloading with the data instead of one after another once it has all arrived.
 const roofImageryMeta=fetchAsset('./roof-imagery.json').then(r=>r.json()),wideImageryMeta=fetchAsset('./roof-imagery-wide.json').then(r=>r.json()),aerialPhoto=roofImageryMeta.then(m=>loadPhoto('./'+m.image)),widePhoto=wideImageryMeta.then(m=>loadPhoto('./'+m.image)),facadePhoto=new T.TextureLoader().loadAsync('./assets/facade-photo-atlas-v3.webp'),surfacePhoto=new T.TextureLoader().loadAsync('./assets/building-surfaces-v1.webp');
 const regionalGroundMeta=fetchAsset('./ground-regional.json').then(r=>r.ok?r.json():null).catch(()=>null),overviewPhotos=regionalGroundMeta.then(g=>g?Promise.all([loadPhoto('./'+g.overview.image),g.overviewOuter?loadPhoto('./'+g.overviewOuter.image):null]):[]);
 const [meta,coarse,fine,buildings,roofData,wallData,localMap,roofImagery,localWaterways,outerBuildings,wideImagery,forestMeta,forestData,openSpaceData,roofDetailMeta,regionalMeta,regionalPack,regionalMap,regionalWaterways,coastMeta,regionalForest,regionalBuildings,regionalFarPack,railData]=await Promise.all([fetchAsset('./geodata.json').then(r=>r.json()),read('./terrain.bin',Int32Array),read('./terrain-fine.bin',Int32Array),fetchAsset('./buildings.json').then(r=>r.json()),read('./building-roofs.bin',Float32Array),read('./building-walls.bin',Float32Array),fetchAsset('./map.json').then(r=>r.json()),roofImageryMeta,fetchAsset('./waterways.json').then(r=>r.json()),fetchAsset('./buildings-outer.json').then(r=>r.json()),wideImageryMeta,fetchAsset('./forest-mask.json').then(r=>r.json()),read('./forest-mask.bin',Uint8Array),fetchAsset('./open-spaces.json').then(r=>r.json()),fetchAsset('./roof-detail.json').then(r=>r.json()),regionalTerrainMeta,regionalTerrainMeta.then(m=>read('./'+m.packed.file,Uint8Array)),loadRegionalMap(),fetchAsset('./regional-waterways.json').then(r=>r.json()),fetchAsset('./regional-coast.json').then(r=>r.json()),read('./regional-forest.bin',Uint8Array),regionalBuildingMeta,regionalBuildingMeta.then(m=>read('./'+m.farPack.file,Uint8Array)),fetchAsset('./railways.json').then(r=>r.json())]);
 const regionalData=unpackTerrain(regionalPack,regionalMeta.width,regionalMeta.height);
 const {far:regionalFar,roof:regionalRoofFar}=unpackFar(regionalFarPack,regionalBuildings.farPack.count),cellSites=await fetchAsset('./cell-sites.json?v=cells-90').then(r=>r.json());setCellSiteClearance(cellSites.sites);
 const trafficControls=await fetchAsset('./traffic-controls.json').then(r=>r.json());const dogParks=await fetchAsset('./dog-parks.json?v=parks-105').then(r=>r.json());openSpaceData.features.push(...dogParks.features);
 const map={...regionalMap,controls:trafficControls.nodes,seaLevel:-meta.originElevation,elements:[...new Map([...localMap.elements,...regionalMap.elements].map(r=>[r.id,r])).values()]},waterways=[...new Map([...localWaterways,...regionalWaterways].map(r=>[r.id,r])).values()];
 const aerialTexture=await aerialPhoto;aerialTexture.colorSpace=T.SRGBColorSpace;aerialTexture.magFilter=T.LinearFilter;aerialTexture.minFilter=T.LinearMipmapLinearFilter;aerialTexture.anisotropy=4;
 const wideTexture=await widePhoto;wideTexture.colorSpace=T.SRGBColorSpace;wideTexture.magFilter=T.LinearFilter;wideTexture.minFilter=T.LinearMipmapLinearFilter;wideTexture.anisotropy=4;
 const [facadeAtlas,foliage,surfaceAtlas]=await Promise.all([facadePhoto,createFoliage(),surfacePhoto]);
 const datum=meta.originElevation,textures=makeTextures(facadeAtlas.image,surfaceAtlas.image),windowMaterials=[],photoMaterials=[],woodlandDensity=forestSampler(forestMeta,forestData),openSpaces=createOpenSpaces(openSpaceData),forestDensity=(x,z)=>{if(openSpaces.at(x,z)||!coast.isLand(x,z))return 0;const w=T.MathUtils.clamp(Math.min(3450-Math.abs(x),3450-Math.abs(z))/150,0,1);return woodlandDensity(x,z)*w+coast.density(x,z)*(1-w)},forestFloorTint=new T.Color('#526b4f');facadeAtlas.dispose();surfaceAtlas.dispose();
 let railways=null;
 const streets=createStreetIndex(map),roofDetail=createRoofDetail(scene,roofDetailMeta,photoMaterials);
 const originalGround=createSurveyGround({meta,coarse,fine,regional:regionalData,regionalMeta});
 function rawGround(x,z){const h=originalGround(x,z);return railways?railways.ground(x,z,h):h}
 railways=createRailways(scene,railData,{datum,textures,ground:originalGround});
 await globalThis.loadingStage?.('Coastline and harbour');
 const coast=await createCoast(scene,coastMeta,regionalForest,{ground:rawGround,datum});
 await globalThis.loadingStage?.('Rivers and streams');
 const hydro=createHydrology(scene,waterways,rawGround,{seaLevel:coast.seaLevel}),tunnels=createTunnels(scene,map,rawGround);
 // Regional photographs: a whole-region overview, then streamed 2m valley and 0.5m urban tiles (see prepare_regional_ground.py).
 const regionalGround=await regionalGroundMeta;let overviewLayer=[];
 if(regionalGround){const o=regionalGround.overview,texture=(await overviewPhotos)[0];texture.colorSpace=T.SRGBColorSpace;texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.anisotropy=4;overviewLayer=[{texture,bounds:o,fade:20,blank:true,detail:.35}];const e=regionalGround.overviewOuter;if(e){const outer=(await overviewPhotos)[1];outer.colorSpace=T.SRGBColorSpace;outer.minFilter=T.LinearMipmapLinearFilter;outer.anisotropy=4;overviewLayer.unshift({texture:outer,bounds:e,fade:150,blank:true,detail:.45})}}
 const groundDetail=createGroundDetail(await fetchAsset('./ground-detail.json').then(r=>r.json()),regionalGround);
 const aerialLayers=[...overviewLayer,{texture:wideTexture,bounds:wideImagery,fade:80},...groundDetail.valleyLayers,{texture:aerialTexture,bounds:roofImagery,fade:50},...groundDetail.layers];
 await globalThis.loadingStage?.('Roads, bridges and tunnels');
 const streetGrades=await streetGradesPack,network=createRoadNetwork(scene,map,hydro,rawGround,textures,tunnels?.applyTerrain,railways,{streetGrades,streamGeometry:{x:0,z:0,radius:1500},roadMaterialHook:(material,style)=>{if(style<5)applyRoadImagery(material,aerialLayers);applyNightLight(material)}}),{roads,nearest}=network;
 railways.setRoads(network.roads);
 const ground=(x,z)=>network.ground(x,z);
 await globalThis.loadingStage?.('Terrain');
 const terrain=createTerrainStream(scene,{bounds:regionalMeta,ground:(x,z)=>hydro.terrainGround(x,z,ground(x,z)),density:forestDensity,textures,materialHook:material=>{applyNightLight(material);tunnels?.applyTerrain(material);coast.applyTerrain(material);network.clipTerrain(material);railways.applyTerrain(material);applyGroundImagery(material,aerialLayers)}});
 await terrain.ensureAt(0,0);
 // Keep the surveyed meshes intact; vary only their surface appearance.
 const buildingCells=new Map();for(const b of buildings){const r=b.rings[0];b.paintBounds=[Math.min(...r.map(v=>v[0])),Math.min(...r.map(v=>v[1])),Math.max(...r.map(v=>v[0])),Math.max(...r.map(v=>v[1]))];b.profile=facadeProfile(b);b.faces=buildingFaces(b,streets);b.style=b.profile.style;for(let x=Math.floor(b.paintBounds[0]/30);x<=Math.floor(b.paintBounds[2]/30);x++)for(let z=Math.floor(b.paintBounds[1]/30);z<=Math.floor(b.paintBounds[3]/30);z++){const key=x+','+z;if(!buildingCells.has(key))buildingCells.set(key,[]);buildingCells.get(key).push(b)}}
 const contains=(b,x,z)=>{const r=b.paintBounds;if(x<r[0]-.04||z<r[1]-.04||x>r[2]+.04||z>r[3]+.04)return false;for(const ring of b.rings)for(let i=1;i<ring.length;i++){const a=ring[i-1],c=ring[i],dx=c[0]-a[0],dz=c[1]-a[1],t=T.MathUtils.clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1),0,1);if(Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)<.04)return true}return inside(b.rings[0],x,z)&&!b.rings.slice(1).some(r=>inside(r,x,z))};
 function detailedRoofs(){roofDetail.add(roofData);const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(roofData,3));const uv=new Float32Array(roofData.length/3*2);for(let i=0,j=0;i<roofData.length;i+=3,j+=2){uv[j]=(roofData[i]-roofImagery.minX)/(roofImagery.maxX-roofImagery.minX);uv[j+1]=(roofImagery.maxZ-roofData[i+2])/(roofImagery.maxZ-roofImagery.minZ)}g.setAttribute('uv',new T.BufferAttribute(uv,2));const material=new T.MeshBasicMaterial({map:aerialTexture,side:T.DoubleSide});photoMaterials.push(material);for(const part of splitMeshByCell(new T.Mesh(weldVertices(g),material),150))scene.add(part)}
 // Preserve surveyed wall vertices while cutting texture bays at real footprint corners.
 // Every facade style shares one texture array, so each wall mesh below is one draw per area instead of one per style.
 const facades=createFacadeArray(textures.walls.map(t=>t.image),textures.windowMasks.map(t=>t.image),{repeatFrom:44,bump:i=>i>=44&&i<60?[.014,.018,.014,.004,.010,.004,.018,.014][(i-44)%8]:0});textures.facades=facades;windowMaterials.push(facades.material(true),facades.material(false));
 textures.houseDetails=createFacadeArray([...textures.houseWindows,...textures.houseDoors].map(t=>t.image),[...textures.houseWindowMasks.map(t=>t.image),...textures.houseDoors.map(()=>null)],{color:'#dedfda',nightBrightness:.75});windowMaterials.push(textures.houseDetails.material());
 textures.sideDetails=createFacadeArray(textures.sideWindows.map(t=>t.image),textures.sideWindowMasks.map(t=>t.image),{size:256});windowMaterials.push(textures.sideDetails.material());
 function detailedWalls(){const batches=Array.from({length:FACADE_COUNT},()=>({p:[],uv:[],c:[]}));let previous=null;
  for(let i=0;i<wallData.length;i+=18){
   const get=j=>[wallData[i+j],wallData[i+j+1],wallData[i+j+2]],a=get(0),c=get(3),d=get(6),b=get(15),x=(a[0]+c[0])/2,z=(a[2]+c[2])/2;
   const building=previous&&contains(previous,x,z)?previous:(buildingCells.get(Math.floor(x/30)+','+Math.floor(z/30))||[]).find(v=>contains(v,x,z));previous=building;
   const base=building?building.ground-datum:Math.min(a[1],c[1]),face=faceMapping(building?.rings||[[[a[0],a[2]],[c[0],c[2]]]],x,z,building?.profile.flip||1),story=building?Math.min(3.4,Math.max(2.4,building.eave-building.ground)):3.4;
   for(const part of splitFacade([a,c,d,b],face,base,story)){
    const style=building?wallStyle(building.profile,building.id,building.faces.find(f=>f.id===face.id),part.bay,part.floor):0,batch=batches[style];
    for(let j=1;j<part.poly.length-1;j++)for(const point of [part.poly[0],part.poly[j],part.poly[j+1]]){batch.p.push(...point);batch.uv.push(...(style>=44?[face.u(point)*face.width/wallTextureScale(style),-(point[1]-base)/wallTextureScale(style)]:part.uv(point)));const shade=T.MathUtils.lerp(.85,1,Math.min(1,Math.max(0,(point[1]-base)/1.8)));batch.c.push(shade,shade,shade)}
   }
  }
  const g=mergeFacadeBatches(batches,true);if(g)for(const part of splitMeshByCell(new T.Mesh(g,facades.material(true)),100))scene.add(part);
 }
 detailedWalls();detailedRoofs();
 // The wider suburbs use the same official footprints with coarser LiDAR-derived heights.
 const wallBatches=Array.from({length:FACADE_COUNT},()=>({positions:[],uvs:[]})),roofBatch=[],roofUV=[];
 for(const b of outerBuildings){const ring=b.rings[0],p=ring.map(v=>new T.Vector2(v[0],-v[1]));const shape=new T.Shape(p);let floor=0;for(const [x,z] of ring)floor+=ground(x,z);floor/=ring.length;const h=b.height,profile=facadeProfile(b);b.profile=profile;b.faces=buildingFaces(b,streets);for(let i=1;i<ring.length;i++){const a=ring[i-1],c=ring[i],dx=c[0]-a[0],dz=c[1]-a[1],len=Math.hypot(dx,dz)||1,segments=Math.max(1,Math.round(len/5.5)),floors=Math.max(1,Math.ceil(h/3.4));for(let k=0;k<segments;k++)for(let f=0;f<floors;f++){const t0=k/segments,t1=(k+1)/segments,ax=a[0]+dx*t0,az=a[1]+dz*t0,bx=a[0]+dx*t1,bz=a[1]+dz*t1,bottom=f*3.4,top=Math.min(h,(f+1)*3.4),style=wallStyle(profile,b.id,b.faces.find(face=>face.id===i-1),profile.flip>0?k:segments-1-k,f),bucket=wallBatches[style];const points=[[ax,f===0?ground(ax,az)-.1:floor+bottom,az],[bx,f===0?ground(bx,bz)-.1:floor+bottom,bz],[bx,floor+top,bz],[ax,floor+top,az]];for(const j of [0,1,2,0,2,3]){const[x,y,z]=points[j];bucket.positions.push(x,y,z);if(style>=44)bucket.uvs.push(((x-a[0])*dx+(z-a[1])*dz)/len/wallTextureScale(style),-(y-floor)/wallTextureScale(style));else bucket.uvs.push(profile.flip>0?([0,3].includes(j)?0:1):([0,3].includes(j)?1:0),[0,1].includes(j)?1:0)}}}const rg=new T.ShapeGeometry(shape);rg.rotateX(-Math.PI/2);const non=rg.index?rg.toNonIndexed():rg;for(let i=0;i<non.attributes.position.array.length;i+=3){let x=non.attributes.position.array[i],z=non.attributes.position.array[i+2];roofBatch.push(x,floor+h,z);roofUV.push((x-wideImagery.minX)/(wideImagery.maxX-wideImagery.minX),(wideImagery.maxZ-z)/(wideImagery.maxZ-wideImagery.minZ))}rg.dispose();if(non!==rg)non.dispose();buildings.push({...b,ground:floor+datum,eave:floor+h+datum,ridge:floor+h+datum})}
 {const g=mergeFacadeBatches(wallBatches.map(b=>({p:b.positions,uv:b.uvs})));if(g)for(const part of splitMeshByCell(new T.Mesh(g,facades.material()),300))scene.add(part)}
 roofDetail.add(new Float32Array(roofBatch));roofDetail.finish();
 const canopies=addCanopies(scene,buildings,{ground,datum,textures}),sideWindows=addSideWindows(scene,buildings,{ground,datum,textures,windowMaterials});
 const outerRoofGeometry=new T.BufferGeometry();outerRoofGeometry.setAttribute('position',new T.Float32BufferAttribute(roofBatch,3));outerRoofGeometry.setAttribute('uv',new T.Float32BufferAttribute(roofUV,2));outerRoofGeometry.computeVertexNormals();const outerRoofMaterial=new T.MeshBasicMaterial({map:wideTexture,side:T.DoubleSide});photoMaterials.push(outerRoofMaterial);for(const part of splitMeshByCell(new T.Mesh(weldVertices(outerRoofGeometry),outerRoofMaterial),400))scene.add(part);
 const cells=new Map();for(const b of buildings){let r=b.rings[0];b.minX=Math.min(...r.map(p=>p[0]));b.maxX=Math.max(...r.map(p=>p[0]));b.minZ=Math.min(...r.map(p=>p[1]));b.maxZ=Math.max(...r.map(p=>p[1]));for(let i=Math.floor((b.minX-1)/25);i<=Math.floor((b.maxX+1)/25);i++)for(let j=Math.floor((b.minZ-1)/25);j<=Math.floor((b.maxZ+1)/25);j++){let key=i+','+j;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(b)}}
 function inside(r,x,z){let found=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const [xi,zi]=r[i],[xj,zj]=r[j];if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)found=!found}return found}
 function freeBuildings(x,z){if(!canopies.free(x,z))return false;for(const b of cells.get(Math.floor(x/25)+','+Math.floor(z/25))||[]){if(inside(b.rings[0],x,z)&&!b.rings.slice(1).some(r=>inside(r,x,z)))return false;for(const r of b.rings)for(let i=1;i<r.length;i++){const a=r[i-1],c=r[i],dx=c[0]-a[0],dz=c[1]-a[1],t=T.MathUtils.clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1),0,1);if(Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)<.35)return false}}return true}
 // Below a tunnel or underpass roof only its walls block; buildings, fences and other surface obstacles are overhead.
 function freeSpace(x,z,y,from){if(from&&!railways.canMove(x,z,y,from))return false;if(tunnels&&from&&!tunnels.canMove(x,z,y,from))return false;if(from&&y!==undefined&&network.underpassWall(x,z,y,from))return false;if(y!==undefined&&(network.underpass(x,z,y)||railways.underpass(x,z,y)))return true;return fences.free(x,z)&&freeBuildings(x,z)&&region.free(x,z)}
 function free(x,z,y,from){return freeSpace(x,z,y,from)&&(coast.isLand(x,z)||network.onBridge(x,z,y)||railways.onBridge(x,z)||railways.underpass(x,z,y)||tunnels?.at(x,z,y))&&(!hydro.waterAt(x,z)||network.onBridge(x,z,y)||railways.onBridge(x,z)||railways.underpass(x,z,y)||tunnels?.at(x,z,y))}
 function walkHeight(x,z,y){const below=y!==undefined&&(network.underpass(x,z,y)||railways.underpass(x,z,y));const station=below?null:region.walkHeight(x,z);if(station!==null&&(y===undefined||Math.abs(station-(y-2))<2))return station;const tunnel=y!==undefined?tunnels?.walkHeight(x,z,y):null;if(tunnel!==null&&tunnel!==undefined)return tunnel;const road=network.walkHeight(x,z,y),rail=railways.walkHeight(x,z,y);return rail===null||rail===undefined?road:y!==undefined&&Math.abs(road-(y-2))<=Math.abs(rail-(y-2))?road:rail}
 const fences=createPropertyFences(scene,{network,ground,hydro,coast,openSpaces,clear:(x,z)=>freeBuildings(x,z)&&region.free(x,z)});
 const fenceGroups=new Map();for(const b of buildings){const p=b.profile||facadeProfile(b),key='local-'+Math.floor(p.x/512)+','+Math.floor(p.z/512);if(!fenceGroups.has(key))fenceGroups.set(key,[]);fenceGroups.get(key).push(b)}for(const[id,parts]of fenceGroups)fences.addChunk(id,parts);
 await globalThis.loadingStage?.('Trees and bush');
 const greenery=addGreenery(scene,{ground,rawGround,network,hydro,freeBuildings,tunnels,foliage,openSpaces,coast,railways});const forest=addHillsideForest(scene,{density:forestDensity,ground,network,freeBuildings,tunnels,foliage,openSpaces,coast,railways,hydro});
 await globalThis.loadingStage?.('Wellington and Hutt buildings');
 const region=createRegionStream(scene,regionalBuildings,regionalFar,{ground,datum,textures,streets,network,coast,openSpaces,foliage,windowMaterials,photoMaterials,freeLocal:freeBuildings,railways,hydro,fences,roofFarData:regionalRoofFar});
 const regionalNearest=(x,z)=>{const hit=nearest(x,z);if(!coast.isLand(x,z)&&!network.onBridge(x,z))return{...hit,name:'Wellington Harbour'};if(hit.name!=='Wainuiomata'||Math.abs(x)<3150&&Math.abs(z)<3150)return hit;const place=[...coastMeta.places].sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z))[0];return{...hit,name:place?.name||'Hutt Valley'}};
 return{meta,cellSites,forestDensity,terrain,groundDetail,fences,ground:(x,z)=>coast.isLand(x,z)?ground(x,z):coast.seaLevel,rawGround,roads,buildings,nearest:regionalNearest,free,freeSpace,windowMaterials,photoMaterials,hydro,network,walkHeight,greenery,forest,tunnels,canopies,sideWindows,openSpaces,roofDetail,coast,region,foliage,railways,regionalMeta,places:coastMeta.places,bounds:regionalMeta.bounds};
}
