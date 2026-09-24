import * as THREE from 'three';

/** Weathering on authoritative surfaces only: no invented wall/roof volumes. */
export function buildingMaterial(color:number,kind:'plaster'|'wood'|'roof'):THREE.MeshStandardMaterial{
  const material=new THREE.MeshStandardMaterial({color,roughness:.96});
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 wallPoint;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nwallPoint=position;');
    shader.fragmentShader='varying vec3 wallPoint;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec3 p=wallPoint;float coarse=sin(p.x*2.9+sin(p.z*2.3))*sin(p.y*3.1+p.z);
      float grain=fract(sin(dot(floor(p*24.),vec3(12.989,78.233,34.52)))*43758.5453);
      float fade=1.-smoothstep(60.,250.,length(vViewPosition));
      diffuseColor.rgb*=.95+coarse*.045+(grain-.5)*.13*fade;
      ${kind==='plaster'?`vec2 brick=vec2(p.x+p.z,p.y)*vec2(1.8,4.);brick.x+=step(.5,fract(brick.y*.5))*.5;
      vec2 mortar=abs(fract(brick)-.5);float seam=smoothstep(.46,.495,max(mortar.x,mortar.y));
      float exposed=smoothstep(.55,.86,sin(p.x*.71+sin(p.y*.9))*sin(p.z*.57+p.y*.63));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.22,.18,.13)*(1.-seam*.28),exposed*.52);
      `:kind==='roof'?`vec2 sheets=abs(fract(p.xz*vec2(.8,2.2))-.5);
      diffuseColor.rgb*=1.-.22*smoothstep(.43,.5,max(sheets.x,sheets.y));
      `:`float joints=smoothstep(.47,.5,abs(fract((p.x+p.z)*3.)-.5));diffuseColor.rgb*=1.-joints*.28;`}
    `);
  };material.customProgramCacheKey=()=>`building-surface-${kind}`;return material;
}
