const test=require('node:test');
const assert=require('node:assert/strict');
const D=require('../data.js');
const G=require('../game.js');
function fill(seed){const s=G.start(seed),random=G.rng(seed+99);while(s.phase==='draft'){const candidates=G.eligible(s,G.currentPool(s));assert.ok(candidates.length);assert.ok(G.pick(s,candidates[Math.floor(random()*candidates.length)].id));}return s;}
function team(pool){return {cards:pool.cards.filter(c=>c.role<=5),coach:pool.cards.find(c=>c.role===6),tactic:'balanced',preferences:{}};}

test('100 seeded drafts finish five players then a distinct historical coach without dead ends',()=>{
  for(let seed=1;seed<=100;seed++){
    const s=G.start(seed);
    for(let i=0;i<6;i++){
      const candidates=G.eligible(s,G.currentPool(s));assert.ok(candidates.length);
      assert.ok(candidates.every(c=>i===5?c.role===6:c.role<=5));
      assert.ok(G.pick(s,candidates[Math.floor(G.rng(seed+i)()*candidates.length)].id));
      assert.equal(s.phase,i===5?'ready':'draft');
    }
    assert.deepEqual(G.lineup(s).map(c=>c.role),[1,2,3,4,5,6]);
    assert.equal(new Set(G.lineup(s).map(c=>c.person)).size,6);
    assert.deepEqual(G.validate(JSON.parse(JSON.stringify(s))),s);
  }
});
test('one player reroll changes both year and team, spends one shared use and refuses separate draws',()=>{
  const s=G.start(20);
  for(const kind of ['event','team','invalid']){const before=JSON.stringify(s);assert.equal(G.draw(s,kind),false);assert.equal(JSON.stringify(s),before);}
  for(let i=0;i<3;i++){
    const before=G.currentPool(s);assert.ok(G.draw(s,'both'));
    assert.notEqual(G.currentPool(s).year,before.year);assert.notEqual(G.currentPool(s).team,before.team);
    assert.equal(s.rerolls,2-i);assert.ok(G.eligible(s,G.currentPool(s)).length);
    assert.deepEqual(G.validate(JSON.parse(JSON.stringify(s))),s);
  }
  const saved=JSON.stringify(s);assert.equal(G.draw(s,'both'),false);assert.equal(JSON.stringify(s),saved);
  const exhausted=fill(21);exhausted.phase='draft';const before=JSON.stringify(exhausted);
  assert.equal(G.draw(exhausted,'both'),false);assert.equal(JSON.stringify(exhausted),before);
});
test('legacy reroll counters migrate consumed clicks once and preserve lineups, coach budget and history',()=>{
  const s=fill(22);G.finish(s);const original=structuredClone(s);
  for(let event=0;event<=3;event++)for(let team=0;team<=3;team++){
    const legacy={...structuredClone(original),rerolls:{event,team}},restored=G.validate(legacy);
    assert.equal(restored.rerolls,Math.max(0,event+team-3));
    assert.deepEqual({...restored,rerolls:original.rerolls},original);
    assert.deepEqual(G.validate(restored),restored);assert.deepEqual(legacy.rerolls,{event,team});
  }
  for(const rerolls of [-1,4,1.5,null,{},[],{event:4,team:3},{event:3,team:-1}])assert.throws(()=>G.validate({...s,rerolls}),/抽签/);
});
test('every player round excludes all previously drawn teams across years and reloads',()=>{
  for(let seed=1;seed<=50;seed++)for(let round=0;round<5;round++){
    let s=G.start(seed);
    for(let i=0;i<round;i++)assert.ok(G.pick(s,G.eligible(s,G.currentPool(s))[0].id));
    const seen=new Set([G.currentPool(s).team]);
    for(let i=0;i<3;i++){
      assert.ok(G.alternatives(s,'both').every(p=>!seen.has(p.team)));
      const year=G.currentPool(s).year;assert.ok(G.draw(s,'both'));
      const current=G.currentPool(s);assert.notEqual(current.year,year);assert.ok(!seen.has(current.team),`seed ${seed}, round ${round}`);seen.add(current.team);
      assert.deepEqual(s.drawnTeams,[...seen]);assert.equal(s.rerolls,2-i);
      s=G.validate(JSON.parse(JSON.stringify(s)));assert.deepEqual(s.drawnTeams,[...seen]);
    }
    assert.ok(G.pick(s,G.eligible(s,G.currentPool(s))[0].id));
    if(round<4){
      assert.deepEqual(s.drawnTeams,[G.currentPool(s).team]);
      const candidates=G.alternatives(s,'both');
      for(const p of D.pools.filter(p=>seen.has(p.team)&&p.team!==G.currentPool(s).team&&p.year!==G.currentPool(s).year&&G.eligible(s,p).length))assert.ok(candidates.some(x=>x.id===p.id),'previous rounds do not blacklist teams');
    }
  }
});
test('replacement rerolls keep seen teams through cancellation, reload and coach switching',()=>{
  let s=fill(7);G.finish(s);const drafted=[...s.drawnTeams];assert.ok(G.beginReplacement(s));
  const seen=new Set([G.currentPool(s).team]);
  for(let i=0;i<4;i++){
    assert.ok(G.draw(s,'both'));const team=G.currentPool(s).team;assert.ok(!seen.has(team));seen.add(team);
    assert.ok(G.replacementTarget(s,6));const coachDraw=structuredClone(s.replacement.coachDraft);
    G.cancelReplacement(s);s=G.validate(JSON.parse(JSON.stringify(s)));assert.ok(G.beginReplacement(s));
    const role=[1,2,3,4,5].find(r=>G.canReplaceRole(s,r));assert.ok(G.replacementTarget(s,role));
    assert.deepEqual(s.replacement.drawnTeams,[...seen]);assert.deepEqual(s.replacement.coachDraft,coachDraw);
    assert.deepEqual(s.drawnTeams,drafted);
  }
  const before=JSON.stringify(s);assert.equal(G.draw(s,'both'),false);assert.equal(JSON.stringify(s),before);
});
test('each new offseason grants one usable reroll without duplicating it on resume or coach switches',()=>{
  let s=G.start(113);
  for(let i=0;i<3;i++)assert.ok(G.draw(s,'both'));
  while(s.phase==='draft')assert.ok(G.pick(s,G.eligible(s,G.currentPool(s))[0].id));
  G.finish(s);assert.equal(s.rerolls,0);
  for(let round=0;round<2;round++){
    assert.ok(G.beginReplacement(s));assert.equal(s.rerolls,1);assert.equal(s.replacementRerollBonuses,round+1);
    assert.equal(G.beginReplacement(s),false);
    s=G.validate(JSON.parse(JSON.stringify(s)));assert.equal(s.rerolls,1);
    assert.ok(G.cancelReplacement(s));s=G.validate(s);assert.ok(G.beginReplacement(s));assert.equal(s.rerolls,1);
    assert.ok(G.replacementTarget(s,6));assert.ok(G.draw(s,'event'));assert.equal(s.rerolls,1);
    const role=[1,2,3,4,5].find(role=>G.canReplaceRole(s,role));assert.ok(G.replacementTarget(s,role));
    const previous=G.currentPool(s);assert.ok(G.draw(s,'both'));assert.equal(s.rerolls,0);
    assert.notEqual(G.currentPool(s).team,previous.team);assert.notEqual(G.currentPool(s).year,previous.year);
    G.cancelReplacement(s);s=G.validate(s);G.beginReplacement(s);assert.equal(s.rerolls,0);assert.equal(G.draw(s,'both'),false);
    const card=G.eligible(s,G.currentPool(s))[0];G.replacementTarget(s,card.role);assert.ok(G.pick(s,card.id));
    assert.equal(G.beginReplacement(s),false);assert.equal(G.validate(s).rerolls,0);
    assert.ok(G.next(s));assert.equal(s.rerolls,0);G.finish(s);
  }
});
test('unused offseason rerolls accumulate, keep long draw histories valid and stop at career end',()=>{
  let s=fill(114);
  const skipped=structuredClone(s);G.finish(skipped);G.next(skipped);
  assert.equal(skipped.rerolls,3);assert.equal(skipped.replacementRerollBonuses,0);
  for(let round=0;round<G.MAX_EVENTS;round++){
    G.finish(s);
    if(round===G.MAX_EVENTS-1){
      const before=JSON.stringify(s);assert.equal(G.beginReplacement(s),false);assert.equal(JSON.stringify(s),before);break;
    }
    const before=s.rerolls;assert.ok(G.beginReplacement(s));assert.equal(s.rerolls,before+1);
    s=G.validate(s);assert.equal(s.replacementRerollBonuses,round+1);
    if(round===G.MAX_EVENTS-2){
      assert.equal(s.rerolls,12);const seen=new Set([G.currentPool(s).team]);
      while(s.rerolls){
        assert.ok(G.draw(s,'both'));assert.ok(!seen.has(G.currentPool(s).team));seen.add(G.currentPool(s).team);
        s=G.validate(JSON.parse(JSON.stringify(s)));assert.deepEqual(s.replacement.drawnTeams,[...seen]);
      }
      assert.equal(seen.size,13);
    }
    G.cancelReplacement(s);assert.ok(G.next(s));
  }
  assert.equal(G.validate(s).replacementRerollBonuses,9);
  for(const replacementRerollBonuses of [-1,10,1.5,null])assert.throws(()=>G.validate({...s,replacementRerollBonuses}),/抽签/);
  assert.throws(()=>G.validate({...s,rerolls:13}),/抽签/);
  const legacy=fill(115);delete legacy.replacementRerollBonuses;
  assert.equal(G.validate(legacy).replacementRerollBonuses,0);
  assert.throws(()=>G.validate({...legacy,replacementRerollBonuses:1}),/抽签/);
});
test('draw history validates team identities and initializes absent older history from the current team',()=>{
  const s=G.start(7),team=G.currentPool(s).team,legacy=structuredClone(s);delete legacy.drawnTeams;
  assert.deepEqual(G.validate(legacy).drawnTeams,[team]);
  for(const drawnTeams of [null,[],[team,team],['unknown'],['toString'],[...new Set(D.pools.map(p=>p.team))]])assert.throws(()=>G.validate({...s,drawnTeams}),/抽签记录/);
  const other=D.pools.find(p=>p.team!==team).team;assert.throws(()=>G.validate({...s,drawnTeams:[other]}),/抽签记录/);
});
test('duplicate identities are blocked across aliases, years, player and coach roles',()=>{
  const s=G.start(4);s.poolId='2024-gg';assert.ok(G.pick(s,'2024-gg-quinn'));
  assert.equal(G.canPick(s,D.cardMap['2018-optic-quinn']),false);
  const t=G.start(3);t.poolId='2015-eg';assert.ok(G.pick(t,'2015-eg-aui2000'));
  assert.equal(G.canPick(t,D.cardMap['2025-falcons-coach-aui2000']),false);
  const before=JSON.stringify(t);assert.equal(G.pick(t,'2015-eg-aui2000'),false);assert.equal(JSON.stringify(t),before);
});
test('BP picks ten compatible unique heroes and four disjoint bans across the full archive',()=>{
  for(let i=0;i<D.pools.length;i++){
    const a=team(D.pools[i]),b=team(D.pools[(i+3)%D.pools.length]),bp=G.autoDraft(a,b,G.rng(i),i%2);
    assert.equal(new Set([...bp.a,...bp.b,...bp.banned]).size,14);
    for(const side of [bp.a,bp.b])side.forEach((id,role)=>assert.ok(D.heroMap[id].roles.includes(role+1)));
    assert.equal(bp.decisions.length,14);assert.ok(bp.coachFit.every(v=>v>=0&&v<=1));
  }
});
test('changing only the coach changes BP; missing historical samples remain neutral',()=>{
  const a=team(D.poolMap['2018-og']),b=team(D.poolMap['2024-liquid']);
  const other={...a,coach:D.cardMap['2021-lgd-coach-xiao8']};
  let changed=0;for(let seed=0;seed<15;seed++){
    const first=G.autoDraft(a,b,G.rng(seed),0),second=G.autoDraft(other,b,G.rng(seed),0);
    if(JSON.stringify(first.a)!==JSON.stringify(second.a))changed++;
  }
  assert.ok(changed>0);assert.notEqual(G.coachFit(a.coach,'tempo'),G.coachFit(other.coach,'tempo'));
  assert.equal(G.coachFit(D.cardMap['2011-ehome-coach-71'],'tempo'),0);
  assert.ok(D.cards.filter(c=>c.year===2011).every(c=>c.strength===0));
});
test('tournament results are deterministic and agree with destroyed bases and the bracket',()=>{
  const s=fill(320),a=G.tournament(s),b=G.tournament(s);assert.deepEqual(a,b);
  assert.equal(a.standings.length,9);assert.equal(a.groupSeries.length,36);assert.equal(a.bracket.length,14);
  assert.equal(a.standings.reduce((n,x)=>n+x.wins,0),72);assert.ok(a.standings.every(x=>x.wins+x.losses===16));
  for(const g of a.games){assert.equal(g.bases[1-g.winner],0);assert.ok(g.bases[g.winner]>0);assert.equal(g.events.at(-1).side,g.winner);assert.ok(g.minutes>0);assert.ok(g.towers.every(n=>n>=0&&n<=9));assert.equal(g.draft.coaches[g.a==='myteam'?0:1],G.lineup(s)[5].name);}
  for(const m of a.bracket){assert.equal(Math.max(...m.score),m.bestOf===5?3:2);assert.ok(Math.min(...m.score)<Math.max(...m.score));}
  assert.equal(a.bracket.at(-1).winner,a.champion);
});
test('coach can be replaced once, cancellation preserves candidates, old result stays immutable',()=>{
  const s=fill(20);G.finish(s);const old=JSON.stringify(s.history[0]);
  assert.ok(G.beginReplacement(s));const poolId=s.replacement.poolId;
  G.cancelReplacement(s);G.beginReplacement(s);assert.equal(s.replacement.poolId,poolId);
  assert.ok(G.replacementTarget(s,6));const coach=G.eligible(s,G.currentPool(s))[0];
  assert.ok(G.pick(s,coach.id));assert.equal(s.replacementUsed,true);
  assert.equal(JSON.stringify(s.history[0]),old);assert.equal(G.beginReplacement(s),false);
  assert.ok(G.next(s));assert.equal(s.year,2012);assert.equal(G.validate(s).phase,'ready');
});
test('careers cap at ten consecutive events and skip 2020',()=>{
  const s=fill(3);
  for(let i=0;i<10;i++){G.finish(s);assert.equal(s.history.length,i+1);assert.equal(G.validate(s).phase,'result');if(i<9)assert.ok(G.next(s));}
  assert.equal(s.year,2021);assert.equal(G.next(s),false);assert.equal(G.beginReplacement(s),false);assert.equal(G.finish(s),false);
});
test('all fifteen historical tournament fields run; 2026 ends, and team names are preserved',()=>{
  const s=fill(8);
  for(const year of D.years){const t=structuredClone(s);t.year=year;const result=G.tournament(t);t.history=[result];t.phase='result';assert.equal(result.year,year);assert.equal(G.validate(t).phase,'result');assert.equal(G.next(t),year!==2026);if(year===2025)assert.ok(result.standings.some(x=>x.name==='BetBoom Team'));if(year===2026)assert.ok(result.standings.some(x=>x.name==='BoomBoys'));}
});
test('new and unplayed careers always begin at TI1 and advance to TI2',()=>{
  const draft=G.start(18);assert.equal(draft.year,2011);
  draft.year=2026;assert.equal(G.validate(draft).year,2011);
  const s=fill(18);s.year=2021;
  assert.equal(G.validate(s).year,2011);
  const result=G.finish(s);assert.equal(result.year,2011);assert.equal(s.year,2011);
  assert.deepEqual(result.standings.filter(t=>t.id!=='myteam').map(t=>t.name).sort(),D.pools.filter(p=>p.year===2011).map(p=>p.name).sort());
  assert.ok(G.next(s));assert.equal(s.year,2012);assert.equal(G.validate(s).year,2012);
  assert.equal(G.finish(s).year,2012);
});
test('incompatible, malformed, duplicate or skipped-event saved states are rejected',()=>{
  const s=fill(10);s.seats[1]=s.seats[0];assert.throws(()=>G.validate(s),/阵容|席位/);
  const t=G.start(5);t.rerolls=10;assert.throws(()=>G.validate(t),/抽签/);
  t.version='dota2-page-v1';assert.throws(()=>G.validate(t),/版本/);
  const u=fill(11);G.finish(u);G.next(u);u.year=2026;assert.throws(()=>G.validate(u),/阶段/);
});
test('automatic BP ignores legacy manual hero preferences for both sides',()=>{
  const a=team(D.poolMap['2017-liquid']),b=team(D.poolMap['2018-og']);
  const manualA={...a,preferences:Object.fromEntries(a.cards.map(c=>[c.role,c.heroCandidates.at(-1)]))};
  const manualB={...b,preferences:Object.fromEntries(b.cards.map(c=>[c.role,c.heroCandidates.at(-1)]))};
  for(let seed=0;seed<12;seed++)assert.deepEqual(G.autoDraft(manualA,manualB,G.rng(seed),seed%2),G.autoDraft(a,b,G.rng(seed),seed%2));
  assert.equal(G.setPreference,undefined);
});
test('old manual preferences are removed without changing lineup, progress or completed reports',()=>{
  const s=fill(26);G.finish(s);s.preferences={2:'invoker'};
  s.history[0].preferences={2:'invoker'};
  const before=structuredClone(s),restored=G.validate(s);
  assert.equal(restored.preferences,undefined);
  assert.deepEqual({...restored,preferences:before.preferences},before);
  assert.deepEqual(G.validate(restored),restored);assert.deepEqual(s,before);
});
test('TI1 picks and replacements keep missing hero samples absent with automatic BP',()=>{
  const s=G.start(42);s.poolId='2011-navi';
  const card=G.currentPool(s).cards.find(c=>c.role===1);
  assert.ok(G.pick(s,card.id));assert.equal(s.preferences,undefined);
  assert.deepEqual(card.heroUsage,{});assert.deepEqual(card.heroCandidates,[]);assert.deepEqual(G.validate(s),s);
  const t=fill(43);G.finish(t);assert.ok(G.beginReplacement(t));
  const replacement=D.cards.find(c=>c.year===2011&&c.role<=5&&G.canPick(t,c));
  t.replacement.poolId=replacement.poolId;
  assert.ok(G.replacementTarget(t,replacement.role));assert.ok(G.pick(t,replacement.id));
  assert.equal(t.preferences,undefined);assert.deepEqual(G.validate(t),t);
});

function coachRound(seed){const s=G.start(seed);while(s.seats.slice(0,5).some(id=>!id)){assert.ok(G.pick(s,G.eligible(s,G.currentPool(s))[0].id));}return s;}
test('coach rounds expose eight representatives with one separate year reroll and no team draw',()=>{
  const s=coachRound(77),playerRerolls=s.rerolls,year=s.coachDraft.year;
  assert.ok(G.isCoachDraft(s));assert.equal(s.coachDraft.rerolls,1);
  assert.deepEqual(G.alternatives(s),[2021,2022,2023,2024,2025,2026]);
  assert.equal(G.coachPools(year).length,8);
  const expected=D.coachCards.filter(c=>c.year===year);
  assert.deepEqual(G.currentPool(s).cards.map(c=>c.id),expected.map(c=>c.id));
  let before=JSON.stringify(s);assert.equal(G.draw(s,'team'),false);assert.equal(G.draw(s),false);assert.equal(JSON.stringify(s),before);
  assert.ok(G.draw(s,'event'));assert.notEqual(s.coachDraft.year,year);assert.equal(s.coachDraft.rerolls,0);assert.equal(s.rerolls,playerRerolls);
  const restored=G.validate(JSON.parse(JSON.stringify(s)));before=JSON.stringify(restored);
  assert.equal(G.draw(restored,'event'),false);assert.equal(JSON.stringify(restored),before);
  const lower=G.eligible(restored,G.currentPool(restored)).find(c=>!['1','2','3','4'].includes(D.poolMap[c.poolId].finish));
  assert.ok(lower);assert.ok(G.pick(restored,lower.id));assert.equal(restored.phase,'ready');
});
test('all 48 coach cards are obtainable while old editions, assistants and duplicate identities stay blocked',()=>{
  const s=coachRound(78),seen=new Set();
  for(const year of D.coachYears){
    s.coachDraft.year=year;const teams=G.coachPools(year),pool=G.currentPool(s);
    assert.equal(teams.length,8);assert.equal(pool.cards.length,8);
    for(const coach of pool.cards){
      const t=structuredClone(s);
      // Isolate every representative's reachability from ordinary person conflicts.
      t.seats=t.seats.map(id=>id&&D.cardMap[id].person===coach.person?D.cards.find(c=>c.role===D.cardMap[id].role&&!t.seats.some(other=>other&&D.cardMap[other].person===c.person)&&c.person!==coach.person).id:id);
      assert.ok(G.canPick(t,coach),coach.id);assert.ok(G.pick(t,coach.id),coach.id);seen.add(coach.id);
    }
  }
  assert.equal(seen.size,48);
  for(const year of D.years.filter(y=>y<2021))assert.deepEqual(G.coachPools(year),[]);
  for(const id of ['2017-liquid-coach-heen','2021-og-coach-sockshka','2024-liquid-coach-jabbz','2026-spirit-coach-milan']){
    assert.equal(G.canPick(s,D.cardMap[id]),false,id);assert.equal(G.pick(s,id),false,id);
  }
  s.seats[3]='2015-eg-aui2000';s.coachDraft.year=2025;
  assert.ok(G.currentPool(s).cards.some(c=>c.id==='2025-falcons-coach-aui2000'));
  assert.equal(G.pick(s,'2025-falcons-coach-aui2000'),false);
});
test('new coach pool rejects old save versions and removed coach seats',()=>{
  const s=fill(781);
  assert.throws(()=>G.validate({...s,version:'dota2-career-v2'}));
  assert.throws(()=>G.validate({...s,seats:[...s.seats.slice(0,5),'2017-liquid-coach-heen']}));
});
test('coach replacement keeps its year and spent reroll across cancellation, role switches and player rerolls',()=>{
  const s=fill(79);G.finish(s);assert.ok(G.beginReplacement(s));
  assert.ok(G.currentPool(s).cards.filter(c=>c.role===6).every(c=>!G.canPick(s,c)));
  assert.ok(G.replacementTarget(s,6));const firstYear=s.replacement.coachDraft.year;
  assert.ok(G.draw(s,'event'));assert.notEqual(s.replacement.coachDraft.year,firstYear);
  const draw=structuredClone(s.replacement.coachDraft);G.cancelReplacement(s);
  const restored=G.validate(s);assert.ok(G.beginReplacement(restored));assert.deepEqual(restored.replacement.coachDraft,draw);
  const role=[1,2,3,4,5].find(r=>G.canReplaceRole(restored,r));assert.ok(role);assert.ok(G.replacementTarget(restored,role));
  const previous=G.currentPool(restored),remaining=restored.rerolls;
  assert.ok(G.draw(restored,'both'));assert.equal(restored.rerolls,remaining-1);assert.notEqual(G.currentPool(restored).year,previous.year);assert.notEqual(G.currentPool(restored).team,previous.team);assert.deepEqual(restored.replacement.coachDraft,draw);
  assert.ok(G.replacementTarget(restored,6));assert.deepEqual(restored.replacement.coachDraft,draw);assert.equal(G.draw(restored,'event'),false);
  assert.ok(G.pick(restored,G.eligible(restored,G.currentPool(restored))[0].id));assert.deepEqual(restored.history,s.history);
});
test('coach round saves reject missing state, earlier years and invalid budgets',()=>{
  const valid=coachRound(80);
  assert.deepEqual(G.validate(valid),valid);
  const missing=structuredClone(valid);delete missing.coachDraft;assert.throws(()=>G.validate(missing));
  for(const year of [2011,2019,2020,2027]){
    const invalid=structuredClone(valid);invalid.coachDraft.year=year;assert.throws(()=>G.validate(invalid));
  }
  const invalid=structuredClone(valid);invalid.coachDraft.rerolls=2;assert.throws(()=>G.validate(invalid));
  const finished=fill(81);G.finish(finished);G.beginReplacement(finished);G.replacementTarget(finished,6);
  assert.deepEqual(G.validate(finished),finished);
  delete finished.replacement.coachDraft;assert.throws(()=>G.validate(finished));
});
test('match reports keep the correct five operators on both sides after replacement, including legacy results',()=>{
  const s=fill(84);const result=G.finish(s),original=JSON.stringify(result);
  assert.equal(Object.keys(result.lineups).length,9);
  for(const game of result.games)for(const side of ['a','b']){
    const teamId=game[side],players=G.matchLineup(result,teamId);
    const expected=teamId==='myteam'?result.seats.slice(0,5):D.pools.find(p=>p.year===result.year&&p.team===teamId).cards.filter(c=>c.role<=5).map(c=>c.id);
    assert.deepEqual(players.map(c=>c.id),expected);assert.deepEqual(players.map(c=>c.role),[1,2,3,4,5]);
    assert.equal(game.draft[side].length,players.length);
  }
  assert.ok(G.beginReplacement(s));
  const replacement=D.cards.find(c=>c.role===1&&G.canPick(s,c));s.replacement.poolId=replacement.poolId;
  assert.ok(G.replacementTarget(s,1));assert.ok(G.pick(s,replacement.id));
  assert.notEqual(s.seats[0],result.seats[0]);assert.equal(G.matchLineup(result,'myteam')[0].id,result.seats[0]);
  assert.equal(JSON.stringify(result),original);
  const legacy=structuredClone(result);delete legacy.lineups;
  for(const teamId of Object.keys(result.lineups))assert.deepEqual(G.matchLineup(legacy,teamId),G.matchLineup(result,teamId));
  assert.deepEqual(G.matchLineup(G.validate(JSON.parse(JSON.stringify(s))).history[0],'myteam').map(c=>c.id),result.seats.slice(0,5));
});

test('coach style controls picks, restored saves, simulations and replacement without rewriting history',()=>{
  const s=fill(90),coach=G.lineup(s)[5],style=coach.recommendedTactic;
  assert.equal(s.tactic,style);
  s.tactic=Object.keys(D.tactics).find(t=>t!==style);
  assert.equal(G.validate(s).tactic,style);
  const result=G.finish(s);assert.equal(result.tactic,style);assert.equal(s.tactic,style);
  for(const g of result.games)for(const [i,id] of [g.a,g.b].entries()){
    const c=id==='myteam'?coach:D.pools.find(p=>p.year===s.year&&p.team===id).cards.find(c=>c.role===6);
    assert.equal(g.draft.coachFit[i],G.coachFit(c,c?.recommendedTactic||'balanced'));
  }
  const recorded=JSON.stringify(s.history);assert.ok(G.beginReplacement(s));assert.ok(G.replacementTarget(s,6));
  const replacement=D.cards.find(c=>c.role===6&&c.recommendedTactic!==style&&G.canPick(s,c));assert.ok(replacement);
  s.replacement.coachDraft.year=replacement.year;assert.ok(G.pick(s,replacement.id));
  assert.equal(s.tactic,replacement.recommendedTactic);assert.equal(JSON.stringify(s.history),recorded);
  assert.ok(G.next(s));assert.equal(G.validate(s).tactic,replacement.recommendedTactic);
  assert.equal(G.finish(s).tactic,replacement.recommendedTactic);assert.equal(JSON.stringify(s.history.slice(0,1)),recorded);
});
