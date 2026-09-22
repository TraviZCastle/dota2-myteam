(function(){
  'use strict';
  const D=window.DotaData,G=window.DotaGame,app=document.getElementById('app');
  const SAVE='dota2myteam.run.v3',modal=document.getElementById('modal'),modalContent=document.getElementById('modal-content');
  let storageWorks=true,loadMessage='',state=load(),rolling=null,rollTimer=null,toastTimer=null,processing=false;
  let archiveFilter={query:'',year:'',role:'',team:'',limit:24},rosterExpanded=false;
  const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon=(name,cls='icon')=>`<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const heroBadge=id=>`<span class="hero-chip">${escape(D.heroMap[id]?.name||'未知英雄')}</span>`;
  function heroPortrait(id,uses){
    const hero=D.heroMap[id];if(!hero)return heroBadge(id);
    return `<span class="hero-portrait" title="${escape(hero.name)}${uses?' · '+uses+' 局':''}"><img src="assets/heroes/${hero.id}.png" alt="" width="256" height="144" loading="lazy" decoding="async"><span class="hero-portrait-name">${escape(hero.name)}</span>${uses?`<span class="hero-portrait-uses">${uses} 局</span>`:''}</span>`;
  }
  const eventName=year=>D.eventMap[year]?.name||String(year);
  const roleLabel=c=>c.role===6?D.roles[5]:c.role+' 号位 · '+D.roles[c.role-1];
  const teamName=id=>id==='myteam'?'MyTeam':D.pools.find(p=>p.team===id&&p.year===state?.year)?.name||D.teams[id]?.name||id;
  const placementLabel=p=>p==='1'?'冠军':p==='2'?'亚军':p==='3'?'季军':`第 ${p} 名`;
  const yearValue=year=>`${eventName(year)} <small>· ${year}</small>`;
  const poolValue=pool=>`<b class="draw-pool-year">${yearValue(pool.year)}</b><strong class="draw-pool-team">${escape(pool.name)}</strong>`;
  function drawValue(column,pool){
    if(rolling?.stage===column){
      if(rolling.reduced)return '<span class="draw-pending">正在抽取…</span>';
      const elapsed=Math.max(0,performance.now()-rolling.startedAt);
      return `<span class="draw-reel" role="status" aria-label="正在抽取${column==='event'?'教练年份':'年份与战队组合'}" aria-busy="true"><span class="draw-reel-track" aria-hidden="true" style="--reel-steps:${rolling.frames.length-1};--reel-duration:${rolling.duration}ms;animation-delay:-${elapsed}ms">${rolling.frames.map(value=>`<span class="draw-reel-row">${value}</span>`).join('')}</span></span>`;
    }
    return column==='event'?yearValue(pool.year):poolValue(pool);
  }
  function startRollStage(stage){
    const pool=G.currentPool(state),options=G.alternatives(state);
    const values=stage==='event'?options.map(yearValue):options.map(poolValue);
    const winner=stage==='event'?yearValue(pool.year):poolValue(pool);
    const previews=values.filter(value=>value!==winner),frames=[];
    // Presentation randomness never advances the saved draft seed or spends a reroll.
    for(let i=0;i<16;i++){
      const choices=previews.filter(value=>value!==frames.at(-1));
      frames.push(choices.length?choices[Math.floor(Math.random()*choices.length)]:previews[0]||'…');
    }
    frames.push(winner);
    Object.assign(rolling,{stage,frames,startedAt:performance.now(),duration:rolling.reduced?150:stage==='pool'?1000:800});
    render();
    rollTimer=setTimeout(endReveal,rolling.duration);
  }
  function load(){
    try{
      const raw=localStorage.getItem(SAVE);
      if(!raw)return null;
      const saved=JSON.parse(raw),restored=G.validate(saved);
      if(JSON.stringify(saved)!==JSON.stringify(restored)){
        loadMessage='已更新本机存档。';
        try{localStorage.setItem(SAVE,JSON.stringify(restored));}catch{storageWorks=false;}
      }
      return restored;
    }catch(error){loadMessage=error instanceof SyntaxError||/存档/.test(error.message)?'旧存档无法读取，可以重新开始。':'此浏览器无法读取本机存档。';return null;}
  }
  function save(){try{localStorage.setItem(SAVE,JSON.stringify(state));storageWorks=true;}catch{storageWorks=false;}}
  function randomSeed(){if(window.crypto?.getRandomValues)return crypto.getRandomValues(new Uint32Array(1))[0];return(Date.now()^Math.floor(Math.random()*4294967296))>>>0;}
  function toast(message){const node=document.getElementById('toast');clearTimeout(toastTimer);node.textContent=message;node.hidden=false;toastTimer=setTimeout(()=>{node.hidden=true;},3200);}
  function route(){const hash=location.hash.slice(1);return ['home','play','archive'].includes(hash)?hash:'home';}
  function navigate(view){location.hash=view;if(route()===view)render();window.scrollTo({top:0,behavior:'instant'});app.focus({preventScroll:true});}
  function showModal(content){modalContent.innerHTML=content;if(!modal.open)modal.showModal();}
  function closeModal(){modal.close();}
  function saveStatus(){return `<span class="save-status ${storageWorks?'':'failed'}">${icon(storageWorks?'check':'info')}${storageWorks?'已保存在此浏览器':'进度保存失败，请勿关闭页面'}</span>`;}
  function steps(active){return `<div class="step-indicator" aria-label="当前步骤：${['阵容选秀','阵容确认','赛事结果'][active]}">${['阵容选秀','阵容确认','赛事结果'].map((name,i)=>`${i?'<span class="step-connector"></span>':''}<div class="step-dot ${i===active?'active':i<active?'done':''}"><span>${i<active?'✓':String(i+1).padStart(2,'0')}</span>${name}</div>`).join('')}</div>`;}
  function crumbs(label){return `<div class="breadcrumb"><a href="#home">MYTEAM</a>${icon('chevron')}<span>${label}</span></div>`;}
  function heroThumbs(card,label=true){if(card.role===6)return '';return `<div class="hero-top-three">${label?`<div class="hero-thumbs-label">当届常用英雄 · TOP 3</div>`:''}<div class="hero-thumbs">${card.heroes.slice(0,3).map(id=>heroPortrait(id,card.heroUsage[id])).join('')||'<span class="fine-print">暂无英雄样本</span>'}</div></div>`;}
  function stats(card,cls='candidate-stats'){
    if(card.role===6){const r=card.coachHistory;return `<div class="${cls} coach-stats"><div class="candidate-stat"><span>擅长风格</span><b>${D.tactics[card.recommendedTactic].name}</b></div><div class="candidate-stat"><span>历史胜率</span><b>${r.winRate===null?'未收录':(r.winRate*100).toFixed(1)+'%'}</b></div><div class="candidate-stat"><span>历史局数</span><b>${r.games?r.games+' 局':'未收录'}</b></div><div class="candidate-stat"><span>最高成绩</span><b>${placementLabel(r.bestFinish)} × ${r.bestCount}</b></div></div>`;}
    if(!card.stats)return `<p class="missing-stats">${icon('info')}TI1 逐场统计暂未收录。名单可选，比赛使用中性能力参数。</p>`;
    const fields=[['kills','K'],['deaths','D'],['assists','A'],['gpm','GPM'],['xpm','XPM'],['participation','参战率'],['damagePerMin','伤害/分']];
    return `<div class="${cls}">${fields.map(([key,label])=>{const value=card.stats[key],known=typeof value==='number'&&Number.isFinite(value),count=card.stats.samples[key]||0;return `<div class="candidate-stat" title="${label} · ${count} 局有效样本"><span>${label}</span><b>${known?(value*(key==='participation'?100:1)).toFixed(1)+(key==='participation'?'%':''):'未收录'}</b></div>`;}).join('')}</div>`;
  }
  function statSources(card){
    const pool=D.poolMap[card.poolId],link=`<a class="source-link" href="${pool.source}" target="_blank" rel="noopener noreferrer">${eventName(card.year)} 名单与赛事资料 ↗</a>`;
    if(card.role===6){const r=card.coachHistory;return `<p class="stats-source">TI 执教生涯 · ${r.entries.length} 条执教记录 · ${r.games?r.wins+' 胜 / '+r.games+' 局':'逐场数据未收录'}</p><p class="fine-print">仅汇总卡库已收录的 TI 八强执教经历，不计选手时期，也不包含其他赛事。胜率按总胜场 ÷ 总局数计算。${r.missingEditions?'其中 '+r.missingEditions+' 届缺少逐场数据，仅计名次，不计胜率和局数。':''}</p><details class="stats-method"><summary>逐届执教记录与来源</summary><div class="coach-history-list">${r.entries.map(e=>`<a class="coach-history-row" href="${D.poolMap[e.poolId].source}" target="_blank" rel="noopener noreferrer"><span>${eventName(e.year)} · ${e.year}<b>${escape(e.teamName)}</b></span><span>${placementLabel(e.finish)}<small>${e.games?e.wins+' 胜 / '+e.games+' 局':'逐场数据未收录'} ↗</small></span></a>`).join('')}</div></details><p class="fine-print">擅长风格来自当前教练卡对应届次的执教样本，为游戏设定。历史统计汇总全部已收录执教届次。</p>`;}
    const t=card.stats;if(!t)return `<p class="stats-source">${link}</p><p class="fine-print">未用后续赛事或估算值补齐 TI1 成绩。位置为本游戏的固定选秀席位，不代表每局分路。</p>`;
    return `<p class="stats-source">OpenDota · ${eventName(card.year)} ${t.games} 局可用样本 · ${link}</p><details class="stats-method"><summary>统计口径与来源比赛</summary><p>按届次、战队、选手账号匹配。K / D / A 为每局平均；GPM / XPM 按有效局时长加权；参战率为击杀与助攻合计 ÷ 团队击杀合计；伤害/分为英雄伤害合计 ÷ 有效总分钟。各项独立记录有效样本。</p><p>有效样本：K ${t.samples.kills} · D ${t.samples.deaths} · A ${t.samples.assists} · GPM ${t.samples.gpm} · XPM ${t.samples.xpm} · 参战率 ${t.samples.participation} · 伤害/分 ${t.samples.damagePerMin}。采集于 ${D.eventMap[card.year].fetchedAt.slice(0,10)}。</p><div class="source-matches">${t.matchIds.map(id=>`<a class="source-link" href="https://www.opendota.com/matches/${id}" target="_blank" rel="noopener noreferrer">${id} ↗</a>`).join('')}</div></details>`;
  }
  function landing(){
    const legends=['2019-og-ana','2017-liquid-miracle','2021-spirit-collapse','2018-lgd-fy','2019-og-n0tail','2022-secret-coach-heen'].map(id=>D.cardMap[id]);
    const progress=state?state.phase==='draft'?`已选 ${state.seats.filter(Boolean).length} / 6 席 · 阵容选秀进行中`:`${eventName(state.year)} · 已完成 ${state.history.length} 届赛事`:'';
    return `<div class="home-page">
      <section class="home-hero" aria-labelledby="home-title">
        <img class="home-keyart" src="assets/brand/heroes.jpg" alt="" width="4000" height="2035" fetchpriority="high">
        <div class="home-hero-shade"></div>
        <div class="home-hero-inner">
          <div class="home-copy">
            <div class="home-edition"><img src="assets/brand/dota2-wordmark.png" alt="Dota 2" width="180" height="36"><span>MYTEAM / 历史选秀</span></div>
            <p class="home-kicker">THE PLAYERS YOU REMEMBER. THE TEAM YOU IMAGINE.</p>
            <h1 id="home-title">让传奇重逢。<br><em>这次，由你捧盾。</em></h1>
            <p class="home-description">把不同年代的他们，写进同一份首发。<br>五位选手、一位教练，开启属于你的 TI 生涯。</p>
            <div class="home-actions">
              ${state?`<a class="primary home-start" href="#play"><span>继续生涯<small>CONTINUE YOUR JOURNEY</small></span>${icon('arrow')}</a><button class="text-button" data-action="start">开启新生涯 ${icon('chevron')}</button>`:`<button class="primary home-start" data-action="start"><span>开始组建战队<small>BUILD YOUR MYTEAM</small></span>${icon('arrow')}</button><button class="text-button" data-action="rules">了解玩法 ${icon('chevron')}</button>`}
            </div>
            <p class="home-save-note">${icon(state?'check':'shield')}${state?escape(progress):'免费游玩 · 无需登录 · 进度自动保存'}</p>
          </div>
          <div class="home-art-caption" aria-hidden="true"><span>01 / THE BEGINNING</span><b>每一支传奇战队，<br>都始于一个「如果」。</b></div>
        </div>
        <div class="home-hero-bottom"><span>TI1 <i></i> TI2026</span><span>FIVE PLAYERS. ONE COACH. YOUR LEGACY.</span></div>
      </section>
      <div class="home-content">
        <section class="home-numbers" aria-label="历史卡库规模">
          <div><strong>${D.events.length}<small>届</small></strong><span>从 TI1 到 TI2026</span></div>
          <div><strong>${D.pools.length}<small>队</small></strong><span>历届八强战队池</span></div>
          <div><strong>${D.cards.filter(c=>c.role<6).length}<small>张</small></strong><span>属于那个年代的选手卡</span></div>
          <div><strong>5 <i>+</i> 1</strong><span>五名选手，一位教练</span></div>
        </section>
        <section class="home-legends" aria-labelledby="home-legends-title">
          <div class="home-section-heading"><div><p class="home-kicker">A LINEUP THAT NEVER WAS</p><h2 id="home-legends-title">如果他们，曾经同队。</h2><p>让想象中的五人组，遇上一位名帅。下面是一种可能，你的答案由你来选。</p></div><a class="text-button" href="#archive">探索传奇图鉴 ${icon('arrow')}</a></div>
          <div class="home-lineup">${legends.map(c=>`<button class="home-legend ${c.role===6?'home-legend-coach':''}" data-action="card-detail" data-card="${c.id}" aria-label="查看 ${escape(c.name)} ${eventName(c.year)} ${D.roles[c.role-1]}资料">
            <span class="home-legend-position"><b>${c.role===6?'C':'0'+c.role}</b>${D.roleEnglish[c.role-1]}</span>
            ${c.role===6?`<div class="home-coach-art">${stats(c,'home-coach-stats')}</div>`:`<span class="home-legend-art"><img src="assets/heroes/${c.heroes[0]}.png" alt="" width="256" height="144" loading="lazy"><span>${escape(D.heroMap[c.heroes[0]].name)}<small>当届常用</small></span></span>`}
            <span class="home-legend-name">${escape(c.name)}</span><span class="home-legend-team">${eventName(c.year)} · ${escape(c.teamName)}</span>
            <span class="home-legend-link">${c.role===6?'教练档案':'选手档案'} ${icon('arrow')}</span>
          </button>`).join('')}</div>
          <p class="home-example-note">跨时代阵容示例 · 英雄图对应选手当届常用英雄 · 点击卡片查看历史数据</p>
        </section>
        <section class="home-how" aria-labelledby="home-how-title">
          <div class="home-section-heading"><div><p class="home-kicker">YOUR ROAD TO THE AEGIS</p><h2 id="home-how-title">从一次相遇，到一段传奇。</h2></div><button class="text-button" data-action="rules">完整玩法 ${icon('chevron')}</button></div>
          <div class="home-steps">
            <article><span class="home-step-index">01</span>${icon('dice')}<h3>抽一个时代，选一位传奇</h3><p>随机揭晓 TI 年份与八强战队，逐一填满五个位置。一次重抽同时更换年份与战队，整段生涯共 3 次。</p><span>THE DRAFT / 阵容选秀</span></article>
            <article><span class="home-step-index">02</span>${icon('compass')}<h3>最后一席，交给你的教练</h3><p>只抽 TI10—TI15 的年份，每届八强战队各一位教练。独立重抽 1 次，战队风格与自动 BP 都交给教练。</p><span>THE PLAN / 教练执掌</span></article>
            <article><span class="home-step-index">03</span>${icon('trophy')}<h3>征战 TI，续写你的生涯</h3><p>经历循环赛与双败淘汰赛，回看每局 BP 和战报。休赛期换一人，最多携手征战十届。</p><span>THE LEGACY / 生涯挑战</span></article>
          </div>
        </section>
        <div class="home-closing"><div><p class="home-kicker">MADE FOR THE LOVE OF DOTA</p><p>为了那些看过的比赛，和仍想重来的青春。</p><span>非盈利个人项目 · 免费游玩 · 非 Valve 官方产品</span></div><img src="assets/brand/dota2-symbol.png" alt="" width="56" height="56" loading="lazy"></div>
      </div>
    </div>`;
  }
  function roster(){
    const cards=G.lineup(state),count=cards.filter(Boolean).length,replacing=state.phase==='replace';
    return `<aside class="roster-panel ${replacing?'is-replacing':rosterExpanded?'is-expanded':''}" aria-label="五名选手与一名教练"><div class="roster-heading"><h2>${replacing?'选择换人位置':'我的战队'}</h2><span>${count} <span class="muted">/ 6</span></span>${replacing?'':`<button class="text-button mobile-roster-toggle" data-action="toggle-roster" aria-expanded="${rosterExpanded}" aria-controls="roster-content">${rosterExpanded?'收起阵容':'展开阵容'}${icon('chevron')}</button>`}</div><div class="roster-progress" aria-hidden="true">${cards.map(c=>`<span class="${c?'filled':''}"></span>`).join('')}</div><div id="roster-content"><div class="roster-list">${cards.map((c,i)=>{
      const seat=`<div class="seat ${c?'':'empty'} ${i===5?'coach-seat':''}"><span class="seat-number">${i===5?'C':i+1}</span><div class="seat-detail"><strong>${c?escape(c.name):D.roles[i]}</strong><small>${c?eventName(c.year)+' · '+escape(c.teamName):i===5?'五名选手齐备后选择':D.roleEnglish[i]}</small></div>${c?icon('check','seat-check'):''}</div>`;
      if(!replacing)return seat;
      const possible=G.canReplaceRole(state,i+1);
      return `<button class="replacement-target" data-action="replace-target" data-role="${i+1}" aria-label="替换 ${escape(c.name)}，${D.roles[i]}" aria-pressed="${state.replacement.target===i+1}" ${possible&&!rolling?'':'disabled'}>${seat}</button>`;
    }).join('')}</div><div class="roster-bottom">${replacing?`<p class="fine-print">${state.replacement.target?'已选择 '+D.roles[state.replacement.target-1]+'，确认新人后生效。':'选手或教练均可替换，每届共用一次机会。'}</p><button class="secondary full" data-action="cancel-replace">暂不换人，返回结果</button>`:`<p class="roster-prompt">${count<5?'还需 '+(5-count)+' 名选手 + 1 名教练':'最后一席：选择你的教练'}</p><p class="fine-print">同一人跨届、跨身份只能占一席。</p>`}</div></div></aside>`;
  }
  function candidate(c){
    const used=G.lineup(state).some(p=>p?.person===c.person),available=G.canPick(state,c),replacing=state.phase==='replace',targetReady=!replacing||state.replacement.target===c.role;
    const label=used?'已在阵容':replacing&&!state.replacement.target?'先选换人位':available&&targetReady?'选入阵容':c.role===6?'先选五名选手':'席位不兼容';
    return `<article class="candidate ${c.role===6?'coach-card':''} ${available?'available':'unavailable'}"><div class="candidate-position">${c.role===6?icon('compass'):'0'+c.role}<small>${D.roleEnglish[c.role-1]}</small></div><div class="candidate-title"><button class="text-button" data-action="card-detail" data-card="${c.id}">${escape(c.name)}</button><div class="candidate-meta">${D.roles[c.role-1]}<span>·</span>${c.role===6?'当届教练':c.stats?c.stats.games+' 局统计':'TI1 · 暂无逐场统计'}</div></div>${c.role===6?'':`<div class="candidate-heroes">${heroThumbs(c,false)}</div>`}<button class="${available&&targetReady?'primary':'secondary'} pick-button" data-action="pick" data-card="${c.id}" aria-label="${escape(c.name)} · ${label}" ${available&&targetReady&&!rolling?'':'disabled'}>${label}${available&&targetReady?icon('arrow'):''}</button>${stats(c)}</article>`;
  }
  function coachDraftView(){
    const selection=G.coachSelection(state),pool=G.currentPool(state),teams=G.coachPools(selection.year),replacing=state.phase==='replace';
    const canReroll=selection.rerolls>0&&G.alternatives(state,'event').length>0;
    return `<div class="page-shell">${crumbs(replacing?'休赛期换教练':'教练选秀')}
      <div class="page-heading"><div><div class="eyebrow">ONE YEAR. EIGHT COACHES.</div><h1>${replacing?'为下一届，选择新的教练。':'最后一席，交给你的教练。'}</h1><p>只抽 TI10—TI15 的年份，直接选择当届八位教练。可独立重抽年份 1 次。</p></div>${steps(0)}</div>
      <div class="draft-layout"><div><div class="draw-controls coach-draw-controls"><div class="draw-box ${rolling?'is-rolling':''}"><div class="draw-watermark">${icon('compass')}</div><div class="eyebrow">COACH DRAFT / 教练年份</div><div class="draw-value">${drawValue('event',pool)}</div><button class="text-button" data-action="reroll" data-kind="event" ${canReroll&&!rolling?'':'disabled'}>${icon('refresh')}重抽教练年份 <span>余 ${selection.rerolls} 次</span></button></div></div>
      <div class="draw-info"><span>${rolling?'正在抽取教练年份…':'八强教练全部展示，无需抽战队'}</span>${rolling?'<button class="text-button" data-action="skip-reveal">跳过动画 →</button>':'<span>独立额度，不消耗选手重抽次数</span>'}</div><div class="section-heading"><h2>当届八强教练</h2><small>${rolling?'揭晓后显示教练候选':pool.cards.length+' 名有记录的教练 · '+G.eligible(state,pool).length+' 人可选'}</small></div>
      ${rolling?`<div class="empty-pool" role="status">${icon('compass')}<strong>你的教练，即将登场</strong><p>正在揭晓年份与当届八强</p></div>`:`<div class="coach-round-grid">${teams.map(team=>`<section class="coach-group" aria-label="${escape(team.name)} 教练"><div class="coach-group-heading"><span>${placementLabel(team.finish)}</span><h3>${escape(team.name)}</h3></div>${team.cards.some(c=>c.role===6)?team.cards.filter(c=>c.role===6).map(candidate).join(''):'<p class="coach-unrecorded">当届教练未收录</p>'}</section>`).join('')}</div>`}
      <div class="draft-footer"><p class="fine-print">历史统计仅含已收录的 TI 八强执教记录，不计选手时期。风格为当届执教样本生成的游戏设定。${replacing?'取消后保留本次年份和重抽次数。':''}</p><button class="text-button" data-action="data-info">数据说明 ${icon('chevron')}</button></div></div>${roster()}</div><div class="draft-footer">${saveStatus()}<button class="text-button" data-action="start">重新开始一局 ${icon('refresh')}</button></div></div>`;
  }
  function draft(){
    if(G.isCoachDraft(state))return coachDraftView();
    const pool=G.currentPool(state),count=state.seats.filter(Boolean).length,replacing=state.phase==='replace',canReroll=state.rerolls>0&&G.alternatives(state,'both').length>0;
    return `<div class="page-shell">${crumbs(replacing?'休赛期换人':'阵容选秀')}<div class="page-heading"><div><div class="eyebrow">${replacing?'ONE CHANGE. A NEW CHAPTER.':`DRAFT YOUR LEGENDS / ROUND ${String(count+1).padStart(2,'0')}`}</div><h1>${replacing?'下一块拼图，谁来补齐？':count===0?'你的传奇，从这一选开始。':count===5?'最后一席，交给你的教练。':count===4?'选手的最后一席，交给谁？':'每一位，都让战队更完整。'}</h1><p>${replacing?'每届可替换一人，下一届生效。':'先从历届八强中选五名选手，再抽年份，从当届八强中直选教练。'}</p></div>${steps(0)}</div>${replacing?'<div class="replacement-banner"><div>本次换人不会改变已完成的赛事结果。<p>取消后保留本次候选池，原队员在确认之前留队。</p></div>'+icon('refresh')+'</div>':''}<div class="draft-layout"><div><div class="draw-controls combined-draw-controls"><div class="draw-box combined-draw ${rolling?'is-rolling':''}"><div class="draw-watermark">${icon('dice')}</div><div class="eyebrow">TI × TEAM / 年份与战队</div><div class="draw-value draw-pair">${drawValue('pool',pool)}</div></div></div><div class="draw-info"><span>${rolling?'正在抽取年份与战队组合…':pool.region+' · 当届'+placementLabel(pool.finish)}</span>${rolling?'<button class="text-button" data-action="skip-reveal">跳过动画 →</button>':''}</div><div class="combined-reroll"><button class="secondary" data-action="reroll" data-kind="both" ${canReroll&&!rolling?'':'disabled'}>${icon('refresh')}重抽年份与战队 <span>余 ${state.rerolls} 次</span></button><p>一次同时重抽 · 整段生涯共 3 次</p></div><div class="section-heading"><h2>当届候选</h2><small>${rolling?'揭晓后显示选手候选':'5 名选手 · '+G.eligible(state,pool).length+' 人可选'}</small></div>${rolling?`<div class="empty-pool" role="status">${icon('dice')}<strong>下一位传奇，即将登场</strong><p>正在揭晓你的赛事与战队</p></div>`:`<div class="candidate-list">${pool.cards.filter(c=>c.role<=5).map(candidate).join('')}</div>`}<div class="draft-footer"><p class="fine-print">${replacing?'更换教练请点击阵容中的教练席，单独抽取年份并选择八强教练。':'点击名字查看当届统计、英雄使用与来源。'}</p><button class="text-button" data-action="data-info">数据说明 ${icon('chevron')}</button></div></div>${roster()}</div><div class="draft-footer">${saveStatus()}<button class="text-button" data-action="start">重新开始一局 ${icon('refresh')}</button></div></div>`;
  }
  function ready(){
    const cards=G.lineup(state),coach=cards[5],tactic=D.tactics[coach.recommendedTactic],continuing=state.history.length>0;
    return `<div class="page-shell">${crumbs('阵容确认')}<div class="page-heading"><div><div class="eyebrow">FIVE PLAYERS. ONE COACH.</div><h1>阵容齐备，准备出征。</h1><p>战队风格跟随教练，确认阵容与赛事即可开赛。</p></div>${steps(1)}</div><div class="section-heading"><h2>我的出战阵容</h2><small>英雄由教练自动 BP · 下方展示当届常用英雄</small></div><section class="ready-grid" aria-label="选手与教练阵容">${cards.slice(0,5).map(c=>`<article class="ready-card"><div class="ready-position-text">0${c.role} / ${D.roleEnglish[c.role-1]}</div><div class="ready-body"><button class="text-button ready-name" data-action="card-detail" data-card="${c.id}">${escape(c.name)}</button><p>${eventName(c.year)} · ${escape(c.teamName)}</p>${heroThumbs(c)}</div></article>`).join('')}<article class="ready-coach"><div class="ready-coach-heading"><div class="coach-wordmark">${icon('compass')}${D.roles[5]}</div><div><button class="text-button ready-name" data-action="card-detail" data-card="${coach.id}">${escape(coach.name)}</button><p>${eventName(coach.year)} · ${escape(coach.teamName)}</p></div><span class="tag">风格随教练</span></div>${stats(coach,'ready-coach-stats')}<p class="coach-scope-note">历史统计仅含已收录的 TI 八强执教记录，不计选手时期。</p></article></section><div class="coach-style-note">${icon(tactic.icon)}<div><span>本队风格 · 由 ${escape(coach.name)} 带领</span><strong>${tactic.name}</strong><p>${tactic.description} ${tactic.tradeoff}</p><small>风格为当届执教样本生成的游戏设定；更换教练后自动调整。</small></div></div><section class="launch-panel"><div><h3>${continuing?'下一站 · 已完成 '+state.history.length+' 届':'选择生涯起点'}</h3><div class="year-buttons">${(continuing?[state.year]:D.years).map(year=>`<button class="year-button" data-action="year" data-year="${year}" aria-pressed="${state.year===year}" ${continuing?'disabled':''}><b>${eventName(year)}</b><span>${year}${continuing?'':' · '+Math.min(G.MAX_EVENTS,D.years.length-D.years.indexOf(year))+' 届'}</span></button>`).join('')}</div><p class="fine-print">最多 10 届，按赛事顺序前进。2020 年未举办 TI，TI10 对应 2021 年。<br>挑战当届 8 支历史八强 · BO2 循环赛 + 八强双败 · 决赛 BO5</p></div><div class="launch-action"><button class="primary" data-action="simulate" ${processing?'disabled':''}>${processing?'正在计算赛事…':'征战 '+eventName(state.year)} ${icon('arrow')}</button><p>直接结算 · 自定义游戏赛制</p></div></section><div class="draft-footer">${saveStatus()}<button class="text-button" data-action="start">重新组队 ${icon('refresh')}</button></div></div>`;
  }
  function result(){
    const r=state.history.at(-1),path=r.bracket.filter(m=>m.a==='myteam'||m.b==='myteam'),group=r.standings.find(x=>x.id==='myteam'),final=r.bracket.at(-1),canNext=G.canAdvance(state);
    return `<div class="page-shell">${crumbs('赛事结果')}<div class="page-heading"><div><div class="eyebrow">THE ROAD TO THE AEGIS / ${r.year}</div><h1>${r.placement==='1'?'这一届，属于你的战队。':'每一场，都是传奇的一部分。'}</h1><p>${eventName(r.year)} · 自定义邀请赛 · 9 支战队参加 · 游戏模拟结果</p></div>${steps(2)}</div><section class="result-hero"><div><div class="eyebrow">${r.placement==='1'?'AEGIS OF CHAMPIONS':'YOUR TOURNAMENT RESULT'}</div><h2>${placementLabel(r.placement)}</h2><p>${r.placement==='1'?'从六席选择，到最后一场胜利。':`本届冠军：${escape(teamName(r.champion))} · 你已完成本届挑战。`}</p><div class="result-facts"><div><strong>${r.wins}<span class="muted"> — </span>${r.losses}</strong><small>小局胜负</small></div><div><strong>${Math.round(r.wins/(r.wins+r.losses)*100)}<small>%</small></strong><small>小局胜率</small></div><div><strong>${D.tactics[r.tactic].name}</strong><small>本届战术</small></div></div></div><div class="result-emblem">${icon(r.placement==='1'?'trophy':'shield')}</div></section><div class="result-columns"><section class="result-panel"><div class="section-heading"><h2>循环赛排名</h2><small>前 8 晋级 · 小局胜场计分</small></div><table class="standings"><thead><tr><th>排名</th><th>战队</th><th>胜</th><th>负</th><th>积分</th></tr></thead><tbody>${r.standings.map((t,i)=>`<tr class="${t.id==='myteam'?'my-row':''}"><td><span class="rank-number">${String(i+1).padStart(2,'0')}</span></td><td>${escape(t.name)}${t.id==='myteam'?' · 我的战队':''}</td><td>${t.wins}</td><td>${t.losses}</td><td>${t.wins}</td></tr>`).join('')}</tbody></table><p class="fine-print" style="margin-top:10px">同分按同分队相互战绩，再按本届种子签位排序。</p></section><section class="result-panel"><div class="section-heading"><h2>我的淘汰赛之路</h2><small>${path.length} 场系列赛</small></div>${path.length?path.map(m=>{const side=m.a==='myteam'?0:1,won=m.winner==='myteam';return `<div class="match-row"><div class="opponent">${escape(teamName(side?m.a:m.b))}<small>${m.stage} · BO${m.bestOf}</small></div><div><div class="match-score ${won?'won':'lost'}">${m.score[side]} — ${m.score[1-side]}</div><span class="result-tag">${won?'VICTORY':'DEFEAT'}</span></div></div>`;}).join(''):`<div class="empty-pool">${icon('shield')}<strong>止步循环赛</strong><p>${group.wins} 胜 ${group.losses} 负。下一届，重新出发。</p></div>`}<p class="fine-print" style="margin-top:16px">本届决赛：${escape(teamName(final.a))} ${final.score.join(' : ')} ${escape(teamName(final.b))}</p></section></div><div class="result-lineup" aria-label="本届出战阵容">${r.seats.map((id,i)=>`<span><b>${i===5?D.roles[5]:i+1}</b>${escape(D.cardMap[id].name)}</span>`).join('')}</div><details class="result-details"><summary>逐局战报与 BP <span class="muted">/ ${r.games.length} 局</span></summary><div class="games-list">${r.games.map((g,i)=>{const side=g.a==='myteam'?0:1,won=g.winner===side;return `<button class="game-button" data-action="game-detail" data-game="${i}"><span>${escape(teamName(side?g.a:g.b))}<small>${g.stage} · 第 ${i+1} 局 · ${g.minutes} 分钟</small></span><span class="${won?'gold':'muted'}">${won?'胜利':'失利'} ${icon('chevron')}</span></button>`;}).join('')}</div></details><details class="result-details"><summary>完整淘汰赛对阵 <span class="muted">/ 14 场系列赛</span></summary><div class="bracket-grid">${r.bracket.map(m=>`<div class="bracket-card"><small>${m.stage} · BO${m.bestOf}</small><div class="bracket-team ${m.winner===m.a?'winner':''}"><span>${escape(teamName(m.a))}</span><span>${m.score[0]}</span></div><div class="bracket-team ${m.winner===m.b?'winner':''}"><span>${escape(teamName(m.b))}</span><span>${m.score[1]}</span></div></div>`).join('')}</div></details><section class="offseason-panel"><div><h3>${canNext?(state.replacementUsed?'新的阵容，准备好了。':'下一届，再进一步。'):'这段旅程，值得记住。'}</h3><p>${canNext?(state.replacementUsed?'本届换人已完成，新阵容将在下一届出战。':'可随机抽签换一人，也可以和这支战队继续并肩作战。'):'已完成本段生涯，或到达 TI2026。开启新一局，尝试另一种组合。'}</p></div><div class="offseason-actions">${canNext?`${state.replacementUsed?'':`<button class="secondary" data-action="begin-replace">${icon('refresh')}${state.replacement?'继续本次换人':'抽签换一人'}</button>`}<button class="primary" data-action="next">${state.replacementUsed?'以新阵容':'保留阵容'}，进入 ${eventName(G.nextYear(state))} ${icon('arrow')}</button>`:'<button class="primary" data-action="start">开始新的旅程 '+icon('arrow')+'</button>'}</div></section><div class="history-strip" aria-label="生涯记录">${state.history.map(h=>`<div class="history-item ${h.year===r.year?'current':''}"><strong>${eventName(h.year)} · ${placementLabel(h.placement)}</strong><small>${h.year} / ${h.wins} 胜 ${h.losses} 负</small></div>`).join('')}</div><div class="draft-footer">${saveStatus()}<button class="text-button" data-action="data-info">历史数据与模拟说明 ${icon('info')}</button></div></div>`;
  }
  function filteredCards(){const q=archiveFilter.query.trim().toLowerCase();return D.cards.filter(c=>(!archiveFilter.year||String(c.year)===archiveFilter.year)&&(!archiveFilter.role||String(c.role)===archiveFilter.role)&&(!archiveFilter.team||c.team===archiveFilter.team)&&(!q||[c.name,c.teamName,D.teams[c.team].region,c.person].some(s=>s.toLowerCase().includes(q))||c.person===D.personId(q)));}
  function archiveCards(){const cards=filteredCards();return {count:`${cards.length} 张赛事版本卡 · 选手与教练使用同一人物身份`,html:cards.length?cards.slice(0,archiveFilter.limit).map(c=>`<button class="archive-card ${c.role===6?'coach-card':''}" data-action="card-detail" data-card="${c.id}" aria-label="查看 ${escape(c.name)} ${eventName(c.year)} ${escape(c.teamName)} 的卡片"><div class="archive-card-top"><span>${eventName(c.year)} <small>${c.year}</small></span><span>${c.role===6?D.roles[5]:'0'+c.role}</span></div><div class="archive-card-body"><h3>${escape(c.name)}</h3><p>${escape(c.teamName)}</p>${c.role===6?stats(c,'archive-coach-stats')+'<p class="coach-scope-note">已收录 TI 执教记录 · 仅教练身份</p>':heroThumbs(c)}<div class="archive-card-bottom"><span>${roleLabel(c)}</span>${icon('arrow')}</div></div></button>`).join(''):'<div class="archive-empty">没有匹配的卡片。试试其他名称、赛事或位置。</div>',more:cards.length>archiveFilter.limit};}
  function archive(){const list=archiveCards();return `<div class="page-shell">${crumbs('传奇图鉴')}<div class="page-heading"><div><div class="eyebrow">THE INTERNATIONAL / 2011 — 2026</div><h1>那些名字，依然闪耀。</h1><p>历届八强的五人阵容，及 TI10—TI15 每届八位代表教练。</p></div><span class="tag">15 届 · 120 个战队池</span></div><div class="archive-summary"><span><b>600</b> 张选手卡</span><span><b>${D.cards.length-600}</b> 张教练卡</span><span><b>560</b> 张有逐场统计</span><span>TI1 名单完整 · 统计待补</span></div><div class="archive-controls"><label class="search-field">${icon('search')}<input id="archive-search" aria-label="搜索选手、教练或战队" placeholder="搜索选手、教练或战队…" value="${escape(archiveFilter.query)}" autocomplete="off"></label><select id="archive-year" aria-label="筛选赛事"><option value="">全部赛事</option>${D.years.map(y=>`<option value="${y}" ${archiveFilter.year===String(y)?'selected':''}>${eventName(y)} · ${y}</option>`).join('')}</select><select id="archive-role" aria-label="筛选位置"><option value="">全部位置</option>${D.roles.map((r,i)=>`<option value="${i+1}" ${archiveFilter.role===String(i+1)?'selected':''}>${i===5?r:i+1+' 号位 · '+r}</option>`).join('')}</select><select id="archive-team" aria-label="筛选战队"><option value="">全部战队</option>${Object.entries(D.teams).map(([id,t])=>`<option value="${id}" ${archiveFilter.team===id?'selected':''}>${escape(t.name)}</option>`).join('')}</select></div><div id="archive-pools">${archivePools()}</div><div id="archive-count" class="archive-count" role="status">${list.count}</div><div class="archive-grid" id="archive-grid">${list.html}</div><div class="load-more" id="archive-more" ${list.more?'':'hidden'}><button class="secondary" data-action="load-more">查看更多卡片 ${icon('arrow')}</button></div><div class="draft-footer"><p class="fine-print">教练池限定 TI10—TI15，每队一张，共 48 张届次卡；同一人跨届不能重复入队。</p><button class="text-button" data-action="data-info">数据覆盖与来源 ${icon('info')}</button></div></div>`;}
  function archivePools(){if(!archiveFilter.year)return '';return `<div class="archive-pool-list" aria-label="当届八强">${D.pools.filter(p=>String(p.year)===archiveFilter.year).map(p=>`<div><span>${placementLabel(p.finish)}</span><b>${escape(p.name)}</b><small>${p.cards.filter(c=>c.role===6).map(c=>escape(c.name)).join(' / ')||'教练池从 TI10 开始'}</small></div>`).join('')}</div>`;}
  function updateArchive(){const list=archiveCards();document.getElementById('archive-grid').innerHTML=list.html;document.getElementById('archive-pools').innerHTML=archivePools();document.getElementById('archive-count').textContent=list.count;document.getElementById('archive-more').hidden=!list.more;}
  function render(){
    const view=route();document.querySelectorAll('[data-nav]').forEach(el=>{el.classList.toggle('active',el.dataset.nav===view);if(el.dataset.nav===view)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
    if(view==='archive')app.innerHTML=archive();
    else if(view==='play'&&state)app.innerHTML=['draft','replace'].includes(state.phase)?draft():state.phase==='ready'?ready():result();
    else app.innerHTML=landing();
    document.title=(view==='archive'?'传奇图鉴':view==='play'&&state?({draft:'阵容选秀',replace:'休赛期换人',ready:'阵容确认',result:'赛事结果'}[state.phase]):'五位传奇，一位名帅')+' · Dota 2 MyTeam';
  }
  function reveal(){
    save();clearTimeout(rollTimer);
    rolling={reduced:matchMedia('(prefers-reduced-motion: reduce)').matches};
    startRollStage(G.isCoachDraft(state)?'event':'pool');
  }
  function endReveal(){clearTimeout(rollTimer);rolling=null;render();}
  function scrollToDraw(){if(matchMedia('(max-width: 700px)').matches){app.querySelector('.draw-controls')?.scrollIntoView({block:'start',behavior:'instant'});app.focus({preventScroll:true});}}
  function newRun(){clearTimeout(rollTimer);state=G.start(randomSeed());rolling=null;rosterExpanded=false;closeModal();reveal();navigate('play');}
  function confirmStart(){if(!state){newRun();return;}showModal(`<div class="eyebrow">A NEW CHAPTER</div><h2 id="modal-title">开始新的组队旅程？</h2><p>当前阵容和生涯进度将被替换。选手重抽恢复 3 次，教练年份重抽恢复 1 次。</p><div class="dialog-actions"><button class="secondary" data-action="close-modal">保留当前进度</button><button class="primary" data-action="confirm-start">开始新一局 ${icon('arrow')}</button></div>`);}
  function rules(){showModal(`<div class="eyebrow">HOW TO PLAY</div><h2 id="modal-title">五位传奇，一位名帅。</h2><ol class="rules-list"><li>每轮随机遇见一届 TI 的八强战队，选择一名选手。1—5 号位各一人。</li><li>五名选手齐备后，只抽 TI10—TI15 的年份，从当届八强各一名代表教练中选择第六席，可独立重抽年份 1 次。同一人跨届、跨选手和教练身份不能重复。</li><li>选手轮一次重抽同时更换年份和战队，整段生涯共 3 次。教练轮只重抽年份，有独立的 1 次机会。没有合法候选不扣次数。</li><li>组队后确认阵容和生涯起点即可出征，战队风格自动跟随教练，无需选择风格或英雄。自动 BP 参考历史样本；选手保留常用英雄头像，教练展示擅长风格和 TI 执教统计。</li><li>MyTeam 加当届八强共 9 队，自定义 BO2 循环赛、八强双败，决赛 BO5。不是复刻原届赛制。</li><li>一段生涯最多 10 届，在 TI2026 截止。每届结束可换一名选手或教练，下届生效。换教练同样只抽年份，可重抽 1 次；取消或切换位置不会重置。</li></ol><p class="fine-print">结果由游戏规则生成，不预测真实比赛。进度保存在当前浏览器。</p><div class="dialog-actions"><button class="primary" data-action="close-modal">明白了 ${icon('check')}</button></div>`);}
  function dataInfo(){showModal(`<div class="eyebrow">DATA & GAME RULES</div><h2 id="modal-title">历史数据，新的旅程。</h2><p><b>卡库：</b>TI1（2011）至 TI15（2026），15 届、120 个八强战队池、600 张选手卡、${D.cards.length-600} 张教练卡。2020 年无赛事。每届名单保留历史队名，改名人物共享身份。</p><p><b>统计：</b>560 张选手卡按当届战队、账号关联 OpenDota 样本。TI1 暂无逐场样本，不虚构 KDA、GPM 等数据。位置为固定游戏席位，不代表逐局分路。早期统计可能有缺项，各指标展示独立样本数。</p><p><b>教练：</b>选秀与图鉴仅保留 TI10—TI15 八强，每队一张代表教练卡，共 48 张。多人教练组不额外生成可选卡。教练卡展示擅长风格、历史胜率、历史局数和最高成绩次数。历史统计只汇总已收录的 TI 八强执教经历，排除选手时期；未收录比赛不计入胜率。战队自动采用教练卡的风格。</p><p><b>模拟：</b>全时期共用英雄池和统一游戏参数，不还原各届补丁。选手统计在同届同位置内归一化，并对小样本收缩；缺失统计用中性参数。教练影响针对性禁用、英雄选择及战术适配，以上属于游戏设计，未做真实比赛预测校准。</p><details class="stats-method"><summary>逐届数据覆盖与名单来源</summary><div class="coverage-table">${D.events.map(e=>`<a href="${e.rosterSource}" target="_blank" rel="noopener noreferrer"><b>${e.name} · ${e.year}</b><span>8 队 · 40 选手 · ${e.coachCards} 教练</span><small>${e.statsStatus==='available'?'选手统计已接入':'逐场统计未收录'}</small></a>`).join('')}</div></details><p><a class="source-link" href="https://github.com/odota/core" target="_blank" rel="noopener noreferrer">OpenDota 数据项目 ↗</a></p><p class="fine-print">当前版本使用 TI10—TI15 八强教练池，新生涯不读取旧版存档。</p>`);}
  function cardDetail(id){
    const c=D.cardMap[id];if(!c)return;
    const extra=c.role===6?'':`<h3>当届常用英雄</h3><div class="detail-heroes">${c.heroes.map(id=>`<div class="detail-hero">${heroPortrait(id)}<span>${c.heroUsage[id]} 次选择</span></div>`).join('')||'<p class="fine-print">该届暂无英雄使用样本。</p>'}</div><p class="fine-print">卡面展示观测统计；模拟另用同届同位置归一化参数，不直接比较跨版本 GPM。</p>`;
    showModal(`<div class="eyebrow">${eventName(c.year)} / ${escape(c.teamName)}</div><h2 id="modal-title">${escape(c.name)} <span class="tag">${roleLabel(c)}</span></h2><p>${c.year} · ${escape(c.teamName)} · 当届${placementLabel(D.poolMap[c.poolId].finish)}</p>${stats(c,'detail-stats')}${statSources(c)}${extra}`);
  }
  function gameDetail(index){
    const r=state.history.at(-1),g=r.games[index];if(!g)return;
    const ours=g.a==='myteam'?0:1;
    const positions=D.roles;
    const matchTeamName=id=>id==='myteam'?'MyTeam':r.standings.find(t=>t.id===id)?.name||D.pools.find(p=>p.year===r.year&&p.team===id)?.name||id;
    const sides=['a','b'].map(side=>{
      const players=G.matchLineup(r,g[side]);
      return `<section class="bp-side" aria-label="${escape(matchTeamName(g[side]))} 出战英雄"><h3>${escape(matchTeamName(g[side]))}</h3><div class="bp-heroes">${g.draft[side].map((hero,i)=>`<div class="bp-hero">${heroPortrait(hero)}<div class="bp-operator"><small>${i+1} · ${positions[i]}</small><p><strong>${escape(players[i]?.name||'选手未收录')}</strong></p></div></div>`).join('')}</div></section>`;
    }).join('');
    showModal(`<div class="eyebrow">MATCH REPORT / ${g.stage}</div><h2 id="modal-title">${g.winner===ours?'胜利':'失利'} <span class="tag">${g.minutes} 分钟 · 模拟对局</span></h2><p>${escape(matchTeamName(g.a))} vs ${escape(matchTeamName(g.b))} · 击杀 ${g.kills.join(' : ')} · 防御塔 ${g.towers.join(' : ')}</p>${sides}<div class="bp-ban-list">禁用：${g.draft.banned.map(h=>D.heroMap[h].name).join('、')}</div><p class="fine-print">BP 教练：${g.draft.coaches.map((name,i)=>escape(name||'默认战术')+'（'+escape(matchTeamName(i?g.b:g.a))+'）').join(' / ')}。教练参考对手常用英雄执行禁用，并提高熟悉英雄的选择优先级。</p><h3 style="margin-top:22px">关键推进</h3><ul class="event-list">${g.events.slice(-5).map(e=>`<li><time>${e.minute}:00</time><span>${escape(matchTeamName(e.side===0?g.a:g.b))} · ${e.text}</span></li>`).join('')}</ul>`);
  }
  document.addEventListener('click',event=>{
    if(event.target.closest('.skip-link')){event.preventDefault();app.focus();app.scrollIntoView();return;}
    const button=event.target.closest('[data-action]');if(!button||button.disabled)return;const action=button.dataset.action;
    if(rolling&&['pick','reroll','replace-target'].includes(action))return;
    if(processing&&['start','simulate','year','next'].includes(action))return;
    try{
      if(action==='start')confirmStart();
      else if(action==='confirm-start')newRun();
      else if(action==='close-modal')closeModal();
      else if(action==='rules')rules();
      else if(action==='data-info')dataInfo();
      else if(action==='card-detail')cardDetail(button.dataset.card);
      else if(action==='toggle-roster'){rosterExpanded=!rosterExpanded;render();app.querySelector('[data-action="toggle-roster"]')?.focus({preventScroll:true});}
      else if(action==='skip-reveal')endReveal();
      else if(action==='reroll'){if(G.draw(state,button.dataset.kind))reveal();}
      else if(action==='pick'){
        const card=D.cardMap[button.dataset.card];if(!G.pick(state,card.id))return;save();toast(card.name+' 已加入你的战队');
        if(state.phase==='draft'){rosterExpanded=false;reveal();scrollToDraw();}else{render();window.scrollTo({top:0,behavior:'instant'});app.focus({preventScroll:true});}
      }
      else if(action==='year'&&state.phase==='ready'&&!state.history.length&&D.years.includes(Number(button.dataset.year))){state.year=Number(button.dataset.year);save();render();app.querySelector(`[data-year="${state.year}"]`).focus({preventScroll:true});}
      else if(action==='simulate'&&state.phase==='ready'){
        processing=true;render();setTimeout(()=>{try{G.finish(state);save();}catch(err){toast('计算未完成：'+err.message);}finally{processing=false;render();window.scrollTo({top:0,behavior:'instant'});app.focus({preventScroll:true});}},60);
      }
      else if(action==='begin-replace'){const fresh=!state.replacement;if(G.beginReplacement(state)){save();if(fresh)reveal();else render();window.scrollTo({top:0,behavior:'instant'});}}
      else if(action==='replace-target'){const role=Number(button.dataset.role),fresh=role===6&&state.replacement.coachDraft.year===null;if(G.replacementTarget(state,role)){save();if(fresh)reveal();else render();toast(role===6?'已进入八强教练直选':'已选择替换 '+role+' 号位');}}
      else if(action==='cancel-replace'){clearTimeout(rollTimer);rolling=null;G.cancelReplacement(state);save();render();window.scrollTo({top:0,behavior:'instant'});}
      else if(action==='next'){if(G.next(state)){save();render();window.scrollTo({top:0,behavior:'instant'});}}
      else if(action==='game-detail')gameDetail(Number(button.dataset.game));
      else if(action==='load-more'){archiveFilter.limit+=24;updateArchive();}
    }catch(error){toast(error.message||'操作暂未完成，请重试。');}
  });
  document.addEventListener('change',event=>{
    const el=event.target;
    if(['archive-year','archive-role','archive-team'].includes(el.id)){archiveFilter[el.id.slice(8)]=el.value;archiveFilter.limit=24;updateArchive();}
  });
  document.addEventListener('input',event=>{if(event.target.id==='archive-search'){archiveFilter.query=event.target.value;archiveFilter.limit=24;updateArchive();}});
  modal.addEventListener('click',event=>{if(event.target===modal){const rect=modal.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)closeModal();}});
  window.addEventListener('hashchange',()=>{render();window.scrollTo({top:0,behavior:'instant'});});
  render();if(loadMessage)toast(loadMessage);
})();
