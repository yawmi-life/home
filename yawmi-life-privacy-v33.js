/* YAWMI V33 privacy: optional local screen lock for finance and diary. PIN is NOT encryption of stored data. */
(()=>{'use strict';
const L=()=>window.YawmiLife,$=id=>document.getElementById(id),api=()=>window.YawmiExtraAPI;
let owner=null,unlocked=false,lastActivity=Date.now(),failed=0,blockedUntil=0,busy=false;
function privacy(){
 const st=L()?.state();if(!st)return null;
 if(owner!==st){owner=st;unlocked=false;failed=0;blockedUntil=0;lastActivity=Date.now()}
 return st.lifePrivacy;
}
const enabled=p=>!!(p?.pinSalt&&p?.pinHash);
const isLocked=type=>{
 const p=privacy();if(!enabled(p))return false;
 if(type==='money'&&!p.lockMoney)return false;
 if(type==='diary'&&!p.lockDiary)return false;
 const min=Math.max(1,Math.min(60,Number(p.autoMinutes)||5));
 if(unlocked&&Date.now()-lastActivity>min*60000)unlocked=false;
 return !unlocked;
};
function cover(type){
 const box=$('ym'+(type==='money'?'MoneyApp':'DiaryApp'));if(!box)return;
 box.innerHTML='<section class="yl-pin-gate"><span aria-hidden="true">🔒</span><h2>مساحتك الخاصة مقفولة</h2>'+
 '<p>اكتب رمز القفل لعرض '+(type==='money'?'ماليّتك':'يومياتك')+'. ده قفل واجهة إضافي وليس تشفيرًا للبيانات.</p>'+
 '<form id="ylPinGateForm" autocomplete="off"><label>رمز القفل<input id="ylPinGateInput" inputmode="numeric" type="password" pattern="[0-9]{6,12}" minlength="6" maxlength="12" required autocomplete="off" aria-label="رمز القفل"></label>'+
 '<button type="submit" class="yl-action primary">فتح القسم</button><p id="ylPinGateError" class="yl-error" role="alert"></p></form></section>';
}
function gate(type){
 if(isLocked(type)){cover(type);return false}
 return true;
}
const subtleAvailable=()=>!!(window.crypto?.subtle&&window.crypto?.getRandomValues&&window.isSecureContext);
function bytesToHex(b){return Array.from(new Uint8Array(b),z=>z.toString(16).padStart(2,'0')).join('')}
function b64(b){return btoa(String.fromCharCode(...b))}
function unb64(s){return Uint8Array.from(atob(s),x=>x.charCodeAt(0))}
async function hashPin(pin,salt,rounds){
 const key=await window.crypto.subtle.importKey('raw',new TextEncoder().encode(pin),{name:'PBKDF2'},false,['deriveBits']);
 return bytesToHex(await window.crypto.subtle.deriveBits({name:'PBKDF2',salt:unb64(salt),iterations:rounds,hash:'SHA-256'},key,256));
}
function safeEqual(a,b){
 if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;
 let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
 return diff===0;
}
async function verify(pin){
 const p=privacy();if(!enabled(p)||!subtleAvailable())return false;
 if(Date.now()<blockedUntil)return false;
 if(!/^\d{6,12}$/.test(pin))return false;
 const digest=await hashPin(pin,p.pinSalt,Math.max(120000,Number(p.pinIterations)||160000));
 const success=safeEqual(digest,p.pinHash);
 if(success){failed=0;blockedUntil=0;lastActivity=Date.now();return true}
 failed++;if(failed>=5){blockedUntil=Date.now()+45000;failed=0}
 return false;
}
function lockedMessage(){return Date.now()<blockedUntil?'محاولات كثيرة. جرّب تاني بعد شوية.':'الرمز غير صحيح. تأكد من الأرقام وحاول تاني.'}
function notice(text,target){const el=$(target);if(el)el.textContent=text;else api()?.notify?.(text)}
function lockNow(force=false){
 if(!enabled(privacy()))return;
 unlocked=false;
 const money=$('ymMoneyDialog'),diary=$('ymDiaryDialog');if(money?.open)money.close();if(diary?.open)diary.close();
 // Remove stale visible form details, not just hide the dialogs.
 if(money)money.querySelector('#ymMoneyDialogContent')?.replaceChildren();
 if(diary)diary.querySelector('#ymDiaryDialogContent')?.replaceChildren();
 const moneyPage=$('page-money'),diaryPage=$('page-diary');
 if(moneyPage?.classList.contains('on')){if(privacy().lockMoney)cover('money')}
 if(diaryPage?.classList.contains('on')){if(privacy().lockDiary)cover('diary')}
 if($('page-coach')?.classList.contains('on'))window.YawmiLifeGrowth?.render('coach');
 if($('page-privacy')?.classList.contains('on'))privacyScreen();
 if(force)api()?.notify?.('تم قفل الأقسام الخاصة.');
}
function privacyScreen(){
 const root=L()?.root('privacy');if(!root)return;
 const p=privacy(),pinSet=enabled(p),locked=pinSet&&!unlocked,minutes=Math.max(1,Math.min(60,Number(p.autoMinutes)||5));
 root.innerHTML='<div class="yl-hero"><div><span>PRIVACY CENTER · حماية بياناتك</span><h2>مساحتك تخصك أنت 🔐</h2><p>قفل اختياري للمالية واليوميات، وخيارات لتصدير بياناتك ومراجعة الأذونات.</p></div></div>'+
 (locked?'<section class="yl-surface yl-privacy-locked"><h3>أدخل رمزك لإدارة إعدادات الحماية</h3><p class="muted">لحماية إعدادات القفل، افتحها بالرمز الحالي أولاً.</p>'+
 '<form id="ylPinSettingsGate" class="yl-pin-inline" autocomplete="off"><label>رمز القفل<input id="ylPinSettingsInput" type="password" inputmode="numeric" minlength="6" maxlength="12" pattern="[0-9]{6,12}" autocomplete="off" required></label>'+
 '<button type="submit" class="yl-action primary">فتح الإعدادات</button><p class="yl-error" id="ylPinSettingsError" role="alert"></p></form></section>':
 '<div class="yl-twocol"><section class="yl-surface"><div class="yl-toolbar"><div><h3>قفل الواجهة</h3><small>حالة الرمز: '+(pinSet?'مفعّل':'غير مفعّل')+'</small></div>'+(pinSet?btn('🔒 قفل الآن','data-life-lock-now'):'')+'</div>'+
 '<p class="muted">اختار رقمًا من 6–12 خانة. محفوظ كبصمة مشتقة من PBKDF2 بملح عشوائي، وليس كنص صريح.</p>'+
 '<div class="yl-privacy-actions">'+btn(pinSet?'تغيير رمز القفل':'إنشاء رمز القفل','data-life-set-pin','primary')+
 (pinSet?btn('إلغاء رمز القفل','data-life-remove-pin','danger'):'')+'</div>'+
 '<div class="yl-privacy-controls"><label><input id="ylLockMoney" type="checkbox" '+(p?.lockMoney?'checked':'')+' '+(!pinSet?'disabled':'')+'> طلب رمز للمالية</label>'+
 '<label><input id="ylLockDiary" type="checkbox" '+(p?.lockDiary?'checked':'')+' '+(!pinSet?'disabled':'')+'> طلب رمز لليوميات</label>'+
 '<label>قفل بعد عدم استخدام التطبيق<select id="ylAutoLock" '+(!pinSet?'disabled':'')+'>'+
 [[1,'دقيقة'],[5,'5 دقائق'],[15,'15 دقيقة'],[30,'30 دقيقة'],[60,'ساعة']].map(([v,label])=>'<option value="'+v+'" '+(minutes===v?'selected':'')+'>'+label+'</option>').join('')+
 '</select></label></div></section>'+
 '<section class="yl-surface"><h3>بياناتك ونسخك الاحتياطية</h3><p class="muted">صدّر نسخة JSON من الملاحظات، والصحة، والروتينات، والتقويم، والخطط، والمالية واليوميات. احتفظ بالملف في مكان آمن.</p>'+
 btn('⇩ تصدير بياناتي الخاصة','data-life-export-private','primary')+
 '<p class="muted">هذه البيانات تُحفظ داخل حسابك الحالي. قفل الشاشة لا يشفر البيانات المخزنة على الخادم أو في المتصفح، ولا يمنع مسؤولي الخدمة المخولين أو إضافات المتصفح من الوصول إلى البيانات.</p></section></div>')+
 '<section class="yl-surface yl-callout"><h3>حدود الحماية</h3><p>المزامنة تستخدم نظام حساب يومي وصلاحياته الحالية. رقم PIN محلي للتحكم في عرض القسم فقط؛ ليس تشفيرًا من طرف إلى طرف، ولا بديلاً لكلمة مرور الحساب. عند ترك الجهاز، اقفل الشاشة وسجّل الخروج من الأجهزة المشتركة. لا يوجد استرداد تلقائي لرمز PIN عبر هذه الواجهة.</p></section>';
}
function btn(label,attr,variant='soft'){return L().btn(label,attr,variant)}
function pinDialog(removing=false){
 const p=privacy();if(!p||!subtleAvailable()){
  api()?.notify?.('القفل يحتاج اتصال HTTPS ومتصفحًا يدعم Web Crypto.');return;
 }
 const current=enabled(p);
 L().show('<form id="ylPinForm" autocomplete="off">'+L().formTitle('PRIVATE SCREEN LOCK',removing?'إلغاء رمز القفل':current?'تغيير رمز القفل':'إنشاء قفل خاص')+
 (current?L().field('رمز القفل الحالي','<input id="ylCurrentPin" type="password" inputmode="numeric" pattern="[0-9]{6,12}" minlength="6" maxlength="12" autocomplete="off" required>'):'')+
 (!removing?L().field('رمز جديد (6 إلى 12 رقم)','<input id="ylNewPin" type="password" inputmode="numeric" pattern="[0-9]{6,12}" minlength="6" maxlength="12" autocomplete="off" required>'+
 '<small>تجنب تاريخ ميلادك أو الأرقام المتسلسلة.</small>')+
 L().field('تأكيد الرمز','<input id="ylConfirmPin" type="password" inputmode="numeric" pattern="[0-9]{6,12}" minlength="6" maxlength="12" autocomplete="off" required>'):'')+
 '<p class="yl-disclaimer">القفل يحمي العرض داخل التطبيق فقط، وليس تشفيرًا لمحتوى السجلات على الخادم.</p>'+
 L().actions(removing?'إلغاء القفل':'حفظ القفل')+'</form>');
 const form=$('ylPinForm');form.dataset.removing=removing?'yes':'no';
}
async function updatePin(removing){
 if(busy)return;const p=privacy();if(!p||!subtleAvailable())return;
 const old=$('ylCurrentPin')?.value||'',newPin=$('ylNewPin')?.value||'',confirmation=$('ylConfirmPin')?.value||'';
 if(enabled(p)){if(Date.now()<blockedUntil)return L().error(lockedMessage());if(!(await verify(old)))return L().error(lockedMessage())}
 if(!removing){
  if(!/^\d{6,12}$/.test(newPin))return L().error('الرمز الجديد لازم يكون 6 إلى 12 رقمًا.');
  if(newPin!==confirmation)return L().error('تأكيد الرمز مش مطابق.');
  if(/^(\d)\1+$/.test(newPin)||'0123456789012345'.includes(newPin)||'9876543210987654'.includes(newPin))return L().error('اختار رمزًا أصعب من الأرقام المتكررة أو المتسلسلة.');
 }
 busy=true;
 try{
  if(removing){p.pinSalt=null;p.pinHash=null;p.pinIterations=null;unlocked=true;}
  else{const salt=new Uint8Array(16);window.crypto.getRandomValues(salt);p.pinSalt=b64(salt);p.pinIterations=160000;p.pinHash=await hashPin(newPin,p.pinSalt,p.pinIterations);
   p.lockMoney=true;p.lockDiary=true;unlocked=true;}
  lastActivity=Date.now();
  if(!L().save())return L().error('تعذر حفظ إعدادات القفل.');
  L().close();privacyScreen();api()?.notify?.(removing?'تم إلغاء قفل الواجهة.':'تم حفظ قفل الواجهة.');
 }catch(_){L().error('تعذر تفعيل القفل على هذا المتصفح.')}finally{busy=false}
}
async function unlock(pin,setting=false){
 const target=setting?'ylPinSettingsError':'ylPinGateError';
 if(!subtleAvailable())return notice('هذا المتصفح لا يدعم التحقق من رمز القفل.',target);
 if(Date.now()<blockedUntil)return notice(lockedMessage(),target);
 try{
  if(await verify(pin)){unlocked=true;lastActivity=Date.now();if(setting)privacyScreen();else api()?.render?.()}
  else notice(lockedMessage(),target);
 }catch(_){notice('تعذر التحقق من الرمز. حاول تاني.',target)}
}
function exportPrivate(){
 const x=L().state(),allowFinance=!isLocked('money'),allowDiary=!isLocked('diary');
 const data={format:'YAWMI_LIFE_PRIVATE_V33',exportedAt:new Date().toISOString(),lifeCalendar:x.lifeCalendar,lifeReminders:x.lifeReminders,
 lifeNotes:x.lifeNotes,lifeHealth:x.lifeHealth,lifeRoutines:x.lifeRoutines,lifeRoutineChecks:x.lifeRoutineChecks,lifePlans:x.lifePlans,
 lifeYearly:x.lifeYearly,finance:allowFinance?x.finance:'LOCKED',journalEntries:allowDiary?x.journalEntries:'LOCKED'};
 if(!confirm('تصدير نسخة من بياناتك الخاصة؟ احفظ الملف بمكان آمن ولا تشاركه مع أحد.'))return;
 const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='YAWMI_PRIVATE_BACKUP_'+L().day()+'.json';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function click(e){
 const b=e.target.closest?.('button');if(!b)return;
 if(b.hasAttribute('data-life-set-pin'))return pinDialog(false);
 if(b.hasAttribute('data-life-remove-pin'))return pinDialog(true);
 if(b.hasAttribute('data-life-lock-now'))return lockNow(true);
 if(b.hasAttribute('data-life-export-private'))return exportPrivate();
}
async function submit(e){
 const id=e.target?.id;if(!['ylPinForm','ylPinGateForm','ylPinSettingsGate'].includes(id))return;
 e.preventDefault();
 if(id==='ylPinForm')return updatePin(e.target.dataset.removing==='yes');
 if(id==='ylPinGateForm')return unlock($('ylPinGateInput')?.value||'',false);
 if(id==='ylPinSettingsGate')return unlock($('ylPinSettingsInput')?.value||'',true);
}
function change(e){
 const id=e.target?.id;if(!['ylLockMoney','ylLockDiary','ylAutoLock'].includes(id))return;
 const p=privacy();if(!enabled(p)||!unlocked){privacyScreen();return}
 if(id==='ylLockMoney')p.lockMoney=e.target.checked;
 if(id==='ylLockDiary')p.lockDiary=e.target.checked;
 if(id==='ylAutoLock')p.autoMinutes=Math.max(1,Math.min(60,Number(e.target.value)||5));
 L().save();privacyScreen();
}
function init(){
 document.addEventListener('click',click);
 document.addEventListener('submit',submit);
 document.addEventListener('change',change);
 const touch=()=>{if(unlocked)lastActivity=Date.now()};
 document.addEventListener('pointerdown',touch,{passive:true});
 document.addEventListener('keydown',touch);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)lockNow(false)});
 window.setInterval(()=>{const p=privacy();if(!enabled(p)||!unlocked)return;
  const min=Math.max(1,Math.min(60,Number(p.autoMinutes)||5));
  if(Date.now()-lastActivity>=min*60000)lockNow(false);
 },30000);
}
window.YawmiLifePrivacy={render:privacyScreen,gate,isLocked,lockNow,verify,hashPin};
if(L()){L().privacyGate=gate;L().isPrivacyLocked=isLocked;L().lockNow=lockNow}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();