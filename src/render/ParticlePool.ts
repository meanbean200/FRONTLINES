import * as THREE from 'three';

/** One bounded, reusable billboard batch. No lights, per-particle objects or simulation writes. */
export class ParticlePool {
  readonly mesh:THREE.InstancedMesh;
  private readonly matrix=new THREE.Matrix4();
  private readonly alpha:THREE.InstancedBufferAttribute;
  private readonly color=new THREE.Color();
  private used=0;
  private ambient=1;
  limit:number;
  constructor(readonly capacity=900){
    this.limit=capacity;const geometry=new THREE.PlaneGeometry(1,1);
    this.alpha=new THREE.InstancedBufferAttribute(new Float32Array(capacity),1);geometry.setAttribute('particleAlpha',this.alpha);
    const material=new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide});
    material.onBeforeCompile=shader=>{
      shader.vertexShader='attribute float particleAlpha; varying float puffAlpha; varying vec2 puffUv;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`vec4 center=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);
        vec2 size=vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));
        vec4 mvPosition=center+vec4(position.xy*size,0.,0.);
        gl_Position=projectionMatrix*mvPosition;puffAlpha=particleAlpha;puffUv=uv;`);
      shader.fragmentShader='varying float puffAlpha; varying vec2 puffUv;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        vec2 p=puffUv*2.-1.;float d=length(p);
        float lobes=.85+.15*sin(p.x*13.+sin(p.y*9.))*sin(p.y*11.+p.x*3.);
        diffuseColor.a*=puffAlpha*pow(max(0.,1.-d),1.6)*lobes;
        if(diffuseColor.a<.008)discard;`);
    };
    this.mesh=new THREE.InstancedMesh(geometry,material,capacity);this.mesh.count=0;this.mesh.frustumCulled=false;this.mesh.renderOrder=2;
  }
  begin():void{this.used=0;}
  setAmbientLight(value:number):void{this.ambient=Math.max(0,Math.min(1,value));}
  add(x:number,y:number,z:number,width:number,height:number,tint:number,opacity:number,emissive=false):void{
    if(this.used>=Math.min(this.limit,this.capacity)||opacity<=0)return;
    this.matrix.makeScale(width,height,1);this.matrix.setPosition(x,y,z);this.mesh.setMatrixAt(this.used,this.matrix);
    this.mesh.setColorAt(this.used,this.color.setHex(tint).multiplyScalar(emissive?1:this.ambient));this.alpha.setX(this.used,opacity);this.used++;
  }
  end():void{this.mesh.count=this.used;this.mesh.instanceMatrix.needsUpdate=true;this.alpha.needsUpdate=true;if(this.mesh.instanceColor)this.mesh.instanceColor.needsUpdate=true;}
  get count():number{return this.used;}
}
