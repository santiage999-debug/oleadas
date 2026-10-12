// Sonido procedural con WebAudio: efectos + música generativa
let ctx=null, master, sfxG, musG, noiseBuf, last={}, musicOn=true, musTimer=null, nextT=0, step=0, intensity=0;
export function initAudio(){
  if(ctx){ if(ctx.state==='suspended') ctx.resume(); return; }
  const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
  ctx=new AC(); master=ctx.createGain(); master.gain.value=0.6; master.connect(ctx.destination);
  const comp=ctx.createDynamicsCompressor(); comp.connect(master);
  sfxG=ctx.createGain(); sfxG.gain.value=0.5; sfxG.connect(comp);
  musG=ctx.createGain(); musG.gain.value=0.22; musG.connect(comp);
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
const SFX={
  shoot:()=>tone('square',900,300,0.07,0.08),
  shotgun:()=>{noise(0.18,0.35,1800);tone('square',200,60,0.12,0.12)},
  laser:()=>tone('sawtooth',1600,200,0.25,0.12),
  rocket:()=>{noise(0.35,0.2,600);tone('triangle',120,400,0.3,0.12)},
  flame:()=>noise(0.12,0.08,900,0.5,sfxG,undefined,'bandpass'),
  zap:()=>{tone('sawtooth',2400,600,0.12,0.08);noise(0.1,0.12,4000,1,sfxG,undefined,'highpass')},
  whoosh:()=>noise(0.25,0.12,700,2,sfxG,undefined,'bandpass'),
  freeze:()=>tone('sine',2200,1200,0.18,0.08),
  plasma:()=>tone('sine',300,900,0.3,0.15),
  boom:()=>{noise(0.6,0.6,500);tone('sine',90,30,0.5,0.5)},
  hit:()=>tone('square',220,110,0.05,0.06),
  kill:()=>noise(0.08,0.12,2500),
  pick:()=>tone('sine',1200+Math.random()*300,1800,0.06,0.06),
  coin:()=>{tone('square',1300,0,0.06,0.05);tone('square',1900,0,0.12,0.05,sfxG,ctx.currentTime+0.06)},
  hurt:()=>{tone('sawtooth',300,80,0.25,0.25);noise(0.2,0.2,800)},
  jump:()=>tone('sine',300,700,0.15,0.1),
  crate:()=>{[523,659,784,1046].forEach((f,i)=>tone('triangle',f,0,0.15,0.12,sfxG,ctx.currentTime+i*0.06))},
  level:()=>{[392,523,659,784,1046].forEach((f,i)=>tone('square',f,0,0.18,0.08,sfxG,ctx.currentTime+i*0.07))},
  fusion:()=>{[262,330,392,523,659,784,1046,1318].forEach((f,i)=>tone('sawtooth',f,0,0.3,0.07,sfxG,ctx.currentTime+i*0.05));noise(0.8,0.2,3000)},
  boss:()=>{tone('sawtooth',110,55,1.5,0.3);tone('sawtooth',116,58,1.5,0.3)},
  wave:()=>{[330,440,550].forEach((f,i)=>tone('triangle',f,0,0.3,0.12,sfxG,ctx.currentTime+i*0.12))},
  over:()=>{[440,392,330,262].forEach((f,i)=>tone('triangle',f,f*0.95,0.4,0.15,sfxG,ctx.currentTime+i*0.25))},
  click:()=>tone('sine',800,0,0.05,0.08),
};
export function sfx(n,minGap=0.045){
  if(!ctx||ctx.state!=='running') return; const t=ctx.currentTime; if(last[n]&&t-last[n]<minGap) return; last[n]=t;
  try{SFX[n]&&SFX[n]();}catch(e){}
}
// ---- música ----
const SCALE=[0,3,5,7,10,12,15,17];
const PROG=[[45,0],[41,0],[43,0],[40,0]]; // A F G E (midi raíces)
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
