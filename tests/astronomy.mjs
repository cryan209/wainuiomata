import assert from 'node:assert/strict';
import {playerCoordinates,skyState,valleyTime,valleyInstant,solarTimes} from '../dist/astronomy.js';
const p=playerCoordinates(0,0);
assert.ok(Math.abs(p.lat+41.261970)<.000001);assert.ok(Math.abs(p.lon-174.944987)<.000001);
for(const [date,hour] of [['2026-01-15',13.5],['2026-07-15',13.5],['2026-10-31',0],['2026-09-27',4]]){const t=valleyInstant(date,hour);assert.deepEqual(valleyTime(t),{date,hour});}
assert.equal(valleyInstant('2026-01-15',12).getUTCHours(),23);
assert.equal(valleyInstant('2026-07-15',12).getUTCHours(),0);
const summer=skyState(valleyInstant('2026-12-21',13),0,0),winter=skyState(valleyInstant('2026-06-21',12),0,0);
assert.ok(summer.sun.altitude>winter.sun.altitude+.6);assert.ok(summer.sunDirection.z<0,'Midday sun is north');
const morning=skyState(valleyInstant('2026-10-31',8),0,0),evening=skyState(valleyInstant('2026-10-31',18),0,0);
assert.ok(morning.sunDirection.x>0);assert.ok(evening.sunDirection.x<0);
for(const state of [summer,winter,morning,evening]){for(const v of [state.sunDirection,state.moonDirection])assert.ok(Math.abs(Math.hypot(v.x,v.y,v.z)-1)<1e-10);assert.ok(state.illumination.fraction>=0&&state.illumination.fraction<=1);}
assert.ok(Math.abs(morning.sunDirection.y+morning.moonDirection.y)>.05,'Moon is independent of the sun');
assert.notEqual(skyState(valleyInstant('2026-10-31',8),20000,-20000).sun.altitude,morning.sun.altitude);
const duration=date=>{const t=solarTimes(valleyInstant(date,12),0,0);return t.sunset-t.sunrise;};assert.ok(duration('2026-12-21')>duration('2026-06-21')+5*3600000);
assert.equal(valleyTime(new Date(+valleyInstant('2026-10-31',23.99)+120000)).date,'2026-11-01');
console.log('PASS: player coordinates, seasonal sun paths, east/west orientation, independent moon, NZ daylight saving, presets and date rollover');
// Exercise scene setup and all time controls without a WebGL renderer.
const T=await import('../dist/vendor/three.js');
const elements=new Map();
const element=()=>({value:'',textContent:'',setAttribute(){},addEventListener(type,fn){this[type]=fn;}});
const presets=[5.5,12,18.5,23].map(hour=>({...element(),dataset:{hour:String(hour)}}));
globalThis.document={querySelector(s){if(!elements.has(s))elements.set(s,element());return elements.get(s);},querySelectorAll(){return presets;},createElement(){return {getContext(){return {createRadialGradient(){return {addColorStop(){}};},fillRect(){}};}};}};
const {createDayNight}=await import('../dist/day-night.js');
const scene=new T.Scene();scene.fog=new T.Fog('#ffffff',10,1000);
const camera=new T.PerspectiveCamera(),sky=new T.Mesh(),sun=new T.DirectionalLight(),ambient=new T.HemisphereLight();
const cycle=createDayNight({scene,renderer:{toneMappingExposure:1},camera,sky,sun,ambient,windowMaterials:[]});
for(const button of presets){button.onclick();const lighting=cycle.update(1);assert.ok(Number.isFinite(lighting.day));}
const date=elements.get('#sky-date');date.value='2026-12-31';date.onchange();
const slider=elements.get('#time-slider');slider.value='1439';slider.input();
assert.equal(cycle.update(1).hour,23+59/60);
elements.get('#time-running').onclick();cycle.update(1);
assert.equal(date.value,'2027-01-01');cycle.skip();assert.ok(Number.isFinite(cycle.update(0).hour));
console.log('PASS: scene lighting, date picker, time slider, presets, pause/resume, skip and UI date rollover');
