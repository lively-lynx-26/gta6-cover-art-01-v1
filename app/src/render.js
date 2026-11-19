// Solmar Bay Cover Studio — cover drawing engine.
// Pure canvas 2D: draws a GTA-style multi-panel poster from a state object.
// No network, no dependencies. All randomness is seeded so two runs match.

export const SAMPLE_PHOTOS = [
  { id: 'sunglasses', name: 'Shades on the Bay', file: 'samples/sunglasses.jpg' },
  { id: 'blazer', name: 'Pink Blazer Nights', file: 'samples/blazer.jpg' },
  { id: 'convertible', name: 'Sunset Ride', file: 'samples/convertible.jpg' },
  { id: 'helicopter', name: 'Bay Helicopter', file: 'samples/helicopter.jpg' },
  { id: 'pier', name: 'The Pier', file: 'samples/pier.jpg' },
  { id: 'boulevard', name: 'Boulevard Palms', file: 'samples/boulevard.jpg' },
];

export const GRADES = {
  sunset:   { name: 'Vice Sunset',    sat: 1.38, con: 1.08, bri: 1.03, hue: -8,  tint: ['#ff2e63', '#ff9a3c'], tintAlpha: 0.22 },
  neon:     { name: 'Neon Night',     sat: 1.55, con: 1.14, bri: 0.98, hue: 18,  tint: ['#7b2fff', '#00e5ff'], tintAlpha: 0.26 },
  golden:   { name: 'Golden Hour',    sat: 1.28, con: 1.06, bri: 1.06, hue: -18, tint: ['#ffd166', '#ff7b00'], tintAlpha: 0.20 },
  flamingo: { name: 'Flamingo Duotone', sat: 1.62, con: 1.12, bri: 1.00, hue: -28, tint: ['#ff5da2', '#ff2e63'], tintAlpha: 0.24 },
  teal:     { name: 'Teal Tide',      sat: 1.32, con: 1.10, bri: 1.00, hue: 38,  tint: ['#00e5c7', '#0057ff'], tintAlpha: 0.22 },
  noir:     { name: 'Noir Pop',       sat: 0.12, con: 1.38, bri: 1.02, hue: 0,   tint: ['#ffffff', '#111111'], tintAlpha: 0.10 },
};

export const CAPTION_STYLES = {
  gloss:  { name: 'Sunset Gloss', fill: ['#ffe259', '#ff7e5f', '#ff2e63'], outline: '#1b0b2e', shadow: '#ff2e63' },
  chrome: { name: 'Dusk Chrome',  fill: ['#ffffff', '#c9d6ff', '#7b8cff'], outline: '#0d0d1a', shadow: '#00e5ff' },
  neon:   { name: 'Neon Tube',    fill: ['#aefcff', '#00e5ff', '#0090ff'], outline: '#12002e', shadow: '#00e5ff' },
  block:  { name: 'Poster Block', fill: ['#ffffff', '#ffffff', '#ffe259'], outline: '#111111', shadow: '#ffd166' },
};

export const LAYOUTS = {
  mosaic:    { name: 'Mosaic 6',      panels: 6 },
  hero:      { name: 'Hero + Strip',  panels: 5 },
  triptych:  { name: 'Triptych',      panels: 3 },
  polaroids: { name: 'Polaroids',     panels: 5 },
  wanted:    { name: 'Wanted',        panels: 3 },
  fullbleed: { name: 'Full Bleed',    panels: 1 },
};

// Seeded random so barcode, skyline and grain are identical on every run.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let noiseTile = null;
export function getNoiseTile() {
  if (noiseTile) return noiseTile;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  const img = g.createImageData(128, 128);
  const rnd = mulberry32(20261119);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rnd() * 255);
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  noiseTile = c;
  return c;
}

// ---- procedural Vice City sunset: gradient sky, sliced sun, grid, palms, skyline ----
export function drawSunset(ctx, x, y, w, h, style) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const horizon = y + h * 0.62;
  const sky = ctx.createLinearGradient(0, y, 0, horizon);
  sky.addColorStop(0, '#1d0b3d'); sky.addColorStop(0.45, '#7b1e6e');
  sky.addColorStop(0.75, '#ff2e63'); sky.addColorStop(1, '#ff9a3c');
  ctx.fillStyle = sky; ctx.fillRect(x, y, w, horizon - y + 1);
  const ground = ctx.createLinearGradient(0, horizon, 0, y + h);
  ground.addColorStop(0, '#ff7b39'); ground.addColorStop(1, '#12041f');
  ctx.fillStyle = ground; ctx.fillRect(x, horizon, w, y + h - horizon);
  // sliced sun
  const sunR = Math.min(w, h) * 0.30;
  const sunX = x + w * 0.5, sunY = horizon - sunR * 0.28;
  const sun = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
  sun.addColorStop(0, '#fff3a3'); sun.addColorStop(0.55, '#ffb347'); sun.addColorStop(1, '#ff2e63');
  ctx.fillStyle = sun;
  ctx.beginPath(); ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2); ctx.fill();
  // slice the lower half away in widening sky-coloured bands
  ctx.fillStyle = '#ff7b39';
  let bandY = sunY + sunR * 0.05, bandH = Math.max(2, h * 0.006);
  while (bandY < sunY + sunR) {
    ctx.fillRect(sunX - sunR - 1, bandY, sunR * 2 + 2, bandH);
    bandY += bandH + Math.max(3, h * 0.012); bandH *= 1.45;
  }
  if (style === 'grid' || style === 'skyline') {
    // synthwave perspective grid below the horizon
    ctx.strokeStyle = style === 'grid' ? 'rgba(0,229,255,0.85)' : 'rgba(0,229,255,0.45)';
    ctx.lineWidth = Math.max(1, w * 0.0016);
    const vx = x + w * 0.5;
    for (let i = -8; i <= 8; i++) {
      ctx.beginPath(); ctx.moveTo(vx + i * w * 0.03, horizon);
      ctx.lineTo(vx + i * w * 0.22, y + h); ctx.stroke();
    }
    let gy = horizon, step = Math.max(3, h * 0.012);
    while (gy < y + h) {
      ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke();
      gy += step; step *= 1.55;
    }
  }
  if (style === 'palms' || style === 'grid') drawPalmRow(ctx, x, y, w, h, horizon);
  drawSkyline(ctx, x, horizon - h * 0.055, w, h * 0.055, '#160428');
  ctx.restore();
}

export function drawSkyline(ctx, x, y, w, h, color) {
  const rnd = mulberry32(77);
  ctx.fillStyle = color;
  let bx = x;
  while (bx < x + w) {
    const bw = w * (0.03 + rnd() * 0.05);
    const bh = h * (0.35 + rnd() * 0.65);
    ctx.fillRect(bx, y + h - bh, bw, bh);
    if (rnd() > 0.72) ctx.fillRect(bx + bw * 0.4, y + h - bh - h * 0.22, Math.max(1, bw * 0.12), h * 0.22);
    bx += bw + w * 0.004;
  }
}

export function drawPalmRow(ctx, x, y, w, h, horizon) {
  ctx.fillStyle = '#14031f';
  ctx.strokeStyle = '#14031f';
  const spots = [[x + w * 0.06, 1.0], [x + w * 0.93, 1.15], [x + w * 0.16, 0.8]];
  for (const [px, s] of spots) {
    const th = h * 0.34 * s, tw = Math.max(3, w * 0.006 * s);
    ctx.lineWidth = tw; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(px, horizon + 2);
    ctx.quadraticCurveTo(px + w * 0.012 * s, horizon - th * 0.6, px + w * 0.03 * s, horizon - th);
    ctx.stroke();
    const topX = px + w * 0.03 * s, topY = horizon - th;
    for (let f = 0; f < 7; f++) {
      const a = (-Math.PI * 0.15) - (f / 6) * Math.PI * 0.75;
      const len = w * 0.055 * s * (0.75 + ((f * 37) % 10) / 40);
      ctx.lineWidth = Math.max(2, tw * 0.55);
      ctx.beginPath(); ctx.moveTo(topX, topY);
      ctx.quadraticCurveTo(
        topX + Math.cos(a) * len * 0.6, topY + Math.sin(a) * len * 0.55 + h * 0.02,
        topX + Math.cos(a) * len, topY + Math.sin(a) * len + h * 0.05);
      ctx.stroke();
    }
  }
}

// Layout geometry in fractions of the cover. Returns panels + caption placement.
export function layoutGeometry(layout, W, H) {
  const g = 0.012; // panel gap as a fraction of width
  const bandY = 0.80, bandH = 0.18;
  switch (layout) {
    case 'mosaic': return { bg: 'sunset', caption: { mode: 'band', y: bandY, h: bandH }, panels: [
      { x: 0.02, y: 0.02, w: 0.50, h: 0.55 },
      { x: 0.54, y: 0.02, w: 0.215, h: 0.265 }, { x: 0.767, y: 0.02, w: 0.213, h: 0.265 },
      { x: 0.54, y: 0.297, w: 0.215, h: 0.265 }, { x: 0.767, y: 0.297, w: 0.213, h: 0.265 },
      { x: 0.02, y: 0.59, w: 0.96, h: 0.185 } ] };
    case 'hero': return { bg: 'sunset', caption: { mode: 'band', y: bandY, h: bandH }, panels: [
      { x: 0.02, y: 0.02, w: 0.96, h: 0.52 },
      { x: 0.02, y: 0.56, w: 0.2325, h: 0.20 }, { x: 0.2625, y: 0.56, w: 0.2325, h: 0.20 },
      { x: 0.505, y: 0.56, w: 0.2325, h: 0.20 }, { x: 0.7475, y: 0.56, w: 0.2325, h: 0.20 } ] };
    case 'triptych': return { bg: 'sunset', caption: { mode: 'band', y: bandY, h: bandH }, panels: [
      { x: 0.02, y: 0.02, w: 0.3067, h: 0.76 },
      { x: 0.3467, y: 0.02, w: 0.3067, h: 0.76 },
      { x: 0.6733, y: 0.02, w: 0.3067, h: 0.76 } ] };
    case 'polaroids': return { bg: 'sunset', caption: { mode: 'band', y: 0.80, h: 0.18 }, panels: [
      { x: 0.04, y: 0.04, w: 0.28, h: 0.40, rot: -5, polaroid: true },
      { x: 0.36, y: 0.02, w: 0.28, h: 0.40, rot: 3, polaroid: true },
      { x: 0.68, y: 0.05, w: 0.28, h: 0.40, rot: -3, polaroid: true },
      { x: 0.16, y: 0.44, w: 0.28, h: 0.33, rot: 4, polaroid: true },
      { x: 0.55, y: 0.45, w: 0.28, h: 0.33, rot: -4, polaroid: true } ] };
    case 'wanted': return { bg: 'sunburst', caption: { mode: 'band', y: bandY, h: bandH }, panels: [
      { x: 0.30, y: 0.05, w: 0.40, h: 0.55, frame: true },
      { x: 0.05, y: 0.62, w: 0.22, h: 0.15, exhibit: 'EXHIBIT A' },
      { x: 0.73, y: 0.62, w: 0.22, h: 0.15, exhibit: 'EXHIBIT B' } ] };
    case 'fullbleed': return { bg: 'plain', caption: { mode: 'across', y: 0.58, h: 0.34 }, panels: [
      { x: 0, y: 0, w: 1, h: 1 } ] };
    default: return layoutGeometry('mosaic', W, H);
  }
}

function gradeFilter(grade, strength, contrast) {
  const g = GRADES[grade] || GRADES.sunset;
  const k = Math.max(0, Math.min(1, strength / 100));
  const sat = 1 + (g.sat - 1) * k;
  const con = (1 + (g.con - 1) * k) * (1 + contrast / 100);
  const bri = 1 + (g.bri - 1) * k;
  return `saturate(${sat.toFixed(3)}) contrast(${con.toFixed(3)}) brightness(${bri.toFixed(3)}) hue-rotate(${Math.round(g.hue * k)}deg)`;
}

// Posterize an ImageData in place: fewer levels = flatter comic tones.
function posterizeImageData(img, levels) {
  const d = img.data, step = 255 / (levels - 1);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = Math.round(d[i] / step) * step;
    d[i + 1] = Math.round(d[i + 1] / step) * step;
    d[i + 2] = Math.round(d[i + 2] / step) * step;
  }
}

// Selective colour pop: keep one hue family saturated, drain the rest.
function colorPopImageData(img, hueTarget, strength) {
  const d = img.data, k = strength / 100;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0;
    if (max !== min) {
      if (max === r) h = ((g - b) / (max - min)) * 60;
      else if (max === g) h = (2 + (b - r) / (max - min)) * 60;
      else h = (4 + (r - g) / (max - min)) * 60;
    }
    if (h < 0) h += 360;
    let dist = Math.abs(h - hueTarget);
    if (dist > 180) dist = 360 - dist;
    const keep = dist < 42 ? 1 : (dist > 75 ? 0 : 1 - (dist - 42) / 33);
    const drain = (1 - keep) * k;
    if (drain > 0) {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = d[i] * (1 - drain) + lum * drain;
      d[i + 1] = d[i + 1] * (1 - drain) + lum * drain;
      d[i + 2] = d[i + 2] * (1 - drain) + lum * drain;
    }
  }
}

const POP_HUES = { pink: 330, cyan: 190, gold: 45 };

// Render one panel photo (with its own grade, posterize, colour pop) to an offscreen canvas.
export function renderPanelImage(img, pw, ph, panel, state) {
  const scale = Math.min(1, 900 / Math.max(pw, ph));
  const cw = Math.max(2, Math.round(pw * scale)), ch = Math.max(2, Math.round(ph * scale));
  const c = document.createElement('canvas');
  c.width = cw; c.height = ch;
  const g = c.getContext('2d');
  const gradeId = panel.grade || state.grade;
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const zoom = panel.zoom || 1;
  const fit = Math.max(cw / iw, ch / ih) * zoom;
  const dw = iw * fit, dh = ih * fit;
  const dx = (cw - dw) / 2 + (panel.ox || 0) * cw;
  const dy = (ch - dh) / 2 + (panel.oy || 0) * ch;
  g.save();
  if (panel.flip) { g.translate(cw, 0); g.scale(-1, 1); }
  g.filter = gradeFilter(gradeId, state.gradeStrength, state.contrast);
  g.drawImage(img, dx, dy, dw, dh);
  g.restore();
  g.filter = 'none';
  // grade tint wash
  const gr = GRADES[gradeId] || GRADES.sunset;
  const tint = g.createLinearGradient(0, 0, cw, ch);
  tint.addColorStop(0, gr.tint[0]); tint.addColorStop(1, gr.tint[1]);
  g.globalCompositeOperation = 'overlay';
  g.globalAlpha = gr.tintAlpha * (state.gradeStrength / 100);
  g.fillStyle = tint; g.fillRect(0, 0, cw, ch);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  // colour pop + posterize (pixel passes on the small offscreen — fast enough)
  if (state.colorPop && state.colorPop !== 'none') {
    const id = g.getImageData(0, 0, cw, ch);
    colorPopImageData(id, POP_HUES[state.colorPop], state.popStrength ?? 60);
    g.putImageData(id, 0, 0);
  }
  if ((state.posterInk || 0) > 0) {
    const levels = Math.max(3, Math.round(9 - (state.posterInk / 100) * 6));
    const id = g.getImageData(0, 0, cw, ch);
    posterizeImageData(id, levels);
    g.putImageData(id, 0, 0);
  }
  if (state.halftone) {
    const dot = Math.max(3, Math.round(cw / 160));
    g.globalAlpha = 0.10 + (state.posterInk || 0) / 1000;
    g.fillStyle = '#1b0b2e';
    for (let yy = dot; yy < ch; yy += dot * 2) {
      for (let xx = dot; xx < cw; xx += dot * 2) {
        g.beginPath(); g.arc(xx, yy, dot * 0.32, 0, Math.PI * 2); g.fill();
      }
    }
    g.globalAlpha = 1;
  }
  return c;
}

function drawPanelBorder(ctx, x, y, w, h, selected) {
  ctx.save();
  ctx.lineWidth = Math.max(2, w * 0.008);
  ctx.strokeStyle = selected ? '#00e5ff' : 'rgba(255,255,255,0.85)';
  if (selected) ctx.setLineDash([Math.max(6, w * 0.02), Math.max(4, w * 0.012)]);
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

function drawStarburst(ctx, cx, cy, r, text, sub) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  const spikes = 14;
  for (let i = 0; i < spikes * 2; i++) {
    const rr = i % 2 === 0 ? r : r * 0.72;
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = '#ffd166'; ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.06); ctx.strokeStyle = '#1b0b2e'; ctx.stroke();
  ctx.fillStyle = '#1b0b2e'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `900 ${r * 0.42}px Anton, sans-serif`;
  ctx.fillText(text, 0, -r * 0.12);
  if (sub) { ctx.font = `700 ${r * 0.26}px Oswald, sans-serif`; ctx.fillText(sub, 0, r * 0.30); }
  ctx.restore();
}

function drawBarcode(ctx, x, y, w, h) {
  const rnd = mulberry32(4242);
  ctx.save(); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - w * 0.05, y - h * 0.15, w * 1.1, h * 1.5);
  ctx.fillStyle = '#111111';
  let bx = x;
  while (bx < x + w) {
    const bw = Math.max(1, w * (0.008 + rnd() * 0.03));
    if (rnd() > 0.4) ctx.fillRect(bx, y, bw, h);
    bx += bw + w * 0.006;
  }
  ctx.font = `${Math.max(8, h * 0.28)}px Oswald, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('8 2026 11 19 01', x + w / 2, y + h * 1.08);
  ctx.restore();
}

function drawRibbon(ctx, W, H) {
  ctx.save();
  ctx.translate(W * 0.02, H * 0.085);
  ctx.rotate(-0.06);
  ctx.fillStyle = '#ff2e63';
  ctx.fillRect(0, 0, W * 0.34, Math.max(18, W * 0.028));
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${Math.max(10, W * 0.016)}px Oswald, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('O R I G I N A L   ·   F A N   M A D E', W * 0.17, Math.max(9, W * 0.014));
  ctx.restore();
}

function gradientTitle(ctx, text, cx, y, size, style, align = 'center') {
  const st = CAPTION_STYLES[style] || CAPTION_STYLES.gloss;
  ctx.save();
  ctx.font = `${size}px Anton, sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  const tw = ctx.measureText(text).width;
  const x0 = align === 'center' ? cx - tw / 2 : cx;
  const grad = ctx.createLinearGradient(x0, y - size * 0.85, x0 + tw, y + size * 0.1);
  grad.addColorStop(0, st.fill[0]); grad.addColorStop(0.55, st.fill[1]); grad.addColorStop(1, st.fill[2]);
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, size * 0.14);
  ctx.strokeStyle = st.outline;
  ctx.shadowColor = st.shadow; ctx.shadowBlur = size * 0.25; ctx.shadowOffsetY = size * 0.05;
  ctx.strokeText(text, cx, y);
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.fillStyle = grad;
  ctx.fillText(text, cx, y);
  ctx.restore();
  return tw;
}

// The main draw: state + loaded images -> a finished cover on ctx.
export function drawCover(ctx, W, H, state, images, opts = {}) {
  const raw = !!opts.raw;
  const selected = opts.selected ?? -1;
  const geo = layoutGeometry(state.layout, W, H);
  ctx.clearRect(0, 0, W, H);
  // backdrop
  if (raw) {
    ctx.fillStyle = '#101022'; ctx.fillRect(0, 0, W, H);
  } else if (geo.bg === 'sunburst') {
    const rnd = mulberry32(99);
    ctx.fillStyle = '#2a0a3d'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(W / 2, H * 0.42);
    for (let i = 0; i < 24; i++) {
      ctx.fillStyle = i % 2 ? '#ff9a3c' : '#ff2e63';
      ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.moveTo(0, 0);
      const a = (i / 24) * Math.PI * 2;
      ctx.lineTo(Math.cos(a - 0.1) * W, Math.sin(a - 0.1) * W);
      ctx.lineTo(Math.cos(a + 0.1) * W, Math.sin(a + 0.1) * W);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore(); ctx.globalAlpha = 1;
  } else if (state.sunset && state.sunset.on && !raw) {
    drawSunset(ctx, 0, 0, W, H, state.sunset.style || 'grid');
  } else {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1d0b3d'); bg.addColorStop(1, '#0a0618');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  }
  // panels
  const photoFor = (i) => {
    const p = state.panels[i];
    return p && p.photo ? p.photo : SAMPLE_PHOTOS[i % SAMPLE_PHOTOS.length].id;
  };
  geo.panels.forEach((rect, i) => {
    const px = rect.x * W, py = rect.y * H, pw = rect.w * W, ph = rect.h * H;
    const panel = state.panels[i] || { photo: photoFor(i), zoom: 1, ox: 0, oy: 0, flip: false, grade: null };
    const img = images.get(panel.photo);
    ctx.save();
    ctx.translate(px + pw / 2, py + ph / 2);
    if (rect.rot) ctx.rotate((rect.rot * Math.PI) / 180);
    ctx.translate(-pw / 2, -ph / 2);
    if (rect.polaroid) {
      ctx.fillStyle = '#fdfdf6';
      ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = W * 0.012; ctx.shadowOffsetY = H * 0.008;
      ctx.fillRect(0, 0, pw, ph);
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      const ix = pw * 0.045, iy = ph * 0.05, iw = pw * 0.91, ih = ph * 0.72;
      if (img) {
        if (raw) ctx.drawImage(img, ix, iy, iw, ih);
        else { const pc = renderPanelImage(img, iw, ih, panel, state); ctx.drawImage(pc, ix, iy, iw, ih); }
      }
      ctx.fillStyle = '#333333';
      ctx.font = `${Math.max(9, ph * 0.055)}px Pacifico, cursive`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const cap = (SAMPLE_PHOTOS.find((s) => s.id === panel.photo) || {}).name || 'Solmar Bay';
      ctx.fillText(cap, pw / 2, ph * 0.885);
    } else {
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, pw, ph); ctx.clip();
      if (img) {
        if (raw) {
          const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
          const fit = Math.max(pw / iw, ph / ih);
          ctx.drawImage(img, (pw - iw * fit) / 2, (ph - ih * fit) / 2, iw * fit, ih * fit);
        } else {
          const pc = renderPanelImage(img, pw, ph, panel, state);
          ctx.drawImage(pc, 0, 0, pw, ph);
        }
      } else {
        ctx.fillStyle = '#2a1445'; ctx.fillRect(0, 0, pw, ph);
      }
      ctx.restore();
      if (rect.frame) {
        ctx.lineWidth = Math.max(3, W * 0.006); ctx.strokeStyle = '#f5e9c8';
        ctx.strokeRect(-W * 0.008, -H * 0.008, pw + W * 0.016, ph + H * 0.016);
      }
      if (rect.exhibit) {
        ctx.fillStyle = 'rgba(245,233,200,0.92)';
        ctx.fillRect(0, ph - H * 0.035, pw, H * 0.035);
        ctx.fillStyle = '#1b0b2e';
        ctx.font = `700 ${Math.max(9, H * 0.016)}px Oswald, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(rect.exhibit, pw / 2, ph - H * 0.017);
      }
    }
    drawPanelBorder(ctx, 0, 0, pw, ph, selected === i);
    ctx.restore();
  });
  if (raw) return;
  // caption
  const cap = state.caption;
  const band = geo.caption;
  const titleSize = Math.round(H * 0.115 * (cap.size / 100));
  if (band.mode === 'band') {
    const by = band.y * H, bh = band.h * H;
    if (state.sunset && state.sunset.on) {
      drawSunset(ctx, 0, by, W, bh, 'skyline');
      ctx.fillStyle = 'rgba(10,4,24,0.35)'; ctx.fillRect(0, by, W, bh);
    } else {
      const bg = ctx.createLinearGradient(0, by, 0, by + bh);
      bg.addColorStop(0, '#2a0a3d'); bg.addColorStop(1, '#12041f');
      ctx.fillStyle = bg; ctx.fillRect(0, by, W, bh);
    }
    drawSkyline(ctx, 0, by, W, bh * 0.22, 'rgba(10,4,24,0.85)');
    const bandTitleSize = Math.min(Math.round(H * 0.085 * (cap.size / 100)), Math.round(bh * 0.42));
    // kicker pill
    ctx.font = `700 ${Math.max(10, H * 0.018)}px Oswald, sans-serif`;
    const kw = ctx.measureText(cap.kicker).width + W * 0.03;
    const kx = W / 2 - kw / 2, ky = by + bh * 0.05;
    ctx.fillStyle = '#ff2e63';
    roundRect(ctx, kx, ky, kw, bh * 0.16, bh * 0.08); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(cap.kicker, W / 2, ky + bh * 0.08);
    gradientTitle(ctx, cap.title, W / 2, by + bh * 0.60, bandTitleSize, cap.style);
    ctx.font = `${Math.max(12, H * 0.032)}px Pacifico, cursive`;
    ctx.fillStyle = '#7df9ff';
    ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = H * 0.012;
    ctx.fillText(cap.script, W / 2, by + bh * 0.82);
    ctx.shadowBlur = 0;
    ctx.font = `600 ${Math.max(9, H * 0.015)}px Oswald, sans-serif`;
    try { ctx.letterSpacing = `${Math.max(2, W * 0.004)}px`; } catch (e) {}
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(cap.tagline, W / 2, by + bh * 0.95);
    try { ctx.letterSpacing = '0px'; } catch (e) {}
  } else {
    // title across the art
    const cy = band.y * H;
    const strip = ctx.createLinearGradient(0, cy - titleSize, 0, cy + titleSize * 1.5);
    strip.addColorStop(0, 'rgba(10,4,24,0)'); strip.addColorStop(0.5, 'rgba(10,4,24,0.55)'); strip.addColorStop(1, 'rgba(10,4,24,0)');
    ctx.fillStyle = strip; ctx.fillRect(0, cy - titleSize, W, titleSize * 2.5);
    ctx.font = `700 ${Math.max(10, H * 0.02)}px Oswald, sans-serif`;
    ctx.fillStyle = '#ff2e63';
    const kw = ctx.measureText(cap.kicker).width + W * 0.03;
    roundRect(ctx, W / 2 - kw / 2, cy - titleSize * 0.95, kw, H * 0.035, H * 0.017); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(cap.kicker, W / 2, cy - titleSize * 0.95 + H * 0.0175);
    gradientTitle(ctx, cap.title, W / 2, cy + titleSize * 0.35, titleSize, cap.style);
    ctx.font = `${Math.max(12, H * 0.038)}px Pacifico, cursive`;
    ctx.fillStyle = '#7df9ff';
    ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = H * 0.012;
    ctx.fillText(cap.script, W / 2, cy + titleSize * 0.95);
    ctx.shadowBlur = 0;
    ctx.font = `600 ${Math.max(9, H * 0.016)}px Oswald, sans-serif`;
    try { ctx.letterSpacing = `${Math.max(2, W * 0.004)}px`; } catch (e) {}
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(cap.tagline, W / 2, cy + titleSize * 1.25);
    try { ctx.letterSpacing = '0px'; } catch (e) {}
  }
  // badges
  if (state.badges.ribbon) drawRibbon(ctx, W, H);
  if (state.badges.est) drawStarburst(ctx, W * 0.90, H * 0.13, Math.min(W, H) * 0.055, 'EST.', '2026');
  if (state.badges.heat) {
    ctx.save();
    ctx.font = `700 ${Math.max(11, H * 0.022)}px Oswald, sans-serif`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#111111';
    const label = 'HEAT ';
    const lw = ctx.measureText(label).width;
    roundRect(ctx, W * 0.02, H * 0.02, lw + H * 0.115 + W * 0.02, H * 0.045, H * 0.022); ctx.fillStyle = '#ffd166'; ctx.fill();
    ctx.fillStyle = '#1b0b2e';
    ctx.fillText(label, W * 0.02 + W * 0.008, H * 0.0435);
    const stars = '★'.repeat(state.badges.heat) + '☆'.repeat(5 - state.badges.heat);
    ctx.fillStyle = '#ff2e63';
    ctx.fillText(stars, W * 0.02 + W * 0.008 + lw, H * 0.0435);
    ctx.restore();
  }
  if (state.badges.barcode) drawBarcode(ctx, W * 0.88, H * 0.955, W * 0.09, H * 0.02);
  // grain + vignette over the whole cover
  if (state.grain) {
    ctx.save(); ctx.globalAlpha = 0.05;
    ctx.fillStyle = ctx.createPattern(getNoiseTile(), 'repeat');
    ctx.fillRect(0, 0, W, H); ctx.restore();
  }
  if (state.vignette) {
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(10,4,24,0.42)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
