// Audio: muestras CC0 (Kenney) + capas procedurales WebAudio, ambiente en capas y música (ansimuz, CC0)
let ambG=null,ctx=null, master, sfxG, musG, noiseBuf, last={}, musicOn=true, intensity=0;
export function initAudio(){
  if(ctx){ if(ctx.state==='suspended') ctx.resume(); return; }
  const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
  ctx=new AC(); master=ctx.createGain(); master.gain.value=0.6; master.connect(ctx.destination);
  const comp=ctx.createDynamicsCompressor(); comp.connect(master);
  sfxG=ctx.createGain(); sfxG.gain.value=0.5; sfxG.connect(comp);
  musG=ctx.createGain(); musG.gain.value=0.2; musG.connect(master); ambG=ctx.createGain(); ambG.gain.value=0; ambG.connect(master); setTimeout(()=>{applyVolumes();loadBank();},0);
  noiseBuf=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate); const d=noiseBuf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
  try{ musicOn = localStorage.getItem('oleadas_music')!=='0'; }catch(e){}
}
function tone(type,f0,f1,dur,vol,dest=sfxG,t=ctx.currentTime){
  const o=ctx.createOscillator(), g=ctx.createGain(); o.type=type; o.frequency.setValueAtTime(f0,t);
  if(f1) o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur);
  g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0008,t+dur); o.connect(g); g.connect(dest); o.start(t); o.stop(t+dur+0.02);
}
function noise(dur,vol,freq=1200,q=1,dest=sfxG,t=ctx.currentTime,type='lowpass'){
  const s=ctx.createBufferSource(); s.buffer=noiseBuf; const f=ctx.createBiquadFilter(); f.type=type; f.frequency.value=freq; f.Q.value=q;
  const g=ctx.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0008,t+dur);
  s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random()*0.5); s.stop(t+dur+0.02);
}
let dist=null;
function D(){ if(!dist){ dist=ctx.createWaveShaper(); const n=1024,c=new Float32Array(n); for(let i=0;i<n;i++){const x=i/n*2-1;c[i]=Math.tanh(x*3.5);} dist.curve=c; dist.connect(sfxG);} return dist; }
const now=()=>ctx.currentTime;
// disparo: chasquido de ruido + golpe grave saturado
function gun(vol,cut,body,len){noise(len,vol,cut,0.7,D());tone('square',body,body*0.35,len*0.8,vol*0.6,D());noise(len*2.5,vol*0.25,900,0.5);}
const SFX={
  shoot:()=>gun(0.35,3200,180,0.08),
  smg:()=>gun(0.22,3800,220,0.05),
  shotgun:()=>{gun(0.6,2200,110,0.16);noise(0.35,0.2,600,0.4);},
  laser:()=>{tone('sawtooth',1800,180,0.22,0.12);tone('sine',900,90,0.25,0.15);},
  rail:()=>{tone('sawtooth',3000,60,0.5,0.18,D());noise(0.5,0.3,5000,0.6,sfxG,undefined,'highpass');tone('sine',80,30,0.6,0.5);},
  rocket:()=>{noise(0.45,0.3,700,0.6);tone('sawtooth',90,300,0.35,0.15,D());},
  flame:()=>noise(0.14,0.12,700,0.4,sfxG,undefined,'bandpass'),
  zap:()=>{for(let i=0;i<3;i++)tone('sawtooth',2000+Math.random()*1500,300,0.06,0.07,D(),now()+i*0.025);noise(0.12,0.15,5000,1,sfxG,undefined,'highpass')},
  whoosh:()=>noise(0.3,0.18,800,3,sfxG,undefined,'bandpass'),
  slash:()=>{noise(0.08,0.15,3500,2,sfxG,undefined,'bandpass');tone('triangle',1400,500,0.06,0.05)},
  freeze:()=>{tone('sine',2600,1200,0.2,0.08);noise(0.2,0.08,7000,1,sfxG,undefined,'highpass')},
  plasma:()=>{tone('sine',200,900,0.3,0.2);tone('square',100,450,0.3,0.05,D())},
  meteor:()=>noise(0.9,0.2,400,2,sfxG,undefined,'bandpass'),
  nova:()=>{tone('sine',150,40,0.6,0.5);noise(0.5,0.25,2500,0.5);tone('triangle',800,2400,0.3,0.06)},
  boom:()=>{const t=now();noise(0.9,0.9,380,0.5);noise(0.25,0.6,2500,0.5,D());tone('sine',110,28,0.7,0.9,sfxG,t);tone('sine',60,25,1,0.6,sfxG,t+0.02)},
  hit:()=>{noise(0.04,0.18,1800,1);tone('sine',140,60,0.05,0.12)},
  kill:()=>{noise(0.12,0.25,900,0.6);tone('sine',90,40,0.12,0.2)},
  bossdie:()=>{tone('sawtooth',120,20,2,0.4,D());noise(2,0.5,300)},
  pick:()=>tone('sine',1300+Math.random()*400,2200,0.05,0.05),
  coin:()=>{tone('square',1400,0,0.05,0.04);tone('square',2100,0,0.12,0.04,sfxG,now()+0.05)},
  heal:()=>{[660,880,1100].forEach((f,i)=>tone('sine',f,0,0.18,0.08,sfxG,now()+i*0.06))},
  power:()=>{[330,494,660,988].forEach((f,i)=>tone('sawtooth',f,0,0.2,0.06,sfxG,now()+i*0.05))},
  hurt:()=>{tone('sawtooth',260,70,0.25,0.3,D());noise(0.2,0.3,700)},
  jump:()=>noise(0.12,0.08,1200,1,sfxG,undefined,'bandpass'),
  land:()=>{noise(0.1,0.15,500);tone('sine',90,50,0.08,0.15)},
  step:()=>noise(0.05,0.05,700+Math.random()*300,1),
  dash:()=>{noise(0.25,0.3,1500,2,sfxG,undefined,'bandpass');tone('sine',200,700,0.18,0.1)},
  tink:()=>tone('sine',3000+Math.random()*1500,0,0.05,0.025),
  bite:()=>{noise(0.07,0.2,1500,1);tone('square',300,100,0.06,0.06)},
  crate:()=>{noise(0.15,0.3,1200);[523,659,784,1046].forEach((f,i)=>tone('triangle',f,0,0.15,0.1,sfxG,now()+0.05+i*0.06))},
  level:()=>{[392,523,659,784,1046].forEach((f,i)=>tone('square',f,0,0.2,0.06,sfxG,now()+i*0.07));noise(0.6,0.08,6000,1,sfxG,undefined,'highpass')},
  fusion:()=>{[262,330,392,523,659,784,1046,1318].forEach((f,i)=>tone('sawtooth',f,0,0.3,0.06,sfxG,now()+i*0.05));noise(0.9,0.25,3000);tone('sine',60,30,1,0.5)},
  boss:()=>{tone('sawtooth',55,40,2.5,0.35,D());tone('sawtooth',58,41,2.5,0.3,D());noise(2,0.2,200)},
  bossatk:()=>{tone('sawtooth',90,40,0.5,0.25,D());noise(0.4,0.2,600)},
  roar:()=>{const o=ctx.createOscillator(),g=ctx.createGain(),f=ctx.createBiquadFilter();o.type='sawtooth';o.frequency.setValueAtTime(70,now());o.frequency.linearRampToValueAtTime(110,now()+0.4);o.frequency.linearRampToValueAtTime(50,now()+1.1);f.type='bandpass';f.frequency.value=500;f.Q.value=2;g.gain.setValueAtTime(0.0001,now());g.gain.linearRampToValueAtTime(0.4,now()+0.1);g.gain.exponentialRampToValueAtTime(0.001,now()+1.2);o.connect(f);f.connect(g);g.connect(D());o.start();o.stop(now()+1.3);},
  groan:()=>{const o=ctx.createOscillator(),g=ctx.createGain(),f=ctx.createBiquadFilter(),b=80+Math.random()*40;o.type='sawtooth';o.frequency.setValueAtTime(b,now());o.frequency.linearRampToValueAtTime(b*0.7,now()+0.7);f.type='bandpass';f.frequency.value=600+Math.random()*300;f.Q.value=4;g.gain.setValueAtTime(0.0001,now());g.gain.linearRampToValueAtTime(0.12,now()+0.15);g.gain.exponentialRampToValueAtTime(0.001,now()+0.8);o.connect(f);f.connect(g);g.connect(sfxG);o.start();o.stop(now()+0.85);},
  chitter:()=>{for(let i=0;i<5;i++)tone('square',1800+Math.random()*900,900,0.03,0.03,sfxG,now()+i*0.04)},
  spit:()=>{noise(0.15,0.12,1200,3,sfxG,undefined,'bandpass');tone('sine',500,200,0.1,0.05)},
  fuse:()=>{for(let i=0;i<4;i++)tone('square',900,0,0.05,0.05,sfxG,now()+i*0.1)},
  horde:()=>{for(let i=0;i<4;i++)setTimeout(()=>SFX.groan(),i*120);},
  wave:()=>{tone('sawtooth',110,0,0.8,0.12,D());[330,440,550].forEach((f,i)=>tone('triangle',f,0,0.3,0.1,sfxG,now()+i*0.12))},
  over:()=>{[440,392,330,262].forEach((f,i)=>tone('triangle',f,f*0.95,0.45,0.15,sfxG,now()+i*0.28));tone('sine',60,30,2,0.4)},
  click:()=>tone('sine',900,0,0.04,0.07),
  deny:()=>tone('square',200,150,0.15,0.06),
};

// ---- banco de muestras (variaciones + tono aleatorio) ----
const BANK={
  shoot:['shoot_a','shoot_b'],smg:['shoot_c','shoot_d'],shotgun:['shoot_g','shoot_e'],rocket:['shoot_h'],laser:['laser4'],rail:['laser9'],plasma:['phaserDown2'],freeze:['zapThreeToneDown'],
  zap:['zap1','zap2'],whoosh:['woosh1','woosh2','woosh3'],dash:['woosh4','woosh3'],slash:['sword1','sword2','sword3','sword4'],
  hit:['impactPunch_medium_0','impactPunch_medium_1','impactPunch_medium_2','impactSoft_medium_0','impactSoft_medium_1'],kill:['impactPunch_heavy_0','impactPunch_heavy_1','impactPunch_heavy_2'],
  boom:['boom_a','boom_b','boom_c'],bossdie:['boom_b'],hurt:['hurt_a','hurt_b','hurt_c','hurt_d','hurt_e'],coin:['coin_a','coin_b','coin_c','coin_d'],pick:['pepSound1','pepSound2','pepSound3'],
  heal:['powerUp3'],power:['powerUp7'],level:['powerUp12'],fusion:['phaserUp6'],crate:['impactWood_heavy_0','impactWood_heavy_1','impactWood_heavy_2'],tink:['impactMetal_light_0','impactMetal_light_1','impactMetal_light_2'],
  metal:['impactMetal_heavy_0','impactMetal_heavy_1','impactMetal_heavy_2'],step:['footstep_concrete_0','footstep_concrete_1','footstep_concrete_2'],jump:['jump_a','jump_b'],land:['impactSoft_heavy_0','impactSoft_heavy_1','impactSoft_heavy_2'],
  bite:['impactPunch_medium_1'],click:['click','impactGeneric_light_0'],deny:['deny'],wave:['threeTone1'],boss:['impactBell_heavy_0'],over:['over'],plank:['impactPlank_medium_0','impactPlank_medium_1'],
  ui:['impactGeneric_light_1','impactGeneric_light_2'],spit:['spaceTrash2'],fuse:['twoTone1'],
};
// capa procedural extra para dar cuerpo (sub-graves, etc.)
const LAYER={boom:1,bossdie:1,shotgun:1,rocket:1,rail:1,boss:1,bossatk:1,roar:1,groan:1,chitter:1,growl:1,flame:1,meteor:1,nova:1,horde:1,fuse:0,level:0,fusion:1};
const VOL={step:0.35,pick:0.35,coin:0.5,hit:0.55,tink:0.4,smg:0.55,shoot:0.65,click:0.7,ui:0.6,kill:0.7,land:0.6,slash:0.6,plank:0.6};
const buf={};let bankLoaded=false;
async function loadBank(){if(bankLoaded)return;bankLoaded=true;const names=new Set(Object.values(BANK).flat());
  await Promise.all([...names].map(async n=>{try{const r=await fetch('sounds/'+n+'.ogg');buf[n]=await ctx.decodeAudioData(await r.arrayBuffer());}catch(e){}}));}
function play(name,vol=1,rate=1,dest=sfxG){const b=buf[name];if(!b)return false;const s=ctx.createBufferSource();s.buffer=b;s.playbackRate.value=rate;const g=ctx.createGain();g.gain.value=vol;s.connect(g);g.connect(dest);s.start();return true;}
SFX.growl=()=>{const o=ctx.createOscillator(),g=ctx.createGain(),f=ctx.createBiquadFilter(),b=55+Math.random()*25;o.type='sawtooth';o.frequency.setValueAtTime(b,now());o.frequency.linearRampToValueAtTime(b*1.4,now()+0.25);o.frequency.linearRampToValueAtTime(b*0.8,now()+0.6);
  const lfo=ctx.createOscillator(),lg=ctx.createGain();lfo.frequency.value=28;lg.gain.value=b*0.3;lfo.connect(lg);lg.connect(o.frequency);f.type='lowpass';f.frequency.value=700;g.gain.setValueAtTime(0.0001,now());g.gain.linearRampToValueAtTime(0.18,now()+0.08);g.gain.exponentialRampToValueAtTime(0.001,now()+0.7);
  o.connect(f);f.connect(g);g.connect(D());o.start();lfo.start();o.stop(now()+0.75);lfo.stop(now()+0.75);};
SFX.chitter=()=>{for(let i=0;i<7;i++)tone('square',1500+Math.random()*1400,600,0.03,0.035,sfxG,now()+i*0.035);tone('sine',300,900,0.25,0.05);};
export function sfx(n,minGap=0.045){
  if(!ctx||ctx.state!=='running') return; const t=ctx.currentTime; if(last[n]&&t-last[n]<minGap) return; last[n]=t;
  try{const l=BANK[n];let ok=false;if(l)ok=play(l[Math.floor(Math.random()*l.length)],VOL[n]??0.85,0.92+Math.random()*0.16);
    if(!ok||LAYER[n])SFX[n]&&SFX[n]();}catch(e){}
}
// voces de enemigos por familia
export function voice(fam){sfx(fam==='alien'?'chitter':fam==='monstruo'?'growl':'groan',0.35);}

// ---- ambiente en capas: viento, fuego lejano, escombros, dron inquietante ----
let ambOn=false,ambNodes=[],ambTimer=null,ambLevel=0.5;
function loopNoise(freq,q,type,vol,lfoRate,lfoDepth){const s=ctx.createBufferSource();s.buffer=noiseBuf;s.loop=true;const f=ctx.createBiquadFilter();f.type=type;f.frequency.value=freq;f.Q.value=q;
  const g=ctx.createGain();g.gain.value=vol;const l=ctx.createOscillator(),lg=ctx.createGain();l.frequency.value=lfoRate;lg.gain.value=lfoDepth;l.connect(lg);lg.connect(f.frequency);
  s.connect(f);f.connect(g);g.connect(ambG);s.start();l.start();ambNodes.push(s,l);}
function drone(f,vol){for(const d of [-3,3]){const o=ctx.createOscillator();o.type='sine';o.frequency.value=f;o.detune.value=d*4;const g=ctx.createGain();g.gain.value=vol;o.connect(g);g.connect(ambG);o.start();ambNodes.push(o);}}
export function startAmbience(level=0.5){if(!ctx)return;ambLevel=level;if(ambOn)return;ambOn=true;
  loopNoise(420,0.8,'bandpass',0.5,0.07,260);   // viento
  loopNoise(1400,2,'bandpass',0.08,0.13,600);   // silbido del viento
  drone(55,0.05);drone(82.4,0.025);              // ciudad inquietante
  ambTimer=setInterval(()=>{if(!ambOn)return;const r=Math.random();
    if(r<0.5){for(let i=0;i<3+Math.random()*6;i++)noise(0.02,0.12*Math.random(),2500+Math.random()*2000,1,ambG,now()+Math.random()*0.6,'highpass');} // fuego que crepita
    else if(r<0.62){const n=['metal','plank','tink'][Math.floor(Math.random()*3)];const l=BANK[n];play(l[Math.floor(Math.random()*l.length)],0.25,0.5+Math.random()*0.3,ambG);} // escombros lejanos
    else if(r<0.66){tone('sine',40,25,1.5,0.25,ambG);noise(1.2,0.15,250,0.5,ambG);} // explosión lejana
  },420);
  fadeAmb();}
export function stopAmbience(){ambOn=false;clearInterval(ambTimer);for(const n of ambNodes)try{n.stop()}catch(e){}ambNodes=[];}
function fadeAmb(){if(ambG)ambG.gain.setTargetAtTime(ambOn?0.6*volA*ambLevel:0,ctx.currentTime,0.5);}
export function setAmbienceLevel(l){ambLevel=l;fadeAmb();}

// ---- música: pistas CC0 (menú / combate / jefe) con fundido cruzado ----
const TRACKS={menu:'sounds/mus_menu.ogg',combat:'sounds/mus_combat.ogg',combat2:'sounds/mus_combat2.ogg',boss:'sounds/mus_boss.ogg'};
const els={};let curTrack=null,wantTrack='menu',combatAlt=0;
function el(k){if(els[k])return els[k];const a=new Audio(TRACKS[k]);a.loop=true;a.preload='auto';a.crossOrigin='anonymous';const src=ctx.createMediaElementSource(a);const g=ctx.createGain();g.gain.value=0;src.connect(g);g.connect(musG);return els[k]={a,g};}
function switchTo(k,reset=true){if(!ctx)return;if(!musicOn){for(const t in els){els[t].g.gain.setTargetAtTime(0,ctx.currentTime,0.2);setTimeout(()=>els[t].a.pause(),900);}curTrack=null;return;}
  if(curTrack===k)return;const prev=curTrack;curTrack=k;const e=el(k);if(reset&&k!=='menu'&&prev!==k)try{e.a.currentTime=0}catch(_){}
  e.a.play().catch(()=>{});e.g.gain.cancelScheduledValues(ctx.currentTime);e.g.gain.setTargetAtTime(1,ctx.currentTime,0.6);
  if(prev&&els[prev]){const p=els[prev];p.g.gain.cancelScheduledValues(ctx.currentTime);p.g.gain.setTargetAtTime(0,ctx.currentTime,0.5);setTimeout(()=>{if(curTrack!==prev)p.a.pause();},2500);}}
export function startMusic(kind='combat',fresh=true){wantTrack=kind;if(!ctx)return;if(kind==='combat'){if(fresh)combatAlt^=1;switchTo(intensity>=2?'boss':combatAlt?'combat':'combat2',fresh);}else switchTo(kind);}
export function stopMusic(){if(!ctx)return;for(const t in els)els[t].g.gain.setTargetAtTime(0,ctx.currentTime,0.25);const c=curTrack;curTrack=null;setTimeout(()=>{for(const t in els)if(t!==curTrack)els[t].a.pause();},1200);}
export function setIntensity(i){const was=intensity;intensity=i;if(!ctx||!curTrack||curTrack==='menu')return;
  if(i>=2&&curTrack!=='boss')switchTo('boss');else if(i<2&&curTrack==='boss')switchTo(combatAlt?'combat':'combat2');
  // más intensidad = música un poco más rápida y brillante
  for(const t in els)els[t].a.playbackRate=i>=1&&t!=='menu'?1.04:1;}
export function toggleMusic(){ musicOn=!musicOn; try{localStorage.setItem('oleadas_music',musicOn?'1':'0')}catch(e){} if(musicOn) startMusic(wantTrack); else switchTo(null); return musicOn; }
export function musicEnabled(){return musicOn}
let volS=1,volM=1,volA=1;
export function setVolumes(s,m,a=s){volS=s;volM=m;volA=a;if(sfxG){sfxG.gain.value=0.55*s;musG.gain.value=0.45*m;fadeAmb();}}
export function applyVolumes(){setVolumes(volS,volM,volA);}
