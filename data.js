(function(root,factory){
  const catalog=typeof module==='object'&&module.exports?require('./catalog-data.js'):root.DotaCatalog;
  const api=factory(catalog);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.DotaData=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(C){
  'use strict';
  const roles=['Carry','Midlaner','Offlaner','Soft Support','Hard Support','Coach'];
  const roleEnglish=roles;
  const heroRows = [
    ['antimage','敌法师',1,[5,2,3,1,1]],['ember_spirit','灰烬之灵',1,[4,5,2,3,1]],['phantom_lancer','幻影长矛手',1,[5,2,4,1,1]],['juggernaut','主宰',1,[4,4,4,1,3]],['luna','露娜',1,[4,3,5,1,1]],['morphling','变体精灵',1,[5,4,3,1,1]],
    ['invoker','祈求者',2,[4,3,3,5,2]],['storm_spirit','风暴之灵',2,[4,5,1,4,1]],['puck','帕克',2,[3,5,2,5,1]],['dragon_knight','龙骑士',2,[3,3,5,4,2]],['death_prophet','死亡先知',2,[3,3,5,3,2]],['tiny','小小',2,[3,5,4,4,1]],
    ['axe','斧王',3,[2,5,2,5,2]],['tidehunter','潮汐猎人',3,[2,3,2,5,4]],['beastmaster','兽王',3,[2,4,5,4,2]],['dark_seer','黑暗贤者',3,[3,3,3,4,4]],['centaur','半人马战行者',3,[2,4,2,5,4]],['magnataur','马格纳斯',3,[3,3,2,5,4]],
    ['earthshaker','撼地者',4,[1,4,2,5,3]],['rubick','拉比克',4,[1,4,2,5,3]],['tusk','巨牙海民',4,[1,5,2,4,4]],['earth_spirit','大地之灵',4,[1,5,1,5,3]],['lion','莱恩',4,[1,4,1,5,2]],['shadow_shaman','暗影萨满',4,[1,3,5,5,1]],
    ['chen','陈',5,[1,3,5,2,5]],['dazzle','戴泽',5,[1,2,3,2,5]],['oracle','神谕者',5,[1,2,1,3,5]],['warlock','术士',5,[1,2,3,5,4]],['crystal_maiden','水晶室女',5,[1,3,1,4,4]],['witch_doctor','巫医',5,[1,3,2,4,4]]
  ];
  const tactics={
    balanced:{name:'均衡运营',en:'BALANCED',icon:'compass',description:'兼顾发育与地图控制，保留更多获胜路径。',tradeoff:'不强化单一时间段，临场阵容更重要。',weights:[1,1,1,1,1]},
    protect:{name:'四保一',en:'PROTECT',icon:'shield',description:'保护核心的发育，让 Carry 接管后期。',tradeoff:'前期主动性降低，需要保护与稳定控制。',weights:[2,.6,.7,1.1,1.8]},
    push:{name:'抱团推进',en:'PUSH',icon:'tower',description:'抓住强势期，拿塔、控盾、压缩地图。',tradeoff:'推进受阻会失去节奏，需要持续作战能力。',weights:[.7,1.1,2,1,.8]},
    tempo:{name:'抓人提速',en:'TEMPO',icon:'bolt',description:'中辅联动，通过先手创造局部人数差。',tradeoff:'游走落空会损失发育，阵容需要足够控制。',weights:[.65,2,.7,1.7,.7]}
  };

  const axes=['farm','tempo','push','control','save'];
  // Position pools are game rules, separate from each player's recorded hero pool.
  // Automatic BP uses their union and strongly favors their intersection.
  const draftPositions={
    1:'antimage bloodseeker drow_ranger juggernaut mirana morphling nevermore phantom_lancer razor sven tiny windrunner riki faceless_void skeleton_king phantom_assassin templar_assassin luna dragon_knight leshrac furion life_stealer clinkz huskar weaver spectre ursa gyrocopter alchemist lone_druid chaos_knight naga_siren wisp slark medusa troll_warlord bristleback abaddon ember_spirit terrorblade arc_warden monkey_king dark_willow marci muerta kez',
    2:'bloodseeker earthshaker mirana morphling nevermore puck pudge razor storm_spirit tiny windrunner zuus kunkka lina tinker sniper necrolyte queenofpain death_prophet pugna templar_assassin viper dragon_knight dazzle leshrac furion huskar broodmother batrider doom_bringer alchemist invoker obsidian_destroyer brewmaster lone_druid meepo keeper_of_the_light visage medusa magnataur shredder ember_spirit earth_spirit arc_warden monkey_king pangolier void_spirit snapfire primal_beast',
    3:'axe bloodseeker earthshaker mirana pudge razor sand_king tiny windrunner slardar tidehunter enigma necrolyte beastmaster venomancer faceless_void skeleton_king death_prophet viper dragon_knight furion dark_seer omniknight enchantress night_stalker broodmother bounty_hunter weaver batrider doom_bringer spirit_breaker alchemist lycan brewmaster lone_druid chaos_knight undying nyx_assassin visage centaur magnataur shredder bristleback tusk abaddon elder_titan legion_commander abyssal_underlord phoenix winter_wyvern pangolier snapfire mars dawnbreaker marci primal_beast largo',
    4:'bane crystal_maiden earthshaker mirana pudge sand_king tiny vengefulspirit windrunner kunkka lina lion shadow_shaman witch_doctor lich enigma venomancer pugna dazzle rattletrap leshrac furion enchantress bounty_hunter jakiro batrider chen ancient_apparition spirit_breaker silencer shadow_demon treant ogre_magi undying rubick disruptor nyx_assassin naga_siren keeper_of_the_light wisp visage tusk skywrath_mage abaddon elder_titan techies earth_spirit phoenix oracle winter_wyvern monkey_king dark_willow grimstroke hoodwink snapfire ringmaster dawnbreaker marci muerta',
    5:'bane crystal_maiden mirana vengefulspirit lion shadow_shaman witch_doctor lich warlock venomancer pugna dazzle rattletrap furion omniknight enchantress jakiro chen ancient_apparition silencer shadow_demon treant ogre_magi undying rubick disruptor naga_siren keeper_of_the_light wisp abaddon elder_titan phoenix oracle winter_wyvern dark_willow grimstroke snapfire ringmaster marci'
  };
  const rolePools=Object.fromEntries(Object.entries(draftPositions).map(([role,ids])=>[role,ids.split(' ')]));
  const designed=Object.fromEntries(heroRows.map(([id,name,role,vector])=>[id,{name,role,vector}]));
  const heroes=C.heroes.map(h=>{
    const base=designed[h.id],tags=h.tags;
    const v=base?.vector||[tags.includes('Carry')?4:2,tags.includes('Initiator')?4:3,tags.includes('Pusher')?4:2,tags.includes('Disabler')?4:2,tags.includes('Support')?4:1];
    const compatible=[1,2,3,4,5].filter(role=>rolePools[role].includes(h.id));
    return {...h,roles:compatible,...Object.fromEntries(axes.map((k,i)=>[k,v[i]]))};
  });
  const heroMap=Object.fromEntries(heroes.map(h=>[h.id,h]));
  const coachPoolVersion=C.coachSelection.version,coachYears=C.coachSelection.years;
  const coachIds=new Set(C.coachSelection.ids);
  const historicalCards=C.pools.flatMap(p=>p.cards);
  const playerHeroUsage={};
  for(const c of historicalCards.filter(c=>c.role<=5)){
    const usage=playerHeroUsage[c.person]||(playerHeroUsage[c.person]={});
    for(const [id,count] of Object.entries(c.heroUsage))usage[id]=(usage[id]||0)+count;
  }
  const pools=C.pools.map(p=>({...p,cards:p.cards.filter(c=>c.role<=5||coachIds.has(c.id))}));
  // TI1 rosters remain available to the tournament, but are not selectable cards.
  const draftPools=pools.filter(p=>p.year!==2011);
  const draftYears=[...new Set(draftPools.map(p=>p.year))];
  const cards=draftPools.flatMap(p=>p.cards),coachCards=cards.filter(c=>c.role===6);
  const cardMap=Object.fromEntries(historicalCards.map(c=>[c.id,c]));
  const events=C.events.map(e=>({...e,coachCards:coachCards.filter(c=>c.year===e.year).length}));
  const years=events.map(e=>e.year),eventMap=Object.fromEntries(events.map(e=>[e.year,e]));
  const aegis=Object.fromEntries(years.map(year=>[year,{file:year<2013?'2011-2012.png':year+'.png'}]));
  const teams=Object.fromEntries(pools.map(p=>[p.team,{name:p.name,short:p.team.toUpperCase(),region:p.region}]));
  const poolMap=Object.fromEntries(pools.map(p=>[p.id,p]));
  function personId(name){const key=name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g,'');return C.aliases[key]||key;}
  function heroScore(hero,tactic){return axes.reduce((sum,k,i)=>sum+hero[k]*tactics[tactic].weights[i],0);}
  for(const card of historicalCards){
    const observed=Object.keys(card.heroUsage).filter(id=>heroMap[id]&&card.heroUsage[id]>0);
    card.heroCandidates=card.role<=5?observed:[];
    card.heroes=observed.slice(0,6);
    card.defaultHero=card.heroCandidates[0]||null;
    card.strength=0;
    if(card.role===6){
      const total=Object.values(card.heroUsage).reduce((n,v)=>n+v,0);
      card.affinity=Object.fromEntries(axes.map(k=>[k,total?Object.entries(card.heroUsage).reduce((n,[id,v])=>n+(heroMap[id]?.[k]||2.5)*v,0)/total:2.5]));
      card.recommendedTactic='balanced';
    }
  }
  // Career totals use coaching entries only, deduplicated by historical team pool.
  // Missing match samples can still establish an event finish, but not a win rate.
  const coachHistories={};
  for(const card of historicalCards.filter(c=>c.role===6)){
    if(!coachHistories[card.person]){
      const coached=[...new Map(historicalCards.filter(c=>c.role===6&&c.person===card.person).map(c=>[c.poolId,c])).values()].sort((a,b)=>a.year-b.year);
      const entries=coached.map(c=>({poolId:c.poolId,year:c.year,teamName:c.teamName,...c.coachRecord}));
      const games=entries.reduce((n,r)=>n+r.games,0),wins=entries.reduce((n,r)=>n+r.wins,0);
      const finishes={};for(const r of entries)finishes[r.finish]=(finishes[r.finish]||0)+1;
      const bestFinish=Object.keys(finishes).sort((a,b)=>parseInt(a,10)-parseInt(b,10))[0];
      coachHistories[card.person]={entries,games,wins,winRate:games?wins/games:null,bestFinish,bestCount:finishes[bestFinish],finishes,missingEditions:entries.filter(r=>!r.games).length};
    }
    card.coachHistory=coachHistories[card.person];
  }
  // Compare each coached team's hero mix with its own edition, so a generally
  // high control score cannot label every coach as a tempo specialist.
  for(const event of events){
    const profiles=pools.filter(p=>p.year===event.year&&p.games).map(p=>{
      const entries=p.cards.filter(c=>c.role<=5).flatMap(c=>Object.entries(c.heroUsage));
      const total=entries.reduce((n,[,v])=>n+v,0);
      return Object.fromEntries(axes.map(k=>[k,entries.reduce((n,[id,v])=>n+heroMap[id][k]*v,0)/total]));
    });
    const means=Object.fromEntries(axes.map(k=>[k,profiles.reduce((n,p)=>n+p[k],0)/(profiles.length||1)]));
    const sd=Object.fromEntries(axes.map(k=>[k,Math.sqrt(profiles.reduce((n,p)=>n+(p[k]-means[k])**2,0)/(profiles.length||1))]));
    for(const c of historicalCards.filter(c=>c.year===event.year&&c.role===6)){
      if(!c.coachRecord.games){c.tacticFits={balanced:0,protect:0,push:0,tempo:0};continue;}
      const z=Object.fromEntries(axes.map(k=>[k,Math.max(-1,Math.min(1,(c.affinity[k]-means[k])/(sd[k]||1)))]));
      c.tacticFits={balanced:1-axes.reduce((n,k)=>n+Math.abs(z[k]),0)/5*.7,protect:.5+(z.farm*.55+z.save*.45)*.45,push:.5+z.push*.45,tempo:.5+(z.tempo*.6+z.control*.4)*.45};
      c.recommendedTactic=Object.keys(tactics).sort((a,b)=>c.tacticFits[b]-c.tacticFits[a])[0];
    }
  }
  // Relative, shrunken game parameters; never substituted for observed card metrics.
  for(const year of years)for(let role=1;role<=5;role++){
    const cohort=cards.filter(c=>c.year===year&&c.role===role&&c.stats);
    const features=c=>[[c.stats.kills,c.stats.assists,c.stats.deaths].every(Number.isFinite)?(c.stats.kills+c.stats.assists)/Math.max(1,c.stats.deaths):null,c.stats.gpm,c.stats.xpm,c.stats.participation];
    const values=cohort.map(features);
    const means=[0,1,2,3].map(i=>values.reduce((n,v)=>n+(v[i]??0),0)/(values.length||1));
    const deviations=means.map((mean,i)=>Math.sqrt(values.reduce((n,v)=>n+((v[i]??mean)-mean)**2,0)/(values.length||1)));
    cohort.forEach((c,j)=>{const z=means.map((mean,i)=>values[j][i]==null?0:deviations[i]?(values[j][i]-mean)/deviations[i]:0);c.strength=Math.max(-1,Math.min(1,z.reduce((n,v)=>n+v,0)/4))*Math.min(1,c.stats.games/20);});
  }
  return {aegis,roleHeroPools:rolePools,playerHeroUsage,version:C.version,coachPoolVersion,coachYears,coachCards,roles,roleEnglish,axes,heroes,heroMap,teams,pools,draftPools,draftYears,poolMap,cards,cardMap,tactics,years,events,eventMap,personId,heroScore,statsMeta:{events:eventMap}};
});
