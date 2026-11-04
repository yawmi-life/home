/* YAWMI v11 browser auth and per-account revisioned sync. No private credentials. */
(()=>{'use strict';
const cfg=window.YAWMI_CONFIG||{};
const configured=Boolean(/^https:\/\/[^\s]+\.supabase\.co\/?$/.test(cfg.supabaseUrl||'')&&(cfg.supabasePublishableKey||'').trim());
const $=id=>document.getElementById(id), esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ui=`<div id="yAuthWall" class="y-auth-wall" hidden><section class="y-auth-box" role="dialog" aria-modal="true" aria-labelledby="yAuthHeading"><div class="y-auth-brand">✦ يومي <span style="font-size:12px">LifeOS</span></div><span class="y-auth-badge">YOUR LIFE · YOUR ACCOUNT</span><h2 id="yAuthHeading">كل إنجازاتك في حسابك</h2><p class="y-auth-desc">افتح نفس المهام والعادات والمستويات على الموبايل والكمبيوتر. بيانات كل مستخدم منفصلة.</p><div class="y-auth-tabs" id="yAuthTabs"><button data-auth-tab="login" class="active">دخول</button><button data-auth-tab="signup">حساب جديد</button><button data-auth-tab="forgot">استعادة</button></div><form id="yAuthForm"><input class="y-auth-input" id="yAuthName" type="text" autocomplete="name" maxlength="50" placeholder="اسمك — مطلوب لإنشاء حساب" minlength="2" hidden><input class="y-auth-input" id="yAuthEmail" type="email" autocomplete="email" placeholder="الإيميل" required><div class="ym-password-wrap"><input class="y-auth-input" id="yAuthPassword" type="password" autocomplete="current-password" placeholder="كلمة المرور — 8 أحرف على الأقل" minlength="8" required><button type="button" id="ymShowPassword" aria-label="إظهار كلمة المرور" aria-pressed="false">👁</button></div><label class="ym-persist" id="ymStayWrap"><input id="ymStaySigned" type="checkbox" checked> البقاء قيد تسجيل الدخول على هذا الجهاز</label><button type="submit" class="y-auth-primary" id="yAuthSubmit">تسجيل الدخول</button></form><div class="y-auth-notice" id="yAuthMessage" role="status">لن تظهر بيانات حساب آخر. يمكنك تصدير سجلاتك في أي وقت.</div>
<section id="ymVerification" class="ym-verify-card" hidden aria-live="polite">
  <div class="ym-verify-icon" aria-hidden="true">✉</div>
  <h3>راجع بريدك لتأكيد حساب يومي</h3>
  <p>تم قبول طلب إنشاء الحساب، ويُفترض أن تصلك رسالة تأكيد على البريد:</p>
  <div id="ymVerifyEmail" class="ym-verify-address"></div>
  <p>افتح البريد الوارد، ثم اضغط رابط «تأكيد البريد الإلكتروني» في رسالة يومي. لو ما لقيتها، راجع الرسائل غير المرغوب فيها والعروض الترويجية.</p>
  <div class="ym-verify-actions">
    <a class="ym-verify-gmail" href="https://mail.google.com/mail/u/0/#inbox" target="_blank" rel="noopener noreferrer">📨 فتح Gmail</a>
    <button type="button" id="ymResendVerification" class="ym-verify-resend">إعادة إرسال التأكيد</button>
  </div>
  <div id="ymVerificationFeedback" class="ym-verify-feedback" role="status"></div>
  <button type="button" id="ymVerificationLogin" class="ym-verify-back">تأكيد البريد تم؟ الرجوع لتسجيل الدخول</button>
</section>
<div class="ym-auth-install-box" id="ymAuthInstallBox">
 <button type="button" id="ymAuthInstall" class="ym-auth-install-btn">📲 تثبيت تطبيق يومي</button>
 <p class="ym-install-subtitle">يمكنك تثبيت يومي قبل التسجيل، ثم تسجيل الدخول من التطبيق.</p>
 <p id="ymAuthInstallHelp" class="ym-install-help" hidden role="status"></p>
</div></section></div><div id="yAccountSheet" class="y-auth-sheet" hidden><section class="y-auth-box" role="dialog" aria-modal="true"><div style="display:flex;justify-content:space-between;gap:12px"><h2>👤 الحساب والمزامنة</h2><button class="y-auth-minor" id="yAccountClose">إغلاق ✕</button></div><div id="yAccountDetails" class="y-auth-account"></div><div id="yAccountError" class="y-auth-notice"></div><button id="yManualSync" class="y-auth-primary">مزامنة الآن</button><div style="display:flex;justify-content:space-between;flex-wrap:wrap"><button id="yConflictExport" class="y-auth-minor">تصدير مسودة JSON</button><button id="yNotionCSV" class="y-auth-minor">CSV لاستيراده إلى Notion</button><button id="yReloadServer" class="y-auth-minor">تحميل من السحابة</button><button id="yBackupHistory" class="y-auth-minor">النسخ اليومية</button><button id="yLogout" class="y-auth-minor" style="color:#b33947">خروج</button></div><div id="yBackupPanel" style="margin-top:12px" hidden></div><p class="y-auth-desc" style="margin-top:15px">ربط Notion لكل مستخدم يحتاج OAuth آمن على الخادم. غير مفعّل في النسخة الحالية.</p></section></div>`;
const Y={configured,currentUser:null,ready:false,loading:false,revision:0,conflict:false,adapter:null,sb:null,pending:null,working:false,timer:null,version:0,tab:'login',accountError:'',pendingVerificationEmail:'',resendCooldownUntil:0,
 mount(adapter){this.adapter=adapter;document.body.insertAdjacentHTML('beforeend',ui);this.wire();this.setTab('login');if(!configured){this.status('تجربة محلية');return;}this.gate(true);this.status('التحقق من الحساب');this.init()},
 wire(){$('ymAuthInstall').addEventListener('click',()=>window.YawmiInstall?.install('ymAuthInstallHelp'));$('ymVerificationLogin').addEventListener('click',()=>{const mail=this.pendingVerificationEmail;this.setTab('login');if(mail)$('yAuthEmail').value=mail;this.message('بعد الضغط على رابط التأكيد في بريدك، سجّل الدخول هنا.')});$('ymResendVerification').addEventListener('click',()=>this.resendVerification());$('ymShowPassword').addEventListener('click',()=>{const i=$('yAuthPassword'),b=$('ymShowPassword'),visible=i.type==='password';i.type=visible?'text':'password';b.setAttribute('aria-pressed',String(visible));b.setAttribute('aria-label',visible?'إخفاء كلمة المرور':'إظهار كلمة المرور');b.textContent=visible?'◉':'👁'});$('ymStaySigned').checked=localStorage.getItem('yawmi_keep_signed_in')!=='false';$('yawmiAccountBtn')?.addEventListener('click',()=>this.account(true));$('yAccountClose').addEventListener('click',()=>this.account(false));$('yAccountSheet').addEventListener('click',e=>{if(e.target===$('yAccountSheet'))this.account(false)});$('yAuthTabs').addEventListener('click',e=>{const b=e.target.closest('[data-auth-tab]');if(b)this.setTab(b.dataset.authTab)});$('yAuthForm').addEventListener('submit',e=>{e.preventDefault();this.submit()});$('yAuthForm').addEventListener('invalid',e=>{const id=e.target.id;this.message(id==='yAuthName'?'اكتب اسمك عند إنشاء الحساب.':id==='yAuthEmail'?'اكتب بريدًا إلكترونيًا صحيحًا.':'تحقق من كلمة المرور.',true)},true);$('yManualSync').addEventListener('click',async()=>{if(this.conflict)return;await this.flush();await this.refresh();this.updateAccount()});$('yConflictExport').addEventListener('click',()=>this.export());$('yNotionCSV').addEventListener('click',()=>this.exportNotionCSV());$('yReloadServer').addEventListener('click',()=>this.reload());$('yBackupHistory').addEventListener('click',()=>this.showBackups());$('yLogout').addEventListener('click',async()=>{if(this.pending&&!confirm('لديك تعديلات لم تُرفع. صدّر نسخة قبل الخروج. هل تستمر؟'))return;const {error}=await this.sb.auth.signOut();if(error)this.say(error.message);else this.signedOut();this.account(false)})},
 status(s,k){const mini=$('ymSyncMini');if(mini){const ok=k==='ok'||s==='محفوظ سحابيًا',bad=k==='bad'||s==='غير متزامن'||s==='تعارض';mini.dataset.status=bad?'bad':ok?'ok':'pending';mini.textContent=bad?'⚠ راجع الحفظ':ok?'☁ محفوظ':/جاري الحفظ/.test(s)?'◌ جاري الحفظ':'☁ '+String(s||'جاري التحقق').slice(0,15);if(ok){this.lastSyncedAt=new Date().toISOString();}mini.title=(ok?'آخر مزامنة ناجحة: '+new Date(this.lastSyncedAt).toLocaleString('ar-EG'):s)}const el=$('yawmiCloudState');if(el){el.className='y-cloud-state '+(k||'');el.innerHTML='<i class="dot"></i> '+esc(s)}if($('yawmiAccountBtn'))$('yawmiAccountBtn').textContent=this.currentUser?'👤 '+(this.adapter?.getSnapshot()?.profile?.name&&this.adapter.getSnapshot().profile.name!=='المستكشف'?this.adapter.getSnapshot().profile.name:(this.currentUser.user_metadata?.display_name||'حسابي')):'👤 حسابي'},
 say(m){this.adapter?.notify?.(m)},gate(v){$('yAuthWall').hidden=!v},account(v){if(v){this.updateAccount();$('yAccountSheet').hidden=false}else{$('yAccountSheet').hidden=true;$('yBackupPanel').hidden=true}},message(s,bad=false){$('yAuthMessage').textContent=s;$('yAuthMessage').classList.toggle('error',bad)},
 setTab(t){this.tab=t;$('ymVerification').hidden=true;$('yAuthForm').hidden=false;$('yAuthTabs').hidden=t==='recovery';document.querySelectorAll('[data-auth-tab]').forEach(b=>b.classList.toggle('active',b.dataset.authTab===t));$('yAuthTabs').hidden=t==='recovery';$('yAuthName').hidden=t!=='signup';$('yAuthName').required=t==='signup';$('yAuthPassword').hidden=t==='forgot';$('yAuthPassword').required=t!=='forgot';$('yAuthPassword').closest('.ym-password-wrap').hidden=t==='forgot';$('yAuthPassword').autocomplete=t==='signup'?'new-password':'current-password';$('yAuthEmail').hidden=t==='recovery';$('yAuthEmail').required=t!=='recovery';$('ymStayWrap').hidden=!['login','signup'].includes(t);$('yAuthSubmit').textContent=({login:'تسجيل الدخول',signup:'إنشاء حساب',forgot:'إرسال رابط الاستعادة',recovery:'تعيين كلمة المرور'})[t];this.message('استخدم إيميلك الشخصي؛ كل حساب له سجلاته الخاصة.')},
 showVerification(email){this.pendingVerificationEmail=email;$('ymVerifyEmail').textContent=email;$('ymVerificationFeedback').textContent='';$('ymVerification').hidden=false;$('yAuthForm').hidden=true;$('yAuthTabs').hidden=true;this.message('راجع التعليمات الموضحة أعلاه، وبعد تأكيد البريد يمكنك تسجيل الدخول.');},
 async resendVerification(){const email=this.pendingVerificationEmail;if(!email||!this.sb)return;
 const b=$('ymResendVerification');
 if(Date.now()<this.resendCooldownUntil){$('ymVerificationFeedback').textContent='تم طلب الرسالة مؤخرًا. راجع بريدك وحاول لاحقًا.';return}
 b.disabled=true;$('ymVerificationFeedback').textContent='جاري طلب إعادة الإرسال…';
 try{const {error}=await this.sb.auth.resend({type:'signup',email,options:{emailRedirectTo:new URL('auth.html',location.href).href}});if(error)throw error;
 this.resendCooldownUntil=Date.now()+60000;$('ymVerificationFeedback').textContent='تم قبول طلب إعادة الإرسال. راجع بريدك خلال دقائق، بما فيه Spam.';
 setTimeout(()=>{if($('ymResendVerification'))$('ymResendVerification').disabled=false},60000);
 }catch(e){$('ymVerificationFeedback').textContent='تعذرت إعادة الإرسال: '+(e.message||'خطأ في الاتصال');b.disabled=false;}},
 async loadSDK(){if(window.supabase?.createClient)return window.supabase;await new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.min.js';s.onload=res;s.onerror=()=>rej(new Error('تعذر تحميل مكتبة تسجيل الدخول'));document.head.appendChild(s)});if(!window.supabase?.createClient)throw Error('مكتبة Supabase غير متاحة');return window.supabase},
 async init(){try{const lib=await this.loadSDK();const authStore={getItem:k=>(localStorage.getItem('yawmi_keep_signed_in')==='false'?sessionStorage:localStorage).getItem(k),setItem:(k,v)=>{const persist=localStorage.getItem('yawmi_keep_signed_in')!=='false';(persist?localStorage:sessionStorage).setItem(k,v);(persist?sessionStorage:localStorage).removeItem(k)},removeItem:k=>{localStorage.removeItem(k);sessionStorage.removeItem(k)}};this.sb=lib.createClient(cfg.supabaseUrl.replace(/\/$/,''),cfg.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:authStore}});this.sb.auth.onAuthStateChange((e,s)=>{if(e==='PASSWORD_RECOVERY'){this.gate(true);this.setTab('recovery');return;}if(e==='SIGNED_OUT')this.signedOut();if(e==='SIGNED_IN'&&s?.user&&!this.ready&&!this.loading)setTimeout(()=>this.loadUser(s.user),0)});const {data,error}=await this.sb.auth.getSession();if(error)throw error;if(data?.session?.user)await this.loadUser(data.session.user);else this.message('سجّل الدخول أو أنشئ حسابًا جديدًا.') }catch(e){this.message('خطأ الاتصال: '+e.message,true);this.status('خطأ الاتصال','bad')}},
 async submit(){if(!this.sb)return this.message('الاتصال غير جاهز، تحقق من الإنترنت.',true);const email=$('yAuthEmail').value.trim(),password=$('yAuthPassword').value,t=this.tab,b=$('yAuthSubmit');if(t==='signup'||t==='forgot'){try{const f=location.pathname.split('/').pop();if(['01_ATLAS_Executive.html','02_JOURNAL_Editorial.html','03_QUEST_RPG.html'].includes(f))localStorage.setItem('yawmi_auth_return_to',f)}catch(_){}}if(t==='login'||t==='signup'){localStorage.setItem('yawmi_keep_signed_in',$('ymStaySigned').checked?'true':'false')}b.disabled=true;try{if(t==='login'){const {data,error}=await this.sb.auth.signInWithPassword({email,password});if(error)throw error;await this.loadUser(data.user)}else if(t==='signup'){const fullName=$('yAuthName').value.trim().replace(/\s+/g,' ');if(fullName.length<2)throw Error('الاسم مطلوب لإنشاء الحساب، اكتب حرفين على الأقل');if(password.length<8)throw Error('استخدم 8 أحرف على الأقل');const {data,error}=await this.sb.auth.signUp({email,password,options:{emailRedirectTo:new URL('auth.html',location.href).href,data:{display_name:fullName.slice(0,50)}}});if(error)throw error;if(data.session)await this.loadUser(data.user);else this.showVerification(email)}else if(t==='forgot'){const {error}=await this.sb.auth.resetPasswordForEmail(email,{redirectTo:new URL('auth.html',location.href).href});if(error)throw error;this.message('لو الإيميل موجود، سيصل رابط إعادة التعيين.')}else if(t==='recovery'){if(password.length<8)throw Error('كلمة المرور قصيرة');const {error}=await this.sb.auth.updateUser({password});if(error)throw error;this.message('تم تغيير كلمة المرور');this.gate(false)}}catch(e){this.message(e.message||'فشل الطلب',true)}finally{b.disabled=false}},
 key(uid){return 'yawmi_v9_unsynced_'+uid},
 draft(uid){try{return JSON.parse(localStorage.getItem(this.key(uid)))}catch{return null}},
 async anyDraft(uid){
  const local=this.draft(uid);if(local?.data)return local;
  try{return await window.YawmiOffline?.getPending(uid)||null}catch(_){return null}
 },
 store(uid,s){
  try{localStorage.setItem(this.key(uid),JSON.stringify({base:this.revision,data:s}))}
  catch(_){this.say('المسودة كبيرة على التخزين المؤقت؛ تأكد من IndexedDB أو صدّر نسخة احتياطية')}
  window.YawmiOffline?.putPending(uid,s,this.revision).catch(()=>{});
 },
 clear(uid){
  try{localStorage.removeItem(this.key(uid))}catch(_){}
  window.YawmiOffline?.clearPending(uid).catch(()=>{});
 },
 cache(uid,data,revision){
  window.YawmiOffline?.putConfirmed(uid,data,revision).catch(()=>{});
 },
 async loadUser(user){
 if(!user||this.loading||this.ready&&this.currentUser?.id===user.id)return;
 this.loading=true;this.currentUser=user;this.ready=false;this.revision=0;this.pending=null;this.conflict=false;this.accountError='';this.status('تحميل سجلاتك…');
 try{
  const {data,error}=await this.sb.from('yawmi_documents').select('data,revision').eq('user_id',user.id).maybeSingle();
  if(error)throw error;let doc=data;
  if(!doc){
   const newData=this.adapter.blankSnapshot();
   const displayName=String(user.user_metadata?.display_name||'').trim();
   if(displayName)newData.profile.name=displayName;
   const {data:rev,error:err}=await this.sb.rpc('yawmi_write',{p_data:newData,p_expected_revision:0});
   if(err)throw err;doc={data:newData,revision:Number(rev)};
  }
  this.revision=Number(doc.revision);
  const draft=await this.anyDraft(user.id),base=await window.YawmiOffline?.getConfirmed(user.id).catch(()=>null);
  if(draft?.data&&Number(draft.base)===this.revision){
   this.adapter.replaceSnapshot(draft.data);this.pending=draft.data;this.version++;
  }else if(draft?.data&&base?.data&&Number(base.revision)===Number(draft.base)){
   const m=window.YawmiOffline.threeWay(base.data,draft.data,doc.data);
   if(!m.conflicts.length){
    this.adapter.replaceSnapshot(m.data);this.pending=m.data;this.version++;
    this.store(user.id,m.data);
    this.status('تم دمج التعديلات بين الجهازين');
   }else{
    this.adapter.replaceSnapshot(draft.data);this.pending=draft.data;this.conflict=true;
    this.accountError='تغييرات متعارضة لم ندمجها حفاظًا على بياناتك: '+m.conflicts.slice(0,3).join('، ')+'. صدّر مسودتك قبل الاسترجاع.';
   }
  }else{
   this.adapter.replaceSnapshot(doc.data);
   if(draft?.data){this.conflict=true;this.pending=draft.data;this.accountError='توجد مسودة لا نملك نسخة الأساس الخاصة بها؛ صدّرها أولًا قبل الاسترجاع.';}
  }
  this.cache(user.id,doc.data,doc.revision);
  this.ready=true;this.gate(false);
  setTimeout(()=>window.YawmiFeatures?.onAccountReady(),0);
  this.status(this.conflict?'تعارض':this.pending?'بانتظار المزامنة':'محفوظ سحابيًا',this.conflict?'bad':this.pending?'pending':'ok');
  if(this.pending&&!this.conflict)setTimeout(()=>this.flush(),100);
  if(this.conflict)this.account(true);
 }catch(e){
  const draft=await this.anyDraft(user.id);
  let cache=null;
  try{cache=await window.YawmiOffline?.getConfirmed(user.id)}catch(_){}
  const saved=draft?.data?draft:cache?.data?{data:cache.data,base:cache.revision}:null;
  if(saved?.data){
   try{
    this.revision=Number(saved.base)||0;
    this.adapter.replaceSnapshot(saved.data);
    this.pending=draft?.data?draft.data:null;
    this.ready=true;this.gate(false);
    this.status('وضع أوفلاين · محفوظ محليًا','pending');
    this.accountError='نعمل من نسخة محفوظة على هذا الجهاز. التحديثات الجديدة ستُزامن عند عودة الإنترنت.';
    setTimeout(()=>window.YawmiFeatures?.onAccountReady(),0);
   }catch(err){this.gate(true);this.message('تعذرت قراءة النسخة المحلية: '+err.message,true);}
  }else{
   this.gate(true);this.status('فشل التحميل','bad');
   this.message('لم نستطع فتح حسابك أو الوصول لنسخة محلية موثوقة. اتصل بالإنترنت للمزامنة الأولية. '+e.message,true);
  }
 }finally{this.loading=false}
 },
 queueSave(snapshot){if(!configured||!this.currentUser||this.loading||!this.ready)return;this.pending=snapshot;this.version++;this.store(this.currentUser.id,snapshot);this.status(navigator.onLine?'جاري الحفظ…':'أوفلاين · محفوظ محليًا');clearTimeout(this.timer);this.timer=setTimeout(()=>this.flush(),750)},
 async flush(){
 if(!this.sb||!this.currentUser||!this.ready||this.working||this.conflict||!this.pending)return;
 if(!navigator.onLine){this.status('أوفلاين · بانتظار المزامنة','pending');return}
 clearTimeout(this.timer);this.working=true;
 const snap=this.pending,seq=this.version,uid=this.currentUser.id,expected=this.revision;
 try{
  const {data,error}=await this.sb.rpc('yawmi_write',{p_data:snap,p_expected_revision:expected});
  if(error){
   if(error.code==='40001'||/REVISION_CONFLICT/i.test(error.message)){
    const latest=await this.sb.from('yawmi_documents').select('data,revision').eq('user_id',uid).single();
    const base=await window.YawmiOffline?.getConfirmed(uid).catch(()=>null);
    if(!latest.error&&base?.data&&Number(base.revision)===expected){
     const merge=window.YawmiOffline.threeWay(base.data,this.pending||snap,latest.data.data);
     if(!merge.conflicts.length){
      this.revision=Number(latest.data.revision);
      this.cache(uid,latest.data.data,latest.data.revision);
      this.pending=merge.data;this.version++;
      this.store(uid,merge.data);this.adapter.replaceSnapshot(merge.data);
      this.status('تم دمج آخر التحديثات؛ جاري الحفظ');
      return;
     }
     this.accountError='تعارض في '+merge.conflicts.slice(0,4).join('، ')+'. لم نكتب فوق بيانات أي جهاز. صدّر مسودتك أولًا.';
    }else this.accountError='تعديل من جهاز آخر أحدث نسخة جديدة، ولا تتوفر قاعدة دمج محلية. صدّر مسودتك قبل الاسترجاع.';
    this.conflict=true;this.status('تعارض','bad');this.updateAccount();return;
   }
   throw error;
  }
  this.revision=Number(data);
  if(this.version===seq){
   this.pending=null;this.clear(uid);this.status('محفوظ سحابيًا','ok');
   this.cache(uid,snap,this.revision);
   window.YawmiSeasons?.refresh(true);
  }else{
   // A newer edit arrived during upload. Its base must be the newly acknowledged revision.
   this.cache(uid,snap,this.revision);
   this.store(uid,this.pending);
   this.status('جاري الحفظ…');
  }
 }catch(e){this.status('غير متزامن · محفوظ محليًا','bad');this.accountError='خطأ الحفظ: '+e.message}
 finally{this.working=false;if(this.pending&&!this.conflict&&this.version!==seq)setTimeout(()=>this.flush(),300)}
 },
 async flushAll(){for(let i=0;i<15;i++){if(!this.pending)return true;if(!this.working)await this.flush();if(!this.pending)return true;await new Promise(r=>setTimeout(r,160));}return !this.pending},
 async refresh(){if(!this.currentUser||this.pending||this.conflict||this.loading)return;const {data,error}=await this.sb.from('yawmi_documents').select('data,revision').eq('user_id',this.currentUser.id).single();if(error){this.status('غير متزامن','bad');return;}if(Number(data.revision)>this.revision){this.loading=true;try{this.revision=Number(data.revision);this.adapter.replaceSnapshot(data.data);this.cache(this.currentUser.id,data.data,this.revision)}finally{this.loading=false}}this.status('محفوظ سحابيًا','ok')},
 async reload(){if(!this.currentUser)return;if((this.pending||this.conflict)&&!confirm('سيتم تجاهل التعديلات المحلية غير المحفوظة. صدّر نسختك أولًا لو تحتاجها. متابعة؟'))return;const {data,error}=await this.sb.from('yawmi_documents').select('data,revision').eq('user_id',this.currentUser.id).single();if(error)return this.say(error.message);this.loading=true;try{this.revision=Number(data.revision);this.pending=null;this.conflict=false;this.clear(this.currentUser.id);this.adapter.replaceSnapshot(data.data);this.cache(this.currentUser.id,data.data,this.revision);this.accountError='';this.status('محفوظ سحابيًا','ok');this.updateAccount()}finally{this.loading=false}},
 async showBackups(){
 const box=$('yBackupPanel'); if(!this.currentUser||!this.ready)return;box.hidden=false;box.textContent='جاري تحميل النسخ الاحتياطية…';
 try{const {data,error}=await this.sb.from('yawmi_daily_backups').select('backup_day,revision,created_at').eq('user_id',this.currentUser.id).order('backup_day',{ascending:false}).limit(30);
 if(error)throw error;
 if(!data?.length){box.textContent='لا توجد نسخ احتياطية بعد. ستُنشأ أول نسخة عند أول تعديل بعد إنشاء السجل.';return;}
 box.innerHTML='<b style="display:block;margin-bottom:8px">نسخة واحدة قبل أول تعديل لكل يوم (UTC)</b>'+data.map(r=>'<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;border-bottom:1px solid var(--border);padding:7px 0"><span dir="ltr">'+esc(r.backup_day)+' · v'+Number(r.revision)+'</span><button type="button" class="y-auth-minor" data-backup="'+esc(r.backup_day)+'">استعادة</button></div>').join('');
 box.querySelectorAll('[data-backup]').forEach(b=>b.addEventListener('click',()=>this.restoreBackup(b.dataset.backup)));
 }catch(e){box.textContent='تعذر تحميل النسخ الاحتياطية: '+e.message;}
 },
 async restoreBackup(day){
 if(!this.currentUser||!this.ready)return;
 if(this.pending||this.conflict||this.working){this.accountError='عندك تغييرات محلية غير متزامنة أو تعارض. احفظ/صدّر مسودتك أولًا ثم أعد المحاولة.';this.updateAccount();return;}
 if(!confirm('استعادة نسخة '+day+'؟ سيتم تسجيلها كإصدار جديد، وستحتفظ بنسخة اليوم السابقة تلقائيًا.'))return;
 const uid=this.currentUser.id;
 try{
 const {data:backup,error}=await this.sb.from('yawmi_daily_backups').select('data,revision').eq('user_id',uid).eq('backup_day',day).single();if(error)throw error;
 const {data:rev,error:writeError}=await this.sb.rpc('yawmi_write',{p_data:backup.data,p_expected_revision:this.revision});
 if(writeError)throw writeError;
 this.revision=Number(rev);this.loading=true;try{this.adapter.replaceSnapshot(backup.data)}finally{this.loading=false}
 this.accountError='تمت استعادة نسخة '+day+' بنجاح.';this.status('محفوظ سحابيًا','ok');this.updateAccount();this.say('تمت الاستعادة؛ راجع مهامك وإنجازاتك.');
 }catch(e){this.accountError='فشلت الاستعادة؛ لم تُمح البيانات الحالية: '+e.message;this.updateAccount();this.status('راجع المزامنة','bad')}
 },
 exportNotionCSV(){const s=this.adapter?.getSnapshot();if(!s)return;const csvField=x=>'"'+String(x??'').replace(/"/g,'""')+'"';const rows=[['Date','Completed tasks','Completed habits','Water cups','Mood','Notes']];for(const [day,rec] of Object.entries(s.daily||{}).sort(([a],[b])=>a.localeCompare(b))){const tasks=(s.tasks||[]).filter(t=>rec.tasks?.[t.id]).map(t=>t.title).join(' | ');const habits=(s.habits||[]).filter(h=>Number(rec.habits?.[h.id]||0)>=Number(h.target||1)).map(h=>h.title).join(' | ');rows.push([day,tasks,habits,rec.water||0,rec.mood||'',rec.note||''])}const txt='\ufeff'+rows.map(row=>row.map(csvField).join(',')).join('\r\n');const u=URL.createObjectURL(new Blob([txt],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=u;a.download='YAWMI_NOTION_IMPORT_'+new Date().toISOString().slice(0,10)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),2500);this.say('CSV جاهز للاستيراد اليدوي إلى Notion — ليس مزامنة تلقائية')},
 export(){const v=this.pending||this.draft(this.currentUser?.id)?.data||this.adapter?.getSnapshot();if(!v)return;const url=URL.createObjectURL(new Blob([JSON.stringify({...v,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='YAWMI_DRAFT_'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)},
 updateAccount(){if(!configured)this.accountError='هذه نسخة تجريبية محلية. لتفعيل إيميلات حقيقية، ضع إعدادات Supabase في config.js وارفع الملفات على HTTPS.';$('yAccountDetails').innerHTML=this.currentUser?`<b>الإيميل:</b> <span dir="ltr">${esc(this.currentUser.email)}</span><br><b>المزامنة:</b> ${this.conflict?'تعارض':this.pending?'تعديلات محلية لم تُرفع':'سحابية'}<br><b>رقم النسخة:</b> ${this.revision}<br><b>الثيم:</b> ${esc(document.body.dataset.design)}`:'التجربة الآن بدون حساب حقيقي.';$('yAccountError').textContent=this.accountError||'Notion: الربط لكل مستخدم يحتاج إعداد تطبيق OAuth منفصل على الخادم.';$('yManualSync').disabled=!this.currentUser||this.conflict;$('yReloadServer').disabled=!this.currentUser;$('yLogout').hidden=!this.currentUser},
 signedOut(){clearTimeout(this.timer);window.YawmiFeatures?.onSignedOut?.();this.ready=false;this.currentUser=null;this.revision=0;this.pending=null;this.conflict=false;this.adapter?.resetForSignout();this.status('سجّل الدخول');if($('ymSyncMini'))$('ymSyncMini').textContent='☁ سجّل الدخول';if(configured){this.gate(true);this.setTab('login')}}
};window.YawmiCloud=Y;window.addEventListener('online',()=>{if(Y.pending&&!Y.conflict)Y.flush();else if(Y.ready)Y.refresh()});document.addEventListener('visibilitychange',()=>{if(document.hidden&&Y.pending)Y.flush();if(!document.hidden&&Y.ready&&!Y.pending)Y.refresh()});
})();
