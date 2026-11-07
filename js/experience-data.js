/* ==========================================================================
   experience-data.js — the content for each Professional Experience brief
   --------------------------------------------------------------------------
   Rendered by the same panel as the projects (js/case-study.js), with an
   experience layout. Shareable link: yoursite/#experience-<id>
   Open the site with ?draft to see what is still missing (TO ADD boxes).

   Fields
     id, title (the role), subtitle, category, color (accent, optional)
     facts            { label: value }  shown in the sidebar, in order
     media            [{ type: 'image' | 'video' | 'youtube', src, caption, alt? }]
     overview         paragraphs
     responsibilities [{ icon (Font Awesome class), title, text }]
     skills           [tags]
     takeaways        paragraphs: what the role taught you   (null = hidden)
     metrics          key numbers  [{ value, label }]          (sidebar)

   Kept off the site on purpose (respecting HBS/FIFA confidentiality):
     signal maps, feed counts, match-day schedules and timings, internal
     room names and acronyms, contractor names. Spell terms out in full.
   ========================================================================== */
window.EXPERIENCE = [
    {
        id: 'worldcup',
        title: 'TOC/CIR Assistant',
        subtitle: 'FIFA World Cup 2026 · Host Broadcast Services (HBS)',
        category: 'Broadcast operations',
        color: 'var(--m-yellow)',
        facts: {
            'Role': 'TOC/CIR Assistant',
            'Organization': 'FIFA – Host Broadcast Services (HBS)',
            'Dates': 'June 2026 – July 2026',
            'Location': 'Houston, Texas'
        },
        media: [
            { type: 'image', src: 'assets/projects/fifa-world-cup/WC_P1.webp', caption: 'High above the pitch before a match', alt: 'David Mendoza in HBS uniform above the pitch at the Houston stadium, FIFA World Cup 2026' },
            { type: 'image', src: 'assets/projects/fifa-world-cup/WC_P2.webp', caption: 'The Houston stadium during pitch preparation', alt: 'Empty Houston stadium with grow lights on the pitch and HOUSTON on the big screen' },
            { type: 'image', src: 'assets/projects/fifa-world-cup/WC_P3.webp', caption: 'Pitch-side at the Houston stadium', alt: 'David Mendoza pitch-side under the stadium roof, FIFA World Cup 2026' }
        ],
        overview: [
            'Broadcast and network infrastructure support for the team’s goal of zero-downtime feed distribution to international media rights holders during the 2026 World Cup.',
            'I worked inside the Center Interconnection Room (CIR) and the Technical Operations Centre (TOC), supporting the physical fiber plant, signal handoffs and uplink verification to keep live stadium feeds on air for global broadcast partners.',
            'Match days started hours before kick-off with operations checks and ran until well after the final whistle, with setup alongside media partners the day before.'
        ],
        responsibilities: [
            { icon: 'fa-network-wired', title: 'Fiber optic loom routing', text: 'Routed, labeled and monitored multi-strand fiber looms through the CIR to bridge stadium broadcast lines with the TOC.' },
            { icon: 'fa-broadcast-tower', title: 'Outside broadcast coordination', text: 'Worked with outside broadcast contractors to validate truck signal processing chains and calibrate satellite uplink feeds.' },
            { icon: 'fa-shield-alt', title: 'End-to-end signal integrity', text: 'Verified audio/video channels, synchronization and stability delivered to global Media Partners under live production pressure.' }
        ],
        metrics: [
            { value: '7', label: 'matches supported in Houston' },
            { value: '10–12 h', label: 'on a typical game day' }
        ],
        skills: ['Fiber Optics', 'TOC / CIR Operations', 'Satellite Uplink', 'Broadcast Engineering', 'Network Engineering', 'Signal Integrity'],
        takeaways: [
            'The World Cup is where my engineering moved from the classroom to live production. Until then, most of what I knew about broadcasting and networks was theory. Here, it had to work, on air, every match.',
            'I learned from engineers who came from all over the world. They welcomed me onto the team, showed me how to put what I knew into practice, and taught me what professionalism looks like when an international broadcast depends on everyone doing their part.',
            'I’m grateful to HBS for trusting me with that responsibility, and I’m bringing the same standard of preparation, communication and teamwork to every role from here.'
        ]
    }
];
