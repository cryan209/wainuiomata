// Anchor complete facade bays to footprint corners, independent of mesh panel size.
export function faceMapping(rings,x,z,flip=1){
 let best=null,id=0;
 for(const ring of rings)for(let i=1;i<ring.length;i++,id++){
  const a=ring[i-1],b=ring[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(length<.001)continue;
  const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(length*length))),distance=Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);
  if(best&&best.distance<=distance)continue;
  const count=Math.max(1,Math.round(length/5.5)),width=length/count;
  best={id,distance,count,width,u:p=>{const v=((p[0]-a[0])*dx+(p[2]-a[1])*dz)/length/width;return flip>0?v:count-v}};
 }
 return best;
}
function clip(poly,value,level,above){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],va=value(a),vb=value(b),ia=above?va>=level:va<=level,ib=above?vb>=level:vb<=level;if(ia)out.push(a);if(ia!==ib){const t=(level-va)/(vb-va);out.push(a.map((v,j)=>v+(b[j]-v)*t))}}return out}
export function splitFacade(quad,face,base,storyHeight=3.4){
 const result=[],us=quad.map(face.u),min=Math.max(0,Math.floor(Math.min(...us)+1e-6)),max=Math.min(face.count-1,Math.floor(Math.max(...us)-1e-6)),top=Math.max(...quad.map(p=>p[1]));
 for(let bay=min;bay<=max;bay++){
  let strip=bay===0?quad:clip(quad,face.u,bay,true);if(bay<face.count-1)strip=clip(strip,face.u,bay+1,false);if(strip.length<3)continue;
  for(let floor=0;floor<Math.max(1,Math.ceil((top-base)/storyHeight));floor++){
   let poly=floor===0?strip:clip(strip,p=>p[1],base+floor*storyHeight,true);poly=clip(poly,p=>p[1],base+(floor+1)*storyHeight,false);if(poly.length<3)continue;
   result.push({poly,bay,floor,uv:p=>[Math.max(0,Math.min(1,face.u(p)-bay)),Math.max(0,Math.min(1,1-(p[1]-base-floor*storyHeight)/storyHeight))]});
  }
 }
 return result;
}
