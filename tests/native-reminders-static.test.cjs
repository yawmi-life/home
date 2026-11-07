const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
test('Android uses real home-screen widgets rather than an in-app fake widget list',()=>{
 const m=read('android/app/src/main/AndroidManifest.xml');
 assert.equal((m.match(/android\.appwidget\.provider/g)||[]).length,11);
 assert.match(m,/YawmiCategoryWidget\$Today/);
 assert.match(m,/YawmiCategoryWidget\$Life/);
});
test('Android notifications require explicit permission and restore alarms',()=>{
 const m=read('android/app/src/main/AndroidManifest.xml');
 assert.match(m,/android\.permission\.POST_NOTIFICATIONS/);
 assert.match(m,/android\.permission\.RECEIVE_BOOT_COMPLETED/);
 assert.match(m,/YawmiReminderReceiver/);
 assert.match(m,/YawmiReminderBootReceiver/);
 const scheduler=read('android/app/src/main/java/com/yawmilife/app/YawmiReminderScheduler.java');
 assert.match(scheduler,/setAndAllowWhileIdle/);
 assert.match(scheduler,/enabled\(c\)/);
});
test('web push and native Android notifications are separate paths',()=>{
 const push=read('yawmi-push-v35.js');
 const native=read('yawmi-android-alerts-v1.js');
 assert.match(push,/YawmiAndroidAlerts/);
 assert.match(native,/yawminotify:\/\//);
 assert.doesNotMatch(native,/service_role|private_key/);
 for(const skin of ['01_ATLAS_Executive.html','02_JOURNAL_Editorial.html','03_QUEST_RPG.html']){
  assert.match(read(skin),/yawmi-android-alerts-v1\.js/);
 }
});
test('asset links fingerprint matches original signing identity',()=>{
 const dal=JSON.parse(read('.well-known/assetlinks.json'));
 assert.equal(dal[0].target.package_name,'com.yawmilife.app');
 assert.equal(dal[0].target.sha256_cert_fingerprints[0],
 'C9:41:1A:EB:C3:83:EC:82:00:17:7D:6B:C2:AF:79:56:02:90:C4:F0:A1:03:5B:45:BA:AD:CC:F1:AF:B6:F3:D8');
});
