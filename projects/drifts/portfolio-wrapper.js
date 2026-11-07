/* ==========================================================================
   portfolio-wrapper.js
   Shared by every DRIFTS version (current + /versions).
   - Phones: a safety notice on every launch; dismissed with "I have assistance".
   - Computers (own page only): a discreet "Back to portfolio" link.

   Usage, just before </body>:
     <script src="portfolio-wrapper.js" data-home="../../"></script>
   data-home     = relative path from the page to the portfolio root.
   data-position = "top-left" (default) or "bottom-left" for the back link.
   ========================================================================== */
(function () {
    var script = document.currentScript;
    var home = (script && script.getAttribute('data-home')) || '/';
    var position = (script && script.getAttribute('data-position')) || 'top-left';

    var embedded = false;
    try { embedded = window.self !== window.top; } catch (e) { embedded = true; }

    // Phones only: mobile UA hints, or a touch-first device with a small screen.
    var ua = navigator.userAgent || '';
    var isPhone =
        (navigator.userAgentData && navigator.userAgentData.mobile) ||
        /Android.+Mobile|iPhone|iPod|Windows Phone|IEMobile|Opera Mini/i.test(ua) ||
        (window.matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 600);

    var css = [
        '.pf-back{position:fixed;top:18px;left:18px;z-index:9000;display:inline-flex;align-items:center;gap:6px;padding:7px 13px;border-radius:999px;',
        'font:500 13px/1 -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif;letter-spacing:0;color:#3a3a3c;text-decoration:none;',
        'background:rgba(255,255,255,.55);border:1px solid rgba(0,0,0,.08);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);',
        'opacity:.6;transition:opacity .2s ease,background .2s ease}',
        '.pf-back.pf-bottom{top:auto;bottom:18px}',
        '.pf-back:hover,.pf-back:focus-visible{opacity:1;background:rgba(255,255,255,.92)}',
        '@media (max-width:460px){.pf-back{display:none}}',
        '.pf-safety{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:24px;',
        'background:rgba(0,0,0,.55);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}',
        '.pf-safety-card{width:100%;max-width:340px;padding:26px 22px 20px;border-radius:22px;background:#fff;color:#000;text-align:center;',
        'box-shadow:0 20px 50px rgba(0,0,0,.35);font-family:-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif;letter-spacing:-.01em}',
        '.pf-safety-icon{width:52px;height:52px;margin:0 auto 14px;display:grid;place-items:center;border-radius:50%;',
        'background:rgba(255,149,0,.14);color:#ff9500;font-size:26px;font-weight:700}',
        '.pf-safety-card h2{font-size:19px;font-weight:700;margin:0 0 8px}',
        '.pf-safety-card p{font-size:15px;line-height:1.45;color:#3a3a3c;margin:0 0 20px}',
        '.pf-safety-btn{width:100%;padding:14px;border:0;border-radius:14px;background:#007aff;color:#fff;',
        'font:600 16px/1 -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif;cursor:pointer}',
        '.pf-safety-btn:active{background:#0062cc}',
        '.pf-safety-leave{display:inline-block;margin-top:14px;font-size:14px;color:#8e8e93;text-decoration:none}'
    ].join('');

    function mount() {
        var style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);

        // Discreet way back, only when opened on its own page on a computer.
        if (!embedded && !isPhone) {
            var back = document.createElement('a');
            back.className = 'pf-back' + (position === 'bottom-left' ? ' pf-bottom' : '');
            back.href = home;
            back.innerHTML = '&larr; Back to portfolio';
            document.body.appendChild(back);
        }

        // Safety notice every time the app launches on a phone.
        if (isPhone) {
            var overlay = document.createElement('div');
            overlay.className = 'pf-safety';
            overlay.setAttribute('role', 'alertdialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.setAttribute('aria-labelledby', 'pfSafetyTitle');
            overlay.setAttribute('aria-describedby', 'pfSafetyText');
            overlay.innerHTML =
                '<div class="pf-safety-card">' +
                    '<div class="pf-safety-icon" aria-hidden="true">!</div>' +
                    '<h2 id="pfSafetyTitle">Testing version only</h2>' +
                    '<p id="pfSafetyText">This version of DRIFTS is for testing only. It should not be used while operating a motor vehicle without supervision.</p>' +
                    '<button type="button" class="pf-safety-btn" id="pfSafetyOk">I have assistance</button>' +
                    (embedded ? '' : '<a class="pf-safety-leave" href="' + home + '">Back to portfolio</a>') +
                '</div>';
            document.body.appendChild(overlay);
            var ok = overlay.querySelector('#pfSafetyOk');
            setTimeout(function () { ok.focus(); }, 50);
            ok.addEventListener('click', function () { overlay.parentNode.removeChild(overlay); });
        }
    }

    if (document.body) mount();
    else document.addEventListener('DOMContentLoaded', mount);
})();
