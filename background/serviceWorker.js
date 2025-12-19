/* UltraLock background service worker
   Responsibilities:
   - Low-privileged background tasks, future centralized logging (no sensitive data persisted)
   - Manage extension lifecycle events
*/
self.addEventListener('install', (_e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (_e) => {
  self.clients.claim();
});

// Placeholder for future background logic; keep minimal for privacy
self.addEventListener('message', (ev) => {
  // process messages from content scripts if needed
  if (!ev.data || typeof ev.data !== 'object') return;
  if (ev.data.type === 'ultralock.ping') {
    ev.source.postMessage({ type: 'ultralock.pong' });
  }
});
