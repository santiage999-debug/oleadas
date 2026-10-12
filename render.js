// Efectos instanciados: partículas en billboard + decals en el suelo
import * as THREE from 'three';

export const FOG = new THREE.Color(0xf3dcb4);
export const FOG_NEAR=26, FOG_FAR=58;
const VS_COMMON = `
attribute vec3 iPos; attribute vec2 iSize; attribute vec4 iUV; attribute vec4 iCol; attribute vec3 iEx;
varying vec2 vUv; varying vec4 vCol; varying float vFlash; varying float vFog;
uniform float fogNear; uniform float fogFar;
`;
const VS_BILL = VS_COMMON + `
void main(){
  vec2 l = vec2(position.x, position.y + 0.5 - iEx.z) * iSize;
  float c=cos(iEx.x), s=sin(iEx.x); l = vec2(l.x*c - l.y*s, l.x*s + l.y*c);
  vec4 mv = modelViewMatrix * vec4(iPos,1.0); mv.xy += l;
  gl_Position = projectionMatrix * mv;
  vUv = iUV.xy + vec2(uv.x, 1.0-uv.y) * iUV.zw; vUv.y = 1.0 - vUv.y;
  vCol = iCol; vFlash = iEx.y; vFog = smoothstep(fogNear, fogFar, -mv.z);
}`;
const VS_GROUND = VS_COMMON + `
void main(){
  vec2 l = vec2(position.x, position.y + 0.5 - iEx.z) * iSize;
  float c=cos(iEx.x), s=sin(iEx.x);
  vec3 w = iPos + vec3(l.x*c - l.y*s, 0.0, -(l.x*s + l.y*c));
  vec4 mv = modelViewMatrix * vec4(w,1.0);
  gl_Position = projectionMatrix * mv;
  vUv = iUV.xy + vec2(uv.x, 1.0-uv.y) * iUV.zw; vUv.y = 1.0 - vUv.y;
  vCol = iCol; vFlash = iEx.y; vFog = smoothstep(fogNear, fogFar, -mv.z);
}`;
const FS = (mode) => `
uniform sampler2D map; uniform vec3 fogColor;
varying vec2 vUv; varying vec4 vCol; varying float vFlash; varying float vFog;
void main(){
  vec4 t = texture2D(map, vUv);
  ${mode==='cut' ? 'if(t.a<0.42) discard;' : ''}
  vec3 col = t.rgb * vCol.rgb;
  ${mode==='add' ? 'gl_FragColor = vec4(col * t.a * vCol.a * (1.0-vFog*0.7), 1.0); return;' : ''}
  ${mode==='shadow' ? 'gl_FragColor = vec4(0.25,0.16,0.2, t.a*vCol.a*(1.0-vFog)); return;' : ''}
  col = mix(col, vec3(1.0,0.95,0.9), vFlash);
  col = mix(col, fogColor, vFog);
  gl_FragColor = vec4(col, ${mode==='cut' ? '1.0' : 't.a*vCol.a'});
}`;

export class Batch {
  constructor(scene, tex, max, { ground = false, mode = 'cut', order = 0 } = {}) {
    const g = new THREE.InstancedBufferGeometry();
    const p = new THREE.PlaneGeometry(1, 1);
    g.index = p.index; g.attributes.position = p.attributes.position; g.attributes.uv = p.attributes.uv;
    this.max = max; this.n = 0;
    const mk = (name, sz) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(max * sz), sz); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(name, a); return a; };
    this.aPos = mk('iPos', 3); this.aSize = mk('iSize', 2); this.aUV = mk('iUV', 4); this.aCol = mk('iCol', 4); this.aEx = mk('iEx', 3);
    g.instanceCount = 0;
    this.u = { map: { value: tex }, fogColor: { value: FOG }, fogNear: { value: FOG_NEAR }, fogFar: { value: FOG_FAR } };
    const m = new THREE.ShaderMaterial({
      uniforms: this.u, vertexShader: ground ? VS_GROUND : VS_BILL, fragmentShader: FS(mode),
      transparent: mode !== 'cut', depthWrite: mode === 'cut', depthTest: true,
      blending: mode === 'add' ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide,
    });
    if (mode === 'cut') m.alphaToCoverage = true;
    this.mesh = new THREE.Mesh(g, m); this.mesh.frustumCulled = false; this.mesh.renderOrder = order; this.g = g;
    scene.add(this.mesh);
  }
  // fr: [u,v,w,h] en UV; col: [r,g,b,a]
  add(x, y, z, w, h, fr, r = 1, gg = 1, b = 1, a = 1, rot = 0, flash = 0, anchor = 0) {
    if (this.n >= this.max) return; const i = this.n++;
    let o = i * 3; this.aPos.array[o] = x; this.aPos.array[o + 1] = y; this.aPos.array[o + 2] = z;
    o = i * 2; this.aSize.array[o] = w; this.aSize.array[o + 1] = h;
    o = i * 4; const U = this.aUV.array; U[o] = fr[0]; U[o + 1] = fr[1]; U[o + 2] = fr[2]; U[o + 3] = fr[3];
    const C = this.aCol.array; C[o] = r; C[o + 1] = gg; C[o + 2] = b; C[o + 3] = a;
    o = i * 3; const E = this.aEx.array; E[o] = rot; E[o + 1] = flash; E[o + 2] = anchor;
  }
  flush() {
    const n = this.n; this.g.instanceCount = n;
    for (const a of [this.aPos, this.aSize, this.aUV, this.aCol, this.aEx]) { a.needsUpdate = true; a.clearUpdateRanges?.(); a.addUpdateRange?.(0, n * a.itemSize); }
    this.n = 0;
  }
}

// Atlas de efectos generado por código (128px por celda, 4x4)
export const FX = { glow: 0, spark: 1, smoke: 2, splat1: 3, splat2: 4, scorch: 5, ring: 6, casing: 7, fire: 8, shadow: 9, tracer: 10, chunk: 11, flare: 12, white: 13, warn: 14, drop: 15 };
export function makeFxAtlas() {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S * 4; const g = c.getContext('2d');
  const cell = (i, fn) => { g.save(); g.translate((i % 4) * S, Math.floor(i / 4) * S); g.beginPath(); g.rect(0, 0, S, S); g.clip(); fn(); g.restore(); };
  const rad = (x, y, r, stops) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
  const R = (a, b) => a + Math.random() * (b - a);
  cell(FX.glow, () => rad(64, 64, 64, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,.55)'], [1, 'rgba(255,255,255,0)']]));
  cell(FX.spark, () => rad(64, 64, 40, [[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,.9)'], [1, 'rgba(255,255,255,0)']]));
  cell(FX.smoke, () => { for (let i = 0; i < 22; i++) rad(64 + R(-22, 22), 64 + R(-22, 22), R(18, 34), [[0, 'rgba(255,255,255,.22)'], [1, 'rgba(255,255,255,0)']]); });
  const splat = (seed) => () => { g.fillStyle = '#fff'; for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(64 + R(-26, 26), 64 + R(-26, 26), R(8, 22), 0, 7); g.fill(); }
    for (let i = 0; i < 26; i++) { const a = R(0, 6.3), d = R(30, 60); g.beginPath(); g.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, R(2, 6), 0, 7); g.fill(); }
    for (let i = 0; i < 6; i++) { const a = R(0, 6.3); g.lineWidth = R(3, 6); g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.cos(a) * R(40, 60), 64 + Math.sin(a) * R(40, 60)); g.stroke(); } };
  cell(FX.splat1, splat(1)); cell(FX.splat2, splat(2));
  cell(FX.scorch, () => { rad(64, 64, 60, [[0, 'rgba(10,8,6,.95)'], [0.6, 'rgba(20,15,10,.6)'], [1, 'rgba(0,0,0,0)']]); for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(64 + R(-55, 55), 64 + R(-55, 55), R(2, 6), R(2, 6)); } });
  cell(FX.ring, () => { g.strokeStyle = '#fff'; g.lineWidth = 10; g.shadowColor = '#fff'; g.shadowBlur = 12; g.beginPath(); g.arc(64, 64, 52, 0, 7); g.stroke(); });
  cell(FX.casing, () => { const gr = g.createLinearGradient(54, 0, 74, 0); gr.addColorStop(0, '#7a5a1a'); gr.addColorStop(0.5, '#ffe08a'); gr.addColorStop(1, '#8a6a20'); g.fillStyle = gr; g.fillRect(54, 30, 20, 68); });
  cell(FX.fire, () => { rad(64, 74, 54, [[0, 'rgba(255,250,220,1)'], [0.3, 'rgba(255,190,60,.9)'], [0.65, 'rgba(230,70,10,.5)'], [1, 'rgba(120,20,0,0)']]); });
  cell(FX.shadow, () => rad(64, 64, 62, [[0, 'rgba(0,0,0,.9)'], [0.6, 'rgba(0,0,0,.6)'], [1, 'rgba(0,0,0,0)']]));
  cell(FX.tracer, () => { const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.shadowColor = '#fff'; g.shadowBlur = 10; g.fillRect(52, 0, 24, 128); });
  cell(FX.chunk, () => { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(30, 40); g.lineTo(80, 24); g.lineTo(100, 70); g.lineTo(70, 104); g.lineTo(26, 88); g.closePath(); g.fill(); });
  cell(FX.flare, () => { rad(64, 64, 30, [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]); g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.moveTo(64, 0); g.lineTo(70, 64); g.lineTo(64, 128); g.lineTo(58, 64); g.fill(); g.beginPath(); g.moveTo(0, 64); g.lineTo(64, 58); g.lineTo(128, 64); g.lineTo(64, 70); g.fill(); });
  cell(FX.white, () => { g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128); });
  cell(FX.warn, () => { g.strokeStyle = '#fff'; g.lineWidth = 7; g.setLineDash([14, 10]); g.beginPath(); g.arc(64, 64, 56, 0, 7); g.stroke(); g.setLineDash([]); rad(64, 64, 56, [[0, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']]); });
  cell(FX.drop, () => { rad(64, 64, 34, [[0, 'rgba(255,255,255,1)'], [0.7, 'rgba(255,255,255,.95)'], [1, 'rgba(255,255,255,0)']]); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  const frames = {}; for (const k in FX) { const i = FX[k]; frames[k] = [(i % 4) / 4 + 0.002, Math.floor(i / 4) / 4 + 0.002, 0.25 - 0.004, 0.25 - 0.004]; }
  return { tex: t, frames };
}
