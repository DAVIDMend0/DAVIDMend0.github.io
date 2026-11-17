// Startup: runs once the page has loaded. Keep this file last.

window.addEventListener('DOMContentLoaded', () => {
  updateRealClock();
  setInterval(updateRealClock, 10000);

  // Sync exact visible viewport height on iOS Safari so bottom bar is never hidden by browser toolbars
  const syncViewportHeight = () => {
    if (window.innerWidth <= 460) {
      const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      document.body.style.height = `${vh}px`;
      document.documentElement.style.height = `${vh}px`;
    } else {
      document.body.style.height = '';
      document.documentElement.style.height = '';
    }
  };
  syncViewportHeight();
  window.addEventListener('resize', syncViewportHeight);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', syncViewportHeight);
  }

  // Reveal Easter Egg in Sensors tab when scrolling deep down
  const sensorsScreen = document.getElementById('screen-devices');
  sensorsScreen.addEventListener('scroll', () => {
    const egg = document.getElementById('sensors-easter-egg');
    if (sensorsScreen.scrollTop > 550) {
      egg.style.opacity = '1';
    }
  });

  initSafeButton();
  loadTripLog();
  renderTripLog();
  updateSessionButton();
  updateSoundOwner();
  initSettings();
  initDeveloperMode();
  initMaintenance();
  updateBackupNote();
  initGPS();
  initDrivingMode();
  initFaceCheck();

  initMediaPipe();
  requestAnimationFrame(updateFusionPipeline);
});
