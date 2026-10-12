// Modelos 3D animados (glTF CC0 de Quaternius), material toon, contornos y pools instanciados
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as skClone} from 'three/addons/utils/SkeletonUtils.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';

// rampa toon de 3 tonos (sombras suaves y cálidas)
const ramp=new THREE.DataTexture(new Uint8Array([120,112,128,255, 196,190,190,255, 255,255,255,255]),3,1);
ramp.minFilter=ramp.magFilter=THREE.NearestFilter;ramp.generateMipmaps=false;ramp.needsUpdate=true;

// ---------- material toon con tinte de máscara, destello de golpe y luz de borde ----------
export function toonMat(o={}){
  const u={uFlash:{value:0},uFlashCol:{value:new THREE.Color(1,1,1)},uMaskCol:{value:new THREE.Color(1,1,1)},uMaskOn:{value:0},
    uCamo:{value:new THREE.Color(1,1,1)},uTint:{value:new THREE.Color(1,1,1)},uRim:{value:o.rim??0.5},uEdge:{value:o.edge??0.7},uEmis:{value:new THREE.Color(0,0,0)}};
  const m=new THREE.MeshToonMaterial({vertexColors:true,gradientMap:ramp,transparent:!!o.transparent});
  m.userData.u=u;
  m.onBeforeCompile=s=>{Object.assign(s.uniforms,u);
    s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute float _mask;varying float vMask;').replace('#include <begin_vertex>','#include <begin_vertex>\nvMask=_mask;');
    s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying float vMask;uniform float uFlash,uMaskOn,uRim,uEdge;uniform vec3 uFlashCol,uMaskCol,uCamo,uTint,uEmis;')
      .replace('#include <color_fragment>','#include <color_fragment>\n{float mk=step(0.5,vMask);vec3 mc=mix(diffuseColor.rgb,uMaskCol*(0.75+0.5*dot(diffuseColor.rgb,vec3(.3,.59,.11))),uMaskOn);diffuseColor.rgb=mix(diffuseColor.rgb,mc*uCamo,mk);diffuseColor.rgb*=uTint;}')
      .replace('#include <opaque_fragment>',`{vec3 nn=normalize(normal);float fr=1.0-clamp(dot(nn,normalize(vViewPosition)),0.0,1.0);
        outgoingLight+=diffuseColor.rgb*smoothstep(0.5,0.9,fr)*uRim*0.6;
        outgoingLight*=1.0-smoothstep(0.86,1.0,fr)*uEdge*0.6;
        outgoingLight+=uEmis;outgoingLight=mix(outgoingLight,uFlashCol,uFlash);}
        #include <opaque_fragment>`);};
  m.customProgramCacheKey=()=>'toonv1';
  return m;
}
// contorno por casco invertido (grosor en unidades de mundo)
function outlineMat(w=0.035,col=0x24131a){
  const m=new THREE.MeshBasicMaterial({color:col,side:THREE.BackSide});
  m.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <project_vertex>',`
    #ifdef USE_SKINNING
      vec3 _on=objectNormal;
    #else
      vec3 _on=normal;
    #endif
    vec4 mvPosition=vec4(transformed,1.0);
    #ifdef USE_INSTANCING
      mvPosition=instanceMatrix*mvPosition;_on=mat3(instanceMatrix)*_on;
    #endif
    mvPosition=modelViewMatrix*mvPosition;
    mvPosition.xyz+=normalize(mat3(modelViewMatrix)*_on)*${w.toFixed(4)};
    gl_Position=projectionMatrix*mvPosition;`);};
  m.customProgramCacheKey=()=>'outl'+w;
  return m;
}
export const OUTLINE=outlineMat(0.035), OUTLINE_BIG=outlineMat(0.07), OUTLINE_PROP=outlineMat(0.045);

// ---------- carga ----------
const loader=new GLTFLoader();loader.setMeshoptDecoder(MeshoptDecoder);
function toF32(a){const n=a.count,s=a.itemSize,out=new Float32Array(n*s);for(let i=0;i<n;i++)for(let j=0;j<s;j++)out[i*s+j]=a.getComponent(i,j);return new THREE.BufferAttribute(out,s);}
// une las mallas con piel que comparten esqueleto -> 1 draw call por personaje
function mergeSkinned(root){
  const groups=new Map();
  root.traverse(o=>{if(o.isSkinnedMesh){const k=o.skeleton.bones.map(b=>b.uuid).join()+o.skeleton.boneInverses.map(m=>m.elements.map(v=>v.toFixed(4)).join(',')).join(';')+o.bindMatrix.elements.join(',');if(!groups.has(k))groups.set(k,[]);groups.get(k).push(o);}});
  for(const list of groups.values()){if(list.length<2)continue;
    if(!list.every(m=>m.bindMatrix.equals(list[0].bindMatrix)&&m.skeleton.boneInverses.every((b,i)=>b.equals(list[0].skeleton.boneInverses[i]))))continue;
    const names=['position','normal','color','_mask','skinIndex','skinWeight'];
    const geos=list.map(m=>{const g=new THREE.BufferGeometry();for(const n of names){let a=m.geometry.getAttribute(n);
      if(!a){a=n==='color'?new THREE.BufferAttribute(new Float32Array(m.geometry.attributes.position.count*3).fill(0.8),3):n==='_mask'?new THREE.BufferAttribute(new Float32Array(m.geometry.attributes.position.count),1):null;}
      if(!a)return null;g.setAttribute(n,n==='skinIndex'?new THREE.BufferAttribute(new Uint16Array(Array.from({length:a.count*4},(_,i)=>a.getComponent(i>>2,i&3))),4):toF32(a));}
      g.setIndex(m.geometry.index?Array.from(m.geometry.index.array):null);return g;});
    if(geos.some(g=>!g))continue;
    const merged=mergeGeometries(geos,false);if(!merged)continue;
    const sm=new THREE.SkinnedMesh(merged,list[0].material);sm.name='body';sm.bind(list[0].skeleton,list[0].bindMatrix);
    list[0].parent.add(sm);for(const m of list)m.parent.remove(m);}
}
export const T={}; // plantillas
export async function loadModel(key,file){const g=await loader.loadAsync(file);const sc=g.scene;mergeSkinned(sc);
  // medir la altura real en la pose de reposo animada
  const mx=new THREE.AnimationMixer(sc);const ic=g.animations.find(c=>/^(Idle|Flying_Idle|Spider_Idle)$/.test(c.name))||g.animations[0];if(ic){mx.clipAction(ic).play();mx.update(0.01);}
  sc.updateMatrixWorld(true);const box=new THREE.Box3(),bb=new THREE.Box3();
  sc.traverse(o=>{if(o.isSkinnedMesh){o.computeBoundingBox();bb.copy(o.boundingBox).applyMatrix4(o.matrixWorld);box.union(bb);}else if(o.isMesh&&o.visible&&!/^(AK|GrenadeLauncher|Knife_\d|Pistol|Revolver|Revolver_Small|RocketLauncher|ShortCannon|Shotgun|Shovel|SMG|Sniper|Sniper_2)$/.test(o.name)){o.geometry.computeBoundingBox();bb.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);box.union(bb);}});
  if(ic){mx.stopAllAction();mx.uncacheRoot(sc);}
  T[key]={scene:sc,clips:g.animations,h:box.max.y-box.min.y,minY:box.min.y};return T[key];}

// ---------- instancias animadas ----------
const ANIMS={
  idle:['Idle','Flying_Idle','Spider_Idle','Idle_2'],run:['Run','Fast_Flying','Spider_Walk','Walk'],walk:['Walk','Run','Fast_Flying','Spider_Walk'],
  zrun:['Run_Arms','Run','Walk'],attack:['Punch','Run_Attack','Bite_Front','Headbutt','Attack','Spider_Attack','Weapon','Idle_Attack'],
  shoot:['Weapon','Punch','Headbutt','Spider_Attack','Attack'],hit:['HitReact','HitRecieve','HitReact_Left','Spider_Jump'],death:['Death','Spider_Death'],
  jump:['Jump','Spider_Jump','Run_Jump'],jumpIdle:['Jump_Idle','Jump'],land:['Jump_Land'],wave:['Wave','Yes','Dance'],
  runGun:['Run_Gun','Run'],runShoot:['Run_Shoot','Run_Gun','Run'],idleShoot:['Idle_Shoot','Idle'],duck:['Duck'],eat:['Eating'],
};
export class Char{
  constructor(key,o={}){const t=T[key];this.key=key;this.t=t;
    this.root=new THREE.Group();this.pivot=new THREE.Group();this.root.add(this.pivot);
    this.model=skClone(t.scene);this.pivot.add(this.model);
    const s=(o.h||1.8)/t.h;this.baseScale=s;this.model.scale.setScalar(s);this.model.position.y=-t.minY*s+(o.y||0);
    this.mat=toonMat(o);this.meshes=[];this.outlines=[];const rigid=[];
    this.model.traverse(m=>{if(m.isMesh){m.material=this.mat;m.frustumCulled=false;m.castShadow=!!o.shadow;this.meshes.push(m);
      if(o.outline!==false&&(m.isSkinnedMesh||o.outlineRigid)){if(m.isSkinnedMesh){const ol=new THREE.SkinnedMesh(m.geometry,o.big?OUTLINE_BIG:OUTLINE);ol.bind(m.skeleton,m.bindMatrix);ol.frustumCulled=false;ol.position.copy(m.position);ol.quaternion.copy(m.quaternion);ol.scale.copy(m.scale);m.parent.add(ol);this.outlines.push(ol);}
        else{const ol=new THREE.Mesh(m.geometry,OUTLINE);ol.frustumCulled=false;rigid.push([m,ol]);this.outlines.push(ol);}}}});
    for(const [m,ol] of rigid)m.add(ol); // el contorno rígido cuelga de su malla (se oculta con ella)
    this.mixer=new THREE.AnimationMixer(this.model);this.acts={};this.cur=null;this.curK='';this.acc=0;
    if(o.bigHead){const h=this.model.getObjectByName('Head');if(h)h.scale.setScalar(o.bigHead);}
  }
  clip(k){if(k in this.acts)return this.acts[k];const names=ANIMS[k]||[k];let c=null;for(const n of names){c=this.t.clips.find(c=>c.name===n);if(c)break;}
    return this.acts[k]=c?this.mixer.clipAction(c):null;}
  has(k){return!!this.clip(k);}
  play(k,{fade=0.14,once=false,ts=1,restart=false}={}){const a=this.clip(k);if(!a)return 0;
    if(this.cur===a&&!restart&&!once){a.timeScale=ts;return a.getClip().duration;}
    a.reset();a.enabled=true;a.setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,Infinity);a.clampWhenFinished=once;a.timeScale=ts;a.setEffectiveWeight(1);
    if(this.cur&&this.cur!==a&&fade>0)a.crossFadeFrom(this.cur,fade,false);else if(this.cur&&this.cur!==a)this.cur.stop();
    a.play();this.cur=a;this.curK=k;return a.getClip().duration/ts;}
  speed(ts){if(this.cur)this.cur.timeScale=ts;}
  update(dt){this.mixer.update(dt);}
  outline(on){for(const o of this.outlines)o.visible=on;}
  show(names,on){for(const n of names){const o=this.model.getObjectByName(n);if(o)o.visible=on;}}
}
// pool de personajes reutilizables (evita clonar en cada aparición)
export class CharPool{
  constructor(scene){this.scene=scene;this.free=new Map();}
  get(id,make){const l=this.free.get(id);let c=l&&l.pop();if(!c){c=make();c.poolId=id;}this.scene.add(c.root);c.root.visible=true;return c;}
  put(c){this.scene.remove(c.root);c.mixer.stopAllAction();c.cur=null;c.curK='';c.mat.userData.u.uFlash.value=0;
    if(!this.free.has(c.poolId))this.free.set(c.poolId,[]);this.free.get(c.poolId).push(c);}
}

// ---------- mallas instanciadas (props, gemas, monedas, pickups…) ----------
const _m=new THREE.Matrix4(),_q=new THREE.Quaternion(),_e=new THREE.Euler(0,0,0,'YXZ'),_p=new THREE.Vector3(),_s=new THREE.Vector3(),_c=new THREE.Color();
export class Inst{
  constructor(scene){this.scene=scene;this.k={};}
  // parts: [{geo, local:Matrix4}] ; o:{cap,outline,shadow,mat}
  def(key,parts,o={}){const cap=o.cap||64;const mat=o.mat||toonMat({rim:0.35,edge:0.5});const list=[];
    for(const p of parts){const im=new THREE.InstancedMesh(p.geo,mat,cap);im.count=0;im.frustumCulled=false;im.castShadow=!!o.shadow;im.receiveShadow=false;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);if(o.color){im.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(cap*3).fill(1),3);im.instanceColor.setUsage(THREE.DynamicDrawUsage);}
      this.scene.add(im);let ol=null;if(o.outline!==false){ol=new THREE.InstancedMesh(p.geo,o.outlineMat||OUTLINE_PROP,cap);ol.count=0;ol.frustumCulled=false;ol.instanceMatrix=im.instanceMatrix;this.scene.add(ol);}
      list.push({im,ol,local:p.local});}
    this.k[key]={list,n:0,cap,size:o.size||null};return this.k[key];}
  fromObject(key,obj,o={}){obj.updateMatrixWorld(true);const inv=new THREE.Matrix4().copy(obj.matrixWorld).invert();const parts=[];
    obj.traverse(m=>{if(m.isMesh){const g=m.geometry;if(!g.getAttribute('color')){g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*3).fill(1),3));}
      parts.push({geo:g,local:new THREE.Matrix4().multiplyMatrices(inv,m.matrixWorld)});}});
    const box=new THREE.Box3().setFromObject(obj);box.applyMatrix4(inv);const d=this.def(key,parts,o);d.box=box;return d;}
  add(key,x,y,z,ry=0,s=1,rx=0,rz=0,col,sy){const d=this.k[key];if(!d||d.n>=d.cap)return;const i=d.n++;
    _e.set(rx,ry,rz);_q.setFromEuler(_e);_p.set(x,y,z);if(typeof s==='number')_s.set(s,sy??s,s);else _s.set(s[0],s[1],s[2]);_m.compose(_p,_q,_s);
    for(const L of d.list){const M=L.im.instanceMatrix.array;_m2.multiplyMatrices(_m,L.local);_m2.toArray(M,i*16);if(col&&L.im.instanceColor){_c.setRGB(col[0],col[1],col[2]);_c.toArray(L.im.instanceColor.array,i*3);}}}
  flush(){for(const key in this.k){const d=this.k[key];for(const L of d.list){L.im.count=d.n;L.im.instanceMatrix.needsUpdate=true;L.im.instanceMatrix.clearUpdateRanges?.();L.im.instanceMatrix.addUpdateRange?.(0,d.n*16);
      if(L.im.instanceColor){L.im.instanceColor.needsUpdate=true;}if(L.ol)L.ol.count=d.n;}d.n=0;}}
  outlines(on){for(const key in this.k)for(const L of this.k[key].list)if(L.ol)L.ol.visible=on;}
}
const _m2=new THREE.Matrix4();
