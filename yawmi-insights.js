/* YAWMI v15 — monthly calendar + yearly heatmaps, user history preserved */
(()=>{'use strict';
const $=id=>document.getElementById(id),app=()=>window.YawmiExtraAPI;
let year=new Date().getFullYear(),month=new Date().getMonth()+1,annual=false;
const daysIn=(y,m)=>new Date(y,m,0).getDate(),two=x=>String(x).padStart(2,'0');
const key=(y,m,d)=>y+'-'+two(m)+'-'+two(d);
const monthNames=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
function initYears(){
const s=app()?.getState();if(!s)return;
const years=[...new Set([new Date().getFullYear(),...Object.keys(s.daily||{}).map(d=>Number(d.slice(0,4))).filter(y=>y>1900),...((s.quran?.khatmas)||[]).map(k=>Number(String(k.date).slice(0,4)))])].sort((a,b)=>b-a);
const y=$('ymHeatYear');if(!y)return;let was=Number(y.value)||year;
y.innerHTML=years.map(v=>'<option value="'+v+'">'+v+'</option>').join('');
year=years.includes(was)?was:years[0];y.value=String(year);
$('ymHeatMonth').value=String(month);
$('ymHeatMode').value=annual?'year':'month';
}
function activity(day){
const s=app().getState(),r=s.daily?.[day];if(!r)return -1;
const tasks=Object.values(r.tasks||{}).filter(Boolean).length,habits=Object.values(r.habits||{}).filter(n=>Number(n)>0).length;
const water=Math.max(0,+r.waterMl||0),books=+r.bookXp||0;
const count=tasks+habits+(water>0?1:0)+(books>0?1:0);
return count===0?0:count<3?1:count<7?2:3;
}
function cell(y,m,d){
const k=key(y,m,d),v=activity(k);
return '<button type="button" class="ym-heat-cell '+(v<0?'empty':'level-'+v)+'" data-yam-day="'+k+'" title="'+k+' · '+(v<0?'لم يسجل شيء':v===0?'بدون إنجاز':'نشاط مسجل')+'"><span>'+d+'</span></button>';
}
function drawMonth(y,m,compact=false){
const start=new Date(y,m-1,1).getDay(),total=daysIn(y,m),blanks=Array.from({length:start},()=>'<span class="ym-heat-pad"></span>').join('');
const cells=Array.from({length:total},(_,i)=>cell(y,m,i+1)).join('');
return '<div class="ym-month-chart '+(compact?'small':'')+'"><div class="ym-weekdays"><span>أحد</span><span>إثنين</span><span>ثلاثاء</span><span>أربعاء</span><span>خميس</span><span>جمعة</span><span>سبت</span></div><div class="ym-month-grid">'+blanks+cells+'</div></div>';
}
function render(){
if(!$('ymHeatYear'))return;initYears();
const target=$('ymCalendarContent'),s=app().getState();
if(annual){
 target.innerHTML='<div class="ym-annual-grid">'+monthNames.map((n,i)=>'<section class="ym-mini-month"><button type="button" data-heat-month="'+(i+1)+'">'+n+' '+year+' ←</button>'+drawMonth(year,i+1,true)+'</section>').join('')+'</div>';
 $('ymHeatCaption').textContent='عرض سنة '+year+' كاملة، مع إمكانية فتح كل شهر';
}else{
 target.innerHTML=drawMonth(year,month);
 $('ymHeatCaption').textContent=monthNames[month-1]+' '+year+' · جميع الأيام';
}
let records=Object.keys(s.daily||{}).filter(d=>d.startsWith(String(year))&&(!annual?d.slice(5,7)===two(month):true));
const active=records.filter(d=>activity(d)>0).length;
$('ymHeatStats').textContent=active+' يوم نشط · '+records.length+' يوم له سجل';
}
function wire(){
if(!$('ymHeatYear'))return;
const y=$('ymHeatYear'),m=$('ymHeatMonth'),mode=$('ymHeatMode');
m.innerHTML=monthNames.map((n,i)=>'<option value="'+(i+1)+'">'+n+'</option>').join('');
y.addEventListener('change',()=>{year=Number(y.value);render()});
m.addEventListener('change',()=>{month=Number(m.value);annual=false;render()});
mode.addEventListener('change',()=>{annual=mode.value==='year';render()});
$('ymCalendarContent').addEventListener('click',e=>{
const pick=e.target.closest('[data-heat-month]');if(pick){month=Number(pick.dataset.heatMonth);annual=false;render();return;}
const cell=e.target.closest('[data-yam-day]');if(!cell)return;
const day=cell.dataset.yamDay;
$('ymHeatSelectedDay').textContent='يوم '+day+' · '+(app().getState().daily?.[day]?.note||'لا توجد ملاحظات')+' · '+(activity(day)<0?'لا توجد بيانات محفوظة':'نشاط: '+(activity(day)===0?'صفر':'مسجل'));
});
render();
}
window.YawmiInsights={render};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();