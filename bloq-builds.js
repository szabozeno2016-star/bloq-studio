"use strict";
/* ============================================================================
   BLOQ STUDIO — BUILDS: reusable systems inserted as REAL, editable blocks.
   Signature feature: Shift+0 opens the library; every Build generates blocks
   the user can open and modify. Insertion inspects the project, reuses
   compatible objects, resolves name conflicts, prevents duplicates.
   ==========================================================================*/

/* ---- block-builder mini DSL ---- */
function bk(op,inputs,fields,extra){const b=makeBlock(op);
  if(inputs)for(const k in inputs)b.inputs[k]=inputs[k];
  if(fields)for(const k in fields)b.fields[k]=fields[k];
  if(extra)Object.assign(b,extra);return b;}
const V =name=>bk('data_variable',null,{VAR:name});
const KEYD=k=>bk('sensing_keypressed',null,{KEY:k});
const TOUCH=o=>bk('sensing_touching',null,{OBJ:o});
const ADD=(a,b)=>bk('operator_add',{A:a,B:b});
const SUB=(a,b)=>bk('operator_subtract',{A:a,B:b});
const LT=(a,b)=>bk('operator_lt',{A:a,B:b});
const GT=(a,b)=>bk('operator_gt',{A:a,B:b});
const EQ=(a,b)=>bk('operator_equals',{A:a,B:b});
const AND=(a,b)=>bk('operator_and',{A:a,B:b});
const flag=()=>bk('event_whenflagclicked');

/* ---- install context ---- */
function makeInstaller(cfg){
  const notes=[];
  return {
    cfg,notes,
    target:cfg.__target||currentSprite(),
    ensureVar(name,scope='global',val=0){let v=findVar(currentSprite(),name);if(v){notes.push('reused variable “'+name+'”');return v;}
      v=addVariable(uniqueName(name,allVars(currentSprite()).map(x=>x.name)),scope,val);notes.push('added variable “'+v.name+'”');return v;},
    ensureList(name,scope='global'){let l=findList(currentSprite(),name);if(l)return l;const owner=scope==='local'?currentSprite():PROJ.stage;
      const nm=uniqueName(name,allLists(currentSprite()).map(x=>x.name));owner.lists.push(l={name:nm,items:[],visible:true});notes.push('added list “'+nm+'”');return l;},
    ensureSprite(name,emoji,costumes){let s=PROJ.sprites.find(x=>x.name.toLowerCase()===name.toLowerCase()&&!x.isClone);
      if(s){notes.push('reused sprite “'+s.name+'”');return s;}s=newSprite(uniqueName(name,PROJ.sprites.map(x=>x.name)),emoji,costumes);
      PROJ.sprites.push(s);notes.push('added sprite “'+s.name+'”');return s;},
    ensureMessage(m){if(!PROJ.messages.includes(m))PROJ.messages.push(m);return m;},
    addScript(target,stack,buildId,key){
      target.scripts=target.scripts||[];
      if(buildId&&target.scripts.some(s=>s._build===buildId&&s._key===key)){notes.push('skipped a duplicate script');return;}
      let maxY=10;target.scripts.forEach(s=>maxY=Math.max(maxY,s.y+140));
      target.scripts.push({id:uid('scr'),x:40,y:maxY,stack,_build:buildId,_key:key});
    }
  };
}

/* Compose an existing build inside a full-game installer (reuses tested logic). */
function runSub(id,I,cfg){const b=BUILDS.find(x=>x.id===id);if(!b)return;const saved=I.cfg;
  I.cfg=Object.assign({},defaultsFor(b),cfg||{});I.cfg.__target=I.target;
  try{b.apply(I);}catch(e){console.error('sub '+id,e);}I.cfg=saved;}

/* ======================= BUILD LIBRARY ================================= */
/* Each: id,name,desc,cat,icon,color,difficulty,tags,config?,needsSprite?,apply(I) */
const BUILDS=[
/* ========== FULL GAMES (one click → a complete, playable game) ========== */
{id:'game_platformer',name:'Platformer Adventure',cat:'Full Games',icon:'🏰',color:'#ff5a5f',difficulty:'Complete game',
 tags:['platformer','coins','jump','full game'],full:true,
 apply(I){const p=I.target;p.name=uniqueName('Hero',PROJ.sprites.filter(s=>s!==p).map(s=>s.name));
   runSub('platformcollision',I,{speed:5,jump:14,gravity:1,floor:-150});
   runSub('coins',I,{count:8,player:p.name});
   const score=I.ensureVar('score');
   I.addScript(PROJ.stage,[flag(),bk('data_setvariableto',{VAL:0},{VAR:score.name}),
     bk('control_wait_until',{COND:GT(V(score.name),7)}),bk('looks_switchbackdrop',null,{BD:'blue'})],'game_platformer','win');
   I.notes.push('Collect all 8 coins! Arrows to move, ↑ to jump onto platforms.');}},

{id:'game_collector',name:'Coin Dash',cat:'Full Games',icon:'🪙',color:'#ff5a5f',difficulty:'Complete game',
 tags:['top-down','coins','timer','full game'],full:true,
 apply(I){const p=I.target;runSub('topdown',I,{speed:5});runSub('coins',I,{count:12,player:p.name});runSub('timer',I,{secs:30});
   I.notes.push('Grab as many coins as you can before the timer runs out! WASD / arrows.');}},

{id:'game_dodge',name:'Falling Dodge',cat:'Full Games',icon:'☄️',color:'#ff5a5f',difficulty:'Complete game',
 tags:['dodge','survival','clones','full game'],full:true,
 apply(I){const p=I.target;const score=I.ensureVar('score');score.monitor=true;const over=I.ensureMessage('game over');
   const rock=I.ensureSprite('Rock','🪨');
   I.addScript(p,[flag(),bk('motion_gotoxy',{X:0,Y:-150}),bk('data_setvariableto',{VAL:0},{VAR:score.name}),
     bk('control_forever',{SUBSTACK:[
       bk('control_if',{COND:KEYD('right arrow'),SUBSTACK:[bk('motion_changexby',{DX:7})]}),
       bk('control_if',{COND:KEYD('left arrow'),SUBSTACK:[bk('motion_changexby',{DX:-7})]})]})],'game_dodge','move');
   I.addScript(p,[flag(),bk('control_forever',{SUBSTACK:[bk('control_wait',{SECS:1}),bk('data_changevariableby',{VAL:1},{VAR:score.name})]})],'game_dodge','score');
   I.addScript(rock,[flag(),bk('looks_hide'),bk('control_forever',{SUBSTACK:[bk('control_create_clone',null,{OF:'_myself_'}),bk('control_wait',{SECS:bk('operator_random',{FROM:0.4,TO:1.2})})]})],'game_dodge','spawn');
   I.addScript(rock,[bk('control_start_as_clone'),bk('motion_gotoxy',{X:bk('operator_random',{FROM:-210,TO:210}),Y:180}),bk('looks_show'),
     bk('control_repeat_until',{COND:bk('operator_or',{A:TOUCH(p.name),B:LT(bk('motion_yposition'),-175)}),SUBSTACK:[bk('motion_changeyby',{DY:-7})]}),
     bk('control_if',{COND:TOUCH(p.name),SUBSTACK:[bk('event_broadcast',null,{MSG:over})]}),bk('control_delete_clone')],'game_dodge','fall');
   I.addScript(p,[bk('event_whenbroadcast',null,{MSG:over}),bk('looks_say',{MSG:'Game Over!'}),bk('control_stop',null,{OPT:'all'})],'game_dodge','over');
   I.notes.push('Dodge the falling rocks with ← →. Your score climbs the longer you survive!');}},

{id:'game_whack',name:'Whack-a-Mole',cat:'Full Games',icon:'🔨',color:'#ff5a5f',difficulty:'Complete game',
 tags:['click','reflex','timer','full game'],full:true,
 apply(I){const score=I.ensureVar('score');score.value=0;score.monitor=true;const t=I.ensureVar('time');t.value=30;t.monitor=true;
   const mole=I.ensureSprite('Mole','🐹');const up=I.ensureMessage('times up');
   I.addScript(PROJ.stage,[flag(),bk('data_setvariableto',{VAL:0},{VAR:score.name}),bk('data_setvariableto',{VAL:30},{VAR:t.name}),
     bk('control_repeat_until',{COND:LT(V(t.name),1),SUBSTACK:[bk('control_wait',{SECS:1}),bk('data_changevariableby',{VAL:-1},{VAR:t.name})]}),bk('event_broadcast',null,{MSG:up})],'game_whack','timer');
   I.addScript(mole,[flag(),bk('control_forever',{SUBSTACK:[
     bk('motion_gotoxy',{X:bk('operator_random',{FROM:-190,TO:190}),Y:bk('operator_random',{FROM:-120,TO:120})}),
     bk('looks_show'),bk('control_wait',{SECS:bk('operator_random',{FROM:0.5,TO:1})}),bk('looks_hide'),bk('control_wait',{SECS:0.3})]})],'game_whack','pop');
   I.addScript(mole,[bk('event_whenthisspriteclicked'),bk('data_changevariableby',{VAL:1},{VAR:score.name}),bk('looks_hide')],'game_whack','hit');
   I.addScript(mole,[bk('event_whenbroadcast',null,{MSG:up}),bk('looks_hide'),bk('looks_say',{MSG:'Time!'}),bk('control_stop',null,{OPT:'all'})],'game_whack','end');
   I.notes.push('Click the mole as fast as you can before time runs out!');}},

{id:'game_flappy',name:'Flappy Bird',cat:'Full Games',icon:'🐤',color:'#ff5a5f',difficulty:'Complete game',
 tags:['flappy','gravity','pipes','full game'],full:true,
 apply(I){const p=I.target;const vy=I.ensureVar('vy','local',0);const score=I.ensureVar('score');score.monitor=true;const over=I.ensureMessage('game over');
   const pipe=I.ensureSprite('Pipe','🟩',[{name:'pipe',render:'platform'}]);
   I.addScript(p,[flag(),bk('motion_gotoxy',{X:-120,Y:0}),bk('data_setvariableto',{VAL:0},{VAR:vy.name}),bk('data_setvariableto',{VAL:0},{VAR:score.name}),
     bk('control_forever',{SUBSTACK:[bk('data_changevariableby',{VAL:-1},{VAR:vy.name}),bk('motion_changeyby',{DY:V(vy.name)}),
       bk('control_if',{COND:bk('operator_or',{A:TOUCH('_edge_'),B:TOUCH(pipe.name)}),SUBSTACK:[bk('event_broadcast',null,{MSG:over})]})]})],'game_flappy','physics');
   I.addScript(p,[bk('event_whenkeypressed',null,{KEY:'space'}),bk('data_setvariableto',{VAL:8},{VAR:vy.name})],'game_flappy','flap');
   I.addScript(pipe,[flag(),bk('looks_hide'),bk('control_forever',{SUBSTACK:[bk('control_create_clone',null,{OF:'_myself_'}),bk('control_wait',{SECS:1.6})]})],'game_flappy','spawn');
   I.addScript(pipe,[bk('control_start_as_clone'),bk('looks_setsize',{SZ:80}),bk('motion_gotoxy',{X:240,Y:bk('operator_random',{FROM:-120,TO:120})}),bk('looks_show'),
     bk('control_repeat_until',{COND:LT(bk('motion_xposition'),-240),SUBSTACK:[bk('motion_changexby',{DX:-4})]}),bk('data_changevariableby',{VAL:1},{VAR:score.name}),bk('control_delete_clone')],'game_flappy','scroll');
   I.addScript(p,[bk('event_whenbroadcast',null,{MSG:over}),bk('looks_say',{MSG:'Game Over!'}),bk('control_stop',null,{OPT:'all'})],'game_flappy','over');
   I.notes.push('Press SPACE to flap and fly through the gaps. Don’t hit the pipes!');}},

{id:'game_chase',name:'Chase Escape',cat:'Full Games',icon:'👻',color:'#ff5a5f',difficulty:'Complete game',
 tags:['maze','chase','coins','full game'],full:true,
 apply(I){const p=I.target;runSub('topdown',I,{speed:5});runSub('coins',I,{count:10,player:p.name});
   runSub('chaser',I,{player:p.name,speed:2});const hp=I.ensureVar('lives');hp.value=3;hp.monitor=true;const over=I.ensureMessage('caught');
   I.addScript(p,[flag(),bk('data_setvariableto',{VAL:3},{VAR:hp.name}),bk('control_forever',{SUBSTACK:[
     bk('control_if',{COND:TOUCH('Chaser'),SUBSTACK:[bk('data_changevariableby',{VAL:-1},{VAR:hp.name}),bk('motion_gotoxy',{X:0,Y:0}),bk('control_wait',{SECS:0.5}),
       bk('control_if',{COND:LT(V(hp.name),1),SUBSTACK:[bk('looks_say',{MSG:'Caught!'}),bk('control_stop',null,{OPT:'all'})]})]})]})],'game_chase','danger');
   I.notes.push('Collect coins while dodging the chaser — 3 lives!');}},

{id:'game_surprise',name:'Surprise Me!',cat:'Full Games',icon:'🎲',color:'#ff5a5f',difficulty:'Random game',
 tags:['random','surprise','full game'],full:true,
 apply(I){const games=['game_platformer','game_collector','game_dodge','game_whack','game_flappy','game_chase'];
   const pick=games[Math.floor(Math.random()*games.length)];const b=BUILDS.find(x=>x.id===pick);
   b.apply(I);I.notes.unshift('🎲 Built a random game: '+b.name+'!');}},

/* ---------- STARTERS / GAMES ---------- */
{id:'platformer',name:'Platformer Physics',cat:'Games',icon:'🏃',color:'#4c97ff',difficulty:'Medium',
 tags:['gravity','jump','player'],needsSprite:true,
 config:[{k:'speed',label:'Move speed',type:'num',d:6},{k:'jump',label:'Jump strength',type:'num',d:12},{k:'gravity',label:'Gravity',type:'num',d:1},{k:'floor',label:'Ground y',type:'num',d:-140}],
 apply(I){const s=I.target;const vy=I.ensureVar('vy','local',0);
   I.addScript(s,[flag(),bk('motion_gotoxy',{X:0,Y:I.cfg.floor}),bk('data_setvariableto',{VAL:0},{VAR:vy.name}),
     bk('control_forever',{SUBSTACK:[
       bk('control_if',{COND:KEYD('right arrow'),SUBSTACK:[bk('motion_changexby',{DX:I.cfg.speed}),bk('motion_pointindirection',{DIR:90})]}),
       bk('control_if',{COND:KEYD('left arrow'),SUBSTACK:[bk('motion_changexby',{DX:-I.cfg.speed}),bk('motion_pointindirection',{DIR:-90})]}),
       bk('data_changevariableby',{VAL:bk('operator_subtract',{A:0,B:I.cfg.gravity})},{VAR:vy.name}),
       bk('motion_changeyby',{DY:V(vy.name)}),
       bk('control_if',{COND:LT(bk('motion_yposition'),I.cfg.floor),SUBSTACK:[bk('motion_sety',{Y:I.cfg.floor}),bk('data_setvariableto',{VAL:0},{VAR:vy.name})]}),
       bk('control_if',{COND:AND(KEYD('up arrow'),EQ(bk('motion_yposition'),I.cfg.floor)),SUBSTACK:[bk('data_setvariableto',{VAL:I.cfg.jump},{VAR:vy.name})]})
     ]})
   ],'platformer','main');
   s.rotationStyle='left-right';}},

{id:'topdown',name:'Top-Down Movement',cat:'Games',icon:'🎮',color:'#4c97ff',difficulty:'Easy',tags:['wasd','player','movement'],needsSprite:true,
 config:[{k:'speed',label:'Speed',type:'num',d:4}],
 apply(I){const s=I.target;I.addScript(s,[flag(),bk('control_forever',{SUBSTACK:[
   bk('control_if',{COND:bk('operator_or',{A:KEYD('up arrow'),B:KEYD('w')}),SUBSTACK:[bk('motion_changeyby',{DY:I.cfg.speed})]}),
   bk('control_if',{COND:bk('operator_or',{A:KEYD('down arrow'),B:KEYD('s')}),SUBSTACK:[bk('motion_changeyby',{DY:-I.cfg.speed})]}),
   bk('control_if',{COND:bk('operator_or',{A:KEYD('left arrow'),B:KEYD('a')}),SUBSTACK:[bk('motion_changexby',{DX:-I.cfg.speed})]}),
   bk('control_if',{COND:bk('operator_or',{A:KEYD('right arrow'),B:KEYD('d')}),SUBSTACK:[bk('motion_changexby',{DX:I.cfg.speed})]})
 ]})],'topdown','main');}},

{id:'clicker',name:'Clicker Game',cat:'Games',icon:'👆',color:'#4c97ff',difficulty:'Easy',tags:['click','score'],needsSprite:true,
 apply(I){const s=I.target;const score=I.ensureVar('score');
   I.addScript(s,[bk('event_whenthisspriteclicked'),bk('data_changevariableby',{VAL:1},{VAR:score.name}),
     bk('looks_changesize',{DS:10}),bk('control_wait',{SECS:0.05}),bk('looks_changesize',{DS:-10})],'clicker','main');}},

{id:'racing',name:'Racing Car',cat:'Games',icon:'🏎️',color:'#4c97ff',difficulty:'Medium',tags:['car','turn','drive'],needsSprite:true,
 config:[{k:'accel',label:'Speed',type:'num',d:5},{k:'turn',label:'Turn rate',type:'num',d:6}],
 apply(I){const s=I.target;s.rotationStyle='all around';
   I.addScript(s,[flag(),bk('control_forever',{SUBSTACK:[
     bk('control_if',{COND:KEYD('up arrow'),SUBSTACK:[bk('motion_movesteps',{STEPS:I.cfg.accel})]}),
     bk('control_if',{COND:KEYD('down arrow'),SUBSTACK:[bk('motion_movesteps',{STEPS:-I.cfg.accel})]}),
     bk('control_if',{COND:KEYD('left arrow'),SUBSTACK:[bk('motion_turnleft',{DEG:I.cfg.turn})]}),
     bk('control_if',{COND:KEYD('right arrow'),SUBSTACK:[bk('motion_turnright',{DEG:I.cfg.turn})]}),
     bk('motion_ifonedge')
   ]})],'racing','main');}},

{id:'shooter',name:'Arcade Shooter',cat:'Games',icon:'🚀',color:'#4c97ff',difficulty:'Medium',tags:['bullets','clones','space'],needsSprite:true,
 apply(I){const bullet=I.ensureSprite('Bullet','•');
   I.addScript(I.target,[bk('event_whenkeypressed',null,{KEY:'space'}),bk('control_create_clone',null,{OF:bullet.name})],'shooter','spawn');
   I.addScript(bullet,[bk('control_start_as_clone'),bk('looks_setsize',{SZ:40}),bk('looks_show'),
     bk('motion_goto',null,{TO:I.target.name}),
     bk('control_repeat_until',{COND:bk('sensing_touching',null,{OBJ:'_edge_'}),SUBSTACK:[bk('motion_changeyby',{DY:10})]}),
     bk('control_delete_clone')],'shooter','fly');
   I.addScript(bullet,[flag(),bk('looks_hide')],'shooter','hide');}},

{id:'story',name:'Story Scene',cat:'Games',icon:'📖',color:'#4c97ff',difficulty:'Easy',tags:['dialogue','story'],needsSprite:true,
 apply(I){I.addScript(I.target,[flag(),bk('looks_sayforsecs',{MSG:'Once upon a time…',SECS:2}),
   bk('looks_sayforsecs',{MSG:'a hero began their quest.',SECS:2}),bk('looks_say',{MSG:'Press ▶ to play!'})],'story','main');}},

/* ---------- PLAYER SYSTEMS ---------- */
{id:'walk',name:'Left/Right Walk',cat:'Player',icon:'🚶',color:'#9966ff',difficulty:'Easy',tags:['move','animation'],needsSprite:true,
 config:[{k:'speed',label:'Speed',type:'num',d:5}],
 apply(I){const s=I.target;s.rotationStyle='left-right';
   I.addScript(s,[flag(),bk('control_forever',{SUBSTACK:[
     bk('control_if',{COND:KEYD('right arrow'),SUBSTACK:[bk('motion_pointindirection',{DIR:90}),bk('motion_movesteps',{STEPS:I.cfg.speed}),bk('looks_nextcostume')]}),
     bk('control_if',{COND:KEYD('left arrow'),SUBSTACK:[bk('motion_pointindirection',{DIR:-90}),bk('motion_movesteps',{STEPS:I.cfg.speed}),bk('looks_nextcostume')]})
   ]})],'walk','main');}},

{id:'jump',name:'Jump',cat:'Player',icon:'⬆️',color:'#9966ff',difficulty:'Easy',tags:['jump'],needsSprite:true,
 config:[{k:'power',label:'Jump height',type:'num',d:80},{k:'floor',label:'Ground y',type:'num',d:-120}],
 apply(I){const s=I.target;I.addScript(s,[bk('event_whenkeypressed',null,{KEY:'space'}),
   bk('control_repeat',{TIMES:10,SUBSTACK:[bk('motion_changeyby',{DY:bk('operator_divide',{A:I.cfg.power,B:10})})]}),
   bk('control_repeat',{TIMES:10,SUBSTACK:[bk('motion_changeyby',{DY:bk('operator_divide',{A:-I.cfg.power,B:10})})]}),
   bk('motion_sety',{Y:I.cfg.floor})],'jump','main');}},

{id:'doublejump',name:'Double Jump',cat:'Player',icon:'🪽',color:'#9966ff',difficulty:'Medium',tags:['jump','gravity'],needsSprite:true,
 apply(I){const s=I.target;const vy=I.ensureVar('vy','local',0);const jumps=I.ensureVar('jumps','local',0);
   I.addScript(s,[flag(),bk('control_forever',{SUBSTACK:[
     bk('data_changevariableby',{VAL:-1},{VAR:vy.name}),bk('motion_changeyby',{DY:V(vy.name)}),
     bk('control_if',{COND:LT(bk('motion_yposition'),-120),SUBSTACK:[bk('motion_sety',{Y:-120}),bk('data_setvariableto',{VAL:0},{VAR:vy.name}),bk('data_setvariableto',{VAL:2},{VAR:jumps.name})]})
   ]})],'doublejump','physics');
   I.addScript(s,[bk('event_whenkeypressed',null,{KEY:'up arrow'}),
     bk('control_if',{COND:GT(V(jumps.name),0),SUBSTACK:[bk('data_setvariableto',{VAL:11},{VAR:vy.name}),bk('data_changevariableby',{VAL:-1},{VAR:jumps.name})]})],'doublejump','jump');}},

{id:'dash',name:'Dash',cat:'Player',icon:'💨',color:'#9966ff',difficulty:'Medium',tags:['dash','speed'],needsSprite:true,
 apply(I){I.addScript(I.target,[bk('event_whenkeypressed',null,{KEY:'shift'}),
   bk('control_repeat',{TIMES:6,SUBSTACK:[bk('motion_movesteps',{STEPS:15}),bk('looks_changeeffect',{V:25},{EF:'ghost'})]}),
   bk('looks_cleareffects')],'dash','main');}},

{id:'health',name:'Health System',cat:'Player',icon:'❤️',color:'#9966ff',difficulty:'Easy',tags:['health','damage'],needsSprite:true,
 config:[{k:'max',label:'Max health',type:'num',d:100},{k:'enemy',label:'Damaged by',type:'sprite'}],
 apply(I){const s=I.target;const hp=I.ensureVar('health');hp.value=I.cfg.max;hp.monitor=true;const gm=I.ensureMessage('game over');
   I.addScript(s,[flag(),bk('data_setvariableto',{VAL:I.cfg.max},{VAR:hp.name}),bk('data_showvariable',null,{VAR:hp.name})],'health','init');
   const enemy=I.cfg.enemy&&I.cfg.enemy!=='(none)'?I.cfg.enemy:'_edge_';
   I.addScript(s,[flag(),bk('control_forever',{SUBSTACK:[
     bk('control_if',{COND:TOUCH(enemy),SUBSTACK:[bk('data_changevariableby',{VAL:-1},{VAR:hp.name}),
       bk('control_if',{COND:LT(V(hp.name),1),SUBSTACK:[bk('event_broadcast',null,{MSG:gm})]}),bk('control_wait',{SECS:0.3})]})
   ]})],'health','damage');
   I.addScript(s,[bk('event_whenbroadcast',null,{MSG:gm}),bk('looks_say',{MSG:'Game Over!'}),bk('control_stop',null,{OPT:'all'})],'health','over');}},

{id:'lives',name:'Lives',cat:'Player',icon:'🩶',color:'#9966ff',difficulty:'Easy',tags:['lives','respawn'],needsSprite:true,
 config:[{k:'count',label:'Starting lives',type:'num',d:3}],
 apply(I){const s=I.target;const lv=I.ensureVar('lives');lv.value=I.cfg.count;lv.monitor=true;const lose=I.ensureMessage('lose life');
   I.addScript(s,[flag(),bk('data_setvariableto',{VAL:I.cfg.count},{VAR:lv.name})],'lives','init');
   I.addScript(s,[bk('event_whenbroadcast',null,{MSG:lose}),bk('data_changevariableby',{VAL:-1},{VAR:lv.name}),
     bk('motion_gotoxy',{X:0,Y:0}),bk('control_if',{COND:LT(V(lv.name),1),SUBSTACK:[bk('looks_say',{MSG:'Game Over'}),bk('control_stop',null,{OPT:'all'})]})],'lives','lose');}},

{id:'platformcollision',name:'Platform Collision',cat:'Player',icon:'🧱',color:'#9966ff',difficulty:'Medium',
 tags:['collision','platform','gravity'],needsSprite:true,
 config:[{k:'speed',label:'Move speed',type:'num',d:5},{k:'jump',label:'Jump strength',type:'num',d:13},{k:'gravity',label:'Gravity',type:'num',d:1},{k:'floor',label:'Ground y',type:'num',d:-150}],
 apply(I){const s=I.target;const vy=I.ensureVar('vy','local',0);
   const plat=I.ensureSprite('Platform','🟩',[{name:'plat',render:'platform'}]);
   I.addScript(plat,[flag(),bk('looks_hide'),bk('control_create_clone',null,{OF:'_myself_'}),bk('control_create_clone',null,{OF:'_myself_'}),bk('control_create_clone',null,{OF:'_myself_'})],'platformcollision','spawn');
   I.addScript(plat,[bk('control_start_as_clone'),bk('looks_show'),bk('motion_gotoxy',{X:bk('operator_random',{FROM:-180,TO:180}),Y:bk('operator_random',{FROM:-90,TO:70})})],'platformcollision','place');
   I.addScript(s,[flag(),bk('control_forever',{SUBSTACK:[
     bk('control_if',{COND:KEYD('right arrow'),SUBSTACK:[bk('motion_changexby',{DX:I.cfg.speed}),bk('motion_pointindirection',{DIR:90})]}),
     bk('control_if',{COND:KEYD('left arrow'),SUBSTACK:[bk('motion_changexby',{DX:-I.cfg.speed}),bk('motion_pointindirection',{DIR:-90})]}),
     bk('data_changevariableby',{VAL:-I.cfg.gravity},{VAR:vy.name}),
     bk('motion_changeyby',{DY:V(vy.name)}),
     bk('control_if',{COND:AND(LT(V(vy.name),1),TOUCH(plat.name)),SUBSTACK:[
       bk('control_repeat',{TIMES:14,SUBSTACK:[bk('control_if',{COND:TOUCH(plat.name),SUBSTACK:[bk('motion_changeyby',{DY:1})]})]}),
       bk('data_setvariableto',{VAL:0},{VAR:vy.name})]}),
     bk('control_if',{COND:LT(bk('motion_yposition'),I.cfg.floor),SUBSTACK:[bk('motion_sety',{Y:I.cfg.floor}),bk('data_setvariableto',{VAL:0},{VAR:vy.name})]}),
     bk('control_if',{COND:AND(KEYD('up arrow'),bk('operator_or',{A:TOUCH(plat.name),B:EQ(bk('motion_yposition'),I.cfg.floor)})),SUBSTACK:[bk('data_setvariableto',{VAL:I.cfg.jump},{VAR:vy.name})]})
   ]})],'platformcollision','physics');
   s.rotationStyle='left-right';
   I.notes.push('Player falls onto green Platform tiles and the ground; ↑ to jump.');}},

{id:'solidwall',name:'Solid Walls',cat:'Systems',icon:'🚧',color:'#ffab19',difficulty:'Medium',
 tags:['collision','wall','solid'],needsSprite:true,
 config:[{k:'wall',label:'Solid sprite',type:'sprite'},{k:'speed',label:'Move speed',type:'num',d:4}],
 apply(I){const s=I.target;const px=I.ensureVar('prev x','local',0),py=I.ensureVar('prev y','local',0);const wall=I.cfg.wall&&I.cfg.wall!=='(none)'?I.cfg.wall:I.ensureSprite('Wall','🧱').name;
   I.addScript(s,[flag(),bk('control_forever',{SUBSTACK:[
     bk('data_setvariableto',{VAL:bk('motion_xposition')},{VAR:px.name}),
     bk('data_setvariableto',{VAL:bk('motion_yposition')},{VAR:py.name}),
     bk('control_if',{COND:KEYD('right arrow'),SUBSTACK:[bk('motion_changexby',{DX:I.cfg.speed})]}),
     bk('control_if',{COND:KEYD('left arrow'),SUBSTACK:[bk('motion_changexby',{DX:-I.cfg.speed})]}),
     bk('control_if',{COND:KEYD('up arrow'),SUBSTACK:[bk('motion_changeyby',{DY:I.cfg.speed})]}),
     bk('control_if',{COND:KEYD('down arrow'),SUBSTACK:[bk('motion_changeyby',{DY:-I.cfg.speed})]}),
     bk('control_if',{COND:TOUCH(wall),SUBSTACK:[bk('motion_gotoxy',{X:V(px.name),Y:V(py.name)})]})
   ]})],'solidwall','main');
   I.notes.push('Sprite is blocked from passing through the solid sprite.');}},

/* ---------- GAME SYSTEMS ---------- */
{id:'coins',name:'Coin Collector',cat:'Systems',icon:'🪙',color:'#ffab19',difficulty:'Easy',tags:['coins','score','clones'],
 config:[{k:'count',label:'How many coins',type:'num',d:6},{k:'player',label:'Collected by',type:'sprite'}],
 apply(I){const score=I.ensureVar('score');score.monitor=true;const coin=I.ensureSprite('Coin','🪙');const player=I.cfg.player||I.target.name;
   I.addScript(coin,[flag(),bk('looks_hide'),bk('control_repeat',{TIMES:I.cfg.count,SUBSTACK:[bk('control_create_clone',null,{OF:'_myself_'})]})],'coins','spawn');
   I.addScript(coin,[bk('control_start_as_clone'),bk('motion_gotoxy',{X:bk('operator_random',{FROM:-210,TO:210}),Y:bk('operator_random',{FROM:-150,TO:150})}),bk('looks_show'),
     bk('control_wait_until',{COND:TOUCH(player)}),bk('data_changevariableby',{VAL:1},{VAR:score.name}),bk('control_delete_clone')],'coins','collect');}},

{id:'score',name:'Score',cat:'Systems',icon:'🎯',color:'#ffab19',difficulty:'Easy',tags:['score','points'],
 apply(I){const score=I.ensureVar('score');score.value=0;score.monitor=true;
   I.addScript(PROJ.stage,[flag(),bk('data_setvariableto',{VAL:0},{VAR:score.name}),bk('data_showvariable',null,{VAR:score.name})],'score','init');
   I.notes.push('Use “change score by 1” anywhere to add points.');}},

{id:'timer',name:'Countdown Timer',cat:'Systems',icon:'⏱️',color:'#ffab19',difficulty:'Easy',tags:['timer','countdown'],
 config:[{k:'secs',label:'Seconds',type:'num',d:30}],
 apply(I){const t=I.ensureVar('time');t.value=I.cfg.secs;t.monitor=true;const up=I.ensureMessage('time up');
   I.addScript(PROJ.stage,[flag(),bk('data_setvariableto',{VAL:I.cfg.secs},{VAR:t.name}),bk('data_showvariable',null,{VAR:t.name}),
     bk('control_repeat_until',{COND:LT(V(t.name),1),SUBSTACK:[bk('control_wait',{SECS:1}),bk('data_changevariableby',{VAL:-1},{VAR:t.name})]}),
     bk('event_broadcast',null,{MSG:up})],'timer','count');}},

{id:'checkpoint',name:'Checkpoint',cat:'Systems',icon:'🚩',color:'#ffab19',difficulty:'Medium',tags:['checkpoint','respawn'],needsSprite:true,
 apply(I){const s=I.target;const cx=I.ensureVar('spawn x','local',0),cy=I.ensureVar('spawn y','local',0);const flagS=I.ensureSprite('Checkpoint','🚩');
   I.addScript(s,[flag(),bk('control_forever',{SUBSTACK:[bk('control_if',{COND:TOUCH(flagS.name),SUBSTACK:[
     bk('data_setvariableto',{VAL:bk('motion_xposition')},{VAR:cx.name}),bk('data_setvariableto',{VAL:bk('motion_yposition')},{VAR:cy.name})]})]})],'checkpoint','set');
   I.notes.push('Broadcast or go to (spawn x, spawn y) to respawn at the checkpoint.');}},

{id:'levels',name:'Levels',cat:'Systems',icon:'🗺️',color:'#ffab19',difficulty:'Medium',tags:['level','progress'],
 apply(I){const lvl=I.ensureVar('level');lvl.value=1;lvl.monitor=true;const nx=I.ensureMessage('next level');
   I.addScript(PROJ.stage,[flag(),bk('data_setvariableto',{VAL:1},{VAR:lvl.name})],'levels','init');
   I.addScript(PROJ.stage,[bk('event_whenbroadcast',null,{MSG:nx}),bk('data_changevariableby',{VAL:1},{VAR:lvl.name}),
     bk('looks_nextbackdrop')],'levels','advance');}},

{id:'inventory',name:'Inventory',cat:'Systems',icon:'🎒',color:'#ffab19',difficulty:'Medium',tags:['list','items'],
 apply(I){const inv=I.ensureList('inventory');inv.visible=true;const add=I.ensureMessage('pick up item');
   I.addScript(PROJ.stage,[bk('event_whenbroadcast',null,{MSG:add}),bk('data_addtolist',{ITEM:'apple'},{LIST:inv.name})],'inventory','add');
   I.notes.push('Broadcast “pick up item” to add to the inventory list.');}},

{id:'shop',name:'Simple Shop',cat:'Systems',icon:'🛒',color:'#ffab19',difficulty:'Hard',tags:['coins','buy'],needsSprite:true,
 apply(I){const coins=I.ensureVar('coins');coins.value=10;coins.monitor=true;
   I.addScript(I.target,[bk('event_whenthisspriteclicked'),bk('control_if_else',{COND:GT(V(coins.name),4),
     SUBSTACK:[bk('data_changevariableby',{VAL:-5},{VAR:coins.name}),bk('looks_say',{MSG:'Purchased!'})],
     SUBSTACK2:[bk('looks_sayforsecs',{MSG:'Not enough coins',SECS:1})]})],'shop','buy');}},

{id:'save',name:'Save Best Score',cat:'Systems',icon:'💾',color:'#ffab19',difficulty:'Medium',tags:['save','highscore'],
 apply(I){const score=I.ensureVar('score');const best=I.ensureVar('best score');best.monitor=true;const sv=I.ensureMessage('save');
   I.addScript(PROJ.stage,[bk('event_whenbroadcast',null,{MSG:sv}),bk('control_if',{COND:GT(V(score.name),V(best.name)),
     SUBSTACK:[bk('data_setvariableto',{VAL:V(score.name)},{VAR:best.name})]})],'save','main');
   I.notes.push('Best score persists via autosave. Broadcast “save” to record it.');}},

/* ---------- ENEMIES ---------- */
{id:'enemy',name:'Basic Enemy',cat:'Enemies',icon:'👾',color:'#ff661a',difficulty:'Easy',tags:['enemy'],
 config:[{k:'player',label:'Attacks',type:'sprite'}],
 apply(I){const e=I.ensureSprite('Enemy','👾');const hit=I.ensureMessage('lose life');const player=I.cfg.player||currentSprite().name;
   I.addScript(e,[flag(),bk('control_forever',{SUBSTACK:[bk('motion_movesteps',{STEPS:3}),bk('motion_ifonedge'),
     bk('control_if',{COND:TOUCH(player),SUBSTACK:[bk('event_broadcast',null,{MSG:hit})]})]})],'enemy','main');}},

{id:'patrol',name:'Patrol Enemy',cat:'Enemies',icon:'🚔',color:'#ff661a',difficulty:'Medium',tags:['enemy','patrol'],
 apply(I){const e=I.ensureSprite('Guard','🤖');e.rotationStyle='left-right';
   I.addScript(e,[flag(),bk('control_forever',{SUBSTACK:[bk('motion_movesteps',{STEPS:3}),
     bk('control_if',{COND:bk('sensing_touching',null,{OBJ:'_edge_'}),SUBSTACK:[bk('motion_turnright',{DEG:180})]})]})],'patrol','main');}},

{id:'chaser',name:'Chasing Enemy',cat:'Enemies',icon:'🧟',color:'#ff661a',difficulty:'Medium',tags:['enemy','chase','ai'],
 config:[{k:'player',label:'Chases',type:'sprite'},{k:'speed',label:'Speed',type:'num',d:2}],
 apply(I){const e=I.ensureSprite('Chaser','🧟');const player=I.cfg.player||currentSprite().name;
   I.addScript(e,[flag(),bk('control_forever',{SUBSTACK:[bk('motion_pointtowards',null,{TO:player}),bk('motion_movesteps',{STEPS:I.cfg.speed})]})],'chaser','main');}},

{id:'damage',name:'Damage + I-Frames',cat:'Enemies',icon:'⚡',color:'#ff661a',difficulty:'Hard',tags:['damage','invincible'],needsSprite:true,
 config:[{k:'enemy',label:'Enemy',type:'sprite'}],
 apply(I){const s=I.target;const hp=I.ensureVar('health');const enemy=I.cfg.enemy||'Enemy';
   I.addScript(s,[flag(),bk('control_forever',{SUBSTACK:[bk('control_if',{COND:TOUCH(enemy),SUBSTACK:[
     bk('data_changevariableby',{VAL:-10},{VAR:hp.name}),bk('control_repeat',{TIMES:4,SUBSTACK:[bk('looks_seteffect',{V:50},{EF:'ghost'}),bk('control_wait',{SECS:0.1}),bk('looks_seteffect',{V:0},{EF:'ghost'}),bk('control_wait',{SECS:0.1})]})]})]})],'damage','main');}},

/* ---------- UI ---------- */
{id:'startmenu',name:'Start Menu',cat:'UI',icon:'🎬',color:'#5cb1d6',difficulty:'Easy',tags:['menu','start'],
 apply(I){const started=I.ensureMessage('start game');
   I.addScript(PROJ.stage,[flag(),bk('looks_switchbackdrop',null,{BD:PROJ.stage.costumes[0].name})],'startmenu','bd');
   I.addScript(I.target,[flag(),bk('looks_say',{MSG:'Press SPACE to start'})],'startmenu','prompt');
   I.addScript(I.target,[bk('event_whenkeypressed',null,{KEY:'space'}),bk('looks_say',{MSG:''}),bk('event_broadcast',null,{MSG:started})],'startmenu','go');}},

{id:'pause',name:'Pause Menu',cat:'UI',icon:'⏸️',color:'#5cb1d6',difficulty:'Medium',tags:['pause'],
 apply(I){const p=I.ensureVar('paused');
   I.addScript(PROJ.stage,[bk('event_whenkeypressed',null,{KEY:'p'}),bk('control_if_else',{COND:EQ(V(p.name),0),
     SUBSTACK:[bk('data_setvariableto',{VAL:1},{VAR:p.name})],SUBSTACK2:[bk('data_setvariableto',{VAL:0},{VAR:p.name})]})],'pause','toggle');
   I.notes.push('Wrap game loops in: if <paused = 0> … to respect pausing.');}},

{id:'healthbar',name:'Health Bar',cat:'UI',icon:'🟩',color:'#5cb1d6',difficulty:'Medium',tags:['health','bar'],
 apply(I){const hp=I.ensureVar('health');const bar=I.ensureSprite('HealthBar','🟩');
   I.addScript(bar,[flag(),bk('motion_gotoxy',{X:-150,Y:150}),bk('control_forever',{SUBSTACK:[
     bk('looks_setsize',{SZ:bk('operator_add',{A:20,B:V(hp.name)})})]})],'healthbar','main');}},

{id:'dialogue',name:'Dialogue Box',cat:'UI',icon:'💬',color:'#5cb1d6',difficulty:'Easy',tags:['dialogue','text'],needsSprite:true,
 apply(I){I.addScript(I.target,[bk('event_whenthisspriteclicked'),bk('looks_sayforsecs',{MSG:'Hello, traveler!',SECS:2}),
   bk('looks_sayforsecs',{MSG:'Welcome to my world.',SECS:2}),bk('looks_say',{MSG:''})],'dialogue','main');}},

/* ---------- EFFECTS ---------- */
{id:'shake',name:'Screen Shake',cat:'Effects',icon:'📳',color:'#59c059',difficulty:'Easy',tags:['juice','shake'],needsSprite:true,
 apply(I){const shake=I.ensureMessage('shake');
   I.addScript(I.target,[bk('event_whenbroadcast',null,{MSG:shake}),bk('control_repeat',{TIMES:8,SUBSTACK:[
     bk('motion_changexby',{DX:bk('operator_random',{FROM:-8,TO:8})}),bk('motion_changeyby',{DY:bk('operator_random',{FROM:-8,TO:8})}),bk('control_wait',{SECS:0.02})]})],'shake','main');
   I.notes.push('Broadcast “shake” for a quick screen-shake.');}},

{id:'particles',name:'Particle Burst',cat:'Effects',icon:'✨',color:'#59c059',difficulty:'Medium',tags:['particles','clones'],
 apply(I){const p=I.ensureSprite('Particle','✨');const burst=I.ensureMessage('burst');
   I.addScript(p,[flag(),bk('looks_hide')],'particles','hide');
   I.addScript(p,[bk('event_whenbroadcast',null,{MSG:burst}),bk('control_repeat',{TIMES:12,SUBSTACK:[bk('control_create_clone',null,{OF:'_myself_'})]})],'particles','spawn');
   I.addScript(p,[bk('control_start_as_clone'),bk('looks_show'),bk('motion_pointindirection',{DIR:bk('operator_random',{FROM:-180,TO:180})}),
     bk('control_repeat',{TIMES:12,SUBSTACK:[bk('motion_movesteps',{STEPS:8}),bk('looks_changeeffect',{V:10},{EF:'ghost'})]}),bk('control_delete_clone')],'particles','fly');
   I.notes.push('Broadcast “burst” to emit particles from the Particle sprite.');}},

{id:'flash',name:'Flash Effect',cat:'Effects',icon:'⚡',color:'#59c059',difficulty:'Easy',tags:['flash','hit'],needsSprite:true,
 apply(I){const fl=I.ensureMessage('flash');
   I.addScript(I.target,[bk('event_whenbroadcast',null,{MSG:fl}),bk('control_repeat',{TIMES:3,SUBSTACK:[
     bk('looks_seteffect',{V:100},{EF:'brightness'}),bk('control_wait',{SECS:0.05}),bk('looks_seteffect',{V:0},{EF:'brightness'}),bk('control_wait',{SECS:0.05})]})],'flash','main');}},

{id:'anim',name:'Costume Animation',cat:'Effects',icon:'🎞️',color:'#59c059',difficulty:'Easy',tags:['animation','costume'],needsSprite:true,
 config:[{k:'speed',label:'Frame delay (s)',type:'num',d:0.15}],
 apply(I){I.addScript(I.target,[flag(),bk('control_forever',{SUBSTACK:[bk('looks_nextcostume'),bk('control_wait',{SECS:I.cfg.speed})]})],'anim','main');}}
];

/* MY BUILDS (saved by user) load from storage */
let MYBUILDS=[];
try{MYBUILDS=JSON.parse(LS.get('bloq.mybuilds')||'[]');}catch(e){}
function saveMyBuild(){const name=prompt('Name this Build (saves the current sprite’s scripts + its variables):','My System');if(!name)return;
  const s=currentSprite();const b={id:'my_'+uid(),name,cat:'My Builds',icon:'⭐',color:'#ff6680',difficulty:'—',tags:['mine'],mine:true,
    data:{scripts:JSON.parse(JSON.stringify(s.scripts)),vars:s.variables.map(v=>({name:v.name,value:v.value}))}};
  MYBUILDS.push(b);LS.set('bloq.mybuilds',JSON.stringify(MYBUILDS));toast('Saved “'+name+'” to My Builds');renderBuilds();}
function applyMyBuild(b,I){b.data.vars.forEach(v=>I.ensureVar(v.name,'local',v.value));
  b.data.scripts.forEach(scr=>{const copy=JSON.parse(JSON.stringify(scr.stack),(k,v)=>k==='id'?uid():v);I.addScript(I.target,copy,b.id,uid());});}

/* ======================= BUILDS UI ==================================== */
let BUILD_FILTER='Full Games';
function allBuilds(){return [...BUILDS,...MYBUILDS];}
function openBuilds(){renderBuilds();openOverlay('buildsOverlay');}
function renderBuilds(){
  const cats=['Full Games','All','Games','Player','Systems','Enemies','UI','Effects',...(MYBUILDS.length?['My Builds']:[])];
  const f=$('#buildsFilter');f.innerHTML='';
  cats.forEach(c=>{const b=document.createElement('button');b.className='chip'+(c===BUILD_FILTER?' on':'');b.textContent=c;b.onclick=()=>{BUILD_FILTER=c;renderBuilds();};f.appendChild(b);});
  const save=document.createElement('button');save.className='chip';save.style.marginLeft='auto';save.textContent='⭐ Save current as Build';save.onclick=saveMyBuild;f.appendChild(save);
  const grid=$('#buildsGrid');grid.innerHTML='';
  allBuilds().filter(b=>BUILD_FILTER==='All'||b.cat===BUILD_FILTER).forEach(b=>grid.appendChild(buildCard(b)));
}
function buildCard(b){const card=document.createElement('div');card.className='build-card';
  card.innerHTML=`<div class="build-prev" style="background:${hexA(b.color,0.16)};color:${b.color}"><span>${b.icon}</span><span class="diff">${b.difficulty}</span></div>
    <div class="build-info"><h3>${escapeHtml(b.name)}</h3><p>${escapeHtml(b.desc||buildBlurb(b))}</p>
    <div class="build-tags">${(b.tags||[]).map(t=>`<span>#${t}</span>`).join('')}</div>
    <div class="build-actions"><button class="prev">Preview</button><button class="add">＋ Add to Project</button></div></div>`;
  card.querySelector('.add').onclick=()=>startAdd(b);
  card.querySelector('.prev').onclick=()=>previewBuild(b);
  return card;}
function buildBlurb(b){const map={
  game_platformer:'A whole platformer: run, jump between platforms, and collect all 8 coins to win.',
  game_collector:'Race the clock — grab as many coins as you can in 30 seconds.',
  game_dodge:'Dodge falling rocks left and right; survive as long as you can.',
  game_whack:'Moles pop up around the stage — click them fast before time runs out.',
  game_flappy:'Tap SPACE to flap through scrolling pipes without crashing.',
  game_chase:'Collect coins in a maze while a chaser hunts you — 3 lives.',
  game_surprise:'Feeling lucky? Instantly builds one complete random game.',
  platformer:'Gravity, walking and jumping with a solid floor — a full side-scroller base.',
  platformcollision:'Gravity plus real landing on platform tiles and the ground, with jump.',
  solidwall:'Blocks your sprite from walking through a chosen solid sprite.',
  topdown:'Move in 4 directions with WASD or arrow keys.',clicker:'Click the sprite to score points with a bounce.',
  health:'A health variable that drops on contact and ends the game at zero.',coins:'Scatters collectible coins that add to your score.',timer:'A countdown that broadcasts when time runs out.'};
  return map[b.id]||('A ready-made '+b.cat.toLowerCase()+' system: '+(b.tags||[]).join(', ')+'.');}
function hexA(hex,a){const n=parseInt(hex.slice(1),16);return`rgba(${n>>16&255},${n>>8&255},${n&255},${a})`;}

/* Preview: temporarily install into a scratch copy, run, then let user keep/undo */
function previewBuild(b){toast('Previewing “'+b.name+'” — added & running. Undo (Ctrl+Z) to remove.');
  doInstall(b,{},true);closeOverlay('buildsOverlay');setTimeout(()=>greenFlag(),150);}

function startAdd(b){
  const needSprite=b.needsSprite||(b.config||[]).some(c=>c.type==='sprite');
  const cfg=(b.config||[]);
  if(cfg.length){openConfig(b);}
  else{doInstall(b,{});closeOverlay('buildsOverlay');}
}
function openConfig(b){
  $('#cfgTitle').textContent='Configure — '+b.name;$('#cfgSub').textContent=b.desc||buildBlurb(b);
  const body=$('#cfgBody');body.innerHTML='';
  const sprites=PROJ.sprites.filter(s=>!s.isClone).map(s=>s.name);
  (b.config||[]).forEach(c=>{
    const row=document.createElement('div');row.className='cfg-row';
    const left=document.createElement('div');left.innerHTML=`<div class="cl">${escapeHtml(c.label)}</div>`;
    row.appendChild(left);let input;
    if(c.type==='num'){input=document.createElement('input');input.type='number';input.value=c.d;}
    else if(c.type==='toggle'){input=document.createElement('button');input.className='switch'+(c.d?' on':'');input.innerHTML='<b></b>';input.dataset.on=c.d?'1':'';input.onclick=()=>{input.classList.toggle('on');input.dataset.on=input.classList.contains('on')?'1':'';};}
    else if(c.type==='sprite'){input=document.createElement('select');const opts=(b.needsSprite?[]:['(none)']).concat(sprites);opts.forEach(o=>{const op=document.createElement('option');op.value=o;op.textContent=o;input.appendChild(op);});input.value=c.k==='player'||c.k==='enemy'?(sprites.find(x=>x!==currentSprite().name)||sprites[0]):currentSprite().name;}
    else{input=document.createElement('input');input.type='text';input.value=c.d||'';}
    input.dataset.k=c.k;input.dataset.type=c.type;row.appendChild(input);body.appendChild(row);
  });
  if(b.needsSprite){const row=document.createElement('div');row.className='cfg-row';
    row.innerHTML='<div><div class="cl">Add to which sprite?</div><div class="cd">The build’s scripts go here</div></div>';
    const sel=document.createElement('select');sel.id='cfgTarget';sprites.forEach(o=>{const op=document.createElement('option');op.value=o;op.textContent=o;sel.appendChild(op);});sel.value=currentSprite().name;row.appendChild(sel);body.appendChild(row);}
  $('#cfgAdd').onclick=()=>{const cfg={};$$('#cfgBody [data-k]').forEach(el=>{const t=el.dataset.type;cfg[el.dataset.k]=t==='num'?toNum(el.value):t==='toggle'?!!el.dataset.on:el.value;});
    const tsel=$('#cfgTarget');const targetName=tsel?tsel.value:null;doInstall(b,cfg,false,targetName);closeOverlay('cfgOverlay');closeOverlay('buildsOverlay');};
  openOverlay('cfgOverlay');
}
$('#cfgClose').onclick=$('#cfgCancel').onclick=()=>closeOverlay('cfgOverlay');

function doInstall(b,cfg,isPreview,targetName){
  pushUndo();
  if(targetName){const s=PROJ.sprites.find(x=>x.name===targetName);if(s)PROJ.currentSprite=s.id;}
  cfg=Object.assign({},defaultsFor(b),cfg);cfg.__target=b.needsSprite?currentSprite():currentSprite();
  const I=makeInstaller(cfg);
  try{ if(b.mine)applyMyBuild(b,I); else b.apply(I); }
  catch(e){console.error(e);toast('Build error: '+e.message);return;}
  fullRender();autosave();
  const n=I.notes.length;toast('✓ '+b.name+' added'+(n?(' — '+I.notes[0]):''));
  if(I.notes.length>1)setTimeout(()=>toast(I.notes.slice(1,3).join(' · ')),1400);
}
function defaultsFor(b){const o={};(b.config||[]).forEach(c=>o[c.k]=c.d);return o;}

/* ======================= COMMAND PALETTE (Ctrl+K) ===================== */
let cmdSel=0,cmdItems=[];
function openCmd(){$('#cmdInput').value='';buildCmd('');openOverlay('cmdOverlay');setTimeout(()=>$('#cmdInput').focus(),30);}
$('#cmdInput').addEventListener('input',e=>buildCmd(e.target.value));
$('#cmdInput').addEventListener('keydown',e=>{
  if(e.key==='ArrowDown'){e.preventDefault();cmdSel=Math.min(cmdItems.length-1,cmdSel+1);paintCmd();}
  else if(e.key==='ArrowUp'){e.preventDefault();cmdSel=Math.max(0,cmdSel-1);paintCmd();}
  else if(e.key==='Enter'){e.preventDefault();if(cmdItems[cmdSel])cmdItems[cmdSel].run();}
});
function buildCmd(q){
  q=q.toLowerCase().trim();
  const actions=[
    {icon:'⚑',main:'Run project',sub:'Green flag',tag:'action',run:()=>{closeOverlay('cmdOverlay');greenFlag();}},
    {icon:'⬛',main:'Stop everything',sub:'Halt all scripts',tag:'action',run:()=>{closeOverlay('cmdOverlay');stopEverything();}},
    {icon:'✚',main:'Make a variable',sub:'New variable',tag:'action',run:()=>{closeOverlay('cmdOverlay');makeVariable();}},
    {icon:'🐾',main:'Add a sprite',sub:'New sprite',tag:'action',run:()=>{closeOverlay('cmdOverlay');addSprite();}},
    {icon:'✦',main:'Open Builds & Games',sub:'complete games and systems',tag:'action',run:()=>{closeOverlay('cmdOverlay');openBuilds();}},
    {icon:'⬇',main:'Export project',sub:'Download .json',tag:'action',run:()=>{closeOverlay('cmdOverlay');exportProject();}}
  ];
  const buildItems=allBuilds().map(b=>({icon:b.icon,main:'Add '+b.name,sub:b.cat+' · '+(b.tags||[]).join(', '),tag:'build',
    run:()=>{closeOverlay('cmdOverlay');startAdd(b);}}));
  let all=[...actions,...buildItems];
  if(q){all=all.filter(x=>(x.main+' '+x.sub).toLowerCase().includes(q));
    // fuzzy verbs
    if(q.includes('health'))all.unshift(cmdFor('health'));if(q.includes('platform'))all.unshift(cmdFor('platformer'));
    if(q.includes('coin'))all.unshift(cmdFor('coins'));if(q.includes('move')||q.includes('movement'))all.unshift(cmdFor('walk'));
    if(q.includes('enemy'))all.unshift(cmdFor('enemy'));if(q.includes('timer'))all.unshift(cmdFor('timer'));
    all=dedupe(all);}
  cmdItems=all.slice(0,10);cmdSel=0;paintCmd();
}
function cmdFor(id){const b=BUILDS.find(x=>x.id===id);return{icon:b.icon,main:'Add '+b.name,sub:b.cat+' · '+(b.tags||[]).join(', '),tag:'build',run:()=>{closeOverlay('cmdOverlay');startAdd(b);}};}
function dedupe(arr){const seen=new Set();return arr.filter(x=>{if(seen.has(x.main))return false;seen.add(x.main);return true;});}
function paintCmd(){const box=$('#cmdResults');box.innerHTML='';
  if(!cmdItems.length){box.innerHTML='<div class="empty-note">No matches. Try “add coins” or “create a platformer”.</div>';return;}
  cmdItems.forEach((it,i)=>{const d=document.createElement('div');d.className='res'+(i===cmdSel?' sel':'');
    d.innerHTML=`<div class="r-ico">${it.icon}</div><div><div class="r-main">${escapeHtml(it.main)}</div><div class="r-sub">${escapeHtml(it.sub)}</div></div><div class="r-tag">${it.tag}</div>`;
    d.onmouseenter=()=>{cmdSel=i;paintCmd();};d.onclick=()=>it.run();box.appendChild(d);});
}

/* ======================= SMART HELP =================================== */
let helpDismissed=new Set();
function maybeSmartHelp(){
  if(MODE==='beginner'===false&&Math.random()>0.5)return; // low-frequency, non-intrusive
  const s=currentSprite();const ops=new Set();collectOps(s.scripts,ops);
  let sug=null;
  const hasMove=[...ops].some(o=>o.startsWith('motion_move')||o==='motion_changexby'||o==='motion_changeyby');
  const movementHat=[...ops].some(o=>o==='event_whenkeypressed'||o==='sensing_keypressed');
  if(ops.size&&!hasMove&&!movementHat&&!helpDismissed.has('move'))sug={key:'move',title:'Add movement?',body:'Your sprite has scripts but can’t move yet.',build:'walk'};
  else if(allVars(s).some(v=>/coin/i.test(v.name))&&!allVars(s).some(v=>/score/i.test(v.name))&&!helpDismissed.has('score'))sug={key:'score',title:'Track a score?',body:'You have coins but no score yet.',build:'score'};
  else if(PROJ.sprites.some(x=>/enemy|chaser|guard/i.test(x.name))&&!allVars(s).some(v=>/health/i.test(v.name))&&!helpDismissed.has('health'))sug={key:'health',title:'Add health?',body:'There’s an enemy but the player has no health.',build:'health'};
  const bubble=$('#helpBubble');
  if(!sug){bubble.classList.remove('on');return;}
  bubble.innerHTML=`<h4>${sug.title}</h4><p>${sug.body}</p><div class="ha"><button class="dismiss">Not now</button><button class="go">Add it</button></div>`;
  bubble.querySelector('.go').onclick=()=>{bubble.classList.remove('on');const b=BUILDS.find(x=>x.id===sug.build);startAdd(b);};
  bubble.querySelector('.dismiss').onclick=()=>{helpDismissed.add(sug.key);bubble.classList.remove('on');};
  bubble.classList.add('on');
}
function collectOps(scripts,set){(scripts||[]).forEach(scr=>walkOps(scr.stack,set));}
function walkOps(stack,set){stack.forEach(b=>{set.add(b.op);for(const k in b.inputs){const v=b.inputs[k];if(Array.isArray(v))walkOps(v,set);else if(v&&typeof v==='object'&&v.op)set.add(v.op);}});}

/* ======================= DEMO PROJECT + INIT ========================== */
function demoProject(){
  const p=blankProject();const dog=p.sprites[0];
  dog.x=-40;dog.y=-120;dog.rotationStyle='left-right';
  const score={name:'score',value:0,visible:true,monitor:true};p.stage.variables.push(score);
  dog.scripts=[
    {id:uid('scr'),x:40,y:30,stack:[bk('event_whenflagclicked'),bk('motion_gotoxy',{X:-40,Y:-120}),bk('looks_sayforsecs',{MSG:'Use ← → to walk, ↑ to woof!',SECS:2})]},
    {id:uid('scr'),x:40,y:210,stack:[bk('event_whenflagclicked'),bk('control_forever',{SUBSTACK:[
      bk('control_if',{COND:KEYD('right arrow'),SUBSTACK:[bk('motion_pointindirection',{DIR:90}),bk('motion_movesteps',{STEPS:5}),bk('looks_nextcostume')]}),
      bk('control_if',{COND:KEYD('left arrow'),SUBSTACK:[bk('motion_pointindirection',{DIR:-90}),bk('motion_movesteps',{STEPS:5}),bk('looks_nextcostume')]})
    ]})]},
    {id:uid('scr'),x:430,y:30,stack:[bk('event_whenkeypressed',null,{KEY:'up arrow'}),bk('looks_sayforsecs',{MSG:'Woof!',SECS:0.6}),bk('data_changevariableby',{VAL:1},{VAR:'score'})]}
  ];
  return p;
}
function init(){
  const t=LS.get('bloq.theme');if(t)document.documentElement.setAttribute('data-theme',t);
  if(!loadSaved()){PROJ=blankProject();}  // start empty — no demo game
  normalizeProject();fullRender();renderStage();
  // startup toast
  setTimeout(()=>{try{toast('Tip: press Ctrl+K to search commands & games');}catch(_){}} ,700);
}
function boot(){try{init();}catch(e){console.error(e);try{showErr('startup failed: '+(e&&e.message||e));}catch(_){}
  // last-ditch: at least try to draw the palette so the editor is usable
  try{renderPalette();}catch(_){}}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
