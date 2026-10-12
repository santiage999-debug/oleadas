import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {WEAPONS,BASE_WEAPONS,FUSIONS,FAMS,ROLES,PASSIVES,PETS,SKINS,SKIN_BONUS,CAMOS,TRAILS,WSKINS,SHOP,CATNAMES,ICONS} from './data.js';
import {initAudio,sfx,startMusic,stopMusic,setIntensity,toggleMusic,musicEnabled} from './audio.js';
import {Batch,makeFxAtlas,FOG,FOG_NEAR,FOG_FAR} from './render.js';
import {loadModel,Char,CharPool,Inst,toonMat,T as MT} from './models.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';

const $=id=>document.getElementById(id);
const isTouch=matchMedia('(pointer:coarse)').matches||'ontouchstart' in window;
const rand=(a,b)=>a+Math.random()*(b-a), clamp=(v,a,b)=>v<a?a:v>b?b:v, pick=a=>a[Math.floor(Math.random()*a.length)];
const DEBUG=new URLSearchParams(location.search).has('debug');
const angLerp=(a,b,t)=>{const d=((b-a+Math.PI*3)%(Math.PI*2))-Math.PI;return a+d*t;};

// ================== GUARDADO ==================
const DEF={coins:0,owned:{marine:1,superviviente:1,ninguno:1,azul:1,normal:1},custom:{skin:'marine',camo:'ninguno',trail:'azul',name:'Soldado'},wskin:'normal',pet:null,best:0,games:0};
let save;
try{const raw=JSON.parse(localStorage.getItem('oleadas_save')||'{}');save=Object.assign(structuredClone(DEF),raw);save.owned=Object.assign({},DEF.owned,raw.owned);save.custom=Object.assign({},DEF.custom,raw.custom);}catch(e){save=structuredClone(DEF);}
if(!SKINS[save.custom.skin])save.custom.skin='marine'; if(!CAMOS[save.custom.camo])save.custom.camo='ninguno'; if(!TRAILS[save.custom.trail])save.custom.trail='azul';
const persist=()=>{try{localStorage.setItem('oleadas_save',JSON.stringify(save))}catch(e){}};
const owns=id=>!!save.owned[id];

// ================== RENDER ==================
const canvas=$('c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',stencil:false});
// calidad adaptativa: 3=alta (escritorio) 2=media 1=baja 0=mínima
const QP=new URLSearchParams(location.search).get('q');let qLevel=QP!==null?+QP:isTouch?2:3;const QLOCK=QP!==null;
const QPR=[0.75,1,1.25,1.75];
renderer.setPixelRatio(Math.min(devicePixelRatio,QPR[qLevel]));
renderer.setClearColor(FOG);renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
const scene=new THREE.Scene(); scene.fog=new THREE.Fog(FOG,FOG_NEAR,FOG_FAR);
const camera=new THREE.PerspectiveCamera(40,1,0.5,140);
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=w<h?64:44;camera.updateProjectionMatrix();}
addEventListener('resize',resize);resize();
// luz cálida de dibujo animado
const hemi=new THREE.HemisphereLight(0xfff3dc,0xb08a70,1.55);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xfff0d6,2.3);sun.position.set(-6,14,7);scene.add(sun);scene.add(sun.target);
sun.castShadow=true;sun.shadow.mapSize.set(isTouch?1024:2048,isTouch?1024:2048);
Object.assign(sun.shadow.camera,{left:-22,right:22,top:22,bottom:-22,near:1,far:50});sun.shadow.bias=-0.0008;sun.shadow.normalBias=0.03;
function applyQuality(){renderer.setPixelRatio(Math.min(devicePixelRatio,QPR[qLevel]));resize();
  const sh=qLevel>=2;if(sun.castShadow!==sh){sun.castShadow=sh;scene.traverse(o=>{if(o.material)o.material.needsUpdate=true;});}
  outlinesOn=qLevel>=2;enemyOutlines=qLevel>=3||(qLevel>=2&&enemies.length<90);INST&&INST.outlines(qLevel>=1);}
let outlinesOn=true,enemyOutlines=true;

let F={},B={},ground,fxF,INST,POOL,PROPBOX={};
const MODELS=['soldier','enemy','hazmat','z_basic','z_ribcage','z_chubby','z_arm','dog','pug','orc','demon','yeti','mushroom','spiky','bluedemon','dino','spider','cactoro','squidle','slime','dragon'];
async function loadAssets(){
  const bar=$('loading');let done=0;const tick=()=>{done++;bar.textContent=`CARGANDO ZONA CERO… ${Math.round(done/(MODELS.length+1)*100)}%`;};
  const gl=new GLTFLoader();gl.setMeshoptDecoder(MeshoptDecoder);
  const [props]=await Promise.all([gl.loadAsync('models/props.glb').then(g=>{tick();return g;}),...MODELS.map(k=>loadModel(k,`models/${k}.glb`).then(tick))]);
  const fx=makeFxAtlas();fxF=fx.frames;
  // suelo estilizado (textura procedural)
  const gtex=new THREE.CanvasTexture(groundCanvas());gtex.colorSpace=THREE.SRGBColorSpace;gtex.wrapS=gtex.wrapT=THREE.RepeatWrapping;gtex.anisotropy=8;
  const GS=150,TILE=8;gtex.repeat.set(GS/TILE,GS/TILE);
  ground=new THREE.Mesh(new THREE.PlaneGeometry(GS,GS),new THREE.MeshLambertMaterial({map:gtex}));
  ground.rotation.x=-Math.PI/2;ground.userData.tile=TILE;ground.receiveShadow=true;ground.renderOrder=-1;scene.add(ground);
  B.decal=new Batch(scene,fx.tex,1400,{ground:true,mode:'blend',order:1});
  B.shadow=new Batch(scene,fx.tex,600,{ground:true,mode:'shadow',order:2});
  B.light=new Batch(scene,fx.tex,1500,{ground:true,mode:'add',order:3});
  B.smoke=new Batch(scene,fx.tex,1600,{mode:'blend',order:6});
  B.add=new Batch(scene,fx.tex,3000,{mode:'add',order:7});
  B.trail=new Batch(scene,fx.tex,1500,{ground:true,mode:'add',order:8});
  // props instanciados
  INST=new Inst(scene);POOL=new CharPool(scene);
  for(const ch of props.scene.children){const big=/Structure|Container|Tank|Tree|WaterTank|BrokenCar|Trash/.test(ch.name);
    const d=INST.fromObject(ch.name,ch,{cap:big?40:ch.name==='Crate'?24:ch.name==='Landmine'?60:ch.name==='Health'?20:ch.name==='WoodPlanks'?80:60,shadow:true,color:ch.name==='Crate'});PROPBOX[ch.name]=d.box;}
  makeProcedural();
  bar.textContent='CARGANDO ZONA CERO… 100%';
}
// textura de suelo: baldosas de arena cálida con grietas, piedras y hierba (estilo cartoon)
function groundCanvas(){const S=1024,c=document.createElement('canvas');c.width=c.height=S;const g=c.getContext('2d');
  const R=(a,b)=>a+Math.random()*(b-a);g.fillStyle='#e7cc96';g.fillRect(0,0,S,S);const n=4,ts=S/n;
  for(let i=0;i<n;i++)for(let j=0;j<n;j++){const x=i*ts,y=j*ts;g.fillStyle=(i+j)%2?'#ecd3a0':'#e3c48b';g.fillRect(x+3,y+3,ts-6,ts-6);
    const gr=g.createLinearGradient(x,y,x,y+ts);gr.addColorStop(0,'rgba(255,255,255,.16)');gr.addColorStop(1,'rgba(120,80,40,.10)');g.fillStyle=gr;g.fillRect(x+3,y+3,ts-6,ts-6);}
  g.strokeStyle='rgba(150,105,60,.55)';g.lineWidth=6;for(let i=0;i<=n;i++){g.beginPath();g.moveTo(i*ts,0);g.lineTo(i*ts,S);g.stroke();g.beginPath();g.moveTo(0,i*ts);g.lineTo(S,i*ts);g.stroke();}
  // grietas
  g.strokeStyle='rgba(130,90,50,.5)';g.lineWidth=3;g.lineCap='round';for(let k=0;k<7;k++){let x=R(0,S),y=R(0,S);g.beginPath();g.moveTo(x,y);for(let s=0;s<5;s++){x+=R(-40,40);y+=R(-40,40);g.lineTo(x,y);}g.stroke();}
  // piedrecitas
  for(let k=0;k<90;k++){const x=R(0,S),y=R(0,S),r=R(3,9);g.fillStyle='rgba(160,120,80,.55)';g.beginPath();g.ellipse(x,y+2,r,r*0.7,0,0,7);g.fill();g.fillStyle='rgba(250,232,200,.8)';g.beginPath();g.ellipse(x,y,r*0.8,r*0.55,0,0,7);g.fill();}
  // matas de hierba
  for(let k=0;k<26;k++){const x=R(0,S),y=R(0,S);for(let b=0;b<7;b++){g.fillStyle=b%2?'#8cc04a':'#6fa83a';g.beginPath();const a=R(-0.9,0.9),l=R(10,22);g.moveTo(x+b*3-9,y);g.quadraticCurveTo(x+b*3-9+a*l*0.5,y-l*0.6,x+b*3-9+a*l,y-l);g.lineTo(x+b*3-6,y);g.fill();}}
  return c;}
// geometrías procedurales con color por vértice (gemas, monedas, cuchillas, dron…)
function colorize(geo,hex){const n=geo.attributes.position.count,c=new THREE.Color(hex),a=new Float32Array(n*3);for(let i=0;i<n;i++){a[i*3]=c.r;a[i*3+1]=c.g;a[i*3+2]=c.b;}geo.setAttribute('color',new THREE.BufferAttribute(a,3));if(geo.index)geo=geo.toNonIndexed();geo.deleteAttribute('uv');return geo;}
function partsOf(geo){return[{geo,local:new THREE.Matrix4()}];}
function makeProcedural(){
  const I=new THREE.Matrix4();
  const gem=colorize(new THREE.OctahedronGeometry(0.3,0),0xffffff);gem.scale(1,1.45,1);gem.computeVertexNormals();
  INST.def('gem',partsOf(gem),{cap:900,color:true,outline:true});
  const coin=colorize(new THREE.CylinderGeometry(0.26,0.26,0.08,16),0xffc928);coin.rotateX(Math.PI/2);INST.def('coin',partsOf(coin),{cap:300});
  const pw=colorize(new THREE.BoxGeometry(0.6,0.6,0.6),0xffffff);INST.def('pw',partsOf(pw),{cap:20,color:true});
  // cuchilla tipo shuriken
  const sh=new THREE.Shape();for(let i=0;i<8;i++){const a=i/8*Math.PI*2,r=i%2?0.16:0.55;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?sh.lineTo(x,y):sh.moveTo(x,y);}
  const blade=colorize(new THREE.ExtrudeGeometry(sh,{depth:0.08,bevelEnabled:false}),0xdfe8ff);blade.rotateX(-Math.PI/2);blade.computeVertexNormals();INST.def('blade',partsOf(blade),{cap:40});
  const bs=new THREE.Shape();bs.moveTo(-0.6,0.1);bs.quadraticCurveTo(0,0.55,0.6,0.1);bs.lineTo(0.5,-0.08);bs.quadraticCurveTo(0,0.3,-0.5,-0.08);bs.closePath();
  const boom=colorize(new THREE.ExtrudeGeometry(bs,{depth:0.08,bevelEnabled:false}),0xd08a40);boom.rotateX(-Math.PI/2);boom.computeVertexNormals();INST.def('boomer',partsOf(boom),{cap:20});
  const rock=colorize(new THREE.IcosahedronGeometry(0.7,0),0x8a4a2a);rock.computeVertexNormals();INST.def('rock',partsOf(rock),{cap:20});
  const rocket=colorize(new THREE.ConeGeometry(0.16,0.6,8),0xff5a3a);rocket.rotateX(Math.PI/2);INST.def('rocket',partsOf(rocket),{cap:60});
  // dron de combate
  const parts=[colorize(new THREE.BoxGeometry(0.55,0.22,0.55),0x5a7ab0),colorize(new THREE.SphereGeometry(0.16,10,8),0x9affb0).translate(0,-0.08,0.22)];
  for(const [x,z] of [[-0.42,-0.42],[0.42,-0.42],[-0.42,0.42],[0.42,0.42]]){parts.push(colorize(new THREE.CylinderGeometry(0.05,0.05,0.12,6),0x30303a).translate(x,0.1,z));parts.push(colorize(new THREE.CylinderGeometry(0.24,0.24,0.02,14),0xd8e4ff).translate(x,0.17,z));}
  parts.push(colorize(new THREE.BoxGeometry(0.9,0.06,0.08),0x30303a).rotateY(Math.PI/4).translate(0,0.08,0),colorize(new THREE.BoxGeometry(0.9,0.06,0.08),0x30303a).rotateY(-Math.PI/4).translate(0,0.08,0));
  const drone=mergeGeometries(parts.map(p=>{const q=p.index?p.toNonIndexed():p;for(const k of Object.keys(q.attributes))if(!['position','normal','color'].includes(k))q.deleteAttribute(k);return q;}));
  INST.def('drone',partsOf(drone),{cap:4,shadow:true});
}
const hexRGB=h=>[(h>>16&255)/255,(h>>8&255)/255,(h&255)/255];
const fxAdd=(k,x,y,z,s,r,g,b,a=1,rot=0)=>B.add.add(x,y,z,s,s,fxF[k],r,g,b,a,rot,0,0.5);
const lightAt=(x,z,s,r,g,b,a=1)=>B.light.add(x,0.03,z,s,s,fxF.glow,r,g,b,a,0,0,0.5);
const blob=(x,z,s,a=0.5)=>B.shadow.add(x,0.012,z,s,s*0.8,fxF.shadow,1,1,1,a,0,0,0.5);
const ICW=112;
function iconIndex(id){let i=ICONS.indexOf(id);if(i<0){const f=FUSIONS.find(f=>f[2]===id);i=f?ICONS.indexOf(f[0]):0;}return i;}
function iconHTML(id,size=44){const i=iconIndex(id),f=FUSIONS.find(f=>f[2]===id);
  const one=(k,s,ex='')=>`<span class="ico" style="width:${s}px;height:${s}px;background-size:${s*4}px ${s*4}px;background-position:-${(k%4)*s}px -${Math.floor(k/4)*s}px;${ex}"></span>`;
  if(f&&id!=='minigun')return `<span class="icofu" style="width:${size}px;height:${size}px">${one(ICONS.indexOf(f[0]),size*0.8,'position:absolute;left:0;top:0')}${one(ICONS.indexOf(f[1]),size*0.6,'position:absolute;right:-2px;bottom:-2px')}</span>`;
  return one(i,size);}

// ================== PERSONAJES: ESPECIFICACIONES ==================
// soldados (modelo, color de uniforme o null para el original, escala)
const SKINDEF={marine:{m:'soldier'},comando:{m:'enemy'},pesado:{m:'soldier',col:0x6b6f80,w:1.12},francotirador:{m:'enemy',col:0x5e8a3a},medico:{m:'hazmat',col:0xf4f4f4},superviviente:{m:'hazmat'}};
const GUNS=['AK','GrenadeLauncher','Knife_1','Knife_2','Pistol','Revolver','Revolver_Small','RocketLauncher','ShortCannon','Shotgun','Shovel','SMG','Sniper','Sniper_2'];
const GUNOF={pistola:'Pistol',escopeta:'Shotgun',subfusil:'SMG',laser:'Sniper_2',cohete:'RocketLauncher',lanzallamas:'ShortCannon',rayo:'Revolver',congelador:'Sniper',plasma:'GrenadeLauncher',
  minigun:'AK',escoexpl:'Shotgun',crio:'Sniper',tesla:'GrenadeLauncher',misiles:'RocketLauncher',riel:'Sniper',granizo:'Shotgun',tormenta:'Revolver'};
function makeSoldier(skin,o={}){const d=SKINDEF[skin]||SKINDEF.marine;const c=new Char(d.m,{h:2.0,bigHead:1.28,shadow:true,big:true,outlineRigid:true,rim:0.55,edge:0.8});
  const u=c.mat.userData.u;if(d.col!=null){u.uMaskOn.value=1;u.uMaskCol.value.setHex(d.col);}c.pivotW=d.w||1;c.show(GUNS,false);c.show(['Pistol'],true);c.gun='Pistol';return c;}
function setCamo(c,camo){const t=CAMOS[camo][1];c.mat.userData.u.uCamo.value.setRGB(t[0],t[1],t[2]);}
// enemigos por familia y rol
const ESPEC={
  zombi_normal:{m:'z_basic',h:1.8,run:'zrun'},zombi_rapido:{m:'z_ribcage',h:1.45,run:'run',rs:1.2},zombi_tanque:{m:'z_chubby',h:2.6,run:'walk',rs:1.3},
  zombi_tirador:{m:'z_arm',h:1.85,run:'walk'},zombi_explosivo:{m:'z_chubby',h:1.7,run:'zrun',tint:[0.75,1.3,0.55],emis:[0.12,0.25,0]},zombi_jefe:{m:'z_chubby',h:4.8,run:'walk',tint:[0.95,0.8,1.15]},
  monstruo_normal:{m:'orc',h:1.85},monstruo_rapido:{m:'demon',h:1.7,rs:1.2},monstruo_tanque:{m:'yeti',h:2.7,run:'walk',rs:1.2},monstruo_tirador:{m:'mushroom',h:1.8},
  monstruo_explosivo:{m:'spiky',h:1.4,run:'walk',rs:1.6},monstruo_jefe:{m:'bluedemon',h:4.8,run:'walk'},
  alien_normal:{m:'dino',h:1.85},alien_rapido:{m:'spider',h:0.95,rs:1.5},alien_tanque:{m:'cactoro',h:2.7,run:'walk',tint:[0.85,0.85,1.3]},
  alien_tirador:{m:'squidle',h:1.6,fly:0.7},alien_explosivo:{m:'slime',h:1.25,run:'walk',rs:1.6},alien_jefe:{m:'dragon',h:3.6,fly:1.4},
};
function makeEnemyChar(spec){const s=ESPEC[spec];const boss=spec.endsWith('jefe');
  const c=new Char(s.m,{h:s.h,y:s.fly||0,big:boss,shadow:boss,rim:0.5,edge:0.75});const u=c.mat.userData.u;
  if(s.tint)u.uTint.value.setRGB(...s.tint);if(s.emis)u.uEmis.value.setRGB(...s.emis);c.baseTint=s.tint||[1,1,1];c.spec=s;return c;}
const PETSPEC={perro:{m:'dog',h:1.05},gato:{m:'pug',h:0.8},dragon:{m:'dragon',h:1.1,fly:1.2}};
function makePetChar(type){const s=PETSPEC[type];if(!s)return null;const c=new Char(s.m,{h:s.h,y:s.fly||0,shadow:true,rim:0.6});c.spec=s;return c;}

// ================== MINIATURAS (render a textura) ==================
const thumbs={};
function renderThumb(id,make,{w=150,h=180,anim='idle',t=0.4,cam=[0,1.15,4.2],look=[0,0.95,0],ry=0.45}={}){
  const rt=new THREE.WebGLRenderTarget(w*2,h*2,{samples:4});const sc=new THREE.Scene();
  sc.add(new THREE.HemisphereLight(0xfff3dc,0x9a7a68,1.7));const dl=new THREE.DirectionalLight(0xfff0d6,2.4);dl.position.set(-3,5,6);sc.add(dl);
  const c=make();sc.add(c.root);c.root.rotation.y=ry;c.play(anim);c.update(t);
  const cm=new THREE.PerspectiveCamera(30,w/h,0.1,50);cm.position.set(...cam);cm.lookAt(...look);
  renderer.setRenderTarget(rt);renderer.setClearColor(0,0);renderer.clear();renderer.render(sc,cm);
  const px=new Uint8Array(w*2*h*2*4);renderer.readRenderTargetPixels(rt,0,0,w*2,h*2,px);renderer.setRenderTarget(null);renderer.setClearColor(FOG,1);
  const cv=document.createElement('canvas');cv.width=w*2;cv.height=h*2;const g=cv.getContext('2d');const im=g.createImageData(w*2,h*2);
  const L=v=>{v/=255;return 255*(v<=0.0031308?v*12.92:1.055*Math.pow(v,1/2.4)-0.055);};
  for(let y=0;y<h*2;y++)for(let x=0;x<w*2;x++){const si=((h*2-1-y)*w*2+x)*4,di=(y*w*2+x)*4,a=px[si+3];
    if(a>0){im.data[di]=L(px[si]/(a/255));im.data[di+1]=L(px[si+1]/(a/255));im.data[di+2]=L(px[si+2]/(a/255));}im.data[di+3]=a;}
  g.putImageData(im,0,0);rt.dispose();c.mixer.stopAllAction();c.mat.dispose();thumbs[id]=cv.toDataURL('image/png');return thumbs[id];}
function makeThumbs(){
  for(const id in SKINS)renderThumb('s_'+id,()=>{const c=makeSoldier(id);return c;},{anim:'idle'});
  renderThumb('perro',()=>makePetChar('perro'),{cam:[0,0.9,3.2],look:[0,0.45,0],ry:0.9});
  renderThumb('gato',()=>makePetChar('gato'),{cam:[0,0.8,2.6],look:[0,0.38,0],ry:0.9});
  renderThumb('dragon',()=>makePetChar('dragon'),{cam:[0,2.0,3.4],look:[0,1.45,0],ry:0.6});
  renderThumb('dron',()=>{const g=new THREE.Group();const m=new THREE.Mesh(INST.k.drone.list[0].im.geometry,toonMat());m.scale.setScalar(1.6);m.position.y=1;g.add(m);
    return{root:g,play(){},update(){},mixer:{stopAllAction(){}},mat:m.material};},{cam:[0,2.2,3.2],look:[0,1,0],ry:0.5});
}
const thumbImg=(id,h)=>`<img class="th" src="${thumbs[id]||''}" style="height:${h}px">`;

// ================== MAPA PROCEDURAL ==================
const CH=30, chunks=new Map(), crates=[], dyns=[], debris=[];
function hash(x,z){let h=(x*374761393+z*668265263)^0x5bd1e995;h=Math.imul(h^(h>>>13),1274126177);return(h^(h>>>16))>>>0;}
function rng(seed){return()=>{seed=(seed+0x6D2B79F5)>>>0;let t=seed;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
// m: modelo; s: escala; deco: sin colisión; dyn: objeto físico (kick=pateable, exp=explosivo); fire: fuego encima
const PROPS={
  coche:{m:'Debris_BrokenCar',s:1.05},sacos:{m:'SackTrench',s:1},sacosP:{m:'SackTrench_Small',s:1},barrera:{m:'Barrier_Single',s:1.1},
  arbol1:{m:'Tree_1',s:1},arbol2:{m:'Tree_2',s:1},arbol3:{m:'Tree_3',s:1},arbol4:{m:'Tree_4',s:1},neumaticos:{m:'Debris_Tires',s:1.1,fire:1},
  escombros:{m:'Debris_Pile',s:1.2,deco:1},palet:{m:'Pallet',s:1,deco:1},tablas:{m:'WoodPlanks',s:1,deco:1},
  contenedor:{m:'Container_Long',s:1},contP:{m:'Container_Small',s:1},tanque:{m:'Tank',s:1.1},torre:{m:'WaterTank_Platform',s:1},farola:{m:'StreetLight',s:0.9,thin:1},
  basura:{m:'TrashContainer',s:1},sofa:{m:'Sofa',s:1},tuberias:{m:'Pipes',s:1},senal:{m:'Sign',s:1.2},cajas:{m:'CardboardBoxes_3',s:1},
  edif1:{m:'Structure_1',s:1},edif2:{m:'Structure_2',s:1},edif3:{m:'Structure_3',s:1},edif4:{m:'Structure_4',s:1},
  barril:{m:'ExplodingBarrel',s:1.15,dyn:1,exp:1,hp:20},gas:{m:'GasTank',s:0.95,dyn:1,exp:1,hp:30},cono:{m:'TrafficCone',s:1.1,dyn:1,kick:1},carton:{m:'CardboardBoxes_1',s:1.1,dyn:1,kick:1},
};
// colisiones circulares generadas a partir de la caja del modelo
function propCols(P,x,z,ry){const b=PROPBOX[P.m];if(!b||P.deco)return[];const s=P.s;
  const w=(b.max.x-b.min.x)*s,d=(b.max.z-b.min.z)*s,h=(b.max.y-b.min.y)*s,cx=(b.max.x+b.min.x)/2*s,cz=(b.max.z+b.min.z)/2*s;
  const small=h<1.4,out=[];const long=Math.max(w,d),short=Math.min(w,d);let r=P.thin?0.25:Math.max(0.3,short/2*0.92);const n=Math.max(1,Math.ceil((long-short)/(r*1.2))+1);
  const c=Math.cos(ry),sn=Math.sin(ry);
  for(let i=0;i<n;i++){const t=n===1?0:(i/(n-1)-0.5)*(long-short);const lx=cx+(w>=d?t:0),lz=cz+(w>=d?0:t);
    out.push({x:x+lx*c+lz*sn,z:z-lx*sn+lz*c,r,h:small?h:9,small});}
  return out;}
function genChunk(cx,cz){
  const r=rng(hash(cx,cz)),ox=cx*CH,oz=cz*CH,biome=hash(Math.floor(cx/2)+7,Math.floor(cz/2)-3)%3;
  const props=[],obs=[],decals=[],fires=[],cr=[],dy=[];
  const near=(x,z)=>Math.abs(x)<7&&Math.abs(z)<7;
  const place=(name,x,z,ry=Math.floor(r()*4)*Math.PI/2+(r()-0.5)*0.3)=>{const P=PROPS[name];
    if(P.dyn){const o={name,P,x,z,y:0,vx:0,vy:0,vz:0,ry,rx:0,rz:0,wx:0,wz:0,wy:0,hp:P.hp||1,awake:false,dead:false,fuse:-1};dy.push(o);dyns.push(o);return;}
    props.push({name,P,x,z,ry});obs.push(...propCols(P,x,z,ry));if(P.fire)fires.push({x,z:z,s:1,y:1});};
  if(biome===2&&r()<0.9){const b=pick(['edif1','edif2','edif3','edif4']);const x=ox+9+r()*(CH-18),z=oz+9+r()*(CH-18);if(!near(x,z))place(b,x,z,Math.floor(r()*4)*Math.PI/2);}
  const n=10+Math.floor(r()*8);
  for(let i=0;i<n;i++){const x=ox+r()*CH,z=oz+r()*CH;if(near(x,z))continue;if(obs.some(o=>Math.hypot(o.x-x,o.z-z)<o.r+2.2))continue;
    const k=r();let name;
    if(biome===0)name=k<0.16?'coche':k<0.26?'barrera':k<0.36?'sacos':k<0.48?'barril':k<0.56?'cono':k<0.62?'farola':k<0.68?'basura':k<0.76?'neumaticos':k<0.84?'escombros':k<0.9?'contP':k<0.95?'senal':'carton';
    else if(biome===1)name=k<0.12?'arbol1':k<0.22?'arbol2':k<0.3?'arbol3':k<0.38?'arbol4':k<0.46?'sofa':k<0.54?'neumaticos':k<0.64?'barril':k<0.72?'carton':k<0.8?'palet':k<0.88?'sacosP':k<0.94?'cajas':'tablas';
    else name=k<0.14?'sacos':k<0.24?'contenedor':k<0.32?'tanque':k<0.4?'torre':k<0.5?'gas':k<0.6?'barril':k<0.7?'tuberias':k<0.8?'sacosP':k<0.9?'escombros':'cono';
    place(name,x,z);}
  for(let i=0;i<6;i++){const g=r()<0.5;decals.push({x:ox+r()*CH,z:oz+r()*CH,s:3+r()*6,rot:r()*6,k:g?'smoke':'scorch',col:g?[0.45,0.75,0.25]:[0.55,0.4,0.28],a:g?0.45:0.18+r()*0.15});}
  if(r()<0.3){const x=ox+r()*CH,z=oz+r()*CH;if(!near(x,z))fires.push({x,z,s:0.7+r()*0.5,y:0});}
  if(r()<0.5&&!(cx===0&&cz===0))cr.push(makeCrate(ox+5+r()*(CH-10),oz+5+r()*(CH-10)));
  if(cx===0&&cz===0){cr.push(makeCrate(4,-5));place('barril',-4,-3);place('barril',-4.9,-2.6);place('cono',3,3);}
  crates.push(...cr);
  return {props,obs,decals,fires,crates:cr,dyn:dy};
}
function makeCrate(x,z){return {x,z,open:false,t:Math.random()*6};}
function updateChunks(px,pz){const ccx=Math.floor(px/CH),ccz=Math.floor(pz/CH),R=2;
  for(let x=ccx-R;x<=ccx+R;x++)for(let z=ccz-R;z<=ccz+R;z++){const k=x+','+z;if(!chunks.has(k))chunks.set(k,genChunk(x,z));}
  for(const [k,c] of chunks){const i=k.indexOf(','),x=+k.slice(0,i),z=+k.slice(i+1);if(Math.abs(x-ccx)>R+1||Math.abs(z-ccz)>R+1){
    for(const cr of c.crates){cr.open=true;const j=crates.indexOf(cr);if(j>=0)crates.splice(j,1);}
    for(const d of c.dyn){const j=dyns.indexOf(d);if(j>=0)dyns.splice(j,1);}chunks.delete(k);}}}
function clearChunks(){chunks.clear();crates.length=0;dyns.length=0;debris.length=0;}
function obsNear(x,z,cb){const cx=Math.floor(x/CH),cz=Math.floor(z/CH);for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){const c=chunks.get((cx+i)+','+(cz+j));if(c)for(const o of c.obs){const dx=x-o.x,dz=z-o.z,R=o.r+3;if(dx*dx+dz*dz<R*R)cb(o,dx,dz);}}}
const inView=(x,z,m=0)=>Math.abs(x-camT.x)<26+m&&z-camT.z<17+m&&z-camT.z>-34-m;
function drawWorld(){
  const cc=Math.floor(camT.x/CH),cz2=Math.floor(camT.z/CH);
  for(let i=-2;i<=2;i++)for(let j=-2;j<=2;j++){const c=chunks.get((cc+i)+','+(cz2+j));if(!c)continue;
    for(const d of c.decals){if(!inView(d.x,d.z))continue;B.decal.add(d.x,0.006,d.z,d.s,d.s,fxF[d.k],d.col[0],d.col[1],d.col[2],d.a,d.rot,0,0.5);}
    for(const p of c.props){if(!inView(p.x,p.z,8))continue;INST.add(p.P.m,p.x,0,p.z,p.ry,p.P.s);}
    for(const f of c.fires){if(!inView(f.x,f.z))continue;fireFx(f);}
  }
  for(const d of dyns){if(d.dead||!inView(d.x,d.z,2))continue;INST.add(d.P.m,d.x,d.y,d.z,d.ry,d.P.s,d.rx,d.rz);if(d.fuse>=0&&Math.sin(T*40)>0)lightAt(d.x,d.z,3,1,0.3,0.1,0.9);}
  for(const d of debris)INST.add(d.m,d.x,d.y,d.z,d.ry,d.s,d.rx,d.rz);
}
function fireFx(f){const t=T;const fl=0.85+Math.sin(t*17+f.x)*0.1+Math.sin(t*7.3+f.z)*0.08,y0=f.y||0;
  lightAt(f.x,f.z,6*f.s*fl,1,0.55,0.15,0.5);
  for(let i=0;i<3;i++){const ph=(t*1.7+i/3+f.x)%1;fxAdd('fire',f.x+Math.sin(i*2.1+t*3)*0.25*f.s,y0+0.25+ph*1.5*f.s,f.z,(1.4-ph*0.9)*f.s,1,0.7-ph*0.3,0.25,1-ph);}
  if(Math.random()<0.08)part({x:f.x+rand(-.3,.3),y:y0+1.5,z:f.z,vx:rand(-.3,.3)+0.4,vy:rand(1,1.8),vz:rand(-.3,.3),life:rand(2,3),s0:0.7,s1:2.6,fr:'smoke',r:0.55,g:0.5,b:0.5,a:0.4,b2:'smoke'});
  if(Math.random()<0.15)part({x:f.x,y:y0+1,z:f.z,vx:rand(-1,1),vy:rand(2,4),vz:rand(-1,1),life:rand(0.8,1.6),s0:0.08,s1:0.02,fr:'spark',r:1,g:0.7,b:0.2,a:1,b2:'add'});
}
// ---- física de objetos (barriles, conos, cajas, astillas) ----
function kickDyn(d,vx,vz,vy,spin=1){d.awake=true;d.vx+=vx;d.vz+=vz;d.vy+=vy;d.wx+=rand(-8,8)*spin;d.wz+=rand(-8,8)*spin;d.wy+=rand(-4,4)*spin;}
function hurtDyn(d,dmg){if(!d.P.exp||d.dead)return;d.hp-=dmg;if(d.hp<=0&&d.fuse<0){d.fuse=0.12;}}
function updateDyns(dt){
  for(const d of dyns){if(d.dead)continue;
    if(d.fuse>=0){d.fuse-=dt;if(d.fuse<0){d.dead=true;const R=d.name==='gas'?4.2:3.6;explodeAt(d.x,d.z,R,60+S.wave*4);if(Math.hypot(S.x-d.x,S.z-d.z)<R*0.8)hurtPlayer2(12);continue;}}
    // empuje del jugador (dash patea más fuerte)
    const dx=d.x-S.x,dz=d.z-S.z,dd=Math.hypot(dx,dz);const rr=d.P.kick?0.85:0.75;
    if(dd<rr&&S.y<0.8){if(d.P.kick){const k=S.dash>0?14:Math.max(4,Math.hypot(S.vx,S.vz)*1.1);kickDyn(d,dx/(dd||1)*k,dz/(dd||1)*k,S.dash>0?6:3.5);sfx('tink',0.05);}
      else{const p=(rr-dd);S.x-=dx/(dd||1)*p;S.z-=dz/(dd||1)*p;}}
    if(!d.awake)continue;physStep(d,dt);
  }
  for(let i=debris.length-1;i>=0;i--){const d=debris[i];d.life-=dt;physStep(d,dt);if(d.life<=0){debris.splice(i,1);}}
}
function physStep(d,dt){d.vy-=24*dt;d.x+=d.vx*dt;d.y+=d.vy*dt;d.z+=d.vz*dt;d.rx+=d.wx*dt;d.rz+=d.wz*dt;d.ry+=d.wy*dt;
  if(d.y<=0){d.y=0;if(d.vy<-2.5){d.vy*=-0.38;d.wx*=0.6;d.wz*=0.6;if(d.name&&Math.random()<0.5)sfx('tink',0.06);}else d.vy=0;d.vx*=0.82;d.vz*=0.82;d.wy*=0.8;
    // asentarse sobre una cara (múltiplo de 90°)
    const snap=a=>Math.round(a/(Math.PI/2))*(Math.PI/2);const k=Math.min(1,dt*8);d.rx+=(snap(d.rx)-d.rx)*k;d.rz+=(snap(d.rz)-d.rz)*k;d.wx*=0.85;d.wz*=0.85;
    if(Math.abs(d.vx)+Math.abs(d.vz)+Math.abs(d.vy)<0.2&&Math.abs(d.wx)+Math.abs(d.wz)<0.3)d.awake=false;}}
function blastDyns(x,z,r){for(const d of dyns){if(d.dead)continue;const dx=d.x-x,dz=d.z-z,l=Math.hypot(dx,dz);if(l<r*1.4){const f=(1-l/(r*1.4))*12+3;kickDyn(d,dx/(l||1)*f,dz/(l||1)*f,f*0.9,1.6);if(d.P.exp&&l<r)d.fuse=d.fuse<0?rand(0.12,0.3):d.fuse;}}
  for(const c of crates){if(!c.open&&Math.hypot(c.x-x,c.z-z)<r*0.8)c.t+=0;}}

// ================== ESTADO ==================
let S=null,mode='loading',T=0,hitstop=0,frame=0;
const camT={x:0,z:0};
const enemies=[],projs=[],eprojs=[],parts=[],pickups=[],mines=[],fx=[],pets=[],meteors=[],corpses=[],decals=[],ghosts=[];
let eid=1;const keys={};const joy={active:false,x:0,z:0,id:null,ox:0,oy:0};
let hero=null,heroSkin='';
function ensureHero(){const sk=save.custom.skin;if(!hero||heroSkin!==sk){if(hero){scene.remove(hero.root);hero.mat.dispose();}hero=makeSoldier(sk);heroSkin=sk;scene.add(hero.root);}setCamo(hero,save.custom.camo);hero.root.visible=true;return hero;}

function newRun(){
  clearChunks();for(const a of[enemies,projs,eprojs,parts,pickups,mines,fx,meteors,decals,ghosts])a.length=0;
  for(const c of corpses)POOL.put(c.c);corpses.length=0;clearEnemyChars();for(const p of pets)if(p.c)POOL.put(p.c);pets.length=0;
  const pk=save.owned,sk=save.custom.skin;
  S={x:0,z:0,y:0,vy:0,face:-Math.PI/2,aim:-Math.PI/2,rot:Math.PI,hp:100,maxHp:100,spd:7.2,dmg:1,cd:1,magnet:3,regen:0,armor:0,crit:0.05,area:1,multi:0,coinMul:1,
    lvl:1,xp:0,need:xpNeed(1),weapons:[],passives:{},wave:0,waveKills:0,waveQuota:0,spawned:0,spawnT:0,breakT:2,boss:null,
    kills:0,coins:0,time:0,inv:0,shake:0,pendingLv:0,revive:!!pk.p_revivir,fury:0,crateT:25,hordeDone:false,
    dash:0,dashCd:0,dvx:0,dvz:0,recoil:0,vx:0,vz:0,moving:false,step:0,lean:0,camX:0,camZ:0,kick:0,streak:0,streakT:0,sq:0,sqv:0,shootT:0,dead:false};
  if(sk==='comando')S.spd*=1.08;if(sk==='pesado')S.maxHp+=25;if(sk==='francotirador')S.crit+=0.1;if(sk==='medico')S.regen+=0.5;if(sk==='superviviente')S.magnet*=1.15;
  if(pk.p_vida)S.maxHp+=30;if(pk.p_fuerza)S.dmg+=0.15;if(pk.p_iman)S.magnet*=1.5;if(pk.p_botas)S.spd*=1.1;if(pk.p_suerte)S.coinMul=1.3;
  S.hp=S.maxHp;ensureHero();hero.root.position.set(0,0,0);hero.pivot.rotation.set(0,0,0);hero.play('idle',{fade:0});
  addWeapon('pistola',true);
  if(pk.p_arsenal)addWeapon(pick(BASE_WEAPONS.filter(w=>w!=='pistola')),true);
  if(save.pet&&owns(save.pet))addPet(save.pet);
  updateChunks(0,0);mode='play';show('hud');renderSlots();renderPets();startMusic();setIntensity(0);nextWave();fusToastShown=new Set();
  setMenuScene(false);
}
const xpNeed=l=>Math.floor(5+l*6+l*l*0.5);

// ================== PARTÍCULAS ==================
function part(p){if(parts.length>2600)return;p.max=p.life;p.vr=p.vr||0;p.rot=p.rot||0;p.grav=p.grav||0;parts.push(p);}
function sparks(x,y,z,n,col,spd=6,life=0.35,size=0.12){const [r,g,b]=col;for(let i=0;i<n;i++){const a=Math.random()*6.28,u=rand(-0.3,1);part({x,y,z,vx:Math.cos(a)*spd*rand(.3,1),vy:u*spd*0.7,vz:Math.sin(a)*spd*rand(.3,1),life:life*rand(.6,1.2),s0:size,s1:size*0.2,fr:'spark',r,g,b,a:1,b2:'add',grav:9});}}
function blood(x,z,col,n=8,force=4,dir,y0=1){const [r,g,b]=col;for(let i=0;i<n;i++){const a=dir!==undefined?dir+rand(-.8,.8):Math.random()*6.28;const s=rand(.3,1)*force;
    part({x,y:y0*rand(0.7,1.2),z,vx:Math.cos(a)*s,vy:rand(1,4),vz:Math.sin(a)*s,life:rand(.4,.8),s0:rand(.14,.26),s1:0.1,fr:'drop',r,g,b,a:1,b2:'smoke',grav:16,splat:col});}}
function decal(x,z,s,k,r,g,b,a,rot=Math.random()*6.28){if(decals.length>360)decals.shift();decals.push({x,z,s,k,r,g,b,a,rot,t:0});}
function gibs(x,z,col,n=6){for(let i=0;i<n;i++){const a=Math.random()*6.28,s=rand(2,7);part({x,y:1,z,vx:Math.cos(a)*s,vy:rand(3,8),vz:Math.sin(a)*s,life:rand(.8,1.4),s0:rand(.2,.34),s1:.2,fr:'chunk',r:col[0]*1.2+0.1,g:col[1]*1.2+0.05,b:col[2]*1.2+0.05,a:1,b2:'smoke',grav:20,vr:rand(-12,12),bounce:1});}}
function smokePuff(x,y,z,n,s=1.5,dark=0.85,life=1.2){for(let i=0;i<n;i++)part({x:x+rand(-.5,.5),y:y+rand(0,.5),z:z+rand(-.5,.5),vx:rand(-1.2,1.2),vy:rand(.6,1.8),vz:rand(-1.2,1.2),life:life*rand(.7,1.3),s0:s*0.6,s1:s*1.8,fr:'smoke',r:dark,g:dark*0.95,b:dark*0.9,a:0.75,b2:'smoke',vr:rand(-1,1)});}
// "poof" cartoon: anillo de humo blanco + estrellas
function poof(x,y,z,s=1,col=[1,0.9,0.5]){for(let i=0;i<8;i++){const a=i/8*6.28;part({x:x+Math.cos(a)*0.3*s,y:y+rand(-.2,.3),z:z+Math.sin(a)*0.3*s,vx:Math.cos(a)*3*s,vy:rand(0.5,1.5),vz:Math.sin(a)*3*s,life:rand(.45,.7),s0:0.9*s,s1:1.7*s,fr:'smoke',r:1,g:0.98,b:0.95,a:0.9,b2:'smoke',vr:rand(-2,2)});}
  for(let i=0;i<6;i++)part({x,y:y+0.3,z,vx:rand(-4,4)*s,vy:rand(3,7),vz:rand(-4,4)*s,life:rand(.4,.7),s0:0.32*s,s1:0.05,fr:'flare',r:col[0],g:col[1],b:col[2],a:1,b2:'add',grav:12,vr:rand(-6,6)});}
function casing(x,z,a){part({x,y:1.1,z,vx:Math.cos(a+1.6)*rand(2,3.5),vy:rand(2.5,4),vz:Math.sin(a+1.6)*rand(2,3.5),life:1.2,s0:0.1,s1:0.1,fr:'casing',r:1,g:1,b:1,a:1,b2:'smoke',grav:22,vr:rand(10,25),bounce:1,tink:1});}
function updateParts(dt){
  for(let i=parts.length-1;i>=0;i--){const p=parts[i];p.life-=dt;if(p.life<=0){parts[i]=parts[parts.length-1];parts.pop();continue;}
    p.vy-=p.grav*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.rot+=p.vr*dt;
    if(p.b2==='smoke'&&p.fr==='smoke'){p.vx*=1-dt*2;p.vz*=1-dt*2;p.vy*=1-dt*0.8;}
    if(p.y<0.05&&p.grav){if(p.splat){decal(p.x,p.z,rand(0.3,0.8),Math.random()<.5?'splat1':'splat2',p.splat[0],p.splat[1],p.splat[2],0.85);p.life=0;continue;}
      if(p.bounce&&p.vy<-1){p.y=0.05;p.vy*=-0.35;p.vx*=0.6;p.vz*=0.6;p.vr*=0.5;if(p.tink)sfx('tink',0.03);}else{p.y=0.05;p.vy=0;p.vx*=0.85;p.vz*=0.85;p.vr*=0.8;}}
    const k=1-p.life/p.max,s=p.s0+(p.s1-p.s0)*k,a=p.a*(p.fr==='smoke'?Math.min(1,(1-k)*1.5)*Math.min(1,k*6):p.fr==='chunk'||p.fr==='casing'?1:1-k*k);
    const bt=p.b2==='add'?B.add:B.smoke;bt.add(p.x,p.y,p.z,s,s*(p.fr==='casing'?2.2:1),fxF[p.fr],p.r,p.g,p.b,a,p.rot,0,0.5);}
}

// ================== ARMAS ==================
function addWeapon(id,silent){const w={id,lvl:1,t:Math.random()*0.3,ang:0,d:WEAPONS[id]};S.weapons.push(w);if(!silent)toast(`Nueva arma: ${w.d.name}`,id);renderSlots();checkFusionToast();}
function wstat(w){const d=w.d,l=w.lvl-1;return{dmg:d.dmg*(1+0.3*l)*S.dmg,cd:(d.cd||1)*Math.pow(0.92,l)*S.cd*(S.fury>0?0.5:1),count:(d.count||1)+Math.floor(l/3)+(['proj','boomer','meteor','orbit'].includes(d.type)?S.multi:0),area:S.area*(1+0.06*l)};}
function availableFusions(){const r=[];for(const [a,b,c] of FUSIONS){const wa=S.weapons.find(w=>w.id===a),wb=S.weapons.find(w=>w.id===b);if(wa&&wb&&wa.lvl>=3&&wb.lvl>=3)r.push([a,b,c]);}return r;}
function doFusion([a,b,c]){S.weapons=S.weapons.filter(w=>w.id!==a&&w.id!==b);addWeapon(c,true);banner(`¡FUSIÓN! ${WEAPONS[c].name}`);sfx('fusion');
  sparks(S.x,1.2,S.z,50,[1,0.7,0.2],12,0.8,0.2);fx.push({type:'nova',x:S.x,z:S.z,r:7,col:[1,0.6,0.2],life:0.5,max:0.5});S.shake=0.6;renderSlots();}
let fusToastShown=new Set();
function checkFusionToast(){for(const f of availableFusions())if(!fusToastShown.has(f[2])){fusToastShown.add(f[2]);setTimeout(()=>toast(`Fusión disponible: ${WEAPONS[f[2]].name}`,f[2]),1400);}}
function wcol(hex){const s=save.wskin;if(s==='dorado')return[1,0.8,0.25];if(s==='neon')return[[0.25,1,0.1],[1,0.1,0.95],[0.1,0.9,1]][Math.floor(T*3)%3];
  if(s==='arcoiris'){const c=new THREE.Color().setHSL((T*0.5+Math.random()*0.2)%1,1,0.6);return[c.r,c.g,c.b];}if(s==='sombra')return[0.6,0.25,1];return hexRGB(hex);}
function nearestEnemy(x,z,maxD=30,ex){let best=null,bd=maxD*maxD;for(const e of enemies){if(e.dead||(ex&&ex.has(e.id)))continue;const dx=e.x-x,dz=e.z-z,d=dx*dx+dz*dz;if(d<bd){bd=d;best=e;}}return best;}
function muzzle(a,col,big=1){const x=S.x+Math.cos(a)*1.0,z=S.z+Math.sin(a)*1.0;fx.push({type:'flash',x,z,a,col,s:big,life:0.06,max:0.06});S.shootT=0.35;S.sqv-=1.2*big;lightAt(x,z,4*big,col[0],col[1]*0.8,col[2]*0.6,0.8);S.recoil=0.12;S.kick=Math.max(S.kick,0.05*big);}
function fireWeapon(w,dt){
  const d=w.d,st=wstat(w);
  if(d.type==='orbit'){w.ang+=d.rot*dt;const n=st.count,R=d.radius*st.area;const col=wcol(d.color);w.hit=w.hit||new Map();
    for(let i=0;i<n;i++){const a=w.ang+i/n*Math.PI*2,x=S.x+Math.cos(a)*R,z=S.z+Math.sin(a)*R;
      if(d.explodeHit){fxAdd('glow',x,1,z,d.size*1.6,col[0],col[1],col[2],1);fxAdd('spark',x,1,z,d.size*0.7,1,1,1,1);}
      else{INST.add('blade',x,0.9,z,T*14,d.size*1.6);blob(x,z,d.size*1.6,0.3);}
      lightAt(x,z,2.2,col[0],col[1],col[2],0.5);
      if(Math.random()<0.3)part({x,y:1,z,vx:0,vy:0,vz:0,life:0.25,s0:d.size*0.8,s1:0,fr:'glow',r:col[0],g:col[1],b:col[2],a:0.6,b2:'add'});
      queryEnemies(x,z,d.size+0.6,e=>{const lh=w.hit.get(e.id)||0;if(T-lh>0.35){w.hit.set(e.id,T);hurtEnemy(e,st.dmg,{kx:Math.cos(a),kz:Math.sin(a),kb:5});sparks(e.x,1,e.z,4,[1,0.9,0.7],6);sfx('slash',0.05);}});}
    if(w.hit.size>600)w.hit.clear();return;}
  if(d.type==='aura'){const R=d.radius*st.area,col=hexRGB(d.color);B.light.add(S.x,0.03,S.z,R*2.2,R*2.2,fxF.glow,col[0],col[1]*0.8,col[2]*0.5,0.4+Math.sin(T*6)*0.08,0,0,0.5);
    B.light.add(S.x,0.04,S.z,R*2,R*2,fxF.ring,col[0],col[1],col[2],0.5,T,0,0.5);
    if(Math.random()<0.5){const a=Math.random()*6.28,rr=Math.random()*R;part({x:S.x+Math.cos(a)*rr,y:0.2,z:S.z+Math.sin(a)*rr,vx:0,vy:rand(1,2.5),vz:0,life:0.7,s0:0.15,s1:0.02,fr:d.burn?'fire':'spark',r:col[0],g:col[1],b:col[2],a:1,b2:'add'});}}
  w.t-=dt;if(w.t>0)return;
  const tgt=nearestEnemy(S.x,S.z,['mine','aura','nova'].includes(d.type)?99:22);
  if(!tgt&&!['mine','aura','nova'].includes(d.type)){w.t=0.1;return;}
  w.t=st.cd;const ax=tgt?Math.atan2(tgt.z-S.z,tgt.x-S.x):S.face;if(tgt)S.aim=ax;
  const col=wcol(d.color);
  switch(d.type){
    case 'proj':{const n=st.count;for(let i=0;i<n;i++){const a=ax+(n>1?(i/(n-1)-0.5)*d.spread*Math.min(2,1+n*0.05):0)+rand(-1,1)*(n>1?0.03:d.spread);
        projs.push({x:S.x+Math.cos(a)*0.7,z:S.z+Math.sin(a)*0.7,y:1.15,vx:Math.cos(a)*d.spd,vz:Math.sin(a)*d.spd,life:d.life,dmg:st.dmg,pierce:d.pierce,size:d.size*(d.explode?1:Math.sqrt(st.area)),col,hits:null,
          explode:d.explode?d.explode*st.area:0,freeze:d.freeze,homing:d.homing,chainHit:d.chainHit,rocket:!!d.explode,orb:d.size>=0.5});}
      muzzle(ax,col,d.explode?1.4:n>3?1.5:1);if(!d.explode&&d.size<0.5)casing(S.x,S.z,ax);
      sfx(d.explode?'rocket':d.size>=0.5?'plasma':n>3?'shotgun':d.freeze?'freeze':d.cd<0.2?'smg':'shoot');if(n>3)S.shake=Math.max(S.shake,0.15);break;}
    case 'flame':{for(let i=0;i<2;i++){const a=ax+rand(-d.spread,d.spread),sp=d.spd*rand(0.8,1.2);projs.push({x:S.x+Math.cos(a)*0.7,z:S.z+Math.sin(a)*0.7,y:1.05,vx:Math.cos(a)*sp,vz:Math.sin(a)*sp,life:d.life*st.area,maxLife:d.life*st.area,dmg:st.dmg,pierce:99,size:d.size,col,flame:1,burn:1,hits:null});}
      lightAt(S.x+Math.cos(ax)*2.5,S.z+Math.sin(ax)*2.5,5,1,0.5,0.15,0.5);sfx('flame',0.09);break;}
    case 'beam':{const L=d.len*st.area,ex=S.x+Math.cos(ax)*L,ez=S.z+Math.sin(ax)*L;fx.push({type:'beam',x1:S.x+Math.cos(ax)*0.7,z1:S.z+Math.sin(ax)*0.7,x2:ex,z2:ez,w:d.width*st.area,col,life:0.2,max:0.2});
      for(const e of enemies){if(e.dead)continue;const t=((e.x-S.x)*Math.cos(ax)+(e.z-S.z)*Math.sin(ax));if(t<0||t>L)continue;const px=S.x+Math.cos(ax)*t,pz=S.z+Math.sin(ax)*t;
        if(Math.hypot(e.x-px,e.z-pz)<e.r+d.width*st.area){hurtEnemy(e,st.dmg,{freeze:d.freeze,kx:Math.cos(ax),kz:Math.sin(ax),kb:3});sparks(e.x,1.1,e.z,3,col,5);}}
      muzzle(ax,col,1.5);sfx(d.dmg>50?'rail':'laser');S.shake=Math.max(S.shake,d.dmg>50?0.3:0.08);break;}
    case 'chain':{let cx=S.x,cz=S.z,cur=tgt;const hit=new Set();for(let i=0;i<d.chain+Math.floor((w.lvl-1)/2);i++){if(!cur)break;hit.add(cur.id);fx.push({type:'bolt',x1:cx,z1:cz,x2:cur.x,z2:cur.z,col,life:0.16,max:0.16,seed:Math.random()*99});
        hurtEnemy(cur,st.dmg,{burn:d.burn});sparks(cur.x,1.1,cur.z,5,col,6);lightAt(cur.x,cur.z,3.5,col[0],col[1],col[2],0.8);cx=cur.x;cz=cur.z;cur=nearestEnemy(cx,cz,d.range*0.6,hit);}sfx('zap');break;}
    case 'boomer':{for(let i=0;i<st.count;i++){const a=ax+(i-(st.count-1)/2)*0.4;projs.push({x:S.x,z:S.z,y:1,vx:Math.cos(a)*d.spd,vz:Math.sin(a)*d.spd,life:d.life,dmg:st.dmg,pierce:99,size:d.size*st.area,col,boomer:1,age:0,hits:new Map()});}sfx('whoosh');break;}
    case 'mine':{mines.push({x:S.x,z:S.z,dmg:st.dmg,r:d.explode*st.area,arm:0.5,life:20});sfx('click');break;}
    case 'meteor':{for(let i=0;i<st.count;i++){const e=i===0&&tgt?tgt:pick(enemies);if(!e)break;meteors.push({x:e.x+rand(-1,1),z:e.z+rand(-1,1),t:0.9+i*0.12,max:0.9+i*0.12,dmg:st.dmg,r:d.explode*st.area});}sfx('meteor');break;}
    case 'nova':{const R=d.radius*st.area;fx.push({type:'nova',x:S.x,z:S.z,r:R,col,life:0.45,max:0.45});queryEnemies(S.x,S.z,R,e=>{const dx=e.x-S.x,dz=e.z-S.z,l=Math.hypot(dx,dz)||1;hurtEnemy(e,st.dmg,{kx:dx/l,kz:dz/l,kb:9,freeze:d.freeze,burn:d.burn});});
      sfx('nova');S.shake=Math.max(S.shake,0.2);lightAt(S.x,S.z,R*2.5,col[0],col[1],col[2],0.9);break;}
    case 'aura':{const R=d.radius*st.area;queryEnemies(S.x,S.z,R,e=>hurtEnemy(e,st.dmg,{burn:d.burn,quiet:1}));break;}
  }
}

// ================== ENEMIGOS ==================
const grid=new Map(),GC=3;let gridUsed=[];
const gkey=(cx,cz)=>(cx+50000)*100000+(cz+50000);
function buildGrid(){for(const a of gridUsed)a.length=0;gridUsed=[];for(const e of enemies){if(e.dead)continue;const k=gkey(Math.floor(e.x/GC),Math.floor(e.z/GC));let a=grid.get(k);if(!a){a=[];grid.set(k,a);}if(!a.length)gridUsed.push(a);a.push(e);}if(grid.size>5000)grid.clear();}
function queryEnemies(x,z,r,cb){const r2=r+2;const x0=Math.floor((x-r2)/GC),x1=Math.floor((x+r2)/GC),z0=Math.floor((z-r2)/GC),z1=Math.floor((z+r2)/GC);
  for(let i=x0;i<=x1;i++)for(let j=z0;j<=z1;j++){const a=grid.get(gkey(i,j));if(!a)continue;for(let k=a.length-1;k>=0;k--){const e=a[k];if(e.dead)continue;const dx=e.x-x,dz=e.z-z,rr=r+e.r;if(dx*dx+dz*dz<rr*rr)cb(e);}}}
function clearEnemyChars(){for(const e of enemies)if(e.c){POOL.put(e.c);e.c=null;}}
function spawnEnemy(fam,role,x,z){
  const R=ROLES[role],w=S.wave;const hpM=1+(w-1)*0.28+w*w*0.012,spM=Math.min(1.7,1+(w-1)*0.025);const bossM=role==='jefe'?(1+Math.floor(w/5)*0.6):1;
  const spec=fam+'_'+role,sp=ESPEC[spec];
  const e={id:eid++,fam,role,spec,x,z,y:0,vx:0,vz:0,hp:R.hp*hpM*bossM,max:R.hp*hpM*bossM,spd:R.spd*spM*rand(0.9,1.1),r:R.r,dmg:R.dmg*(1+w*0.04),xp:R.xp,h:sp.h,blood:FAMS[fam].blood,
    hitT:0,frz:0,burn:0,atk:rand(1,3),fuse:-1,boss:R.boss,ranged:R.ranged,explode:R.explode,dead:false,spawnT:0.55,face:Math.atan2(S.x-x,S.z-z),
    sq:0,sqv:0,tilt:0,actT:0,act:'',meleeT:0,acc:0,c:null};
  e.c=POOL.get(spec,()=>makeEnemyChar(spec));e.c.root.position.set(x,0,z);e.c.play(sp.run||'run',{fade:0});e.c.mixer.update(Math.random());
  enemies.push(e);return e;}
function hurtEnemy(e,dmg,o={}){
  if(e.dead)return;const crit=Math.random()<S.crit;if(crit)dmg*=2;e.hp-=dmg;e.hitT=0.08;
  if(o.freeze)e.frz=Math.max(e.frz,o.freeze);if(o.burn)e.burn=Math.max(e.burn,2.5);
  if(o.kb&&!e.boss){const k=o.kb/(e.role==='tanque'?3:1);e.vx+=o.kx*k;e.vz+=o.kz*k;e.tilt=Math.min(0.6,e.tilt+k*0.06);}
  // squash elástico al recibir el golpe
  if(!o.quiet||Math.random()<0.2)e.sqv+=e.boss?2.5:5.5;
  if(!o.quiet&&!e.boss&&e.actT<=0&&(o.kb||0)>=2&&e.c.has('hit')){e.actT=e.c.play('hit',{once:true,fade:0.06,ts:1.6})*0.8;e.act='hit';}
  if(!o.quiet||Math.random()<0.15)dmgNum(e.x,e.h*0.95,e.z,dmg,crit?'#ffd83a':o.burn?'#ff9a4a':'#fff',crit);
  if(!o.quiet){sfx('hit',0.05);if(Math.random()<0.5)blood(e.x,e.z,e.blood,3,3,o.kx!==undefined?Math.atan2(o.kz,o.kx):undefined,e.h*0.55);}
  if(e.boss&&!o.quiet)hitstop=Math.max(hitstop,0.015);
  if(e.hp<=0)killEnemy(e,o);
}
function killEnemy(e,o={}){
  e.dead=true;S.kills++;S.waveKills++;S.streak++;S.streakT=1.2;sfx(e.boss?'bossdie':'kill',0.04);
  blood(e.x,e.z,e.blood,e.boss?36:9,e.boss?9:5,undefined,e.h*0.5);if(e.boss)gibs(e.x,e.z,e.blood,20);
  decal(e.x,e.z,(e.boss?5:1.3)*rand(0.8,1.2),Math.random()<.5?'splat1':'splat2',e.blood[0],e.blood[1],e.blood[2],0.85);
  toCorpse(e,o);
  const gems=e.boss?20:1;for(let i=0;i<gems;i++)drop(e.x+(e.boss?rand(-2,2):0),e.z+(e.boss?rand(-2,2):0),'xp',e.boss?e.xp/10:e.xp);
  if(Math.random()<(e.boss?1:0.07+(e.role==='tanque'?0.3:0))){const n=e.boss?25:1;for(let i=0;i<n;i++)drop(e.x+(e.boss?rand(-2,2):0),e.z+(e.boss?rand(-2,2):0),'coin',1);}
  if(Math.random()<0.012)drop(e.x,e.z,'heart',20);
  if(Math.random()<(e.boss?1:0.006))drop(e.x,e.z,pick(['iman','bomba','furia']),0);
  if(e.boss){drop(e.x,e.z,'chest',0);S.shake=1.2;hitstop=0.25;explodeAt(e.x,e.z,6,0,[1,0.5,0.2],false,true);if(S.boss===e)S.boss=null;banner('¡JEFE DERROTADO!');}
  if(S.streak>0&&S.streak%25===0)toast(`¡Racha de ${S.streak} bajas!`);
}
// muerte con física tipo ragdoll: sale despedido, gira, rebota, se aplasta y desaparece en un "poof"
function toCorpse(e,o){const c=e.c;e.c=null;if(!c)return;
  if(corpses.length>=(isTouch?26:40)){const old=corpses.shift();poof(old.x,0.5,old.z,0.8);POOL.put(old.c);}
  let kx=o.kx,kz=o.kz;if(kx===undefined){const dx=e.x-S.x,dz=e.z-S.z,l=Math.hypot(dx,dz)||1;kx=dx/l;kz=dz/l;}
  const f=e.boss?2:rand(5,9)*(o.kb?Math.min(1.6,0.6+o.kb*0.12):0.8);
  c.play('death',{once:true,fade:0.08,ts:e.boss?0.8:1.25});c.mat.userData.u.uFlash.value=0.8;
  corpses.push({c,x:e.x,y:e.c?0:(e.y||0),z:e.z,vx:kx*f,vz:kz*f,vy:e.boss?3:rand(4,7),face:e.face,
    spin:(Math.random()<0.5?-1:1)*rand(4,9)*(e.boss?0.2:1),rx:0,rz:0,wx:rand(3,7)*(e.boss?0.2:1),t:0,boss:e.boss,h:e.h,sq:0,sqv:0,fly:ESPEC[e.spec].fly||0,blood:e.blood,bounces:0,
    tint:c.baseTint});}
function updateCorpses(dt){
  for(let i=corpses.length-1;i>=0;i--){const k=corpses[i];k.t+=dt;const c=k.c;
    k.vy-=26*dt;k.x+=k.vx*dt;k.z+=k.vz*dt;k.y+=k.vy*dt;
    if(k.y<=0){k.y=0;if(k.vy<-3&&k.bounces<2){k.vy*=-0.35;k.bounces++;k.sqv+=7;k.wx*=0.4;k.spin*=0.5;smokePuff(k.x,0.1,k.z,2,0.6,0.9,0.5);if(k.bounces===1)sfx('land',0.08);}else k.vy=0;k.vx*=Math.pow(0.02,dt);k.vz*=Math.pow(0.02,dt);k.spin*=Math.pow(0.05,dt);k.wx*=Math.pow(0.05,dt);}
    k.face+=k.spin*dt;if(k.y>0)k.rx=Math.min(1.45,k.rx+k.wx*dt);
    k.sqv+=(-160*k.sq-12*k.sqv)*dt;k.sq+=k.sqv*dt;
    const u=c.mat.userData.u;u.uFlash.value=Math.max(0,u.uFlash.value-dt*5);
    const fade=k.t>1.5?Math.min(1,(k.t-1.5)/0.5):0;
    c.root.position.set(k.x,k.y-(k.boss?0:fade*0.6)+k.fly*(1-Math.min(1,k.t*2)),k.z);c.root.rotation.set(0,k.face,0);c.pivot.rotation.set(-k.rx*0.6,0,0);
    const s=1-fade*0.7;c.pivot.scale.set((1+k.sq*0.6)*s,(1-k.sq)*s,(1+k.sq*0.6)*s);
    c.update(dt);
    if(inView(k.x,k.z))blob(k.x,k.z,k.h*0.55*(1-fade),0.4*(1-fade));
    if(k.t>(k.boss?3:2)){poof(k.x,0.4,k.z,k.boss?2.2:0.9,[...k.blood.map(v=>Math.min(1,v+0.4))]);POOL.put(c);corpses.splice(i,1);}}
}
function drop(x,z,type,val){if(pickups.length>800&&type==='xp'){const p=pickups.find(p=>p.type==='xp');if(p){p.val+=val;return;}}pickups.push({x,z,type,val,t:0,vy:type==='coin'?5:3.5,y:0.6,mag:false,vx:rand(-1.5,1.5),vz:rand(-1.5,1.5)});}
function explodeAt(x,z,r,dmg,col=[1,0.55,0.15],hurtPlayer=false,noDmg=false){
  fx.push({type:'nova',x,z,r,col,life:0.35,max:0.35});fx.push({type:'boom',x,z,r,life:0.5,max:0.5});
  for(let i=0;i<9;i++)part({x:x+rand(-r,r)*0.3,y:rand(0.3,1.2),z:z+rand(-r,r)*0.3,vx:rand(-3,3),vy:rand(1,4),vz:rand(-3,3),life:rand(0.3,0.6),s0:r*0.6,s1:r*0.95,fr:'fire',r:1,g:rand(0.55,0.85),b:0.25,a:1,b2:'add'});
  sparks(x,0.8,z,20,[1,0.8,0.35],r*4,0.6,0.16);smokePuff(x,0.6,z,7,r*0.55,0.92,1.4);gibs(x,z,[0.45,0.4,0.35],4);
  decal(x,z,r*1.5,'scorch',1,1,1,0.6);blastDyns(x,z,r);
  sfx('boom',0.06);S.shake=Math.max(S.shake,Math.min(0.7,0.2+r*0.06));hitstop=Math.max(hitstop,0.03);
  if(noDmg)return;
  if(hurtPlayer){if(Math.hypot(S.x-x,S.z-z)<r)hurtPlayer2(dmg);}else queryEnemies(x,z,r,e=>{const dx=e.x-x,dz=e.z-z,l=Math.hypot(dx,dz)||1;hurtEnemy(e,dmg,{kx:dx/l,kz:dz/l,kb:7});});
}
function hurtPlayer2(d){if(S.inv>0||S.dash>0||mode!=='play')return;d*=Math.max(0.3,1-S.armor);S.hp-=d;S.inv=0.5;S.shake=Math.max(S.shake,0.4);hitstop=Math.max(hitstop,0.05);sfx('hurt');S.sqv+=6;S.hurtT=0.15;
  dmgNum(S.x,2.4,S.z,d,'#ff4a4a',true);sparks(S.x,1.2,S.z,8,[1,0.4,0.3],5);flashScreen();if(navigator.vibrate)try{navigator.vibrate(40)}catch(e){}
  if(S.hp<=0){if(S.revive){S.revive=false;S.hp=S.maxHp*0.6;S.inv=3;banner('¡SEGUNDA VIDA!');for(const e of enemies)if(Math.hypot(e.x-S.x,e.z-S.z)<10)hurtEnemy(e,e.boss?500:9999,{quiet:1});explodeAt(S.x,S.z,10,0,[1,1,1],false,true);}else gameOver();}}
let flashT;function flashScreen(){const e=$('hurt');e.style.opacity=1;clearTimeout(flashT);flashT=setTimeout(()=>e.style.opacity=0,120);}

// ================== OLEADAS INFINITAS ==================
function nextWave(){
  S.wave++;S.waveKills=0;S.spawned=0;S.waveQuota=Math.floor(25+S.wave*12+S.wave*S.wave*0.6);S.spawnT=0;S.hordeDone=false;
  if(S.wave%5===0){const fam=['zombi','monstruo','alien'][(S.wave/5-1)%3];const a=-Math.PI/2+rand(-0.8,0.8);S.boss=spawnEnemy(fam,'jefe',S.x+Math.cos(a)*20,S.z+Math.sin(a)*20);
    banner(`OLEADA ${S.wave} · ${FAMS[fam].boss.toUpperCase()}`,true);sfx('boss');setIntensity(2);}
  else{banner(`OLEADA ${S.wave}`);sfx('wave');setIntensity(S.wave>=10?1:0);}
}
const maxAlive=()=>qLevel>=3?260:qLevel>=2?150:110;
function spawnTick(dt){
  if(S.breakT>0){S.breakT-=dt;return;}
  S.spawnT-=dt;
  if(S.spawnT<=0&&S.spawned<S.waveQuota&&enemies.length<maxAlive()){
    S.spawnT=Math.max(0.12,0.9-S.wave*0.04);const grp=Math.min(S.waveQuota-S.spawned,2+Math.floor(S.wave/2)+Math.floor(Math.random()*3),maxAlive()-enemies.length);const a0=Math.random()*Math.PI*2;
    for(let i=0;i<grp;i++){const a=a0+rand(-0.5,0.5),d=rand(23,28);spawnEnemy(pickFam(),pickRole(),S.x+Math.cos(a)*d,S.z+Math.sin(a)*d*0.9);S.spawned++;}}
  if(!S.hordeDone&&S.wave>=3&&S.spawned>S.waveQuota*0.5){S.hordeDone=true;const n=Math.min(30+S.wave*3,maxAlive()-enemies.length);if(n>10){toast('¡Una horda te rodea!');const f=pickFam();sfx('horde');
    for(let i=0;i<n;i++){const a=i/n*Math.PI*2;spawnEnemy(f,Math.random()<0.7?'normal':'rapido',S.x+Math.cos(a)*22,S.z+Math.sin(a)*20);}S.waveQuota+=n;S.spawned+=n;}}
  if(S.spawned>=S.waveQuota&&S.waveKills>=S.waveQuota&&!S.boss){S.breakT=3;nextWave();}
}
function pickFam(){const f=['zombi'];if(S.wave>=2)f.push('monstruo');if(S.wave>=4)f.push('alien');return pick(f);}
function pickRole(){const w=S.wave,r=Math.random();if(w>=4&&r<0.08)return'explosivo';if(w>=3&&r<0.16)return'tirador';if(w>=3&&r<0.24)return'tanque';if(w>=2&&r<0.42)return'rapido';return'normal';}

// ================== COMPAÑEROS ==================
function addPet(type){const a=Math.random()*6;const p={type,x:S.x+Math.cos(a)*2,z:S.z+Math.sin(a)*2,t:0,cd:0,face:0,mv:0,act:0,c:null};
  if(type!=='dron'){p.c=POOL.get('pet_'+type,()=>makePetChar(type));p.c.play('idle',{fade:0});}pets.push(p);renderPets();}
function updatePets(dt){
  pets.forEach((p,idx)=>{
    let tx=S.x+Math.cos(T*0.7+idx*2)*2.4,tz=S.z+Math.sin(T*0.7+idx*2)*2.4,spd=10;
    if(p.type==='gato'){let best=null,bd=144;for(const q of pickups){const d=(q.x-p.x)**2+(q.z-p.z)**2;if(d<bd&&!q.mag){bd=d;best=q;}}if(best){tx=best.x;tz=best.z;spd=12;if(bd<1)best.mag=true;}}
    const e=nearestEnemy(p.x,p.z,p.type==='perro'?9:12);
    if(p.type==='perro'&&e&&Math.hypot(e.x-S.x,e.z-S.z)<12){tx=e.x;tz=e.z;spd=11;}
    p.cd-=dt;p.act-=dt;const pw=1+S.wave*0.15;
    if(e&&p.cd<=0){const dd=Math.hypot(e.x-p.x,e.z-p.z)||1;
      if((p.type==='perro'||p.type==='gato')&&dd<e.r+0.9){hurtEnemy(e,(p.type==='perro'?18:10)*pw,{kx:(e.x-p.x)/dd,kz:(e.z-p.z)/dd,kb:5});p.cd=p.type==='perro'?0.5:0.4;sfx('bite');p.act=p.c.play('attack',{once:true,fade:0.05,ts:1.5})*0.9;}
      if(p.type==='dron'){const a=Math.atan2(e.z-p.z,e.x-p.x);projs.push({x:p.x,z:p.z,y:1.7,vx:Math.cos(a)*26,vz:Math.sin(a)*26,life:0.9,dmg:9*pw,pierce:1,size:0.14,col:[0.4,1,0.4],hits:null});p.cd=0.35;sfx('shoot');lightAt(p.x,p.z,2,0.4,1,0.4,0.6);}
      if(p.type==='dragon'&&dd<7){const a=Math.atan2(e.z-p.z,e.x-p.x);for(let i=0;i<3;i++)projs.push({x:p.x,z:p.z,y:1.4,vx:Math.cos(a+rand(-.3,.3))*10,vz:Math.sin(a+rand(-.3,.3))*10,life:0.5,maxLife:0.5,dmg:4*pw,pierce:99,size:0.3,col:[1,0.45,0.1],flame:1,burn:1,hits:null});p.cd=0.08;p.face=Math.atan2(e.x-p.x,e.z-p.z);}}
    for(const q of pickups)if(!q.mag&&(q.x-p.x)**2+(q.z-p.z)**2<2.5)q.mag=true;
    const dx=tx-p.x,dz=tz-p.z,d=Math.hypot(dx,dz);p.mv=d>0.3?1:0;if(d>0.3){const m=Math.min(d,spd*dt);p.x+=dx/d*m;p.z+=dz/d*m;p.face=angLerp(p.face,Math.atan2(dx,dz),Math.min(1,dt*12));}
    if(Math.hypot(S.x-p.x,S.z-p.z)>20){p.x=S.x;p.z=S.z;}p.t+=dt;
    drawPet(p,dt);
  });
}
function drawPet(p,dt){
  if(p.type==='dron'){const y=1.6+Math.sin(p.t*4)*0.18;INST.add('drone',p.x,y,p.z,p.t*0.8,1.3,Math.sin(p.t*3)*0.1);blob(p.x,p.z,0.9,0.3);lightAt(p.x,p.z,1.6,0.4,1,0.6,0.25);return;}
  const c=p.c;if(!c)return;const fly=c.spec.fly;
  if(p.act<=0)c.play(p.mv?'run':'idle',{fade:0.12,ts:p.mv?1.2:1});
  c.root.position.set(p.x,fly?Math.sin(p.t*4)*0.15:0,p.z);c.root.rotation.y=p.face;c.update(dt);if(!fly)blob(p.x,p.z,0.9,0.4);else blob(p.x,p.z,1,0.3);c.outline(outlinesOn);}

// ================== UPDATE ==================
function update(dt){
  T+=dt;S.time+=dt;S.inv-=dt;S.fury-=dt;S.dashCd-=dt;S.recoil=Math.max(0,S.recoil-dt);S.streakT-=dt;S.shootT-=dt;if(S.streakT<=0)S.streak=0;S.hurtT=(S.hurtT||0)-dt;
  if(S.regen>0)S.hp=Math.min(S.maxHp,S.hp+S.regen*dt);
  let mx=0,mz=0;if(keys.KeyW||keys.ArrowUp)mz-=1;if(keys.KeyS||keys.ArrowDown)mz+=1;if(keys.KeyA||keys.ArrowLeft)mx-=1;if(keys.KeyD||keys.ArrowRight)mx+=1;
  if(joy.active){mx=joy.x;mz=joy.z;}const ml=Math.hypot(mx,mz);if(ml>1){mx/=ml;mz/=ml;}
  S.moving=ml>0.12;
  // aceleración rápida y frenado seco (movimiento ágil)
  const tvx=mx*S.spd,tvz=mz*S.spd,acc=S.moving?45:60;
  S.vx+=clamp(tvx-S.vx,-acc*dt,acc*dt);S.vz+=clamp(tvz-S.vz,-acc*dt,acc*dt);
  if(S.moving)S.face=Math.atan2(mz,mx);
  let vx=S.vx,vz=S.vz;
  if(S.dash>0){S.dash-=dt;vx=S.dvx;vz=S.dvz;ghosts.push({x:S.x,z:S.z,y:S.y,t:0.3});}
  const nx=S.x+vx*dt,nz=S.z+vz*dt;
  if(S.y<=0.001&&(S.moving||S.dash>0)){let jump=false;const l=Math.hypot(vx,vz)||1;obsNear(nx+vx/l*0.5,nz+vz/l*0.5,(o,dx,dz)=>{if(o.small&&dx*dx+dz*dz<(o.r+0.45)**2)jump=true;});
    if(jump){S.vy=9;S.y=0.01;sfx('jump');smokePuff(S.x,0.1,S.z,3,0.5,0.9,0.5);S.sqv-=7;hero.play('jump',{once:true,fade:0.05,ts:1.4});S.airT=0;}}
  S.x=nx;S.z=nz;
  if(S.y>0||S.vy>0){S.vy-=26*dt;S.y+=S.vy*dt;S.airT=(S.airT||0)+dt;if(S.y<=0){S.y=0;S.vy=0;smokePuff(S.x,0.1,S.z,4,0.5,0.9,0.5);sfx('land');S.sqv+=8;}}
  obsNear(S.x,S.z,(o,dx,dz)=>{if(o.small&&S.y>o.h*0.6)return;const rr=o.r+0.4,d2=dx*dx+dz*dz;if(d2<rr*rr){const d=Math.sqrt(d2)||1;S.x=o.x+dx/d*rr;S.z=o.z+dz/d*rr;}});
  if(S.moving&&S.y<=0){const sp=Math.hypot(S.vx,S.vz);S.step+=dt*sp*0.34;if(Math.floor(S.step*2)!==Math.floor((S.step-dt*sp*0.34)*2)){sfx('step',0.12);if(Math.random()<0.6)part({x:S.x,y:0.1,z:S.z,vx:rand(-.5,.5),vy:0.4,vz:rand(-.5,.5),life:0.5,s0:0.3,s1:0.8,fr:'smoke',r:0.95,g:0.88,b:0.75,a:0.45,b2:'smoke'});}}
  updateChunks(S.x,S.z);
  S.shake=Math.max(0,S.shake-dt*2);S.kick=Math.max(0,S.kick-dt*0.6);
  S.camX+=(S.x+S.vx*0.22-S.camX)*Math.min(1,dt*7);S.camZ+=(S.z+S.vz*0.18-S.camZ)*Math.min(1,dt*7);
  spawnTick(dt);buildGrid();
  for(const w of S.weapons)fireWeapon(w,dt);
  updateEnemies(dt);updateCorpses(dt);updateProjs(dt);updatePickups(dt);updatePets(dt);updateDyns(dt);
  S.crateT-=dt;if(S.crateT<=0){S.crateT=35;const a=Math.random()*6.28;const c=makeCrate(S.x+Math.cos(a)*11,S.z+Math.sin(a)*9);crates.push(c);const ch=chunks.get(Math.floor(c.x/CH)+','+Math.floor(c.z/CH));if(ch)ch.crates.push(c);toast('Caja de suministros cerca');}
  for(const c of crates.slice()){if(c.open)continue;if((c.x-S.x)**2+(c.z-S.z)**2<2.2)openCrate(c);}
  if(S.pendingLv>0&&mode==='play')showLevelUp();
  hudUpdate();
}
function doDash(){if(mode!=='play'||S.dashCd>0)return;let dx=S.vx,dz=S.vz;const l=Math.hypot(dx,dz);if(l<0.5){dx=Math.cos(S.face);dz=Math.sin(S.face);}else{dx/=l;dz/=l;}
  S.dash=0.17;S.dashCd=1.1;S.dvx=dx*24;S.dvz=dz*24;S.inv=Math.max(S.inv,0.25);sfx('dash');smokePuff(S.x,0.1,S.z,4,0.6,0.92,0.45);S.shake=Math.max(S.shake,0.08);S.sqv-=9;
  $('dashB').classList.add('cd');setTimeout(()=>$('dashB').classList.remove('cd'),1100);}
function updateEnemies(dt){
  const many=enemies.length>70;frame++;
  for(let i=enemies.length-1;i>=0;i--){const e=enemies[i];if(e.dead){enemies[i]=enemies[enemies.length-1];enemies.pop();continue;}
    e.hitT-=dt;e.frz-=dt;e.spawnT-=dt;e.actT-=dt;e.meleeT-=dt;
    if(e.burn>0){e.burn-=dt;e.bt=(e.bt||0)-dt;if(e.bt<=0){e.bt=0.4;hurtEnemy(e,3+S.wave*0.8,{quiet:1});if(e.dead)continue;}if(Math.random()<0.3)part({x:e.x+rand(-.3,.3),y:e.h*rand(.3,.8),z:e.z,vx:0,vy:2,vz:0,life:0.4,s0:0.4,s1:0.1,fr:'fire',r:1,g:0.55,b:0.15,a:1,b2:'add'});}
    const dx=S.x-e.x,dz=S.z-e.z,d=Math.hypot(dx,dz)||1;let sp=e.spd*(e.frz>0?0.35:1);
    if(d>55){POOL.put(e.c);e.c=null;enemies[i]=enemies[enemies.length-1];enemies.pop();S.spawned--;continue;}
    let wx=dx/d,wz=dz/d;if(e.ranged&&d<9){wx=-wx*0.5;wz=-wz*0.5;}
    if(e.spawnT>0)sp*=0.2;
    if(e.boss){e.atk-=dt;if(e.atk<=0){e.atk=2.2;const n=10+Math.floor(S.wave/5)*2,c=hexRGB(FAMS[e.fam].eye);for(let k=0;k<n;k++){const a=k/n*6.28+T;eprojs.push({x:e.x,z:e.z,vx:Math.cos(a)*8,vz:Math.sin(a)*8,life:3,dmg:e.dmg*0.5,col:c});}
        e.actT=e.c.play('attack',{once:true,fade:0.08,ts:1.1})*0.85;e.sqv+=3;
        if(Math.random()<0.4){e.vx+=wx*18;e.vz+=wz*18;sfx('roar');}S.shake=Math.max(S.shake,0.2);sfx('bossatk');}}
    else if(e.ranged){e.atk-=dt;if(e.atk<=0&&d<16&&e.spawnT<=0){e.atk=rand(1.8,2.8);e.actT=e.c.play('shoot',{once:true,fade:0.06,ts:1.6})*0.6;e.shotT=0.22;sfx('spit',0.1);}
      if(e.shotT>0){e.shotT-=dt;if(e.shotT<=0)eprojs.push({x:e.x+wx*0.6,z:e.z+wz*0.6,vx:dx/d*9,vz:dz/d*9,life:2.5,dmg:e.dmg,col:hexRGB(FAMS[e.fam].eye)});}}
    if(e.explode&&d<1.8&&e.fuse<0){e.fuse=0.45;sfx('fuse');}
    if(e.fuse>=0){e.fuse-=dt;sp*=0.2;e.sqv+=Math.sin(T*50)*2;if(e.fuse<=0){e.dead=true;S.waveKills++;explodeAt(e.x,e.z,2.8,e.dmg,[1,0.5,0.1],true);explodeAt(e.x,e.z,2.8,30,[1,0.5,0.1],false,false);blood(e.x,e.z,e.blood,14,7,undefined,1);poof(e.x,0.6,e.z,1.3);POOL.put(e.c);e.c=null;continue;}}
    e.vx*=Math.pow(0.02,dt);e.vz*=Math.pow(0.02,dt);
    e.x+=(wx*sp+e.vx)*dt;e.z+=(wz*sp+e.vz)*dt;
    let n=0;queryEnemies(e.x,e.z,e.r,o=>{if(o===e||n>6)return;n++;const ox=e.x-o.x,oz=e.z-o.z,od=Math.hypot(ox,oz)||0.01,ov=e.r+o.r-od;if(ov>0){const p=Math.min(ov,0.5)*0.5*(o.boss?2:1)*(e.boss?0.1:1);e.x+=ox/od*p;e.z+=oz/od*p;}});
    if(!e.boss)obsNear(e.x,e.z,(o,ox,oz)=>{if(o.small)return;const rr=o.r+e.r,d2=ox*ox+oz*oz;if(d2<rr*rr){const dd=Math.sqrt(d2)||1;e.x=o.x+ox/dd*rr-oz/dd*0.06;e.z=o.z+oz/dd*rr+ox/dd*0.06;}});
    if(d<e.r+0.5&&S.y<1.2)hurtPlayer2(e.dmg);
    // ataque cuerpo a cuerpo visual al estar cerca
    if(!e.ranged&&!e.boss&&!e.explode&&d<e.r+1.6&&e.meleeT<=0&&e.actT<=0){e.meleeT=rand(0.9,1.4);e.actT=e.c.play('attack',{once:true,fade:0.06,ts:1.5})*0.75;e.sqv-=3;}
    if(Math.random()<0.0015)sfx(e.fam==='alien'?'chitter':'groan',0.4);
    // ---- animación y dibujo ----
    const c=e.c,vis=inView(e.x,e.z,3);c.root.visible=vis;
    const tf=Math.atan2(wx+e.vx*0.05,wz+e.vz*0.05);e.face=angLerp(e.face,e.ranged&&d<9?Math.atan2(dx,dz):tf,Math.min(1,dt*(e.boss?3:9)));
    if(e.actT<=0&&c.curK!==(c.spec.run||'run'))c.play(c.spec.run||'run',{fade:0.18});
    if(c.curK===(c.spec.run||'run'))c.speed(clamp(sp/ROLES[e.role].spd,0.3,1.6)*(c.spec.rs||1));
    e.sqv+=(-180*e.sq-11*e.sqv)*dt;e.sq+=e.sqv*dt;e.tilt=Math.max(0,e.tilt-dt*2.5);
    if(!vis){e.acc+=dt;continue;}
    const sp0=e.spawnT>0?1-e.spawnT/0.55:1,pop=e.spawnT>0?Math.sin(sp0*Math.PI*0.5)*(1+Math.sin(sp0*Math.PI)*0.25):1;
    c.root.position.set(e.x,e.spawnT>0?-0.6*(1-sp0):0,e.z);c.root.rotation.y=e.face;
    const sq=e.sq*(e.boss?0.4:1);c.pivot.scale.set((1+sq*0.55)*pop,(1-sq)*pop,(1+sq*0.55)*pop);c.pivot.rotation.x=-e.tilt;
    const u=c.mat.userData.u;u.uFlash.value=e.hitT>0?0.75:e.fuse>=0&&Math.sin(T*30)>0?0.6:0;
    const bt=c.baseTint;if(e.frz>0)u.uTint.value.setRGB(bt[0]*0.6,bt[1]*0.9,bt[2]*1.5);else if(e.burn>0)u.uTint.value.setRGB(bt[0]*1.25,bt[1]*0.85,bt[2]*0.7);else u.uTint.value.setRGB(bt[0],bt[1],bt[2]);
    c.outline(enemyOutlines||e.boss);
    // LOD de animación: con muchos enemigos, cada uno se anima en fotogramas alternos
    e.acc+=dt*(e.frz>0?0.35:1);if(!many||((frame+e.id)&1)){c.update(e.acc);e.acc=0;}
    blob(e.x,e.z,e.r*2.3,0.45);
    if(e.spawnT>0&&e.spawnT>0.45)smokePuff(e.x,0.1,e.z,1,0.7,0.85,0.5);
    if(e.boss){B.light.add(e.x,0.04,e.z,e.r*3.6,e.r*3.6,fxF.ring,1,0.25,0.15,0.7,T*0.5,0,0.5);}
    if(e.explode)lightAt(e.x,e.z,2.5,0.6,1,0.2,0.35+Math.sin(T*10)*0.15);
  }
  for(let i=eprojs.length-1;i>=0;i--){const p=eprojs[i];p.x+=p.vx*dt;p.z+=p.vz*dt;p.life-=dt;const c=p.col;
    fxAdd('glow',p.x,1,p.z,1.0,c[0],c[1],c[2],0.9);fxAdd('spark',p.x,1,p.z,0.42,1,1,1,1);lightAt(p.x,p.z,1.8,c[0],c[1],c[2],0.5);
    if((p.x-S.x)**2+(p.z-S.z)**2<0.5&&S.y<1.5){hurtPlayer2(p.dmg);p.life=0;sparks(p.x,1,p.z,6,c,4);}if(p.life<=0){eprojs[i]=eprojs[eprojs.length-1];eprojs.pop();}}
}

function updateProjs(dt){
  for(let i=projs.length-1;i>=0;i--){const p=projs[i];p.life-=dt;
    if(p.homing){const e=nearestEnemy(p.x,p.z,12);if(e){const a=Math.atan2(e.z-p.z,e.x-p.x),cur=Math.atan2(p.vz,p.vx),sp=Math.hypot(p.vx,p.vz);const da=((a-cur+Math.PI*3)%(Math.PI*2))-Math.PI;const na=cur+clamp(da,-6*dt,6*dt);p.vx=Math.cos(na)*sp;p.vz=Math.sin(na)*sp;}}
    if(p.boomer){p.age+=dt;if(p.age>0.55){const dx=S.x-p.x,dz=S.z-p.z,d=Math.hypot(dx,dz)||1;p.vx+=dx/d*45*dt;p.vz+=dz/d*45*dt;const sp=Math.hypot(p.vx,p.vz);if(sp>20){p.vx*=20/sp;p.vz*=20/sp;}if(d<0.8&&p.age>0.8)p.life=0;}}
    if(p.flame){p.vx*=Math.pow(0.15,dt);p.vz*=Math.pow(0.15,dt);}
    p.x+=p.vx*dt;p.z+=p.vz*dt;const c=p.col,sp=Math.hypot(p.vx,p.vz)||1,rot=Math.atan2(-p.vx,-p.vz);
    if(p.flame){const k=1-p.life/p.maxLife,s=p.size*(1+k*4.5);fxAdd('fire',p.x,p.y+k*0.8,p.z,s,1,0.75-k*0.45,0.3-k*0.25,1-k*0.8,k*3);if(k>0.6&&Math.random()<0.1)smokePuff(p.x,p.y+0.6,p.z,1,0.6,0.15,1);}
    else if(p.boomer){INST.add('boomer',p.x,p.y,p.z,T*22,p.size*2.4);blob(p.x,p.z,0.8,0.3);B.trail.add(p.x,0.9,p.z,0.4,1.5,fxF.tracer,0.8,0.6,0.4,0.3,rot,0,1);}
    else{const L=p.orb?1:p.rocket?1.6:Math.min(3.2,sp*0.09);
      if(!p.orb)B.trail.add(p.x,p.y,p.z,p.size*2.2,L,fxF.tracer,c[0],c[1],c[2],1,rot,0,1);
      fxAdd('glow',p.x,p.y,p.z,p.size*(p.orb?5:4),c[0],c[1],c[2],p.orb?1:0.7);if(p.orb||p.rocket)fxAdd('spark',p.x,p.y,p.z,p.size*2,1,1,1,1);
      if(p.orb||p.rocket)lightAt(p.x,p.z,p.orb?4:2.5,c[0],c[1],c[2],0.6);
      if(p.rocket)INST.add('rocket',p.x,p.y,p.z,Math.atan2(p.vx,p.vz),1.3);
      if(p.rocket&&Math.random()<0.8)part({x:p.x,y:p.y,z:p.z,vx:rand(-.4,.4),vy:rand(.2,.8),vz:rand(-.4,.4),life:0.9,s0:0.3,s1:1.2,fr:'smoke',r:0.9,g:0.88,b:0.85,a:0.55,b2:'smoke'});}
    if(p.life>0&&!p.flame&&(frame&1)){for(const d of dyns){if(d.dead)continue;const ddx=d.x-p.x,ddz=d.z-p.z;if(ddx*ddx+ddz*ddz<0.5+p.size){if(d.P.exp)hurtDyn(d,p.dmg);else kickDyn(d,p.vx/sp*5,p.vz/sp*5,3);sparks(p.x,p.y,p.z,4,[1,0.8,0.4],5);if(p.rocket){explodeAt(p.x,p.z,p.explode,p.dmg);p.life=0;}else if(!p.boomer&&!p.orb)p.life=0;break;}}}
    if(p.life>0){const hitR=p.size*0.8;let done=false;
      queryEnemies(p.x,p.z,hitR,e=>{if(done||e.dead)return;if(p.hits){if(p.boomer){const lt=p.hits.get(e.id);if(lt&&T-lt<0.3)return;p.hits.set(e.id,T);}else{if(p.hits.has(e.id))return;p.hits.add(e.id);}}else if(p.pierce>1)p.hits=new Set([e.id]);
        if(p.rocket){explodeAt(p.x,p.z,p.explode,p.dmg);p.life=0;done=true;return;}
        hurtEnemy(e,p.dmg,{freeze:p.freeze,burn:p.burn,kx:p.vx/sp,kz:p.vz/sp,kb:p.flame?0.5:2.5,quiet:p.flame?1:0});
        if(p.explode){explodeAt(p.x,p.z,p.explode,p.dmg*0.5);}
        if(p.chainHit){let cc=e;const h=new Set([e.id]);for(let k=0;k<p.chainHit;k++){const nn=nearestEnemy(cc.x,cc.z,6,h);if(!nn)break;h.add(nn.id);fx.push({type:'bolt',x1:cc.x,z1:cc.z,x2:nn.x,z2:nn.z,col:[0.5,0.9,1],life:0.12,max:0.12,seed:Math.random()*9});hurtEnemy(nn,p.dmg*0.5,{quiet:1});cc=nn;}sfx('zap',0.1);}
        if(!p.flame){sparks(p.x,p.y,p.z,3,c,5,0.25,0.1);lightAt(p.x,p.z,1.6,c[0],c[1],c[2],0.6);}
        p.pierce--;if(p.pierce<=0){p.life=0;done=true;}});}
    if(p.life<=0){if(p.rocket&&p.life>-1)explodeAt(p.x,p.z,p.explode,p.dmg);projs[i]=projs[projs.length-1];projs.pop();}
  }
  for(let i=mines.length-1;i>=0;i--){const m=mines[i];m.arm-=dt;m.life-=dt;INST.add('Landmine',m.x,0,m.z,0,0.75);
    if(Math.floor(T*4)%2)fxAdd('glow',m.x,0.45,m.z,0.5,1,0.1,0.05,1);let boom=m.life<=0;if(m.arm<=0)queryEnemies(m.x,m.z,0.8,()=>boom=true);if(boom){explodeAt(m.x,m.z,m.r,m.dmg);mines.splice(i,1);}}
  for(let i=meteors.length-1;i>=0;i--){const m=meteors[i];m.t-=dt;const k=1-m.t/m.max;B.light.add(m.x,0.04,m.z,m.r*2,m.r*2,fxF.warn,1,0.3,0.1,0.5+k*0.5,T*2,0,0.5);
    const h=m.t*22;INST.add('rock',m.x+h*0.4,h,m.z-h*0.3,T*3,1.2,T*2);fxAdd('glow',m.x+h*0.4,h+0.5,m.z-h*0.3,3,1,0.5,0.15,0.8);
    if(Math.random()<0.6)part({x:m.x+h*0.4,y:h+0.5,z:m.z-h*0.3,vx:0,vy:0.5,vz:0,life:0.6,s0:0.6,s1:1.4,fr:'smoke',r:0.8,g:0.75,b:0.7,a:0.5,b2:'smoke'});
    if(m.t<=0){explodeAt(m.x,m.z,m.r,m.dmg);meteors.splice(i,1);}}
}
function updatePickups(dt){
  const mag2=S.magnet*S.magnet;
  for(let i=pickups.length-1;i>=0;i--){const p=pickups[i];p.t+=dt;if(p.y>0.45||p.vy>0){p.vy-=18*dt;p.y=Math.max(0.45,p.y+p.vy*dt);p.x+=p.vx*dt;p.z+=p.vz*dt;}
    const dx=S.x-p.x,dz=S.z-p.z,d2=dx*dx+dz*dz;
    if(d2<mag2||p.mag){p.mag=true;const d=Math.sqrt(d2)||1,sp=Math.min(32,9+p.t*12);p.x+=dx/d*sp*dt;p.z+=dz/d*sp*dt;}
    if(d2<0.6){collect(p);pickups[i]=pickups[pickups.length-1];pickups.pop();continue;}
    if(d2>3600){pickups[i]=pickups[pickups.length-1];pickups.pop();continue;}
    if(Math.abs(p.x-S.camX)>24||p.z-S.camZ>16||p.z-S.camZ<-38)continue;
    const bob=Math.sin(p.t*5+i)*0.1,y=p.y+bob;
    if(p.type==='xp'){const c=p.val>=5?[1,0.35,1]:p.val>=2?[0.35,1,0.45]:[0.35,0.8,1],s=0.75+Math.min(0.6,p.val*0.06);INST.add('gem',p.x,y+0.15,p.z,p.t*2.5,s,0,0,c);fxAdd('glow',p.x,y+0.2,p.z,s*1.1,c[0],c[1],c[2],0.35);}
    else if(p.type==='coin'){INST.add('coin',p.x,y+0.2,p.z,p.t*5,1.3);fxAdd('flare',p.x,y+0.25,p.z,0.5,1,0.95,0.6,0.7,p.t*3);}
    else if(p.type==='heart'){INST.add('Health',p.x,y,p.z,p.t*2,0.75);fxAdd('glow',p.x,y+0.3,p.z,1.2,1,0.3,0.3,0.4);}
    else if(p.type==='chest'){INST.add('Crate',p.x,y,p.z,p.t*1.5,1.5,0,0,[1.6,1.25,0.4]);fxAdd('glow',p.x,y+0.5,p.z,2.6,1,0.85,0.3,0.6);lightAt(p.x,p.z,3.5,1,0.8,0.3,0.7);}
    else{const c={iman:[0.35,0.6,1],bomba:[1,0.3,0.2],furia:[1,0.7,0.1]}[p.type];INST.add('pw',p.x,y+0.4,p.z,p.t*2,1,0.5,0.6,c);fxAdd('glow',p.x,y+0.4,p.z,2.0,c[0],c[1],c[2],0.6);lightAt(p.x,p.z,3,c[0],c[1],c[2],0.6);}
    blob(p.x,p.z,0.6,0.25);
  }
}
function collect(p){
  switch(p.type){
    case'xp':S.xp+=p.val;sfx('pick',0.03);while(S.xp>=S.need){S.xp-=S.need;S.lvl++;S.need=xpNeed(S.lvl);S.pendingLv++;}break;
    case'coin':S.coins+=Math.max(1,Math.round(p.val*S.coinMul*(1+S.wave*0.05)));sfx('coin');break;
    case'heart':S.hp=Math.min(S.maxHp,S.hp+p.val);dmgNum(S.x,2,S.z,p.val,'#4aff6a',true);sfx('heal');break;
    case'iman':for(const q of pickups)q.mag=true;toast('¡Imán total!');sfx('power');break;
    case'bomba':toast('¡Bombardeo!');for(const e of enemies.slice())if(Math.hypot(e.x-S.x,e.z-S.z)<25)hurtEnemy(e,e.boss?300:9999,{quiet:1});S.shake=1;hitstop=0.12;sfx('boom');for(let i=0;i<8;i++){const a=Math.random()*6.28,r=rand(3,14);explodeAt(S.x+Math.cos(a)*r,S.z+Math.sin(a)*r,3,0,[1,0.5,0.15],false,true);}break;
    case'furia':S.fury=10;toast('¡Furia! Cadencia x2 durante 10 s');sfx('power');break;
    case'chest':S.pendingLv+=2;S.coins+=20;toast('¡Cofre del jefe! +2 mejoras');sfx('crate');break;
  }
}
function openCrate(c){c.open=true;const i=crates.indexOf(c);if(i>=0)crates.splice(i,1);sfx('crate');sparks(c.x,0.8,c.z,30,[1,0.85,0.4],8,0.7);poof(c.x,0.5,c.z,1);
  for(let k=0;k<6;k++){const a=Math.random()*6.28,f=rand(3,7);debris.push({m:'WoodPlanks',s:0.45,x:c.x,y:0.6,z:c.z,vx:Math.cos(a)*f,vz:Math.sin(a)*f,vy:rand(5,9),rx:0,ry:a,rz:0,wx:rand(-10,10),wz:rand(-10,10),wy:rand(-5,5),life:2.5});}
  const owned=S.weapons.map(w=>w.id),notOwned=BASE_WEAPONS.filter(w=>!owned.includes(w)&&!FUSIONS.some(f=>owned.includes(f[2])&&(f[0]===w||f[1]===w)));const r=Math.random();
  if(r<0.08&&pets.length<4){const av=Object.keys(PETS).filter(k=>!pets.some(p=>p.type===k));if(av.length){const t=pick(av);addPet(t);toast(`¡${PETS[t].name} se une a ti!`);return;}}
  if(S.weapons.length<6&&notOwned.length&&r<0.75){addWeapon(pick(notOwned));return;}
  const up=S.weapons.filter(w=>w.lvl<8);if(up.length&&r<0.9){const w=pick(up);w.lvl++;toast(`${w.d.name} → Nv ${w.lvl}`,w.id);renderSlots();checkFusionToast();return;}
  const v=Math.round(10+S.wave*3);S.coins+=v;S.hp=Math.min(S.maxHp,S.hp+30);toast(`+${v} monedas y +30 vida`);}

// ================== DIBUJO ==================
function primaryGun(){for(let i=S.weapons.length-1;i>=0;i--){const g=GUNOF[S.weapons[i].id];if(g)return g;}return 'Pistol';}
function updateGun(){if(!hero||!S)return;const g=primaryGun();if(g!==hero.gun){hero.show(GUNS,false);hero.show([g],true);hero.gun=g;}}
function drawPlayer(dt){
  const c=hero;const tgt=nearestEnemy(S.x,S.z,22);
  // mirar al objetivo al disparar (estilo shooter de arena), si no, hacia donde se mueve
  const fa=tgt?S.aim:S.face;const want=S.dash>0?Math.atan2(S.dvx,S.dvz):Math.atan2(Math.cos(fa),Math.sin(fa));
  S.rot=angLerp(S.rot,want,Math.min(1,dt*(S.dash>0?30:16)));
  const spd=Math.hypot(S.vx,S.vz);
  if(S.dead){}else if(S.y>0.05){if(c.curK!=='jump'&&c.curK!=='jumpIdle')c.play('jumpIdle',{fade:0.1});}
  else if(S.moving||spd>1.5){c.play(S.shootT>0?'runShoot':'runGun',{fade:0.12,ts:clamp(spd/7.2,0.6,1.5)*1.15});}
  else c.play(S.shootT>0?'idleShoot':'idle',{fade:0.18});
  // muelle de squash & stretch
  S.sqv+=(-170*S.sq-10*S.sqv)*dt;S.sq+=S.sqv*dt;S.sq=clamp(S.sq,-0.45,0.45);
  const lat=(S.vx*Math.cos(S.rot)-S.vz*Math.sin(S.rot))/S.spd; // inclinación lateral
  S.lean+=((S.moving?clamp(lat,-1,1)*0.12:0)-S.lean)*Math.min(1,dt*10);
  const rx=-Math.cos(S.aim)*S.recoil*0.5,rz=-Math.sin(S.aim)*S.recoil*0.5;
  c.root.position.set(S.x+rx,S.y,S.z+rz);c.root.rotation.y=S.rot;
  const w=c.pivotW||1,sq=S.sq,ds=S.dash>0?0.25:0;
  c.pivot.scale.set(w*(1+sq*0.5-ds*0.3),1-sq,w*(1+sq*0.5+ds));c.pivot.rotation.set(S.moving&&S.y<=0?Math.min(0.18,spd*0.02):0,0,S.lean);
  const u=c.mat.userData.u,blink=S.inv>0&&S.dash<=0&&Math.floor(T*20)%2;
  u.uFlash.value=S.hurtT>0?0.7:blink?0.35:0;u.uFlashCol.value.setRGB(1,S.hurtT>0?0.45:1,S.hurtT>0?0.4:1);
  u.uEmis.value.setRGB(S.fury>0?0.25+Math.sin(T*12)*0.1:0,S.fury>0?0.08:0,0);
  c.update(dt);c.outline(true);
  if(!sun.castShadow)blob(S.x,S.z,1.3,0.5);else blob(S.x,S.z,1.1,0.3);
  B.light.add(S.x,0.04,S.z,1.8,1.8,fxF.ring,0.3,0.85,1,0.45,0,0,0.5);
  if(S.fury>0)fxAdd('glow',S.x,1,S.z,3,1,0.45,0.1,0.3+Math.sin(T*12)*0.1);
  // estela del dash
  const tr=TRAILS[save.custom.trail][1];
  for(let i=ghosts.length-1;i>=0;i--){const g=ghosts[i];g.t-=dt;if(g.t<=0){ghosts.splice(i,1);continue;}
    const col=tr||(()=>{const cc=new THREE.Color().setHSL((T+i*0.1)%1,1,0.6);return[cc.r,cc.g,cc.b];})();
    fxAdd('glow',g.x,0.9+g.y,g.z,1.9*g.t*3.3,col[0],col[1],col[2],g.t*2.4);fxAdd('spark',g.x,1+g.y,g.z,0.5,1,1,1,g.t*2);
    B.trail.add(g.x,0.05,g.z,1.2,1.2,fxF.glow,col[0],col[1],col[2],g.t*2,0,0,0.5);}
}
function drawFx(dt){
  for(let i=fx.length-1;i>=0;i--){const f=fx[i];f.life-=dt;if(f.life<=0){fx.splice(i,1);continue;}const k=f.life/f.max,c=f.col||[1,1,1];
    if(f.type==='beam'){const dx=f.x2-f.x1,dz=f.z2-f.z1,L=Math.hypot(dx,dz),rot=Math.atan2(-dx,-dz);
      B.trail.add(f.x1,1.15,f.z1,f.w*3*k,L,fxF.drop,c[0],c[1],c[2],k,rot,0,0);B.trail.add(f.x1,1.16,f.z1,f.w*1*k,L,fxF.drop,1,1,1,k,rot,0,0);
      B.light.add((f.x1+f.x2)/2,0.03,(f.z1+f.z2)/2,f.w*8,L,fxF.glow,c[0],c[1],c[2],0.5*k,rot,0,0.5);}
    else if(f.type==='bolt'){let px=f.x1,pz=f.z1;const n=6;for(let j=1;j<=n;j++){const t=j/n,jit=j<n?Math.sin(f.seed+j*7.3+T*60)*0.6:0;const nx=f.x1+(f.x2-f.x1)*t+jit*(f.z2-f.z1)/10,nz=f.z1+(f.z2-f.z1)*t-jit*(f.x2-f.x1)/10;
        const dx=nx-px,dz=nz-pz,L=Math.hypot(dx,dz),rot=Math.atan2(-dx,-dz);B.trail.add(px,1.2,pz,0.45,L,fxF.drop,c[0],c[1],c[2],k,rot,0,0);B.trail.add(px,1.21,pz,0.14,L,fxF.drop,1,1,1,k,rot,0,0);px=nx;pz=nz;}
      lightAt(f.x2,f.z2,3,c[0],c[1],c[2],k);}
    else if(f.type==='nova'){const r=f.r*(1-k*k);B.light.add(f.x,0.05,f.z,r*2,r*2,fxF.ring,c[0],c[1],c[2],k,0,0,0.5);B.light.add(f.x,0.04,f.z,r*2.2,r*2.2,fxF.glow,c[0],c[1],c[2],k*0.5,0,0,0.5);}
    else if(f.type==='boom'){const kk=1-k;fxAdd('glow',f.x,1,f.z,f.r*3*(0.5+kk),1,0.85,0.6,k*1.2);fxAdd('flare',f.x,1,f.z,f.r*2.5*k,1,1,0.9,k);lightAt(f.x,f.z,f.r*5,1,0.6,0.3,k*1.2);}
    else if(f.type==='flash'){const s=0.9*f.s;fxAdd('flare',f.x,1.2,f.z,s*1.7,1,0.95,0.7,1,Math.random()*3);fxAdd('glow',f.x,1.2,f.z,s*2.3,c[0],c[1]*0.85,c[2]*0.6,0.9);}}
  for(const d of decals){d.t+=dt;const a=d.t>40?Math.max(0,1-(d.t-40)/10):1;if(!inView(d.x,d.z))continue;B.decal.add(d.x,0.015,d.z,d.s,d.s,fxF[d.k],d.r,d.g,d.b,d.a*a,d.rot,0,0.5);}
  for(const c of crates){if(c.open||!inView(c.x,c.z))continue;c.t+=dt;const b=Math.abs(Math.sin(c.t*2.5));INST.add('Crate',c.x,b*0.3,c.z,c.t*0.8,1.45,0,0,[1,1,1]);
    lightAt(c.x,c.z,3.4,1,0.85,0.3,0.45+Math.sin(c.t*4)*0.15);blob(c.x,c.z,1.3,0.4*(1-b*0.4));if(Math.random()<0.08)part({x:c.x+rand(-.6,.6),y:0.3,z:c.z,vx:0,vy:1.6,vz:0,life:0.8,s0:0.14,s1:0,fr:'flare',r:1,g:0.9,b:0.4,a:1,b2:'add'});}
}
// polvo ambiental (motas cálidas y brasas)
const ash=[];for(let i=0;i<110;i++)ash.push({x:rand(-25,25),y:rand(0,9),z:rand(-35,12),s:rand(0.05,0.12),v:rand(0.3,1.1),ph:Math.random()*6,ember:Math.random()<0.15});
function drawAsh(dt,cx,cz){for(const a of ash){a.y-=a.v*dt*0.5;a.x+=Math.sin(T*0.7+a.ph)*dt*0.6+dt*0.5;if(a.y<0){a.y=9;}
  let wx=((a.x-cx)%50+75)%50-25+cx,wz=((a.z-cz)%47+47+35)%47-35+cz;
  if(a.ember)fxAdd('spark',wx,a.y,wz,a.s*1.6,1,0.6,0.2,0.8);else B.smoke.add(wx,a.y,wz,a.s,a.s,fxF.drop,1,0.97,0.9,0.55,0,0,0.5);}}
function updateCamera(){const sh=S.shake*S.shake*0.9,kx=Math.cos(S.aim)*S.kick,kz=Math.sin(S.aim)*S.kick;
  const port=innerWidth<innerHeight;const H=port?18:15,D=port?8.6:9;
  camT.x=S.camX;camT.z=S.camZ;
  camera.position.set(S.camX+rand(-sh,sh)-kx,H+rand(-sh,sh),S.camZ+D-kz);camera.lookAt(S.camX-kx,0.6,S.camZ-1.2-kz);
  followGroundAndSun(S.camX,S.camZ);}
function followGroundAndSun(x,z){const tile=ground.userData.tile;ground.position.set(Math.round(x/tile)*tile,0,Math.round((z-10)/tile)*tile);
  const sx=Math.round(x),sz=Math.round(z-4);sun.position.set(sx-6,14,sz+7);sun.target.position.set(sx,0,sz);}

// ================== MENÚ 3D (vitrina) ==================
let menuScene=false;const menuProps=[];let menuWaveT=0;
function setMenuScene(on){menuScene=on;if(on){ensureHero();hero.root.position.set(0,0,0);hero.root.rotation.y=0.35;hero.pivot.scale.set(hero.pivotW||1,1,hero.pivotW||1);hero.pivot.rotation.set(0,0,0);
  hero.show(GUNS,false);hero.show(['AK'],true);hero.gun='AK';hero.mat.userData.u.uFlash.value=0;hero.mat.userData.u.uEmis.value.setRGB(0,0,0);hero.play('wave',{once:true,fade:0.1});menuWaveT=2;}}
function drawMenu(dt){T+=dt;const c=hero;if(!c)return;
  menuWaveT-=dt;if(menuWaveT<=0&&c.curK!=='idle')c.play('idle',{fade:0.3});
  c.root.rotation.y=0.35+Math.sin(T*0.4)*0.15;c.update(dt);c.outline(true);
  INST.add('Debris_BrokenCar',-3.2,0,-3.5,0.9,1);INST.add('SackTrench',2.6,0,-1.2,-0.5,1);INST.add('ExplodingBarrel',-1.6,0,-1.4,0.3,1.1);INST.add('ExplodingBarrel',-2.2,0,-0.6,1,1.1,1.57,0);
  INST.add('Tree_2',4.5,0,-6,0,1);INST.add('Tree_1',-7,0,-7,1,1);INST.add('Debris_Tires',3,0,1.4,0.4,1);INST.add('TrafficCone',1.4,0,1.6,0,1.1);INST.add('Crate',-1.3,0,1.2,0.6,1.3,0,0,[1,1,1]);INST.add('StreetLight',-5,0,-1,0.6,0.9);
  fireFx({x:3,z:1.4,s:0.9,y:1});blob(0,0,1.4,0.35);
  const port=innerWidth<innerHeight;const off=port?0:-1.75;
  camera.position.set(1.2+off,3.0,port?9.5:7.6);camera.lookAt(off,1.0,0);camT.x=0;camT.z=0;followGroundAndSun(0,0);
  drawAsh(dt,0,0);}

// ================== DAÑO FLOTANTE ==================
const dnEls=[];let dnIdx=0;const dnBox=$('dmg');for(let i=0;i<36;i++){const d=document.createElement('div');d.className='dn';d.style.display='none';dnBox.appendChild(d);dnEls.push({el:d,life:0});}
function dmgNum(x,y,z,v,col,big){if(!big&&Math.random()<0.35)return;const d=dnEls[dnIdx++%dnEls.length];d.life=0.7;d.x=x+rand(-.3,.3);d.y=y;d.z=z;d.vx=rand(-1,1);d.el.textContent=Math.round(v);d.el.style.color=col;d.el.className='dn'+(big?' big':'');d.el.style.display='block';}
const _v=new THREE.Vector3();
function updateDmgNums(dt){const w=innerWidth,h=innerHeight;for(const d of dnEls){if(d.life<=0)continue;d.life-=dt;d.y+=dt*2.2;d.x+=d.vx*dt;if(d.life<=0){d.el.style.display='none';continue;}
  _v.set(d.x,d.y,d.z).project(camera);const sc=d.life>0.55?1.5-(d.life-0.55)*3:0.6+d.life*0.9;d.el.style.transform=`translate3d(${(_v.x*0.5+0.5)*w}px,${(-_v.y*0.5+0.5)*h}px,0) translate(-50%,-50%) scale(${sc})`;d.el.style.opacity=Math.min(1,d.life*3);}}

// ================== SUBIR DE NIVEL ==================
let levelChoices=[];
function showLevelUp(){
  S.pendingLv--;mode='levelup';sfx('level');
  const opts=[];const fus=availableFusions();for(const f of fus)opts.push({k:'fus',f});
  for(const w of S.weapons)if(w.lvl<8)opts.push({k:'up',w});
  if(S.weapons.length<6){const owned=S.weapons.map(w=>w.id);for(const id of BASE_WEAPONS)if(!owned.includes(id)&&!FUSIONS.some(f=>owned.includes(f[2])&&(f[0]===id||f[1]===id)))opts.push({k:'new',id});}
  for(const id in PASSIVES)if((S.passives[id]||0)<PASSIVES[id].max)opts.push({k:'pas',id});
  if(pets.length<4&&Math.random()<0.25){const av=Object.keys(PETS).filter(k=>!pets.some(p=>p.type===k));if(av.length)opts.push({k:'pet',id:pick(av)});}
  const chosen=[];if(fus.length)chosen.push(opts.shift());const pool=opts.filter(o=>o.k!=='fus');while(chosen.length<3&&pool.length)chosen.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
  if(!chosen.length)chosen.push({k:'heal'});
  const box=$('cards');box.innerHTML='';
  chosen.forEach((o,i)=>{const c=document.createElement('button');c.className='card'+(o.k==='fus'?' fu':'');let ic,t,d,tg;
    if(o.k==='fus'){const W=WEAPONS[o.f[2]];ic=iconHTML(o.f[2],72);t=W.name;d=`${WEAPONS[o.f[0]].name} + ${WEAPONS[o.f[1]].name}. ${W.desc}`;tg='FUSIÓN ÉPICA';}
    if(o.k==='up'){ic=iconHTML(o.w.id,72);t=o.w.d.name;d=`Nivel ${o.w.lvl} → ${o.w.lvl+1}: +daño, -recarga${o.w.lvl%3===0?', +1 proyectil':''}`;tg='MEJORA';}
    if(o.k==='new'){const W=WEAPONS[o.id];ic=iconHTML(o.id,72);t=W.name;d=W.desc;tg=W.spell?'NUEVO HECHIZO':'NUEVA ARMA';}
    if(o.k==='pas'){const P=PASSIVES[o.id];ic=`<span class="emo">${P.icon}</span>`;t=P.name;d=P.desc+` (${(S.passives[o.id]||0)+1}/${P.max})`;tg='HABILIDAD';}
    if(o.k==='pet'){ic=thumbImg(o.id,80);t=PETS[o.id].name;d=PETS[o.id].desc;tg='RECLUTAR';}
    if(o.k==='heal'){ic='<span class="emo">🍖</span>';t='Raciones';d='Recupera toda la vida y +25 monedas';tg='RECOMPENSA';}
    c.innerHTML=`<div class="tg">${tg}</div><div class="ic">${ic}</div><h4>${t}</h4><p>${d}</p>`;c.onclick=()=>chooseLv(o);box.appendChild(c);});
  levelChoices=chosen;$('levelup').classList.remove('hide');
}
function chooseLv(o){if(mode!=='levelup')return;sfx('click');
  if(o.k==='fus')doFusion(o.f);if(o.k==='up'){o.w.lvl++;renderSlots();checkFusionToast();}if(o.k==='new')addWeapon(o.id);
  if(o.k==='pet'){addPet(o.id);toast(`¡${PETS[o.id].name} se une a ti!`);}if(o.k==='heal'){S.hp=S.maxHp;S.coins+=25;}
  if(o.k==='pas'){const id=o.id;S.passives[id]=(S.passives[id]||0)+1;({vida:()=>{S.maxHp+=20;S.hp=Math.min(S.maxHp,S.hp+40);},vel:()=>S.spd*=1.08,dano:()=>S.dmg+=0.12,cad:()=>S.cd*=0.92,iman:()=>S.magnet*=1.35,regen:()=>S.regen+=0.6,armad:()=>S.armor+=0.08,crit:()=>S.crit+=0.07,area:()=>S.area+=0.12,multi:()=>S.multi++})[id]();}
  $('levelup').classList.add('hide');mode='play';last=performance.now();}

// ================== UI ==================
function show(id){for(const k of['menu','hud','levelup','pause','over'])$(k).classList.toggle('hide',k!==id);}
function renderSlots(){updateGun();$('slots').innerHTML=S.weapons.map(w=>`<div class="slot${w.d.fusion?' fu':''}">${iconHTML(w.id,38)}<b>${w.lvl}</b></div>`).join('')+'<div class="slot empty"></div>'.repeat(Math.max(0,6-S.weapons.length));}
function renderPets(){$('pets').innerHTML=pets.map(p=>thumbImg(p.type,34)).join('');}
let hudT=0;
function hudUpdate(){if(--hudT>0)return;hudT=5;
  $('hpF').style.transform=`scaleX(${Math.max(0,S.hp)/S.maxHp})`;$('hpT').textContent=`${Math.ceil(Math.max(0,S.hp))}/${S.maxHp}`;
  $('xpF').style.transform=`scaleX(${S.xp/S.need})`;$('lvT').textContent=S.lvl;
  $('wave').textContent=`OLEADA ${S.wave}`;
  if(S.boss){$('bossBar').classList.remove('hide');$('bossF').style.transform=`scaleX(${Math.max(0,S.boss.hp/S.boss.max)})`;$('bossN').textContent=FAMS[S.boss.fam].boss;}else $('bossBar').classList.add('hide');
  $('wsub').textContent=S.boss?'':S.breakT>0?'¡Prepárate!':`${Math.max(0,S.waveQuota-S.waveKills)} hostiles`+(S.fury>0?' · FURIA':'');
  $('hCoins').textContent=S.coins;$('hKills').textContent=S.kills;const t=Math.floor(S.time);$('hTime').textContent=`${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`;
  $('streak').textContent=S.streak>=10?`x${S.streak}`:'';$('lowhp').style.opacity=S.hp/S.maxHp<0.3?0.8:0;}
let toastT;function toast(m,icon){const e=$('toast');e.innerHTML=(icon?iconHTML(icon,30):'')+`<span>${m}</span>`;e.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>e.classList.remove('on'),2300);}
let banT;function banner(m,boss){const e=$('banner');e.textContent=m;e.className='on'+(boss?' boss':'');clearTimeout(banT);banT=setTimeout(()=>e.className='',2400);}
function fusionHTML(){return FUSIONS.map(([a,b,c])=>{const have=S&&mode!=='menu'&&S.weapons.some(w=>w.id===c);return `<div class="fus">${iconHTML(a,34)}<span>+</span>${iconHTML(b,34)}<span>=</span>${iconHTML(c,40)}<div><b>${WEAPONS[c].name}</b>${have?' ✅':''}<small>${WEAPONS[a].name} + ${WEAPONS[b].name}</small></div></div>`;}).join('')+'<p class="note">Ambas armas deben estar a nivel 3 o más. La fusión aparece al subir de nivel.</p>';}
function pause(){if(mode!=='play')return;mode='pause';stopMusic();
  $('pInfo').innerHTML=`<div class="row c">${S.weapons.map(w=>`<div class="slot${w.d.fusion?' fu':''}">${iconHTML(w.id,38)}<b>${w.lvl}</b></div>`).join('')}</div><p>Oleada ${S.wave} · Nivel ${S.lvl} · ${S.kills} bajas ${Object.entries(S.passives).map(([k,v])=>PASSIVES[k].icon+v).join(' ')}</p>`;
  $('pFus').innerHTML=fusionHTML();$('pause').classList.remove('hide');}
function resume(){$('pause').classList.add('hide');mode='play';startMusic();last=performance.now();}
function gameOver(){mode='over';S.dead=true;hero.play('death',{once:true,fade:0.08});S.sqv+=6;stopMusic();sfx('over');hitstop=0;const bonus=Math.round(S.wave*5*S.coinMul),total=S.coins+bonus;save.coins+=total;save.best=Math.max(save.best,S.wave);save.games++;persist();
  const t=Math.floor(S.time);$('oStats').innerHTML=`<div class="big">${save.custom.name} cayó en la <b>oleada ${S.wave}</b></div><div class="grid3"><div><b>${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}</b>tiempo</div><div><b>${S.kills}</b>bajas</div><div><b>${S.lvl}</b>nivel</div></div><div>Monedas recogidas ${S.coins} · Bonus de oleada +${bonus}</div><div class="tot">+${total} 🪙</div><small>Mejor oleada: ${save.best}</small>`;
  setTimeout(()=>{$('over').classList.remove('hide');},900);}
function quitRun(){if(S){save.coins+=S.coins;save.best=Math.max(save.best,S.wave);persist();}toMenu();}
function toMenu(){mode='menu';stopMusic();clearChunks();clearEnemyChars();for(const c of corpses)POOL.put(c.c);for(const p of pets)if(p.c)POOL.put(p.c);for(const a of[enemies,projs,eprojs,parts,pickups,mines,fx,meteors,corpses,decals,ghosts])a.length=0;pets.length=0;S=null;setMenuScene(true);
  for(const d of dnEls){d.life=0;d.el.style.display='none';}show('menu');buildMenu();}

function buildMenu(){
  $('mCoins').textContent=save.coins;$('pName').value=save.custom.name;$('best').textContent=save.best?`Mejor oleada: ${save.best} · Partidas: ${save.games}`:'';
  const cu=save.custom;
  $('pSkins').innerHTML=Object.entries(SKINS).map(([id,n])=>`<button class="sk${cu.skin===id?' on':''}${owns(id)?'':' lock'}" data-k="skin" data-id="${id}">${thumbImg('s_'+id,78)}<b>${n}</b><small>${owns(id)?SKIN_BONUS[id]:'🔒 Tienda'}</small></button>`).join('');
  $('pCamo').innerHTML=Object.entries(CAMOS).map(([id,[n,c]])=>`<button class="opt${cu.camo===id?' on':''}${owns(id)?'':' lock'}" data-k="camo" data-id="${id}"><i style="background:rgb(${c.map(v=>Math.min(255,v*150)).join(',')})"></i>${n}</button>`).join('');
  $('pTrail').innerHTML=Object.entries(TRAILS).map(([id,[n,c]])=>`<button class="opt${cu.trail===id?' on':''}${owns(id)?'':' lock'}" data-k="trail" data-id="${id}"><i style="background:${c?`rgb(${c.map(v=>v*255).join(',')})`:'linear-gradient(90deg,red,yellow,lime,cyan,blue,magenta)'}"></i>${n.replace('Estela ','')}</button>`).join('');
  if(mode==='menu'){const prev=heroSkin;ensureHero();if(prev!==heroSkin)setMenuScene(true);}
  let h='';for(const cat in CATNAMES){h+=`<div class="shopc">${CATNAMES[cat]}</div><div class="shopg">`;
    if(cat==='wskin')h+=`<div class="it"><span>Munición: Normal</span>${save.wskin==='normal'?'<em>Equipado</em>':`<button data-eq="wskin" data-id="normal">Equipar</button>`}</div>`;
    if(cat==='pet')h+=`<div class="it"><span>Sin compañero inicial</span>${!save.pet?'<em>Equipado</em>':`<button data-eq="pet" data-id="">Equipar</button>`}</div>`;
    for(const it of SHOP.filter(s=>s.cat===cat)){const o=owns(it.id);let act;
      if(!o)act=`<button class="buy" data-buy="${it.id}" ${save.coins<it.price?'disabled':''}>🪙 ${it.price}</button>`;
      else if(cat==='wskin')act=save.wskin===it.id?'<em>Equipado</em>':`<button data-eq="wskin" data-id="${it.id}">Equipar</button>`;
      else if(cat==='pet')act=save.pet===it.id?'<em>Equipado</em>':`<button data-eq="pet" data-id="${it.id}">Equipar</button>`;
      else act=cat==='perk'?'<em>Activa</em>':'<em>Tuyo</em>';
      const pv=cat==='skin'?thumbImg('s_'+it.id,52):cat==='pet'?thumbImg(it.id,44):'';
      h+=`<div class="it">${pv}<span>${it.name}${it.desc?`<small>${it.desc}</small>`:''}</span>${act}</div>`;}
    h+='</div>';}
  $('shopList').innerHTML=h;$('fusList').innerHTML=fusionHTML();
  $('armList').innerHTML=BASE_WEAPONS.map(id=>`<div class="fus">${iconHTML(id,44)}<div><b>${WEAPONS[id].name}</b><small>${WEAPONS[id].desc}</small></div></div>`).join('');
}
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{initAudio();sfx('click');document.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('on',x===b));document.querySelectorAll('#menu .panel').forEach(p=>p.classList.toggle('hide',p.id!=='tab-'+b.dataset.tab));});
$('menu').addEventListener('click',ev=>{initAudio();const t=ev.target.closest('button');if(!t)return;
  if(t.dataset.k){if(!owns(t.dataset.id)){toast('Desbloquéalo en la Tienda');sfx('deny');return;}save.custom[t.dataset.k]=t.dataset.id;persist();buildMenu();sfx('click');if(hero&&mode==='menu'){hero.play(t.dataset.k==='skin'?'wave':'jump',{once:true,fade:0.1});menuWaveT=1.4;}}
  if(t.dataset.buy){const it=SHOP.find(s=>s.id===t.dataset.buy);if(save.coins>=it.price){save.coins-=it.price;save.owned[it.id]=1;if(it.cat==='wskin')save.wskin=it.id;if(it.cat==='pet')save.pet=it.id;if(['skin','camo','trail'].includes(it.cat))save.custom[it.cat]=it.id;persist();sfx('coin');toast('¡Comprado: '+it.name+'!');buildMenu();}}
  if(t.dataset.eq!==undefined){save[t.dataset.eq]=t.dataset.id||null;persist();buildMenu();sfx('click');}});
$('pName').oninput=e=>{save.custom.name=e.target.value.trim()||'Soldado';persist();};
const goFull=()=>{if(isTouch&&document.documentElement.requestFullscreen&&!document.fullscreenElement)document.documentElement.requestFullscreen().then(()=>screen.orientation?.lock?.('landscape').catch(()=>{})).catch(()=>{});};
$('play').onclick=()=>{initAudio();sfx('click');goFull();newRun();last=performance.now();};
$('pauseB').onclick=()=>pause();$('resume').onclick=()=>resume();$('quit').onclick=()=>quitRun();
$('again').onclick=()=>{newRun();last=performance.now();};$('toMenu').onclick=()=>toMenu();
$('musB').onclick=()=>{initAudio();const on=toggleMusic();if(mode!=='play')stopMusic();$('musB').classList.toggle('off',!on);};$('musB').classList.toggle('off',!musicEnabled());
const dashB=$('dashB');dashB.addEventListener('touchstart',e=>{e.preventDefault();e.stopPropagation();doDash();},{passive:false});dashB.addEventListener('mousedown',e=>{e.stopPropagation();doDash();});

addEventListener('keydown',e=>{keys[e.code]=true;initAudio();
  if(e.code==='Escape'||e.code==='KeyP'){if(mode==='play')pause();else if(mode==='pause')resume();}
  if(e.code==='KeyM')$('musB').click();if((e.code==='Space'||e.code==='ShiftLeft'||e.code==='ShiftRight')&&mode==='play'){doDash();e.preventDefault();}
  if(mode==='levelup'&&['Digit1','Digit2','Digit3'].includes(e.code)){const o=levelChoices[+e.code.slice(-1)-1];if(o)chooseLv(o);}
  if(e.code.startsWith('Arrow')&&mode==='play')e.preventDefault();});
addEventListener('keyup',e=>keys[e.code]=false);
addEventListener('blur',()=>{for(const k in keys)keys[k]=false;if(mode==='play')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='play')pause();});
// joystick táctil flotante (mitad izquierda) — preciso, con zona muerta
const joyEl=$('joy'),knob=$('knob');const JR=56;
addEventListener('touchstart',e=>{initAudio();if(mode!=='play')return;for(const t of e.changedTouches){if(joy.id!==null)break;if(t.target.closest('button'))continue;if(t.clientX>innerWidth*0.6)continue;
  joy.id=t.identifier;joy.ox=t.clientX;joy.oy=t.clientY;joy.active=true;joy.x=joy.z=0;joyEl.style.transform=`translate(${t.clientX-70}px,${t.clientY-70}px)`;joyEl.classList.add('on');knob.style.transform='';}},{passive:true});
addEventListener('touchmove',e=>{for(const t of e.changedTouches)if(t.identifier===joy.id){let dx=t.clientX-joy.ox,dy=t.clientY-joy.oy;const l=Math.hypot(dx,dy);
  if(l>JR){joy.ox+=(dx/l)*(l-JR);joy.oy+=(dy/l)*(l-JR);dx=dx/l*JR;dy=dy/l*JR;joyEl.style.transform=`translate(${joy.ox-70}px,${joy.oy-70}px)`;}
  const m=Math.hypot(dx,dy)/JR;const k=m<0.12?0:Math.min(1,(m-0.12)/0.7);joy.x=m?dx/(m*JR)*k:0;joy.z=m?dy/(m*JR)*k:0;knob.style.transform=`translate(${dx}px,${dy}px)`;}},{passive:true});
const endT=e=>{for(const t of e.changedTouches)if(t.identifier===joy.id){joy.id=null;joy.active=false;joy.x=joy.z=0;joyEl.classList.remove('on');}};
addEventListener('touchend',endT);addEventListener('touchcancel',endT);


// ================== BUCLE ==================
let last=performance.now(),fpsN=0,fpsT=0,fps=60,lowT=0,highT=0;
function loop(now){requestAnimationFrame(loop);let dt=Math.min(0.05,(now-last)/1000);last=now;
  fpsN++;fpsT+=dt;if(fpsT>=1){fps=fpsN/fpsT;fpsN=0;fpsT=0;if(DEBUG)$('fps').textContent=Math.round(fps)+' fps · q'+qLevel+' · '+renderer.info.render.calls+' dc';
    // calidad adaptativa: baja contornos/sombras/resolución si el móvil no llega a 50 fps
    if(mode==='play'&&fps<48&&qLevel>0&&!QLOCK){lowT++;if(lowT>=2){qLevel--;applyQuality();lowT=0;}}else lowT=0;
    enemyOutlines=qLevel>=3||(qLevel>=2&&enemies.length<90);}
  if(mode==='loading')return;
  if(mode==='menu'||!S){drawMenu(dt);flushAll();return;}
  let sdt=dt;if(hitstop>0){hitstop-=dt;sdt=dt*0.05;}
  if(mode==='play')update(sdt);
  else if(mode==='over'){T+=dt;updateCorpses(dt);}
  const vdt=mode==='play'||mode==='over'?sdt:0;
  drawWorld();drawPlayer(vdt);drawFx(mode==='play'?sdt:0);updateParts(vdt);drawAsh(dt,S.camX,S.camZ);
  if(mode!=='play'){for(const e of enemies)if(!e.dead&&e.c)blob(e.x,e.z,e.r*2.3,0.45);for(const p of pets)drawPet(p,0);
    for(const p of pickups)if(p.type==='xp')INST.add('gem',p.x,0.6,p.z,p.t*2.5,0.8,0,0,[0.35,0.8,1]);}
  updateCamera();updateDmgNums(mode==='play'?dt:0);
  flushAll();
}
function flushAll(){for(const k in B)B[k].flush();INST.flush();renderer.render(scene,camera);}
loadAssets().then(()=>{makeThumbs();mode='menu';setMenuScene(true);buildMenu();$('loading').classList.add('hide');show('menu');applyQuality();requestAnimationFrame(loop);})
  .catch(e=>{console.error(e);$('loading').textContent='Error cargando recursos';});
if(DEBUG)window.__oleadas={get mode(){return mode},get S(){return S},enemies,newRun,setWave:w=>{S.wave=w-1;nextWave();},give:id=>addWeapon(id),lvl:()=>{S.pendingLv++;},get fps(){return fps},
  get calls(){return renderer.info.render.calls},meshCounts:()=>Object.fromEntries(Object.keys(MT).map(k=>{let n=0;MT[k].scene.traverse(o=>{if(o.isMesh)n++});return[k,n]})),setQ:q=>{qLevel=q;applyQuality();},dyns};
