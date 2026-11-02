import * as T from './vendor/three.js';
import {streetLabel} from './street-furniture.js?v=low-end-3';
// Green advance direction signs on arterial junction approaches. Mapped OSM destination tags win; otherwise each exit is
// followed along the network to the suburb it leads into. Approaches with mapped turn:lanes get one column per lane.
const major=new Set(['motorway','trunk','primary','secondary','tertiary','motorway_link','trunk_link','primary_link','secondary_link','tertiary_link']);
const rank=r=>({motorway:7,trunk:6,primary:5,secondary:4,tertiary:3,motorway_link:3,trunk_link:3,primary_link:3,secondary_link:2,tertiary_link:2,unclassified:1,residential:1}[r.type]||0);
const centres=new Set(['Wellington','Lower Hutt','Upper Hutt','Petone','Eastbourne','Wainuiomata','Johnsonville','Tawa']),PX=.0056,GREEN='#0b6b45',list=v=>v?String(v).split(/[;|]/).map(s=>s.trim()).filter(Boolean):[];
const turnOf=token=>/left/.test(token)?'left':/right/.test(token)?'right':'through';
const dir=e=>({x:(e.to.x-e.from.x)/(e.length||1),z:(e.to.y-e.from.y)/(e.length||1)});
// Direction-specific tag on a way: plain key for one-way roads, :forward/:backward otherwise.
const directed=(r,reverse,key)=>r.oneway?r.tags[key]:r.tags[key+(reverse?':backward':':forward')]??(reverse?undefined:r.tags[key]);

export function planDirectionSigns(network,traffic,places=[],options={}){const {clear=()=>true,avoid=[]}=options;
 const {rules,nodes}=traffic,groupNodes=new Map();for(const [id,j]of rules.junctions){if(!groupNodes.has(j.group))groupNodes.set(j.group,new Set());groupNodes.get(j.group).add(String(id))}
 const placeAt=(x,z)=>{let best=null,d=Infinity;for(const p of places){const q=Math.hypot(p.x-x,p.z-z);if(q<d){d=q;best=p}}return best&&{name:best.name,d}};
 // Follow the most natural continuation (same street name, then road class, then straightest) for up to `reach` metres.
 function follow(start,reach){const path=[start.to],seen=new Set([String(start.fromId)]);let e=start,run=e.length,street=major.has(e.r.type)&&e.r.name||'',refs=new Set(list(e.r.tags.ref).filter(s=>/^SH/.test(s))),mapped=list(directed(e.r,e.reverse,'destination')),mappedRef=list(directed(e.r,e.reverse,'destination:ref'));
  let heading=dir(e);while(run<reach){seen.add(String(e.toId));const ring=e.r.tags.junction==='roundabout';if(!ring)heading=dir(e);const d=dir(e),outs=(nodes.get(String(e.toId))||[]).filter(o=>!seen.has(String(o.toId)));if(!outs.length)break;
   // On a roundabout, leave by the exit that best keeps the heading it was entered with.
   let best=null,score=-Infinity;for(const o of outs){const v=dir(o),round=o.r.tags.junction==='roundabout',s=ring?(round?.35:v.x*heading.x+v.z*heading.z)*4+rank(o.r)*.2:(o.r.name&&o.r.name===e.r.name?4:0)+rank(o.r)*.6+(v.x*d.x+v.z*d.z)*2;if(s>score){score=s;best=o}}e=best;run+=e.length;path.push(e.to);
   if(!street&&run<400&&major.has(e.r.type)&&e.r.name)street=e.r.name;if(run<350){if(!mapped.length)mapped=list(directed(e.r,e.reverse,'destination'));if(!mappedRef.length)mappedRef=list(directed(e.r,e.reverse,'destination:ref'))}if(run<1500)for(const s of list(e.r.tags.ref))if(/^SH/.test(s))refs.add(s)}
  return{path,run,street,mapped,refs:mappedRef.length?mappedRef.filter(s=>/^SH/.test(s)):[...refs]}}
 const pointAt=(path,origin,dist)=>{for(const p of path)if(Math.hypot(p.x-origin.x,p.y-origin.z)>=dist)return p;return path.at(-1)};
 function centre(path,home,origin){for(let k=0;k<path.length;k+=6){const q=path[k];if(Math.hypot(q.x-origin.x,q.y-origin.z)<1800)continue;for(const p of places)if(centres.has(p.name)&&p.name!==home&&Math.hypot(p.x-q.x,p.z-q.y)<1400)return p.name}return null}
 function inferred(path,home){let last=null;for(let k=0;k<path.length;k+=8){const p=placeAt(path[k].x,path[k].y);if(p&&p.name!==home&&p.d<2600)last=p}const end=path.at(-1),p=placeAt(end.x,end.y);return p&&p.name!==home&&p.d<2600?p:last}
 const plans=[],seen=new Set();
 for(const [id,j]of rules.junctions){if(j.branches<3)continue;const area=groupNodes.get(j.group);
  for(const e of j.entries){if(area.has(String(e.fromId))||!major.has(e.r.type)||e.r.tags.junction==='roundabout'||e.r.bridge||e.r.tunnel)continue;const d=dir(e),key=j.group.id+':'+Math.round(Math.atan2(d.x,d.z)*4);if(seen.has(key))continue;seen.add(key);
   // Junction area: the node's group plus any roundabout ring it sits on.
   const visited=new Set([String(e.toId)]),queue=[String(e.toId)];while(queue.length&&visited.size<60){const n=queue.shift();for(const o of nodes.get(n)||[]){const t=String(o.toId);if(!visited.has(t)&&(area.has(t)||o.r.tags.junction==='roundabout')){visited.add(t);queue.push(t)}}}
   let cx=0,cz=0;for(const n of visited){const p=(nodes.get(n)||[])[0]?.from||e.to;cx+=p.x;cz+=p.y}const origin={x:cx/visited.size,z:cz/visited.size},near=placeAt(origin.x,origin.z),home=near&&near.d<1800?near.name:null;let sides=0;
   const rows=new Map();
   for(const n of visited)for(const o of nodes.get(n)||[]){if(visited.has(String(o.toId))||o.r.tags.junction==='roundabout'||String(o.toId)===String(e.fromId))continue;const big=major.has(o.r.type)||o.r.tags.destination;const f=follow(o,big&&rank(o.r)>=4?12000:big?7000:4200),q=pointAt(f.path,origin,28),ox=q.x-origin.x,oz=q.y-origin.z,l=Math.hypot(ox,oz)||1,cross=(d.x*oz-d.z*ox)/l,dot=(d.x*ox+d.z*oz)/l,angle=Math.atan2(cross,dot);
    if(Math.abs(angle)>2.6)continue;const turn=Math.abs(angle)<.6?'through':angle<0?'left':'right';if(turn!=='through'&&major.has(o.r.type))sides++;let names=f.mapped.slice(0,3),fit=0;if(!names.length&&big){const p=inferred(f.path,home);if(p){names=[p.name];fit=p.d}const c=centre(f.path,home,origin);if(c&&!names.includes(c))names.push(c);if(!names.length&&f.street&&f.street!==e.r.name){names=[streetLabel(f.street)];fit=1e4}}if(!names.length&&!f.refs.length)continue;
    const row=rows.get(turn)||{turn,names:[],fit:{},refs:[],angle,mapped:false};for(const s of names){if(!row.names.includes(s))row.names.push(s);row.fit[s]=Math.min(row.fit[s]??Infinity,fit)}for(const s of f.refs)if(!row.refs.includes(s))row.refs.push(s);row.mapped||=!!f.mapped.length;rows.set(turn,row)}
   for(const a of rows.values())a.names=a.names.filter(n=>![...rows.values()].some(b=>b!==a&&b.fit[n]!==undefined&&(b.fit[n]<a.fit[n]||b.fit[n]===a.fit[n]&&b.turn==='through')));
   const shown=[...rows.values()].filter(r=>r.names.length||r.refs.length).sort((a,b)=>a.angle-b.angle);for(const r of shown){if(r.refs.length)r.names=r.names.filter(n=>!/^State Highway/.test(n));r.names=r.names.slice(0,r.mapped?3:2);r.refs=r.refs.slice(0,2)}
   if(!shown.length||shown.length===1&&shown[0].turn==='through'&&!shown[0].mapped&&!sides)continue;
   // Lane columns from turn:lanes (and destination:lanes) on the approach.
   const laneTag=directed(e.r,e.reverse,'turn:lanes'),tokens=laneTag?String(laneTag).split('|'):null,laneDest=directed(e.r,e.reverse,'destination:lanes')?.split('|');let lanes=null;
   if(tokens&&tokens.length>=2&&tokens.length<=5){lanes=tokens.map((t,k)=>{const turns=[...new Set((t||'through').split(';').map(s=>s==='none'||!s?'through':turnOf(s)))];const names=laneDest?.[k]?list(laneDest[k]):[...new Set(turns.flatMap(u=>rows.get(u)?.names||[]))].slice(0,2),refs=[...new Set(turns.flatMap(u=>rows.get(u)?.refs||[]))].slice(0,1);return{turns,names,refs}});if(!lanes.some(l=>l.names.length&&!l.turns.every(u=>u==='through'))&&!laneDest)lanes=null}
   // Post the board 30–55 m back along the approach way, on the left verge.
   const r=e.r,sj=e.reverse?r.cumulative[e.i]:r.cumulative[e.i+1],room=e.reverse?r.length-sj:sj;if(room<34)continue;const back=Math.min(55,room-4),s=e.reverse?sj+back:sj-back;let i=1;while(i<r.cumulative.length-1&&r.cumulative[i]<s)i++;
   const seg=r.cumulative[i]-r.cumulative[i-1]||1,t=(s-r.cumulative[i-1])/seg,a=r.p[i-1],b=r.p[i],px=a.x+(b.x-a.x)*t,pz=a.y+(b.y-a.y)*t,dx=(b.x-a.x)/seg*(e.reverse?-1:1),dz=(b.y-a.y)/seg*(e.reverse?-1:1);
   const width=lanes?lanes.length*250*PX:Math.min(4.6,Math.max(2.1,(130+Math.max(...shown.map(r=>Math.max(...r.names.map(n=>n.length*30))+(r.refs.length?110:0))))*PX)),height=lanes?(70+Math.max(...lanes.map(l=>Math.max(1,l.names.length)))*62+150)*PX:(30+shown.reduce((h,r)=>h+Math.max(1,r.names.length)*66+34,0))*PX;
   const off=r.width/2+.9+width/2,x=px+dz*off,z=pz-dx*off,y=network.height(r,i-1,t,px+dz*(r.width/2+.9),pz-dx*(r.width/2+.9));if(!Number.isFinite(y))continue;
   const posts=[-1,1].map(k=>({x:x-dz*k*(width/2-.2),z:z+dx*k*(width/2-.2)}));if(posts.some(p=>!clear(p.x,p.z,y+2)||(()=>{const h=network.at?.(p.x,p.z);return h&&h.d<h.r.width/2+.3&&Math.abs(network.height(h.r,h.i,h.t,p.x,p.z)-y)<2.5})()))continue;
   if([...avoid,...plans].some(p=>Math.hypot(p.x-x,p.z-z)<width/2+3))continue;
   plans.push({x,z,y,dx,dz,yaw:Math.atan2(-dx,-dz),width,height,posts,rows:shown,lanes,road:r.name,mapped:shown.some(r=>r.mapped)})}}
 return plans}

function arrow(p,cx,cy,angle,size){p.save();p.translate(cx,cy);p.rotate(angle);const w=size*.17;p.beginPath();p.moveTo(-w/2,size*.5);p.lineTo(-w/2,-size*.12);p.lineTo(-size*.3,-size*.12);p.lineTo(0,-size*.5);p.lineTo(size*.3,-size*.12);p.lineTo(w/2,-size*.12);p.lineTo(w/2,size*.5);p.closePath();p.fill();p.restore()}
const turnAngle={left:-Math.PI/2,through:0,right:Math.PI/2};
function shield(p,x,y,ref){const n=ref.replace(/^SH\s*/,''),w=86,h=74;p.save();p.translate(x,y);p.fillStyle='white';p.beginPath();p.moveTo(-w/2,-h/2);p.lineTo(w/2,-h/2);p.lineTo(w/2,h*.1);p.quadraticCurveTo(w/2,h*.42,0,h/2+4);p.quadraticCurveTo(-w/2,h*.42,-w/2,h*.1);p.closePath();p.fill();p.fillStyle='#c4161c';p.scale(.86,.84);p.fill();p.fillStyle='white';p.font='bold 44px Arial';p.textAlign='center';p.textBaseline='middle';p.fillText(n,0,-2,70);p.restore()}
export function drawDirectionSign(plan){if(typeof document==='undefined')return null;const W=Math.round(plan.width/PX),H=Math.round(plan.height/PX),c=document.createElement('canvas');c.width=W;c.height=H;const p=c.getContext('2d');
 p.fillStyle=GREEN;p.fillRect(0,0,W,H);p.strokeStyle='white';p.lineWidth=7;p.strokeRect(10,10,W-20,H-20);p.fillStyle='white';p.textBaseline='middle';
 if(plan.lanes){const col=W/plan.lanes.length;plan.lanes.forEach((l,k)=>{const x0=k*col;if(k){p.fillRect(x0-2,22,4,H-44)}p.font='bold 54px Arial';p.textAlign='center';let y=62;if(l.refs[0]){shield(p,x0+col/2,y,l.refs[0]);y+=78}for(const n of l.names){p.fillText(n,x0+col/2,y,col-30);y+=62}const ay=H-92;l.turns.forEach((u,m)=>arrow(p,x0+col/2+(l.turns.length>1?(m-(l.turns.length-1)/2)*34:0),ay,turnAngle[u],128))})}
 else{let y=28;for(const r of plan.rows){const lines=Math.max(1,r.names.length),h=lines*66+34,right=r.turn==='right';p.fillStyle='white';arrow(p,right?W-72:72,y+h/2,turnAngle[r.turn],96);p.font='bold 54px Arial';p.textAlign=right?'right':'left';let tx=right?W-140:140;if(r.refs[0]){shield(p,right?tx-43:tx+43,y+h/2,r.refs[0]);tx+=right?-104:104}r.names.forEach((n,m)=>p.fillText(n,tx,y+17+33+m*66,W-260-(r.refs.length?104:0)));y+=h;if(y<H-30){p.fillRect(26,y-2,W-52,3)}}}
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t}

export function createDirectionSigns(scene,network,traffic,places,options={}){
 const plans=planDirectionSigns(network,traffic,places,options),root=new T.Group();root.name='Direction signs';scene.add(root);const cells=new Map();
 for(const p of plans)for(const q of p.posts){const k=Math.floor(q.x/32)+','+Math.floor(q.z/32);if(!cells.has(k))cells.set(k,[]);cells.get(k).push({...q,y:p.y})}
 const postGeometry=new T.CylinderGeometry(.05,.06,1,8),postMaterial=new T.MeshLambertMaterial({color:'#8f9691'}),backMaterial=new T.MeshLambertMaterial({color:'#7d837f'}),live=new Map();let next=0,clock=0;
 function build(p){const g=new T.Group(),top=2.1+p.height;g.position.set(p.x,p.y,p.z);g.rotation.y=p.yaw;const face=new T.Mesh(new T.PlaneGeometry(p.width,p.height),new T.MeshLambertMaterial({map:drawDirectionSign(p),color:typeof document==='undefined'?GREEN:'white'}));face.position.y=2.1+p.height/2;const backing=new T.Mesh(face.geometry,backMaterial);backing.rotation.y=Math.PI;backing.position.set(0,face.position.y,-.02);g.add(face,backing);
  for(const k of [-1,1]){const post=new T.Mesh(postGeometry,postMaterial);post.scale.y=top-.1;post.position.set(k*(p.width/2-.2),(top-.1)/2,-.07);g.add(post)}root.add(g);return g}
 function drop(p,g){root.remove(g);g.children[0].material.map?.dispose();g.children[0].material.dispose();g.children[0].geometry.dispose();live.delete(p)}
 return{plans,update(camera,dt=0){clock+=dt;if(clock<next)return;next=clock+.25;let built=0;for(const p of plans){const d=Math.hypot(p.x-camera.x,p.z-camera.z),g=live.get(p);if(g&&d>650)drop(p,g);else if(!g&&d<450&&built<3){live.set(p,build(p));built++}}},
  free(x,z,y){for(let ix=-1;ix<=1;ix++)for(let iz=-1;iz<=1;iz++)for(const q of cells.get((Math.floor(x/32)+ix)+','+(Math.floor(z/32)+iz))||[])if((y===undefined||Math.abs(y-2-q.y)<4)&&Math.hypot(x-q.x,z-q.z)<.18)return false;return true},
  get stats(){return{signs:plans.length,mapped:plans.filter(p=>p.mapped).length,lanes:plans.filter(p=>p.lanes).length,live:live.size}}}}
