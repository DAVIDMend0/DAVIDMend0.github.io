// Registers the service worker (sw.js) so DRIFTS can be installed and work offline.
// Service workers only run over https:// (GitHub Pages) or http://localhost.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => {
      console.warn('DRIFTS: service worker registration failed', err);
    });
  });
}
