import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import * as T from '../dist/vendor/three.js';
import {createHydrology,createRoadNetwork} from '../dist/water-roads.js';
import {mapSource} from './lib/map-source.mjs';
export function auditTrackRises(){
const paths=new Set(['track','path','footway','cycleway','bridleway','pedestrian','steps']),source=mapSource(),hydro=createHydrology(new T.Scene(),source.waterways,source.raw,{seaLevel:-source.meta.originElevation});
const make=elements=>createRoadNetwork(new T.Scene(),{bounds:source.bounds,elements,seaLevel:-source.meta.originElevation},hydro,source.raw,{},null,source.railways,{buildGeometry:false});
const all=make(source.elements),structuralPaths=new Set(all.roads.filter(r=>paths.has(r.type)&&(r.bridge||r.tunnel||r.clearances?.length||r.underpasses?.length||r.sharedSegments.size)).map(r=>r.id.slice(0,r.id.lastIndexOf('-')))),streets=make(source.elements.filter(e=>!paths.has(e.tags.highway)||structuralPaths.has(String(e.id)))),byId=new Map(streets.roads.map(r=>[r.id,r])),findings=[];let count=0,maximum=0;
for(const r of all.roads){const baseline=byId.get(r.id);if(!baseline||r.bridge||paths.has(r.type))continue;let best=null;for(let i=0;i<r.p.length-1;i++){const row=r.gradeProfiles?.[i];if(!row)continue;const a=r.p[i],b=r.p[i+1];for(let j=0;j<row.length;j++){const t=j/(row.length-1),x=a.x+(b.x-a.x)*t,z=a.y+(b.y-a.y)*t,streetOnly=streets.height(baseline,i,t,x,z),lift=row[j]-streetOnly;count++;maximum=Math.max(maximum,lift);if(!best||lift>best.lift)best={x,z,lift,terrain:source.raw(x,z),height:row[j],streetOnly}}}if(best&&best.lift>.25)findings.push({name:r.name||'(unnamed '+r.type+')',id:r.id,type:r.type,...best})}
findings.sort((a,b)=>b.lift-a.lift);const report={roads:all.roads.length,streetSamples:count,maximumTrackLift:maximum,findings};return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(fs.realpathSync(process.argv[1])).href){const report=auditTrackRises();console.log(JSON.stringify({...report,findings:report.findings.slice(0,15)},null,2));if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n')}

