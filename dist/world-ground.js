// Surveyed ground before railways, rivers and roads reshape it: the fine valley grid fades into the coarse grid (20m), which
// fades into the regional grid (100m). Shared by geoworld.js and scripts/pack_street_grades.mjs, which must grade streets on
// exactly the ground the game uses.
import * as T from './vendor/three.js';
export function createSurveyGround({meta,coarse,fine,regional,regionalMeta}){
 const datum=meta.originElevation;
 function sample(a,g,x,z){let u=T.MathUtils.clamp((x-g.minX)/g.step,0,g.width-1.000001),v=T.MathUtils.clamp((z-g.minZ)/g.step,0,g.height-1.000001),i=Math.floor(u),j=Math.floor(v),du=u-i,dv=v-j,k=j*g.width+i;return(du+dv<=1?a[k]+du*(a[k+1]-a[k])+dv*(a[k+g.width]-a[k]):a[k+g.width+1]+(1-du)*(a[k+g.width]-a[k+g.width+1])+(1-dv)*(a[k+1]-a[k+g.width+1]))/100-datum}
 const coarseGrid={...meta.terrain,width:meta.terrain.size,height:meta.terrain.size};
 const regionalHeight=(x,z)=>sample(regional,regionalMeta,x,z);
 function coarseHeight(x,z){const edge=Math.min(x-coarseGrid.minX,z-coarseGrid.minZ,coarseGrid.minX+(coarseGrid.width-1)*coarseGrid.step-x,coarseGrid.minZ+(coarseGrid.height-1)*coarseGrid.step-z);return edge<0?regionalHeight(x,z):T.MathUtils.lerp(regionalHeight(x,z),sample(coarse,coarseGrid,x,z),Math.min(1,edge/100))}
 return function surveyGround(x,z){let f=meta.fine;if(x<f.minX||z<f.minZ||x>f.minX+(f.width-1)*f.step||z>f.minZ+(f.height-1)*f.step)return coarseHeight(x,z);const edge=Math.min(x-f.minX,z-f.minZ,f.minX+(f.width-1)*f.step-x,f.minZ+(f.height-1)*f.step-z);return T.MathUtils.lerp(coarseHeight(x,z),sample(fine,f,x,z),Math.min(1,edge/20))}}
