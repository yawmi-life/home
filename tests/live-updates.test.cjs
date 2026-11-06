const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root,p), 'utf8');

test('YAWMI published PWA version is consistent with the public checker', () => {
  const deployed = JSON.parse(read('site-version.json'));
  const checker = read('yawmi-live-update-v1.js');
  assert.match(deployed.revision, /^web-[a-zA-Z0-9-]{1,64}$/);
  assert.ok(checker.includes("THIS_REVISION = '"+deployed.revision+"'"));
  assert.match(checker, /response\.headers\.get\('etag'\)/);
  assert.match(checker, /response\.headers\.get\('last-modified'\)/);
  assert.match(checker, /hasActiveEditing\(\)/);
  assert.match(checker, /visibilitychange/);
});

test('All publicly served entry screens load the live update script', () => {
  for (const p of ['index.html','auth.html','01_ATLAS_Executive.html','02_JOURNAL_Editorial.html','03_QUEST_RPG.html']) {
    assert.match(read(p), /yawmi-live-update-v1\.js\?v=38/, p);
  }
});

test('Service worker precaches the update checker and safely activates new shell', () => {
  const sw = read('sw.js');
  assert.match(sw, /yawmi-v38-public-shell-live-auto-updates/);
  for (const name of ['site-version.json','yawmi-live-update-v1.js','yawmi-widgets-v1.js','yawmi-native-widgets-v1.js']) {
    assert.ok(sw.includes("'"+name+"'"),name);
  }
  assert.match(sw, /self\.skipWaiting\(\)/);
  assert.match(sw, /self\.clients\.claim\(\)/);
  assert.match(sw, /req\.method!=='GET'/);
});
