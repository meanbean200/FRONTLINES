import * as THREE from 'three';

/** World-space surface detail; never changes the heightfield or its cover. */
export function groundMaterial():THREE.MeshStandardMaterial {
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96});
  const detail={value:1};material.userData.detail=detail;
  material.onBeforeCompile=shader=>{
    shader.uniforms.surfaceDetail=detail;
    shader.vertexShader='attribute vec2 groundCover; varying vec2 fieldCover; varying vec3 fieldPosition; varying float groundSlope;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfieldPosition=position;fieldCover=groundCover;groundSlope=normal.y;');
    shader.fragmentShader=`uniform float surfaceDetail;
      varying vec2 fieldCover; varying vec3 fieldPosition; varying float groundSlope;
      float gh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float gn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(gh(i),gh(i+vec2(1,0)),f.x),mix(gh(i+vec2(0,1)),gh(i+vec2(1,1)),f.x),f.y);}
      float soilHeight(vec2 p){return gn(p*3.3)*.5+gn(p*9.1)*.13;}
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 ground=fieldPosition.xz;
      vec2 acres=vec2(ground.x+ground.y*.17+85.,ground.y-ground.x*.11);
      acres+=vec2(gn(ground/95.),gn(ground.yx/113.+14.))*9.;
      vec2 parcel=floor(acres/vec2(170.,140.));float crop=gh(parcel+vec2(19.,44.));
      float broad=gn(ground/19.),mottle=gn(ground/4.7),fine=gn(ground*2.4);
      float cultivation=smoothstep(.5,.8,crop),forest=fieldCover.x,cut=fieldCover.y;
      vec3 grass=mix(vec3(.105,.137,.065),vec3(.205,.215,.125),crop);
      vec3 soil=mix(vec3(.135,.099,.062),vec3(.21,.163,.102),broad);
      vec3 surface=mix(grass,soil,cultivation*.8);
      float axis=mix(acres.x,acres.y,step(.5,gh(parcel+12.))),phase=axis*3.4;
      float rows=sin(phase)*(1.-smoothstep(.5,2.8,fwidth(phase)));
      surface*=.88+broad*.22+rows*.12*cultivation;
      surface=mix(surface,soil,smoothstep(.54,.82,mottle)*.24);
      vec2 edge=min(fract(acres/vec2(170.,140.)),1.-fract(acres/vec2(170.,140.)))*vec2(170.,140.);
      surface=mix(surface,vec3(.091,.113,.052),.42*(1.-smoothstep(.5,2.7,min(edge.x,edge.y))));
      vec3 litter=mix(vec3(.079,.084,.046),vec3(.14,.118,.071),mottle);
      surface=mix(surface,litter,forest*.85);
      // Actual cut mask and slope distinguish damp floor from exposed banks.
      vec3 bank=mix(vec3(.19,.134,.078),vec3(.125,.092,.060),mottle);
      vec3 mud=mix(vec3(.073,.061,.045),vec3(.13,.105,.076),broad);
      vec3 excavation=mix(bank,mud,smoothstep(.78,.98,groundSlope));
      surface=mix(surface,excavation,cut);
      float nearDetail=1.-smoothstep(80.,420.,length(vViewPosition));
      float blades=gn(ground*vec2(16.,2.5));
      surface*=1.+nearDetail*surfaceDetail*((fine-.5)*.23+(blades-.5)*.14*(1.-cultivation));
      diffuseColor.rgb=surface;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      float reliefFade=(1.-smoothstep(35.,220.,length(vViewPosition)))*surfaceDetail;
      vec2 p=fieldPosition.xz;
      vec2 relief=vec2(soilHeight(p+vec2(.035,0))-soilHeight(p-vec2(.035,0)),soilHeight(p+vec2(0,.035))-soilHeight(p-vec2(0,.035)));
      normal=normalize(normal+mat3(viewMatrix)*vec3(-relief.x,0.,-relief.y)*reliefFade*1.3);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      roughnessFactor=mix(.97,.73,fieldCover.y*smoothstep(.9,.99,groundSlope));
    `);
  };
  return material;
}
