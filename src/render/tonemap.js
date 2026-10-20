// Mikdash grade: AgX (three's Filament/Blender port) with a mild "punchy" look applied in AgX log space
// (ASC-CDL power + saturation, as Blender's "AgX Punchy" but gentler). Keeps AgX's graceful highlight
// roll-off on sunlit white marble while restoring the saturation that plain AgX drains from gold and fire.
// Installed into three's tonemapping chunk as CustomToneMapping, so the direct (low) path and the post
// path (MikdashGradeEffect in post.js) share exactly one curve. See docs/decisions/render.md.
import { ShaderChunk } from 'three';

export const LOOK = { power: 1.08, saturation: 1.35 };

const GLSL = /* glsl */`
#ifndef MIKDASH_AGX
#define MIKDASH_AGX
vec3 mikdashAgX( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;
	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );
	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	// look (ASC CDL in AgX space)
	float luma = dot( color, vec3( 0.2126, 0.7152, 0.0722 ) );
	color = pow( max( color, vec3( 0.0 ) ), vec3( ${LOOK.power.toFixed(3)} ) );
	luma = pow( max( luma, 0.0 ), ${LOOK.power.toFixed(3)} );
	color = luma + ${LOOK.saturation.toFixed(3)} * ( color - luma );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	return clamp( color, 0.0, 1.0 );
}
#endif
`;

const HOOK = 'vec3 CustomToneMapping( vec3 color ) { return color; }';

/** Patch three's tonemapping chunk once (before any program compiles). */
export function installGradeChunk() {
  const chunk = ShaderChunk.tonemapping_pars_fragment;
  if (chunk.includes('mikdashAgX')) return true;
  if (!chunk.includes(HOOK)) {
    console.warn('[render] tonemapping chunk changed; custom grade unavailable');
    return false;
  }
  // mkWBd: env's white-balance gain − 1 (partial adaptation to firelight in rooms; zero until env uploads it =
  // neutral), applied before the curve — the post path's grade effect applies the same gain (post.js)
  ShaderChunk.tonemapping_pars_fragment = chunk.replace(HOOK, `${GLSL}\nuniform vec3 mkWBd;\nvec3 CustomToneMapping( vec3 color ) { return mikdashAgX( color * ( 1.0 + mkWBd ) ); }`);
  return true;
}

