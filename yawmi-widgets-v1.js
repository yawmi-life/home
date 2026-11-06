/* YAWMI Smart Widgets v1 - Read-only, account-scoped, theme-aware widgets. */
(()=>{'use strict';
const ITEMS=[
 ['today','📊','إنجاز اليوم','home'],['tasks','✅','المهام','tasks'],['habits','🌱','العادات','habits'],
 ['focus','⏳','جلسة التركيز','home'],['goals','🎯','الأهداف','goals'],['books','📚','القراءة','books'],
 ['quran','📖','القرآن','quran'],['water','💧','شرب المياه','habits'],['journey','🏆','رحلتك','journey'],
 ['money','💳','المالية','money'],['calendar','🗓️','التقويم','calendar'],['diary','✍️','اليوميات','diary'],
 ['notes','📝','الملاحظات','notes'],['health','❤️','الصحة','health'],['routines','🌅','الروتين','routines'],
 ['planning','🧭','التخطيط','planning'],['reports','📈','التحليلات','reports'],['coach','✨','المراجعة الأسبوعية','coach']
];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api=()=>window.YawmiExtraAPI;
const today=()=>api()?.today?.()||new Date().toLocaleDateString('en-CA');
const value=(s,id)=>{const d=s.daily?.[today()]||{},habits=d.habits||{},tasks=d.tasks||{};
 switch(id){
 case 'today':{const tt=(s.tasks||[]).length,done=Object.values(tasks).filter(Boolean).length;return tt?Math.min(tt,done)+' من '+tt+' مهام مكتملة':'ابدأ بإنجازك الأول'}
 case 'tasks':return (s.tasks||[]).filter(t=>!!tasks[t.id]).length+' / '+(s.tasks||[]).length+' مكتملة';
 case 'habits':{const h=(s.habits||[]).filter(x=>x.id!=='water'&&x.id!=='reading'&&x.id!=='quran');const done=h.filter(x=>(Number(habits[x.id])||0)>=Math.max(1,Number(x.target)||1)).length;return done+' / '+h.length+' عادات مكتملة'}
 case 'goals':{const g=s.goals||[];return g.filter(x=>Number(x.target)>0&&Number(x.progress)>=Number(x.target)).length+' / '+g.length+' أهداف مكتملة'}
 case 'books':return (s.books||[]).length+' كتاب في مكتبتي';
 case 'water':{const p=s.waterPrefs||{},cup=Number(p.cupMl)||250,goal=Number(p.goalMl)||2000;const ml=Number(d.waterMl??((Number(d.water)||0)*cup));return Math.round(Math.max(0,ml))+' / '+goal+' مل'}
 case 'journey':{const score=api()?.getScores?.();return Number(score?.xp||0).toLocaleString('ar')+' XP مكتسبة'}
 case 'focus':return 'ابدأ جلسة مرتبطة بمهمة أو هدف';
 case 'quran':return 'متابعة الورد والختمات';
 case 'money':return 'راجع دخلك ومصروفاتك';
 case 'calendar':return 'مواعيدك وخطتك القادمة';
 case 'diary':return 'دوّن لحظات يومك';
 case 'notes':return 'أفكارك في مكان واحد';
 case 'health':return 'حركة ونوم ونشاط';
 case 'routines':return 'روتين الصباح والمساء';
 case 'planning':return 'أهداف السنة والـ90 يومًا';
 case 'reports':return 'راجع تقدمك الفعلي';
 case 'coach':return 'اكتشف أولويات الأسبوع';
 default:return 'فتح القسم';
 }};
const style=document.createElement('style');style.textContent=`
#ymWidgetStudio{margin:22px 0 26px;direction:rtl;--yw-accent:var(--accent,#9a85ff)}
.yw-heading{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin:0 0 13px}.yw-heading h2{font-size:19px;margin:0}.yw-heading small{color:var(--muted,#999);font-size:11px}
.yw-actions{display:flex;gap:7px;flex-wrap:wrap}.yw-btn{font:700 12px Cairo,Tahoma,sans-serif;border:1px solid var(--border,#444);border-radius:10px;background:var(--panel2,var(--surface,#25263c));color:var(--text,inherit);padding:7px 11px;cursor:pointer}
.yw-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr));gap:12px}
.yw-card{background:var(--panel,var(--surface,#202437));border:1px solid var(--border,#49465e);border-radius:18px;padding:15px;min-height:148px;position:relative;min-width:0;box-shadow:var(--shadow,0 6px 22px rgba(0,0,0,.08));display:flex;flex-direction:column;justify-content:space-between}
.yw-card:focus-within{outline:2px solid var(--yw-accent);outline-offset:2px}.yw-card-top{display:flex;align-items:center;gap:10px}.yw-icon{width:37px;height:37px;display:grid;place-items:center;border-radius:12px;background:var(--accent-faint,rgba(150,120,255,.16));font-size:19px}
.yw-name{font-weight:900;font-size:13px}.yw-value{font-size:12px;color:var(--muted,#aaa);line-height:1.8;margin:10px 0}.yw-open{background:transparent;border:0;padding:3px 0;color:var(--yw-accent);font:800 12px Cairo,Tahoma,sans-serif;text-align:right;cursor:pointer;align-self:start}
.yw-edit{display:flex;gap:5px;justify-content:flex-end}.yw-edit button{font:700 11px Cairo,Tahoma,sans-serif;background:var(--panel2,#333);color:var(--text,inherit);border:1px solid var(--border,#555);border-radius:7px;padding:4px 7px}
.yw-picker{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,175px),1fr));gap:8px;margin:12px 0;padding:15px;background:var(--panel,#222);border:1px solid var(--border,#555);border-radius:15px}
.yw-picker label{font-size:12px;display:flex;gap:9px;align-items:center;cursor:pointer}.yw-picker input{accent-color:var(--yw-accent)}
@media(max-width:450px){.yw-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.yw-card{padding:12px;min-height:145px}.yw-value{font-size:11px}.yw-name{font-size:12px}}
@media(prefers-reduced-motion:no-preference){.yw-card{transition:transform .15s,border-color .15s}.yw-card:hover{transform:translateY(-2px);border-color:var(--yw-accent)}}
`;document.head.appendChild(style);
let studio=null,edit=false,settings=null,scope='';
function key(){const user=window.YawmiCloud?.currentUser;return 'yawmi_widgets_v1_'+(user?.id||'guest')+'_'+(document.body.dataset.design||'default')}
function prefs(){const k=key();if(k!==scope){scope=k;settings=null}if(!settings){try{settings=JSON.parse(localStorage.getItem(k))}catch(_){};if(!settings||!Array.isArray(settings.order)||!Array.isArray(settings.visible))settings={order:ITEMS.map(x=>x[0]),visible:['today','tasks','habits','focus','goals','books','quran','water','journey']}}return settings}
function persist(){try{localStorage.setItem(key(),JSON.stringify(settings))}catch(_){}} 
function open(id){const target=ITEMS.find(i=>i[0]===id)?.[3];if(!target)return;const a=api();if(target==='home'&&id==='focus'){a?.goPage?.('home');document.getElementById('ymFocusPanel')?.scrollIntoView({behavior:'smooth'});return}a?.goPage?.(target)}
function paint(){if(!studio||!api()?.getState)return;const s=api().getState(),p=prefs(),lookup=new Map(ITEMS.map(x=>[x[0],x]));const ids=[...new Set([...p.order,...ITEMS.map(x=>x[0])])].filter(x=>lookup.has(x));p.order=ids;const active=ids.filter(id=>p.visible.includes(id));const grid=studio.querySelector('.yw-grid');grid.innerHTML=active.map(id=>{const item=lookup.get(id),index=ids.indexOf(id);return '<article class="yw-card"><div class="yw-card-top"><span class="yw-icon" aria-hidden="true">'+item[1]+'</span><span class="yw-name">'+esc(item[2])+'</span></div><p class="yw-value">'+esc(value(s,id))+'</p><button class="yw-open" data-yw-open="'+id+'" aria-label="فتح '+esc(item[2])+'">فتح القسم ←</button>'+(edit?'<div class="yw-edit"><button data-yw-move="'+id+'" data-dir="-1" '+(index===0?'disabled':'')+' aria-label="تحريك للأمام">→</button><button data-yw-move="'+id+'" data-dir="1" '+(index===ids.length-1?'disabled':'')+' aria-label="تحريك للخلف">←</button><button data-yw-hide="'+id+'">إخفاء</button></div>':'')+'</article>'}).join('')||'<p>اختر الويدجتس التي تريد عرضها.</p>';
studio.querySelector('[data-yw-toggle]').textContent=edit?'تم التخصيص':'تخصيص الويدجتس';studio.querySelector('[data-yw-picker]').hidden=!edit;
studio.querySelector('[data-yw-picker]').innerHTML=ids.map(id=>{const item=lookup.get(id);return '<label><input type="checkbox" data-yw-check="'+id+'" '+(p.visible.includes(id)?'checked':'')+'><span>'+item[1]+' '+esc(item[2])+'</span></label>'}).join('');
}
function mount(){const home=document.getElementById('page-home');if(!home||!api()?.getState)return;if(!studio){studio=document.createElement('section');studio.id='ymWidgetStudio';studio.setAttribute('aria-label','ويدجتس يومي القابلة للتخصيص');studio.innerHTML='<div class="yw-heading"><div><h2>✦ ويدجتس يومي</h2><small>لمحة سريعة من بياناتك الحقيقية · عدّل الترتيب والأقسام الظاهرة</small></div><div class="yw-actions"><button type="button" class="yw-btn" data-yw-toggle>تخصيص الويدجتس</button></div></div><div class="yw-picker" data-yw-picker hidden></div><div class="yw-grid"></div>';
const anchor=home.querySelector('.date-row');if(anchor)home.insertBefore(studio,anchor);else home.appendChild(studio);
studio.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const p=prefs();if(b.hasAttribute('data-yw-toggle'))edit=!edit;else if(b.dataset.ywOpen)open(b.dataset.ywOpen);else if(b.dataset.ywHide)p.visible=p.visible.filter(x=>x!==b.dataset.ywHide);else if(b.dataset.ywMove){const a=p.order.indexOf(b.dataset.ywMove),n=a+Number(b.dataset.dir);if(a>=0&&n>=0&&n<p.order.length){[p.order[a],p.order[n]]=[p.order[n],p.order[a]]}}persist();paint()});
studio.addEventListener('change',e=>{const id=e.target.dataset.ywCheck;if(!id)return;const p=prefs();p.visible=e.target.checked?[...new Set([...p.visible,id])]:p.visible.filter(x=>x!==id);persist();paint()});
}paint()}
function boot(){mount();setInterval(()=>{if(!studio||document.hidden)return;if(document.getElementById('page-home')?.classList.contains('on'))paint()},6000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.YawmiWidgets={refresh:paint,open,items:ITEMS.map(x=>({id:x[0],title:x[2]}))};
})();
