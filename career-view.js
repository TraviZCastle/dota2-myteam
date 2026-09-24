(function(){
  'use strict';
  const C=window.DotaCareer;
  const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const shield=year=>'assets/aegis/'+(year<2013?'2011-2012':year)+'.png';
  const aegis=year=>`<img src="${shield(year)}" alt="${C.eventName(year)} 冠军盾" width="80" height="80">`;
  function page(snapshot,shared=false){
    const s=C.validate(snapshot),o=C.overview(s),final=s.events.at(-1);
    return `<div class="page-shell career-page">
      <div class="career-toolbar"><a class="text-button" href="${shared?'#home':'#play'}">← ${shared?'游戏首页':'TI15 赛事结果'}</a><div class="career-actions"><button class="secondary" data-action="career-link">复制生涯分享链接</button><button class="primary" data-action="career-image">保存生涯长图</button></div></div>
      <article class="career-sheet" aria-label="${esc(s.name)} 的完整生涯">
        <section class="career-overview">
          <div class="career-brand"><img src="assets/brand/dota2-symbol.png" alt="Dota 2" width="28" height="28"><span>MYTEAM <b>/ THE LEGACY</b></span><small>TI1 — TI15</small></div>
          <div class="career-headline"><div><p class="career-kicker">十五届征途 · 一支传奇</p><h1>${esc(s.name)}</h1><p class="career-subtitle">THE INTERNATIONAL · 生涯纪念</p></div>${o.champions.length?`<div class="career-hero-aegis">${aegis(o.champions.at(-1).year)}</div>`:'<div class="career-best-seal"><small>生涯最高</small><strong>'+C.placeName(o.best[0].placement)+'</strong></div>'}</div>
          <div class="career-stats"><div><strong>${o.champions.length}<small>次</small></strong><span>问鼎冠军</span></div><div><strong>${o.finals}<small>次</small></strong><span>晋级决赛</span></div><div><strong>${o.winRate}<small>%</small></strong><span>小局胜率 · ${o.wins} 胜 ${o.losses} 负</span></div></div>
          ${o.champions.length?`<div class="career-honors" aria-label="夺冠届次">${o.champions.map(e=>`<div>${aegis(e.year)}<span>${C.eventName(e.year)}</span></div>`).join('')}</div>`:`<div class="career-no-title">最佳战绩 <strong>${C.placeName(o.best[0].placement)}</strong><span>${o.best.map(e=>C.eventName(e.year)).join(' · ')}</span></div>`}
        </section>
        <section class="career-section"><div class="career-section-title"><h2><span>01</span> 最终阵容</h2><small>TI15 · 2026</small></div><div class="career-lineup">${final.seats.map((id,i)=>{const m=s.members[id];return `<div class="career-member ${i===5?'is-coach':''}"><span>${C.ROLES[i]}</span><strong>${esc(m.name)}</strong><small>${C.eventName(m.year)}</small></div>`;}).join('')}</div></section>
        <section class="career-section career-seasons"><div class="career-section-title"><h2><span>02</span> 十五届征程</h2><small><i class="career-change-dot"></i> 新加入成员</small></div><div class="career-table-scroll" tabindex="0" role="region" aria-label="逐届名次与阵容，可横向滚动"><table class="career-table"><thead><tr><th scope="col">赛事</th><th scope="col">名次</th>${C.ROLES.map(r=>`<th scope="col">${r}</th>`).join('')}</tr></thead><tbody>${s.events.map((e,i)=>`<tr class="${e.placement==='1'?'won-title':''}"><th scope="row">${C.eventName(e.year)}</th><td><div class="career-place">${e.placement==='1'?aegis(e.year):''}<span>${C.placeName(e.placement)}</span></div></td>${e.seats.map((id,j)=>{const m=s.members[id],changed=C.changed(s,i,j);return `<td class="${changed?'member-joined':''}"><strong>${changed?'<span class="sr-only">新加入：</span>':''}${esc(m.name)}</strong><small>${C.eventName(m.year)}${changed?' · 新加入':''}</small></td>`;}).join('')}</tr>`).join('')}</tbody></table></div></section>
        <footer class="career-qr"><div><p>下一段传奇，由你书写。</p><span>扫码，组建你的传奇战队</span><small>Dota 2 MyTeam · 模拟生涯</small></div><a href="${C.HOME}" aria-label="进入 Dota 2 MyTeam 游戏首页"><img src="assets/share/game-qr.png" alt="游戏首页二维码" width="164" height="164"></a></footer>
      </article><div class="career-play"><a class="primary" href="#home">组建我的战队 <span aria-hidden="true">→</span></a></div></div>`;
  }

  // Draw at a fixed 1080 px width, independent of viewport, scroll position or
  // HTML screenshot support. DOM and canvas consume the same validated snapshot.
  async function poster(snapshot){
    const s=C.validate(snapshot),o=C.overview(s);
    if(document.fonts?.ready)await document.fonts.ready;
    const paths=[...new Set(['assets/brand/dota2-symbol.png','assets/share/game-qr.png',...o.champions.map(e=>shield(e.year))])];
    const assets=Object.fromEntries(await Promise.all(paths.map(src=>new Promise((resolve,reject)=>{
      const img=new Image(),timer=setTimeout(()=>reject(Error('素材加载超时，请重试。')),15000);
      img.onload=()=>{clearTimeout(timer);resolve([src,img]);};img.onerror=()=>{clearTimeout(timer);reject(Error('长图素材未能加载，请检查网络后重试。'));};img.src=src;
    }))));
    const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
    if(!ctx)throw Error('此浏览器无法生成图片，请使用分享链接。');
    const font='-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
    const ink='#edece5',muted='#9ca9ad',gold='#cfb879',accent='#ee987c',line='#303b3f';
    const setFont=(size,weight=400)=>{ctx.font=`${weight} ${size}px ${font}`;};
    function wrap(text,width,size,weight=400){
      setFont(size,weight);const lines=[];let row='';
      for(const c of [...String(text)]){if(row&&ctx.measureText(row+c).width>width){lines.push(row);row=c;}else row+=c;}
      if(row)lines.push(row);return lines;
    }
    const nameLines=wrap(s.name,736,66,700),titleHeight=nameLines.length*80;
    const honorHeight=o.champions.length?Math.ceil(o.champions.length/10)*98+26:100;
    const final=s.events.at(-1),memberLines=final.seats.map(id=>wrap(s.members[id].name,136,24,650));
    const cardHeight=Math.max(132,Math.max(...memberLines.map(l=>l.length))*30+78);
    const widths=[60,114,135,135,135,135,135,135],xs=[48];
    widths.forEach((w,i)=>xs.push(xs[i]+w));
    const rows=s.events.map(e=>{const lines=e.seats.map(id=>wrap(s.members[id].name,117,21,600));return {lines,height:Math.max(78,Math.max(...lines.map(l=>l.length))*27+43)};});
    const topHeight=152+titleHeight+158+honorHeight;
    const lineupY=topHeight+32,tableY=lineupY+66+cardHeight+62;
    const footerY=tableY+100+rows.reduce((sum,r)=>sum+r.height,0)+38;
    canvas.width=1080;canvas.height=footerY+236;
    ctx.fillStyle='#11191c';ctx.fillRect(0,0,canvas.width,canvas.height);
    const gradient=ctx.createLinearGradient(0,0,1080,topHeight);gradient.addColorStop(0,'#333128');gradient.addColorStop(.7,'#192326');gradient.addColorStop(1,'#11191c');ctx.fillStyle=gradient;ctx.fillRect(0,0,1080,topHeight);
    function text(value,x,y,size=22,color=ink,weight=400){setFont(size,weight);ctx.fillStyle=color;ctx.textBaseline='top';ctx.fillText(String(value),x,y);}
    function rule(y){ctx.fillStyle=line;ctx.fillRect(48,y,984,1);}
    function contain(img,x,y,w,h){const scale=Math.min(w/img.width,h/img.height);ctx.drawImage(img,x+(w-img.width*scale)/2,y+(h-img.height*scale)/2,img.width*scale,img.height*scale);}
    contain(assets['assets/brand/dota2-symbol.png'],48,40,34,34);text('MYTEAM / THE LEGACY',96,45,21,gold,600);text('TI1 — TI15',872,45,21,muted);
    text('十五届征途 · 一支传奇',48,113,23,gold);
    nameLines.forEach((l,i)=>text(l,48,158+i*80,66,ink,700));
    text('THE INTERNATIONAL · 生涯纪念',48,158+titleHeight+10,18,muted);
    if(o.champions.length)contain(assets[shield(o.champions.at(-1).year)],820,107,210,210);
    else{text('生涯最高',852,143,21,muted);text(C.placeName(o.best[0].placement),826,185,32,gold,600);}
    const statY=158+titleHeight+68;
    [[o.champions.length+' 次','问鼎冠军'],[o.finals+' 次','晋级决赛'],[o.winRate+'%','小局胜率 · '+o.wins+' 胜 '+o.losses+' 负']].forEach(([v,l],i)=>{text(v,48+i*328,statY,44,gold,650);text(l,48+i*328,statY+57,20,muted);});
    const honorY=statY+101;rule(honorY-12);
    if(o.champions.length)o.champions.forEach((e,i)=>{const x=48+(i%10)*98,y=honorY+Math.floor(i/10)*98;contain(assets[shield(e.year)],x+12,y,62,65);text(C.eventName(e.year),x+18,y+68,18,gold,600);});
    else{text('最佳战绩 · '+C.placeName(o.best[0].placement),48,honorY+4,24,gold,600);wrap(o.best.map(e=>C.eventName(e.year)).join(' · '),970,18).forEach((l,i)=>text(l,48,honorY+42+i*24,18,muted));}
    function heading(n,title,y,extra){text(n,48,y+3,20,gold,600);text(title,92,y,28,ink,650);text(extra,805,y+5,18,muted);}
    heading('01','最终阵容',lineupY,'TI15 · 2026');
    final.seats.forEach((id,i)=>{
      const m=s.members[id],x=48+i*166,y=lineupY+60;
      ctx.fillStyle=i===5?'#2c2c24':'#1c272b';ctx.fillRect(x,y,154,cardHeight);ctx.fillStyle=i===5?gold:line;ctx.fillRect(x,y,154,2);
      text(C.ROLES[i],x+10,y+17,16,i===5?gold:muted);
      memberLines[i].forEach((l,j)=>text(l,x+10,y+48+j*30,24,ink,650));text(C.eventName(m.year),x+10,y+cardHeight-31,18,muted);
    });
    heading('02','十五届征程',tableY,'● 新加入成员');
    let y=tableY+57;ctx.fillStyle='#202c30';ctx.fillRect(48,y,984,40);
    ['赛事','名次',...C.ROLES].forEach((v,i)=>text(v,xs[i]+8,y+12,15,muted,500));y+=43;
    s.events.forEach((e,i)=>{
      const row=rows[i];ctx.fillStyle=e.placement==='1'?'#282b24':i%2?'#182226':'#141e22';ctx.fillRect(48,y,984,row.height);
      text(C.eventName(e.year),xs[0]+8,y+25,20,gold,600);
      if(e.placement==='1'){contain(assets[shield(e.year)],xs[1]+5,y+12,37,48);text('冠军',xs[1]+46,y+27,20,gold,600);}else text(C.placeName(e.placement),xs[1]+8,y+27,18,muted);
      e.seats.forEach((id,j)=>{const m=s.members[id],changed=C.changed(s,i,j),x=xs[j+2]+8;row.lines[j].forEach((l,k)=>text(l,x,y+15+k*27,21,changed?accent:ink,600));text(C.eventName(m.year)+(changed?' · 新':' '),x,y+15+row.lines[j].length*27+5,15,changed?accent:muted);});
      y+=row.height;rule(y);
    });
    rule(footerY);text('下一段传奇，由你书写。',48,footerY+40,32,ink,650);text('扫码，组建你的传奇战队',48,footerY+92,23,gold);text('Dota 2 MyTeam · 模拟生涯',48,footerY+151,18,muted);text('dota2-myteam.vercel.app',48,footerY+180,16,muted);
    ctx.imageSmoothingEnabled=false;ctx.drawImage(assets['assets/share/game-qr.png'],840,footerY+27,185,185);
    return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('图片生成失败，请重试。')),'image/png'));
  }
  window.DotaCareerView={page,poster};
})();
