const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = path.resolve(__dirname, '..');
const read = x => fs.readFileSync(path.join(base,x), 'utf8');

test('YAWMI Android updates are automatic, without an in-app update screen', () => {
  const main = read('android/app/src/main/java/com/yawmilife/app/YawmiMainActivity.java');
  const manager = read('android/app/src/main/java/com/yawmilife/app/YawmiUpdateManager.java');
  assert.doesNotMatch(main, /Button update =|فحص تحديثات يومي الرسمية/);
  assert.match(main, /updates\.onResume\(\)/);
  assert.match(main, /YawmiUpdateWorker\.schedule\(this\)/);
  assert.doesNotMatch(manager, /new AlertDialog|setPositiveButton\("تنزيل وتحديث"/);
  assert.match(manager, /download\(targetApk, targetSha, version\)/);
  assert.match(manager, /YawmiUpdateManager/);
  assert.match(manager, /30L \* 60 \* 1000/);
});

test('Automatic releases require official SHA-256 and original Android signing certificate', () => {
  const manager = read('android/app/src/main/java/com/yawmilife/app/YawmiUpdateManager.java');
  const worker = read('android/app/src/main/java/com/yawmilife/app/YawmiUpdateWorker.java');
  const session = read('android/app/src/main/java/com/yawmilife/app/YawmiSelfUpdateSession.java');
  assert.match(manager, /originalSignatureAndUpgrade\(activity,apk\)/);
  assert.match(manager, /sha\.equals\(fileSha256\(apk\)\)/);
  assert.match(worker, /originalSignatureAndUpgrade\(app, apk\)/);
  assert.match(worker, /fileSha256\(apk\)/);
  assert.match(worker, /PeriodicWorkRequest\.Builder/);
  assert.match(worker, /30, TimeUnit\.MINUTES/);
  assert.match(session, /USER_ACTION_NOT_REQUIRED/);
  assert.match(session, /setAppPackageName\(context\.getPackageName\(\)\)/);
});

test('Android installer has protected result receiver and official fallback', () => {
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  const receiver = read('android/app/src/main/java/com/yawmilife/app/YawmiUpdateInstallResultReceiver.java');
  assert.match(manifest, /android\.permission\.UPDATE_PACKAGES_WITHOUT_USER_ACTION/);
  assert.match(manifest, /YawmiUpdateInstallResultReceiver/);
  assert.match(receiver, /STATUS_PENDING_USER_ACTION/);
  assert.match(receiver, /Intent\.EXTRA_INTENT/);
  assert.match(receiver, /IMPORTANCE_DEFAULT/);
});

test('GitHub deploys one signature-checked APK build from Android and web changes', () => {
  const workflow = read('.github/workflows/yawmi-android-apk.yml');
  assert.match(workflow, /'\*\.html'/);
  assert.match(workflow, /'\*\.js'/);
  assert.match(workflow, /'android\/\*\*'/);
  assert.match(workflow, /SIGNING_READY == 'true'/);
  assert.match(workflow, /gh release create/);
  assert.match(workflow, /original.*sign/i);
  assert.match(workflow, /node --test tests\/\*\.test\.cjs/);
});

test('Future Uptodown installs do not compete with built-in Android updater', () => {
  const manager = read('android/app/src/main/java/com/yawmilife/app/YawmiUpdateManager.java');
  const worker = read('android/app/src/main/java/com/yawmilife/app/YawmiUpdateWorker.java');
  assert.match(manager, /isUptodownManaged\(activity\)/);
  assert.match(worker, /isUptodownManaged\(context\)/);
});
