// app.js — editor for Solmar Bay Cover Studio.
// Wires the controls in index.html to the cover engine in render.js.
// Photos are read on this machine only (FileReader / local samples); the app
// makes no network request. Every export is a real PNG at the exact post size.

import {
  GRADES, LAYOUTS, CAPTION_STYLES, POP_HUES,
  gradePhoto, drawCover, layoutPanels, panelSourceRect,
} from './render.js';

const $ = (id) => document.getElementById(id);

// --- sample photos (kit starter's two + four originals made for this app) ---
const SAMPLE_PHOTOS = [
  { file: 'samples/pier.jpg', name: 'Pier Day', label: 'Pier 9' },
  { file: 'samples/boulevard.jpg', name: 'Boulevard', label: 'Ocean Drive' },
  { file: 'samples/sunglasses.jpg', name: 'Sunglasses', label: 'Palm Court' },
  { file: 'samples/blazer.jpg', name: 'Neon Night', label: 'Neon Row' },
  { file: 'samples/convertible.jpg', name: 'Orange Chase', label: 'Coast Road' },
  { file: 'samples/helicopter.jpg', name: 'Bay Heli', label: 'Harbor Heights' },
];

const PRESETS = {
  'Orange Chase': [4, 2, 3, 5, 1, 0],
  'Boulevard Sunset': [2, 1, 0, 4, 3, 5],
  'Neon Boardwalk': [3, 1, 0, 2, 4, 5],
  'Pier Day': [0, 4, 2, 1, 3, 5],
  'Bay Heli': [5, 4, 2, 0, 1, 3],
  'Sunglasses': [2, 2, 2, 2, 2, 2],
};

// Themed caption packs from the Solmar Bay world: Vince, Rosa, Captain
// Sloane and the districts. One tap fills kicker + title + sub-line + tagline.
const PACKS = {
  heist: { name: 'Heist', kicker: '★ SOLMAR BAY ★', title: 'NEON TIDE', subtitle: 'One last score', tagline: 'ONE LAST RIDE DOWN THE BAY' },
  chase: { name: 'Chase', kicker: '★ SOLMAR BAY ★', title: 'BAY CHASE', subtitle: 'Foot down, lights out', tagline: 'NO BRAKES ON THE BAY' },
  romance: { name: 'Romance', kicker: '★ SOLMAR BAY ★', title: 'PALM LIGHT', subtitle: 'Two hearts, one sunset', tagline: 'LOVE RIDES AT GOLDEN HOUR' },
  wanted: { name: 'Wanted', kicker: 'SOLMAR BAY POLICE DEPT', title: 'MOST WANTED', subtitle: 'Vince “Neon” Marlowe', tagline: 'REWARD $50,000 · ARMED WITH CHARM' },
};

const SIZES = { '1080x1080': [1080, 1080], '1080x1350': [1080, 1350], '1920x1080': [1920, 1080] };

function defaultPanels() {
  const picks = [2, 4, 3, 5, 1, 0];
  return picks.map((photo) => ({ photo, grade: '', crop: { x: 0, y: 0, scale: 1, flip: false } }));
}

function defaultState() {
  return {
    layout: 'mosaic6',
    size: '1920x1080',
    grade: 'vice', gradeStrength: 0.8, contrast: 1.08,
    posterInk: 0.65, grain: true, halftone: true, glow: true,
    colorPop: 'none', popStrength: 0.8,
    sunset: { on: true, style: 'vice', placement: 'band' },
    caption: { ...PACKS.heist, style: 'sunset', titleSize: 1, titlePos: 'across' },
    badges: { est: true, heat: 5, isNew: true, barcode: true, skyline: true, ribbon: true },
    panels: defaultPanels(),
    selected: 0,
  };
}

let state = defaultState();
let photos = []; // { img, name, label, cache: Map }
let comparing = false;
let exportedOnce = false;
let undoStack = [];
let redoStack = [];
let thumbsTimer = null;

const preview = $('preview');

// --- photo loading ----------------------------------------------------------
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('could not load ' + src));
    img.src = src;
  });
}

async function loadSamples() {
  for (const s of SAMPLE_PHOTOS) {
    if (photos.some((p) => p.file === s.file)) continue;
    try {
      const img = await loadImage(s.file);
      photos.push({ img, name: s.name, label: s.label, file: s.file, cache: new Map() });
    } catch (e) { /* a missing sample is skipped, never fatal */ }
  }
  buildPhotoGrid();
  buildPanelPhotoSelect();
  renderPreview();
}

function addUploads(files) {
  const readers = [...files].map((f) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ dataUrl: reader.result, name: f.name.replace(/\.[^.]+$/, '') });
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(f);
  }));
  Promise.all(readers).then(async (items) => {
    for (const it of items) {
      if (!it) continue;
      try {
        const img = await loadImage(it.dataUrl);
        photos.push({ img, name: it.name.slice(0, 18) || 'Your photo', label: 'Your photo', cache: new Map() });
      } catch (e) { /* skip unreadable files */ }
    }
    buildPhotoGrid();
    buildPanelPhotoSelect();
    renderPreview();
  });
}

// --- grading cache ----------------------------------------------------------
// A graded photo is cached per (photo, grade, strength, contrast, poster ink,
// colour pop, resolution): sliders re-render from the cache, never re-grade.
function gradeKey(gradeName, maxSide) {
  return [gradeName, state.gradeStrength, state.contrast, state.posterInk, state.colorPop, state.popStrength, maxSide].join('|');
}

function gradedFor(photo, panelGrade, maxSide) {
  const gradeName = panelGrade || state.grade;
  const key = gradeKey(gradeName, maxSide);
  if (photo.cache.has(key)) return photo.cache.get(key);
  const cv = gradePhoto(photo.img, {
    grade: gradeName, strength: state.gradeStrength, contrast: state.contrast,
    posterInk: state.posterInk, colorPop: state.colorPop, popStrength: state.popStrength,
  }, maxSide);
  if (photo.cache.size > 24) photo.cache.clear();
  photo.cache.set(key, cv);
  return cv;
}

function rawFor(photo, maxSide) {
  const key = 'raw|' + maxSide;
  if (photo.cache.has(key)) return photo.cache.get(key);
  const scale = Math.min(1, maxSide / Math.max(photo.img.naturalWidth, photo.img.naturalHeight));
  const cv = document.createElement('canvas');
  cv.width = Math.max(2, Math.round(photo.img.naturalWidth * scale));
  cv.height = Math.max(2, Math.round(photo.img.naturalHeight * scale));
  cv.getContext('2d').drawImage(photo.img, 0, 0, cv.width, cv.height);
  photo.cache.set(key, cv);
  return cv;
}

// Per-panel photo entries for the renderer: photos[i] is panel i's photo,
// already graded with that panel's own grade (or the global one).
// layoutName lets thumbnails render a different layout than the editor's.
function renderPhotos(maxSide, layoutName) {
  const n = LAYOUTS[layoutName || state.layout].panels;
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = state.panels[i];
    const photo = photos[p.photo];
    if (!photo) { out.push(null); continue; }
    out.push({
      label: photo.label,
      graded: gradedFor(photo, p.grade, maxSide),
      rawCanvas: rawFor(photo, maxSide),
    });
  }
  return out;
}

// --- rendering --------------------------------------------------------------
function previewSize() {
  const [w, h] = SIZES[state.size];
  const s = 960 / Math.max(w, h);
  return [Math.round(w * s), Math.round(h * s)];
}

function renderPreview() {
  const [w, h] = previewSize();
  if (preview.width !== w) preview.width = w;
  if (preview.height !== h) preview.height = h;
  drawCover(preview, state, renderPhotos(960), { maxSide: 960, raw: comparing });
  // no selection outline in cover-shot mode: the shot must show the cover,
  // not the editor's panel picker
  if (!document.body.classList.contains('shot-cover')) drawSelectionOutline();
  updateScore();
  scheduleThumbs();
}

// The art area's height on the preview canvas: the renderer reserves the
// bottom band when the title sits in it, and polaroids with the title across
// keep their frames in the top 58%. Hit-testing and the outline must use the
// same area the renderer used, or clicks land on the wrong panel.
function panelAreaHeight() {
  if (state.layout === 'polaroids' && state.caption.titlePos === 'across') return preview.height * 0.58;
  if (state.caption.titlePos === 'band' && state.layout !== 'wanted') return preview.height * 0.76;
  return preview.height;
}

function drawSelectionOutline() {
  const ctx = preview.getContext('2d');
  const panels = layoutPanels(state.layout, preview.width, panelAreaHeight());
  const i = state.selected;
  if (i >= panels.length || state.layout === 'fullbleed') return;
  const p = panels[i];
  ctx.save();
  ctx.strokeStyle = '#5ff2ff';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 7]);
  ctx.strokeRect(p.x + 2, p.y + 2, p.w - 4, p.h - 4);
  ctx.setLineDash([]);
  ctx.fillStyle = '#5ff2ff';
  ctx.font = `600 ${Math.max(12, preview.height * 0.022)}px Oswald, sans-serif`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText('PANEL ' + (i + 1), p.x + 8, p.y + 8);
  ctx.restore();
}

function renderThumbs() {
  // layout thumbnails: the same cover, six layouts, tiny
  document.querySelectorAll('#layoutGrid .layout-thumb canvas').forEach((cv) => {
    const layout = cv.dataset.layout;
    const st = { ...state, layout, caption: { ...state.caption } };
    cv.width = 180; cv.height = 110;
    drawCover(cv, st, renderPhotos(360, layout), { maxSide: 360 });
  });
  // series thumbnails: Teaser / Main / Finale with the same grade + caption
  const series = [
    ['seriesTeaser', 'polaroids', 96, 120],
    ['seriesMain', 'mosaic6', 180, 101],
    ['seriesFinale', 'wanted', 120, 120],
  ];
  for (const [id, layout, w, h] of series) {
    const cv = $(id);
    if (!cv) continue;
    cv.width = w; cv.height = h;
    const st = { ...state, layout, caption: { ...state.caption } };
    drawCover(cv, st, renderPhotos(360, layout), { maxSide: 360 });
  }
}

function scheduleThumbs() {
  clearTimeout(thumbsTimer);
  thumbsTimer = setTimeout(renderThumbs, 250);
}

// --- cover score ------------------------------------------------------------
// Local heuristic, 0–100: panels filled, caption set, grade + treatment on,
// badges on, exported once. Purely on-device; it only guides the user.
function coverScore() {
  const n = LAYOUTS[state.layout].panels;
  const cap = state.caption;
  const b = state.badges;
  let score = 0;
  const tips = [];
  const filled = state.panels.slice(0, n).filter((p) => photos[p.photo]).length;
  score += Math.round((30 * filled) / n);
  if (filled < n) tips.push('Fill every panel with a photo');
  if (cap.title.trim()) score += 15; else tips.push('Write a title');
  if (cap.subtitle.trim()) score += 10; else tips.push('Add a script sub-line');
  if (cap.tagline.trim()) score += 5;
  if (state.gradeStrength > 0) score += 10; else tips.push('Raise the grade strength');
  if (state.posterInk > 0.3 || state.colorPop !== 'none') score += 10;
  else tips.push('Turn up the poster ink');
  const badgesOn = [b.est, b.isNew, b.barcode, b.skyline, b.ribbon].filter(Boolean).length;
  if (badgesOn >= 3) score += 10; else tips.push('Switch on at least 3 badges');
  if (exportedOnce) score += 10; else tips.push('Export a PNG to finish');
  return { score: Math.min(100, score), tip: tips[0] || 'Cover complete — export it!' };
}

function updateScore() {
  const { score, tip } = coverScore();
  $('scoreFill').style.width = score + '%';
  $('scoreNum').textContent = score;
  $('scoreTip').textContent = tip;
}

// --- undo / redo ------------------------------------------------------------
function snapshot() { return JSON.stringify(state); }
function pushHistory() {
  undoStack.push(snapshot());
  if (undoStack.length > 60) undoStack.shift();
  redoStack = [];
}
function restore(json) {
  state = JSON.parse(json);
  syncControls();
  renderPreview();
}
function doUndo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  restore(undoStack.pop());
}
function doRedo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  restore(redoStack.pop());
}

// --- exports ----------------------------------------------------------------
function renderExportCanvas(w, h, override) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const st = override ? { ...state, ...override, caption: { ...state.caption, ...(override.caption || {}) } } : state;
  drawCover(cv, st, renderPhotos(1920), { maxSide: 1920 });
  return cv;
}

function downloadCanvas(cv, filename) {
  return new Promise((resolve) => {
    cv.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      resolve();
    }, 'image/png');
  });
}

async function exportCurrentSize() {
  const [w, h] = SIZES[state.size];
  const cv = renderExportCanvas(w, h);
  await downloadCanvas(cv, `solmar-bay-cover-${state.size}.png`);
  exportedOnce = true;
  updateScore();
}

async function exportAllSizes() {
  for (const [key, [w, h]] of Object.entries(SIZES)) {
    const cv = renderExportCanvas(w, h);
    await downloadCanvas(cv, `solmar-bay-cover-${key}.png`);
    await new Promise((r) => setTimeout(r, 250));
  }
  exportedOnce = true;
  updateScore();
}

// Series export: three coordinated covers — Teaser, Main, Finale — same grade
// and caption family, different layouts, exported together in one click.
async function exportSeries() {
  const parts = [
    { layout: 'polaroids', size: '1080x1350', name: 'solmar-series-teaser.png' },
    { layout: 'mosaic6', size: '1920x1080', name: 'solmar-series-main.png' },
    { layout: 'wanted', size: '1080x1080', name: 'solmar-series-finale.png' },
  ];
  for (const part of parts) {
    const [w, h] = SIZES[part.size];
    const cv = renderExportCanvas(w, h, { layout: part.layout });
    await downloadCanvas(cv, part.name);
    await new Promise((r) => setTimeout(r, 250));
  }
  exportedOnce = true;
  updateScore();
}

// --- surprise me ------------------------------------------------------------
// One click: random layout + grade + treatment + caption pack + photos.
function surpriseMe() {
  pushHistory();
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  state.layout = pick(Object.keys(LAYOUTS));
  state.grade = pick(Object.keys(GRADES));
  state.posterInk = 0.4 + Math.random() * 0.55;
  state.colorPop = Math.random() < 0.5 ? 'none' : pick(['pink', 'cyan', 'gold']);
  state.popStrength = 0.6 + Math.random() * 0.4;
  state.sunset.on = Math.random() < 0.8;
  state.sunset.style = pick(['vice', 'neon', 'synth']);
  state.sunset.placement = Math.random() < 0.5 ? 'band' : 'full';
  applyPack(pick(Object.keys(PACKS)), false);
  const n = LAYOUTS[state.layout].panels;
  for (let i = 0; i < n; i++) state.panels[i].photo = Math.floor(Math.random() * photos.length);
  state.caption.titleSize = 0.9 + Math.random() * 0.25;
  state.selected = 0;
  syncControls();
  renderPreview();
}

function applyPack(key, record = true) {
  if (record) pushHistory();
  const pack = PACKS[key];
  state.caption.kicker = pack.kicker;
  state.caption.title = pack.title;
  state.caption.subtitle = pack.subtitle;
  state.caption.tagline = pack.tagline;
  if (key === 'wanted') state.layout = 'wanted';
  syncControls();
  renderPreview();
}

// --- control sync -----------------------------------------------------------
function syncControls() {
  $('kickerInput').value = state.caption.kicker;
  $('titleInput').value = state.caption.title;
  $('subtitleInput').value = state.caption.subtitle;
  $('taglineInput').value = state.caption.tagline;
  $('gradeStrength').value = Math.round(state.gradeStrength * 100);
  $('gradeStrengthVal').textContent = Math.round(state.gradeStrength * 100) + '%';
  $('contrastRange').value = Math.round(state.contrast * 100);
  $('contrastVal').textContent = state.contrast.toFixed(2);
  $('posterInk').value = Math.round(state.posterInk * 100);
  $('posterInkVal').textContent = Math.round(state.posterInk * 100) + '%';
  $('colorPopSelect').value = state.colorPop;
  $('popStrength').value = Math.round(state.popStrength * 100);
  $('grainToggle').checked = state.grain;
  $('halftoneToggle').checked = state.halftone;
  $('glowToggle').checked = state.glow;
  $('sunsetPlacement').value = state.sunset.on ? state.sunset.placement : 'off';
  $('sunsetStyle').value = state.sunset.style;
  $('titleSizeRange').value = Math.round(state.caption.titleSize * 100);
  $('titleSizeVal').textContent = Math.round(state.caption.titleSize * 100) + '%';
  $('heatRange').value = state.badges.heat;
  $('heatVal').textContent = '★'.repeat(state.badges.heat) + '☆'.repeat(5 - state.badges.heat);
  $('badgeEst').checked = state.badges.est;
  $('badgeNew').checked = state.badges.isNew;
  $('badgeBarcode').checked = state.badges.barcode;
  $('badgeSkyline').checked = state.badges.skyline;
  $('badgeRibbon').checked = state.badges.ribbon;
  document.querySelectorAll('#sizeRow .pill').forEach((b) => b.classList.toggle('on', b.dataset.size === state.size));
  document.querySelectorAll('#titlePosRow .pill').forEach((b) => b.classList.toggle('on', b.dataset.pos === state.caption.titlePos));
  document.querySelectorAll('#captionStyleRow .pill').forEach((b) => b.classList.toggle('on', b.dataset.style === state.caption.style));
  document.querySelectorAll('#layoutGrid .layout-thumb').forEach((b) => b.classList.toggle('on', b.dataset.layout === state.layout));
  document.querySelectorAll('#gradeGrid .grade-swatch').forEach((b) => b.classList.toggle('on', b.dataset.grade === state.grade));
  syncPanelControls();
}

function syncPanelControls() {
  const n = LAYOUTS[state.layout].panels;
  const i = Math.min(state.selected, n - 1);
  state.selected = i;
  $('panelTitle').textContent = `Panel ${i + 1} of ${n}`;
  const p = state.panels[i];
  $('panelPhotoSelect').value = String(p.photo);
  $('zoomRange').value = Math.round((p.crop.scale || 1) * 100);
  $('zoomVal').textContent = Math.round((p.crop.scale || 1) * 100) + '%';
  $('panelGradeSelect').value = p.grade || '';
  document.querySelectorAll('#photoGrid .photo-thumb').forEach((el) => {
    el.classList.toggle('used', Number(el.dataset.idx) === p.photo);
  });
}

// --- control builders -------------------------------------------------------
function buildPhotoGrid() {
  const grid = $('photoGrid');
  grid.innerHTML = '';
  photos.forEach((p, idx) => {
    const b = document.createElement('button');
    b.className = 'photo-thumb';
    b.dataset.idx = idx;
    b.title = p.name;
    const img = document.createElement('img');
    img.src = p.img.src;
    img.alt = p.name;
    const span = document.createElement('span');
    span.textContent = p.name;
    b.append(img, span);
    b.addEventListener('click', () => {
      pushHistory();
      state.panels[state.selected].photo = idx;
      syncPanelControls();
      renderPreview();
    });
    grid.appendChild(b);
  });
  const sel = $('presetSelect');
  sel.innerHTML = '';
  for (const name of Object.keys(PRESETS)) {
    const o = document.createElement('option');
    o.value = name; o.textContent = name;
    sel.appendChild(o);
  }
}

function buildPanelPhotoSelect() {
  const sel = $('panelPhotoSelect');
  sel.innerHTML = '';
  photos.forEach((p, idx) => {
    const o = document.createElement('option');
    o.value = idx; o.textContent = p.name;
    sel.appendChild(o);
  });
  const gs = $('panelGradeSelect');
  gs.innerHTML = '<option value="">Global grade</option>';
  for (const [key, g] of Object.entries(GRADES)) {
    const o = document.createElement('option');
    o.value = key; o.textContent = g.name;
    gs.appendChild(o);
  }
}

function buildLayoutGrid() {
  const grid = $('layoutGrid');
  grid.innerHTML = '';
  for (const [key, l] of Object.entries(LAYOUTS)) {
    const b = document.createElement('button');
    b.className = 'layout-thumb';
    b.dataset.layout = key;
    const cv = document.createElement('canvas');
    cv.dataset.layout = key;
    cv.width = 180; cv.height = 110;
    const span = document.createElement('span');
    span.textContent = l.name;
    b.append(cv, span);
    b.addEventListener('click', () => {
      pushHistory();
      state.layout = key;
      state.selected = 0;
      syncControls();
      renderPreview();
    });
    grid.appendChild(b);
  }
}

function buildGradeGrid() {
  const grid = $('gradeGrid');
  grid.innerHTML = '';
  for (const [key, g] of Object.entries(GRADES)) {
    const b = document.createElement('button');
    b.className = 'grade-swatch grade-' + key;
    b.dataset.grade = key;
    b.textContent = g.name;
    b.addEventListener('click', () => {
      pushHistory();
      state.grade = key;
      syncControls();
      renderPreview();
    });
    grid.appendChild(b);
  }
}

function buildCaptionControls() {
  const packRow = $('packRow');
  packRow.innerHTML = '';
  for (const [key, pack] of Object.entries(PACKS)) {
    const b = document.createElement('button');
    b.className = 'pill';
    b.textContent = pack.name;
    b.addEventListener('click', () => applyPack(key));
    packRow.appendChild(b);
  }
  const styleRow = $('captionStyleRow');
  styleRow.innerHTML = '';
  for (const [key, s] of Object.entries(CAPTION_STYLES)) {
    const b = document.createElement('button');
    b.className = 'pill';
    b.dataset.style = key;
    b.textContent = s.name;
    b.addEventListener('click', () => {
      pushHistory();
      state.caption.style = key;
      syncControls();
      renderPreview();
    });
    styleRow.appendChild(b);
  }
}

// --- preview pointer interaction --------------------------------------------
function previewPoint(e) {
  const rect = preview.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (preview.width / rect.width),
    y: (e.clientY - rect.top) * (preview.height / rect.height),
  };
}

function hitPanel(pt) {
  const panels = layoutPanels(state.layout, preview.width, panelAreaHeight());
  for (let i = panels.length - 1; i >= 0; i--) {
    const p = panels[i];
    if (pt.x >= p.x && pt.x <= p.x + p.w && pt.y >= p.y && pt.y <= p.y + p.h) return i;
  }
  return -1;
}

let drag = null;
function bindPreview() {
  preview.addEventListener('pointerdown', (e) => {
    const pt = previewPoint(e);
    const i = hitPanel(pt);
    if (i < 0) return;
    state.selected = i;
    syncPanelControls();
    renderPreview();
    const panels = layoutPanels(state.layout, preview.width, panelAreaHeight());
    const p = panels[i];
    const pstate = state.panels[i];
    const photo = photos[pstate.photo];
    drag = { startX: pt.x, startY: pt.y, crop: { ...pstate.crop }, panel: p, photo, moved: false };
    preview.setPointerCapture(e.pointerId);
  });
  preview.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const pt = previewPoint(e);
    const dx = pt.x - drag.startX, dy = pt.y - drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
    if (!drag.moved || !drag.photo) return;
    const graded = gradedFor(drag.photo, state.panels[state.selected].grade, 960);
    const rect = panelSourceRect(graded, drag.panel, drag.crop);
    const iw = graded.width, ih = graded.height;
    const pxPerSrcX = rect.sw / drag.panel.w;
    const pxPerSrcY = rect.sh / drag.panel.h;
    const rangeX = Math.max(0, (iw - rect.sw) / 2);
    const rangeY = Math.max(0, (ih - rect.sh) / 2);
    const crop = state.panels[state.selected].crop;
    if (rangeX > 0) crop.x = Math.max(-1, Math.min(1, drag.crop.x - (dx * pxPerSrcX) / rangeX));
    if (rangeY > 0) crop.y = Math.max(-1, Math.min(1, drag.crop.y - (dy * pxPerSrcY) / rangeY));
    renderPreview();
  });
  const endDrag = () => {
    if (drag && drag.moved) pushHistory();
    drag = null;
  };
  preview.addEventListener('pointerup', endDrag);
  preview.addEventListener('pointercancel', endDrag);
  preview.addEventListener('wheel', (e) => {
    e.preventDefault();
    const crop = state.panels[state.selected].crop;
    pushHistory();
    crop.scale = Math.max(1, Math.min(4, (crop.scale || 1) * (e.deltaY < 0 ? 1.12 : 0.89)));
    syncPanelControls();
    renderPreview();
  }, { passive: false });
}

// --- hold to compare --------------------------------------------------------
// Press and hold: the preview shows the original photos with no grade,
// no posterize, no halftone, no captions — the raw material vs the poster.
function bindCompare() {
  const btn = $('compareBtn');
  const start = (e) => { e.preventDefault(); comparing = true; renderPreview(); };
  const stop = () => { if (comparing) { comparing = false; renderPreview(); } };
  btn.addEventListener('pointerdown', start);
  btn.addEventListener('pointerup', stop);
  btn.addEventListener('pointerleave', stop);
  btn.addEventListener('pointercancel', stop);
}

// --- wiring -----------------------------------------------------------------
function bindControls() {
  $('surpriseBtn').addEventListener('click', surpriseMe);
  $('undoBtn').addEventListener('click', doUndo);
  $('redoBtn').addEventListener('click', doRedo);
  $('coverViewBtn').addEventListener('click', () => {
    document.body.classList.toggle('cover-view');
    renderPreview();
  });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); doUndo(); }
    else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); doRedo(); }
  });
  $('uploadInput').addEventListener('change', (e) => { addUploads(e.target.files); e.target.value = ''; });
  $('loadSamplesBtn').addEventListener('click', loadSamples);
  $('applyPresetBtn').addEventListener('click', () => {
    pushHistory();
    const preset = PRESETS[$('presetSelect').value];
    const n = LAYOUTS[state.layout].panels;
    for (let i = 0; i < n; i++) state.panels[i].photo = preset[i % preset.length];
    renderPreview();
  });
  $('fillOneBtn').addEventListener('click', () => {
    pushHistory();
    const idx = state.panels[state.selected].photo;
    for (const p of state.panels) p.photo = idx;
    renderPreview();
  });
  $('panelPhotoSelect').addEventListener('change', (e) => {
    pushHistory();
    state.panels[state.selected].photo = Number(e.target.value);
    syncPanelControls();
    renderPreview();
  });
  $('useAllBtn').addEventListener('click', () => {
    pushHistory();
    const idx = state.panels[state.selected].photo;
    for (const p of state.panels) p.photo = idx;
    renderPreview();
  });
  $('flipBtn').addEventListener('click', () => {
    pushHistory();
    const c = state.panels[state.selected].crop;
    c.flip = !c.flip;
    renderPreview();
  });
  $('resetCropBtn').addEventListener('click', () => {
    pushHistory();
    state.panels[state.selected].crop = { x: 0, y: 0, scale: 1, flip: false };
    syncPanelControls();
    renderPreview();
  });
  $('zoomRange').addEventListener('input', (e) => {
    state.panels[state.selected].crop.scale = Number(e.target.value) / 100;
    $('zoomVal').textContent = e.target.value + '%';
    renderPreview();
  });
  $('zoomRange').addEventListener('change', () => pushHistory());
  $('panelGradeSelect').addEventListener('change', (e) => {
    pushHistory();
    state.panels[state.selected].grade = e.target.value;
    renderPreview();
  });
  $('gradeStrength').addEventListener('input', (e) => {
    state.gradeStrength = Number(e.target.value) / 100;
    $('gradeStrengthVal').textContent = e.target.value + '%';
    renderPreview();
  });
  $('gradeStrength').addEventListener('change', () => pushHistory());
  $('contrastRange').addEventListener('input', (e) => {
    state.contrast = Number(e.target.value) / 100;
    $('contrastVal').textContent = state.contrast.toFixed(2);
    renderPreview();
  });
  $('contrastRange').addEventListener('change', () => pushHistory());
  $('posterInk').addEventListener('input', (e) => {
    state.posterInk = Number(e.target.value) / 100;
    $('posterInkVal').textContent = e.target.value + '%';
    renderPreview();
  });
  $('posterInk').addEventListener('change', () => pushHistory());
  $('colorPopSelect').addEventListener('change', (e) => {
    pushHistory();
    state.colorPop = e.target.value;
    renderPreview();
  });
  $('popStrength').addEventListener('input', (e) => {
    state.popStrength = Number(e.target.value) / 100;
    renderPreview();
  });
  $('popStrength').addEventListener('change', () => pushHistory());
  $('grainToggle').addEventListener('change', (e) => { pushHistory(); state.grain = e.target.checked; renderPreview(); });
  $('halftoneToggle').addEventListener('change', (e) => { pushHistory(); state.halftone = e.target.checked; renderPreview(); });
  $('glowToggle').addEventListener('change', (e) => { pushHistory(); state.glow = e.target.checked; renderPreview(); });
  $('sunsetPlacement').addEventListener('change', (e) => {
    pushHistory();
    const v = e.target.value;
    state.sunset.on = v !== 'off';
    if (v !== 'off') state.sunset.placement = v;
    renderPreview();
  });
  $('sunsetStyle').addEventListener('change', (e) => {
    pushHistory();
    state.sunset.style = e.target.value;
    renderPreview();
  });
  const captionInput = (key) => (e) => { state.caption[key] = e.target.value; renderPreview(); };
  $('kickerInput').addEventListener('input', captionInput('kicker'));
  $('titleInput').addEventListener('input', captionInput('title'));
  $('subtitleInput').addEventListener('input', captionInput('subtitle'));
  $('taglineInput').addEventListener('input', captionInput('tagline'));
  $('kickerInput').addEventListener('change', () => pushHistory());
  $('titleInput').addEventListener('change', () => pushHistory());
  $('subtitleInput').addEventListener('change', () => pushHistory());
  $('taglineInput').addEventListener('change', () => pushHistory());
  $('titleSizeRange').addEventListener('input', (e) => {
    state.caption.titleSize = Number(e.target.value) / 100;
    $('titleSizeVal').textContent = e.target.value + '%';
    renderPreview();
  });
  $('titleSizeRange').addEventListener('change', () => pushHistory());
  $('titlePosRow').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pos]');
    if (!b) return;
    pushHistory();
    state.caption.titlePos = b.dataset.pos;
    syncControls();
    renderPreview();
  });
  const badgeMap = { badgeEst: 'est', badgeNew: 'isNew', badgeBarcode: 'barcode', badgeSkyline: 'skyline', badgeRibbon: 'ribbon' };
  for (const [id, key] of Object.entries(badgeMap)) {
    $(id).addEventListener('change', (e) => { pushHistory(); state.badges[key] = e.target.checked; renderPreview(); });
  }
  $('heatRange').addEventListener('input', (e) => {
    state.badges.heat = Number(e.target.value);
    $('heatVal').textContent = '★'.repeat(state.badges.heat) + '☆'.repeat(5 - state.badges.heat);
    renderPreview();
  });
  $('heatRange').addEventListener('change', () => pushHistory());
  $('sizeRow').addEventListener('click', (e) => {
    const b = e.target.closest('[data-size]');
    if (!b) return;
    state.size = b.dataset.size;
    syncControls();
    renderPreview();
  });
  $('exportBtn').addEventListener('click', exportCurrentSize);
  $('exportAllBtn').addEventListener('click', exportAllSizes);
  $('exportSeriesBtn').addEventListener('click', exportSeries);
}

// --- shot modes (for the maker's screenshots) -------------------------------
// ?shot=cover renders one exported cover full-window; ?shot=editor opens the
// editor with a preset applied. Both set window.__coverReady when drawn.
function applyShotParams() {
  const q = new URLSearchParams(location.search);
  const shot = q.get('shot');
  if (!shot) return null;
  if (q.get('layout') && LAYOUTS[q.get('layout')]) state.layout = q.get('layout');
  if (q.get('grade') && GRADES[q.get('grade')]) state.grade = q.get('grade');
  if (q.get('pack') && PACKS[q.get('pack')]) applyPack(q.get('pack'), false);
  if (q.get('size') && SIZES[q.get('size')]) state.size = q.get('size');
  if (q.get('poster') != null) state.posterInk = Math.max(0, Math.min(1, Number(q.get('poster'))));
  if (q.get('pop') && POP_HUES[q.get('pop')] !== undefined) state.colorPop = q.get('pop');
  if (q.get('sunset') && ['vice', 'neon', 'synth'].includes(q.get('sunset'))) state.sunset.style = q.get('sunset');
  if (q.get('title')) state.caption.title = q.get('title');
  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    const [w, h] = SIZES[state.size];
    const fit = Math.min(window.innerWidth / w, window.innerHeight / h);
    preview.style.width = Math.round(w * fit) + 'px';
    preview.style.height = Math.round(h * fit) + 'px';
  }
  return shot;
}

async function loadFonts() {
  try {
    await Promise.all([
      document.fonts.load('400 100px Anton'),
      document.fonts.load('400 100px Pacifico'),
      document.fonts.load('600 100px Oswald'),
      document.fonts.load('400 100px Oswald'),
    ]);
    await document.fonts.ready;
  } catch (e) { /* system fonts fall back silently */ }
}

// --- boot -------------------------------------------------------------------
async function boot() {
  buildLayoutGrid();
  buildGradeGrid();
  buildCaptionControls();
  bindControls();
  bindPreview();
  bindCompare();
  const shot = applyShotParams();
  syncControls();
  await loadFonts();
  await loadSamples();
  renderPreview();
  renderThumbs();
  if (shot) {
    // let the graded photos settle, then mark the shot ready for capture
    await new Promise((r) => setTimeout(r, 350));
    renderPreview();
    window.__coverReady = true;
  }
}

boot();
