import {hash,facadeStyle} from './appearance.js?v=large-houses-94';
export function createStreetIndex(map){
 const cells=new Map();for(const r of map.elements){if(!['primary','secondary','tertiary','residential','unclassified','living_street','service','pedestrian'].includes(r.tags.highway)||r.tags.tunnel==='yes')continue;for(let i=1;i<r.geometry.length;i++){const a=r.geometry[i-1],b=r.geometry[i],segment={a,b,width:parseFloat(r.tags.width)||(['primary','secondary','tertiary'].includes(r.tags.highway)?11:r.tags.highway==='service'?4:7),name:r.tags.name||'',service:r.tags.highway==='service'};for(let x=Math.floor((Math.min(a.x,b.x)-90)/100);x<=Math.floor((Math.max(a.x,b.x)+90)/100);x++)for(let z=Math.floor((Math.min(a.z,b.z)-90)/100);z<=Math.floor((Math.max(a.z,b.z)+90)/100);z++){const k=x+','+z;if(!cells.has(k))cells.set(k,[]);cells.get(k).push(segment)}}}
 return{closest(x,z){let best=null;for(const s of cells.get(Math.floor(x/100)+','+Math.floor(z/100))||[]){const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,t=Math.max(0,Math.min(1,((x-s.a.x)*dx+(z-s.a.z)*dz)/(dx*dx+dz*dz||1))),px=s.a.x+t*dx,pz=s.a.z+t*dz,d=Math.hypot(px-x,pz-z),score=d+(s.service?12:0);if(!best||score<best.score)best={x:px,z:pz,d,width:s.width,name:s.name,score}}return best}};
}
export function buildingFaces(building,streets){
 const faces=[];let id=0;
 for(let r=0;r<building.rings.length;r++){const ring=building.rings[r];let area=0;for(let i=1;i<ring.length;i++)area+=ring[i-1][0]*ring[i][1]-ring[i][0]*ring[i-1][1];const sign=area>=0?1:-1;
  for(let i=1;i<ring.length;i++,id++){const a=ring[i-1],b=ring[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(length<.001)continue;const x=(a[0]+b[0])/2,z=(a[1]+b[1])/2,nx=dz/length*sign,nz=-dx/length*sign,road=streets.closest(x,z),facing=road?((road.x-x)*nx+(road.z-z)*nz)/Math.max(.01,road.d):-1;faces.push({id,a,b,length,nx,nz,road,front:false,eligible:r===0&&facing>.45&&road.d<75,score:road?road.score+(1-facing)*10:Infinity})}
 }
 const candidates=faces.filter(f=>f.eligible).sort((a,b)=>a.score-b.score);for(const f of candidates.slice(0,2))if(f.score<=candidates[0].score+12)f.front=true;
 if(!faces.some(f=>f.front)){const fallback=[...faces].sort((a,b)=>a.score-b.score||b.length-a.length)[0];if(fallback)fallback.front=true}
 return faces;
}
export function wallStyle(profile,id,face,bay,floor){
 if(profile.industrial)return 60+hash(id)%2;
 if(profile.largeHouse&&!profile.shop)return 44+profile.style;
 if(!face||face.front)return facadeStyle(profile,id,(face?.id||0)*31+bay,floor?4:0);
 // Side/rear cladding stays continuous; inset window overlays are added separately.
 return profile.shop?60+hash(id)%2:44+profile.style;
}

export function wallTextureScale(style){return style>=60?(style===60?2:1):[.9,.75,.9,2,.9,2,.75,.9][(style-44)%8]}
