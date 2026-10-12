// Datos del juego: armas, fusiones, enemigos, tienda
export const WEAPONS = {
  pistola:   {name:'Pistola',icon:'🔫',type:'proj',dmg:14,cd:0.55,spd:22,count:1,spread:0.05,pierce:1,size:0.22,life:1.2,color:0xffe066,desc:'Disparo fiable'},
  escopeta:  {name:'Escopeta',icon:'💥',type:'proj',dmg:9,cd:1.1,spd:20,count:6,spread:0.5,pierce:1,size:0.18,life:0.45,color:0xffaa44,desc:'Ráfaga en abanico'},
  subfusil:  {name:'Subfusil',icon:'🔩',type:'proj',dmg:6,cd:0.13,spd:26,count:1,spread:0.15,pierce:1,size:0.15,life:0.9,color:0xfff1a0,desc:'Lluvia de balas'},
  laser:     {name:'Láser',icon:'🔦',type:'beam',dmg:22,cd:1.1,len:18,width:0.25,color:0xff2a5a,desc:'Atraviesa todo'},
  cohete:    {name:'Lanzacohetes',icon:'🚀',type:'proj',dmg:35,cd:1.7,spd:13,count:1,spread:0,pierce:1,size:0.35,life:2,explode:3.2,color:0xff6a1a,desc:'Explosión en área'},
  lanzallamas:{name:'Lanzallamas',icon:'🔥',type:'flame',dmg:4,cd:0.06,spd:11,count:1,spread:0.35,pierce:99,size:0.3,life:0.5,burn:1,color:0xff7a1a,desc:'Quema a corta distancia'},
  rayo:      {name:'Rayo',icon:'⚡',type:'chain',dmg:15,cd:0.95,chain:4,range:10,color:0x8ad8ff,desc:'Salta entre enemigos'},
  boomerang: {name:'Bumerán',icon:'🪃',type:'boomer',dmg:16,cd:1.4,spd:15,count:1,size:0.4,life:1.6,pierce:99,color:0xd09a5a,desc:'Ida y vuelta'},
  cuchillas: {name:'Cuchillas orbitales',icon:'🌀',type:'orbit',dmg:11,count:3,radius:2.6,rot:3.2,size:0.5,color:0xc8d8ff,desc:'Giran a tu alrededor'},
  congelador:{name:'Rayo congelante',icon:'❄️',type:'proj',dmg:7,cd:0.75,spd:18,count:1,spread:0.05,pierce:3,size:0.28,life:1,freeze:1.6,color:0x7ae8ff,desc:'Ralentiza y congela'},
  plasma:    {name:'Cañón de plasma',icon:'🟣',type:'proj',dmg:22,cd:1.35,spd:9,count:1,spread:0,pierce:99,size:0.6,life:2.2,color:0xc05aff,desc:'Esfera perforante'},
  minas:     {name:'Minas',icon:'💣',type:'mine',dmg:45,cd:1.6,explode:3.6,color:0xff3030,desc:'Deja minas a tu paso'},
  meteoro:   {name:'Meteoro',icon:'☄️',type:'meteor',dmg:55,cd:3,count:1,explode:3.5,color:0xff8a2a,spell:1,desc:'Hechizo: lluvia de fuego'},
  nova:      {name:'Nova arcana',icon:'✨',type:'nova',dmg:20,cd:2.6,radius:5.5,color:0xa0a0ff,spell:1,desc:'Hechizo: onda expansiva'},
  aura:      {name:'Aura sagrada',icon:'🌞',type:'aura',dmg:6,cd:0.45,radius:3,color:0xffee88,spell:1,desc:'Hechizo: daño constante'},
  // ---- fusiones ----
  tormenta:  {name:'Tormenta de plasma',icon:'🌩️',type:'chain',dmg:26,cd:0.45,chain:9,range:12,burn:1,color:0xff5aff,fusion:1,desc:'Rayos ardientes encadenados'},
  minigun:   {name:'Minigun',icon:'🔥🔫',type:'proj',dmg:9,cd:0.04,spd:30,count:1,spread:0.12,pierce:2,size:0.17,life:1,color:0xffd060,fusion:1,desc:'Cadencia brutal'},
  escoexpl:  {name:'Escopeta explosiva',icon:'🎆',type:'proj',dmg:16,cd:1.1,spd:19,count:7,spread:0.6,pierce:1,size:0.24,life:0.6,explode:2,color:0xff8040,fusion:1,desc:'Perdigones que estallan'},
  crio:      {name:'Rayo criogénico',icon:'🧊',type:'beam',dmg:30,cd:0.8,len:22,width:0.6,freeze:2.5,color:0x9af0ff,fusion:1,desc:'Láser que congela'},
  sierra:    {name:'Sierra orbital',icon:'⚙️',type:'orbit',dmg:24,count:6,radius:3.6,rot:4.5,size:0.8,color:0xffffff,fusion:1,desc:'Seis sierras giratorias'},
  tesla:     {name:'Orbe Tesla',icon:'🔮',type:'proj',dmg:30,cd:1.1,spd:8,count:1,spread:0,pierce:99,size:0.8,life:2.6,chainHit:3,color:0x6ae0ff,fusion:1,desc:'Plasma que electrocuta'},
  apocalipsis:{name:'Lluvia apocalíptica',icon:'🌋',type:'meteor',dmg:70,cd:2.4,count:5,explode:4,color:0xff4a00,spell:1,fusion:1,desc:'Meteoros en masa'},
  ventisca:  {name:'Ventisca',icon:'🌨️',type:'nova',dmg:28,cd:1.6,radius:7.5,freeze:2,color:0xbaf6ff,spell:1,fusion:1,desc:'Nova helada'},
  misiles:   {name:'Misiles teledirigidos',icon:'🎯',type:'proj',dmg:40,cd:1.2,spd:14,count:3,spread:0.8,pierce:1,size:0.33,life:2.5,explode:3.2,homing:1,color:0xffa040,fusion:1,desc:'Buscan objetivos'},
  infierno:  {name:'Infierno',icon:'😈',type:'aura',dmg:16,cd:0.3,radius:5,burn:1,color:0xff4a1a,spell:1,fusion:1,desc:'Aura de llamas'},
  riel:      {name:'Cañón de riel',icon:'☄️🔫',type:'beam',dmg:110,cd:1.5,len:40,width:0.45,color:0x60ffb0,fusion:1,desc:'Disparo devastador'},
  anillo:    {name:'Anillo de plasma',icon:'💫',type:'orbit',dmg:20,count:4,radius:4.2,rot:2.2,size:1.0,explodeHit:1,color:0xd070ff,fusion:1,desc:'Orbes de plasma'},
  granizo:   {name:'Granizo',icon:'🌨️💥',type:'proj',dmg:12,cd:0.9,spd:22,count:9,spread:0.7,pierce:4,size:0.24,life:0.7,freeze:1.5,color:0xd0f8ff,fusion:1,desc:'Escopeta de hielo'},
  sol:       {name:'Supernova',icon:'🌟',type:'nova',dmg:60,cd:2,radius:8,burn:1,color:0xffd040,spell:1,fusion:1,desc:'Explosión solar'},
};
export const BASE_WEAPONS = ['pistola','escopeta','subfusil','laser','cohete','lanzallamas','rayo','boomerang','cuchillas','congelador','plasma','minas','meteoro','nova','aura'];
export const FUSIONS = [
  ['lanzallamas','rayo','tormenta'], ['pistola','subfusil','minigun'], ['escopeta','cohete','escoexpl'],
  ['laser','congelador','crio'], ['boomerang','cuchillas','sierra'], ['plasma','rayo','tesla'],
  ['minas','meteoro','apocalipsis'], ['nova','congelador','ventisca'], ['cohete','rayo','misiles'],
  ['lanzallamas','aura','infierno'], ['pistola','laser','riel'], ['plasma','cuchillas','anillo'],
  ['escopeta','congelador','granizo'], ['nova','aura','sol'],
];
export const FAMS = {
  zombi:   {name:'Zombi',blood:[0.42,0.03,0.02],eye:0xff3a2a,boss:'Rey Zombi'},
  monstruo:{name:'Mutante',blood:[0.32,0.06,0.38],eye:0xffd23a,boss:'Archidemonio'},
  alien:   {name:'Alien',blood:[0.35,0.85,0.12],eye:0x7aff4a,boss:'Señor de la Colmena'},
};
export const ROLES = {
  normal:   {hp:20,spd:2.6,r:0.55,dmg:10,xp:1,s:1},
  rapido:   {hp:11,spd:5,r:0.45,dmg:7,xp:1,s:0.8},
  tanque:   {hp:110,spd:1.6,r:0.95,dmg:22,xp:5,s:1.7},
  tirador:  {hp:18,spd:2.2,r:0.5,dmg:8,xp:2,s:0.95,ranged:1},
  explosivo:{hp:14,spd:3.8,r:0.55,dmg:30,xp:2,s:0.9,explode:1},
  jefe:     {hp:1800,spd:2.1,r:2,dmg:35,xp:80,s:3.6,boss:1},
};
export const PASSIVES = {
  vida:   {name:'Corazón robusto',icon:'❤️',desc:'+20 vida máxima y cura',max:8},
  vel:    {name:'Botas veloces',icon:'👟',desc:'+8% velocidad',max:6},
  dano:   {name:'Furia',icon:'💪',desc:'+12% daño',max:8},
  cad:    {name:'Gatillo rápido',icon:'⏩',desc:'-8% recarga',max:6},
  iman:   {name:'Imán',icon:'🧲',desc:'+35% radio de recogida',max:5},
  regen:  {name:'Regeneración',icon:'💚',desc:'+0.6 vida/seg',max:5},
  armad:  {name:'Armadura',icon:'🛡️',desc:'-8% daño recibido',max:5},
  crit:   {name:'Ojo crítico',icon:'🎯',desc:'+7% prob. crítico (x2)',max:6},
  area:   {name:'Expansión',icon:'⭕',desc:'+12% área de efecto',max:5},
  multi:  {name:'Multidisparo',icon:'➕',desc:'+1 proyectil',max:3},
};
export const PETS = {
  perro:{name:'Perro guardián',icon:'🐕',color:0xc08040,desc:'Muerde enemigos cercanos'},
  dron: {name:'Dron de combate',icon:'🛸',color:0x9aa8c0,desc:'Dispara al enemigo más cercano'},
  gato: {name:'Gato recolector',icon:'🐈',color:0xffa040,desc:'Recoge objetos y araña'},
  dragon:{name:'Mini dragón',icon:'🐉',color:0xd03030,desc:'Escupe fuego'},
};
export const SKINS = {marine:'Marine',comando:'Fuerzas especiales',pesado:'Artillero pesado',francotirador:'Francotirador',medico:'Médico de combate',superviviente:'Superviviente'};
export const SKIN_BONUS = {marine:'Equilibrado',comando:'+8% velocidad',pesado:'+25 vida',francotirador:'+10% crítico',medico:'+0.5 regeneración',superviviente:'+15% imán'};
export const CAMOS = {ninguno:['Original',[1,1,1]],desierto:['Desierto',[1.1,1.0,0.82]],artico:['Ártico',[1.25,1.28,1.35]],urbano:['Urbano',[0.86,0.9,1.0]],selva:['Selva',[0.82,1.08,0.78]],carmesi:['Carmesí',[1.25,0.78,0.75]],sombra:['Sombra',[0.6,0.6,0.72]],dorado:['Dorado',[1.35,1.12,0.6]]};
export const TRAILS = {azul:['Estela azul',[0.3,0.6,1]],fuego:['Estela de fuego',[1,0.45,0.1]],toxica:['Estela tóxica',[0.4,1,0.2]],fantasma:['Estela fantasma',[0.85,0.85,1]],arcoiris:['Estela arcoíris',null]};
export const WSKINS = {normal:'Normal',dorado:'Dorado',neon:'Neón',arcoiris:'Arcoíris',sombra:'Sombra'};
export const SHOP = [
  ...[['comando',300],['pesado',400],['francotirador',350],['medico',250]].map(([id,p])=>({id,cat:'skin',name:SKINS[id],price:p,desc:SKIN_BONUS[id]})),
  ...[['desierto',100],['artico',200],['urbano',150],['selva',150],['carmesi',250],['sombra',300],['dorado',800]].map(([id,p])=>({id,cat:'camo',name:'Camuflaje '+CAMOS[id][0],price:p})),
  ...[['fuego',200],['toxica',200],['fantasma',300],['arcoiris',600]].map(([id,p])=>({id,cat:'trail',name:TRAILS[id][0],price:p,desc:'Rastro al hacer dash'})),
  ...[['dorado',300],['neon',400],['arcoiris',700],['sombra',500]].map(([id,p])=>({id,cat:'wskin',name:'Munición: '+WSKINS[id],price:p})),
  ...[['perro',400],['gato',350],['dron',600],['dragon',900]].map(([id,p])=>({id,cat:'pet',name:PETS[id].name,price:p,desc:PETS[id].desc})),
  {id:'p_vida',cat:'perk',name:'❤️ Vida extra',price:200,desc:'+30 vida inicial'},
  {id:'p_fuerza',cat:'perk',name:'💪 Fuerza',price:300,desc:'+15% daño inicial'},
  {id:'p_iman',cat:'perk',name:'🧲 Imán',price:150,desc:'+50% radio de recogida'},
  {id:'p_botas',cat:'perk',name:'👟 Botas',price:200,desc:'+10% velocidad'},
  {id:'p_arsenal',cat:'perk',name:'🎒 Arsenal',price:450,desc:'Empiezas con un arma extra al azar'},
  {id:'p_suerte',cat:'perk',name:'🍀 Suerte',price:350,desc:'+30% monedas'},
  {id:'p_revivir',cat:'perk',name:'👼 Segunda vida',price:900,desc:'Revives una vez por partida'},
];
export const CATNAMES = {skin:'Soldados',camo:'Camuflajes',trail:'Estelas de dash',wskin:'Munición',pet:'Compañeros',perk:'Ventajas iniciales'};
export const ICONS = ['pistola','escopeta','subfusil','laser','cohete','lanzallamas','rayo','boomerang','cuchillas','congelador','plasma','minas','meteoro','nova','aura','minigun'];
