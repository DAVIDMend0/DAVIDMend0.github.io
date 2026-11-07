/* ==========================================================================
   case-study.js — one template for every project write-up
   --------------------------------------------------------------------------
   - Renders a project from window.PROJECTS (js/projects-data.js)
   - Gallery: one viewer for photos + videos, thumbnails, captions, lightbox
   - Prev / Next buttons and ← → keys to move between projects
   - Shareable links: yoursite/#project-<id> opens that project directly
   - ?draft in the URL shows dashed "TO ADD" boxes for missing content
   Public API: window.CaseStudy.open(id), window.CaseStudy.close()
   ========================================================================== */
(function () {
    'use strict';

    const $ = (sel, root = document) => root.querySelector(sel);
    const projects = window.PROJECTS || [];
    const draft = new URLSearchParams(location.search).has('draft');
    const HASH = '#project-';
    const COLORS = ['var(--m-red)', 'var(--m-blue)', 'var(--m-yellow)'];

    let root, panel, scroller, current = -1, mediaIndex = 0, lastFocus = null;

    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const pad = n => String(n).padStart(2, '0');
    const indexOf = id => projects.findIndex(p => p.id === id);

    /* ---------------- rendering helpers ---------------- */

    function todo(label) {
        return draft ? `<div class="cs-todo"><span>TO ADD</span>${esc(label)}</div>` : '';
    }

    // approach: array of paragraphs (strings) and bullet lists (arrays)
    function richText(blocks) {
        return blocks.map(b => Array.isArray(b)
            ? `<ul>${b.map(li => `<li>${esc(li)}</li>`).join('')}</ul>`
            : `<p>${esc(b)}</p>`).join('');
    }

    function section(n, title, body) {
        return `<section class="cs-sec"><h3><span>${pad(n)}</span>${esc(title)}</h3>${body}</section>`;
    }

    function stageItem(m, i) {
        if (m.type === 'video') {
            return `<video controls playsinline preload="metadata" src="${esc(m.src)}" aria-label="${esc(m.caption)}"></video>`;
        }
        if (m.type === 'youtube') {
            return `<iframe src="${esc(m.src)}" title="${esc(m.caption)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe>`;
        }
        return `<button type="button" class="cs-zoom" data-cs-zoom aria-label="Enlarge image: ${esc(m.caption)}">
                    <img src="${esc(m.src)}" alt="${esc(m.alt || m.caption)}" ${i === 0 ? '' : 'loading="lazy"'}>
                </button>`;
    }

    function thumb(m, i) {
        const inner = m.type === 'image'
            ? `<img src="${esc(m.src)}" alt="" loading="lazy">`
            : `<span class="cs-thumb-play"><i class="fas fa-play"></i>${m.type === 'youtube' ? 'YouTube' : 'Video'}</span>`;
        return `<button type="button" class="cs-thumb${i === mediaIndex ? ' active' : ''}" data-cs-media="${i}" aria-label="Show ${esc(m.caption)}">${inner}</button>`;
    }

    function renderGallery(p) {
        const m = p.media[mediaIndex];
        const many = p.media.length > 1;
        return `
            <figure class="cs-gallery">
                <div class="cs-stage">
                    ${stageItem(m, mediaIndex)}
                    ${many ? `<button type="button" class="cs-stage-btn prev" data-cs-step="-1" aria-label="Previous media"><i class="fas fa-chevron-left"></i></button>
                              <button type="button" class="cs-stage-btn next" data-cs-step="1" aria-label="Next media"><i class="fas fa-chevron-right"></i></button>` : ''}
                </div>
                <figcaption><span>fig. ${pad(mediaIndex + 1)}</span>${esc(m.caption)}<em>${pad(mediaIndex + 1)} / ${pad(p.media.length)}</em></figcaption>
            </figure>
            ${many ? `<div class="cs-thumbs" role="list">${p.media.map(thumb).join('')}</div>` : ''}`;
    }

    function renderSide(p) {
        const f = p.facts || {};
        const rows = [['Context', f.context], ['Date', f.date], ['Role', f.role], ['Status', f.status]];
        const factsHtml = rows.map(([k, v]) => v
            ? `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`
            : (draft ? `<div class="cs-todo-row"><dt>${k}</dt><dd>TO ADD</dd></div>` : '')).join('');

        const stack = Object.entries(p.stack || {}).map(([group, items]) =>
            `<div class="cs-stack-group"><span>${esc(group)}</span><div class="tags">${items.map(t => `<span>${esc(t)}</span>`).join('')}</div></div>`).join('');

        const links = (p.links || []).map(l =>
            `<a class="cs-link" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)} <span aria-hidden="true">&nearr;</span></a>`).join('');

        const cta = p.cta ? `<a class="btn btn-primary cs-cta" href="${esc(p.cta.href)}" data-cs-leave>${esc(p.cta.label)} <i class="fas fa-arrow-right"></i></a>` : '';

        return `
            <aside class="cs-side">
                ${factsHtml ? `<dl class="cs-facts">${factsHtml}</dl>` : ''}
                ${draft ? '<div class="cs-side-block">' + todo('Key numbers (2–4 measured results)') + '</div>' : ''}
                ${stack ? `<div class="cs-side-block"><h4>Stack</h4>${stack}</div>` : ''}
                ${links || draft ? `<div class="cs-side-block"><h4>Links</h4>${links}${!(p.links || []).some(l => /github/i.test(l.url)) ? todo('GitHub repository link') : ''}</div>` : ''}
                ${cta}
            </aside>`;
    }

    function render() {
        const p = projects[current];
        const flagship = p.tier !== 'early';
        let n = 0;
        const secs = [];

        secs.push(section(++n, 'Problem', `<p>${esc(p.problem)}</p>`));
        secs.push(section(++n, 'How it works',
            richText(p.approach) + (p.diagram
                ? `<figure class="cs-diagram"><img src="${esc(p.diagram.src)}" alt="${esc(p.diagram.caption)}"><figcaption>${esc(p.diagram.caption)}</figcaption></figure>`
                : (flagship ? todo('Block diagram (supplied by David)') : ''))));
        if (p.iterations) {
            secs.push(section(++n, 'Iterations', `<ol class="cs-steps">${p.iterations.map(it =>
                `<li><strong>${esc(it.label)}</strong><span>${esc(it.text)}</span></li>`).join('')}</ol>`));
        } else if (flagship && draft) {
            secs.push(section(++n, 'Iterations', todo('What changed between versions, and why')));
        }
        if (p.challenge) secs.push(section(++n, 'Hardest problem', `<p>${esc(p.challenge)}</p>`));
        else if (flagship && draft) secs.push(section(++n, 'Hardest problem', todo('The toughest bug or obstacle and how you solved it')));
        secs.push(section(++n, 'Result', `<p>${esc(p.outcome)}</p>`));
        if (p.next) secs.push(section(++n, 'Next steps', `<p>${esc(p.next)}</p>`));
        else if (flagship && draft) secs.push(section(++n, 'Next steps', todo('What you would improve or build next')));

        const prev = projects[(current - 1 + projects.length) % projects.length];
        const next = projects[(current + 1) % projects.length];

        parkExtras();
        scroller.innerHTML = `
            <div class="cs-head" style="--cs-color:${COLORS[current % COLORS.length]}">
                <span class="cs-kicker">${p.tier === 'early' ? 'Early build &middot; ' : ''}${esc(p.category)}</span>
                <h2 id="csTitle">${esc(p.title)}</h2>
                <p class="cs-sub">${esc(p.subtitle)}</p>
            </div>
            <div class="cs-grid">
                <div class="cs-main">
                    <div id="csGallery">${renderGallery(p)}</div>
                    ${secs.join('')}
                    ${p.extra ? '<div class="cs-extra" id="csExtraMount"></div>' : ''}
                    ${p.credits ? `<p class="cs-credits">${p.credits}</p>` : ''}
                </div>
                ${renderSide(p)}
            </div>
            <div class="cs-foot" role="navigation" aria-label="More projects">
                <button type="button" data-cs-go="-1"><span>&larr; Previous</span>${esc(prev.title)}</button>
                <button type="button" data-cs-go="1"><span>Next &rarr;</span>${esc(next.title)}</button>
            </div>`;

        $('#csPos', root).textContent = `${pad(current + 1)} / ${pad(projects.length)} · ${p.category}`;
        scroller.scrollTop = 0;
        mountExtras(p);
    }

    function renderGalleryOnly() {
        $('#csGallery', root).innerHTML = renderGallery(projects[current]);
    }

    /* Interactive blocks that live in the page (e.g. the Doppler simulator)
       are moved into the case study and parked again afterwards, so their
       existing event bindings keep working. */
    function parkExtras() {
        const holder = $('#csExtras');
        document.querySelectorAll('[data-cs-extra]').forEach(el => { if (el.parentNode !== holder) holder.appendChild(el); });
    }
    function mountExtras(p) {
        if (!p.extra) return;
        const el = document.querySelector(`[data-cs-extra="${p.extra}"]`);
        const mount = $('#csExtraMount', root);
        if (el && mount) {
            mount.appendChild(el);
            if (p.extra === 'doppler' && typeof window.updateDopplerSim === 'function') {
                requestAnimationFrame(() => window.updateDopplerSim());
            }
        }
    }

    /* ---------------- open / close / navigate ---------------- */

    function open(id, opts = {}) {
        const i = indexOf(id);
        if (i < 0) return;
        const wasOpen = !root.hidden;
        if (wasOpen && i === current && opts.history === false) return; // already showing it
        current = i;
        mediaIndex = 0;
        render();
        if (!wasOpen) {
            lastFocus = document.activeElement;
            root.hidden = false;
            document.body.style.overflow = 'hidden';
            requestAnimationFrame(() => root.classList.add('open'));
            setTimeout(() => panel.focus(), 30);
        }
        const hash = HASH + id;
        if (opts.history !== false && location.hash !== hash) {
            (wasOpen ? history.replaceState : history.pushState).call(history, { cs: id }, '', hash);
        }
    }

    function close(opts = {}) {
        if (root.hidden) return;
        closeLightbox();
        root.classList.remove('open');
        root.hidden = true;
        parkExtras();
        scroller.innerHTML = '';
        document.body.style.overflow = '';
        if (opts.history !== false && location.hash.startsWith(HASH)) {
            history.replaceState(null, '', location.pathname + location.search);
        }
        if (lastFocus && lastFocus.focus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
    }

    function go(dir) {
        const next = projects[(current + dir + projects.length) % projects.length];
        open(next.id);
    }

    function stepMedia(dir) {
        const p = projects[current];
        mediaIndex = (mediaIndex + dir + p.media.length) % p.media.length;
        renderGalleryOnly();
        const lb = $('#csLightbox');
        if (!lb.hidden) showLightbox();
    }

    /* ---------------- lightbox ---------------- */

    function showLightbox() {
        const m = projects[current].media[mediaIndex];
        if (m.type !== 'image') { closeLightbox(); return; }
        const lb = $('#csLightbox');
        $('img', lb).src = m.src;
        $('img', lb).alt = m.alt || m.caption;
        $('figcaption', lb).textContent = `fig. ${pad(mediaIndex + 1)} — ${m.caption}`;
        lb.hidden = false;
    }
    function closeLightbox() { const lb = $('#csLightbox'); if (lb) lb.hidden = true; }

    /* ---------------- wiring ---------------- */

    function init() {
        root = $('#caseStudy');
        if (!root || !projects.length) return;
        panel = $('.cs-panel', root);
        scroller = $('#csScroll', root);

        root.addEventListener('click', e => {
            const t = e.target.closest('button, a, [data-cs-close]');
            if (!t) return;
            if (t.matches('[data-cs-close]')) return close();
            if (t.matches('[data-cs-prev]')) return go(-1);
            if (t.matches('[data-cs-next]')) return go(1);
            if (t.dataset.csGo) return go(parseInt(t.dataset.csGo, 10));
            if (t.dataset.csStep) return stepMedia(parseInt(t.dataset.csStep, 10));
            if (t.dataset.csMedia) { mediaIndex = parseInt(t.dataset.csMedia, 10); return renderGalleryOnly(); }
            if (t.matches('[data-cs-zoom]')) return showLightbox();
            if (t.matches('[data-cs-leave]')) {
                e.preventDefault();
                const target = document.querySelector(t.getAttribute('href'));
                close();
                if (target) setTimeout(() => target.scrollIntoView({ behavior: 'smooth' }), 0);
            }
        });

        // Swipe between media on touch screens
        let x0 = null;
        root.addEventListener('touchstart', e => { if (e.target.closest('.cs-stage')) x0 = e.touches[0].clientX; }, { passive: true });
        root.addEventListener('touchend', e => {
            if (x0 === null) return;
            const dx = e.changedTouches[0].clientX - x0;
            if (Math.abs(dx) > 50) stepMedia(dx < 0 ? 1 : -1);
            x0 = null;
        }, { passive: true });

        const lb = $('#csLightbox');
        lb.addEventListener('click', e => {
            if (e.target.closest('[data-lb-step]')) { e.stopPropagation(); return stepMedia(parseInt(e.target.closest('[data-lb-step]').dataset.lbStep, 10)); }
            closeLightbox();
        });

        document.addEventListener('keydown', e => {
            if (root.hidden) return;
            const typing = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.tagName === 'VIDEO';
            if (e.key === 'Escape') { e.preventDefault(); return lb.hidden ? close() : closeLightbox(); }
            if (typing) return;
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                const dir = e.key === 'ArrowRight' ? 1 : -1;
                return lb.hidden ? go(dir) : stepMedia(dir);
            }
            if (e.key === 'Tab') {   // keep focus inside the dialog
                const f = Array.from(root.querySelectorAll('button, a[href], video, iframe, input, [tabindex]:not([tabindex="-1"])'))
                    .filter(el => el.offsetParent !== null);
                if (!f.length) return;
                const first = f[0], last = f[f.length - 1];
                if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
                else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
            }
        });

        // Anything on the page with data-case-open="<id>" opens that project
        document.addEventListener('click', e => {
            const t = e.target.closest('[data-case-open]');
            if (t) { e.preventDefault(); open(t.dataset.caseOpen); }
        });

        // Shareable links + browser back/forward
        const sync = () => {
            if (location.hash.startsWith(HASH)) open(location.hash.slice(HASH.length), { history: false });
            else close({ history: false });
        };
        window.addEventListener('popstate', sync);
        window.addEventListener('hashchange', sync);
        if (location.hash.startsWith(HASH)) sync();

        if (draft) console.info('[case-study] Draft mode: missing content is shown as TO ADD boxes.');
    }

    window.CaseStudy = { open: id => open(id), close: () => close() };
    document.addEventListener('DOMContentLoaded', init);
})();
