function inside(ring,x,z){let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])hit=!hit}return hit}
export function createOpenSpaces(data){
 const cells=new Map();for(const f of data.features){const r=f.rings[0],xs=r.map(p=>p[0]),zs=r.map(p=>p[1]);for(let x=Math.floor(Math.min(...xs)/100);x<=Math.floor(Math.max(...xs)/100);x++)for(let z=Math.floor(Math.min(...zs)/100);z<=Math.floor(Math.max(...zs)/100);z++){const key=x+','+z;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(f)}}
 function at(x,z){return(cells.get(Math.floor(x/100)+','+Math.floor(z/100))||[]).find(f=>inside(f.rings[0],x,z)&&!f.rings.slice(1).some(r=>inside(r,x,z)))}
 return{at,allows(x,z,radius=0){return![[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius]].some(([dx,dz])=>at(x+dx,z+dz))},count:data.features.length};
}
