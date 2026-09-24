const test=require('node:test');
const assert=require('node:assert/strict');
const D=require('../data.js'),G=require('../game.js'),C=require('../career.js');
const fs=require('node:fs'),vm=require('node:vm');

function fixture(){
  const cards=D.roles.map((_,i)=>D.cards.find(c=>c.role===i+1));
  const history=C.YEARS.map((year,i)=>({year,placement:i===1?'1':i===2?'2':'5–6',wins:i===1?9:2,losses:i===1?0:4,seats:cards.map(c=>c.id),champion:i===1?'myteam':'opponent',teamName:'旧队名',standings:[{id:i===1?'myteam':'opponent',name:i===1?'旧队名':'TI'+(i+1)+' 胜者'}]}));
  const incoming=D.cards.find(c=>c.role===1&&c.id!==cards[0].id);
  for(let i=7;i<15;i++)history[i].seats[0]=incoming.id;
  return {teamName:'星海 🛡️ <战队>',history,seats:cards.map(c=>c.id)};
}

test('summary uses the fifteen historical rosters, total map wins and exact tied placements',()=>{
  const state=fixture(),s=C.fromState(state,D),o=C.overview(s);
  assert.equal(o.champions.length,1);assert.equal(o.finals,2);
  assert.equal(o.wins,37);assert.equal(o.losses,56);assert.equal(o.winRate,(37/93*100).toFixed(1));
  assert.equal(s.events[0].placement,'5–6');assert.equal(C.changed(s,0,0),false);
  assert.equal(C.changed(s,7,0),true);assert.equal(C.changed(s,8,0),false);
  assert.equal(C.changed(s,7,5),false);
  assert.notEqual(s.events[14].seats[0],s.events[0].seats[0]);
  assert.deepEqual(s.events[14].seats,s.events[13].seats);
  state.teamName='新队名';state.history[0].seats[0]='deleted';
  assert.equal(s.name,'星海 🛡️ <战队>');assert.ok(s.members[s.events[0].seats[0]]);
});

test('read-only links round-trip Unicode, card editions, transfers and stats without a catalog',()=>{
  const s=C.fromState(fixture(),D),token=C.encode(s);
  assert.deepEqual(C.decode(token),s);assert.match(token,/^[\w-]+$/);
  assert.equal(C.url(s),C.HOME+'#share='+token);assert.ok(C.url(s).length<4000);
  const decoded=C.decode(token);decoded.members[0].name='Changed';
  assert.notEqual(C.decode(token).members[0].name,'Changed');
});

test('no championships shows every joint-best edition; an undefeated career shows all 15 shields',()=>{
  const f=fixture();f.history.forEach(e=>e.placement='7–8');f.history[2].placement='5–6';f.history[14].placement='5–6';
  let o=C.overview(C.fromState(f,D));assert.equal(o.champions.length,0);assert.equal(o.finals,0);assert.deepEqual(o.best.map(e=>e.year),[2013,2026]);
  f.history.forEach(e=>{e.placement='1';e.wins=8;e.losses=0;});
  o=C.overview(C.fromState(f,D));assert.equal(o.champions.length,15);assert.equal(o.finals,15);assert.equal(o.winRate,'100.0');
});

test('incomplete, missing, reordered or malformed records fail instead of inventing data',()=>{
  const s=C.fromState(fixture(),D);
  const mutations=[x=>x.events.pop(),x=>x.events.reverse(),x=>x.events[0].seats.pop(),x=>x.events[0].seats[0]=x.events[0].seats[1],x=>x.events[0].wins=-1,x=>x.events[0].losses=null,x=>x.events[0].placement='5',x=>x.members[0].role=6,x=>x.members[0].name='',x=>x.name='x'.repeat(25)];
  for(const change of mutations){const invalid=structuredClone(s);change(invalid);assert.throws(()=>C.validate(invalid));}
  assert.throws(()=>C.fromState({...fixture(),history:[]},D),/完成 TI15/);
  const missing=fixture();missing.history[0].seats[0]='missing';assert.throws(()=>C.fromState(missing,D),/未能读取/);
  for(const token of ['', '%broken', 'a'.repeat(18001), C.encode(s).slice(0,-2)])assert.throws(()=>C.decode(token));
  const raw=JSON.parse(Buffer.from(C.encode(s),'base64url').toString());raw[3][1][3]=[0,0,0,1];
  assert.throws(()=>C.decode(Buffer.from(JSON.stringify(raw)).toString('base64url')));
});

test('a real completed production career is shareable and serialization never changes the save',()=>{
  const s=G.start(431);while(s.phase==='draft')G.pick(s,G.eligible(s,G.currentPool(s))[0].id);
  do{G.finish(s);}while(G.next(s));
  const before=JSON.stringify(s),snapshot=C.fromState(s,D);
  assert.deepEqual(C.decode(C.encode(snapshot)),snapshot);
  assert.equal(JSON.stringify(s),before);assert.equal(snapshot.events.length,15);
  const maps=s.history.flatMap(e=>e.games).filter(g=>g.a==='myteam'||g.b==='myteam');
  const won=maps.filter(g=>(g.winner===0?g.a:g.b)==='myteam').length;
  assert.equal(C.overview(snapshot).wins,won);assert.equal(C.overview(snapshot).losses,maps.length-won);
  snapshot.events.forEach((e,i)=>assert.equal(e.champion,s.history[i].standings.find(t=>t.id===s.history[i].champion).name));
});

test('public share rendering escapes team and member text; URL content cannot inject HTML',()=>{
  const window={DotaCareer:C};vm.runInNewContext(fs.readFileSync(require.resolve('../career-view.js'),'utf8'),{window});
  const s=C.fromState(fixture(),D);s.members[0].name='<img src=x onerror=alert(1)>';s.events[0].champion='<svg onload=alert(1)>';
  const html=window.DotaCareerView.page(C.decode(C.encode(s)),true);
  assert.ok(html.includes('&lt;战队&gt;'));assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!html.includes('<img src=x'));assert.equal((html.match(/scope="row"/g)||[]).length,15);
  assert.ok(html.includes('&lt;svg onload=alert(1)&gt;'));assert.ok(!html.includes('<svg onload='));
});

test('champion names come from each simulated edition and stay frozen after team renames',()=>{
  const state=fixture(),snapshot=C.fromState(state,D);
  assert.equal(snapshot.version,2);assert.equal(snapshot.events[0].champion,'TI1 胜者');
  assert.equal(snapshot.events[1].champion,'旧队名');
  state.teamName='新队名';state.history[1].standings[0].name='不应改变快照';
  assert.equal(C.decode(C.encode(snapshot)).events[1].champion,'旧队名');
  const window={DotaCareer:C};vm.runInNewContext(fs.readFileSync(require.resolve('../career-view.js'),'utf8'),{window});
  const html=window.DotaCareerView.page(snapshot,true);
  assert.ok(html.includes('当届冠军'));assert.ok(html.includes('TI1 胜者'));
  assert.equal((html.match(/class="career-season-champion"/g)||[]).length,15);
});

test('legacy links remain readable without inventing missing champions; new links require names',()=>{
  const raw=JSON.parse(Buffer.from(C.encode(C.fromState(fixture(),D)),'base64url').toString());
  raw[0]=1;raw[3].forEach(row=>row.pop());
  const old=C.decode(Buffer.from(JSON.stringify(raw)).toString('base64url'));
  assert.equal(old.version,1);assert.ok(old.events.every(e=>e.champion===undefined));
  assert.deepEqual(C.decode(C.encode(old)),old);
  const window={DotaCareer:C};vm.runInNewContext(fs.readFileSync(require.resolve('../career-view.js'),'utf8'),{window});
  assert.equal((window.DotaCareerView.page(old,true).match(/未记录/g)||[]).length,15);
  const snapshot=C.fromState(fixture(),D);
  for(const bad of [null,'','x'.repeat(65),{}]){snapshot.events[0].champion=bad;assert.throws(()=>C.validate(snapshot));}
  const missing=fixture();delete missing.history[0].standings;assert.throws(()=>C.fromState(missing,D),/缺少当届冠军记录/);
});
