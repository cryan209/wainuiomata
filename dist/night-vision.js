import * as T from './vendor/three.js';
// Dark-adapted human vision. The pupil opens (more exposure), and in dim light rods take over from cones: colour drains away
// and blue-greens look brighter than reds (the Purkinje shift). Near street lights and windows the cones still work, so
// bright areas keep their colour. This runs inside tone mapping, so every lit material and the sky get it without an extra pass.
// Each program sees only toneMappingExposure, so the vision amount travels in it: exposure + 4 × (vision in 64 steps).
const STEPS=64,PUPIL=1.0,ROD_TINT=[.62,.82,1.15],ROD_GAIN=1.25;
T.ShaderChunk.tonemapping_pars_fragment=T.ShaderChunk.tonemapping_pars_fragment.replace('vec3 CustomToneMapping( vec3 color ) { return color; }',`vec3 CustomToneMapping( vec3 color ) {
	float visionSteps = floor( toneMappingExposure / 4.0 );
	float exposure = toneMappingExposure - visionSteps * 4.0;
	float vision = visionSteps / ${STEPS}.0;
	float photopic = dot( color, vec3( 0.2126, 0.7152, 0.0722 ) );
	float rods = dot( color, vec3( 0.05, 0.55, 0.40 ) );
	float mesopic = vision * ( 1.0 - smoothstep( 0.02, 0.35, photopic * exposure ) );
	color = mix( color, rods * vec3( ${ROD_TINT.map(v=>v.toFixed(2)).join(', ')} ) * ${ROD_GAIN.toFixed(2)}, mesopic );
	const mat3 ACESInputMat = mat3( vec3( 0.59719, 0.07600, 0.02840 ), vec3( 0.35458, 0.90834, 0.13383 ), vec3( 0.04823, 0.01566, 0.83777 ) );
	const mat3 ACESOutputMat = mat3( vec3( 1.60475, -0.10208, -0.00327 ), vec3( -0.53108, 1.10813, -0.07276 ), vec3( -0.07367, -0.00605, 1.07602 ) );
	color *= exposure / 0.6;
	color = ACESOutputMat * RRTAndODTFit( ACESInputMat * color );
	return saturate( color );
}`);
// The pupil's extra exposure for a vision amount; kept under 4 so it never spills into the encoded vision steps.
export const adaptedExposure=(exposure,vision)=>Math.min(3.99,exposure*(1+PUPIL*vision));
// The same rod/cone mix in JavaScript, for colours three.js applies after tone mapping (fog).
export function scotopic(color,vision,exposure){const photopic=.2126*color.r+.7152*color.g+.0722*color.b,rods=(.05*color.r+.55*color.g+.4*color.b)*ROD_GAIN,t=Math.min(1,Math.max(0,(photopic*exposure-.02)/.33)),m=vision*(1-t*t*(3-2*t));return color.setRGB(color.r+(rods*ROD_TINT[0]-color.r)*m,color.g+(rods*ROD_TINT[1]-color.g)*m,color.b+(rods*ROD_TINT[2]-color.b)*m,T.LinearSRGBColorSpace)}
export function installNightVision(renderer){
 renderer.toneMapping=T.CustomToneMapping;
 // Renders with the pupil open and rods mixed in by `vision` (0 day, 1 fully dark adapted), then restores the base exposure.
 return(scene,camera,vision)=>{const base=renderer.toneMappingExposure,v=Math.round(Math.min(1,Math.max(0,vision))*STEPS);renderer.toneMappingExposure=adaptedExposure(base,v/STEPS)+4*v;renderer.render(scene,camera);renderer.toneMappingExposure=base};
}
