const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('no widget button or popup remains inside the native Android app',()=>{
  const main=read('android/app/src/main/java/com/yawmilife/app/YawmiMainActivity.java');
  assert.doesNotMatch(main,/YawmiWidgetLauncher|▦ الويدجتس|اختيار وإضافة ويدجتس/);
  assert.equal(fs.existsSync(path.join(root,'android/app/src/main/java/com/yawmilife/app/YawmiWidgetLauncher.java')),false);
});

test('all seven widgets stay registered in Android launcher manifest',()=>{
  const manifest=read('android/app/src/main/AndroidManifest.xml');
  for(const widget of ['YawmiShortcutWidget','$Today','$Productivity','$Planning','$Learning','$Wellbeing','$Life']){
    assert.ok(manifest.includes(widget),widget);
  }
  assert.match(manifest,/android\.appwidget\.provider/);
  assert.match(read('android/app/src/main/res/xml/yawmi_category_widget_info.xml'),/android:widgetCategory="home_screen"/);
});

test('web pages no longer mount widget controls but retain headless account synchronization',()=>{
  const bridge=read('yawmi-native-widgets-v1.js');
  assert.doesNotMatch(bridge,/yawmiNativeWidgetsPanel|document\.createElement\('section'\)|yawmiNativeWidgetPair|yawmiNativeWidgetFinish/);
  assert.match(bridge,/widgetPair/);
  assert.match(bridge,/yawmi_widget_snapshots/);
  for(const skin of ['01_ATLAS_Executive.html','02_JOURNAL_Editorial.html','03_QUEST_RPG.html']){
    assert.match(read(skin),/yawmi-native-widgets-v1\.js\?v=2/);
    assert.doesNotMatch(read(skin),/yawmi-widgets-v1\.js/);
  }
});
