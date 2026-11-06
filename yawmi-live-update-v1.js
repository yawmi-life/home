/* YAWMI live web deployments. Only public metadata is fetched.
   Browser/PWA updates apply on the next safe foreground resume; Android
   native APK updates remain the OS package manager's responsibility. */
(() => {
  'use strict';
  const THIS_REVISION = 'web-2026-11-06-38';
  const UPDATE_CHECK_INTERVAL = 15 * 60 * 1000;
  const RESUME_MIN_HIDDEN = 20000;
  const seenKey = 'yawmi-web-update-reload-' + THIS_REVISION;
  const releaseURL = './site-version.json';
  const isPublicPage = location.protocol === 'https:' || ['localhost','127.0.0.1'].includes(location.hostname);
  if (!isPublicPage) return;
  let lastCheck = 0, checking = false, pending = false, hiddenAt = null, banner = null;
  let lastPublishedStamp = null;
  let hadServiceWorker = !!navigator.serviceWorker?.controller;
  document.documentElement.dataset.yawmiSiteVersion = THIS_REVISION;

  function hasActiveEditing() {
    const e = document.activeElement;
    if (e && e !== document.body &&
        (e.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName))) return true;
    return !!document.querySelector('[data-unsaved="true"], [aria-busy="true"][data-save], [data-focus-running="true"]');
  }
  function withinReloadLimit() {
    try {
      const history = JSON.parse(sessionStorage.getItem(seenKey) || '[]');
      const recent = history.filter(x => Number.isFinite(x) && Date.now() - x < 60 * 60 * 1000);
      return recent.length < 2;
    } catch (_) { return true; }
  }
  function recordReload() {
    try {
      const history = JSON.parse(sessionStorage.getItem(seenKey) || '[]');
      const recent = history.filter(x => Date.now() - x < 60 * 60 * 1000);
      recent.push(Date.now());
      sessionStorage.setItem(seenKey, JSON.stringify(recent));
    } catch (_) {}
  }
  function reload() {
    if (!withinReloadLimit()) return;
    recordReload();
    location.reload();
  }
  function notify() {
    if (banner) return;
    banner = document.createElement('aside');
    banner.id = 'yawmiWebUpdatePrompt';
    banner.setAttribute('role', 'status');
    banner.dir = 'rtl';
    banner.innerHTML = '<span>اتنشر تحديث جديد ليومي. احفظ أي تعديل مفتوح وحدّث الصفحة لتطبيقه.</span>' +
      '<button type="button" aria-label="تطبيق تحديث يومي">تحديث الآن</button>';
    Object.assign(banner.style, {
      position:'fixed',bottom:'max(18px,env(safe-area-inset-bottom))',left:'12px',right:'12px',
      zIndex:'2147483640',display:'flex',alignItems:'center',justifyContent:'space-between',
      gap:'12px',padding:'13px 15px',background:'#272344',color:'#fff',border:'1px solid #ab91fc',
      borderRadius:'14px',boxShadow:'0 8px 28px #0005',font:'700 13px Cairo,Tahoma,sans-serif'
    });
    const button = banner.querySelector('button');
    Object.assign(button.style, {background:'#bda5ff',color:'#201638',border:0,borderRadius:'9px',
      padding:'8px 14px',font:'800 12px Cairo,Tahoma,sans-serif',cursor:'pointer',whiteSpace:'nowrap'});
    button.addEventListener('click',reload);
    (document.body || document.documentElement).appendChild(banner);
  }
  function applyIfSafe(resumed) {
    if (!pending || document.visibilityState !== 'visible') return;
    // Never refresh an active form or focus session; require a real return to
    // the app (or allow a user-initiated refresh from the banner).
    if (resumed && !hasActiveEditing() && withinReloadLimit()) reload();
    else notify();
  }
  async function check(resumed = false) {
    if (checking || !navigator.onLine || document.visibilityState === 'hidden') return;
    if (!resumed && Date.now() - lastCheck < UPDATE_CHECK_INTERVAL) return;
    checking = true;
    lastCheck = Date.now();
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration('./');
        if (registration) await registration.update().catch(() => {});
      }
      const response = await fetch(releaseURL + '?nocache=' + Date.now(),
        {cache:'no-store',credentials:'same-origin'});
      if (!response.ok) return;
      // GitHub Pages changes the Last-Modified / ETag of published files at
      // deploy time. Detect any future site deployment, even when the static
      // site's revision JSON was not manually bumped by its editor.
      const publishedStamp = response.headers.get('etag') ||
        response.headers.get('last-modified');
      const metadata = await response.json();
      if (typeof metadata.revision !== 'string' || !/^web-[a-zA-Z0-9-]{1,64}$/.test(metadata.revision)) return;
      const contentUpdate = metadata.revision !== THIS_REVISION;
      const deploymentChanged = !!(
        publishedStamp && lastPublishedStamp && publishedStamp !== lastPublishedStamp
      );
      if (publishedStamp) lastPublishedStamp = publishedStamp;
      if (contentUpdate || deploymentChanged) {
        pending = true;
        applyIfSafe(resumed);
      }
    } catch (_) { /* Offline stays usable. */ }
    finally { checking = false; }
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // Initial worker installation is not a new release.
      const wasControlled = hadServiceWorker;
      hadServiceWorker = true;
      if (!wasControlled) return;
      // Don't interrupt typing; the next foreground resume applies updates.
      pending = true;
      applyIfSafe(false);
    });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') hiddenAt = Date.now();
    else if (hiddenAt !== null) {
      const resumed = Date.now() - hiddenAt >= RESUME_MIN_HIDDEN;
      hiddenAt = null;
      check(resumed);
      applyIfSafe(resumed);
    }
  });
  window.addEventListener('pageshow', () => {check(false);});
  window.addEventListener('online', () => check(false));
  // Long-lived desktop tabs: poll without forcing a disruptive refresh.
  setInterval(() => check(false), UPDATE_CHECK_INTERVAL);
  window.YawmiWebUpdates = {check: () => check(false), revision: THIS_REVISION};
})();
