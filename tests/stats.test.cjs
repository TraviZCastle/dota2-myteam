const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const D=require('../data.js');
test('selectable coaches cover TI10 through TI15 with exactly one per top-eight team',()=>{
 assert.equal(D.cards.length,648);assert.equal(D.coachCards.length,48);
 assert.deepEqual(D.coachYears,[2021,2022,2023,2024,2025,2026]);
 for(const year of D.years){
  const coaches=D.coachCards.filter(c=>c.year===year);
  assert.equal(coaches.length,year>=2021?8:0);assert.equal(D.eventMap[year].coachCards,coaches.length);
  for(const p of D.pools.filter(p=>p.year===year))assert.equal(p.cards.filter(c=>c.role===6).length,year>=2021?1:0);
 }
 assert.equal(D.coachCards.find(c=>c.poolId==='2025-xtreme').name,'xiao8');
 for(const c of D.coachCards){assert.ok(c.coachHistory.games>0);assert.ok(c.coachHistory.winRate>0);}
 const xiao=D.cardMap['2025-xtreme-coach-xiao8'].coachHistory;
 assert.equal(xiao.bestFinish,'2');assert.equal(xiao.bestCount,2);
 assert.ok(!D.cardMap['2024-xtreme-coach-maps'].coachHistory.entries.some(e=>e.year===2025));
 assert.ok(!D.cardMap['2023-ar-coach-lanm'].coachHistory.entries.some(e=>e.poolId==='2025-xtreme'));
 assert.ok(D.cardMap['2021-secret-coach-heen'].coachHistory.entries.some(e=>e.year===2017),'Earlier coaching honors remain in career stats');
});
test('15 editions, exactly eight teams and forty players per edition, no invented 2020',()=>{
 assert.equal(D.events.length,15);assert.equal(D.pools.length,120);assert.equal(D.cards.filter(c=>c.role<=5).length,600);
 assert.equal(D.eventMap[2021].number,10);assert.equal(D.eventMap[2026].number,15);assert.ok(!D.years.includes(2020));
 assert.equal(new Set(D.cards.map(c=>c.id)).size,D.cards.length);
 for(const year of D.years){const pools=D.pools.filter(p=>p.year===year);assert.equal(pools.length,8);assert.equal(new Set(pools.map(p=>p.team)).size,8);for(const p of pools){assert.deepEqual(p.cards.filter(c=>c.role<=5).map(c=>c.role),[1,2,3,4,5]);assert.ok(p.source.startsWith('https://'));}}
 assert.ok(D.poolMap['2018-optic']);assert.ok(!D.poolMap['2018-mineski']);assert.ok(D.poolMap['2019-rng']);assert.ok(!D.poolMap['2019-vp']);
});
test('all 560 TI2–TI2026 player cards join the exact account, team, event and observed hero counts',()=>{
 for(const year of D.years.filter(y=>y!==2011)){
  const raw=JSON.parse(fs.readFileSync(path.join(__dirname,`../data/events/${year}.json`))).rows;
  const matches=new Map(raw.map(m=>[m.match_id,m]));
  for(const c of D.cards.filter(c=>c.year===year&&c.role<=5)){
   assert.ok(c.stats.games>0,c.id);assert.equal(new Set(c.stats.matchIds).size,c.stats.games);
   assert.equal(Object.values(c.heroUsage).reduce((a,b)=>a+b,0),c.stats.games);
   let kills=0;
   for(const id of c.stats.matchIds){const m=matches.get(id);assert.ok(m);assert.equal(m.leagueid,D.eventMap[year].leagueId);const p=m.players.find(p=>c.stats.accountIds.includes(p.account_id));assert.ok(p);assert.equal(m[p.player_slot<128?'radiant_team_id':'dire_team_id'],c.stats.teamId);kills+=p.kills;}
   assert.ok(Math.abs(c.stats.kills-kills/c.stats.games)<.0001);
   for(const [key,n] of Object.entries(c.stats.samples)){assert.ok(n>=0&&n<=c.stats.games);assert.equal(c.stats[key]===null,n===0,c.id+'.'+key);}
  }
 }
});
test('TI1 metrics and unrecorded coaches remain absent; coach stats describe the team',()=>{
 for(const c of D.cards.filter(c=>c.year===2011&&c.role<=5)){assert.equal(c.stats,null);assert.equal(c.heroSource,'unavailable');assert.equal(Object.keys(c.heroUsage).length,0);}
 for(const p of D.pools){if(p.coachStatus==='not-recorded')assert.ok(p.cards.every(c=>c.role<=5));for(const c of p.cards.filter(c=>c.role===6)){assert.equal(c.stats,null);assert.equal(c.coachRecord.games,p.games);assert.equal(c.coachRecord.finish,p.finish);assert.equal(Object.values(c.heroUsage).reduce((a,b)=>a+b,0),p.games*5);}}
});
test('aliases, distinct similarly named people and event versions are correctly separated',()=>{
 assert.equal(D.personId('CCnC'),D.personId('Quinn'));assert.equal(D.personId('Somnus丶M'),D.personId('Maybe'));assert.equal(D.personId('sydm'),D.personId('Mikasa'));
 assert.notEqual(D.personId('Q (中国)'),D.personId('Q (泰国)'));assert.notEqual(D.personId('super (苏鹏)'),D.personId('Super'));
 const a=D.cardMap['2018-og-ana'].stats,b=D.cardMap['2019-og-ana'].stats;assert.equal(a.games,29);assert.equal(b.games,28);assert.notEqual(a.gpm,b.gpm);
 assert.equal(D.cardMap['2019-liquid-matumbaman'],undefined);assert.equal(D.cardMap['2018-liquid-matumbaman'].role,1);
 assert.deepEqual(D.cardMap['2014-lgd-dd'].stats.accountIds,[89371588]);assert.deepEqual(D.cardMap['2014-lgd-ddc'].stats.accountIds,[114239371]);
});
test('hero candidates exactly match the individual edition match records, including beyond the top six',()=>{
 const constants=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/research/heroes.json')));
 for(const year of D.years){
  const raw=year===2011?[]:JSON.parse(fs.readFileSync(path.join(__dirname,`../data/events/${year}.json`))).rows;
  const matches=new Map(raw.map(m=>[m.match_id,m]));
  for(const c of D.cards.filter(c=>c.year===year&&c.role<=5)){
   const observed={};
   for(const matchId of c.stats?.matchIds||[]){
    const p=matches.get(matchId).players.find(p=>c.stats.accountIds.includes(p.account_id));
    const id=constants[p.hero_id].name.replace('npc_dota_hero_','');observed[id]=(observed[id]||0)+1;
   }
   assert.deepEqual(c.heroUsage,observed,c.id);
   assert.deepEqual([...c.heroCandidates].sort(),Object.keys(observed).sort(),c.id);
   assert.equal(c.defaultHero,c.heroCandidates[0]||null);
  }
 }
 assert.equal(D.cardMap['2017-liquid-miracle'].heroCandidates.length,21);
 assert.notDeepEqual(D.cardMap['2018-og-ana'].heroCandidates,D.cardMap['2019-og-ana'].heroCandidates);
 assert.ok(D.cards.filter(c=>c.role===6).every(c=>!c.heroCandidates.length));
});
test('every displayed hero uses its official Chinese name with no English-name fallback',()=>{
 const source=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/research/heroes-zh.json'))).result.data.heroes;
 const names=new Map(source.map(h=>[h.name.replace('npc_dota_hero_',''),h.name_loc]));
 for(const h of D.heroes){assert.equal(h.name,names.get(h.id));assert.match(h.name,/[\u4e00-\u9fff]/);assert.doesNotMatch(h.name,/[a-z]/i);}
 assert.equal(D.heroMap.zuus.name,'宙斯');assert.equal(D.heroMap.queenofpain.name,'痛苦女王');
});

test('coach career totals join only coaching roster entries and sum raw TI match wins',()=>{
 const rosters=fs.readFileSync(path.join(__dirname,'../data/rosters.tsv'),'utf8').split('\n').filter(l=>/^\d{4}\|/.test(l)).map(l=>l.split('|'));
 const raw=new Map(D.years.map(y=>[y,y===2011?[]:JSON.parse(fs.readFileSync(path.join(__dirname,`../data/events/${y}.json`))).rows]));
 const people=new Map(D.cards.filter(c=>c.role===6).map(c=>[c.person,c]));
 for(const [person,c] of people){
  const rows=rosters.filter(r=>r[6].split(',').some(name=>name&&D.personId(name)===person));
  let games=0,wins=0;const finishes={};
  for(const r of rows){
   const matches=raw.get(Number(r[0])).filter(m=>[m.radiant_team_id,m.dire_team_id].includes(Number(r[2])));
   games+=matches.length;wins+=matches.filter(m=>(m.radiant_team_id===Number(r[2]))===m.radiant_win).length;
   finishes[r[3]]=(finishes[r[3]]||0)+1;
  }
  const history=c.coachHistory,best=Object.keys(finishes).sort((a,b)=>parseInt(a)-parseInt(b))[0];
  assert.equal(history.games,games,c.id);assert.equal(history.wins,wins,c.id);assert.equal(history.winRate,games?wins/games:null);
  assert.equal(history.bestFinish,best);assert.equal(history.bestCount,finishes[best]);assert.deepEqual(history.finishes,finishes);
  assert.deepEqual(history.entries.map(e=>e.poolId),rows.map(r=>r[0]+'-'+r[1]));
  for(const version of D.cards.filter(x=>x.role===6&&x.person===person))assert.deepEqual(version.coachHistory,history);
 }
});
test('coaching honors count repeated podiums but never include player titles or missing match samples',()=>{
 const aui=D.cardMap['2022-tundra-coach-aui2000'].coachHistory;
 assert.equal(aui.games,100);assert.equal(aui.wins,68);assert.equal(aui.bestFinish,'1');assert.equal(aui.bestCount,2);assert.ok(aui.entries.every(e=>e.year>=2022));
 const ceb=D.cardMap['2017-og-coach-ceb'].coachHistory;assert.equal(ceb.games,21);assert.equal(ceb.bestFinish,'7–8');assert.equal(ceb.bestCount,1);
 const qqq=D.cardMap['2018-lgd-coach-qqq'].coachHistory;assert.equal(qqq.bestFinish,'2');assert.equal(qqq.bestCount,2);
 const silent=D.cardMap['2021-spirit-coach-silent'].coachHistory;assert.equal(silent.bestCount,2);assert.equal(silent.winRate,43/57);
 const early=D.cardMap['2011-ehome-coach-71'].coachHistory;assert.equal(early.bestFinish,'2');assert.equal(early.games,65);assert.equal(early.winRate,40/65);assert.equal(early.missingEditions,1);
});

test('yearly Aegis assets cover every edition with verified image bytes',()=>{
  const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
  const root=path.resolve(__dirname,'../assets/aegis'),sources=JSON.parse(fs.readFileSync(path.join(root,'sources.json'),'utf8'));
  assert.deepEqual(sources.missingYears,[]);assert.equal(sources.assets.length,14);
  assert.deepEqual(sources.assets.flatMap(a=>a.years),D.years);
  for(const source of sources.assets){
    const bytes=fs.readFileSync(path.join(root,source.file));
    assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),source.sha256);
    for(const year of source.years)assert.equal(D.aegis[year].file,source.file);
  }
});
