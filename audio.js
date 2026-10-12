// Sonido procedural con WebAudio: efectos + música generativa
let ctx=null, master, sfxG, musG, noiseBuf, last={}, musicOn=true, musTimer=null, nextT=0, step=0, intensity=0;
export function initAudio(){
  if(ctx){ if(ctx.state==='suspended') ctx.resume(); return; }
  const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
  ctx=new AC(); master=ctx.createGain(); master.gain.value=0.6; master.connect(ctx.destination);
  const comp=ctx.createDynamicsCompressor(); comp.connect(master);
  sfxG=ctx.createGain(); sfxG.gain.value=0.5; sfxG.connect(comp);
  musG=ctx.createGain(); musG.gain.value=0.2; musG.connect(comp);
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
export function sfx(n,minGap=0.045){
  if(!ctx||ctx.state!=='running') return; const t=ctx.currentTime; if(last[n]&&t-last[n]<minGap) return; last[n]=t;
  try{SFX[n]&&SFX[n]();}catch(e){}
}
// ---- música ----
const SCALE=[0,3,5,7,10,12,15,17];
const PROG=[[40,0],[36,0],[38,0],[35,0]]; // A F G E (midi raíces)
const mtof=m=>440*Math.pow(2,(m-69)/12);
function schedule(){
  const spb=60/(118+intensity*14)/2; // corcheas
  while(nextT<ctx.currentTime+0.15){
    const bar=Math.floor(step/16)%4, s=step%16, root=PROG[bar][0], t=nextT;
    if(s%4===0) {tone('sine',60,30,0.25,0.5,musG,t); }
    if(s%8===4) noise(0.15,0.25,1800,0.7,musG,t);
    if(s%2===1) noise(0.04,0.12,8000,1,musG,t,'highpass');
    if(s%2===0) tone('triangle',mtof(root-12+(s%8===6?7:0)),0,spb*1.8,0.25,musG,t);
    if(intensity>0 || s%4!==3){ const n=SCALE[(s*3+bar*2+(s>8?2:0))%SCALE.length]; tone(intensity>1?'sawtooth':'square',mtof(root+12+n),0,spb*0.9,0.045,musG,t); }
    nextT+=spb; step++;
  }
}
export function startMusic(){ if(!ctx) return; stopMusic(); if(!musicOn) return; nextT=ctx.currentTime+0.1; step=0; musTimer=setInterval(schedule,40); }
export function stopMusic(){ if(musTimer) clearInterval(musTimer); musTimer=null; }
export function setIntensity(i){ intensity=i; }
export function toggleMusic(){ musicOn=!musicOn; try{localStorage.setItem('oleadas_music',musicOn?'1':'0')}catch(e){} if(musicOn) startMusic(); else stopMusic(); return musicOn; }
export function musicEnabled(){return musicOn}
