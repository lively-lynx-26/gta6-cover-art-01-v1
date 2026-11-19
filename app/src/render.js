// render.js — cover rendering engine for Solmar Bay Cover Studio.
// Pure canvas drawing: colour grades, posterize, halftone, grain, the drawn
// Vice City sunset layer, multi-panel layouts, captions and badges.
// Nothing here touches the network; every pixel is drawn from local files.

export const GRADES = {
  vice:    { name: 'Vice Sunset',     mul: [1.10, 0.96, 1.04], shadow: [20, 0, 30],  duo: null },
  neon:    { name: 'Neon Night',      mul: [0.94, 1.00, 1.14], shadow: [10, 0, 34],  duo: null },
  golden:  { name: 'Golden Hour',     mul: [1.14, 1.03, 0.82], shadow: [16, 6, 0],   duo: null },
  flamingo:{ name: 'Flamingo Duotone',mul: [1.00, 1.00, 1.00], shadow: [0, 0, 0],    duo: [[255, 46, 136], [255, 179, 71]] },
  teal:    { name: 'Teal Tide',       mul: [1.00, 1.00, 1.00], shadow: [0, 0, 0],    duo: [[4, 42, 51], [55, 230, 200]] },
  noir:    { name: 'Noir Pop',        mul: [1.00, 1.00, 1.00], shadow: [0, 0, 0],    duo: null, noir: true },
};

export const POP_HUES = { none: -1, pink: 330, cyan: 190, gold: 45 };

export const LAYOUTS = {
  mosaic6:   { name: 'Mosaic 6',      panels: 6 },
  heroStrip: { name: 'Hero + Strip',  panels: 5 },
  triptych:  { name: 'Triptych',      panels: 3 },
  polaroids: { name: 'Polaroids',     panels: 5 },
  wanted:    { name: 'Wanted',        panels: 1 },
  fullbleed: { name: 'Full Bleed',    panels: 1 },
};

export const CAPTION_STYLES = {
  sunset: { name: 'Sunset Gloss', grad: ['#ff5e8a', '#ff9a3d', '#ffd319'], stroke: '#2b0a1e', script: '#ff7ad9', scriptGlow: '#ff2e88' },
  chrome: { name: 'Dusk Chrome',  grad: ['#ffffff', '#c9d2e0', '#7d8aa5'], stroke: '#101828', script: '#5ff2ff', scriptGlow: '#22b8ff' },
  neon:   { name: 'Neon Tube',    grad: ['#ffffff', '#ffffff', '#ffe9f6'], stroke: '#ff2e88', script: '#5ff2ff', scriptGlow: '#ff2e88' },
  block:  { name: 'Poster Block', grad: ['#ffd319', '#ffd319', '#ff9a3d'], stroke: '#12041f', script: '#ffffff', scriptGlow: '#ff2e88' },
};

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(2, Math.round(w));
  c.height = Math.max(2, Math.round(h));
  return c;
}

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

// --- photo grading ---------------------------------------------------------
// Grade one photo into a fresh canvas. `opts` carries grade, strength,
// contrast, posterInk (0..1), colorPop ('none'|'pink'|'cyan'|'gold') and
// popStrength. maxSide caps the working resolution (preview vs export).
export function gradePhoto(img, opts, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(2, Math.round(img.naturalWidth * scale));
  const h = Math.max(2, Math.round(img.naturalHeight * scale));
  const cv = makeCanvas(w, h);
  const ctx = cv.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const g = GRADES[opts.grade] || GRADES.vice;
  const s = opts.strength == null ? 0.8 : opts.strength;
  const contrast = opts.contrast == null ? 1.08 : opts.contrast;
  const ink = opts.posterInk == null ? 0.65 : opts.posterInk;
  const popHue = POP_HUES[opts.colorPop] ?? -1;
  const popS = opts.popStrength == null ? 0.8 : opts.popStrength;
  const data = ctx.getImageData(0, 0, w, h);
  const d = data.data;
  const levels = 6;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], gg = d[i + 1], b = d[i + 2];
    const lum = 0.299 * r + 0.587 * gg + 0.114 * b;
    // contrast around mid-grey
    r = (r - 128) * contrast + 128;
    gg = (gg - 128) * contrast + 128;
    b = (b - 128) * contrast + 128;
    if (g.noir) {
      const v = clamp(lum * 1.12, 0, 255);
      r = v; gg = v; b = clamp(v * 1.06, 0, 255);
    } else if (g.duo) {
      const t = lum / 255;
      const dr = lerp(g.duo[0][0], g.duo[1][0], t);
      const dg = lerp(g.duo[0][1], g.duo[1][1], t);
      const db = lerp(g.duo[0][2], g.duo[1][2], t);
      r = lerp(r, dr, s); gg = lerp(gg, dg, s); b = lerp(b, db, s);
    } else {
      r = lerp(r, r * g.mul[0], s);
      gg = lerp(gg, gg * g.mul[1], s);
      b = lerp(b, b * g.mul[2], s);
      const dark = (1 - lum / 255) * s;
      r += g.shadow[0] * dark; gg += g.shadow[1] * dark; b += g.shadow[2] * dark;
    }
    // posterize: quantise each channel toward a few flat levels
    if (ink > 0) {
      const q = (v) => Math.round(clamp(v, 0, 255) / 255 * (levels - 1)) / (levels - 1) * 255;
      r = lerp(r, q(r), ink); gg = lerp(gg, q(gg), ink); b = lerp(b, q(b), ink);
    }
    // colour pop: keep one neon hue, drain the rest toward grey
    if (popHue >= 0 && popS > 0) {
      const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
      if (mx > 24) {
        let hue;
        if (mx === r) hue = 60 * (((gg - b) / (mx - mn || 1)) % 6);
        else if (mx === gg) hue = 60 * ((b - r) / (mx - mn || 1) + 2);
        else hue = 60 * ((r - gg) / (mx - mn || 1) + 4);
        if (hue < 0) hue += 360;
        let dd = Math.abs(hue - popHue);
        if (dd > 180) dd = 360 - dd;
        const keep = dd < 28 ? 1 : dd > 62 ? 0 : 1 - (dd - 28) / 34;
        const grey = lum;
        const k = 1 - (1 - keep) * popS;
        r = lerp(grey, r, k); gg = lerp(grey, gg, k); b = lerp(grey, b, k);
      }
    }
    d[i] = clamp(r, 0, 255); d[i + 1] = clamp(gg, 0, 255); d[i + 2] = clamp(b, 0, 255);
  }
  ctx.putImageData(data, 0, 0);
  return cv;
}

// --- drawn sunset -----------------------------------------------------------
function drawPalm(ctx, x, y, s, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, s * 0.06); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + s * 0.08, y - s * 0.55, x + s * 0.02, y - s * 0.95); ctx.stroke();
  const tx = x + s * 0.02, ty = y - s * 0.95;
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * (0.08 + i * 0.14);
    const ex = tx + Math.cos(a) * s * 0.52, ey = ty + Math.sin(a) * s * 0.34 + s * 0.22;
    ctx.beginPath(); ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(tx + Math.cos(a) * s * 0.3, ty + Math.sin(a) * s * 0.22 - s * 0.08, ex, ey);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSkyline(ctx, x, y, w, h, color) {
  ctx.save(); ctx.fillStyle = color;
  let bx = x;
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  while (bx < x + w) {
    const bw = w * (0.03 + rnd() * 0.05);
    const bh = h * (0.3 + rnd() * 0.7);
    ctx.fillRect(bx, y + h - bh, bw, bh);
    ctx.fillStyle = '#ffd319';
    for (let k = 0; k < 3; k++) {
      if (rnd() > 0.55) ctx.fillRect(bx + bw * (0.2 + rnd() * 0.6), y + h - bh + bh * (0.15 + rnd() * 0.6), 2, 2);
    }
    ctx.fillStyle = color;
    bx += bw + w * 0.008;
  }
  ctx.restore();
}

// Draw a Vice City sunset: gradient sky, sliced sun, synthwave grid horizon,
// palm + skyline silhouettes. `style` is 'vice' | 'neon' | 'synth'.
export function drawSunset(ctx, x, y, w, h, style) {
  ctx.save();
  const sky = ctx.createLinearGradient(x, y, x, y + h);
  if (style === 'neon') {
    sky.addColorStop(0, '#05081f'); sky.addColorStop(0.45, '#3b1d8f');
    sky.addColorStop(0.75, '#c2187a'); sky.addColorStop(1, '#37e6ff');
  } else if (style === 'synth') {
    sky.addColorStop(0, '#12022e'); sky.addColorStop(0.5, '#5b0a6e');
    sky.addColorStop(0.8, '#ff2e88'); sky.addColorStop(1, '#ffb347');
  } else {
    sky.addColorStop(0, '#2b0a4e'); sky.addColorStop(0.45, '#a4137a');
    sky.addColorStop(0.75, '#ff2e63'); sky.addColorStop(1, '#ff9a3d');
  }
  ctx.fillStyle = sky; ctx.fillRect(x, y, w, h);
  // sliced sun on its own layer so the slices cut cleanly
  const sunR = h * 0.34;
  const cx = x + w * 0.5, cy = y + h * 0.60;
  const sun = makeCanvas(sunR * 2 + 4, sunR * 2 + 4);
  const sctx = sun.getContext('2d');
  const sg = sctx.createLinearGradient(0, 0, 0, sun.height);
  sg.addColorStop(0, '#ffe95e'); sg.addColorStop(0.55, '#ff9a3d'); sg.addColorStop(1, '#ff2975');
  sctx.fillStyle = sg;
  sctx.beginPath(); sctx.arc(sun.width / 2, sun.height / 2, sunR, 0, Math.PI * 2); sctx.fill();
  sctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 6; i++) {
    const sy = sun.height / 2 + (i * sunR) / 7;
    sctx.fillRect(0, sy, sun.width, 2 + i * 1.6);
  }
  ctx.drawImage(sun, cx - sun.width / 2, cy - sun.height / 2);
  // synthwave grid below the horizon
  const horizon = y + h * 0.66;
  ctx.strokeStyle = style === 'neon' ? 'rgba(95,242,255,0.55)' : 'rgba(255,120,220,0.5)';
  ctx.lineWidth = Math.max(1, w * 0.0016);
  ctx.beginPath();
  for (let i = -8; i <= 8; i++) {
    ctx.moveTo(cx + i * w * 0.02, horizon);
    ctx.lineTo(cx + i * w * 0.22, y + h);
  }
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const gy = horizon + (h - horizon) * Math.pow(i / 6, 1.7);
    ctx.moveTo(x, gy); ctx.lineTo(x + w, gy);
  }
  ctx.stroke();
  // silhouettes along the bottom edge (kept short so the tagline above stays clear)
  drawSkyline(ctx, x, y + h * 0.90, w, h * 0.10, '#160a2e');
  drawPalm(ctx, x + w * 0.06, y + h * 0.99, h * 0.42, '#160a2e');
  drawPalm(ctx, x + w * 0.93, y + h * 0.99, h * 0.36, '#160a2e');
  ctx.restore();
}

function drawSunburst(ctx, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = '#f7e8c8'; ctx.fillRect(x, y, w, h);
  const cx = x + w / 2, cy = y + h * 0.42, R = Math.hypot(w, h);
  for (let i = 0; i < 24; i++) {
    if (i % 2) continue;
    ctx.fillStyle = '#eec25e';
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, (i / 24) * Math.PI * 2, ((i + 1) / 24) * Math.PI * 2);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// --- layout geometry --------------------------------------------------------
export function layoutPanels(layout, W, H) {
  const g = Math.round(Math.min(W, H) * 0.008) + 3; // gutter
  const panels = [];
  if (layout === 'mosaic6') {
    const cw = (W - g * 4) / 3, ch = (H - g * 3) / 2;
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++)
      panels.push({ x: g + c * (cw + g), y: g + r * (ch + g), w: cw, h: ch });
  } else if (layout === 'heroStrip') {
    const hh = H * 0.58 - g;
    panels.push({ x: g, y: g, w: W - g * 2, h: hh });
    const sw = (W - g * 5) / 4, sy = g + hh + g, sh = H - sy - g;
    for (let i = 0; i < 4; i++) panels.push({ x: g + i * (sw + g), y: sy, w: sw, h: sh });
  } else if (layout === 'triptych') {
    const sw = (W - g * 4) / 3;
    for (let i = 0; i < 3; i++) panels.push({ x: g + i * (sw + g), y: g, w: sw, h: H - g * 2, slice: i });
  } else if (layout === 'polaroids') {
    const pw = W * 0.27, ph = H * 0.52;
    const spots = [
      { x: W * 0.04, y: H * 0.30, rot: -6 }, { x: W * 0.22, y: H * 0.22, rot: 3 },
      { x: W * 0.42, y: H * 0.30, rot: -2 }, { x: W * 0.60, y: H * 0.22, rot: 5 },
      { x: W * 0.72, y: H * 0.34, rot: -4 },
    ];
    for (const s of spots) panels.push({ x: s.x, y: s.y, w: pw, h: ph, rot: s.rot });
  } else if (layout === 'wanted') {
    panels.push({ x: W * 0.27, y: H * 0.30, w: W * 0.46, h: H * 0.44 });
  } else { // fullbleed
    panels.push({ x: 0, y: 0, w: W, h: H });
  }
  return panels;
}

// Source rectangle of a photo inside a panel, for a given crop. Exported so
// the editor can turn pointer drags into crop offsets with the same math.
export function panelSourceRect(graded, panel, crop) {
  const iw = graded.width, ih = graded.height;
  const pw = panel.w, ph = panel.h;
  let sx, sy, sw, sh;
  if (panel.slice != null) {
    sw = iw / 3; sh = sw * (ph / pw);
    sx = (panel.slice * iw) / 3;
    sy = clamp((ih - sh) / 2 + (crop.y || 0) * (ih - sh) / 2, 0, Math.max(0, ih - sh));
    if (sh > ih) { sh = ih; sy = 0; }
  } else {
    const scale = Math.max(pw / iw, ph / ih) * (crop.scale || 1);
    sw = pw / scale; sh = ph / scale;
    if (sw > iw) sw = iw;
    if (sh > ih) sh = ih;
    sx = clamp((iw - sw) / 2 + (crop.x || 0) * (iw - sw) / 2, 0, Math.max(0, iw - sw));
    sy = clamp((ih - sh) / 2 + (crop.y || 0) * (ih - sh) / 2, 0, Math.max(0, ih - sh));
  }
  return { sx, sy, sw, sh };
}

// --- photo drawing with crop -----------------------------------------------
function drawPanelPhoto(ctx, graded, panel, crop) {
  const { sx, sy, sw, sh } = panelSourceRect(graded, panel, crop);
  const pw = panel.w, ph = panel.h;
  ctx.save();
  ctx.translate(panel.x + pw / 2, panel.y + ph / 2);
  if (panel.rot) ctx.rotate((panel.rot * Math.PI) / 180);
  if (crop.flip) ctx.scale(-1, 1);
  ctx.drawImage(graded, sx, sy, sw, sh, -pw / 2, -ph / 2, pw, ph);
  ctx.restore();
}

// --- text helpers -----------------------------------------------------------
function fitFont(ctx, text, maxW, family, weight, startPx) {
  let px = startPx;
  ctx.font = `${weight} ${px}px ${family}`;
  while (px > 12 && ctx.measureText(text).width > maxW) {
    px *= 0.94;
    ctx.font = `${weight} ${px}px ${family}`;
  }
  return px;
}

function gradientText(ctx, text, x, y, colors, align) {
  const w = ctx.measureText(text).width;
  const x0 = align === 'center' ? x - w / 2 : x;
  const grad = ctx.createLinearGradient(x0, y - 60, x0, y + 10);
  colors.forEach((c, i) => grad.addColorStop(i / (colors.length - 1), c));
  ctx.fillStyle = grad;
  ctx.fillText(text, x, y);
}

function drawStars(ctx, x, y, size, filled, color) {
  ctx.save();
  ctx.fillStyle = color;
  for (let i = 0; i < 5; i++) {
    const cx = x + i * size * 1.25;
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      const r = k % 2 ? size * 0.42 : size * 0.95;
      const px = cx + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    if (i < filled) ctx.fill();
    else { ctx.globalAlpha = 0.35; ctx.fill(); ctx.globalAlpha = 1; }
  }
  ctx.restore();
}

function drawStarburst(ctx, cx, cy, r, text, sub) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  for (let k = 0; k < 32; k++) {
    const a = (k * Math.PI) / 16;
    const rr = k % 2 ? r * 0.78 : r;
    const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
    if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = '#ffd319'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#12041f'; ctx.stroke();
  ctx.fillStyle = '#12041f'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${r * 0.42}px Oswald, sans-serif`;
  ctx.fillText(text, 0, -r * 0.12);
  ctx.font = `700 ${r * 0.30}px Oswald, sans-serif`;
  ctx.fillText(sub, 0, r * 0.30);
  ctx.restore();
}

function drawBarcode(ctx, x, y, w, h, seed) {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 4, y - 4, w + 8, h + 22);
  ctx.fillStyle = '#12041f';
  let bx = x, s = seed || 11;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  while (bx < x + w - 3) {
    const bw = 1 + Math.floor(rnd() * 4);
    if (rnd() > 0.42) ctx.fillRect(bx, y, bw, h);
    bx += bw + 1 + Math.floor(rnd() * 3);
  }
  ctx.font = `400 ${Math.max(9, h * 0.22)}px Oswald, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('8 902026 019112', x + w / 2, y + h + 4);
  ctx.restore();
}

// --- caption layer ----------------------------------------------------------
function drawCaption(ctx, W, H, caption, region, sunsetOn, sunsetStyle, glow) {
  const st = CAPTION_STYLES[caption.style] || CAPTION_STYLES.sunset;
  const { x, y, w, h } = region;
  const cx = x + w / 2;
  const useGlow = glow !== false;
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (sunsetOn) drawSunset(ctx, x, y, w, h, sunsetStyle);
  // kicker pill
  const kick = (caption.kicker || '').toUpperCase();
  ctx.font = `600 ${Math.max(11, h * 0.085)}px Oswald, sans-serif`;
  const kw = ctx.measureText(kick).width + h * 0.16;
  const ky = y + h * 0.16;
  ctx.fillStyle = 'rgba(18,4,31,0.88)';
  ctx.beginPath();
  ctx.roundRect(cx - kw / 2, ky - h * 0.075, kw, h * 0.15, h * 0.075);
  ctx.fill();
  ctx.fillStyle = '#ffd319';
  ctx.fillText(kick, cx, ky + 1);
  // giant title
  const title = (caption.title || '').toUpperCase();
  const titlePx = fitFont(ctx, title, w * 0.94, 'Anton, sans-serif', 400, h * 0.42 * (caption.titleSize || 1));
  const ty = y + h * 0.52;
  ctx.font = `400 ${titlePx}px Anton, sans-serif`;
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, titlePx * 0.07);
  ctx.strokeStyle = st.stroke;
  if (useGlow) {
    ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = titlePx * 0.12; ctx.shadowOffsetY = titlePx * 0.05;
  }
  ctx.strokeText(title, cx, ty);
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  gradientText(ctx, title, cx, ty, st.grad, 'center');
  // neon script subtitle
  const sub = caption.subtitle || '';
  const subPx = Math.max(12, h * 0.135);
  ctx.font = `${subPx}px Pacifico, cursive`;
  ctx.fillStyle = st.script;
  if (useGlow) { ctx.shadowColor = st.scriptGlow; ctx.shadowBlur = subPx * 0.55; }
  ctx.fillText(sub, cx, y + h * 0.76);
  ctx.shadowBlur = 0;
  // letterspaced tagline (raised clear of the skyline strip, with a shadow
  // so it stays legible over the sunset)
  const tag = (caption.tagline || '').toUpperCase();
  ctx.font = `600 ${Math.max(10, h * 0.075)}px Oswald, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
  try { ctx.letterSpacing = `${Math.max(2, h * 0.012)}px`; } catch (e) { /* older canvas */ }
  ctx.fillText(tag, cx, y + h * 0.86);
  try { ctx.letterSpacing = '0px'; } catch (e) { /* older canvas */ }
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.restore();
}

// --- halftone + grain -------------------------------------------------------
let noiseTile = null;
function getNoiseTile() {
  if (noiseTile) return noiseTile;
  noiseTile = makeCanvas(128, 128);
  const nctx = noiseTile.getContext('2d');
  const img = nctx.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  nctx.putImageData(img, 0, 0);
  return noiseTile;
}

function drawHalftone(ctx, W, H, ink) {
  const cell = Math.max(7, Math.round(W / 110));
  const tw = Math.ceil(W / cell), th = Math.ceil(H / cell);
  const tmp = makeCanvas(tw, th);
  const tctx = tmp.getContext('2d');
  tctx.drawImage(ctx.canvas, 0, 0, tw, th);
  const data = tctx.getImageData(0, 0, tw, th).data;
  ctx.save();
  ctx.fillStyle = '#12041f';
  for (let gy = 0; gy < th; gy++) {
    for (let gx = 0; gx < tw; gx++) {
      const i = (gy * tw + gx) * 4;
      const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
      const r = cell * 0.52 * (1 - lum / 255) * ink;
      if (r > 0.5) {
        ctx.globalAlpha = 0.30 * ink;
        ctx.beginPath();
        ctx.arc(gx * cell + cell / 2, gy * cell + cell / 2, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

// --- the cover --------------------------------------------------------------
export function drawCover(canvas, state, photos, opts) {
  const o = opts || {};
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d');
  const cap = state.caption;
  const raw = !!o.raw;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0d0b1e';
  ctx.fillRect(0, 0, W, H);
  const layout = state.layout;
  // When the title sits in a dedicated bottom band, the art area is the
  // canvas minus that band, so no photo ends up hidden behind the band.
  const bandH = (cap.titlePos === 'band' && layout !== 'wanted') ? H * 0.24 : 0;
  const artH = H - bandH;
  // Polaroids with the title across would cut the tilted frames in half, so
  // they always get a dedicated title band: art in the top 58%, title below.
  const polaroidAcross = layout === 'polaroids' && cap.titlePos === 'across';
  const panelAreaH = polaroidAcross ? H * 0.58 : artH;
  const panels = layoutPanels(layout, W, panelAreaH);
  const gradeOpts = {
    grade: state.grade, strength: state.gradeStrength, contrast: state.contrast,
    posterInk: raw ? 0 : state.posterInk, colorPop: raw ? 'none' : state.colorPop,
    popStrength: state.popStrength,
  };
  const maxSide = o.maxSide || 1000;

  if (layout === 'wanted') {
    drawSunburst(ctx, 0, 0, W, H);
    // WANTED header
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#12041f';
    ctx.font = `400 ${Math.round(H * 0.085)}px Anton, sans-serif`;
    ctx.fillText('W A N T E D', W / 2, H * 0.075);
    ctx.font = `600 ${Math.round(H * 0.024)}px Oswald, sans-serif`;
    ctx.fillText('SOLMAR BAY POLICE DEPARTMENT  ·  EST. 2026', W / 2, H * 0.135);
    // framed mugshot (photos[0] is the wanted panel's photo)
    const p = panels[0];
    const photo = photos[0];
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(p.x - 10, p.y - 10, p.w + 20, p.h + 20);
    ctx.fillStyle = '#12041f';
    ctx.fillRect(p.x - 10, p.y - 10, p.w + 20, 5);
    if (photo && photo.graded) {
      ctx.save();
      ctx.beginPath(); ctx.rect(p.x, p.y, p.w, p.h); ctx.clip();
      drawPanelPhoto(ctx, raw ? photo.rawCanvas : photo.graded, p, state.panels[0].crop);
      ctx.restore();
    }
    // case details under the frame
    const name = (cap.title || 'MOST WANTED').toUpperCase();
    ctx.font = `400 ${Math.round(H * 0.052)}px Anton, sans-serif`;
    ctx.fillText(name, W / 2, H * 0.815);
    ctx.font = `${Math.round(H * 0.032)}px Pacifico, cursive`;
    ctx.fillStyle = '#8a1f3d';
    ctx.fillText(cap.subtitle || '', W / 2, H * 0.865);
    ctx.font = `600 ${Math.round(H * 0.02)}px Oswald, sans-serif`;
    ctx.fillStyle = '#12041f';
    ctx.fillText('LAST SEEN: NEON ROW  ·  ' + (cap.tagline || '').toUpperCase(), W / 2, H * 0.905);
    drawStars(ctx, W / 2 - H * 0.055, H * 0.945, H * 0.016, state.badges.heat ?? 5, '#c2182f');
    // red stamp
    ctx.save();
    ctx.translate(W * 0.78, H * 0.24); ctx.rotate(-0.22);
    ctx.strokeStyle = '#c2182f'; ctx.lineWidth = 4;
    ctx.strokeRect(-W * 0.11, -H * 0.035, W * 0.22, H * 0.07);
    ctx.fillStyle = '#c2182f';
    ctx.font = `400 ${Math.round(H * 0.038)}px Anton, sans-serif`;
    ctx.fillText('REWARD $50,000', 0, 0);
    ctx.restore();
    if (state.badges.barcode) drawBarcode(ctx, W * 0.06, H * 0.90, W * 0.13, H * 0.035, 7);
    ctx.restore();
    return;
  }

  // background sunset behind polaroids, or full-bleed sunset backdrop
  if (layout === 'polaroids' || (state.sunset.on && state.sunset.placement === 'full')) {
    drawSunset(ctx, 0, 0, W, panelAreaH, state.sunset.style);
  }

  // panels — `photos` is a per-panel array built by the editor, so each
  // panel can carry its own grade: photos[i] is panel i's photo.
  for (let i = 0; i < panels.length; i++) {
    const p = panels[i];
    const pstate = state.panels[i] || { photo: 0, crop: { x: 0, y: 0, scale: 1, flip: false } };
    const photo = photos[i];
    ctx.save();
    if (layout === 'polaroids') {
      // white polaroid frame
      ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
      ctx.rotate(((p.rot || 0) * Math.PI) / 180);
      ctx.fillStyle = '#fdfbf6';
      ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      ctx.beginPath(); ctx.rect(-p.w / 2 + 10, -p.h / 2 + 10, p.w - 20, p.h * 0.74); ctx.clip();
      if (photo) {
        const inner = { x: -p.w / 2 + 10, y: -p.h / 2 + 10, w: p.w - 20, h: p.h * 0.74 };
        drawPanelPhoto(ctx, raw ? photo.rawCanvas : photo.graded, inner, pstate.crop);
      }
      ctx.restore();
      // caption strip on the polaroid
      ctx.save();
      ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
      ctx.rotate(((p.rot || 0) * Math.PI) / 180);
      ctx.fillStyle = '#2b2b3a';
      ctx.font = `${Math.round(p.h * 0.055)}px Pacifico, cursive`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(photo ? photo.label : '', 0, p.h * 0.42);
      ctx.restore();
    } else {
      ctx.beginPath(); ctx.rect(p.x, p.y, p.w, p.h); ctx.clip();
      if (photo) drawPanelPhoto(ctx, raw ? photo.rawCanvas : photo.graded, p, pstate.crop);
      ctx.restore();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(2, W * 0.002);
      ctx.strokeRect(p.x, p.y, p.w, p.h);
    }
  }

  // comic treatment overlays
  if (!raw) {
    if (state.halftone) drawHalftone(ctx, W, H, state.posterInk);
    if (state.grain) {
      ctx.save();
      ctx.globalAlpha = 0.07;
      ctx.fillStyle = ctx.createPattern(getNoiseTile(), 'repeat');
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  if (!raw) {
    // caption
    if (polaroidAcross) {
      // polaroids get their own title band below the frames, never across them
      const region = { x: 0, y: H * 0.58, w: W, h: H * 0.42 };
      drawCaption(ctx, W, H, cap, region, state.sunset.on, state.sunset.style, state.glow);
    } else if (cap.titlePos === 'band') {
      const region = { x: 0, y: artH, w: W, h: bandH };
      if (state.sunset.on && state.sunset.placement === 'band') {
        drawCaption(ctx, W, H, cap, region, true, state.sunset.style, state.glow);
      } else {
        const bg = ctx.createLinearGradient(0, artH, 0, H);
        bg.addColorStop(0, '#160a2e'); bg.addColorStop(1, '#0d0b1e');
        ctx.fillStyle = bg; ctx.fillRect(0, artH, W, bandH);
        if (state.badges.skyline) drawSkyline(ctx, 0, artH - H * 0.045, W, H * 0.05, '#0d0b1e');
        drawCaption(ctx, W, H, cap, region, false, state.sunset.style, state.glow);
      }
    } else {
      const bandH = H * 0.34;
      const region = { x: 0, y: H * 0.40, w: W, h: bandH };
      drawCaption(ctx, W, H, cap, region, state.sunset.on && state.sunset.placement === 'band', state.sunset.style, state.glow);
    }
    // badges
    const b = state.badges;
    if (b.ribbon) {
      ctx.save();
      ctx.translate(0, 0);
      ctx.rotate(-0.06);
      ctx.fillStyle = '#ff2e88';
      ctx.fillRect(-W * 0.05, H * 0.035, W * 0.42, H * 0.042);
      ctx.fillStyle = '#ffffff';
      ctx.font = `600 ${Math.round(H * 0.024)}px Oswald, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('ORIGINAL  ·  FAN MADE', W * 0.16, H * 0.056);
      ctx.restore();
    }
    if (b.est) drawStarburst(ctx, W * 0.90, H * 0.10, H * 0.062, 'EST.', '2026');
    if (b.isNew) {
      ctx.save();
      ctx.fillStyle = '#ff2e88';
      ctx.beginPath(); ctx.arc(W * 0.83, H * 0.20, H * 0.038, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 ${Math.round(H * 0.026)}px Oswald, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('NEW', W * 0.83, H * 0.20);
      ctx.restore();
    }
    drawStars(ctx, W * 0.045, H * 0.115, H * 0.020, b.heat ?? 5, '#ffd319');
    if (b.barcode) drawBarcode(ctx, W * 0.86, H * 0.90, W * 0.10, H * 0.032, 11);
  }

  // vignette
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.hypot(W, H) * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(10,4,24,0.28)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}
