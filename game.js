import * as THREE from 'three';
import {WEAPONS,BASE_WEAPONS,FUSIONS,FAMS,ROLES,PASSIVES,PETS,SKINS,HATS,ACCS,COLORS,WSKINS,SHOP,CATNAMES} from './data.js';
import {initAudio,sfx,startMusic,stopMusic,setIntensity,toggleMusic,musicEnabled} from './audio.js';

const $=id=>document.getElementById(id);
const isMobile=matchMedia('(pointer:coarse)').matches;
const rand=(a,b)=>a+Math.random()*(b-a), clamp=(v,a,b)=>v<a?a:v>b?b:v;
const pick=a=>a[Math.floor(Math.random()*a.length)];

// ================== GUARDADO ==================
const DEF={coins:0,owned:{clasico:1,ninja:1,ninguno:1,gorra:1,gafas:1,normal:1},custom:{color:COLORS[0],skin:'clasico',hat:'gorra',acc:'ninguno',name:'Héroe'},wskin:'normal',pet:null,best:0,games:0};
let save;
try{ save=Object.assign(structuredClone(DEF),JSON.parse(localStorage.getItem('oleadas_save')||'{}')); save.custom=Object.assign({},DEF.custom,save.custom); save.owned=Object.assign({},DEF.owned,save.owned);}catch(e){save=structuredClone(DEF);}
const persist=()=>{try{localStorage.setItem('oleadas_save',JSON.stringify(save))}catch(e){}};
const owns=id=>!!save.owned[id];

// ================== RENDER BASE ==================
const canvas=$('c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:!isMobile,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,isMobile?1.5:2));
renderer.shadowMap.enabled=!isMobile; renderer.shadowMap.type=THREE.PCFShadowMap;
const scene=new THREE.Scene(); scene.background=new THREE.Color(0x87b7d8); scene.fog=new THREE.Fog(0x87b7d8,38,70);
const camera=new THREE.PerspectiveCamera(50,1,0.1,200);
scene.add(new THREE.HemisphereLight(0xdfefff,0x4a5a30,1.4));
const sun=new THREE.DirectionalLight(0xffffff,2.2); sun.castShadow=true; sun.shadow.mapSize.set(1024,1024);
Object.assign(sun.shadow.camera,{left:-30,right:30,top:30,bottom:-30,near:1,far:80}); scene.add(sun,sun.target);
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=w<h?70:50;camera.updateProjectionMatrix();}
addEventListener('resize',resize); resize();

// suelo infinito (sigue al jugador, alineado a la textura)
const TILE=8;
function groundTex(){const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');
  g.fillStyle='#5f9a42';g.fillRect(0,0,256,256);
  for(let i=0;i<900;i++){g.fillStyle=`hsl(${95+Math.random()*25},${40+Math.random()*20}%,${30+Math.random()*16}%)`;g.fillRect(Math.random()*256,Math.random()*256,2+Math.random()*3,2+Math.random()*3);}
  g.strokeStyle='rgba(0,0,0,.08)';g.lineWidth=2;g.strokeRect(0,0,256,256);
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;}
const gt=groundTex(); const GS=200; gt.repeat.set(GS/TILE,GS/TILE);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(GS,GS),new THREE.MeshLambertMaterial({map:gt}));
ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; scene.add(ground);

// ================== BATCHES INSTANCIADOS ==================
const _m=new THREE.Matrix4(),_q=new THREE.Quaternion(),_p=new THREE.Vector3(),_s=new THREE.Vector3(),_c=new THREE.Color(),_e=new THREE.Euler(),UP=new THREE.Vector3(0,1,0);
class Batch{
  constructor(geo,mat,max,shadow=false){this.m=new THREE.InstancedMesh(geo,mat,max);this.m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.m.frustumCulled=false;this.max=max;this.n=0;for(let i=0;i<max;i++)this.m.setColorAt(i,_c.set(0xffffff));this.m.count=0;this.m.castShadow=shadow;scene.add(this.m);}
  add(x,y,z,sx,sy,sz,col,ry=0,rx=0){if(this.n>=this.max)return;_p.set(x,y,z);_s.set(sx,sy,sz);
    if(rx){_e.set(rx,ry,0,'YXZ');_q.setFromEuler(_e);}else _q.setFromAxisAngle(UP,ry);
    _m.compose(_p,_q,_s);this.m.setMatrixAt(this.n,_m);this.m.setColorAt(this.n,typeof col==='number'?_c.setHex(col):col);this.n++;}
  beam(x1,z1,x2,z2,y,w,col){const dx=x2-x1,dz=z2-z1,l=Math.hypot(dx,dz);this.add((x1+x2)/2,y,(z1+z2)/2,w,w,l,col,Math.atan2(dx,dz));}
  flush(){this.m.count=this.n;this.m.instanceMatrix.needsUpdate=true;if(this.m.instanceColor)this.m.instanceColor.needsUpdate=true;this.n=0;}
}
const glowMat=new THREE.MeshBasicMaterial({transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false});
const B={
  glow:new Batch(new THREE.SphereGeometry(1,10,8),glowMat,3000),
  spark:new Batch(new THREE.BoxGeometry(1,1,1),glowMat,4000),
  beam:new Batch(new THREE.BoxGeometry(1,1,1),glowMat,400),
  ring:new Batch(new THREE.RingGeometry(0.85,1,40).rotateX(-Math.PI/2),glowMat,200),
  solid:new Batch(new THREE.BoxGeometry(1,1,1),new THREE.MeshLambertMaterial(),800,true),
  gem:new Batch(new THREE.OctahedronGeometry(1),new THREE.MeshLambertMaterial({emissive:0x222222}),1500),
  shadow:new Batch(new THREE.CircleGeometry(1,16).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0,transparent:true,opacity:0.25,depthWrite:false}),1200),
  e0:new Batch(new THREE.BoxGeometry(1,1,1).translate(0,0.5,0),new THREE.MeshLambertMaterial(),900,true),
  e1:new Batch(new THREE.IcosahedronGeometry(0.6,0).translate(0,0.6,0),new THREE.MeshLambertMaterial({flatShading:true}),900,true),
  e2:new Batch(new THREE.SphereGeometry(0.5,12,10).scale(1,1.4,1).translate(0,0.7,0),new THREE.MeshLambertMaterial(),900,true),
  eye:new Batch(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({toneMapped:false}),900),
  limb:new Batch(new THREE.BoxGeometry(1,1,1),new THREE.MeshLambertMaterial(),1800),
};
B.ring.m.renderOrder=2; B.shadow.m.position.y=0.02;

// ================== PERSONAJE ==================
function std(color,o={}){return new THREE.MeshStandardMaterial(Object.assign({color,roughness:0.6},o));}
function buildChar(cu,scale=1){
  const g=new THREE.Group(), body=new THREE.Group(); g.add(body);
  let col=cu.color, mo={};
  if(cu.skin==='ninja') col=0x22222a; if(cu.skin==='astronauta') col=0xf0f0f0; if(cu.skin==='zombi') col=0x6a9a4a;
  if(cu.skin==='robot') mo={metalness:0.85,roughness:0.3}; if(cu.skin==='dorado'){col=0xffc83a;mo={metalness:1,roughness:0.25,emissive:0x442200};}
  const bm=std(col,mo), dark=std(0x222222), white=std(0xffffff);
  const torso=new THREE.Mesh(new THREE.CapsuleGeometry(0.4,0.45,4,10),bm); torso.position.y=0.95; body.add(torso);
  let head;
  if(cu.skin==='calabaza'){head=new THREE.Mesh(new THREE.IcosahedronGeometry(0.38,1),std(0xff8a1a,{flatShading:true}));}
  else if(cu.skin==='robot'){head=new THREE.Mesh(new THREE.BoxGeometry(0.6,0.5,0.55),bm);}
  else head=new THREE.Mesh(new THREE.SphereGeometry(0.34,16,12),bm);
  head.position.y=1.65; body.add(head);
  const eyeM=cu.skin==='zombi'?std(0xff2020,{emissive:0xaa0000}):cu.skin==='calabaza'||cu.skin==='robot'?std(0xffee55,{emissive:0xffaa00}):dark;
  for(const s of[-1,1]){const e=new THREE.Mesh(new THREE.SphereGeometry(0.07,8,6),eyeM);e.position.set(s*0.13,1.7,0.3);body.add(e);}
  if(cu.skin==='astronauta'){const v=new THREE.Mesh(new THREE.SphereGeometry(0.25,16,10),std(0x3a8cff,{metalness:0.6,roughness:0.1,transparent:true,opacity:0.8}));v.scale.set(1.2,0.8,0.6);v.position.set(0,1.68,0.2);body.add(v);
    const pk=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.6,0.25),std(0xcccccc));pk.position.set(0,1,-0.42);body.add(pk);}
  if(cu.skin==='ninja'){const b=new THREE.Mesh(new THREE.TorusGeometry(0.34,0.06,6,20),std(cu.color));b.rotation.x=Math.PI/2;b.position.y=1.75;body.add(b);
    const m=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.04,0.25),std(cu.color));m.position.set(0.1,1.75,-0.4);m.rotation.y=0.6;body.add(m);}
  if(cu.skin==='robot'){const a=new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,0.3),dark);a.position.y=2.05;body.add(a);const ab=new THREE.Mesh(new THREE.SphereGeometry(0.07),std(0xff2020,{emissive:0xff0000}));ab.position.y=2.22;body.add(ab);}
  // sombrero
  const H=new THREE.Group(); H.position.y=1.9; body.add(H);
  const hat=cu.hat;
  if(hat==='gorra'){const c=new THREE.Mesh(new THREE.SphereGeometry(0.35,14,8,0,Math.PI*2,0,Math.PI/2),std(cu.color===0xff4a4a?0x3a8cff:0xff4a4a));c.position.y=-0.1;H.add(c);const v=new THREE.Mesh(new THREE.CylinderGeometry(0.25,0.25,0.04,16,1,false,0,Math.PI),c.material);v.position.set(0,-0.1,0.2);v.rotation.y=-Math.PI/2;H.add(v);}
  if(hat==='corona'){const gm=std(0xffd23a,{metalness:1,roughness:0.2,emissive:0x553300});const r=new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.28,0.18,16,1,true),gm);r.material.side=THREE.DoubleSide;H.add(r);
    for(let i=0;i<6;i++){const p=new THREE.Mesh(new THREE.ConeGeometry(0.06,0.18,6),gm);const a=i/6*Math.PI*2;p.position.set(Math.cos(a)*0.27,0.16,Math.sin(a)*0.27);H.add(p);}}
  if(hat==='cuernos'||hat==='vikingo'){if(hat==='vikingo'){const c=new THREE.Mesh(new THREE.SphereGeometry(0.36,14,8,0,Math.PI*2,0,Math.PI/2),std(0x9a9aa8,{metalness:0.8,roughness:0.3}));c.position.y=-0.12;H.add(c);}
    for(const s of[-1,1]){const h=new THREE.Mesh(new THREE.ConeGeometry(0.08,0.4,8),std(hat==='vikingo'?0xf0e8d0:0xaa1a1a));h.position.set(s*0.28,0.05,0);h.rotation.z=-s*0.7;H.add(h);}}
  if(hat==='copa'){const m=std(0x151515);const b=new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.42,0.04,20),m);b.position.y=-0.05;H.add(b);const t=new THREE.Mesh(new THREE.CylinderGeometry(0.26,0.26,0.45,20),m);t.position.y=0.2;H.add(t);const r=new THREE.Mesh(new THREE.CylinderGeometry(0.265,0.265,0.08,20),std(0xc02020));r.position.y=0.03;H.add(r);}
  if(hat==='halo'){const h=new THREE.Mesh(new THREE.TorusGeometry(0.3,0.04,8,24),new THREE.MeshBasicMaterial({color:0xffee66}));h.rotation.x=Math.PI/2;h.position.y=0.25;H.add(h);}
  if(hat==='helice'){const c=new THREE.Mesh(new THREE.SphereGeometry(0.35,14,8,0,Math.PI*2,0,Math.PI/2),std(0xffd23a));c.position.y=-0.1;H.add(c);const p=new THREE.Group();p.position.y=0.3;
    const bl=new THREE.Mesh(new THREE.BoxGeometry(0.8,0.02,0.1),std(0xff3a3a));p.add(bl);const bl2=bl.clone();bl2.material=std(0x3a8cff);bl2.rotation.y=Math.PI/2;p.add(bl2);H.add(p);g.userData.prop=p;}
  // accesorio
  const acc=cu.acc;
  if(acc==='gafas'){const m=std(0x111111,{metalness:0.5,roughness:0.2});for(const s of[-1,1]){const l=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.1,0.05),m);l.position.set(s*0.13,1.7,0.33);body.add(l);}const br=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.03,0.03),m);br.position.set(0,1.72,0.33);body.add(br);}
  if(acc==='capa'){const c=new THREE.Mesh(new THREE.PlaneGeometry(0.8,1.1),std(0xc01a2a,{side:THREE.DoubleSide}));c.position.set(0,0.95,-0.42);c.rotation.x=0.18;body.add(c);g.userData.cape=c;}
  if(acc==='mochila'){const b=new THREE.Mesh(new THREE.BoxGeometry(0.55,0.6,0.3),std(0x8a5a2a));b.position.set(0,1.0,-0.42);body.add(b);}
  if(acc==='bufanda'){const b=new THREE.Mesh(new THREE.TorusGeometry(0.28,0.08,8,20),std(0xff3a6a));b.rotation.x=Math.PI/2;b.position.y=1.38;body.add(b);}
  // piernas y brazos
  const legs=[];for(const s of[-1,1]){const piv=new THREE.Group();piv.position.set(s*0.17,0.55,0);const l=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.5,0.24),cu.skin==='astronauta'?white:dark);l.position.y=-0.25;piv.add(l);body.add(piv);legs.push(piv);}
  const arms=[];for(const s of[-1,1]){const piv=new THREE.Group();piv.position.set(s*0.5,1.22,0);const a=new THREE.Mesh(new THREE.CapsuleGeometry(0.1,0.3,3,6),bm);a.position.y=-0.22;piv.add(a);body.add(piv);arms.push(piv);}
  g.traverse(o=>{if(o.isMesh){o.castShadow=true;}});
  g.userData.legs=legs;g.userData.arms=arms;g.userData.body=body;g.scale.setScalar(scale);
  return g;
}
function animChar(g,t,moving,air){const u=g.userData,sw=moving&&!air?Math.sin(t*12)*0.7:0;
  u.legs[0].rotation.x=air?-0.6:sw;u.legs[1].rotation.x=air?0.4:-sw;u.arms[0].rotation.x=air?-2.5:-sw*0.8;u.arms[1].rotation.x=air?-2.5:sw*0.8;
  u.body.position.y=moving&&!air?Math.abs(Math.sin(t*12))*0.08:Math.sin(t*2)*0.03; if(u.prop)u.prop.rotation.y=t*15; if(u.cape)u.cape.rotation.x=0.2+(moving?0.5:0)+Math.sin(t*8)*0.08;}

// ================== MAPA PROCEDURAL ==================
const CH=32, chunks=new Map();
function hash(x,z){let h=(x*374761393+z*668265263)^0x5bd1e995;h=Math.imul(h^(h>>>13),1274126177);return (h^(h>>>16))>>>0;}
function rng(seed){return()=>{seed=(seed+0x6D2B79F5)>>>0;let t=seed;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const G={tree:new THREE.ConeGeometry(1,2.6,7),trunk:new THREE.CylinderGeometry(0.22,0.3,1,6),rock:new THREE.DodecahedronGeometry(1,0),box:new THREE.BoxGeometry(1,1,1),
  barrel:new THREE.CylinderGeometry(0.45,0.45,0.9,10),cactus:new THREE.CylinderGeometry(0.35,0.4,2.4,8),pillar:new THREE.CylinderGeometry(0.6,0.7,3,8),flower:new THREE.SphereGeometry(0.15,6,4),bush:new THREE.IcosahedronGeometry(0.7,0)};
const M={leaf:[0x2f7a32,0x3f8f3a,0x2a6a4a,0xc06a2a].map(c=>std(c,{flatShading:true})),trunk:std(0x6a4a2a),rock:std(0x8a8a90,{flatShading:true}),sand:std(0xc8b070,{flatShading:true}),
  wood:std(0xa0703a),barrel:std(0xb03a2a),cactus:std(0x3a8a3a),stone:std(0xb8b0a0),flower:[0xff5a8a,0xffe03a,0xffffff,0xa05aff].map(c=>new THREE.MeshLambertMaterial({color:c})),bush:std(0x3a9a3a,{flatShading:true}),
  crate:std(0xc08a3a),crateB:new THREE.MeshBasicMaterial({color:0xffd84a})};
const crateGeoBand=new THREE.BoxGeometry(1.08,0.18,1.08);
function makeCrate(x,z){const g=new THREE.Group();const b=new THREE.Mesh(G.box,M.crate);b.scale.set(1,1,1);b.castShadow=true;g.add(b);const s=new THREE.Mesh(crateGeoBand,M.crateB);g.add(s);const s2=s.clone();s2.rotation.z=Math.PI/2;g.add(s2);
  g.position.set(x,0.6,z);scene.add(g);return {x,z,g,open:false};}
const crates=[];
function genChunk(cx,cz){
  const r=rng(hash(cx,cz)), group=new THREE.Group(), obs=[]; const biome=hash(Math.floor(cx/3),Math.floor(cz/3))%4; // 0 bosque 1 roca 2 desierto 3 ruinas
  const ox=cx*CH, oz=cz*CH; const near=(x,z)=>Math.abs(x)<6&&Math.abs(z)<6;
  const n=10+Math.floor(r()*10);
  for(let i=0;i<n;i++){const x=ox+r()*CH,z=oz+r()*CH; if(near(x,z))continue; const k=r(); let m;
    if(biome===0&&k<0.55||biome===3&&k<0.15){const s=0.8+r()*0.8;const t=new THREE.Mesh(G.trunk,M.trunk);t.position.set(x,0.5*s,z);t.scale.setScalar(s);const l=new THREE.Mesh(G.tree,M.leaf[biome===3?3:Math.floor(r()*3)]);l.position.set(x,(1+1.3)*s,z);l.scale.setScalar(s);group.add(t,l);t.castShadow=l.castShadow=true;obs.push({x,z,r:0.5*s,h:9});continue;}
    if(biome===2&&k<0.4){const s=0.8+r()*0.6;m=new THREE.Mesh(G.cactus,M.cactus);m.position.set(x,1.2*s,z);m.scale.setScalar(s);obs.push({x,z,r:0.45*s,h:9});}
    else if(biome===3&&k<0.5){m=new THREE.Mesh(G.pillar,M.stone);const s=0.7+r()*0.6;m.position.set(x,1.5*s*(r()<0.4?0.5:1),z);m.scale.setScalar(s);obs.push({x,z,r:0.7*s,h:9});}
    else if(k<0.72){const big=r()<0.45,s=big?1.3+r()*1.2:0.45+r()*0.25;m=new THREE.Mesh(G.rock,biome===2?M.sand:M.rock);m.position.set(x,s*0.45,z);m.scale.set(s,s*(big?0.8:0.9),s);m.rotation.y=r()*6;obs.push({x,z,r:s*0.9,h:big?9:s*0.85,small:!big});}
    else if(k<0.86){m=new THREE.Mesh(G.barrel,M.barrel);m.position.set(x,0.45,z);obs.push({x,z,r:0.5,h:0.9,small:1});}
    else {const w=new THREE.Mesh(G.box,M.wood);const len=1.5+r()*2.5;w.scale.set(len,0.7,0.5);w.rotation.y=r()<0.5?0:Math.PI/2;w.position.set(x,0.35,z);m=w;
      const steps=Math.ceil(len/0.8);for(let j=0;j<steps;j++){const o=-len/2+(j+0.5)*len/steps;obs.push({x:x+(w.rotation.y?0:o),z:z+(w.rotation.y?o:0),r:0.45,h:0.7,small:1});}}
    if(m){m.castShadow=true;m.receiveShadow=true;group.add(m);}
  }
  for(let i=0;i<14;i++){const x=ox+r()*CH,z=oz+r()*CH; if(r()<0.5){const f=new THREE.Mesh(G.flower,pick(M.flower));f.position.set(x,0.1,z);group.add(f);}else{const b=new THREE.Mesh(G.bush,M.bush);b.position.set(x,0.25,z);b.scale.set(0.8,0.5,0.8);group.add(b);}}
  const cr=[]; if(r()<0.55&&!(cx===0&&cz===0)){cr.push(makeCrate(ox+4+r()*(CH-8),oz+4+r()*(CH-8)));}
  if(cx===0&&cz===0) cr.push(makeCrate(5,-4));
  crates.push(...cr); scene.add(group); group.matrixAutoUpdate=false; group.traverse(o=>{o.updateMatrix();o.matrixAutoUpdate=false;});
  // las cajas quedan fuera del grupo estático
  return {group,obs,crates:cr};
}
function updateChunks(px,pz,force){
  const ccx=Math.floor(px/CH),ccz=Math.floor(pz/CH), R=2;
  for(let x=ccx-R;x<=ccx+R;x++)for(let z=ccz-R;z<=ccz+R;z++){const k=x+','+z;if(!chunks.has(k))chunks.set(k,genChunk(x,z));}
  for(const [k,c] of chunks){const [x,z]=k.split(',').map(Number);if(Math.abs(x-ccx)>R+1||Math.abs(z-ccz)>R+1){scene.remove(c.group);for(const cr of c.crates){scene.remove(cr.g);cr.open=true;const i=crates.indexOf(cr);if(i>=0)crates.splice(i,1);}chunks.delete(k);}}
}
function clearChunks(){for(const c of chunks.values()){scene.remove(c.group);for(const cr of c.crates)scene.remove(cr.g);}chunks.clear();for(const cr of crates)scene.remove(cr.g);crates.length=0;}
function obsNear(x,z,cb){const cx=Math.floor(x/CH),cz=Math.floor(z/CH);for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){const c=chunks.get((cx+i)+','+(cz+j));if(c)for(const o of c.obs){const dx=x-o.x,dz=z-o.z;if(dx*dx+dz*dz<9)cb(o,dx,dz);}}}

// ================== ESTADO DE PARTIDA ==================
let S=null; // estado
let mode='menu'; // menu | play | levelup | pause | over
let player=null, menuChar=null;
const enemies=[], projs=[], eprojs=[], parts=[], pickups=[], mines=[], fx=[], pets=[], meteors=[];
let eid=1;
const keys={}; const joy={active:false,x:0,z:0,id:null,ox:0,oy:0};

function newRun(){
  clearChunks(); for(const a of[enemies,projs,eprojs,parts,pickups,mines,fx,meteors])a.length=0; for(const p of pets)scene.remove(p.g); pets.length=0;
  if(player)scene.remove(player); player=buildChar(save.custom); scene.add(player);
  const pk=save.owned;
  S={x:0,z:0,y:0,vy:0,face:0,hp:100,maxHp:100,spd:7,dmg:1,cd:1,magnet:3,regen:0,armor:0,crit:0.05,area:1,multi:0,coinMul:1,
    lvl:1,xp:0,need:xpNeed(1),weapons:[],passives:{},wave:0,waveKills:0,waveQuota:0,spawned:0,spawnT:0,breakT:2,boss:null,
    kills:0,coins:0,time:0,inv:0,shake:0,pendingLv:0,revive:!!pk.p_revivir,fury:0,t:0,crateT:25,hordeDone:false};
  if(pk.p_vida){S.maxHp+=30;} if(pk.p_fuerza)S.dmg+=0.15; if(pk.p_iman)S.magnet*=1.5; if(pk.p_botas)S.spd*=1.1; if(pk.p_suerte)S.coinMul=1.3;
  S.hp=S.maxHp; addWeapon('pistola',true);
  if(pk.p_arsenal) addWeapon(pick(BASE_WEAPONS.filter(w=>w!=='pistola')),true);
  if(save.pet&&owns(save.pet)) addPet(save.pet);
  updateChunks(0,0); mode='play'; show('hud'); renderSlots(); renderPets(); startMusic(); setIntensity(0); nextWave();
}
const xpNeed=l=>Math.floor(5+l*6+l*l*0.5);

// ================== ARMAS ==================
function addWeapon(id,silent){const w={id,lvl:1,t:Math.random()*0.3,ang:0,d:WEAPONS[id]};S.weapons.push(w);if(!silent){toast(`¡Nueva arma: ${w.d.icon} ${w.d.name}!`);}renderSlots();checkFusionToast();}
function wstat(w){const d=w.d,l=w.lvl-1;return{dmg:d.dmg*(1+0.3*l)*S.dmg,cd:(d.cd||1)*Math.pow(0.92,l)*S.cd*(S.fury>0?0.5:1),count:(d.count||1)+Math.floor(l/3)+(['proj','boomer','meteor','orbit'].includes(d.type)?S.multi:0),area:S.area*(1+0.06*l)};}
function availableFusions(){const r=[];for(const [a,b,c] of FUSIONS){const wa=S.weapons.find(w=>w.id===a),wb=S.weapons.find(w=>w.id===b);if(wa&&wb&&wa.lvl>=3&&wb.lvl>=3)r.push([a,b,c]);}return r;}
function doFusion([a,b,c]){S.weapons=S.weapons.filter(w=>w.id!==a&&w.id!==b);addWeapon(c,true);const w=S.weapons[S.weapons.length-1];w.lvl=1;
  banner(`¡FUSIÓN! ${WEAPONS[c].icon} ${WEAPONS[c].name}`);sfx('fusion');burst(S.x,1,S.z,60,0xffaa33,10);S.shake=0.5;renderSlots();}
let fusToastShown=new Set();
function checkFusionToast(){for(const f of availableFusions()){if(!fusToastShown.has(f[2])){fusToastShown.add(f[2]);setTimeout(()=>toast(`🔥 Fusión disponible: ${WEAPONS[f[2]].name} (al subir de nivel)`),1500);}}}
function wcolor(c){const s=save.wskin;if(s==='dorado')return 0xffc830;if(s==='neon')return [0x39ff14,0xff10f0,0x10e0ff][Math.floor(S.t*3)%3];if(s==='arcoiris')return _c.setHSL((S.t*0.5+Math.random()*0.2)%1,1,0.55).getHex();if(s==='sombra')return 0x8030ff;return c;}

function nearestEnemy(x,z,maxD=30,exclude){let best=null,bd=maxD*maxD;for(const e of enemies){if(exclude&&exclude.has(e.id))continue;const dx=e.x-x,dz=e.z-z,d=dx*dx+dz*dz;if(d<bd){bd=d;best=e;}}return best;}
function fireWeapon(w,dt){
  const d=w.d,st=wstat(w);
  if(d.type==='orbit'){w.ang+=d.rot*dt;const n=st.count,R=d.radius*st.area;for(let i=0;i<n;i++){const a=w.ang+i/n*Math.PI*2,x=S.x+Math.cos(a)*R,z=S.z+Math.sin(a)*R;
      const col=wcolor(d.color);if(d.explodeHit)B.glow.add(x,1,z,d.size*0.6,d.size*0.6,d.size*0.6,col);else{B.solid.add(x,1,z,d.size*1.4,0.08,d.size*0.4,col,-a+S.t*20);B.glow.add(x,1,z,d.size*0.5,0.1,d.size*0.5,col);}
      w.hit=w.hit||new Map();queryEnemies(x,z,d.size+0.8,e=>{const lh=w.hit.get(e.id)||0;if(S.t-lh>0.35){w.hit.set(e.id,S.t);hurtEnemy(e,st.dmg,{kx:Math.cos(a),kz:Math.sin(a),kb:4});if(d.explodeHit)burst(x,1,z,4,d.color,4);}});}
    if(w.hit&&w.hit.size>500)w.hit.clear(); return;}
  if(d.type==='aura'){const R=d.radius*st.area;B.ring.add(S.x,0.15,S.z,R,1,R,wcolor(d.color));B.glow.add(S.x,0.1,S.z,R,0.05,R,d.burn?0x401000:0x202010);
    if(Math.random()<0.5)spark(S.x+rand(-R,R),0.3,S.z+rand(-R,R),d.color,0,2,0,0.5,0.15);}
  w.t-=dt; if(w.t>0)return; 
  const tgt=nearestEnemy(S.x,S.z,d.type==='mine'||d.type==='aura'||d.type==='nova'?99:24);
  if(!tgt&&!['mine','aura','nova'].includes(d.type)){w.t=0.1;return;}
  w.t=st.cd;
  const ax=tgt?Math.atan2(tgt.z-S.z,tgt.x-S.x):S.face;
  if(tgt)S.aim=ax;
  const col=wcolor(d.color);
  switch(d.type){
    case 'proj':{const n=st.count;for(let i=0;i<n;i++){const a=ax+(n>1?(i/(n-1)-0.5)*d.spread*Math.min(2,1+n*0.05):0)+rand(-1,1)*(n>1?0.03:d.spread);
        projs.push({x:S.x+Math.cos(a)*0.6,z:S.z+Math.sin(a)*0.6,y:1.1,vx:Math.cos(a)*d.spd,vz:Math.sin(a)*d.spd,life:d.life,dmg:st.dmg,pierce:d.pierce,size:d.size*(d.explode?1:Math.sqrt(st.area)),col,hits:null,explode:d.explode?d.explode*st.area:0,freeze:d.freeze,homing:d.homing,chainHit:d.chainHit,trail:d.explode||d.size>0.5});}
      muzzle(ax,col);sfx(d.explode?'rocket':d.id==='plasma'||d.size>0.5?'plasma':n>3?'shotgun':d.freeze?'freeze':'shoot');break;}
    case 'flame':{for(let i=0;i<2;i++){const a=ax+rand(-d.spread,d.spread);projs.push({x:S.x+Math.cos(a)*0.6,z:S.z+Math.sin(a)*0.6,y:1,vx:Math.cos(a)*d.spd*rand(0.8,1.2),vz:Math.sin(a)*d.spd*rand(0.8,1.2),life:d.life*st.area,maxLife:d.life*st.area,dmg:st.dmg,pierce:99,size:d.size,col,flame:1,burn:1,hits:null});}sfx('flame',0.09);break;}
    case 'beam':{const L=d.len*st.area,ex=S.x+Math.cos(ax)*L,ez=S.z+Math.sin(ax)*L;fx.push({type:'beam',x1:S.x,z1:S.z,x2:ex,z2:ez,w:d.width*st.area,col,life:0.18,max:0.18});
      for(const e of enemies.slice()){const t=((e.x-S.x)*Math.cos(ax)+(e.z-S.z)*Math.sin(ax));if(t<0||t>L)continue;const px=S.x+Math.cos(ax)*t,pz=S.z+Math.sin(ax)*t;if(Math.hypot(e.x-px,e.z-pz)<e.r+d.width*st.area){hurtEnemy(e,st.dmg,{freeze:d.freeze,kx:Math.cos(ax),kz:Math.sin(ax),kb:2});}}
      muzzle(ax,col);sfx('laser');S.shake=Math.max(S.shake,d.dmg>50?0.25:0.05);break;}
    case 'chain':{let cx=S.x,cz=S.z,cur=tgt;const hit=new Set();for(let i=0;i<d.chain+Math.floor((w.lvl-1)/2);i++){if(!cur)break;hit.add(cur.id);fx.push({type:'bolt',x1:cx,z1:cz,x2:cur.x,z2:cur.z,col,life:0.15,max:0.15});
        hurtEnemy(cur,st.dmg,{burn:d.burn});spark(cur.x,1,cur.z,col,0,0,0,0.3,0.2,6);cx=cur.x;cz=cur.z;cur=nearestEnemy(cx,cz,d.range*0.6,hit);}sfx('zap');break;}
    case 'boomer':{for(let i=0;i<st.count;i++){const a=ax+(i-(st.count-1)/2)*0.4;projs.push({x:S.x,z:S.z,y:1,vx:Math.cos(a)*d.spd,vz:Math.sin(a)*d.spd,life:d.life,dmg:st.dmg,pierce:99,size:d.size*st.area,col,boomer:1,age:0,hits:new Map(),spin:1});}sfx('whoosh');break;}
    case 'mine':{mines.push({x:S.x,z:S.z,dmg:st.dmg,r:d.explode*st.area,arm:0.5,life:20,col});sfx('click');break;}
    case 'meteor':{for(let i=0;i<st.count;i++){const e=i===0&&tgt?tgt:pick(enemies);if(!e)break;meteors.push({x:e.x+rand(-1,1),z:e.z+rand(-1,1),t:0.8+i*0.12,dmg:st.dmg,r:d.explode*st.area,col});}break;}
    case 'nova':{const R=d.radius*st.area;fx.push({type:'nova',x:S.x,z:S.z,r:R,col,life:0.45,max:0.45});queryEnemies(S.x,S.z,R,e=>{const dx=e.x-S.x,dz=e.z-S.z,l=Math.hypot(dx,dz)||1;hurtEnemy(e,st.dmg,{kx:dx/l,kz:dz/l,kb:8,freeze:d.freeze,burn:d.burn});});sfx('boom');S.shake=Math.max(S.shake,0.15);break;}
    case 'aura':{const R=d.radius*st.area;queryEnemies(S.x,S.z,R,e=>hurtEnemy(e,st.dmg,{burn:d.burn,quiet:1}));break;}
  }
}
function muzzle(a,col){const x=S.x+Math.cos(a)*0.8,z=S.z+Math.sin(a)*0.8;fx.push({type:'flash',x,z,col,life:0.06,max:0.06});for(let i=0;i<3;i++)spark(x,1.1,z,col,Math.cos(a+rand(-.5,.5))*6,rand(0,2),Math.sin(a+rand(-.5,.5))*6,0.15,0.12);}

// ================== ENEMIGOS ==================
const grid=new Map(),GC=3;let gridUsed=[];
function gkey(cx,cz){return (cx+50000)*100000+(cz+50000);}
function buildGrid(){for(const a of gridUsed)a.length=0;gridUsed=[];for(const e of enemies){const k=gkey(Math.floor(e.x/GC),Math.floor(e.z/GC));let a=grid.get(k);if(!a){a=[];grid.set(k,a);}if(a.length===0)gridUsed.push(a);a.push(e);} if(grid.size>4000)grid.clear();}
function queryEnemies(x,z,r,cb){const r2=r+2;const x0=Math.floor((x-r2)/GC),x1=Math.floor((x+r2)/GC),z0=Math.floor((z-r2)/GC),z1=Math.floor((z+r2)/GC);
  for(let i=x0;i<=x1;i++)for(let j=z0;j<=z1;j++){const a=grid.get(gkey(i,j));if(!a)continue;for(let k=a.length-1;k>=0;k--){const e=a[k];if(e.dead)continue;const dx=e.x-x,dz=e.z-z,rr=r+e.r;if(dx*dx+dz*dz<rr*rr)cb(e);}}}
function spawnEnemy(fam,role,x,z){
  const R=ROLES[role],F=FAMS[fam],w=S.wave;const hpM=1+(w-1)*0.28+w*w*0.012,spM=Math.min(1.7,1+(w-1)*0.025);
  const bossM=role==='jefe'?(1+Math.floor(w/5)*0.6):1;
  const col=new THREE.Color(F.color);if(R.tint)col.lerp(new THREE.Color(R.tint),0.45);if(role==='tanque')col.multiplyScalar(0.7);
  enemies.push({id:eid++,fam,role,x,z,vx:0,vz:0,hp:R.hp*hpM*bossM,max:R.hp*hpM*bossM,spd:R.spd*spM*rand(0.9,1.1),r:R.r,dmg:R.dmg*(1+w*0.04),xp:R.xp,s:R.s,col,mesh:F.mesh,eye:F.eye,
    hitT:0,frz:0,burn:0,atk:rand(1,3),fuse:-1,face:0,bob:Math.random()*6,boss:R.boss,ranged:R.ranged,explode:R.explode,dead:false,spawnT:0.4});
  return enemies[enemies.length-1];
}
function hurtEnemy(e,dmg,o={}){
  if(e.dead)return; let crit=Math.random()<S.crit; if(crit)dmg*=2; e.hp-=dmg; e.hitT=0.1;
  if(o.freeze)e.frz=Math.max(e.frz,o.freeze); if(o.burn)e.burn=Math.max(e.burn,2.5);
  if(o.kb&&!e.boss){const k=o.kb/(e.role==='tanque'?3:1);e.vx+=o.kx*k;e.vz+=o.kz*k;}
  if(!o.quiet||Math.random()<0.2)dmgNum(e.x,1.6*e.s,e.z,dmg,crit?'#ffdd33':o.burn?'#ff8a3a':'#fff',crit);
  if(!o.quiet)sfx('hit',0.06);
  if(e.hp<=0)killEnemy(e);
}
function killEnemy(e){
  e.dead=true;S.kills++;S.waveKills++;sfx('kill');
  burst(e.x,0.8,e.z,e.boss?80:8,e.col.getHex(),e.boss?12:5);
  // drops
  const gems=e.boss?20:1;for(let i=0;i<gems;i++)drop(e.x+rand(-.5,.5)*(e.boss?4:0),e.z+rand(-.5,.5)*(e.boss?4:0),'xp',e.boss?e.xp/10:e.xp);
  if(Math.random()<(e.boss?1:0.07+(e.role==='tanque'?0.3:0))){const n=e.boss?25:1;for(let i=0;i<n;i++)drop(e.x+rand(-2,2)*(e.boss?1:0),e.z+rand(-2,2)*(e.boss?1:0),'coin',1);}
  if(Math.random()<0.012)drop(e.x,e.z,'heart',20);
  if(Math.random()<(e.boss?1:0.006))drop(e.x,e.z,pick(['iman','bomba','furia']),0);
  if(e.boss){drop(e.x,e.z,'chest',0);S.shake=1;sfx('boom');fx.push({type:'nova',x:e.x,z:e.z,r:8,col:0xffaa33,life:0.6,max:0.6});if(S.boss===e)S.boss=null;banner('¡JEFE DERROTADO!');}
}
function drop(x,z,type,val){if(pickups.length>900&&type==='xp'){const p=pickups.find(p=>p.type==='xp');if(p){p.val+=val;return;}}pickups.push({x,z,type,val,t:0,vy:type==='coin'?4:3,y:0.5,mag:false});}
function explodeAt(x,z,r,dmg,col,hurtPlayer){
  fx.push({type:'nova',x,z,r,col,life:0.35,max:0.35});burst(x,0.6,z,30,col,9);burst(x,0.6,z,12,0x555555,4,1.2);sfx('boom',0.08);S.shake=Math.max(S.shake,0.3);
  if(hurtPlayer){if(Math.hypot(S.x-x,S.z-z)<r)hurtPlayer2(dmg);}else queryEnemies(x,z,r,e=>{const dx=e.x-x,dz=e.z-z,l=Math.hypot(dx,dz)||1;hurtEnemy(e,dmg,{kx:dx/l,kz:dz/l,kb:6,quiet:0});});
}
function hurtPlayer2(d){if(S.inv>0||mode!=='play')return;d*=Math.max(0.3,1-S.armor);S.hp-=d;S.inv=0.5;S.shake=Math.max(S.shake,0.35);sfx('hurt');dmgNum(S.x,2.2,S.z,d,'#ff4a4a',true);flashScreen();
  if(S.hp<=0){if(S.revive){S.revive=false;S.hp=S.maxHp*0.6;S.inv=3;banner('👼 ¡SEGUNDA VIDA!');explodeAt(S.x,S.z,10,999,0xffffff,false);}else gameOver();}}
let flashEl=null;function flashScreen(){canvas.style.filter='brightness(1.6) saturate(.4) sepia(.6) hue-rotate(-40deg)';clearTimeout(flashEl);flashEl=setTimeout(()=>canvas.style.filter='',90);}

// ================== OLEADAS (infinitas) ==================
function nextWave(){
  S.wave++;S.waveKills=0;S.spawned=0;S.waveQuota=Math.floor(25+S.wave*12+S.wave*S.wave*0.6);S.spawnT=0;S.hordeDone=false;
  const bossW=S.wave%5===0;
  if(bossW){const fam=['zombi','monstruo','alien'][(S.wave/5-1)%3];const a=Math.random()*6.28;const b=spawnEnemy(fam,'jefe',S.x+Math.cos(a)*20,S.z+Math.sin(a)*20);S.boss=b;
    banner(`⚠️ OLEADA ${S.wave}: ${FAMS[fam].boss.toUpperCase()} ⚠️`);sfx('boss');setIntensity(2);}
  else {banner(`OLEADA ${S.wave}`);sfx('wave');setIntensity(S.wave>=10?1:0);}
}
function spawnTick(dt){
  if(S.breakT>0){S.breakT-=dt;return;}
  const maxAlive=isMobile?220:380;
  S.spawnT-=dt;
  if(S.spawnT<=0&&S.spawned<S.waveQuota&&enemies.length<maxAlive){
    S.spawnT=Math.max(0.12,0.9-S.wave*0.04);
    const grp=Math.min(S.waveQuota-S.spawned,2+Math.floor(S.wave/2)+Math.floor(Math.random()*3));
    const a0=Math.random()*Math.PI*2;
    for(let i=0;i<grp;i++){const a=a0+rand(-0.5,0.5),d=rand(24,30);spawnEnemy(pickFam(),pickRole(),S.x+Math.cos(a)*d,S.z+Math.sin(a)*d);S.spawned++;}
  }
  // horda masiva a mitad de oleada
  if(!S.hordeDone&&S.wave>=3&&S.spawned>S.waveQuota*0.5){S.hordeDone=true;const n=Math.min(30+S.wave*3,maxAlive-enemies.length);if(n>10){toast('☠️ ¡Una horda te rodea!');const f=pickFam();
    for(let i=0;i<n;i++){const a=i/n*Math.PI*2;spawnEnemy(f,Math.random()<0.7?'normal':'rapido',S.x+Math.cos(a)*22,S.z+Math.sin(a)*22);}S.waveQuota+=n;S.spawned+=n;}}
  if(S.spawned>=S.waveQuota&&S.waveKills>=S.waveQuota&&!S.boss){S.breakT=3;nextWave();}
}
function pickFam(){const f=['zombi'];if(S.wave>=2)f.push('monstruo');if(S.wave>=4)f.push('alien');return pick(f);}
function pickRole(){const w=S.wave,r=Math.random();if(w>=4&&r<0.08)return 'explosivo';if(w>=3&&r<0.16)return 'tirador';if(w>=3&&r<0.24)return 'tanque';if(w>=2&&r<0.42)return 'rapido';return 'normal';}

// ================== MASCOTAS ==================
function buildPet(type){const g=new THREE.Group(),c=PETS[type].color,m=std(c);
  if(type==='dron'){const b=new THREE.Mesh(new THREE.SphereGeometry(0.3,12,8),std(c,{metalness:0.8,roughness:0.3}));g.add(b);const e=new THREE.Mesh(new THREE.SphereGeometry(0.1),new THREE.MeshBasicMaterial({color:0xff3a3a}));e.position.z=0.27;g.add(e);
    const r=new THREE.Mesh(new THREE.TorusGeometry(0.45,0.04,6,20),std(0x333333));r.rotation.x=Math.PI/2;g.add(r);g.userData.fly=1;}
  else{const b=new THREE.Mesh(new THREE.BoxGeometry(0.4,0.35,0.7),m);b.position.y=0.4;g.add(b);const h=new THREE.Mesh(new THREE.BoxGeometry(0.35,0.32,0.32),m);h.position.set(0,0.65,0.42);g.add(h);
    for(const s of[-1,1]){const ear=new THREE.Mesh(new THREE.ConeGeometry(0.07,0.18,4),m);ear.position.set(s*0.12,0.88,0.42);g.add(ear);const e=new THREE.Mesh(new THREE.SphereGeometry(0.04),std(0x111111));e.position.set(s*0.09,0.7,0.59);g.add(e);
      for(const f of[-1,1]){const l=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.25,0.1),m);l.position.set(s*0.14,0.12,f*0.25);g.add(l);}}
    const t=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.08,0.4),m);t.position.set(0,0.55,-0.45);t.rotation.x=-0.6;g.add(t);
    if(type==='dragon'){for(const s of[-1,1]){const wg=new THREE.Mesh(new THREE.ConeGeometry(0.3,0.6,3),std(0xff8a3a));wg.position.set(s*0.35,0.7,0);wg.rotation.z=s*1.3;g.add(wg);}g.userData.fly=1;}}
  g.traverse(o=>o.isMesh&&(o.castShadow=true));scene.add(g);return g;}
function addPet(type){const a=Math.random()*6;pets.push({type,x:S.x+Math.cos(a)*2,z:S.z+Math.sin(a)*2,g:buildPet(type),t:0,cd:0,tgt:null});renderPets();}
function updatePets(dt){
  for(const p of pets){
    let tx=S.x+Math.cos(S.t*0.7+pets.indexOf(p)*2)*2.5,tz=S.z+Math.sin(S.t*0.7+pets.indexOf(p)*2)*2.5,spd=9;
    if(p.type==='gato'){let best=null,bd=144;for(const q of pickups){const d=(q.x-p.x)**2+(q.z-p.z)**2;if(d<bd&&!q.mag){bd=d;best=q;}}if(best){tx=best.x;tz=best.z;spd=11;if(bd<1)best.mag=true;}}
    const e=nearestEnemy(p.x,p.z,p.type==='perro'?9:12);
    if(p.type==='perro'&&e&&Math.hypot(e.x-S.x,e.z-S.z)<12){tx=e.x;tz=e.z;spd=10;}
    p.cd-=dt;
    if(e&&p.cd<=0){const dd=Math.hypot(e.x-p.x,e.z-p.z),pw=1+S.wave*0.15;
      if((p.type==='perro'||p.type==='gato')&&dd<e.r+0.9){hurtEnemy(e,(p.type==='perro'?18:10)*pw,{kx:(e.x-p.x)/dd,kz:(e.z-p.z)/dd,kb:5});p.cd=p.type==='perro'?0.5:0.4;burst(e.x,0.8,e.z,4,0xffffff,3);}
      if(p.type==='dron'){const a=Math.atan2(e.z-p.z,e.x-p.x);projs.push({x:p.x,z:p.z,y:1.6,vx:Math.cos(a)*24,vz:Math.sin(a)*24,life:1,dmg:9*pw,pierce:1,size:0.15,col:0x6aff6a,hits:null});p.cd=0.35;sfx('shoot');}
      if(p.type==='dragon'&&dd<7){const a=Math.atan2(e.z-p.z,e.x-p.x);for(let i=0;i<3;i++)projs.push({x:p.x,z:p.z,y:1.3,vx:Math.cos(a+rand(-.3,.3))*10,vz:Math.sin(a+rand(-.3,.3))*10,life:0.5,maxLife:0.5,dmg:4*pw,pierce:99,size:0.3,col:0xff6a1a,flame:1,burn:1,hits:null});p.cd=0.08;}
    }
    // recogida por mascota
    for(const q of pickups){if(!q.mag&&(q.x-p.x)**2+(q.z-p.z)**2<2.5)q.mag=true;}
    const dx=tx-p.x,dz=tz-p.z,d=Math.hypot(dx,dz);if(d>0.3){const m=Math.min(d,spd*dt);p.x+=dx/d*m;p.z+=dz/d*m;p.g.rotation.y=Math.atan2(dx,dz);}
    if(Math.hypot(S.x-p.x,S.z-p.z)>20){p.x=S.x;p.z=S.z;}
    p.t+=dt;p.g.position.set(p.x,(p.g.userData.fly?1.4+Math.sin(p.t*4)*0.2:Math.abs(Math.sin(p.t*14))*(d>0.3?0.2:0)),p.z);
    B.shadow.add(p.x,0,p.z,0.4,1,0.4,0);
  }
}

// ================== PARTÍCULAS / FX ==================
function spark(x,y,z,col,vx,vy,vz,life,size,n=1){for(let i=0;i<n;i++){if(parts.length>2500)parts.shift();parts.push({x,y,z,vx:vx+(n>1?rand(-3,3):0),vy:vy+(n>1?rand(0,4):0),vz:vz+(n>1?rand(-3,3):0),life,max:life,size,col,g:n>1?12:0});}}
function burst(x,y,z,n,col,spd,size=0.25){for(let i=0;i<n;i++){const a=Math.random()*6.28,s=rand(0.3,1)*spd;if(parts.length>2500)parts.shift();parts.push({x,y,z,vx:Math.cos(a)*s,vy:rand(2,1+spd),vz:Math.sin(a)*s,life:rand(0.3,0.8),max:0.8,size:size*rand(0.6,1.4),col,g:18});}}
const dnEls=[];let dnIdx=0;const dnBox=$('dmg');for(let i=0;i<50;i++){const d=document.createElement('div');d.className='dn';d.style.display='none';dnBox.appendChild(d);dnEls.push({el:d,life:0});}
function dmgNum(x,y,z,v,col,big){const d=dnEls[dnIdx++%dnEls.length];d.life=0.7;d.x=x+rand(-.3,.3);d.y=y;d.z=z;d.el.textContent=Math.round(v);d.el.style.color=col;d.el.style.fontSize=(big?22:15)+'px';d.el.style.display='block';}
const _v=new THREE.Vector3();
function updateDmgNums(dt){const w=innerWidth,h=innerHeight;for(const d of dnEls){if(d.life<=0)continue;d.life-=dt;d.y+=dt*2;if(d.life<=0){d.el.style.display='none';continue;}
  _v.set(d.x,d.y,d.z).project(camera);d.el.style.transform=`translate(${(_v.x*0.5+0.5)*w-10}px,${(-_v.y*0.5+0.5)*h}px) scale(${0.6+d.life})`;d.el.style.opacity=Math.min(1,d.life*3);}}

// ================== UPDATE ==================
function update(dt){
  S.t+=dt;S.time+=dt;S.inv-=dt;S.fury-=dt;
  if(S.regen>0)S.hp=Math.min(S.maxHp,S.hp+S.regen*dt);
  // movimiento
  let mx=0,mz=0;if(keys.KeyW||keys.ArrowUp)mz-=1;if(keys.KeyS||keys.ArrowDown)mz+=1;if(keys.KeyA||keys.ArrowLeft)mx-=1;if(keys.KeyD||keys.ArrowRight)mx+=1;
  if(joy.active){mx=joy.x;mz=joy.z;} const ml=Math.hypot(mx,mz);if(ml>1){mx/=ml;mz/=ml;}
  const moving=ml>0.1;
  if(moving){S.face=Math.atan2(mz,mx);let nx=S.x+mx*S.spd*dt,nz=S.z+mz*S.spd*dt;
    // auto-salto sobre obstáculos bajos
    if(S.y<=0.001){let jump=false;obsNear(nx+mx*0.5,nz+mz*0.5,(o,dx,dz)=>{if(o.small&&dx*dx+dz*dz<(o.r+0.45)**2)jump=true;});if(jump){S.vy=8.5;S.y=0.01;sfx('jump');spark(S.x,0.1,S.z,0xdddddd,0,1,0,0.4,0.2,6);}}
    S.x=nx;S.z=nz;}
  if(S.y>0||S.vy>0){S.vy-=24*dt;S.y+=S.vy*dt;if(S.y<=0){S.y=0;S.vy=0;spark(S.x,0.1,S.z,0xcccccc,0,1,0,0.3,0.15,4);}}
  obsNear(S.x,S.z,(o,dx,dz)=>{if(o.small&&S.y>o.h*0.6)return;const rr=o.r+0.4,d2=dx*dx+dz*dz;if(d2<rr*rr){const d=Math.sqrt(d2)||1;S.x=o.x+dx/d*rr;S.z=o.z+dz/d*rr;}});
  player.position.set(S.x,S.y,S.z);const fa=S.aim!==undefined&&nearestEnemy(S.x,S.z,24)?S.aim:S.face;
  player.rotation.y+=(((Math.PI/2-fa)-player.rotation.y+Math.PI*3)%(Math.PI*2)-Math.PI)*Math.min(1,dt*12);
  animChar(player,S.t,moving,S.y>0.05);player.visible=!(S.inv>0&&Math.floor(S.t*20)%2);
  B.shadow.add(S.x,0,S.z,0.6-S.y*0.1,1,0.6-S.y*0.1,0);
  updateChunks(S.x,S.z);
  ground.position.set(Math.round(S.x/TILE)*TILE,0,Math.round(S.z/TILE)*TILE);
  sun.position.set(S.x+15,30,S.z+10);sun.target.position.set(S.x,0,S.z);
  // cámara
  S.shake=Math.max(0,S.shake-dt*1.8);const sh=S.shake*S.shake*1.2;
  camera.position.set(S.x+rand(-sh,sh),21+rand(-sh,sh),S.z+11.5);camera.lookAt(S.x,0,S.z+1);
  spawnTick(dt);buildGrid();
  for(const w of S.weapons)fireWeapon(w,dt);
  updateEnemies(dt);updateProjs(dt);updatePickups(dt);updatePets(dt);updateFx(dt);
  // cajas
  S.crateT-=dt;if(S.crateT<=0){S.crateT=35;const a=Math.random()*6.28;crates.push(makeCrate(S.x+Math.cos(a)*12,S.z+Math.sin(a)*12));const c=crates[crates.length-1];
    // caja suelta: guardarla en el chunk más cercano para limpieza
    const k=Math.floor(c.x/CH)+','+Math.floor(c.z/CH);const ch=chunks.get(k);if(ch)ch.crates.push(c);}
  for(const c of crates){if(c.open)continue;c.g.rotation.y+=dt;c.g.position.y=0.6+Math.sin(S.t*3)*0.1;if(Math.random()<0.1)spark(c.x+rand(-.6,.6),0.4,c.z+rand(-.6,.6),0xffd84a,0,2,0,0.6,0.12);
    if((c.x-S.x)**2+(c.z-S.z)**2<1.8){openCrate(c);}}
  // mascota abre? no
  if(S.pendingLv>0&&mode==='play')showLevelUp();
  hudUpdate();
}
function updateEnemies(dt){
  for(let i=enemies.length-1;i>=0;i--){const e=enemies[i];if(e.dead){enemies.splice(i,1);continue;}
    e.hitT-=dt;e.frz-=dt;e.spawnT-=dt;
    if(e.burn>0){e.burn-=dt;e.bt=(e.bt||0)-dt;if(e.bt<=0){e.bt=0.4;hurtEnemy(e,3+S.wave*0.8,{quiet:1});if(e.dead)continue;}if(Math.random()<0.3)spark(e.x,1,e.z,0xff6a1a,0,2,0,0.4,0.18);}
    const dx=S.x-e.x,dz=S.z-e.z,d=Math.hypot(dx,dz)||1;
    let sp=e.spd*(e.frz>0?0.35:1);
    if(d>60){enemies.splice(i,1);S.spawned--;continue;} // demasiado lejos, re-spawnear
    let wx=dx/d,wz=dz/d;
    if(e.ranged&&d<9){wx=-wx*0.5;wz=-wz*0.5;}
    if(e.boss){e.atk-=dt;if(e.atk<=0){e.atk=2.2;const n=10+Math.floor(S.wave/5)*2;for(let k=0;k<n;k++){const a=k/n*6.28+S.t;eprojs.push({x:e.x,z:e.z,vx:Math.cos(a)*8,vz:Math.sin(a)*8,life:3,dmg:e.dmg*0.5,col:e.eye});}
        if(Math.random()<0.4){e.vx+=wx*18;e.vz+=wz*18;}sfx('rocket');}}
    else if(e.ranged){e.atk-=dt;if(e.atk<=0&&d<16){e.atk=rand(1.8,2.8);eprojs.push({x:e.x,z:e.z,vx:wx*0+dx/d*9,vz:dz/d*9,life:2.5,dmg:e.dmg,col:e.eye});}}
    if(e.explode&&d<1.8&&e.fuse<0)e.fuse=0.45;
    if(e.fuse>=0){e.fuse-=dt;sp*=0.2;if(e.fuse<=0){e.dead=true;explodeAt(e.x,e.z,2.8,e.dmg,0xff6a1a,true);explodeAt(e.x,e.z,2.8,30,0xff6a1a,false);S.waveKills++;enemies.splice(i,1);continue;}}
    e.vx*=Math.pow(0.02,dt);e.vz*=Math.pow(0.02,dt);
    e.x+=(wx*sp+e.vx)*dt;e.z+=(wz*sp+e.vz)*dt;
    // separación
    let n=0;queryEnemies(e.x,e.z,e.r,o=>{if(o===e||n>6)return;n++;const ox=e.x-o.x,oz=e.z-o.z,od=Math.hypot(ox,oz)||0.01,ov=(e.r+o.r-od);if(ov>0){const p=Math.min(ov,0.5)*0.5*(o.boss?2:1)*(e.boss?0.1:1);e.x+=ox/od*p;e.z+=oz/od*p;}});
    if(!e.boss)obsNear(e.x,e.z,(o,ox,oz)=>{if(o.small)return;const rr=o.r+e.r,d2=ox*ox+oz*oz;if(d2<rr*rr){const dd=Math.sqrt(d2)||1;e.x=o.x+ox/dd*rr+(-oz/dd)*0.05;e.z=o.z+oz/dd*rr+(ox/dd)*0.05;}});
    e.face=Math.atan2(dx,dz);
    if(d<e.r+0.5&&S.y<1.2)hurtPlayer2(e.dmg);
    // render
    const s=e.s*(e.spawnT>0?1-e.spawnT/0.4*0.9:1)*(e.fuse>=0?1+Math.sin(S.t*40)*0.15:1);e.bob+=dt*sp*3;const by=Math.abs(Math.sin(e.bob))*0.12*s;
    const col=e.hitT>0?0xffffff:e.frz>0?0x9adfff:e.col;
    const bt=e.mesh===0?B.e0:e.mesh===1?B.e1:B.e2;
    if(e.mesh===0)bt.add(e.x,by,e.z,0.85*s,1.5*s,0.6*s,col,e.face+Math.sin(e.bob)*0.1);
    else if(e.mesh===1)bt.add(e.x,by,e.z,1.3*s,1.0*s,1.3*s,col,e.face+e.bob*0.2);
    else bt.add(e.x,by+Math.sin(e.bob*0.5)*0.15*s,e.z,0.9*s,1*s,0.9*s,col,e.face);
    const eh=(e.mesh===0?1.25:e.mesh===1?0.85:1.05)*s+by,fx2=Math.sin(e.face),fz2=Math.cos(e.face),er=(e.mesh===0?0.3:0.42)*s;
    B.eye.add(e.x+fx2*er,eh,e.z+fz2*er,0.5*s,0.1*s,0.06,e.eye,e.face);
    if(e.mesh===0){for(const sd of[-1,1])B.limb.add(e.x+fx2*0.4*s+fz2*sd*0.32*s,0.95*s+by,e.z+fz2*0.4*s-fx2*sd*0.32*s,0.18*s,0.18*s,0.7*s,col,e.face);}
    else if(e.mesh===2){B.limb.add(e.x,1.5*s+by,e.z,0.06*s,0.5*s,0.06*s,col,e.face);B.glow.add(e.x,1.8*s+by,e.z,0.1*s,0.1*s,0.1*s,e.eye);}
    else{for(const sd of[-1,1])B.limb.add(e.x+fz2*sd*0.35*s,1.1*s+by,e.z-fx2*sd*0.35*s,0.12*s,0.4*s,0.12*s,0xeeeecc,e.face,sd*0.4);}
    B.shadow.add(e.x,0,e.z,e.r*1.1,1,e.r*1.1,0);
    if(e.boss){B.ring.add(e.x,0.1,e.z,e.r*1.6,1,e.r*1.6,0xff2020);}
  }
  for(let i=eprojs.length-1;i>=0;i--){const p=eprojs[i];p.x+=p.vx*dt;p.z+=p.vz*dt;p.life-=dt;B.glow.add(p.x,1,p.z,0.3,0.3,0.3,p.col);B.glow.add(p.x,1,p.z,0.5,0.5,0.5,0x330000);
    if((p.x-S.x)**2+(p.z-S.z)**2<0.5&&S.y<1.5){hurtPlayer2(p.dmg);p.life=0;}if(p.life<=0)eprojs.splice(i,1);}
}
function updateProjs(dt){
  for(let i=projs.length-1;i>=0;i--){const p=projs[i];p.life-=dt;
    if(p.homing){const e=nearestEnemy(p.x,p.z,12);if(e){const a=Math.atan2(e.z-p.z,e.x-p.x),cur=Math.atan2(p.vz,p.vx),sp=Math.hypot(p.vx,p.vz);let da=((a-cur+Math.PI*3)%(Math.PI*2))-Math.PI;const na=cur+clamp(da,-6*dt,6*dt);p.vx=Math.cos(na)*sp;p.vz=Math.sin(na)*sp;}}
    if(p.boomer){p.age+=dt;if(p.age>0.55){const dx=S.x-p.x,dz=S.z-p.z,d=Math.hypot(dx,dz)||1;p.vx+=dx/d*45*dt;p.vz+=dz/d*45*dt;const sp=Math.hypot(p.vx,p.vz);if(sp>20){p.vx*=20/sp;p.vz*=20/sp;}if(d<0.8&&p.age>0.8)p.life=0;}}
    if(p.flame){p.vx*=Math.pow(0.15,dt);p.vz*=Math.pow(0.15,dt);}
    p.x+=p.vx*dt;p.z+=p.vz*dt;
    // render
    if(p.flame){const k=1-p.life/p.maxLife;const s=p.size*(0.5+k*2.2);B.glow.add(p.x,p.y+k,p.z,s,s,s,_c.setHex(p.col).lerp(_tmpC.setHex(0x601000),k));}
    else if(p.boomer){B.solid.add(p.x,p.y,p.z,p.size*1.6,0.12,p.size*0.5,p.col,S.t*25);B.solid.add(p.x,p.y,p.z,p.size*0.5,0.12,p.size*1.6,p.col,S.t*25);}
    else{B.glow.add(p.x,p.y,p.z,p.size,p.size,p.size,p.col);B.glow.add(p.x-p.vx*0.015,p.y,p.z-p.vz*0.015,p.size*1.8,p.size*1.8,p.size*1.8,_tmpC.setHex(p.col).multiplyScalar(0.25));
      if(p.trail&&Math.random()<0.7)spark(p.x,p.y,p.z,p.explode?0x888888:p.col,rand(-.5,.5),rand(0,1),rand(-.5,.5),0.4,p.size*0.8);}
    // colisión
    if(p.life>0){const hitR=p.size*0.8;let done=false;
      queryEnemies(p.x,p.z,hitR,e=>{if(done||e.dead)return;if(p.hits){if(p.boomer){const lt=p.hits.get(e.id);if(lt&&S.t-lt<0.3)return;p.hits.set(e.id,S.t);}else{if(p.hits.has(e.id))return;p.hits.add(e.id);}}else if(p.pierce>1)p.hits=new Set([e.id]);
        const sp=Math.hypot(p.vx,p.vz)||1;
        if(p.explode){explodeAt(p.x,p.z,p.explode,p.dmg,0xff8a2a,false);p.life=0;done=true;return;}
        hurtEnemy(e,p.dmg,{freeze:p.freeze,burn:p.burn,kx:p.vx/sp,kz:p.vz/sp,kb:p.flame?0.5:2.5,quiet:p.flame?1:0});
        if(p.chainHit){let c=e,h=new Set([e.id]);for(let k=0;k<p.chainHit;k++){const n=nearestEnemy(c.x,c.z,6,h);if(!n)break;h.add(n.id);fx.push({type:'bolt',x1:c.x,z1:c.z,x2:n.x,z2:n.z,col:0x8ae8ff,life:0.12,max:0.12});hurtEnemy(n,p.dmg*0.5,{quiet:1});c=n;}sfx('zap',0.1);}
        if(!p.flame)spark(p.x,p.y,p.z,p.col,0,0,0,0.25,0.14,3);
        p.pierce--;if(p.pierce<=0){p.life=0;done=true;}});}
    if(p.life<=0){if(p.explode&&p.life>-1)explodeAt(p.x,p.z,p.explode,p.dmg,0xff8a2a,false);projs.splice(i,1);}
  }
  // minas
  for(let i=mines.length-1;i>=0;i--){const m=mines[i];m.arm-=dt;m.life-=dt;B.solid.add(m.x,0.12,m.z,0.5,0.2,0.5,0x333333,0);B.glow.add(m.x,0.28,m.z,0.1,0.1,0.1,Math.floor(S.t*4)%2?m.col:0x220000);
    let boom=m.life<=0;if(m.arm<=0)queryEnemies(m.x,m.z,0.8,()=>boom=true);if(boom){explodeAt(m.x,m.z,m.r,m.dmg,0xff4a1a,false);mines.splice(i,1);}}
  // meteoros
  for(let i=meteors.length-1;i>=0;i--){const m=meteors[i];m.t-=dt;B.ring.add(m.x,0.12,m.z,m.r*(1-m.t*0.3),1,m.r*(1-m.t*0.3),0xff3a1a);const h=m.t*25;B.glow.add(m.x+h*0.3,h,m.z-h*0.2,0.8,0.8,0.8,m.col);spark(m.x+h*0.3,h,m.z-h*0.2,0xffaa33,0,0,0,0.3,0.4);
    if(m.t<=0){explodeAt(m.x,m.z,m.r,m.dmg,0xff6a1a,false);meteors.splice(i,1);}}
}
const _tmpC=new THREE.Color();
function updatePickups(dt){
  const mag2=S.magnet*S.magnet;
  for(let i=pickups.length-1;i>=0;i--){const p=pickups[i];p.t+=dt;if(p.y>0.4||p.vy>0){p.vy-=15*dt;p.y=Math.max(0.4,p.y+p.vy*dt);}
    const dx=S.x-p.x,dz=S.z-p.z,d2=dx*dx+dz*dz;
    if(d2<mag2||p.mag){p.mag=true;const d=Math.sqrt(d2)||1,sp=Math.min(30,8+p.t*10);p.x+=dx/d*sp*dt;p.z+=dz/d*sp*dt;}
    if(d2<0.6){collect(p);pickups.splice(i,1);continue;}
    if(d2>3600){pickups.splice(i,1);continue;}
    const bob=Math.sin(p.t*4+i)*0.1;
    if(p.type==='xp'){const s=0.18+Math.min(0.25,p.val*0.03);B.gem.add(p.x,p.y+bob,p.z,s,s*1.4,s,p.val>=5?0xff5aff:p.val>=2?0x3aff8a:0x3ac8ff,p.t*3);}
    else if(p.type==='coin')B.solid.add(p.x,p.y+bob,p.z,0.4,0.4,0.08,0xffd030,p.t*4);
    else if(p.type==='heart')B.gem.add(p.x,p.y+bob,p.z,0.3,0.3,0.3,0xff3a5a,p.t*2);
    else{const col={iman:0x3a8cff,bomba:0xff3a1a,furia:0xffaa00,chest:0xffd84a}[p.type];B.solid.add(p.x,p.y+0.2+bob,p.z,0.6,0.6,0.6,col,p.t*2);B.glow.add(p.x,p.y+0.2+bob,p.z,0.7,0.7,0.7,_tmpC.setHex(col).multiplyScalar(0.3));}
  }
}
function collect(p){
  switch(p.type){
    case 'xp':S.xp+=p.val;sfx('pick',0.03);while(S.xp>=S.need){S.xp-=S.need;S.lvl++;S.need=xpNeed(S.lvl);S.pendingLv++;}break;
    case 'coin':S.coins+=Math.max(1,Math.round(p.val*S.coinMul*(1+S.wave*0.05)));sfx('coin');break;
    case 'heart':S.hp=Math.min(S.maxHp,S.hp+p.val);dmgNum(S.x,2,S.z,p.val,'#4aff6a',true);sfx('pick');break;
    case 'iman':for(const q of pickups)q.mag=true;toast('🧲 ¡Imán total!');sfx('level');break;
    case 'bomba':toast('💣 ¡Bomba!');for(const e of enemies.slice())if(Math.hypot(e.x-S.x,e.z-S.z)<25)hurtEnemy(e,e.boss?300:9999,{quiet:1});S.shake=1;sfx('boom');fx.push({type:'nova',x:S.x,z:S.z,r:25,col:0xffffff,life:0.6,max:0.6});break;
    case 'furia':S.fury=10;toast('😡 ¡Furia! Cadencia x2 durante 10 s');sfx('level');break;
    case 'chest':S.pendingLv+=2;S.coins+=20;toast('🎁 ¡Cofre de jefe! +2 mejoras');sfx('crate');break;
  }
}
function openCrate(c){c.open=true;scene.remove(c.g);const i=crates.indexOf(c);if(i>=0)crates.splice(i,1);sfx('crate');burst(c.x,0.8,c.z,30,0xffd84a,7);
  const owned=S.weapons.map(w=>w.id),notOwned=BASE_WEAPONS.filter(w=>!owned.includes(w)&&!FUSIONS.some(f=>owned.includes(f[2])&&(f[0]===w||f[1]===w)));
  const r=Math.random();
  if(r<0.08&&pets.length<4){const avail=Object.keys(PETS).filter(k=>!pets.some(p=>p.type===k));if(avail.length){const t=pick(avail);addPet(t);toast(`${PETS[t].icon} ¡${PETS[t].name} se une a ti!`);return;}}
  if(S.weapons.length<6&&notOwned.length&&r<0.75){addWeapon(pick(notOwned));return;}
  const up=S.weapons.filter(w=>w.lvl<8);if(up.length&&r<0.9){const w=pick(up);w.lvl++;toast(`⬆️ ${w.d.icon} ${w.d.name} → Nv ${w.lvl}`);renderSlots();checkFusionToast();return;}
  const v=Math.round(10+S.wave*3);S.coins+=v;S.hp=Math.min(S.maxHp,S.hp+30);toast(`🪙 +${v} monedas y +30 vida`);}
function updateFx(dt){
  for(let i=parts.length-1;i>=0;i--){const p=parts[i];p.life-=dt;if(p.life<=0){parts.splice(i,1);continue;}p.vy-=p.g*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;if(p.y<0.05){p.y=0.05;p.vy*=-0.3;p.vx*=0.7;p.vz*=0.7;}
    const s=p.size*(p.life/p.max);B.spark.add(p.x,p.y,p.z,s,s,s,p.col,p.life*5);}
  for(let i=fx.length-1;i>=0;i--){const f=fx[i];f.life-=dt;if(f.life<=0){fx.splice(i,1);continue;}const k=f.life/f.max;
    if(f.type==='beam'){B.beam.beam(f.x1,f.z1,f.x2,f.z2,1.1,f.w*k*2,f.col);B.beam.beam(f.x1,f.z1,f.x2,f.z2,1.1,f.w*k*0.6,0xffffff);}
    else if(f.type==='bolt'){let px=f.x1,pz=f.z1;const n=5;for(let j=1;j<=n;j++){const t=j/n,nx=f.x1+(f.x2-f.x1)*t+(j<n?rand(-.5,.5):0),nz=f.z1+(f.z2-f.z1)*t+(j<n?rand(-.5,.5):0);B.beam.beam(px,pz,nx,nz,1.1,0.12,f.col);B.beam.beam(px,pz,nx,nz,1.1,0.05,0xffffff);px=nx;pz=nz;}}
    else if(f.type==='nova'){const r=f.r*(1-k*k);B.ring.add(f.x,0.2,f.z,r,1,r,f.col);B.glow.add(f.x,0.3,f.z,r*0.9,0.4*k,r*0.9,_tmpC.setHex(f.col).multiplyScalar(0.25*k));}
    else if(f.type==='flash'){B.glow.add(f.x,1.1,f.z,0.5,0.5,0.5,f.col);}}
}

// ================== SUBIR DE NIVEL ==================
function showLevelUp(){
  S.pendingLv--;mode='levelup';sfx('level');
  const opts=[];const fus=availableFusions();
  for(const f of fus)opts.push({k:'fus',f,w:10});
  for(const w of S.weapons)if(w.lvl<8)opts.push({k:'up',w,wt:3});
  if(S.weapons.length<6){const owned=S.weapons.map(w=>w.id);for(const id of BASE_WEAPONS)if(!owned.includes(id)&&!FUSIONS.some(f=>owned.includes(f[2])&&(f[0]===id||f[1]===id)))opts.push({k:'new',id,wt:1});}
  for(const id in PASSIVES)if((S.passives[id]||0)<PASSIVES[id].max)opts.push({k:'pas',id,wt:1.2});
  if(pets.length<4&&Math.random()<0.25){const avail=Object.keys(PETS).filter(k=>!pets.some(p=>p.type===k));if(avail.length)opts.push({k:'pet',id:pick(avail)});}
  const chosen=[];if(fus.length)chosen.push(opts.shift());
  const pool=opts.filter(o=>o.k!=='fus');while(chosen.length<3&&pool.length){const i=Math.floor(Math.random()*pool.length);chosen.push(pool.splice(i,1)[0]);}
  if(!chosen.length)chosen.push({k:'heal'});
  const box=$('cards');box.innerHTML='';
  chosen.forEach((o,i)=>{const c=document.createElement('div');c.className='card'+(o.k==='fus'?' fu':'');let ic,t,d,tg;
    if(o.k==='fus'){const W=WEAPONS[o.f[2]];ic=W.icon;t=W.name;d=`${WEAPONS[o.f[0]].name} + ${WEAPONS[o.f[1]].name}. ${W.desc}`;tg='⚡ FUSIÓN ÉPICA';}
    if(o.k==='up'){ic=o.w.d.icon;t=o.w.d.name;d=`Nivel ${o.w.lvl} → ${o.w.lvl+1}: +daño, -recarga${(o.w.lvl)%3===0?', +1 proyectil':''}`;tg='MEJORA';}
    if(o.k==='new'){const W=WEAPONS[o.id];ic=W.icon;t=W.name;d=W.desc;tg=W.spell?'NUEVO HECHIZO':'NUEVA ARMA';}
    if(o.k==='pas'){const P=PASSIVES[o.id];ic=P.icon;t=P.name;d=P.desc+` (${(S.passives[o.id]||0)+1}/${P.max})`;tg='HABILIDAD';}
    if(o.k==='pet'){const P=PETS[o.id];ic=P.icon;t=P.name;d=P.desc;tg='RECLUTAR COMPAÑERO';}
    if(o.k==='heal'){ic='🍗';t='Banquete';d='Recupera toda la vida y +25 monedas';tg='RECOMPENSA';}
    c.innerHTML=`<div class="tg">${tg}</div><div class="ic">${ic}</div><h4>${t}</h4><p>${d}</p>`;c.onclick=()=>chooseLv(o);box.appendChild(c);});
  levelChoices=chosen;show('levelup',true);
}
let levelChoices=[];
function chooseLv(o){sfx('click');
  if(o.k==='fus')doFusion(o.f);
  if(o.k==='up'){o.w.lvl++;renderSlots();checkFusionToast();}
  if(o.k==='new')addWeapon(o.id);
  if(o.k==='pet'){addPet(o.id);toast(`${PETS[o.id].icon} ¡${PETS[o.id].name} se une a ti!`);}
  if(o.k==='heal'){S.hp=S.maxHp;S.coins+=25;}
  if(o.k==='pas'){const id=o.id;S.passives[id]=(S.passives[id]||0)+1;
    ({vida:()=>{S.maxHp+=20;S.hp=Math.min(S.maxHp,S.hp+40);},vel:()=>S.spd*=1.08,dano:()=>S.dmg+=0.12,cad:()=>S.cd*=0.92,iman:()=>S.magnet*=1.35,regen:()=>S.regen+=0.6,armad:()=>S.armor+=0.08,crit:()=>S.crit+=0.07,area:()=>S.area+=0.12,multi:()=>S.multi++})[id]();}
  $('levelup').classList.add('hide');mode='play';last=performance.now();
}

// ================== HUD / UI ==================
function show(id,overlay){if(overlay){$(id).classList.remove('hide');return;}for(const k of['menu','hud','levelup','pause','over'])$(k).classList.toggle('hide',k!==id);}
function renderSlots(){$('slots').innerHTML=S.weapons.map(w=>`<div class="slot${w.d.fusion?' fu':''}" title="${w.d.name}">${w.d.icon}<b>${w.lvl}</b></div>`).join('')+'<div class="slot" style="opacity:.3">＋</div>'.repeat(Math.max(0,6-S.weapons.length));}
function renderPets(){$('pets').textContent=pets.map(p=>PETS[p.type].icon).join(' ');}
let hudT=0;
function hudUpdate(){hudT-=1;if(hudT>0)return;hudT=6;
  $('hpF').style.width=(Math.max(0,S.hp)/S.maxHp*100)+'%';$('hpT').textContent=`${Math.ceil(Math.max(0,S.hp))} / ${S.maxHp}`;
  $('xpF').style.width=(S.xp/S.need*100)+'%';$('xpT').textContent=`Nivel ${S.lvl}`;
  $('wave').textContent=`Oleada ${S.wave}`;$('wsub').textContent=S.boss?`👹 ${FAMS[S.boss.fam].boss}: ${Math.ceil(S.boss.hp/S.boss.max*100)}%`:S.breakT>0?'¡Prepárate!':`Enemigos: ${Math.max(0,S.waveQuota-S.waveKills)}`+(S.fury>0?' · 😡 FURIA':'');
  $('hCoins').textContent=S.coins;$('hKills').textContent=S.kills;const t=Math.floor(S.time);$('hTime').textContent=`${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`;}
let toastT;function toast(m){const e=$('toast');e.textContent=m;e.style.opacity=1;clearTimeout(toastT);toastT=setTimeout(()=>e.style.opacity=0,2200);}
let banT;function banner(m){const e=$('banner');e.textContent=m;e.style.opacity=1;clearTimeout(banT);banT=setTimeout(()=>e.style.opacity=0,2200);}
function fusionHTML(){return FUSIONS.map(([a,b,c])=>{const have=S&&S.weapons.some(w=>w.id===c);return `<div class="fus">${WEAPONS[a].icon} ${WEAPONS[a].name} + ${WEAPONS[b].icon} ${WEAPONS[b].name} = <b>${WEAPONS[c].icon} ${WEAPONS[c].name}</b>${have?' ✅':''}</div>`;}).join('')+'<p style="opacity:.7;font-size:13px;margin-top:6px">Ambas armas deben estar a nivel 3 o superior. La fusión aparece al subir de nivel.</p>';}
function pause(){if(mode!=='play')return;mode='pause';stopMusic();$('pInfo').innerHTML=`<div class="row c">${S.weapons.map(w=>`<div class="slot${w.d.fusion?' fu':''}">${w.d.icon}<b>${w.lvl}</b></div>`).join('')}</div><p style="text-align:center;margin-top:6px">Oleada ${S.wave} · Nivel ${S.lvl} · ${S.kills} bajas · ${Object.entries(S.passives).map(([k,v])=>PASSIVES[k].icon+v).join(' ')}</p>`;$('pFus').innerHTML=fusionHTML();show('pause',true);}
function resume(){$('pause').classList.add('hide');mode='play';startMusic();last=performance.now();}
function gameOver(){mode='over';stopMusic();sfx('over');const bonus=Math.round(S.wave*5*S.coinMul),total=S.coins+bonus;save.coins+=total;save.best=Math.max(save.best,S.wave);save.games++;persist();
  const t=Math.floor(S.time);$('oStats').innerHTML=`<b>${save.custom.name}</b> sobrevivió hasta la <b>oleada ${S.wave}</b><br>⏱ ${Math.floor(t/60)}:${String(t%60).padStart(2,'0')} · 💀 ${S.kills} bajas · Nivel ${S.lvl}<br>🪙 Monedas recogidas: ${S.coins}<br>🏆 Bonus por oleada: +${bonus}<br><b style="color:#ffd84a;font-size:24px">Total: +${total} 🪙</b><br><small>Mejor oleada: ${save.best}</small>`;
  setTimeout(()=>show('over',true),700);}
function quitRun(){if(S){save.coins+=S.coins;save.best=Math.max(save.best,S.wave);persist();}toMenu();}
function toMenu(){mode='menu';stopMusic();clearChunks();for(const a of[enemies,projs,eprojs,parts,pickups,mines,fx,meteors])a.length=0;for(const p of pets)scene.remove(p.g);pets.length=0;if(player){scene.remove(player);player=null;}
  for(const d of dnEls){d.life=0;d.el.style.display='none';}show('menu');buildMenu();}

// ---- MENÚ ----
function buildMenu(){
  $('mCoins').textContent=save.coins;$('pName').value=save.custom.name;$('best').textContent=save.best?`🏆 Mejor oleada: ${save.best} · Partidas: ${save.games}`:'';
  const cu=save.custom;
  $('pColors').innerHTML=COLORS.map(c=>`<div class="sw${cu.color===c?' on':''}" data-c="${c}" style="background:#${c.toString(16).padStart(6,'0')}"></div>`).join('');
  const opts=(obj,key)=>Object.entries(obj).map(([id,n])=>`<div class="opt${cu[key]===id?' on':''}${owns(id)?'':' lock'}" data-k="${key}" data-id="${id}">${owns(id)?'':'🔒 '}${n}</div>`).join('');
  $('pSkins').innerHTML=opts(SKINS,'skin');$('pHats').innerHTML=opts(HATS,'hat');$('pAccs').innerHTML=opts(ACCS,'acc');
  // tienda
  let h='';for(const cat in CATNAMES){h+=`<div class="shopc">${CATNAMES[cat]}</div>`;
    if(cat==='wskin')h+=`<div class="it"><span>Armas: Normal</span>${save.wskin==='normal'?'<span>✔ Equipado</span>':`<button data-eq="wskin" data-id="normal">Equipar</button>`}</div>`;
    if(cat==='pet')h+=`<div class="it"><span>Sin mascota inicial</span>${!save.pet?'<span>✔ Equipado</span>':`<button data-eq="pet" data-id="">Equipar</button>`}</div>`;
    for(const it of SHOP.filter(s=>s.cat===cat)){const o=owns(it.id);let act;
      if(!o)act=`<button data-buy="${it.id}" ${save.coins<it.price?'disabled style="opacity:.5"':''}>🪙 ${it.price}</button>`;
      else if(cat==='wskin')act=save.wskin===it.id?'<span>✔ Equipado</span>':`<button data-eq="wskin" data-id="${it.id}">Equipar</button>`;
      else if(cat==='pet')act=save.pet===it.id?'<span>✔ Equipado</span>':`<button data-eq="pet" data-id="${it.id}">Equipar</button>`;
      else act=cat==='perk'?'<span>✔ Activa</span>':'<span>✔ Tuyo</span>';
      h+=`<div class="it"><span>${it.name}${it.desc?`<small>${it.desc}</small>`:''}</span>${act}</div>`;}}
  $('shopList').innerHTML=h;$('fusList').innerHTML=fusionHTML();
  refreshMenuChar();
}
function refreshMenuChar(){if(menuChar)scene.remove(menuChar);menuChar=buildChar(save.custom,1);scene.add(menuChar);}
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{sfx('click');document.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('on',x===b));document.querySelectorAll('#menu .panel').forEach(p=>p.classList.toggle('hide',p.id!=='tab-'+b.dataset.tab));});
$('menu').addEventListener('click',ev=>{initAudio();const t=ev.target;
  if(t.dataset.c){save.custom.color=+t.dataset.c;persist();buildMenu();sfx('click');}
  if(t.dataset.k){if(!owns(t.dataset.id)){toast('🔒 Desbloquéalo en la Tienda');return;}save.custom[t.dataset.k]=t.dataset.id;persist();buildMenu();sfx('click');}
  if(t.dataset.buy){const it=SHOP.find(s=>s.id===t.dataset.buy);if(save.coins>=it.price){save.coins-=it.price;save.owned[it.id]=1;if(it.cat==='wskin')save.wskin=it.id;if(it.cat==='pet')save.pet=it.id;persist();sfx('coin');toast('¡Comprado: '+it.name+'!');buildMenu();}}
  if(t.dataset.eq){save[t.dataset.eq]=t.dataset.id||null;persist();buildMenu();sfx('click');}
});
$('pName').oninput=e=>{save.custom.name=e.target.value.trim()||'Héroe';persist();};
$('play').onclick=()=>{initAudio();sfx('click');if(menuChar){scene.remove(menuChar);menuChar=null;}newRun();last=performance.now();};
$('pauseB').onclick=()=>pause();$('resume').onclick=()=>resume();$('quit').onclick=()=>quitRun();
$('again').onclick=()=>{newRun();last=performance.now();};$('toMenu').onclick=()=>toMenu();
$('musB').onclick=()=>{initAudio();const on=toggleMusic();if(mode!=='play')stopMusic();$('musB').style.opacity=on?1:0.4;};
$('musB').style.opacity=musicEnabled()?1:0.4;

// ---- entrada ----
addEventListener('keydown',e=>{keys[e.code]=true;initAudio();
  if(e.code==='Escape'||e.code==='KeyP'){if(mode==='play')pause();else if(mode==='pause')resume();}
  if(e.code==='KeyM')$('musB').click();
  if(mode==='levelup'&&['Digit1','Digit2','Digit3'].includes(e.code)){const o=levelChoices[+e.code.slice(-1)-1];if(o)chooseLv(o);}
  if(e.code.startsWith('Arrow')&&mode==='play')e.preventDefault();});
addEventListener('keyup',e=>keys[e.code]=false);
addEventListener('blur',()=>{for(const k in keys)keys[k]=false;if(mode==='play')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='play')pause();});
const joyEl=$('joy'),knob=$('knob');
addEventListener('touchstart',e=>{initAudio();if(mode!=='play'||joy.id!==null)return;for(const t of e.changedTouches){if(t.target.tagName==='BUTTON')continue;joy.id=t.identifier;joy.ox=t.clientX;joy.oy=t.clientY;joy.active=true;joy.x=joy.z=0;
  joyEl.style.display='block';joyEl.style.left=(t.clientX-60)+'px';joyEl.style.top=(t.clientY-60)+'px';knob.style.transform='';break;}},{passive:true});
addEventListener('touchmove',e=>{for(const t of e.changedTouches)if(t.identifier===joy.id){let dx=t.clientX-joy.ox,dy=t.clientY-joy.oy;const l=Math.hypot(dx,dy),m=50;if(l>m){dx*=m/l;dy*=m/l;}joy.x=dx/m;joy.z=dy/m;knob.style.transform=`translate(${dx}px,${dy}px)`;}},{passive:true});
const endT=e=>{for(const t of e.changedTouches)if(t.identifier===joy.id){joy.id=null;joy.active=false;joy.x=joy.z=0;joyEl.style.display='none';}};
addEventListener('touchend',endT);addEventListener('touchcancel',endT);

// ================== BUCLE ==================
let last=performance.now(),mt=0,fpsAcc=0,frames=0;
function loop(now){requestAnimationFrame(loop);let dt=Math.min(0.05,(now-last)/1000);last=now;
  if(mode==='play'){update(dt);}
  else if(mode==='menu'){mt+=dt;if(!chunks.size)updateChunks(0,0);
    if(menuChar){const wide=innerWidth>700;menuChar.position.set(wide?-2.2:0,0,wide?-0.5:1.6);menuChar.rotation.y=Math.sin(mt*0.6)*0.8;animChar(menuChar,mt,false,false);}
    camera.position.set(-1+Math.sin(mt*0.1)*0.3,4.2,6.5);camera.lookAt(innerWidth>700?-4.1:0,innerWidth>700?1.3:1.9,0);sun.position.set(10,20,10);sun.target.position.set(0,0,0);ground.position.set(0,0,0);
    for(const c of crates){c.g.rotation.y+=dt;}}
  else if(mode==='over'||mode==='levelup'||mode==='pause'){ // congelado pero animado
    if(mode==='over'){S.shake=0;}
    // mantener dibujado el último estado: repetir render de entidades sin actualizar
    if(S)redrawStatic();}
  updateDmgNums(mode==='play'?dt:0);
  for(const k in B)B[k].flush();
  renderer.render(scene,camera);
}
function redrawStatic(){ // redibuja entidades sin avanzar la simulación
  const keep=S.t;for(const e of enemies){const bt=e.mesh===0?B.e0:e.mesh===1?B.e1:B.e2;const s=e.s;
    if(e.mesh===0)bt.add(e.x,0,e.z,0.85*s,1.5*s,0.6*s,e.col,e.face);else if(e.mesh===1)bt.add(e.x,0,e.z,1.3*s,s,1.3*s,e.col,e.face);else bt.add(e.x,0,e.z,0.9*s,s,0.9*s,e.col,e.face);B.shadow.add(e.x,0,e.z,e.r*1.1,1,e.r*1.1,0);}
  for(const p of pickups)if(p.type==='xp')B.gem.add(p.x,p.y,p.z,0.2,0.28,0.2,0x3ac8ff,p.t*3);S.t=keep;}
buildMenu();updateChunks(0,0);requestAnimationFrame(loop);
if(new URLSearchParams(location.search).has("debug"))window.__oleadas={get mode(){return mode},get S(){return S},enemies,newRun,setWave:w=>{S.wave=w-1;nextWave();},give:id=>addWeapon(id),lvl:()=>{S.pendingLv++;}};
