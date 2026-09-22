const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const D=require('../data.js'),G=require('../game.js');
const script=fs.readFileSync(require.resolve('../script.js'),'utf8');

// Run the real UI controller with a controllable clock and isolated browser storage.
function page(saved,{reduced=false,mobile=false,route='play'}={}){
  let now=0,id=0,hash='#'+route;
  const timers=new Map(),listeners={},writes=[],scrolled=[],storage=new Map([['dota2myteam.run.v4',JSON.stringify(saved)]]);
  const element=()=>({addEventListener(){},focus(){},close(){},showModal(){},querySelector(selector){return {focus(){},scrollIntoView(){scrolled.push(selector);}};},innerHTML:''});
  const app=element();Object.defineProperty(app,'innerHTML',{get:()=>writes.at(-1)||'',set:value=>writes.push(value)});
  const elements={app,modal:element(),'modal-content':element(),toast:element()};
  const context={DotaData:D,DotaGame:G,document:{getElementById:id=>elements[id]||(elements[id]=element()),querySelectorAll:()=>[],addEventListener:(name,fn)=>listeners[name]=fn},
    localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},location:{get hash(){return hash;},set hash(value){hash=value.startsWith('#')?value:'#'+value;}},
    performance:{now:()=>now},matchMedia:query=>({matches:query.includes('reduced-motion')?reduced:mobile}),scrollTo(){},addEventListener(){},
    crypto:{getRandomValues:values=>{values[0]=42;return values;}},
    setTimeout:(fn,delay)=>{timers.set(++id,{fn,at:now+delay});return id;},clearTimeout:id=>timers.delete(id)};
  context.window=context;vm.runInNewContext(script,context);
  return {app,writes,scrolled,modal:elements['modal-content'],saved:()=>JSON.parse(storage.get('dota2myteam.run.v4')),
    archive:()=>elements['archive-grid']?.innerHTML,
    change(id,value){listeners.change({target:{id,value}});},
    submitName(value){elements['team-name'].value=value;listeners.submit({target:{id:'team-name-form'},preventDefault(){}});},
    click(action,extra={}){listeners.click({target:{closest:selector=>selector==='.skip-link'?null:{disabled:false,dataset:{action,...extra}}}});},
    advance(ms){const end=now+ms;while(true){const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].fn();}now=end;}
  };
}
const frames=html=>[...html.matchAll(/<span class="draw-reel-row">(.*?)<\/span>/g)].map(m=>m[1]);
function checkReel(html){const rows=frames(html);assert.ok(new Set(rows).size>2,JSON.stringify(rows));assert.equal(rows.slice(0,-1).includes(rows.at(-1)),false);assert.match(html,/aria-hidden="true" style="--reel-steps/);}

test('one reel scrolls valid year-team pairs together and reveals both only when it stops',()=>{
  const p=page(G.start(40));p.writes.length=0;p.click('confirm-start');const saved=p.saved(),pool=G.currentPool(saved);
  for(const html of p.writes){
    assert.equal((html.match(/class="draw-box /g)||[]).length,1);
    assert.equal((html.match(/class="draw-reel"/g)||[]).length,1);
    assert.doesNotMatch(html,/等待年份揭晓|年份已确定|class="candidate-list"/);
  }
  checkReel(p.app.innerHTML);const rows=frames(p.app.innerHTML);
  for(const row of rows){
    const year=Number(row.match(/· (\d{4})<\/small>/)?.[1]),team=row.match(/class="draw-pool-team">([^<]+)</)?.[1];
    assert.ok(D.pools.some(p=>p.year===year&&p.name===team),row);
  }
  p.advance(400);assert.deepEqual(frames(p.app.innerHTML),rows);
  p.advance(599);assert.doesNotMatch(p.app.innerHTML,/class="candidate-list"/);
  p.advance(1);assert.doesNotMatch(p.app.innerHTML,/draw-reel/);assert.match(p.app.innerHTML,/class="candidate-list"/);
  assert.ok(p.app.innerHTML.includes(`class="draw-pool-team">${pool.name}</strong>`));assert.ok(p.app.innerHTML.includes(`· ${pool.year}</small>`));
  assert.deepEqual(p.saved(),saved);
});
test('reduced-motion player draws reveal the complete pair without scrolling or extra rerolls',()=>{
  const p=page(G.start(45),{reduced:true});p.click('reroll',{kind:'both'});const saved=p.saved(),pool=G.currentPool(saved);
  assert.match(p.app.innerHTML,/正在抽取…/);assert.doesNotMatch(p.app.innerHTML,/draw-reel|class="candidate-list"/);
  p.advance(150);assert.ok(p.app.innerHTML.includes(`class="draw-pool-team">${pool.name}</strong>`));
  assert.ok(p.app.innerHTML.includes(`· ${pool.year}</small>`));assert.deepEqual(p.saved(),saved);
});
test('reroll animation masks candidate counts, blocks duplicate clicks and skip never changes the saved draw',()=>{
  const s=G.start(41),p=page(s);p.click('reroll',{kind:'both'});const saved=p.saved();
  assert.equal(saved.rerolls,s.rerolls-1);assert.notEqual(G.currentPool(saved).year,G.currentPool(s).year);assert.notEqual(G.currentPool(saved).team,G.currentPool(s).team);
  checkReel(p.app.innerHTML);assert.match(p.app.innerHTML,/揭晓后显示选手候选/);
  assert.equal((p.app.innerHTML.match(/data-action="reroll"/g)||[]).length,1);
  assert.doesNotMatch(p.app.innerHTML,/data-kind="(?:event|team)"/);
  p.click('reroll',{kind:'both'});assert.deepEqual(p.saved(),saved);
  p.click('skip-reveal');const html=p.app.innerHTML;assert.match(html,/class="candidate-list"/);
  p.advance(5000);assert.equal(p.app.innerHTML,html);assert.deepEqual(p.saved(),saved);
});
test('coach draws conceal counts and all eight teams until the year stops, including reduced-motion mode',()=>{
  const s=G.start(43);while(s.seats.slice(0,5).some(id=>!id))G.pick(s,G.eligible(s,G.currentPool(s))[0].id);
  for(const reduced of [false,true]){
    const p=page(s,{reduced});p.click('reroll',{kind:'event'});const saved=p.saved();
    assert.equal(saved.coachDraft.rerolls,0);assert.doesNotMatch(p.app.innerHTML,/class="coach-group"|team-draw/);
    assert.match(p.app.innerHTML,/揭晓后显示教练候选/);
    if(reduced){assert.doesNotMatch(p.app.innerHTML,/draw-reel/);assert.match(p.app.innerHTML,/正在抽取…/);}else checkReel(p.app.innerHTML);
    p.advance(reduced?149:799);assert.doesNotMatch(p.app.innerHTML,/class="coach-group"/);
    p.advance(1);assert.equal((p.app.innerHTML.match(/class="coach-group"/g)||[]).length,8);
    assert.deepEqual(p.saved(),saved);
  }
});

test('mobile roster expansion does not spend draws and a pick returns to the next reel',()=>{
  const s=G.start(48),p=page(s,{mobile:true});
  p.click('toggle-roster');assert.match(p.app.innerHTML,/aria-expanded="true"/);assert.deepEqual(p.saved(),s);
  p.click('pick',{card:G.eligible(s,G.currentPool(s))[0].id});
  assert.equal(p.saved().seats.filter(Boolean).length,1);assert.equal(p.saved().rerolls,s.rerolls);
  assert.match(p.app.innerHTML,/aria-expanded="false"/);assert.deepEqual(p.scrolled,['.draw-controls']);
  const drawn=p.saved();p.click('toggle-roster');p.advance(999);
  assert.doesNotMatch(p.app.innerHTML,/class="candidate-list"/);
  p.advance(1);assert.match(p.app.innerHTML,/class="candidate-list"/);assert.deepEqual(p.saved(),drawn);
});

test('ready screen keeps hero portraits while removing manual hero controls',()=>{
  const s=G.start(44);while(s.phase==='draft')G.pick(s,G.eligible(s,G.currentPool(s))[0].id);
  const p=page(s),html=p.app.innerHTML;
  assert.doesNotMatch(html,/data-preference|hero-select|优先选择英雄/);
  const expected=G.lineup(s).slice(0,5).reduce((n,c)=>n+c.heroes.slice(0,3).length,0);
  assert.equal((html.match(/class="hero-portrait"/g)||[]).length,expected);
  assert.doesNotMatch(html,/data-action="tactic"|选择本届战术/);assert.match(html,/data-action="simulate"/);
  assert.doesNotMatch(html,/data-action="year"|year-button|选择生涯起点/);assert.match(html,/生涯起点 · TI1（2011）/);assert.match(html,/征战 TI1/);
  const saved=p.saved();p.click('tactic',{tactic:'tempo'});p.click('year',{year:'2026'});assert.deepEqual(p.saved(),saved);
});

test('continued careers show their next event without a year selector',()=>{
  const s=G.start(45);while(s.phase==='draft')G.pick(s,G.eligible(s,G.currentPool(s))[0].id);
  G.finish(s);G.next(s);
  const p=page(s);assert.match(p.app.innerHTML,/下一站 · TI2（2012）/);assert.match(p.app.innerHTML,/征战 TI2/);
  assert.doesNotMatch(p.app.innerHTML,/data-action="year"|year-button|生涯起点/);
});

test('coach draft, archive and detail show career statistics instead of hero portraits',()=>{
  const s=G.start(46);while(s.seats.slice(0,5).some(id=>!id))G.pick(s,G.eligible(s,G.currentPool(s))[0].id);
  const p=page(s);assert.doesNotMatch(p.app.innerHTML,/hero-portrait|常用英雄/);
  for(const label of ['擅长风格','历史胜率','历史局数','最高成绩'])assert.ok(p.app.innerHTML.includes(label));
  p.click('card-detail',{card:'2022-tundra-coach-aui2000'});
  assert.doesNotMatch(p.modal.innerHTML,/hero-portrait|常用英雄/);
  assert.match(p.modal.innerHTML,/68.0%/);assert.match(p.modal.innerHTML,/100 局/);assert.match(p.modal.innerHTML,/冠军 × 2/);
  assert.match(p.modal.innerHTML,/逐届执教记录与来源/);assert.doesNotMatch(p.modal.innerHTML,/TI5 · 2015/);
  p.click('card-detail',{card:'2025-xtreme-coach-xiao8'});assert.match(p.modal.innerHTML,/亚军 × 2/);
  const archivePage=page(s,{route:'archive'});archivePage.change('archive-role','6');const archive=archivePage.archive();
  const coachCards=[...archive.matchAll(/<button class="archive-card coach-card"[\s\S]*?<\/button>/g)];assert.ok(coachCards.length);
  for(const [html] of coachCards){assert.doesNotMatch(html,/hero-portrait|常用英雄/);assert.match(html,/历史胜率/);}
});

test('rename form escapes user text and result reports keep the name used for that event',()=>{
  const s=G.start(197);while(s.phase==='draft')G.pick(s,G.eligible(s,G.currentPool(s))[0].id);
  const p=page(s);p.click('rename-team');assert.match(p.modal.innerHTML,/team-name-form/);
  p.submitName('星火 <A&B>');assert.equal(p.saved().teamName,'星火 <A&B>');
  assert.match(p.app.innerHTML,/星火 &lt;A&amp;B&gt;/);assert.doesNotMatch(p.app.innerHTML,/<A&B>/);
  p.click('rename-team');p.submitName(' ');assert.equal(p.saved().teamName,'星火 <A&B>');
  p.click('simulate');p.advance(60);const result=p.saved().history[0];
  assert.match(p.app.innerHTML,/最终排名/);assert.doesNotMatch(p.app.innerHTML,/循环赛|积分|9 支战队/);
  assert.match(p.app.innerHTML,/assets\/aegis\/2011-2012.png/);
  p.click('rename-team');p.submitName('新队名');assert.equal(p.saved().teamName,'新队名');
  p.click('game-detail',{game:'0'});assert.match(p.modal.innerHTML,/星火 &lt;A&amp;B&gt;/);assert.doesNotMatch(p.modal.innerHTML,/新队名/);
  assert.deepEqual(p.saved().history[0],result);
});
