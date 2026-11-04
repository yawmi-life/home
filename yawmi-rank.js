/* YAWMI seasonal ranks. Lifetime level and XP remain preserved in the personal dashboard. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const RANKS=[
{name:'برونز',en:'BRONZE',min:0,icon:'⬡',color:'#b98757'},
{name:'سيلفر',en:'SILVER',min:400,icon:'◈',color:'#aab9d6'},
{name:'جولد',en:'GOLD',min:1200,icon:'✦',color:'#efbd58'},
{name:'بلاتينيوم',en:'PLATINUM',min:2500,icon:'◆',color:'#75c7ce'},
{name:'دايموند',en:'DIAMOND',min:4000,icon:'✧',color:'#66b7fc'},
{name:'كراون',en:'CROWN',min:6000,icon:'♛',color:'#c28afa'},
{name:'آيس',en:'ACE',min:8500,icon:'✷',color:'#f2a2c3'},
{name:'كونكر',en:'CONQUEROR',min:12000,icon:'♜',color:'#ffc66e'}
];
function current(xp){let i=0;while(i+1<RANKS.length&&xp>=RANKS[i+1].min)i++;return {i,rank:RANKS[i],next:RANKS[i+1]||null}}
function render(scores){
const box=$('ymRankPanel'),home=$('ymRankHome');if(!box||!home)return;
const xp=Math.max(0,+window.YawmiSeasons?.current?.xp||0),v=current(xp),diff=v.next?v.next.min-v.rank.min:1,pct=v.next?Math.min(100,((xp-v.rank.min)/diff)*100):100;
box.innerHTML='<div class="ym-rank-current"><div class="ym-rank-medal" style="--rank-color:'+v.rank.color+'"><span>'+v.rank.icon+'</span><small>'+v.rank.en+'</small></div><div class="ym-rank-heading"><small>تصنيفك الموسمي</small><h3>'+v.rank.name+'</h3><p>'+xp.toLocaleString('en-US')+' XP في الموسم الحالي</p><div class="progress"><i style="width:'+pct+'%"></i></div><small>'+(v.next?'باقي '+(v.next.min-xp).toLocaleString('en-US')+' XP للترقية إلى '+v.next.name:'وصلت لأعلى رتبة!')+'</small></div></div><div class="ym-rank-ladder">'+RANKS.map((r,i)=>'<div class="ym-rank-step '+(xp>=r.min?'unlocked':'locked')+(i===v.i?' current':'')+'" style="--rank-color:'+r.color+'"><span>'+r.icon+'</span><b>'+r.name+'</b><small>'+r.min.toLocaleString('en-US')+' XP</small></div>').join('')+'</div><p class="ym-rank-disclaimer">الرتبة تخص الموسم الحالي وتعود إلى برونز عند بداية الموسم التالي. نقاطك الدائمة ومستواك الشخصي وأوسمتك السابقة محفوظة.</p>';
home.innerHTML='<span class="ym-rank-mini-icon" style="color:'+v.rank.color+'">'+v.rank.icon+'</span><div><small>رتبتك الموسمية</small><b>'+v.rank.name+'</b></div><small>'+(v.next?'متبقي '+(v.next.min-xp).toLocaleString('en-US')+' XP':'الأعلى')+'</small>';
}
window.YawmiRank={render,RANKS};try{if(window.YawmiExtraAPI)render(window.YawmiExtraAPI.getScores())}catch(_){}
})();