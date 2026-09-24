(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;else root.DotaCareer=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const HOME='https://dota2-myteam.vercel.app/';
  const YEARS=[2011,2012,2013,2014,2015,2016,2017,2018,2019,2021,2022,2023,2024,2025,2026];
  const ROLES=['Carry','Midlaner','Offlaner','Soft Support','Hard Support','Coach'];
  const PLACES=['1','2','3','4','5–6','7–8'];
  const fail=()=>{throw Error('生涯分享数据不完整或链接已损坏。');};
  const integer=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
  const label=(s,max)=>typeof s==='string'&&s.trim().length>0&&[...s].length<=max&&!/[\u0000-\u001f\u007f]/.test(s);
  const eventName=year=>'TI'+(YEARS.indexOf(year)+1);
  const placeName=p=>({'1':'冠军','2':'亚军','3':'季军','4':'第 4 名','5–6':'第 5–6 名','7–8':'第 7–8 名'}[p]);

  // Versioned, self-contained display snapshot. It never imports a playable save.
  function validate(s){
    if(!s||s.version!==1||!label(s.name,24)||!Array.isArray(s.members)||!integer(s.members.length,6,90)||!Array.isArray(s.events)||s.events.length!==15)fail();
    const members=s.members.map(m=>{
      if(!m||!label(m.id,100)||!label(m.name,64)||!YEARS.includes(m.year)||!integer(m.role,1,6))fail();
      return {id:m.id,name:m.name,year:m.year,role:m.role};
    });
    if(new Set(members.map(m=>m.id)).size!==members.length)fail();
    const used=new Set();
    const events=s.events.map((e,i)=>{
      if(!e||e.year!==YEARS[i]||!PLACES.includes(e.placement)||!integer(e.wins,0,30)||!integer(e.losses,0,30)||e.wins+e.losses===0||!Array.isArray(e.seats)||e.seats.length!==6||new Set(e.seats).size!==6)fail();
      e.seats.forEach((n,role)=>{if(!integer(n,0,members.length-1)||members[n].role!==role+1)fail();used.add(n);});
      return {year:e.year,placement:e.placement,wins:e.wins,losses:e.losses,seats:[...e.seats]};
    });
    if(used.size!==members.length)fail();
    return {version:1,name:s.name,members,events};
  }
  function fromState(state,data){
    if(!state||state.history?.length!==15)throw Error('完成 TI15 后即可生成生涯总结。');
    const members=[],ids=new Map();
    const events=state.history.map(r=>({year:r.year,placement:String(r.placement),wins:r.wins,losses:r.losses,seats:(r.seats||[]).map(id=>{
      const c=data.cardMap[id];if(!c)throw Error('历史阵容中有未能读取的成员，暂时无法分享。');
      if(!ids.has(id)){ids.set(id,members.length);members.push({id:c.id,name:c.name,year:c.year,role:c.role});}
      return ids.get(id);
    })}));
    return validate({version:1,name:state.teamName,members,events});
  }
  function overview(s){
    const wins=s.events.reduce((n,e)=>n+e.wins,0),losses=s.events.reduce((n,e)=>n+e.losses,0);
    const champions=s.events.filter(e=>e.placement==='1');
    const bestIndex=Math.min(...s.events.map(e=>PLACES.indexOf(e.placement)));
    return {wins,losses,winRate:(wins/(wins+losses)*100).toFixed(1),champions,finals:s.events.filter(e=>['1','2'].includes(e.placement)).length,best:s.events.filter(e=>PLACES.indexOf(e.placement)===bestIndex)};
  }
  function changed(s,event,seat){return event>0&&s.events[event].seats[seat]!==s.events[event-1].seats[seat];}

  // Dictionary + per-edition roster deltas keep fifteen seasons compact without
  // browser compression dependencies. Names/editions survive future catalog edits.
  function encode(snapshot){
    const s=validate(snapshot);
    const rows=s.events.map((e,i)=>[PLACES.indexOf(e.placement),e.wins,e.losses,i?e.seats.flatMap((n,j)=>n===s.events[i-1].seats[j]?[]:[j,n]):e.seats]);
    const bytes=new TextEncoder().encode(JSON.stringify([1,s.name,s.members.map(m=>[m.id,m.name,m.year,m.role]),rows]));
    const token=btoa(Array.from(bytes,b=>String.fromCharCode(b)).join('')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    if(token.length>18000)throw Error('这份生涯链接过长，请改用长图分享。');
    return token;
  }
  function decode(token){
    try{
      if(typeof token!=='string'||token.length>18000||!/^[A-Za-z0-9_-]+$/.test(token))fail();
      const bytes=Uint8Array.from(atob(token.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
      const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
      if(!Array.isArray(value)||value.length!==4||value[0]!==1||!Array.isArray(value[2])||!Array.isArray(value[3])||value[3].length!==15)fail();
      let seats=[];
      const events=value[3].map((row,i)=>{
        if(!Array.isArray(row)||row.length!==4||!integer(row[0],0,5)||!Array.isArray(row[3]))fail();
        if(!i)seats=[...row[3]];
        else{
          const delta=row[3];if(delta.length>12||delta.length%2)fail();
          const touched=new Set();
          for(let j=0;j<delta.length;j+=2){if(!integer(delta[j],0,5)||touched.has(delta[j]))fail();touched.add(delta[j]);seats[delta[j]]=delta[j+1];}
        }
        return {year:YEARS[i],placement:PLACES[row[0]],wins:row[1],losses:row[2],seats:[...seats]};
      });
      const members=value[2].map(m=>{if(!Array.isArray(m)||m.length!==4)fail();return {id:m[0],name:m[1],year:m[2],role:m[3]};});
      return validate({version:value[0],name:value[1],members,events});
    }catch{fail();}
  }
  const url=s=>HOME+'#share='+encode(s);
  return {HOME,YEARS,ROLES,PLACES,eventName,placeName,validate,fromState,overview,changed,encode,decode,url};
});
