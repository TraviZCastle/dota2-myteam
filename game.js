(function(root,factory){
  const data=typeof module==='object'&&module.exports?require('./data.js'):root.DotaData;
  const api=factory(data);
  if(typeof module==='object'&&module.exports) module.exports=api; else root.DotaGame=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(D){
  'use strict';
  const VERSION='dota2-career-v3',MAX_EVENTS=10,START_YEAR=2011;
  const coachPools=year=>D.coachYears.includes(year)?D.pools.filter(p=>p.year===year):[];
  const coachIds=new Set(D.coachCards.map(c=>c.id));
  const teamIds=new Set(D.pools.map(p=>p.team));
  const byRole=Array.from({length:6},(_,i)=>D.cards.filter(c=>c.role===i+1&&(i!==5||coachIds.has(c.id))));
  const nextYear=s=>D.years[D.years.indexOf(s.year)+1];
  const canAdvance=s=>s.history.length<MAX_EVENTS&&Boolean(nextYear(s));
  const clone=x=>JSON.parse(JSON.stringify(x));
  const coachTactic=coach=>coach?.recommendedTactic||'balanced';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function rng(seed){let s=seed>>>0;return()=>{s=(s+0x6D2B79F5)>>>0;let t=Math.imul(s^(s>>>15),1|s);t^=t+Math.imul(t^(t>>>7),61|t);return((t^(t>>>14))>>>0)/4294967296;};}
  const pickOne=(list,random)=>list[Math.floor(random()*list.length)];
  function shuffle(list,random){const out=[...list];for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
  const isCoachDraft=s=>(s.phase==='draft'&&s.seats.slice(0,5).every(Boolean)&&!s.seats[5])||(s.phase==='replace'&&s.replacement?.target===6);
  const coachSelection=s=>s.phase==='replace'?s.replacement.coachDraft:s.coachDraft;
  const playerSelection=s=>s.phase==='replace'?s.replacement:s;
  function currentPool(s){
    if(isCoachDraft(s)){const year=coachSelection(s).year;return {id:'coaches-'+year,year,name:'当届八强教练',cards:coachPools(year).flatMap(p=>p.cards.filter(c=>c.role===6))};}
    return D.poolMap[s.phase==='replace'?s.replacement?.poolId:s.poolId];
  }
  function lineup(s){return s.seats.map(id=>id?D.cardMap[id]:null);}
  function canComplete(ids){
    if(!Array.isArray(ids)||ids.length!==6||ids.some(id=>id&&!D.cardMap[id]))return false;
    const occupied=new Set(ids.filter(Boolean).map(id=>D.cardMap[id].person));
    if(occupied.size!==ids.filter(Boolean).length)return false;
    function visit(role){if(role===6)return true;if(ids[role])return visit(role+1);for(const c of byRole[role]){if(occupied.has(c.person))continue;occupied.add(c.person);if(visit(role+1))return true;occupied.delete(c.person);}return false;}
    return visit(0);
  }
  function canPick(s,card){
    if(!card||!['draft','replace'].includes(s.phase))return false;
    if(card.role===6&&(!coachIds.has(card.id)||(s.phase==='replace'&&s.replacement.target!==6)))return false;
    const team=lineup(s);
    if(team.some(c=>c?.person===card.person))return false;
    if(s.phase==='draft'&&(s.seats[card.role-1]||(card.role===6&&!s.seats.slice(0,5).every(Boolean))))return false;
    if(s.phase==='replace'&&s.replacement.target!==null&&s.replacement.target!==card.role)return false;
    const ids=[...s.seats];ids[card.role-1]=card.id;
    return canComplete(ids);
  }
  function eligible(s,pool){return pool.cards.filter(c=>canPick(s,c));}
  function coachYears(s){return D.coachYears.filter(year=>coachPools(year).some(p=>p.cards.some(c=>c.role===6&&canPick(s,c))));}
  function alternatives(s,kind){
    if(isCoachDraft(s))return kind&&kind!=='event'?[]:coachYears(s).filter(year=>!kind||year!==coachSelection(s).year);
    if(kind&&kind!=='both')return [];
    const pool=currentPool(s),seen=new Set(playerSelection(s).drawnTeams||[pool?.team]);
    return D.pools.filter(p=>!seen.has(p.team)&&eligible(s,p).length&&(!kind||p.year!==pool.year));
  }
  function draw(s,kind){
    if(!['draft','replace'].includes(s.phase))return false;
    if(isCoachDraft(s)){
      const selection=coachSelection(s);
      if(kind?(kind!=='event'||selection.rerolls<1):selection.year!==null)return false;
      const years=alternatives(s,kind);if(!years.length)return false;
      const random=rng((s.seed+Math.imul(++s.drawStep,0x9e3779b9))>>>0);
      selection.year=pickOne(years,random);if(kind)selection.rerolls--;return true;
    }
    if(kind&&(kind!=='both'||s.rerolls<1))return false;
    const pools=alternatives(s,kind);if(!pools.length)return false;
    const random=rng((s.seed+Math.imul(++s.drawStep,0x9e3779b9))>>>0);
    const year=pickOne([...new Set(pools.map(p=>p.year))],random);
    const pool=pickOne(pools.filter(p=>p.year===year),random);
    const selection=playerSelection(s);
    selection.drawnTeams=[...(selection.drawnTeams||[]),pool.team];
    if(s.phase==='replace')s.replacement={...s.replacement,poolId:pool.id,target:null};else s.poolId=pool.id;
    if(kind)s.rerolls--;
    return true;
  }
  function start(seed){const s={version:VERSION,seed:seed>>>0,drawStep:0,phase:'draft',catalogVersion:D.version,coachPoolVersion:D.coachPoolVersion,seats:Array(6).fill(null),poolId:null,drawnTeams:[],rerolls:3,coachDraft:{year:null,rerolls:1},year:START_YEAR,tactic:'balanced',history:[],replacement:null,replacementUsed:false};draw(s);return s;}
  function pick(s,id){
    const card=D.cardMap[id];
    if(!currentPool(s)?.cards.some(c=>c.id===id)||!canPick(s,card))return false;
    if(s.phase==='replace'&&s.replacement.target!==card.role)return false;
    const replacing=s.phase==='replace';s.seats[card.role-1]=id;
    if(card.role===6)s.tactic=coachTactic(card);
    if(replacing){s.replacementUsed=true;s.replacement=null;s.phase='result';}
    else if(s.seats.every(Boolean))s.phase='ready';else{if(!isCoachDraft(s))s.drawnTeams=[];draw(s);}
    return true;
  }
  function beginReplacement(s){
    if(s.phase!=='result'||!canAdvance(s)||s.replacementUsed)return false;
    s.phase='replace';if(!s.replacement){s.replacement={poolId:null,drawnTeams:[],target:null,coachDraft:{year:null,rerolls:1}};draw(s);}return true;
  }
  function canReplaceRole(s,role){
    if(s.phase!=='replace'||![1,2,3,4,5,6].includes(role))return false;
    const test=clone(s);test.replacement.target=role;
    return role===6?coachYears(test).length>0:eligible(test,D.poolMap[s.replacement.poolId]).length>0;
  }
  function replacementTarget(s,role){
    if(!canReplaceRole(s,role))return false;
    s.replacement.target=role;if(role===6&&s.replacement.coachDraft.year===null)draw(s);return true;
  }
  function cancelReplacement(s){if(s.phase!=='replace')return false;s.phase='result';return true;}
  function next(s){if(s.phase!=='result'||!canAdvance(s))return false;s.year=nextYear(s);s.phase='ready';s.tactic=coachTactic(lineup(s)[5]);s.replacement=null;s.replacementUsed=false;return true;}
  function validate(value){
    const s=clone(value);
    if(s.version!==VERSION||s.catalogVersion!==D.version||!Number.isInteger(s.seed)||s.seed<0||s.seed>4294967295||!Number.isInteger(s.drawStep)||s.drawStep<1||!['draft','ready','result','replace'].includes(s.phase)||!D.years.includes(s.year)||!D.tactics[s.tactic])throw Error('存档版本或内容无效');
    if(!Array.isArray(s.seats)||s.seats.length!==6||s.seats.some((id,i)=>id!==null&&(!D.cardMap[id]||D.cardMap[id].role!==i+1)))throw Error('存档阵容无效');
    const people=lineup(s).filter(Boolean).map(c=>c.person);if(new Set(people).size!==people.length||(!s.seats.every(Boolean)&&s.phase!=='draft')||(s.seats.every(Boolean)&&s.phase==='draft'))throw Error('存档席位无效');
    if(s.rerolls&&typeof s.rerolls==='object'){
      if(Array.isArray(s.rerolls)||!['event','team'].every(k=>Number.isInteger(s.rerolls[k])&&s.rerolls[k]>=0&&s.rerolls[k]<=3))throw Error('存档抽签无效');
      // Each historical reroll counts once toward the shared three-use budget.
      s.rerolls=Math.max(0,s.rerolls.event+s.rerolls.team-3);
    }
    if(!Number.isInteger(s.rerolls)||s.rerolls<0||s.rerolls>3||!D.pools.some(p=>p.id===s.poolId))throw Error('存档抽签无效');
    // Automatic BP replaces manual preferences; completed reports remain untouched.
    delete s.preferences;
    s.tactic=coachTactic(lineup(s)[5]);
    if(!Array.isArray(s.history)||s.history.length>MAX_EVENTS||new Set(s.history.map(r=>r.year)).size!==s.history.length||s.history.some(r=>!D.years.includes(r.year)||!r.placement||!Array.isArray(r.standings)||!Array.isArray(r.bracket)||!Array.isArray(r.games)||!Array.isArray(r.seats)||r.seats.length!==6||r.seats.some(id=>!D.cardMap[id])))throw Error('存档赛果无效');
    if(!s.history.length)s.year=START_YEAR;
    if(['result','replace'].includes(s.phase)&&s.history.at(-1)?.year!==s.year)throw Error('存档缺少赛果');
    if(s.replacement&&(!D.pools.some(p=>p.id===s.replacement.poolId)||![null,1,2,3,4,5,6].includes(s.replacement.target)))throw Error('存档换人无效');
    for(const selection of [s,...(s.replacement?[s.replacement]:[])]){
      // Older saves can only establish the team currently on screen.
      if(selection.drawnTeams===undefined)selection.drawnTeams=[D.poolMap[selection.poolId].team];
      const seen=selection.drawnTeams;
      if(!Array.isArray(seen)||!seen.length||seen.length>4||new Set(seen).size!==seen.length||seen.some(team=>!teamIds.has(team))||seen.at(-1)!==D.poolMap[selection.poolId].team)throw Error('存档抽签记录无效');
    }
    if(s.phase==='replace'&&(!s.replacement||s.replacementUsed||!canAdvance(s)))throw Error('存档换人阶段无效');
    if(s.seats[5]&&!s.seats.slice(0,5).every(Boolean))throw Error('存档教练席位无效');
    if(s.history.some((r,i)=>i&&D.years.indexOf(r.year)!==D.years.indexOf(s.history[i-1].year)+1))throw Error('存档赛事顺序无效');
    if(s.phase==='ready'&&s.history.length&&(s.history.length>=MAX_EVENTS||D.years.indexOf(s.year)!==D.years.indexOf(s.history.at(-1).year)+1))throw Error('存档赛事阶段无效');
    if(s.coachPoolVersion!==D.coachPoolVersion||(s.seats[5]&&!coachIds.has(s.seats[5])))throw Error('存档教练池版本无效');
    for(const selection of [s.coachDraft,...(s.replacement?[s.replacement.coachDraft]:[])]){
      if(!selection||![0,1].includes(selection.rerolls)||(selection.year!==null&&!D.coachYears.includes(selection.year))||(selection.year===null&&selection.rerolls!==1))throw Error('存档教练抽签无效');
    }
    function checkCoachYear(context){
      const selection=coachSelection(context),years=coachYears(context);
      if(!years.includes(selection.year))throw Error('存档教练候选无效');
    }
    if(s.phase==='draft'&&isCoachDraft(s))checkCoachYear(s);
    if(s.replacement?.target===6){
      checkCoachYear({...s,phase:'replace'});
    }
    return s;
  }
  function vector(ids){const values=ids.map(id=>D.heroMap[id]);return ['farm','tempo','push','control','save'].map(k=>values.reduce((n,h)=>n+h[k],0)/5);}
  function coachFit(coach,tactic){
    return coach?.tacticFits?.[tactic]||0;
  }
  function experience(card,id){const counts=Object.values(card?.heroUsage||{});return counts.length?(card.heroUsage[id]||0)/Math.max(...counts):0;}
  function autoDraft(a,b,random,first){
    const teams=[a,b].map(t=>({...t,tactic:coachTactic(t.coach)})),banned=[],used=new Set(),picks=[[],[]],roles=[0,0],decisions=[];
    // Keep a large per-role reserve so flexible heroes cannot exhaust a later seat.
    const safe=id=>[1,2,3,4,5].every(role=>D.heroes.filter(h=>h.id!==id&&h.roles.includes(role)&&!used.has(h.id)).length>=10);
    for(let i=0;i<4;i++){
      const side=(i+(first?1:0))%2,team=teams[side],opponent=teams[1-side];
      const candidates=D.heroes.filter(h=>!used.has(h.id)&&safe(h.id));
      const ranked=candidates.map(h=>({h,score:random()*2+(team.coach?Math.max(...opponent.cards.slice(0,5).map(c=>experience(c,h.id)))*3:0)})).sort((x,y)=>y.score-x.score);
      const id=ranked[0].h.id;banned.push(id);used.add(id);
      decisions.push({kind:'ban',side,hero:id,coach:team.coach?.name||null});
    }
    const order=[0,1,1,0,0,1,1,0,0,1].map(x=>first?1-x:x);
    for(const side of order){
      const role=++roles[side],team=teams[side],card=team.cards[role-1];
      const candidates=D.heroes.filter(h=>h.roles.includes(role)&&!used.has(h.id));
      const ranked=candidates.map(h=>({h,score:D.heroScore(h,team.tactic)+experience(card,h.id)*3+experience(team.coach,h.id)*2+random()*2})).sort((x,y)=>y.score-x.score);
      const hero=ranked[0].h.id;picks[side].push(hero);used.add(hero);
      decisions.push({kind:'pick',side,role,hero,coach:team.coach?.name||null,coachExperience:experience(team.coach,hero)});
    }
    return {banned,a:picks[0],b:picks[1],decisions,coaches:teams.map(t=>t.coach?.name||null),coachFit:teams.map(t=>coachFit(t.coach,t.tactic))};
  }
  function playMap(a,b,random,first){
    const draft=autoDraft(a,b,random,first),vectors=[vector(draft.a),vector(draft.b)],sides=[a,b].map(t=>({...t,tactic:coachTactic(t.coach)}));
    const score=[{kills:0,towers:0,base:100,gold:0},{kills:0,towers:0,base:100,gold:0}];
    const events=[];let minutes=0,turn=0;
    while(score[0].base>0&&score[1].base>0){
      minutes+=1.1+random()*1.3;turn++;
      for(let side=0;side<2;side++){const v=vectors[side];const late=minutes>25;const farming=sides[side].tactic==='protect'?(late?1.18:.83):1;score[side].gold+=(950+v[0]*70)*farming*(1+score[side].towers*.018);}
      const power=vectors.map((v,i)=>{
        const tactic=sides[i].tactic;
        const timing=tactic==='protect'?(minutes<20?-.35:.35):tactic==='tempo'?(minutes<20?.3:-.15):tactic==='push'?(minutes<30?.15:-.15):0;
        const ability=sides[i].cards.slice(0,5).reduce((n,c)=>n+(c.strength||0),0)/5;
        return ability*.35+draft.coachFit[i]*.2+v[1]*.2+v[3]*.2+v[4]*.12+Math.log1p(score[i].gold)*.6+timing;
      });
      const chance=clamp(.5+(power[0]-power[1])*.14,.2,.8),side=random()<chance?0:1,other=1-side;
      const kills=1+Math.floor(random()*4);score[side].kills+=kills;score[other].kills+=Math.floor(random()*2);score[side].gold+=kills*320;
      if(turn>3){
        if(score[side].towers<9){const count=Math.min(9-score[side].towers,1+(vectors[side][2]>3&&random()<.5?1:0));score[side].towers+=count;events.push({minute:Math.round(minutes),side,text:`团战取胜，推进 ${count} 座防御塔`});}
        else{const damage=20+vectors[side][2]*4+Math.floor(random()*12);score[other].base=Math.max(0,score[other].base-damage);events.push({minute:Math.round(minutes),side,text:score[other].base===0?'攻破远古遗迹，赢下本局':'登上高地，压低远古遗迹血量'});}
      }
    }
    const winner=score[1].base===0?0:1;
    return {winner,minutes:Math.round(minutes),kills:score.map(x=>x.kills),towers:score.map(x=>x.towers),bases:score.map(x=>x.base),draft,events};
  }
  function matchLineup(result,teamId){
    // Old saves have the MyTeam snapshot in seats; opponents come from that edition.
    const ids=result.lineups?.[teamId]||(teamId==='myteam'?result.seats.slice(0,5):D.pools.find(p=>p.year===result.year&&p.team===teamId)?.cards.filter(c=>c.role<=5).map(c=>c.id))||[];
    return Array.from({length:5},(_,i)=>D.cardMap[ids[i]]||null);
  }
  function tournament(s){
    const random=rng((s.seed^Math.imul(s.year,0x49f18b35))>>>0);
    const us={id:'myteam',name:'MyTeam',cards:lineup(s).slice(0,5),coach:lineup(s)[5],tactic:coachTactic(lineup(s)[5])};
    const participants=[us,...D.pools.filter(p=>p.year===s.year).map(p=>{const coach=p.cards.find(c=>c.role===6)||null;return {id:p.team,name:p.name,cards:p.cards.filter(c=>c.role<=5),coach,tactic:coachTactic(coach)};})];
    const participantMap=Object.fromEntries(participants.map(p=>[p.id,p]));
    const standings=participants.map((t,i)=>({id:t.id,name:t.name,wins:0,losses:0,seed:i,h2h:{}}));
    const standingsMap=Object.fromEntries(standings.map(t=>[t.id,t]));
    const games=[],groupSeries=[],bracket=[];
    function series(a,b,bestOf,stage){
      const teamA=participantMap[a],teamB=participantMap[b],scores=[0,0],maps=[];const first=random()<.5?0:1;
      const limit=bestOf===2?2:Math.floor(bestOf/2)+1;
      while(bestOf===2?maps.length<2:Math.max(...scores)<limit){
        const map=playMap(teamA,teamB,random,(first+maps.length)%2);scores[map.winner]++;
        if(a==='myteam'||b==='myteam')games.push({a,b,stage,...clone(map)});
        maps.push(a==='myteam'||b==='myteam'?map:{winner:map.winner});
      }
      return {a,b,score:scores,winner:scores[0]>scores[1]?a:scores[1]>scores[0]?b:null,loser:scores[0]>scores[1]?b:scores[1]>scores[0]?a:null,stage,bestOf,maps};
    }
    for(let i=0;i<participants.length;i++)for(let j=i+1;j<participants.length;j++){
      const r=series(participants[i].id,participants[j].id,2,'循环赛');groupSeries.push({a:r.a,b:r.b,score:r.score});
      const a=standingsMap[r.a],b=standingsMap[r.b];a.wins+=r.score[0];a.losses+=r.score[1];b.wins+=r.score[1];b.losses+=r.score[0];a.h2h[b.id]=r.score[0];b.h2h[a.id]=r.score[1];
    }
    const lots=shuffle(standings.map(x=>x.id),random);
    standings.forEach(t=>{const tied=standings.filter(x=>x.wins===t.wins&&x.id!==t.id);t.tieScore=tied.reduce((n,x)=>n+(t.h2h[x.id]||0),0);t.lot=lots.indexOf(t.id);});
    standings.sort((a,b)=>b.wins-a.wins||b.tieScore-a.tieScore||a.lot-b.lot);
    const qualified=standings.slice(0,8).map(x=>x.id),placements={};standings.slice(8).forEach((t,i)=>{placements[t.id]=String(i+9);});
    function match(a,b,stage,bestOf=3,loserPlace=null){const r=series(a,b,bestOf,stage);bracket.push({a:r.a,b:r.b,score:r.score,winner:r.winner,stage,bestOf});if(loserPlace)placements[r.loser]=loserPlace;return r;}
    const q=[[0,7],[3,4],[1,6],[2,5]].map(([a,b])=>match(qualified[a],qualified[b],'胜者组首轮'));
    const l1=[match(q[0].loser,q[1].loser,'败者组第一轮',3,'7–8'),match(q[2].loser,q[3].loser,'败者组第一轮',3,'7–8')];
    const semi=[match(q[0].winner,q[1].winner,'胜者组第二轮'),match(q[2].winner,q[3].winner,'胜者组第二轮')];
    const l2=[match(l1[0].winner,semi[1].loser,'败者组第二轮',3,'5–6'),match(l1[1].winner,semi[0].loser,'败者组第二轮',3,'5–6')];
    const l3=match(l2[0].winner,l2[1].winner,'败者组第三轮',3,'4');
    const upper=match(semi[0].winner,semi[1].winner,'胜者组决赛');
    const lower=match(l3.winner,upper.loser,'败者组决赛',3,'3');
    const final=match(upper.winner,lower.winner,'总决赛',5,'2');placements[final.winner]='1';
    const wins=games.filter(g=>(g.winner===0?g.a:g.b)==='myteam').length;
    return {model:'historical-inputs-game-rules-4',year:s.year,seats:[...s.seats],lineups:Object.fromEntries(participants.map(t=>[t.id,t.cards.map(c=>c.id)])),tactic:us.tactic,placement:placements.myteam,champion:final.winner,standings,groupSeries,bracket,games,wins,losses:games.length-wins,seed:s.seed};
  }
  function finish(s){if(s.phase!=='ready'||!s.seats.every(Boolean)||!coachIds.has(s.seats[5])||s.history.some(r=>r.year===s.year))return false;if(!s.history.length)s.year=START_YEAR;s.tactic=coachTactic(lineup(s)[5]);const result=tournament(s);s.history.push(result);s.phase='result';return result;}
  return {VERSION,MAX_EVENTS,nextYear,canAdvance,coachFit,experience,rng,shuffle,start,validate,currentPool,lineup,canPick,canComplete,eligible,alternatives,draw,pick,coachPools,isCoachDraft,coachSelection,canReplaceRole,beginReplacement,replacementTarget,cancelReplacement,next,matchLineup,autoDraft,playMap,tournament,finish};
});
