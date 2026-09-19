"use strict";
/* ============================================================================
   BLOQ STUDIO — UI, drag & drop editor, Builds engine, persistence.
   Loaded after bloq-studio.html's inline script; shares its globals.
   ==========================================================================*/

/* ---- palette catalogue (order + which ops show) ---- */
const CATEGORIES=[
  {id:'motion',name:'Motion'},{id:'looks',name:'Looks'},{id:'sound',name:'Sound'},
  {id:'events',name:'Events'},{id:'control',name:'Control'},{id:'sensing',name:'Sensing'},
  {id:'operators',name:'Operators'},{id:'variables',name:'Variables'},{id:'lists',name:'Lists'},
  {id:'myblocks',name:'My Blocks'}
];
const PALETTE_ORDER={
  motion:['motion_movesteps','motion_turnright','motion_turnleft','motion_pointindirection','motion_pointtowards','motion_gotoxy','motion_goto','motion_glide','motion_changexby','motion_setx','motion_changeyby','motion_sety','motion_ifonedge','motion_setrotationstyle','motion_xposition','motion_yposition','motion_direction'],
  looks:['looks_sayforsecs','looks_say','looks_thinkforsecs','looks_think','looks_switchcostume','looks_nextcostume','looks_switchbackdrop','looks_nextbackdrop','looks_changesize','looks_setsize','looks_changeeffect','looks_seteffect','looks_cleareffects','looks_show','looks_hide','looks_gotofront','looks_changelayers','looks_costumenumber','looks_size','looks_backdropnumber'],
  sound:['sound_play','sound_playuntildone','sound_stopall','sound_changevolby','sound_setvol','sound_volume'],
  events:['event_whenflagclicked','event_whenkeypressed','event_whenthisspriteclicked','event_whenstageclicked','event_whenbackdropswitches','event_whenbroadcast','event_broadcast','event_broadcastwait'],
  control:['control_wait','control_repeat','control_forever','control_if','control_if_else','control_wait_until','control_repeat_until','control_stop','control_start_as_clone','control_create_clone','control_delete_clone'],
  sensing:['sensing_touching','sensing_keypressed','sensing_mousedown','sensing_mousex','sensing_mousey','sensing_distanceto','sensing_askandwait','sensing_answer','sensing_timer','sensing_resettimer','sensing_of','sensing_current'],
  operators:['operator_add','operator_subtract','operator_multiply','operator_divide','operator_random','operator_gt','operator_lt','operator_equals','operator_and','operator_or','operator_not','operator_join','operator_letter_of','operator_length','operator_contains','operator_mod','operator_round','operator_mathop'],
  variables:['data_setvariableto','data_changevariableby','data_showvariable','data_hidevariable'],
  lists:['data_addtolist','data_deleteoflist','data_deletealloflist','data_insertatlist','data_replaceitem','data_itemoflist','data_itemnumoflist','data_lengthoflist','data_listcontainsitem'],
  myblocks:[]
};
const ADVANCED_ONLY=new Set(['lists','myblocks']);
let ACTIVE_CAT='motion', MODE='advanced';

/* ============================ PALETTE ==================================== */
function renderPalette(){
  const catBox=$('#cats');catBox.innerHTML='';
  CATEGORIES.filter(c=>MODE==='advanced'||!ADVANCED_ONLY.has(c.id)).forEach(c=>{
    const b=document.createElement('button');b.className='cat'+(c.id===ACTIVE_CAT?' on':'');
    b.innerHTML=`<span class="dot" style="background:${CAT_COLORS[c.id]}"></span>${c.name}`;
    b.onclick=()=>{ACTIVE_CAT=c.id;renderPalette();$('#blocks').scrollTop=0;};
    catBox.appendChild(b);
  });
  const box=$('#blocks');box.innerHTML='';
  const q=$('#palSearch').value.trim().toLowerCase();
  const cats=q?CATEGORIES:CATEGORIES.filter(c=>c.id===ACTIVE_CAT);
  cats.forEach(cat=>{
    if(MODE==='beginner'&&ADVANCED_ONLY.has(cat.id))return;
    let ops=[...(PALETTE_ORDER[cat.id]||[])];
    // dynamic variable/list reporters
    if(cat.id==='variables'){allVars(currentSprite()).forEach(v=>ops.unshift('VAR:'+v.name));}
    if(cat.id==='lists'){allLists(currentSprite()).forEach(v=>ops.unshift('LIST:'+v.name));}
    if(cat.id==='myblocks'){PROJ.customBlocks.forEach(d=>{ops.push('PROC:'+d.proccode);(d.args||[]).forEach(a=>ops.push('ARG:'+d.proccode+':'+a.name+':'+a.type));});}
    let items=ops.map(op=>({op,el:paletteBlockFor(op)})).filter(x=>x.el);
    if(q)items=items.filter(x=>x.el.textContent.toLowerCase().includes(q));
    if(!items.length&&!(cat.id==='variables'||cat.id==='lists'||cat.id==='myblocks'))return;
    const h=document.createElement('div');h.className='pal-head';h.textContent=cat.name;box.appendChild(h);
    if(cat.id==='variables'){box.appendChild(mkButton('Make a Variable',()=>makeVariable()));}
    if(cat.id==='lists'){box.appendChild(mkButton('Make a List',()=>makeList()));}
    if(cat.id==='myblocks'){box.appendChild(mkButton('Make a Block',()=>makeCustomBlock()));}
    items.forEach(({op,el})=>{const w=document.createElement('div');w.className='pal-block';w.appendChild(el);box.appendChild(w);});
  });
  if(!box.querySelector('.pal-block')&&q){box.insertAdjacentHTML('beforeend','<div class="empty-note">No blocks match “'+q+'”.</div>');}
}
function mkButton(label,fn){const b=document.createElement('button');b.className='mk-btn';b.textContent='✚ '+label;b.onclick=fn;return b;}
function paletteBlockFor(op){
  let block;
  if(op.startsWith('VAR:')){block=makeBlock('data_variable');block.fields.VAR=op.slice(4);}
  else if(op.startsWith('LIST:')){block=makeBlock('data_listcontents');block.fields.LIST=op.slice(5);}
  else if(op.startsWith('PROC:')){const d=PROJ.customBlocks.find(x=>x.proccode===op.slice(5));if(!d)return null;block=makeBlock('procedures_call');block.proccode=d.proccode;}
  else if(op.startsWith('ARG:')){const[,,name,type]=op.split(':');block=makeBlock(type==='bool'?'argument_reporter_boolean':'argument_reporter_string_number');block.argName=name;}
  else{if(!DEFS[op])return null;block=makeBlock(op);}
  const el=renderBlock(block,{palette:true});
  el.dataset.pop=op;
  el.addEventListener('pointerdown',e=>startPaletteDrag(e,block));
  return el;
}

/* ============================ BLOCK RENDER =============================== */
function renderBlock(b,opt={}){
  const def=DEFS[b.op];if(!def)return document.createElement('span');
  const color=CAT_COLORS[def.cat]||'#888';
  if((def.shape==='c'||def.shape==='c2')&&!opt.palette===false){/*noop*/}
  if(def.shape==='c'||def.shape==='c2')return renderCBlock(b,def,color,opt);
  const el=document.createElement('div');
  el.className='block '+(def.shape==='reporter'?'reporter':def.shape==='bool'?'bool':def.shape==='hat'?'hat':def.shape==='cap'?'cap':'stack');
  el.style.background=color; if(def.shape==='reporter'||def.shape==='bool')el.style.color='#fff';
  el.style.filter='saturate(1)';
  buildParts(el,specOf(b.op,b),b,color,opt);
  if(!opt.palette)registerBlockEl(el,b);
  return el;
}
function renderCBlock(b,def,color,opt){
  const wrap=document.createElement('div');wrap.className='c-wrap';
  const head=document.createElement('div');head.className='block stack';head.style.background=color;head.style.borderBottomLeftRadius='0';head.style.borderBottomRightRadius='0';
  const spec=specOf(b.op,b);
  // header: parts up to first stack
  let idx=0;for(;idx<spec.length;idx++){if(typeof spec[idx]==='object'&&spec[idx].t==='stack')break;}
  buildParts(head,spec.slice(0,idx),b,color,opt);
  if(!opt.palette)registerBlockEl(head,b);
  wrap.appendChild(head);
  // first branch
  wrap.appendChild(makeBranch(b,'SUBSTACK',color,opt));
  if(def.shape==='c2'){
    const mid=document.createElement('div');mid.className='block stack';mid.style.background=color;mid.style.borderRadius='0';
    // find the 'else' label token (string between the two stacks)
    let elseLbl='else';for(let j=idx+1;j<spec.length;j++){if(typeof spec[j]==='string'){elseLbl=spec[j];break;}}
    mid.innerHTML=`<span class="lbl">${elseLbl}</span>`;
    wrap.appendChild(mid);
    wrap.appendChild(makeBranch(b,'SUBSTACK2',color,opt));
  }
  const foot=document.createElement('div');foot.className='c-foot';foot.style.background=color;wrap.appendChild(foot);
  return wrap;
}
function makeBranch(b,name,color,opt){
  const br=document.createElement('div');br.className='c-branch';br.style.borderColor=color;
  const slot=document.createElement('div');slot.className='stack-slot c-mouth';
  const stack=b.inputs[name]||(b.inputs[name]=[]);
  renderStackInto(slot,stack,opt);
  if(!opt.palette)registerMouth(slot,stack,b,name);
  br.appendChild(slot);return br;
}
function renderStackInto(container,stack,opt){
  stack.forEach((blk,i)=>{const el=renderBlock(blk,opt);
    if(!opt.palette){const meta=EL_META.get(el.classList.contains('c-wrap')?el.querySelector('.block'):el);if(meta){meta.parentArray=stack;meta.index=i;}}
    container.appendChild(el);});
}
function buildParts(el,spec,b,color,opt){
  spec.forEach(part=>{
    if(typeof part==='string'){const s=document.createElement('span');s.className='lbl';s.textContent=part;el.appendChild(s);return;}
    if(part.t==='stack')return;
    if(part.t==='label-arg'){const chip=document.createElement('span');chip.className='block reporter';chip.style.background='rgba(0,0,0,.18)';chip.style.padding='2px 10px';chip.style.margin='0 2px';chip.textContent=part.name||part.i;el.appendChild(chip);return;}
    if(part.t==='menu'){el.appendChild(menuControl(b,part,opt));return;}
    if(part.t==='bool'){el.appendChild(boolSlot(b,part.i,color,opt));return;}
    // num/txt input, possibly holding a reporter
    el.appendChild(valueSlot(b,part,opt));
  });
}
function valueSlot(b,part,opt){
  const val=b.inputs[part.i];
  if(val&&typeof val==='object'&&val.op){ // embedded reporter
    const span=document.createElement('span');span.className='embed';span.appendChild(renderBlock(val,opt));
    if(!opt.palette)registerSlot(span,b,part.i,'value');
    return span;
  }
  const inp=document.createElement('input');inp.className='slot '+(part.t==='num'?'num':'txt');
  inp.value=(val==null?'':val);inp.spellcheck=false;
  sizeInput(inp);
  inp.addEventListener('input',()=>{sizeInput(inp);});
  inp.addEventListener('change',()=>{b.inputs[part.i]=inp.value;autosave();});
  inp.addEventListener('pointerdown',e=>e.stopPropagation());
  if(opt.palette)inp.readOnly=true;
  else registerSlot(inp,b,part.i,'value');
  return inp;
}
function sizeInput(inp){const len=Math.max(1,(inp.value||'').length);inp.style.width=(len*8.2+14)+'px';}
function boolSlot(b,name,color,opt){
  const val=b.inputs[name];
  if(val&&typeof val==='object'&&val.op){const span=document.createElement('span');span.className='embed';span.appendChild(renderBlock(val,opt));
    if(!opt.palette)registerSlot(span,b,name,'bool');return span;}
  const s=document.createElement('span');s.className='boolslot';
  if(!opt.palette)registerSlot(s,b,name,'bool');
  return s;
}
function menuControl(b,part,opt){
  const sel=document.createElement('select');sel.className='slot-menu';
  const opts=menuOptions(b.op,part.i,{sprite:editingTarget()});
  const cur=b.fields[part.i];
  const list=opts.length?opts:[cur];
  if(cur&&!list.includes(cur))list.unshift(cur);
  list.forEach(o=>{const opt2=document.createElement('option');opt2.value=o;opt2.textContent=menuLabel(o);sel.appendChild(opt2);});
  sel.value=cur;
  sel.addEventListener('pointerdown',e=>e.stopPropagation());
  sel.addEventListener('change',()=>{b.fields[part.i]=sel.value;autosave();scheduleRender();});
  if(opt.palette)sel.disabled=true;
  return sel;
}
function menuLabel(o){return o==='_mouse_'?'mouse-pointer':o==='_edge_'?'edge':o==='_random_'?'random position':o==='_myself_'?'myself':o;}

/* meta registry for DnD */
const EL_META=new WeakMap();
let SNAP_TARGETS=[]; // rebuilt at dragstart
function registerBlockEl(el,b){EL_META.set(el,{type:'block',block:b});}
function registerMouth(el,array,b,name){EL_META.set(el,{type:'mouth',array,block:b,name});}
function registerSlot(el,b,name,slotKind){EL_META.set(el,{type:'slot',block:b,name,slotKind});}

/* ============================ WORKSPACE ================================= */
let VIEW={x:40,y:40,scale:1};
function renderWorkspace(){
  const canvas=$('#wsCanvas');canvas.innerHTML='';
  canvas.style.transform=`translate(${VIEW.x}px,${VIEW.y}px) scale(${VIEW.scale})`;
  const tgt=editingTarget();
  (tgt.scripts||[]).forEach(scr=>{
    const el=document.createElement('div');el.className='script';el.style.left=scr.x+'px';el.style.top=scr.y+'px';
    el.dataset.sid=scr.id;
    const slot=document.createElement('div');slot.className='stack-slot';
    renderStackInto(slot,scr.stack,{});
    el.appendChild(slot);
    canvas.appendChild(el);
    EL_META.get(slot)||EL_META.set(slot,{});
    // attach script ref to first block meta
    const first=scr.stack[0];
    if(first){const fel=slot.firstElementChild;const m=EL_META.get(fel&&fel.classList.contains('c-wrap')?fel.querySelector('.block'):fel);if(m){m.script=scr;}}
    el._script=scr;
  });
  attachBlockDrag(canvas);
  updateHint();
}
let renderPending=false;
function scheduleRender(){if(renderPending)return;renderPending=true;requestAnimationFrame(()=>{renderPending=false;renderWorkspace();renderPalette();});}
function updateHint(){const tgt=editingTarget();$('#wsHint').style.display=(tgt.scripts&&tgt.scripts.length)?'none':'block';}

/* dragging */
let PENDING=null,DRAG=null;
function attachBlockDrag(canvas){
  $$('.script .block',canvas).forEach(el=>{
    if(el._dragBound)return;el._dragBound=true;
    el.addEventListener('pointerdown',e=>{
      if(e.button!==0)return;
      if(/INPUT|SELECT|TEXTAREA|OPTION/.test(e.target.tagName))return;
      const meta=EL_META.get(el);if(!meta||meta.type!=='block')return;
      e.stopPropagation();
      PENDING={block:meta.block,fromEl:el,startX:e.clientX,startY:e.clientY,palette:false};
      window.addEventListener('pointermove',onDragMove);
      window.addEventListener('pointerup',onDragUp);
    });
    el.addEventListener('contextmenu',e=>{const meta=EL_META.get(el);if(meta&&meta.type==='block'){e.preventDefault();showBlockCtx(e,meta.block);}});
  });
}
function startPaletteDrag(e,templateBlock){
  if(e.button!==0)return;
  if(/INPUT|SELECT/.test(e.target.tagName))return;
  e.preventDefault();
  PENDING={template:templateBlock,startX:e.clientX,startY:e.clientY,palette:true};
  window.addEventListener('pointermove',onDragMove);
  window.addEventListener('pointerup',onDragUp);
}
function onDragMove(e){
  if(!DRAG){
    const dx=e.clientX-PENDING.startX,dy=e.clientY-PENDING.startY;
    if(Math.hypot(dx,dy)<4)return;
    beginDrag(e);
  }
  if(DRAG){
    const cx=(e.clientX-DRAG.grabX), cy=(e.clientY-DRAG.grabY);
    DRAG.el.style.left=cx+'px';DRAG.el.style.top=cy+'px';
    computeSnap(e);
  }
}
function beginDrag(e){
  pushUndo();
  const tgt=editingTarget();
  let stack;
  if(PENDING.palette){stack=[deepCloneBlock(PENDING.template)];}
  else{
    // split: remove this block + following from its parent array
    const meta=EL_META.get(PENDING.fromEl);
    const arr=meta.parentArray, idx=meta.index;
    if(arr&&idx!=null){stack=arr.splice(idx);}
    else{stack=[PENDING.block];}
    // if it was a reporter/bool embedded in a slot
    if(!arr){
      const owner=findEmbedOwner(PENDING.block);
      if(owner){if(owner.kind==='bool')owner.block.inputs[owner.name]=null;else owner.block.inputs[owner.name]=owner.default;stack=[PENDING.block];}
    }
  }
  // remove empty scripts
  const wsRect=$('#workspace').getBoundingClientRect();
  const localX=(e.clientX-wsRect.left-VIEW.x)/VIEW.scale-6;
  const localY=(e.clientY-wsRect.top-VIEW.y)/VIEW.scale-6;
  const scr={id:uid('scr'),x:localX,y:localY,stack};
  tgt.scripts.push(scr);
  tgt.scripts=tgt.scripts.filter(s=>s.stack.length>0);
  renderWorkspace();renderPalette();
  const el=$(`.script[data-sid="${scr.id}"]`);
  DRAG={script:scr,el,grabX:e.clientX-(el.getBoundingClientRect().left),grabY:e.clientY-(el.getBoundingClientRect().top),
        isReporter:isReporterStack(stack)};
  DRAG.grabX=e.clientX-(wsRect.left+VIEW.x+scr.x*VIEW.scale);
  DRAG.grabY=e.clientY-(wsRect.top+VIEW.y+scr.y*VIEW.scale);
  el.style.zIndex=999;el.classList.add('snapping');
  buildSnapTargets(scr);
}
function isReporterStack(stack){if(stack.length!==1)return false;const d=DEFS[stack[0].op];return d&&(d.shape==='reporter'||d.shape==='bool');}
function deepCloneBlock(b){return JSON.parse(JSON.stringify(b,(k,v)=>k==='id'?uid():v));}
function findEmbedOwner(block){
  const tgt=editingTarget();let found=null;
  const scan=(b)=>{for(const k in b.inputs){const v=b.inputs[k];if(v===block){found={block:b,name:k,kind:isBoolInput(b.op,k)?'bool':'value',default:''};return;}
    if(v&&typeof v==='object'&&v.op)scan(v);if(Array.isArray(v))v.forEach(scan);}};
  tgt.scripts.forEach(s=>s.stack.forEach(scan));return found;
}
function isBoolInput(op,name){const p=specOf(op,{}).find(x=>x&&x.i===name);return p&&p.t==='bool';}

function buildSnapTargets(dragScript){
  SNAP_TARGETS=[];
  const dragged=new Set();collectBlocks(dragScript.stack,dragged);
  const canvas=$('#wsCanvas');
  if(DRAG.isReporter){
    $$('.slot,.boolslot,.embed',canvas).forEach(el=>{const m=EL_META.get(el);if(!m||m.type!=='slot')return;
      if(dragged.has(m.block))return;
      const wantBool=DEFS[dragScript.stack[0].op].shape==='bool';
      if(wantBool&&m.slotKind!=='bool')return; if(!wantBool&&m.slotKind==='bool')return;
      SNAP_TARGETS.push({kind:'slot',el,meta:m});});
  }else{
    $$('.script .block',canvas).forEach(el=>{const m=EL_META.get(el);if(!m||m.type!=='block')return;if(dragged.has(m.block))return;
      const d=DEFS[m.block.op];if(d.shape==='reporter'||d.shape==='bool')return;
      SNAP_TARGETS.push({kind:'after',el,meta:m});});
    $$('.c-mouth',canvas).forEach(el=>{const m=EL_META.get(el);if(!m||m.type!=='mouth')return;if(m.block&&dragged.has(m.block))return;
      SNAP_TARGETS.push({kind:'mouth',el,meta:m});});
  }
}
function collectBlocks(stack,set){stack.forEach(b=>{set.add(b);for(const k in b.inputs){const v=b.inputs[k];if(Array.isArray(v))collectBlocks(v,set);else if(v&&typeof v==='object'&&v.op)set.add(v);}});}
let snapHi=null;
function computeSnap(e){
  clearGhost();DRAG.snap=null;
  const el=DRAG.el;const r=el.getBoundingClientRect();
  const plugX=DRAG.isReporter?r.left+6:r.left+10, plugY=DRAG.isReporter?r.top+r.height/2:r.top+8;
  let best=null,bestD=DRAG.isReporter?26:30;
  SNAP_TARGETS.forEach(t=>{const tr=t.el.getBoundingClientRect();let tx,ty;
    if(t.kind==='after'){tx=tr.left+10;ty=tr.bottom;}
    else if(t.kind==='mouth'){tx=tr.left+8;ty=tr.top+4;}
    else{tx=tr.left+8;ty=tr.top+tr.height/2;}
    const d=Math.hypot(plugX-tx,plugY-ty);if(d<bestD){bestD=d;best=t;}});
  if(best){DRAG.snap=best;showGhost(best);}
}
function showGhost(t){const tr=t.el.getBoundingClientRect();const ws=$('#workspace').getBoundingClientRect();
  const g=document.createElement('div');g.className='ghost-drop';
  if(t.kind==='slot'){g.style.left=(tr.left-ws.left)+'px';g.style.top=(tr.top-ws.top)+'px';g.style.width=tr.width+'px';g.style.height=tr.height+'px';}
  else{const x=t.kind==='mouth'?tr.left-ws.left+2:tr.left-ws.left;const y=t.kind==='mouth'?tr.top-ws.top:tr.bottom-ws.top;
    g.style.left=x+'px';g.style.top=(y-2)+'px';g.style.width=Math.max(60,tr.width)+'px';g.style.height='6px';}
  $('#workspace').appendChild(g);snapHi=g;}
function clearGhost(){if(snapHi){snapHi.remove();snapHi=null;}}
function onDragUp(e){
  window.removeEventListener('pointermove',onDragMove);window.removeEventListener('pointerup',onDragUp);
  if(!DRAG){ // was a click
    if(PENDING&&!PENDING.palette){const meta=EL_META.get(PENDING.fromEl);if(meta&&meta.script)runScript(meta.script); else if(meta&&meta.block)runLooseBlock(meta.block);}
    else if(PENDING&&PENDING.palette){addBlockToWorkspace(PENDING.template);}
    PENDING=null;return;}
  clearGhost();
  const tgt=editingTarget();const drag=DRAG;const stack=drag.script.stack;
  const wsRect=$('#workspace').getBoundingClientRect();
  if(drag.snap){
    // remove floating script
    tgt.scripts=tgt.scripts.filter(s=>s!==drag.script);
    const t=drag.snap;
    if(t.kind==='after'){const arr=t.meta.parentArray, idx=t.meta.index;
      if(arr){arr.splice(idx+1,0,...stack);}else{ // block is a script top with no parentArray tracked → use script
        const owner=findScriptOf(t.meta.block);if(owner){const i=owner.stack.indexOf(t.meta.block);owner.stack.splice(i+1,0,...stack);}}
    }else if(t.kind==='mouth'){t.meta.array.unshift(...stack);}
    else if(t.kind==='slot'){if(t.meta.slotKind==='bool')t.meta.block.inputs[t.meta.name]=stack[0];else t.meta.block.inputs[t.meta.name]=stack[0];}
  }else{
    // leave floating; snap to grid-ish
    drag.script.x=Math.round(((e.clientX-wsRect.left-VIEW.x)/VIEW.scale-drag.grabX/VIEW.scale));
    drag.script.y=Math.round(((e.clientY-wsRect.top-VIEW.y)/VIEW.scale-drag.grabY/VIEW.scale));
    // if dropped over palette (x<0 area near palette) and it was from palette originally with single command -> keep anyway
  }
  DRAG=null;PENDING=null;
  scheduleRender();autosave();maybeSmartHelp();
}
function findScriptOf(block){const tgt=editingTarget();return tgt.scripts.find(s=>containsBlock(s.stack,block));}
function containsBlock(stack,block){for(const b of stack){if(b===block)return true;for(const k in b.inputs){const v=b.inputs[k];if(Array.isArray(v)&&containsBlock(v,block))return true;}}return false;}
function addBlockToWorkspace(template){pushUndo();const tgt=editingTarget();const b=deepCloneBlock(template);
  const y=40+(tgt.scripts.length*10)%200;tgt.scripts.push({id:uid('scr'),x:40,y,stack:[b]});scheduleRender();autosave();}
function runScript(scr){ensureLoop();const tgt=editingTarget();const sp=tgt===PROJ.stage?PROJ.stage:tgt;
  const hat=scr.stack[0];const stack=(hat&&DEFS[hat.op]&&DEFS[hat.op].hat)?scr.stack.slice(1):scr.stack.slice();
  const el=$(`.script[data-sid="${scr.id}"]`);if(el){el.animate([{filter:'brightness(1.3)'},{filter:'brightness(1)'}],{duration:400});}
  startThread(sp,stack);}
function runLooseBlock(block){const scr=findScriptOf(block);if(scr)runScript(scr);}

/* block context menu */
function showBlockCtx(e,block){closeCtx();const m=document.createElement('div');m.className='ctx';m.style.left=e.clientX+'px';m.style.top=e.clientY+'px';
  const add=(label,fn)=>{const b=document.createElement('button');b.textContent=label;b.onclick=()=>{closeCtx();fn();};m.appendChild(b);};
  add('Duplicate',()=>{pushUndo();const scr=findScriptOf(block);if(!scr)return;const i=scr.stack.indexOf(block);
    const copy=scr.stack.slice(i>=0?i:0).map(deepCloneBlock);editingTarget().scripts.push({id:uid('scr'),x:scr.x+30,y:scr.y+30,stack:i>=0?copy:[deepCloneBlock(block)]});scheduleRender();autosave();});
  add('Delete',()=>{pushUndo();deleteBlock(block);scheduleRender();autosave();});
  m.appendChild(document.createElement('hr'));
  add('Delete this script',()=>{pushUndo();const scr=findScriptOf(block);if(scr)editingTarget().scripts=editingTarget().scripts.filter(s=>s!==scr);scheduleRender();autosave();});
  document.body.appendChild(m);setTimeout(()=>window.addEventListener('pointerdown',closeCtx,{once:true}),0);}
function closeCtx(){$$('.ctx').forEach(x=>x.remove());}
function deleteBlock(block){const tgt=editingTarget();
  for(const scr of tgt.scripts){const i=scr.stack.indexOf(block);if(i>=0){scr.stack.splice(i,1);tgt.scripts=tgt.scripts.filter(s=>s.stack.length);return;}}
  const owner=findEmbedOwner(block);if(owner){owner.block.inputs[owner.name]=owner.kind==='bool'?null:'';return;}
  // inside a branch
  const rm=(stack)=>{const i=stack.indexOf(block);if(i>=0){stack.splice(i,1);return true;}
    for(const b of stack){for(const k in b.inputs){if(Array.isArray(b.inputs[k])&&rm(b.inputs[k]))return true;}}return false;};
  tgt.scripts.forEach(s=>rm(s.stack));}

/* workspace pan/zoom */
(function(){const ws=$('#workspace');let panning=false,sx,sy;
  ws.addEventListener('pointerdown',e=>{if(e.target.closest('.block')||e.target.closest('.ws-tools'))return;panning=true;sx=e.clientX-VIEW.x;sy=e.clientY-VIEW.y;ws.setPointerCapture(e.pointerId);});
  ws.addEventListener('pointermove',e=>{if(!panning)return;VIEW.x=e.clientX-sx;VIEW.y=e.clientY-sy;$('#wsCanvas').style.transform=`translate(${VIEW.x}px,${VIEW.y}px) scale(${VIEW.scale})`;});
  ws.addEventListener('pointerup',()=>panning=false);
  ws.addEventListener('wheel',e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();const d=e.deltaY<0?1.1:0.9;VIEW.scale=clamp(VIEW.scale*d,0.4,2.2);$('#wsCanvas').style.transform=`translate(${VIEW.x}px,${VIEW.y}px) scale(${VIEW.scale})`;},{passive:false});
})();
$('#zoomIn').onclick=()=>{VIEW.scale=clamp(VIEW.scale*1.15,0.4,2.2);renderWorkspace();};
$('#zoomOut').onclick=()=>{VIEW.scale=clamp(VIEW.scale/1.15,0.4,2.2);renderWorkspace();};
$('#zoomReset').onclick=()=>{VIEW={x:40,y:40,scale:1};renderWorkspace();};
$('#cleanup').onclick=()=>{pushUndo();const tgt=editingTarget();let y=30;tgt.scripts.forEach(s=>{s.x=30;s.y=y;y+=estimateHeight(s.stack)+30;});renderWorkspace();autosave();};
function estimateHeight(stack){let h=0;stack.forEach(b=>{h+=34;const d=DEFS[b.op];if(d&&(d.shape==='c'||d.shape==='c2')){h+=estimateHeight(b.inputs.SUBSTACK||[])+20;if(d.shape==='c2')h+=estimateHeight(b.inputs.SUBSTACK2||[])+20;}});return h;}

/* ============================ VARIABLES / LISTS UI ====================== */
function makeVariable(){const name=prompt('New variable name:','score');if(!name)return;const scope=confirm('OK = for all sprites (global)\nCancel = for this sprite only')?'global':'local';
  addVariable(name.trim(),scope);toast('Variable “'+name.trim()+'” created');}
function addVariable(name,scope,value=0){const owner=scope==='local'?currentSprite():PROJ.stage;
  if(allVars(currentSprite()).some(v=>v.name===name))return findVar(currentSprite(),name);
  const v={name,value,visible:true,monitor:scope!=='hidden'};owner.variables.push(v);renderPalette();renderStage();autosave();return v;}
function makeList(){const name=prompt('New list name:','items');if(!name)return;const owner=confirm('OK = for all sprites (global)\nCancel = this sprite only')?PROJ.stage:currentSprite();
  if(allLists(currentSprite()).some(l=>l.name===name))return;owner.lists.push({name:name.trim(),items:[],visible:true});renderPalette();autosave();}
function makeCustomBlock(){const label=prompt('Name your block (use %s for a text/number input, %b for a boolean):\ne.g.  jump %s times','do a flip');if(!label)return;
  const proccode=label; const args=[];let ai=0;label.split(/(%[sb])/).forEach(t=>{if(t==='%s')args.push({name:'arg'+(ai++),type:'str'});else if(t==='%b')args.push({name:'arg'+(ai++),type:'bool'});});
  PROJ.customBlocks.push({proccode,label,args});
  // add a definition hat to current sprite
  const hat=makeBlock('procedures_definition');hat.proccode=proccode;hat.label=label;hat.args=args;hat.inputs.SUBSTACK=[];
  editingTarget().scripts.push({id:uid('scr'),x:40,y:40,stack:[hat]});
  ACTIVE_CAT='myblocks';scheduleRender();autosave();}
/* dynamic spec builders for custom blocks */
function dynDefineSpec(blk){const parts=['define '];const label=blk&&blk.label||'block';const args=blk&&blk.args||[];let ai=0;
  label.split(/(%[sb])/).forEach(t=>{if(t==='%s'||t==='%b'){parts.push({i:args[ai]?args[ai].name:'arg'+ai,t:'label-arg',name:args[ai]&&args[ai].name});ai++;}else if(t)parts.push(t);});
  parts.push({i:'SUBSTACK',t:'stack'});return parts;}
function dynCallSpec(blk){const def=PROJ.customBlocks.find(d=>d.proccode===blk.proccode);if(!def)return['(missing block)'];
  const parts=[];let ai=0;def.label.split(/(%[sb])/).forEach(t=>{if(t==='%s'){parts.push({i:def.args[ai].name,t:'txt',d:''});ai++;}else if(t==='%b'){parts.push({i:def.args[ai].name,t:'bool'});ai++;}else if(t)parts.push(t);});
  return parts;}
/* label-arg renders as a rounded arg reporter chip in the define hat */
const _origBuild=buildParts;

/* ============================ SPRITES PANEL ============================= */
function renderSprites(){
  const list=$('#spList');list.innerHTML='';
  PROJ.sprites.filter(s=>!s.isClone).forEach(s=>{
    const card=document.createElement('div');card.className='sp-card'+(s.id===PROJ.currentSprite?' on':'');
    const cv=document.createElement('canvas');cv.width=64;cv.height=44;cv.className='thumb';drawThumb(cv,s);
    const nm=document.createElement('div');nm.className='nm';nm.textContent=s.name;
    const x=document.createElement('button');x.className='x';x.textContent='×';x.title='Delete sprite';
    x.onclick=ev=>{ev.stopPropagation();deleteSprite(s);};
    card.append(cv,nm,x);
    card.onclick=()=>selectSprite(s.id);
    card.oncontextmenu=e=>{e.preventDefault();dupSprite(s);};
    list.appendChild(card);
  });
  // stage card
  const st=document.createElement('div');st.className='sp-card'+(PROJ.currentSprite==='stage'?' on':'');
  const cv=document.createElement('canvas');cv.width=64;cv.height=44;cv.className='thumb';const c=cv.getContext('2d');c.fillStyle=PROJ.stage.costumes[PROJ.stage.costume].color||'#fff';c.fillRect(0,0,64,44);c.strokeStyle='#ccc';c.strokeRect(0,0,64,44);
  const nm=document.createElement('div');nm.className='nm';nm.textContent='Stage';st.append(cv,nm);st.onclick=()=>selectSprite('stage');list.appendChild(st);
  // add button
  const add=document.createElement('div');add.className='sp-add';add.textContent='＋';add.title='Add sprite';add.onclick=addSprite;list.appendChild(add);
  renderSpriteProps();
}
function drawThumb(cv,s){const c=cv.getContext('2d');c.clearRect(0,0,cv.width,cv.height);c.save();c.translate(32,24);c.scale(0.7,0.7);
  const cost=s.costumes[s.costume]||{};if(cost.render&&SPRITE_ART[cost.render])SPRITE_ART[cost.render](c,cost.pose||0);
  else{c.font='26px "Segoe UI Emoji",sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(cost.emoji||'🐶',0,0);}c.restore();}
function renderSpriteProps(){
  const box=$('#spProps');const s=editingTarget();
  if(s.isStage){box.innerHTML=`<div class="name"><b style="font-family:Fredoka">Stage</b><span style="color:var(--muted);font-weight:700;font-size:12px">Backdrops: ${s.costumes.length}</span></div>
    <label>Backdrop</label><div style="grid-column:2/-1;display:flex;gap:6px;flex-wrap:wrap">${s.costumes.map((c,i)=>`<button class="chip${i===s.costume?' on':''}" data-bd="${i}">${c.name}</button>`).join('')}</div>`;
    $$('[data-bd]',box).forEach(b=>b.onclick=()=>{s.costume=+b.dataset.bd;renderStage();renderSprites();});return;}
  box.innerHTML=`
    <div class="name">Sprite <input id="pName" value="${escapeHtml(s.name)}" style="max-width:150px"></div>
    <label>x</label><input id="pX" type="number" value="${Math.round(s.x)}">
    <label>y</label><input id="pY" type="number" value="${Math.round(s.y)}">
    <label>Size</label><input id="pSize" type="number" value="${Math.round(s.size)}">
    <label>Dir</label><input id="pDir" type="number" value="${Math.round(s.direction)}">
    <label>Show</label><div><button class="switch ${s.visible?'on':''}" id="pShow"><b></b></button></div>
    <label>Costume</label><div style="display:flex;gap:6px;align-items:center"><button class="chip" id="pCost">${s.costumes[s.costume].name}</button></div>`;
  const bind=(id,key,fn)=>{const el=$('#'+id,box);el.onchange=()=>{s[key]=fn?fn(el.value):el.value;renderStage();autosave();if(key==='name'){renderSprites();renderPalette();}};};
  bind('pName','name');bind('pX','x',toNum);bind('pY','y',toNum);bind('pSize','size',v=>clamp(toNum(v),5,400));bind('pDir','direction',v=>wrapDir(toNum(v)));
  $('#pShow',box).onclick=()=>{s.visible=!s.visible;renderSpriteProps();renderStage();autosave();};
  $('#pCost',box).onclick=()=>{s.costume=(s.costume+1)%s.costumes.length;renderStage();renderSprites();};
}
function escapeHtml(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function selectSprite(id){PROJ.currentSprite=id;renderSprites();renderWorkspace();renderPalette();autosave();}
function addSprite(){const emoji=EMOJI[rand(0,EMOJI.length-1)];const name=uniqueName('Sprite',PROJ.sprites.map(s=>s.name));
  const s=newSprite(name,emoji);s.x=rand(-120,120);s.y=rand(-80,80);PROJ.sprites.push(s);selectSprite(s.id);renderStage();autosave();toast('Added '+name);}
function dupSprite(s){const c=JSON.parse(JSON.stringify(s));c.id=uid('sp');c.name=uniqueName(s.name,PROJ.sprites.map(x=>x.name));c.isClone=false;c.x+=20;c.y-=20;
  PROJ.sprites.push(c);selectSprite(c.id);renderStage();autosave();toast('Duplicated '+s.name);}
function deleteSprite(s){if(PROJ.sprites.filter(x=>!x.isClone).length<=1){toast('Keep at least one sprite');return;}
  pushUndo();PROJ.sprites=PROJ.sprites.filter(x=>x!==s);if(PROJ.currentSprite===s.id)PROJ.currentSprite=PROJ.sprites.find(x=>!x.isClone).id;
  renderSprites();renderWorkspace();renderStage();autosave();}
function uniqueName(base,taken){let n=base,i=2;while(taken.includes(n))n=base+i++;return n;}

/* ============================ TOP BAR / SHORTCUTS ======================= */
$('#btnFlag').onclick=()=>greenFlag();
$('#btnStop').onclick=()=>stopEverything();
$('#modeSeg').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;MODE=b.dataset.mode;
  $$('#modeSeg button').forEach(x=>x.classList.toggle('on',x===b));if(MODE==='beginner'&&ADVANCED_ONLY.has(ACTIVE_CAT))ACTIVE_CAT='motion';renderPalette();autosave();});
$('#btnFull').onclick=()=>{$('#stageBox').classList.toggle('big');renderStage();};
$('#buildsClose').onclick=()=>closeOverlay('buildsOverlay');
$('#btnCmd').onclick=()=>openCmd();$('#btnMenu').onclick=()=>openOverlay('menuOverlay');
$('#menuClose').onclick=()=>closeOverlay('menuOverlay');
$('#palSearch').addEventListener('input',renderPalette);

window.addEventListener('keydown',e=>{
  const typing=/INPUT|SELECT|TEXTAREA/.test((document.activeElement||{}).tagName);
  const anyOverlay=$$('.overlay.on').length>0;
  // Shift+0 → Builds (global, unless typing)
  if(e.shiftKey&&(e.key==='0'||e.code==='Digit0')&&!typing){e.preventDefault();openBuilds();return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openCmd();return;}
  if(e.key==='Escape'){$$('.overlay.on').forEach(o=>o.classList.remove('on'));closeCtx();return;}
  if(typing)return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();return;}
  if(anyOverlay)return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();exportProject();return;}
  if(e.key===' '){e.preventDefault();THREADS.length?stopEverything():greenFlag();return;}
});

/* ============================ PERSISTENCE ============================== */
const SAVE_KEY='bloq.studio.project.v2';
const LS={get(k){try{return localStorage.getItem(k);}catch(e){return null;}},set(k,v){try{localStorage.setItem(k,v);}catch(e){}}};
let saveTimer=null;
function autosave(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{
  const data=serialize();LS.set(SAVE_KEY,data);const el=$('#saveInfo');if(el)el.textContent='Saved '+new Date().toLocaleTimeString();
},600);}
function serialize(){const clean=JSON.parse(JSON.stringify(PROJ));clean.sprites=clean.sprites.filter(s=>!s.isClone);return JSON.stringify(clean);}
function loadSaved(){const d=LS.get(SAVE_KEY);if(d){try{PROJ=JSON.parse(d);normalizeProject();return true;}catch(e){}}return false;}
function normalizeProject(){PROJ.messages=PROJ.messages||['message1'];PROJ.customBlocks=PROJ.customBlocks||[];PROJ.stage=PROJ.stage||newStage();
  PROJ.sprites.forEach(s=>{s.effects=s.effects||{};s.variables=s.variables||[];s.lists=s.lists||[];s.scripts=s.scripts||[];s.sounds=s.sounds||[{name:'pop',freq:440,dur:120}];});
  if(!PROJ.sprites.some(s=>s.id===PROJ.currentSprite)&&PROJ.currentSprite!=='stage')PROJ.currentSprite=PROJ.sprites[0].id;}
function exportProject(){const json=serialize();const embedded=(()=>{try{return window.self!==window.top;}catch(e){return true;}})();
  if(!embedded){try{const blob=new Blob([json],{type:'application/json'});const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);a.download=(PROJ.name||'project')+'.bloq.json';a.click();toast('Project exported as .json');return;}catch(e){}}
  // Embedded (artifact viewer blocks downloads) → copy JSON to clipboard so nothing is a dead end
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(json)
    .then(()=>toast('Project JSON copied — paste it into a .json file to save'))
    .catch(()=>{try{prompt('Copy your project JSON:',json);}catch(_){}});}
  else{try{prompt('Copy your project JSON:',json);}catch(_){}}}
$('#mExport').onclick=exportProject;
$('#mImport').onclick=()=>$('#fileInput').click();
$('#fileInput').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();
  r.onload=()=>{try{PROJ=JSON.parse(r.result);normalizeProject();stopEverything();fullRender();autosave();toast('Project imported');closeOverlay('menuOverlay');}catch(err){toast('Could not read file');}};r.readAsText(f);});
$('#mNew').onclick=()=>{if(confirm('Start a new project? Current work is autosaved in this browser but will be replaced.')){PROJ=blankProject();stopEverything();fullRender();autosave();closeOverlay('menuOverlay');}};
$('#mTheme').onclick=toggleTheme;
function toggleTheme(){const cur=document.documentElement.getAttribute('data-theme');
  const next=cur==='dark'?'light':cur==='light'?'dark':(matchMedia('(prefers-color-scheme:dark)').matches?'light':'dark');
  document.documentElement.setAttribute('data-theme',next);LS.set('bloq.theme',next);}

/* undo/redo */
const UNDO=[],REDO=[];
function pushUndo(){UNDO.push(serialize());if(UNDO.length>50)UNDO.shift();REDO.length=0;}
function undo(){if(!UNDO.length)return;REDO.push(serialize());PROJ=JSON.parse(UNDO.pop());normalizeProject();stopEverything();fullRender();autosave();toast('Undo');}
function redo(){if(!REDO.length)return;UNDO.push(serialize());PROJ=JSON.parse(REDO.pop());normalizeProject();stopEverything();fullRender();autosave();toast('Redo');}

/* toasts */
function toast(msg){const t=document.createElement('div');t.className='toast';t.textContent=msg;$('#toasts').appendChild(t);
  setTimeout(()=>{t.style.opacity='0';t.style.transition='opacity .3s';setTimeout(()=>t.remove(),300);},1800);}

/* overlays */
function openOverlay(id){$('#'+id).classList.add('on');}
function closeOverlay(id){$('#'+id).classList.remove('on');}
$$('.overlay').forEach(o=>o.addEventListener('pointerdown',e=>{if(e.target===o)o.classList.remove('on');}));

/* ============================ FULL RENDER ============================== */
function fullRender(){safeRun('palette',renderPalette);safeRun('workspace',renderWorkspace);safeRun('sprites',renderSprites);safeRun('stage',renderStage);}
function safeRun(label,fn){try{fn();}catch(e){console.error('['+label+']',e);showErr(label+': '+(e&&e.message||e));}}
function showErr(msg){let d=document.getElementById('__err');
  if(!d){d=document.createElement('div');d.id='__err';
    d.style.cssText='position:fixed;left:8px;right:8px;bottom:8px;z-index:999999;background:#ef476f;color:#fff;font:12px/1.45 ui-monospace,Menlo,monospace;padding:9px 34px 9px 12px;border-radius:9px;white-space:pre-wrap;box-shadow:0 8px 24px rgba(0,0,0,.35)';
    const x=document.createElement('button');x.textContent='✕';x.style.cssText='position:absolute;right:6px;top:5px;border:0;background:transparent;color:#fff;font-weight:800;font-size:14px;cursor:pointer';x.onclick=()=>d.remove();
    const t=document.createElement('div');t.id='__errtext';d.appendChild(x);d.appendChild(t);(document.body||document.documentElement).appendChild(d);}
  const t=document.getElementById('__errtext');if(t)t.textContent='⚠ Bloq error — '+msg;}
try{window.addEventListener('error',e=>{try{showErr((e.message||'script error')+'  ['+((e.filename||'').split('/').pop())+':'+(e.lineno||'?')+']');}catch(_){}});}catch(_){}

/* ---- Builds engine + command palette + smart help live in bloq-builds.js ---- */
