// Era-inspired gameplay tuning, not certified factory specifications.
// mass kg, power kW, acceleration m/s², brake m/s², centre of gravity m.
const rows={
 commodore:[1400,125,4.3,8.0,'rwd',.98,.55,11,6],falcon:[1500,145,4.2,7.8,'rwd',.96,.57,10,6],
 skyline:[1450,180,6.0,9.3,'rwd',1.08,.48,14,6],corolla:[1000,70,3.5,7.8,'fwd',.94,.49,13,4],
 hilux:[1650,67,2.4,6.7,'4wd',.87,.85,8,4],legacy:[1450,110,4.1,8.4,'awd',1.03,.55,11,4],
 magna:[1490,105,3.3,7.8,'fwd',.96,.57,10,4],lancer:[1150,68,3.0,7.5,'fwd',.92,.55,11,4],
 'corolla-wagon':[1160,73,3.2,7.6,'fwd',.93,.56,11,4],caldina:[1320,92,3.7,8.0,'fwd',.98,.55,12,4],
 hiace:[1850,80,2.4,6.8,'rwd',.88,.92,8,4],l300:[1600,65,2.3,6.5,'rwd',.85,.94,7.5,4],
 'city-bus':[10500,170,1.45,5.7,'rwd',.85,1.25,6,6],'school-bus':[8200,145,1.65,5.8,'rwd',.87,1.16,6.5,6]
};
const profiles=new Map(Object.entries(rows).map(([id,[mass,power,acceleration,brake,drive,grip,cg,suspension,cylinders]])=>[id,Object.freeze({mass,power,acceleration,brake,drive,grip,cg,suspension,cylinders,maxSteer:id.includes('bus')?.55:.60,steerResponse:id==='skyline'?8:5.5,topSpeed:id==='skyline'?47:id==='hilux'?32:id==='hiace'||id==='l300'?33:id.includes('bus')?23:40})]));
export function handlingFor(model={}){return profiles.get(model.id)||{mass:model.bus?9500:1200,power:model.bus?230:110,acceleration:model.acceleration||7,brake:model.bus?5.8:8,drive:'rwd',grip:1,cg:model.bus?1.2:.55,suspension:model.bus?6:11,cylinders:4,maxSteer:.60,steerResponse:6,topSpeed:model.topSpeed||40}}
export function tyreSurface(world,x,z){const hit=world.network?.at?.(x,z);if(!world.network?.at)return{grip:1,rolling:.13,name:'road'};if(hit&&hit.d<((hit.r.pavementWidth||hit.r.width)/2+.2)){const type=hit.r.tags?.surface||hit.r.type;if(['gravel','fine_gravel','unpaved','compacted','track'].includes(type))return{grip:.65,rolling:.35,name:'gravel'};if(['dirt','ground','grass','sand','mud'].includes(type))return{grip:.48,rolling:.65,name:'loose ground'};return{grip:1,rolling:.13,name:'road'}}return{grip:.55,rolling:.65,name:'grass'}}
