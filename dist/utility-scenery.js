// Illustrative verge equipment, anchored to the existing street network.
const hash=s=>{let n=2166136261;for(const c of String(s))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0};
const dimensions={telecom:[.82,1.22,.43],pillar:[.35,.74,.30],transformer:[1.40,1.28,.88],access:[.72,.035,.54],water:[.28,.035,.33]};
export function planUtilityScenery(poles,world){
 const result=[],cells=new Map(),network=world.network,poleCells=new Map();
 for(const p of poles){const key=Math.floor(p.x/20)+','+Math.floor(p.z/20);if(!poleCells.has(key))poleCells.set(key,[]);poleCells.get(key).push(p)}
 for(const p of poles){
  if(p.r.bridge||p.r.tags?.tunnel==='yes')continue;
  const seed=hash(p.name+':utility:'+Math.round(p.x)+':'+Math.round(p.z)),choice=seed%12;
  const kind=choice<3?'telecom':choice<5?'pillar':choice===5&&p.supply==='underground'?'transformer':choice===6?'access':choice===7?'water':null;
  if(!kind)continue;const [width,height,depth]=dimensions[kind],radius=Math.hypot(width,depth)/2,solid=height>.1,yaw=Math.atan2(p.nx,p.nz);
  const occupied=(x,z)=>{for(let ix=Math.floor((x-11)/20);ix<=Math.floor((x+11)/20);ix++)for(let iz=Math.floor((z-11)/20);iz<=Math.floor((z+11)/20);iz++)for(const q of cells.get(ix+','+iz)||[])if(Math.hypot(q.x-x,q.z-z)<10)return true;return false};
  for(const along of [3.5,-3.5,5,-5]){
   const outward=solid ? .90 : .85,x=p.x+p.dx*along+p.nx*outward,z=p.z+p.dz*along+p.nz*outward;
   if(occupied(x,z)||polesNear(x,z,poleCells,radius+1.0))continue;
   const y=world.walkHeight(x,z,network.height(p.r,p.i,p.t,x,z)+2),samples=[];let okay=Number.isFinite(y);
   for(const a of [-1,0,1])for(const b of [-1,0,1]){
    const sx=x+Math.cos(yaw)*a*(width/2+.18)+Math.sin(yaw)*b*(depth/2+.18),sz=z-Math.sin(yaw)*a*(width/2+.18)+Math.cos(yaw)*b*(depth/2+.18),floor=world.walkHeight(sx,sz,y+2),hit=network.at(sx,sz),rail=world.railways?.at(sx,sz,0);
    if(!Number.isFinite(floor)||!world.free(sx,sz,floor+.5)||world.hydro?.channel(sx,sz)||network.onBridge?.(sx,sz,floor+2)||network.junctionAt?.(sx,sz)||!hit||hit&&(hit.d<hit.r.width/2+.55||hit.d>hit.r.width/2+3.5)||rail&&rail.d<4)okay=false;
    samples.push(floor);
   }
   // A shallow plinth absorbs small verge unevenness; steep sites remain empty.
   if(!okay||Math.max(...samples)-Math.min(...samples)>(solid ? .18 : .025))continue;
   const item={id:'utility-'+p.id,kind,x,z,y:solid?Math.max(...samples):y,yaw,width,height,depth,radius,solid,pole:p};result.push(item);const key=Math.floor(x/20)+','+Math.floor(z/20);if(!cells.has(key))cells.set(key,[]);cells.get(key).push(item);break;
  }
 }
 return result;
}
function polesNear(x,z,poleCells,radius){
 for(let ix=Math.floor((x-radius)/20);ix<=Math.floor((x+radius)/20);ix++)for(let iz=Math.floor((z-radius)/20);iz<=Math.floor((z+radius)/20);iz++)for(const p of poleCells.get(ix+','+iz)||[])if(Math.hypot(p.x-x,p.z-z)<radius)return true;return false;
}
export function utilityContains(p,x,z,margin=.22){
 if(!p.solid)return false;const dx=x-p.x,dz=z-p.z;return Math.abs(dx*Math.cos(p.yaw)-dz*Math.sin(p.yaw))<p.width/2+margin&&Math.abs(dx*Math.sin(p.yaw)+dz*Math.cos(p.yaw))<p.depth/2+margin;
}
export function utilityDestinations(utilities,world){
 const candidates=utilities.filter(p=>p.kind==='telecom').sort((a,b)=>Math.hypot(a.x-431,a.z-637)-Math.hypot(b.x-431,b.z-637));
 for(const p of candidates)for(const distance of [5,7]){
  const x=p.x-Math.sin(p.yaw)*distance+Math.cos(p.yaw)*2,z=p.z-Math.cos(p.yaw)*distance-Math.sin(p.yaw)*2;
  if(!world.free(x,z,world.walkHeight(x,z)+2)||world.hydro?.channel(x,z))continue;
  return new Map([['verge-utilities',{name:'Verge utilities · Cabinet view',x,z,yaw:Math.atan2(x-p.x,z-p.z),pitch:-.20}]]);
 }
 return new Map();
}
export function renderUtilityScenery(p,part){
 const {x,y,z,yaw,width:w,height:h,depth:d}=p;
 const at=(u,v,f=0)=>[x+Math.cos(yaw)*u+Math.sin(yaw)*f,y+v,z-Math.sin(yaw)*u+Math.cos(yaw)*f];
 const box=(u,v,f,size,colour)=>part('box',at(u,v,f),size,colour,yaw);
 if(!p.solid){
  box(0,.008,0,[w+.10,.03,d+.10],'#81847c');box(0,.026,0,[w,.018,d],p.kind==='water'?'#c7a22e':'#454e4c');
  for(const u of [-.32,.32])box(u*w,.038,0,[.016,.008,d*.66],'#282f2d');
  if(p.kind==='water')box(0,.039,0,[.10,.008,.07],'#3b433c');
  else for(const f of [-.14,0,.14])box(0,.039,f,[w*.68,.008,.018],'#747e77');return;
 }
 box(0,-.06,0,[w+.16,.28,d+.16],'#8c9187');
 const shade=p.kind==='telecom'?'#526b54':p.kind==='transformer'?'#4b6054':'#646c64';
 box(0,h/2,0,[w,h,d],shade);box(0,h+.025,0,[w+.045,.05,d+.045],'#6c7b68');
 // Recessed front panels, hinges and handles face the street.
 for(const side of p.kind==='transformer'?[-1,1]:[0]){
  const u=side*w*.245,panelWidth=p.kind==='transformer'?w*.46:w*.89;
  box(u,h*.51,-d/2-.008,[panelWidth,h*.84,.016],'#3c5045');
  box(u,h*.51,-d/2-.019,[panelWidth-.032,h*.84-.032,.012],shade);
  box(u+panelWidth*.32,h*.49,-d/2-.038,[.025,.13,.025],'#bdc1ac');
  for(const v of [.22,.73])box(u-panelWidth*.43,h*v,-d/2-.028,[.028,.065,.02],'#8b9685');
 }
 if(p.kind!=='pillar')for(let row=0;row<5;row++)box(-w*.20,h*.20+row*.046,-d/2-.03,[w*.37,.017,.012],'#263d33');
 // A small weathered ID plate and electrical caution plate use shared geometry.
 box(w*.22,h*.79,-d/2-.033,[.13,.07,.016],'#c2c2a5');
 if(p.kind!=='telecom'){box(-w*.20,h*.66,-d/2-.035,[.11,.13,.015],'#d6b744');box(-w*.20,h*.66,-d/2-.046,[.025,.07,.008],'#343a31')}
}
