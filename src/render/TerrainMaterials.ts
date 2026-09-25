import * as THREE from 'three';

/** World-space surface detail; never changes the heightfield or its cover. */
export function groundMaterial():THREE.MeshStandardMaterial {
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96});
  const detail={value:1};material.userData.detail=detail;
  material.onBeforeCompile=shader=>{
    shader.uniforms.surfaceDetail=detail;
    shader.vertexShader='attribute vec3 groundCover; varying vec3 fieldCover; varying vec3 fieldPosition; varying float groundSlope;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfieldPosition=position;fieldCover=groundCover;groundSlope=normal.y;');
    shader.fragmentShader=`uniform float surfaceDetail;
      varying vec3 fieldCover; varying vec3 fieldPosition; varying float groundSlope;
      float gh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float gn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(gh(i),gh(i+vec2(1,0)),f.x),mix(gh(i+vec2(0,1)),gh(i+vec2(1,1)),f.x),f.y);}
      float soilHeight(vec2 p){return gn(p*3.3)*.5+gn(p*9.1)*.13;}
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 ground=fieldPosition.xz;
      vec2 acres=vec2(ground.x+ground.y*.17+85.,ground.y-ground.x*.11);
      // Uneven historic parcels, broad pasture and worn seams instead of a
      // uniformly stamped checkerboard. All coordinates remain world anchored.
      acres+=vec2(gn(ground/190.),gn(ground.yx/223.+14.))*72.;
      vec2 parcel=floor(acres/vec2(235.,185.));float crop=gh(parcel+vec2(19.,44.));
      float broad=gn(ground/19.),mottle=gn(ground/4.7),fine=gn(ground*2.4);
      float cultivation=smoothstep(.66,.86,crop)*smoothstep(.9,.985,groundSlope),forest=fieldCover.x,cut=fieldCover.y;
      float pasture=gn(ground/115.),damp=gn(ground/37.+fieldPosition.y*.035);
      vec3 grass=mix(vec3(.105,.149,.071),vec3(.225,.225,.138),crop*.38+pasture*.62);
      vec3 soil=mix(vec3(.13,.112,.085),vec3(.225,.181,.119),broad);
      vec3 surface=mix(grass,soil,cultivation*.72);
      float axis=mix(acres.x,acres.y,step(.5,gh(parcel+12.))),phase=axis*3.4;
      float rows=sin(phase)*(1.-smoothstep(.5,2.8,fwidth(phase)));
      surface*=.84+broad*.27+rows*.075*cultivation;
      surface=mix(surface,soil,smoothstep(.58,.84,mottle)*.16);
      surface=mix(surface,vec3(.095,.121,.068),smoothstep(.67,.9,damp)*.22*(1.-cultivation));
      vec2 edge=min(fract(acres/vec2(235.,185.)),1.-fract(acres/vec2(235.,185.)))*vec2(235.,185.);
      surface=mix(surface,vec3(.095,.13,.061),.28*(1.-smoothstep(.7,4.8+gn(ground/4.)*3.,min(edge.x,edge.y))));
      vec3 litter=mix(vec3(.079,.084,.046),vec3(.14,.118,.071),mottle);
      surface=mix(surface,litter,forest*.85);
      // Worn thresholds/yards follow the generated physical buildings and roads.
      // They add no invisible walls, cover, resource piles or navigation rules.
      vec3 yard=mix(vec3(.17,.15,.117),vec3(.29,.266,.21),mottle);
      surface=mix(surface,yard,fieldCover.z*(.8+broad*.2));
      // Actual cut mask and slope distinguish damp floor from exposed banks.
      vec3 bank=mix(vec3(.195,.149,.100),vec3(.115,.099,.073),mottle);
      vec3 mud=mix(vec3(.058,.055,.043),vec3(.105,.094,.071),broad);
      vec3 excavation=mix(bank,mud,smoothstep(.78,.98,groundSlope));
      surface=mix(surface,excavation,cut);
      float nearDetail=1.-smoothstep(80.,420.,length(vViewPosition));
      float blades=gn(ground*vec2(16.,2.5));
      surface*=1.+nearDetail*surfaceDetail*((fine-.5)*.18+(blades-.5)*.12*(1.-cultivation));
      diffuseColor.rgb=surface;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      float reliefFade=(1.-smoothstep(35.,220.,length(vViewPosition)))*surfaceDetail;
      vec2 p=fieldPosition.xz;
      vec2 relief=vec2(soilHeight(p+vec2(.035,0))-soilHeight(p-vec2(.035,0)),soilHeight(p+vec2(0,.035))-soilHeight(p-vec2(0,.035)));
      normal=normalize(normal+mat3(viewMatrix)*vec3(-relief.x,0.,-relief.y)*reliefFade*.65);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      roughnessFactor=mix(.97,.73,fieldCover.y*smoothstep(.9,.99,groundSlope));
    `);
  };
  return material;
}
