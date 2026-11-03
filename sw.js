// Caches the app shell only. Never caches /d/ data.
const C='desk-shell-v1', SHELL=['./','index.html','app.css','app.js','chart.js','manifest.json','icons/apple-touch-icon.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x))))));
self.addEventListener('fetch',e=>{ if(new URL(e.request.url).pathname.includes('/d/')) return;
  e.respondWith(fetch(e.request).catch(()=>caches.match(e.request))); });
