/* YAWMI v15 — lifetime achievement ranks; original iconography */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const RANKS=[
{name:'برونز',en:'BRONZE',min:0,icon:'⬡',color:'#b98757'},
{name:'سيلفر',en:'SILVER',min:1000,icon:'◈',color:'#aab9d6'},
{name:'جولد',en:'GOLD',min:3000,icon:'✦',color:'#efbd58'},
{name:'بلاتينيوم',en:'PLATINUM',min:6500,icon:'◆',color:'#75c7ce'},
{name:'دايموند',en:'DIAMOND',min:11500,icon:'✧',color:'#66b7fc'},
{name:'كراون',en:'CROWN',min:18000,icon:'♛',color:'#c28afa'},
{name:'آيس',en:'ACE',min:27000,icon:'✷',color:'#f2a2c3'},
{name:'كونكر',en:'CONQUEROR',min:40000,icon:'♜',color:'#ffc66e'}
];
function current(xp){let i=0;while(i+1<RANKS.length&&xp>=RANKS[i+1].min)i++;return {i,rank:RANKS[i],next:RANKS[i+1]||null}}
function render(scores){
const box=$('ymRankPanel'),home=$('ymRankHome');if(!box||!home)return;
const xp=Math.max(0,+scores?.xp||0),v=current(xp),diff=v.next?v.next.min-v.rank.min:1,pct=v.next?Math.min(100,((xp-v.rank.min)/diff)*100):100;
box.innerHTML='<div class="ym-rank-current"><div class="ym-rank-medal" style="--rank-color:'+v.rank.color+'"><span>'+v.rank.icon+'</span><small>'+v.rank.en+'</small></div><div class="ym-rank-heading"><small>تصنيفك الحالي</small><h3>'+v.rank.name+'</h3><p>'+xp.toLocaleString('en-US')+' XP إجمالي الخبرة</p><div class="progress"><i style="width:'+pct+'%"></i></div><small>'+(v.next?'باقي '+(v.next.min-xp).toLocaleString('en-US')+' XP للترقية إلى '+v.next.name:'وصلت لأعلى رتبة!')+'</small></div></div><div class="ym-rank-ladder">'+RANKS.map((r,i)=>'<div class="ym-rank-step '+(xp>=r.min?'unlocked':'locked')+(i===v.i?' current':'')+'" style="--rank-color:'+r.color+'"><span>'+r.icon+'</span><b>'+r.name+'</b><small>'+r.min.toLocaleString('en-US')+' XP</small></div>').join('')+'</div><p class="ym-rank-disclaimer">الرتبة تعتمد على إجمالي الخبرة الحقيقية المسجلة عبر الأيام. تغيير الثيم أو مرور الوقت لا يصفر تقدمك.</p>';
home.innerHTML='<span class="ym-rank-mini-icon" style="color:'+v.rank.color+'">'+v.rank.icon+'</span><div><small>رتبتك الحالية</small><b>'+v.rank.name+'</b></div><small>'+(v.next?'متبقي '+(v.next.min-xp).toLocaleString('en-US')+' XP':'الأعلى')+'</small>';
}
window.YawmiRank={render,RANKS};try{if(window.YawmiExtraAPI)render(window.YawmiExtraAPI.getScores())}catch(_){}
})();