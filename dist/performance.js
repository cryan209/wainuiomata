// Average ms per frame for each loop section, slowest first, under the total.
function cpuLines(sections,frames){
 const rows=[...sections].map(([name,ms])=>[name,ms/Math.max(1,frames)]).sort((a,b)=>b[1]-a[1]),total=rows.reduce((t,r)=>t+r[1],0);
 return rows.length?`CPU ${total.toFixed(1)} ms/frame\n`+rows.map(([name,ms])=>`  ${ms.toFixed(1).padStart(4)}  ${name}`).join('\n')+'\n':'';
}
export function createPerformanceHUD({renderer,world,quality,culling}){
 const panel=document.createElement('div');panel.id='performance';panel.setAttribute('role','status');panel.style.cssText='display:none;position:fixed;left:24px;bottom:58px;z-index:30;background:#13252de8;color:#e5efd6;padding:10px 14px;font:12px/1.6 monospace;white-space:pre;pointer-events:none';document.body.append(panel);let visible=false,elapsed=0,frames=0,next=0;
 // CPU time per frame-loop section: begin() starts a frame, lap(name) charges the time since the last mark to name.
 const sections=new Map();let mark=0,timed=0;
 addEventListener('keydown',e=>{if(e.key.toLowerCase()==='p'&&!e.repeat&&!e.target.matches('input,select,textarea')){visible=!visible;panel.style.display=visible?'block':'none'}});
 return{
  begin(){mark=performance.now();timed++},
  lap(name){const now=performance.now();sections.set(name,(sections.get(name)||0)+now-mark);mark=now},
  update(dt){if(document.hidden||dt>.5)return;elapsed+=dt;frames++;const now=performance.now();if(now<next)return;next=now+1000;const fps=frames/Math.max(.001,elapsed),terrain=world.terrain.stats,region=world.region.stats;panel.textContent=`${fps.toFixed(0)} FPS · ${(elapsed/Math.max(1,frames)*1000).toFixed(1)} ms/frame\n${cpuLines(sections,timed)}${renderer.info.render.calls} draws · ${(renderer.info.render.triangles/1000).toFixed(0)}k triangles\n${culling?`Occluded ${culling.occlusion.stats.hidden} / ${culling.occlusion.stats.candidates} scenery · ${culling.occlusion.stats.instancesHidden} / ${culling.occlusion.stats.instances} cars & people · ${culling.farCull.stats.parked} beyond view\n`:''}Terrain ${terrain.tiles} tiles · ${terrain.queued} queued\nGround photos ${world.groundDetail?.stats.loaded||0} tiles\nScenery ${region.loaded} chunks · ${region.photos} roof photos\nTraffic ${world.traffic?.stats.moving||0} vehicles · ${world.traffic?.stats.nearby||0} nearby\nControls ${world.traffic?.stats.junctions||0} junctions · ${world.intersections?.stats.signals||0} signal approaches\nPeople ${world.people?.stats.walkers||0} walkers\nStreet furniture ${world.furniture?.stats.poles||0} poles · ${world.furniture?.stats.signs||0} signs · ${world.furniture?.stats.services||0} house leads\nUtilities ${world.furniture?.stats.utilities||0} cabinets / covers\nGraphics ${quality?(quality.auto?'auto · ':'')+quality.tier.id:'—'}\nP · hide performance`;elapsed=0;frames=0;timed=0;sections.clear()}};
}
