import SunCalc from './vendor/suncalc.js';
const rad=Math.PI/180;
// Inverse NZTM2000 (GRS80); game +X is grid east, +Z is grid south.
export function playerCoordinates(x,z){
 const a=6378137,f=1/298.257222101,e=f*(2-f),ep=e/(1-e),k=.9996;
 const M=(5430336.934044-z-10000000)/k,mu=M/(a*(1-e/4-3*e*e/64-5*e**3/256)),e1=(1-Math.sqrt(1-e))/(1+Math.sqrt(1-e));
 const p=mu+(3*e1/2-27*e1**3/32)*Math.sin(2*mu)+(21*e1**2/16-55*e1**4/32)*Math.sin(4*mu)+151*e1**3/96*Math.sin(6*mu)+1097*e1**4/512*Math.sin(8*mu);
 const c=ep*Math.cos(p)**2,t=Math.tan(p)**2,n=a/Math.sqrt(1-e*Math.sin(p)**2),r=a*(1-e)/(1-e*Math.sin(p)**2)**1.5,d=(1762931.140819+x-1600000)/(n*k);
 const lat=p-n*Math.tan(p)/r*(d*d/2-(5+3*t+10*c-4*c*c-9*ep)*d**4/24+(61+90*t+298*c+45*t*t-252*ep-3*c*c)*d**6/720);
 const lon=173*rad+(d-(1+2*t+c)*d**3/6+(5-2*c+28*t-3*c*c+8*ep+24*t*t)*d**5/120)/Math.cos(p);
 // Rotate true east/north to the NZTM grid axes.
 return {lat:lat/rad,lon:lon/rad,convergence:Math.atan(Math.tan(lon-173*rad)*Math.sin(lat))};
}
const formatter=new Intl.DateTimeFormat('en-NZ',{timeZone:'Pacific/Auckland',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
export function valleyTime(date){const p=Object.fromEntries(formatter.formatToParts(date).map(p=>[p.type,p.value]));return {date:`${p.year}-${p.month}-${p.day}`,hour:+p.hour+(+p.minute)/60+(+p.second)/3600};}
export function valleyInstant(date,hour){
 const target=Date.parse(date+'T00:00:00Z')+hour*3600000;let instant=target;
 for(let i=0;i<3;i++){const p=valleyTime(new Date(instant));instant+=target-(Date.parse(p.date+'T00:00:00Z')+p.hour*3600000);}
 return new Date(instant);
}
export function skyState(date,x,z){
 const observer=playerCoordinates(x,z),{lat,lon,convergence}=observer;
 const direction=p=>{const az=p.azimuth-convergence,c=Math.cos(p.altitude);return {x:-Math.sin(az)*c,y:Math.sin(p.altitude),z:Math.cos(az)*c};};
 const sun=SunCalc.getPosition(date,lat,lon),moon=SunCalc.getMoonPosition(date,lat,lon);
 return {observer,sun,moon,sunDirection:direction(sun),moonDirection:direction(moon),illumination:SunCalc.getMoonIllumination(date)};
}
export function solarTimes(date,x,z){const {lat,lon}=playerCoordinates(x,z);return SunCalc.getTimes(date,lat,lon);}
