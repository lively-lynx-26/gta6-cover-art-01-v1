// Solmar Bay Cover Studio — editor state, controls, export.
// Own world: Solmar Bay, Vince, Rosa, Captain Sloane. No Rockstar material.

import { SAMPLE_PHOTOS, GRADES, LAYOUTS, CAPTION_STYLES, layoutGeometry, drawCover, renderPanelImage } from './render.js';

export const SIZES = {
  '1080x1080': { w: 1080, h: 1080, label: 'Square 1080 × 1080' },
  '1080x1350': { w: 1080, h: 1350, label: 'Portrait 1080 × 1350' },
  '1920x1080': { w: 1920, h: 1080, label: 'Landscape 1920 × 1080' },
};

export const CAPTION_PACKS = {
  heist:   { name: 'Heist',   kicker: '★ SOLMAR BAY ★', title: 'NEON TIDE',  script: 'One last score',       tagline: 'VINCE · ROSA · EVERY STREET IS A STAGE' },
  chase:   { name: 'Chase',   kicker: '★ SOLMAR BAY ★', title: 'BAY CHASE',  script: 'Foot down, lights out', tagline: 'CAPTAIN SLOANE IS CLOSING IN' },
  romance: { name: 'Romance', kicker: '★ SOLMAR BAY ★', title: 'PALM HEARTS', script: 'Summer on the bay',    tagline: 'ONE NIGHT, EVERY LIGHT' },
  wanted:  { name: 'Wanted',  kicker: '★ WANTED ★',     title: 'LAST SUNSET', script: 'Wanted in Solmar Bay', tagline: 'ONE LAST SCORE · SUNSET COAST' },
};

const PHOTO_CYCLE = ['sunglasses', 'blazer', 'boulevard', 'helicopter', 'pier', 'convertible'];

export function defaultState() {
  return {
    size: '1920x1080',
    layout: 'mosaic',
    grade: 'sunset',
    gradeStrength: 80,
    contrast: 10,
    posterInk: 60,
    grain: true,
    halftone: true,
    glow: true,
    vignette: true,
    colorPop: 'none',
    popStrength: 60,
    sunset: { on: true, style: 'grid' },
    caption: { ...CAPTION_PACKS.heist, style: 'gloss', size: 100, pos: 'band' },
    panels: Array.from({ length: 9 }, (_, i) => ({
      photo: PHOTO_CYCLE[i % PHOTO_CYCLE.length], zoom: 1, ox: 0, oy: 0, flip: false, grade: null,
    })),
    badges: { est: true, heat: 5, barcode: true, skyline: true, ribbon: true },
  };
}

export let state = defaultState();
export const images = new Map(); // photo id -> HTMLImageElement
export const library = [...SAMPLE_PHOTOS]; // photo id -> {id,name,file|src}
let selectedPanel = 0;
let compareHold = false;
let coverView = false;

let history = [JSON.stringify(state)];
let historyIndex = 0;

export function pushHistory() {
  history = history.slice(0, historyIndex + 1);
  history.push(JSON.stringify(state));
  if (history.length > 60) history.shift();
  historyIndex = history.length - 1;
  syncUndoRedo();
}

export function undo() {
  if (historyIndex <= 0) return;
  historyIndex--;
  state = JSON.parse(history[historyIndex]);
  refreshAll();
}

export function redo() {
  if (historyIndex >= history.length - 1) return;
  historyIndex++;
  state = JSON.parse(history[historyIndex]);
  refreshAll();
}

function syncUndoRedo() {
  const u = document.getElementById('undoBtn'), r = document.getElementById('redoBtn');
  if (u) u.disabled = historyIndex <= 0;
  if (r) r.disabled = historyIndex >= history.length - 1;
}

// ---- Cover Score: live 0–100 meter with a next-step tip ----
export function coverScore(s) {
  let score = 35;
  const tips = [];
  const distinct = new Set(s.panels.slice(0, (LAYOUTS[s.layout] || {}).panels || 6).map((p) => p.photo)).size;
  if (distinct >= 3) score += 8; else tips.push('Fill three or more panels with different photos');
  if (s.posterInk >= 40) score += 6; else tips.push('Raise Poster Ink past 40 for the comic look');
  if (s.sunset && s.sunset.on) score += 6; else tips.push('Turn on the Vice Sunset layer');
  const c = s.caption;
  if (c.kicker && c.title && c.script && c.tagline) score += 6; else tips.push('Fill in all four caption fields');
  if (s.badges.est && s.badges.heat >= 4) score += 5; else tips.push('Keep the EST. 2026 starburst and 5-star HEAT on');
  if (s.layout === 'wanted' || s.layout === 'polaroids') score += 5; else tips.push('Try the Wanted or Polaroids genre layout');
  if (s.colorPop && s.colorPop !== 'none') score += 5; else tips.push('Try a Colour Pop (pink, cyan or gold)');
  if (s.grain || s.halftone) score += 5; else tips.push('Turn on Grain or Halftone for print texture');
  if (s.panels.some((p) => p.grade)) score += 4; else tips.push('Give one panel its own grade');
  if (c.title.trim().split(/\s+/).length >= 2) score += 5; else tips.push('Make the title two words for a bigger punch');
  if (s.gradeStrength >= 60) score += 5; else tips.push('Push Grade Strength past 60');
  return { score: Math.min(100, score), tip: tips[0] || 'Cover is ready — export it in all three sizes.' };
}

// ---- one-click auto-cover ----
export function surpriseMe() {
  const rnd = Math.random;
  const layouts = Object.keys(LAYOUTS);
  const grades = Object.keys(GRADES);
  const packs = Object.keys(CAPTION_PACKS);
  const styles = Object.keys(CAPTION_STYLES);
  const sunsetStyles = ['grid', 'palms', 'skyline'];
  state.layout = layouts[Math.floor(rnd() * layouts.length)];
  state.grade = grades[Math.floor(rnd() * grades.length)];
  const pack = CAPTION_PACKS[packs[Math.floor(rnd() * packs.length)]];
  state.caption = { ...pack, style: styles[Math.floor(rnd() * styles.length)], size: 90 + Math.floor(rnd() * 25), pos: state.layout === 'fullbleed' ? 'across' : 'band' };
  state.sunset = { on: true, style: sunsetStyles[Math.floor(rnd() * sunsetStyles.length)] };
  state.posterInk = 45 + Math.floor(rnd() * 45);
  state.gradeStrength = 65 + Math.floor(rnd() * 35);
  state.colorPop = rnd() > 0.6 ? ['pink', 'cyan', 'gold'][Math.floor(rnd() * 3)] : 'none';
  const shuffled = [...PHOTO_CYCLE].sort(() => rnd() - 0.5);
  state.panels.forEach((p, i) => { p.photo = shuffled[i % shuffled.length]; p.zoom = 1; p.ox = 0; p.oy = 0; });
  pushHistory();
  refreshAll();
}

export function applyPack(packId) {
  const pack = CAPTION_PACKS[packId];
  if (!pack) return;
  const keep = { style: state.caption.style, size: state.caption.size, pos: state.caption.pos };
  state.caption = { ...pack, ...keep };
  pushHistory();
  refreshAll();
}

// URL presets (used for reproducible screenshots): ?layout=&grade=&pack=&size=&poster=&sunset=&pop=
export function applyPreset(params) {
  const q = params instanceof URLSearchParams ? params : new URLSearchParams(params || '');
  if (q.get('layout') && LAYOUTS[q.get('layout')]) state.layout = q.get('layout');
  if (q.get('grade') && GRADES[q.get('grade')]) state.grade = q.get('grade');
  if (q.get('pack')) applyPackSilent(q.get('pack'));
  if (q.get('size') && SIZES[q.get('size')]) state.size = q.get('size');
  if (q.get('poster') !== null) state.posterInk = Math.round(parseFloat(q.get('poster')) * 100);
  if (q.get('sunset')) state.sunset = { on: q.get('sunset') !== 'off', style: q.get('sunset') === 'off' ? 'grid' : q.get('sunset') };
  if (q.get('pop')) state.colorPop = q.get('pop');
  if (q.get('style') && CAPTION_STYLES[q.get('style')]) state.caption.style = q.get('style');
  if (q.get('pos')) state.caption.pos = q.get('pos');
  refreshAll();
}

function applyPackSilent(packId) {
  const pack = CAPTION_PACKS[packId];
  if (!pack) return;
  state.caption = { ...pack, style: state.caption.style, size: state.caption.size, pos: state.caption.pos };
}

// ---- photo loading ----
export function loadImage(id, src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { images.set(id, img); resolve(true); };
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

export async function loadSamples() {
  await Promise.all(library.map((p) => loadImage(p.id, p.file || p.src)));
}

export function addUpload(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const id = 'up' + Date.now();
      library.push({ id, name: file.name.replace(/\.[^.]+$/, ''), src: reader.result });
      loadImage(id, reader.result).then(() => { buildPhotoGrid(); resolve(id); });
    };
    reader.readAsDataURL(file);
  });
}

export function fillAllPanels(photoId) {
  state.panels.forEach((p) => { p.photo = photoId; });
  pushHistory();
  refreshAll();
}

// ---- rendering the preview ----
const preview = () => document.getElementById('previewCanvas');
const coverViewCanvas = () => document.getElementById('coverViewCanvas');

export function renderPreview() {
  const canvas = preview();
  if (!canvas) return;
  const dims = SIZES[state.size];
  const pw = 960, ph = Math.round((960 * dims.h) / dims.w);
  canvas.width = pw; canvas.height = ph;
  const ctx = canvas.getContext('2d');
  drawCover(ctx, pw, ph, state, images, { raw: compareHold, selected: selectedPanel });
}

export function renderCoverView() {
  const canvas = coverViewCanvas();
  if (!canvas) return;
  const dims = SIZES[state.size];
  const cw = 960, ch = Math.round((960 * dims.h) / dims.w);
  canvas.width = cw; canvas.height = ch;
  drawCover(canvas.getContext('2d'), cw, ch, state, images, {});
  const label = document.getElementById('coverViewLabel');
  if (label) label.textContent = `Exported cover — ${dims.w} × ${dims.h} · ${LAYOUTS[state.layout].name} · ${GRADES[state.grade].name}`;
}

// ---- export ----
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function exportCoverDataURL(w, h, stateOverride) {
  await document.fonts.ready;
  const s = stateOverride || state;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  drawCover(c.getContext('2d'), w, h, s, images, {});
  return c.toDataURL('image/png');
}

export async function exportPNG(sizeKey, stateOverride, filename) {
  const dims = SIZES[sizeKey];
  const url = await exportCoverDataURL(dims.w, dims.h, stateOverride);
  const blob = await (await fetch(url)).blob();
  downloadBlob(blob, filename || `solmar-bay-cover-${sizeKey}.png`);
  return true;
}

export async function exportAllSizes() {
  for (const key of Object.keys(SIZES)) {
    await exportPNG(key);
    await new Promise((r) => setTimeout(r, 120));
  }
}

// Series: Teaser / Main / Finale in one click — three different covers.
export async function exportSeries() {
  const teaser = JSON.parse(JSON.stringify(state));
  teaser.layout = 'triptych'; teaser.grade = 'neon';
  teaser.caption = { ...CAPTION_PACKS.chase, style: 'neon', size: 100, pos: 'band' };
  teaser.sunset = { on: true, style: 'grid' };
  const finale = JSON.parse(JSON.stringify(state));
  finale.layout = 'wanted'; finale.grade = 'golden';
  finale.caption = { ...CAPTION_PACKS.wanted, style: 'block', size: 100, pos: 'band' };
  finale.sunset = { on: true, style: 'palms' };
  const dims = SIZES[state.size];
  await exportPNG(state.size, teaser, `solmar-bay-teaser-${state.size}.png`);
  await new Promise((r) => setTimeout(r, 120));
  await exportPNG(state.size, null, `solmar-bay-main-${state.size}.png`);
  await new Promise((r) => setTimeout(r, 120));
  await exportPNG(state.size, finale, `solmar-bay-finale-${state.size}.png`);
}

// ---- UI: grids, bindings, panel interaction ----
export function buildPhotoGrid() {
  const grid = document.getElementById('photoGrid');
  if (!grid) return;
  grid.innerHTML = '';
  for (const p of library) {
    const b = document.createElement('button');
    b.className = 'thumb';
    b.title = p.name;
    b.innerHTML = `<img src="${p.file || p.src}" alt=""><span>${p.name}</span>`;
    b.addEventListener('click', () => {
      state.panels[selectedPanel].photo = p.id;
      pushHistory(); refreshAll();
    });
    b.addEventListener('dblclick', () => fillAllPanels(p.id));
    grid.appendChild(b);
  }
}

function buildButtonGrid(elId, items, current, onPick) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = '';
  for (const [id, label] of items) {
    const b = document.createElement('button');
    b.className = 'pill' + (id === current ? ' active' : '');
    b.textContent = label;
    b.addEventListener('click', () => { onPick(id); });
    el.appendChild(b);
  }
}

export function buildStaticGrids() {
  buildButtonGrid('layoutGrid', Object.entries(LAYOUTS).map(([k, v]) => [k, v.name]), state.layout, (id) => {
    state.layout = id;
    if (id === 'fullbleed') state.caption.pos = 'across';
    selectedPanel = 0;
    pushHistory(); refreshAll();
  });
  buildButtonGrid('gradeGrid', Object.entries(GRADES).map(([k, v]) => [k, v.name]), state.grade, (id) => {
    state.grade = id; pushHistory(); refreshAll();
  });
  buildButtonGrid('styleGrid', Object.entries(CAPTION_STYLES).map(([k, v]) => [k, v.name]), state.caption.style, (id) => {
    state.caption.style = id; pushHistory(); refreshAll();
  });
  buildButtonGrid('packGrid', Object.entries(CAPTION_PACKS).map(([k, v]) => [k, v.name]), null, (id) => applyPack(id));
  buildButtonGrid('sizeGrid', Object.entries(SIZES).map(([k, v]) => [k, v.label]), state.size, (id) => {
    state.size = id; pushHistory(); refreshAll();
  });
}

function bind(id, event, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, fn);
}

function syncInputs() {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  const setChecked = (id, v) => { const el = document.getElementById(id); if (el) el.checked = v; };
  const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('strengthRange', state.gradeStrength); setText('strengthVal', state.gradeStrength + '%');
  set('contrastRange', state.contrast); setText('contrastVal', (state.contrast >= 0 ? '+' : '') + state.contrast);
  set('inkRange', state.posterInk); setText('inkVal', state.posterInk + '%');
  set('popSelect', state.colorPop); set('popRange', state.popStrength); setText('popVal', state.popStrength + '%');
  setChecked('sunsetToggle', state.sunset.on); set('sunsetStyle', state.sunset.style);
  setChecked('grainToggle', state.grain); setChecked('halftoneToggle', state.halftone);
  setChecked('glowToggle', state.glow); setChecked('vignetteToggle', state.vignette);
  set('kickerInput', state.caption.kicker); set('titleInput', state.caption.title);
  set('scriptInput', state.caption.script); set('taglineInput', state.caption.tagline);
  set('titleSizeRange', state.caption.size); setText('titleSizeVal', state.caption.size + '%');
  set('titlePosSelect', state.caption.pos);
  setChecked('estToggle', state.badges.est); set('heatSelect', String(state.badges.heat));
  setChecked('barcodeToggle', state.badges.barcode); setChecked('ribbonToggle', state.badges.ribbon);
  setChecked('skylineToggle', state.badges.skyline);
  const panel = state.panels[selectedPanel];
  const count = (LAYOUTS[state.layout] || {}).panels || 6;
  setText('panelLabel', `Panel ${selectedPanel + 1} of ${count}`);
  const pp = document.getElementById('panelPhoto');
  if (pp) {
    pp.innerHTML = '';
    for (const p of library) {
      const o = document.createElement('option');
      o.value = p.id; o.textContent = p.name;
      if (p.id === panel.photo) o.selected = true;
      pp.appendChild(o);
    }
  }
  const pg = document.getElementById('panelGrade');
  if (pg) {
    pg.innerHTML = '<option value="">Global grade</option>';
    for (const [k, v] of Object.entries(GRADES)) {
      const o = document.createElement('option');
      o.value = k; o.textContent = v.name;
      if (panel.grade === k) o.selected = true;
      pg.appendChild(o);
    }
  }
  set('panelZoom', Math.round(panel.zoom * 100)); setText('panelZoomVal', Math.round(panel.zoom * 100) + '%');
  const sc = coverScore(state);
  setText('scoreValue', String(sc.score));
  const bar = document.getElementById('scoreBar');
  if (bar) bar.style.width = sc.score + '%';
  setText('scoreTip', 'Next: ' + sc.tip);
  document.querySelectorAll('#layoutGrid .pill').forEach((b, i) => b.classList.toggle('active', Object.keys(LAYOUTS)[i] === state.layout));
  document.querySelectorAll('#gradeGrid .pill').forEach((b, i) => b.classList.toggle('active', Object.keys(GRADES)[i] === state.grade));
  document.querySelectorAll('#styleGrid .pill').forEach((b, i) => b.classList.toggle('active', Object.keys(CAPTION_STYLES)[i] === state.caption.style));
  document.querySelectorAll('#sizeGrid .pill').forEach((b, i) => b.classList.toggle('active', Object.keys(SIZES)[i] === state.size));
}

export function refreshAll() {
  syncInputs();
  renderPreview();
  if (coverView) renderCoverView();
  syncUndoRedo();
}

// ---- panel picking: click to select, drag to move, wheel to zoom ----
function panelAt(fx, fy) {
  const geo = layoutGeometry(state.layout, 1, 1);
  for (let i = geo.panels.length - 1; i >= 0; i--) {
    const r = geo.panels[i];
    if (fx >= r.x && fx <= r.x + r.w && fy >= r.y && fy <= r.y + r.h) return i;
  }
  return -1;
}

function bindCanvas() {
  const canvas = preview();
  if (!canvas) return;
  let dragging = false, lastX = 0, lastY = 0;
  canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width, fy = (e.clientY - rect.top) / rect.height;
    const hit = panelAt(fx, fy);
    if (hit >= 0) { selectedPanel = hit; dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId); refreshAll(); }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const rect = canvas.getBoundingClientRect();
    const panel = state.panels[selectedPanel];
    panel.ox += (e.clientX - lastX) / rect.width;
    panel.oy += (e.clientY - lastY) / rect.height;
    panel.ox = Math.max(-0.6, Math.min(0.6, panel.ox));
    panel.oy = Math.max(-0.6, Math.min(0.6, panel.oy));
    lastX = e.clientX; lastY = e.clientY;
    renderPreview();
  });
  const endDrag = () => { if (dragging) { dragging = false; pushHistory(); } };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const panel = state.panels[selectedPanel];
    panel.zoom = Math.max(0.5, Math.min(3, panel.zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
    renderPreview(); syncInputs();
  }, { passive: false });
}

function bindControls() {
  bind('surpriseBtn', 'click', surpriseMe);
  bind('undoBtn', 'click', undo);
  bind('redoBtn', 'click', redo);
  bind('uploadBtn', 'click', () => document.getElementById('uploadInput').click());
  bind('uploadInput', 'change', (e) => { const f = e.target.files[0]; if (f) addUpload(f); });
  bind('fillAllBtn', 'click', () => fillAllPanels(state.panels[selectedPanel].photo));
  const slider = (id, key, commit = true) => {
    bind(id, 'input', (e) => { state[key] = Number(e.target.value); renderPreview(); syncInputs(); });
    if (commit) bind(id, 'change', () => pushHistory());
  };
  slider('strengthRange', 'gradeStrength');
  slider('contrastRange', 'contrast');
  slider('inkRange', 'posterInk');
  slider('popRange', 'popStrength');
  bind('popSelect', 'change', (e) => { state.colorPop = e.target.value; pushHistory(); refreshAll(); });
  bind('sunsetToggle', 'change', (e) => { state.sunset.on = e.target.checked; pushHistory(); refreshAll(); });
  bind('sunsetStyle', 'change', (e) => { state.sunset.style = e.target.value; pushHistory(); refreshAll(); });
  const toggle = (id, fn) => bind(id, 'change', (e) => { fn(e.target.checked); pushHistory(); refreshAll(); });
  toggle('grainToggle', (v) => { state.grain = v; });
  toggle('halftoneToggle', (v) => { state.halftone = v; });
  toggle('glowToggle', (v) => { state.glow = v; });
  toggle('vignetteToggle', (v) => { state.vignette = v; });
  toggle('estToggle', (v) => { state.badges.est = v; });
  toggle('barcodeToggle', (v) => { state.badges.barcode = v; });
  toggle('ribbonToggle', (v) => { state.badges.ribbon = v; });
  toggle('skylineToggle', (v) => { state.badges.skyline = v; });
  const text = (id, key) => {
    bind(id, 'input', (e) => { state.caption[key] = e.target.value; renderPreview(); });
    bind(id, 'change', () => pushHistory());
  };
  text('kickerInput', 'kicker'); text('titleInput', 'title');
  text('scriptInput', 'script'); text('taglineInput', 'tagline');
  bind('titleSizeRange', 'input', (e) => { state.caption.size = Number(e.target.value); renderPreview(); syncInputs(); });
  bind('titleSizeRange', 'change', () => pushHistory());
  bind('titlePosSelect', 'change', (e) => { state.caption.pos = e.target.value; pushHistory(); refreshAll(); });
  bind('heatSelect', 'change', (e) => { state.badges.heat = Number(e.target.value); pushHistory(); refreshAll(); });
  bind('panelPhoto', 'change', (e) => { state.panels[selectedPanel].photo = e.target.value; pushHistory(); refreshAll(); });
  bind('panelGrade', 'change', (e) => { state.panels[selectedPanel].grade = e.target.value || null; pushHistory(); refreshAll(); });
  bind('panelZoom', 'input', (e) => { state.panels[selectedPanel].zoom = Number(e.target.value) / 100; renderPreview(); syncInputs(); });
  bind('panelZoom', 'change', () => pushHistory());
  bind('panelReset', 'click', () => {
    const p = state.panels[selectedPanel];
    p.zoom = 1; p.ox = 0; p.oy = 0; p.flip = false;
    pushHistory(); refreshAll();
  });
  bind('panelFlip', 'click', () => {
    const p = state.panels[selectedPanel];
    p.flip = !p.flip; pushHistory(); refreshAll();
  });
  bind('exportBtn', 'click', async () => { await exportPNG(state.size); });
  bind('exportAllBtn', 'click', async () => { await exportAllSizes(); });
  bind('seriesBtn', 'click', async () => { await exportSeries(); });
  const compare = document.getElementById('compareBtn');
  if (compare) {
    compare.addEventListener('pointerdown', () => { compareHold = true; renderPreview(); });
    const release = () => { compareHold = false; renderPreview(); };
    compare.addEventListener('pointerup', release);
    compare.addEventListener('pointerleave', release);
  }
  bind('coverViewBtn', 'click', () => {
    coverView = true;
    document.getElementById('coverView').hidden = false;
    renderCoverView();
  });
  bind('backToEditorBtn', 'click', () => {
    coverView = false;
    document.getElementById('coverView').hidden = true;
  });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
  });
}

// ---- boot ----
export async function init() {
  buildPhotoGrid();
  buildStaticGrids();
  bindControls();
  bindCanvas();
  applyPreset(new URLSearchParams(location.search));
  await loadSamples();
  try {
    await Promise.all([
      document.fonts.load('16px Anton'),
      document.fonts.load('16px Oswald'),
      document.fonts.load('16px Pacifico'),
    ]);
  } catch (e) {}
  refreshAll();
  document.fonts.ready.then(() => renderPreview());
}

window.__studio = {
  get state() { return state; },
  get images() { return images; },
  get library() { return library; },
  applyPreset,
  surpriseMe,
  exportCoverDataURL,
  exportPNG,
  exportAllSizes,
  exportSeries,
  coverScore,
  refreshAll,
  renderPreview,
};

init();
