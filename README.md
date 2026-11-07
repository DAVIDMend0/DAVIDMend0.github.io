# David Mendoza — Portfolio

Personal site for **David Mendoza**, Computer Engineering student at the University of Houston, working on embedded systems, FPGA, RF/SDR, robotics and edge AI.

Hosted on GitHub Pages. Built by hand with plain HTML, CSS and JavaScript: no framework, no build step.

**What's on the page**

- **DRIFTS spotlight.** A live, interactive prototype of the sensor-gated driver monitoring app I'm building, running inside a phone frame.
- **Projects.** A large "selected" panel above an auto-scrolling reel of project cards. Picking a card or a filter updates the panel without moving the page. Clicking a skill chip shows the projects that use it.
- **Playground.** Four games, each built on a real project: Reflex (FPGA reaction timer), Balance (self-balancing robot with a tunable PID controller), Logic (gate puzzles with a Submit step: 7 Classic levels unlocked in order, plus 5 new Daily puzzles every day with a streak and a shareable result) and Tune (track a satellite's Doppler drift to decode a METEOR-M2 image).
- **Terminal easter egg.** Press <kbd>~</kbd> anywhere on the page. Try `scope` for the hero's lab mode, or `drifts --versions` for earlier DRIFTS builds.

## Project structure

```
.
├── index.html                 # The portfolio (single page)
├── favicon.svg
├── css/
│   ├── style.css              # Base design system, layout, modals, sims
│   ├── features.css           # Hero scope, DRIFTS spotlight, projects reel, playground, terminal
│   ├── theme.css              # Minimal monochrome theme + Mondrian accents (colours, type, lines)
│   ├── case-study.css         # The project write-up panel
│   └── games.css              # Playground tabs + Balance / Logic / Tune games
├── js/
│   ├── main.js                # Nav, theme, carousels, modals, reaction timer, Doppler sim
│   ├── features.js            # Hero scope, projects reel, reaction timer, terminal, etc.
│   ├── projects-data.js       # CONTENT for every project write-up (edit this to update projects)
│   ├── case-study.js          # Renders a project write-up from projects-data.js
│   └── games.js               # Playground tabs + Balance / Logic / Tune games
├── assets/
│   ├── profile/               # Portrait and hero background
│   ├── docs/                  # David_Mendoza_Resume.pdf
│   └── projects/<project>/    # Images and videos for each project
├── projects/
│   └── drifts/
│       ├── index.html             # Current DRIFTS app (served at /projects/drifts/)
│       ├── dms-simulation.html    # Vision-stage simulation
│       ├── portfolio-wrapper.js   # Phone safety notice + desktop "Back to portfolio" link
│       ├── logo.webp
│       └── versions/              # Earlier builds: v1-vision-tester, v2-sensor-gated, v3-bluetooth
```

## Project write-ups

Each project's write-up (the panel that opens from the "Things I've Built" section) is generated from **`js/projects-data.js`**. You never edit HTML to change one. Just fill in fields:

| Field | What it is | If left `null` / empty |
|---|---|---|
| `facts.context / date / role / status` | Sidebar facts | Row is hidden |
| `links` | e.g. `{ label: 'GitHub', url: '...' }` | Links block hidden |
| `iterations` | `[{ label: 'V1', text: 'what changed and why' }]` | Section hidden |
| `challenge` | Hardest problem and how you solved it | Section hidden |
| `next` | What you'd improve or build next | Section hidden |
| `metrics` | *(held, add later)* key numbers | Hidden |
| `diagram` | *(held, add later)* `{ src: 'assets/...', caption: '...' }` | Hidden |

**See what's missing:** open the site with `?draft` at the end of the URL (for example `https://<your-site>/?draft#project-meteor`). Every empty field shows as a dashed red **TO ADD** box. Visitors never see these.

**Share a specific project:** every write-up has its own link, `https://<your-site>/#project-<id>` (ids: `meteor`, `lerobot`, `fpga`, `balance`, `aircraft`, `water`, `parking`, `line`, `vgg`, `laser`).

### Adding a project

1. Put its media in `assets/projects/<project-name>/`.
2. Add an entry to `js/projects-data.js` (copy an existing one). Use `tier: 'early'` for a short write-up.
3. In `index.html`, copy one `<button class="reel-card">` inside `#reelTrack` and set:
   - `data-project`: the same `id` as in the data file.
   - `data-cat`: one or more of `embedded rf robotics ai circuits` (filter buttons).
   - `data-stack`: skill keywords such as `c arduino sensors` (skill chips).
   - `data-cta`: label on the panel's button, e.g. `Details & videos`.
   - The `<template class="reel-detail">` holds the short Problem / Build / Result shown in the big panel.
4. Update the "builds" count in the hero stats.

## Adding a DRIFTS version

1. Save the file in `projects/drifts/versions/`.
2. Just before `</body>`, add:
   `<script src="../portfolio-wrapper.js" data-home="../../../"></script>`
3. Add it to the `versions` list in the `drifts` command in `js/features.js`.

## Daily logic puzzles

The Daily set is generated in the browser, not stored anywhere: `makeDailySet()` in `js/games.js` seeds a random generator with the visitor's local date, picks circuit templates of rising difficulty (`TEMPLATES`, `DAILY_SLOTS`) and random gate types, and keeps only "interesting" puzzles (no constant outputs, every input matters). Everyone gets the same 5 puzzles on the same day. To add variety, add more circuit shapes to `TEMPLATES`. Daily #1 was 1 Nov 2026 (`DAILY_EPOCH`).

## Publishing changes

The CSS and JS links in `index.html` end in `?v=...` (for example `css/theme.css?v=20261106b`).
After editing any stylesheet or script, change that value (today's date works) so visitors' browsers fetch the new files instead of a cached copy.
