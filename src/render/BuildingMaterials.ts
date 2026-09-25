import * as THREE from 'three';

/** Weathering on authoritative surfaces only: no invented wall/roof volumes. */
export function buildingMaterial(color:number,kind:'plaster'|'brick'|'stone'|'wood'|'roof'):THREE.MeshStandardMaterial{
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
      ${['plaster','brick','stone'].includes(kind)?`vec2 brick=vec2(p.x+p.z,p.y)*vec2(${kind==='stone'?'1.45,2.4':'3.1,5.8'});brick.x+=step(.5,fract(brick.y*.5))*.5;
      vec2 mortar=abs(fract(brick)-.5);float seam=smoothstep(.46,.495,max(mortar.x,mortar.y));
      float exposed=smoothstep(.55,.86,sin(p.x*.71+sin(p.y*.9))*sin(p.z*.57+p.y*.63));
      ${kind==='plaster'?'diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.22,.18,.13)*(1.-seam*.28),exposed*.52);':'float blockShade=fract(sin(dot(floor(brick),vec2(45.2,19.8)))*3728.1);diffuseColor.rgb*=1.-seam*.32*fade+(blockShade-.5)*.16*fade;'}
      `:kind==='roof'?`vec2 tile=p.xz*vec2(2.6,3.8);tile.x+=mod(floor(tile.y),2.)*.5;
      vec2 joints=abs(fract(tile)-.5);float seam=smoothstep(.43,.49,max(joints.x,joints.y));
      float tileShade=fract(sin(dot(floor(tile),vec2(23.14,91.7)))*4197.17);
      diffuseColor.rgb*=1.-seam*.24*fade+(tileShade-.5)*.12*fade;
      `:`float joints=smoothstep(.47,.5,abs(fract((p.x+p.z)*3.)-.5));diffuseColor.rgb*=1.-joints*.28;`}
    `);
  };material.customProgramCacheKey=()=>`building-surface-${kind}`;return material;
}
