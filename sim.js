/* eslint-env browser, es2021 */
/* global document, window, getComputedStyle, requestAnimationFrame, cancelAnimationFrame, performance, localStorage, crypto, navigator, setTimeout */

const MAX_ENTITIES_PER_TYPE = 500;
const MAX_SEED_LEN = 128;
const MAX_TOTAL_ENTITIES = 1200;

function drawCenteredLabel(ctx, x, y, radiusLike, text) {
  // Skip when shapes are too small to read
  if (radiusLike < 7) return;

  const fontSize = Math.max(10, Math.round(radiusLike * 1.1));
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
  // subtle outline for contrast, then white fill
  ctx.lineWidth = Math.max(1, Math.round(fontSize * 0.15));
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.fillStyle = '#fff';
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawRegularPolygon(ctx, x, y, r, sides, rotationRad = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rotationRad + (i * 2 * Math.PI / sides);
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

/* =========================== Types (Registry) ============================ */
const TypeRegistry = [
  {
    id: 'circle', label: 'Circles (Rock)', cssVar: '--circle',
    draw(ctx, e, palette) {
      ctx.fillStyle = palette.circle;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
      drawCenteredLabel(ctx, e.x, e.y, e.r, 'R');
    }
  },
  {
    id: 'square', label: 'Squares (Paper)', cssVar: '--square',
    draw(ctx, e, palette) {
      ctx.fillStyle = palette.square;
      const s = e.side;
      ctx.beginPath(); ctx.rect(e.x - s / 2, e.y - s / 2, s, s); ctx.fill();
      drawCenteredLabel(ctx, e.x, e.y, e.r, 'P');
    }
  },
  {
    id: 'triangle', label: 'Triangles (Scissors)', cssVar: '--triangle',
    draw(ctx, e, palette) {
      ctx.fillStyle = palette.triangle;
      const base = e.base;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y - e.r);
      ctx.lineTo(e.x - base / 2, e.y + e.r);
      ctx.lineTo(e.x + base / 2, e.y + e.r);
      ctx.closePath(); ctx.fill();
      const cx = e.x, cy = e.y + e.r / 3; // visual centroid
      drawCenteredLabel(ctx, cx, cy, e.r, 'S');
    }
  },
  {
    id: 'lizard', label: 'Lizards', cssVar: '--lizard',
    draw(ctx, e, palette) {
      // Diamond (rotated square)
      ctx.fillStyle = palette.lizard;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y - e.r);
      ctx.lineTo(e.x + e.r, e.y);
      ctx.lineTo(e.x, e.y + e.r);
      ctx.lineTo(e.x - e.r, e.y);
      ctx.closePath(); ctx.fill();
      drawCenteredLabel(ctx, e.x, e.y, e.r, 'L');
    }
  },
  {
    id: 'spock', label: 'Spocks', cssVar: '--spock',
    draw(ctx, e, palette) {
      // Regular pentagon
      ctx.fillStyle = palette.spock;
      drawRegularPolygon(ctx, e.x, e.y, e.r, 5 /*sides*/);
      // Two letters fit fine with current text helper
      drawCenteredLabel(ctx, e.x, e.y, e.r, 'Sp');
    }
  }
];
const TypeIds = TypeRegistry.map(t => t.id);


const FALLBACK_COLORS = { lizard: '#c7a0ff', spock: '#ffd1e0' };

function buildPalette() {
  const s = getComputedStyle(document.documentElement);
  const out = {};
  for (const t of TypeRegistry) {
    const v = s.getPropertyValue(t.cssVar)?.trim();
    out[t.id] = v && v.length ? v : (FALLBACK_COLORS[t.id] ?? '#cccccc');
  }
  return out;
}


/* ============================== Beats Rules ============================= */
// Rock crushes Scissors & Lizard
// Paper covers Rock & disproves Spock
// Scissors cut Paper & decapitate Lizard
// Lizard poisons Spock & eats Paper
// Spock smashes Scissors & vaporizes Rock
const beats = {
  circle: ['triangle', 'lizard'],
  square: ['circle', 'spock'],
  triangle: ['square', 'lizard'],
  lizard: ['spock', 'square'],
  spock: ['triangle', 'circle'],
};

const beatsMap = new Map(Object.entries(beats).map(([k, arr]) => [k, new Set(arr)]));
function validateRules() {
  const ids = new Set(TypeIds);
  for (const [a, outs] of beatsMap) {
    if (!ids.has(a)) throw new Error(`Rule references unknown type: ${a}`);
    outs.forEach(b => {
      if (!ids.has(b)) throw new Error(`Unknown target '${b}' in beats[${a}]`);
      if (b === a) throw new Error(`Type '${a}' cannot beat itself`);
      if (beatsMap.get(b)?.has(a)) throw new Error(`Conflict: both '${a}→${b}' and '${b}→${a}'`);
    });
  }
}
validateRules();

function winnerOf(aId, bId) {
  if (aId === bId) return null;
  const A = beatsMap.get(aId), B = beatsMap.get(bId);
  if (A?.has(bId)) return aId;
  if (B?.has(aId)) return bId;
  return null; // unspecified => tie/no conversion
}

/* ============================= Canvas setup ============================= */
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const spark = document.getElementById('sparkline');
const sctx = spark.getContext('2d');
let DPR = 1, VIEW_W = 0, VIEW_H = 0, SPARK_W = 0, SPARK_H = 0;

function resizeCanvas() {
  DPR = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * DPR);
  canvas.height = Math.floor(rect.height * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  VIEW_W = rect.width; VIEW_H = rect.height;
  const srect = spark.getBoundingClientRect();
  spark.width = Math.floor(srect.width * DPR);
  spark.height = Math.floor(srect.height * DPR);
  sctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  SPARK_W = srect.width; SPARK_H = srect.height;
  computeGridDims();
  drawSparkline();
}
window.addEventListener('resize', resizeCanvas);

/* ================================= RNG ================================= */
const seedInput = document.getElementById('seedInput');
const seedNote = document.getElementById('seedNote');
const applySeedBtn = document.getElementById('applySeedBtn');
const randomSeedBtn = document.getElementById('randomSeedBtn');
const copySeedBtn = document.getElementById('copySeedBtn');

function xfnv1a(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0 }
function mulberry32(a) { return function () { let t = a += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; } }

let rngSeedStr = 'rps-12345';
let rng = mulberry32(xfnv1a(rngSeedStr));
function setSeed(str) {
  const safe = String(str).slice(0, MAX_SEED_LEN);
  if (safe.length !== String(str).length) toast(`Seed truncated to ${MAX_SEED_LEN} chars`);
  rngSeedStr = safe;
  rng = mulberry32(xfnv1a(safe));
  seedNote.textContent = `Current seed: ${safe}`;
}


applySeedBtn.addEventListener('click', () => { setSeed(seedInput.value); toast('Seed applied'); });
const hasClipboard = !!(navigator.clipboard && navigator.clipboard.writeText);
copySeedBtn.addEventListener('click', async () => {
  if (!hasClipboard) { toast('Clipboard not available in this context'); return; }
  try { await navigator.clipboard.writeText(seedInput.value); toast('Seed copied'); }
  catch { /* intentionally ignored */ }
});

const hasCrypto = !!(window.crypto && crypto.getRandomValues);
randomSeedBtn.addEventListener('click', () => {
  const rs = hasCrypto
    ? `rps-${(crypto.getRandomValues(new Uint32Array(1))[0] >>> 0).toString(36)}`
    : `rps-${Math.random().toString(36).slice(2, 10)}`; // weaker fallback
  seedInput.value = rs; setSeed(rs); toast('Seed randomized');
});


/* ============================== Entity ================================= */
let ENTITY_ID = 1;
// Physics constants (px/s and unitless)
const REST = 1.0;       // restitution for collisions
const VMAX = 600;       // max speed clamp (px/s)
const EPS = 1e-3;      // positional slop

class Entity {
  constructor(typeIndex, x, y, r, vx, vy) {
    this._id = ENTITY_ID++;
    this.t = typeIndex; // index into TypeRegistry
    this.x = x; this.y = y; this.r = r; this.vx = vx; this.vy = vy; // vx/vy in px/s
    this.mass = r * r; this.side = r * Math.sqrt(2); this.base = r * 2;
  }
  draw(ctx, palette) { TypeRegistry[this.t].draw(ctx, this, palette); }
  update(w, h, dt, spd, wrap) {
    // integrate with fixed dt, speed acts as scalar multiplier
    const adv = dt * spd;
    this.x += this.vx * adv; this.y += this.vy * adv;
    if (wrap) {
      this.x = mod(this.x, w); this.y = mod(this.y, h);
    } else {
      // walls (bounce)
      if (this.x - this.r < 0) { this.x = this.r; this.vx = Math.abs(this.vx); }
      if (this.x + this.r > w) { this.x = w - this.r; this.vx = -Math.abs(this.vx); }
      if (this.y - this.r < 0) { this.y = this.r; this.vy = Math.abs(this.vy); }
      if (this.y + this.r > h) { this.y = h - this.r; this.vy = -Math.abs(this.vy); }
    }
    clampVel(this);
  }
}

function clampVel(e) {
  const v2 = e.vx * e.vx + e.vy * e.vy;
  if (v2 > VMAX * VMAX) { const s = VMAX / Math.sqrt(v2); e.vx *= s; e.vy *= s; }
}

/* ====================== Simulation state & UI refs ====================== */
let entities = []; let animId = null; let running = false;
let accumulator = 0; let lastTime = performance.now();
const FIXED_DT = 1 / 60; // seconds, deterministic step

const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const clearBtn = document.getElementById('clearBtn');
const speedEl = document.getElementById('speed');
const sizeEl = document.getElementById('size');
const statsEl = document.getElementById('stats');
const wallModeEl = document.getElementById('wallMode');
const mixbarEl = document.getElementById('mixbar');
const mixPctEl = document.getElementById('mixPct');
const legendRow = document.getElementById('legendRow');
const typeInputsWrap = document.getElementById('typeInputs');

const typeInputEls = [];
const mixSegEls = [];

const storage = (() => {
  try {
    const t = '__rps_test__';
    localStorage.setItem(t, '1'); localStorage.removeItem(t);
    return localStorage;
  } catch {
    return { getItem(){return null;}, setItem(){}, removeItem(){}, clear(){} };
  }
})();

function buildTypeUI() {
  typeInputsWrap.innerHTML = ''; legendRow.innerHTML = ''; mixbarEl.innerHTML = '';
  const palette = buildPalette();

  TypeRegistry.forEach((t, i) => {
    // Input
    const label = document.createElement('label');
    label.textContent = t.label;
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.max = String(MAX_ENTITIES_PER_TYPE);
    input.step = '1';

    const saved = storage.getItem(`rps_count_${t.id}`);
    input.value = saved ?? '20';
    clampInput(input);
    storage.setItem(`rps_count_${t.id}`, input.value);

    input.id = `count_${t.id}`;
    label.appendChild(input);
    typeInputsWrap.appendChild(label);
    typeInputEls[i] = input;

    input.addEventListener('input', () => {
      clampInput(input);
      storage.setItem(`rps_count_${t.id}`, input.value);
    });
    input.addEventListener('change', () => {
      clampInput(input);
      storage.setItem(`rps_count_${t.id}`, input.value);
    });


    // Legend
    const chip = document.createElement('span'); chip.className = 'chip'; chip.style.background = palette[t.id];
    const txt = document.createTextNode(' ' + t.id[0].toUpperCase() + t.id.slice(1));
    const holder = document.createElement('span'); holder.appendChild(chip); holder.appendChild(txt);
    legendRow.appendChild(holder);

    // Mix seg
    const seg = document.createElement('div'); seg.className = 'seg'; seg.style.background = palette[t.id]; seg.style.width = '0%';
    mixbarEl.appendChild(seg); mixSegEls[i] = seg;
  });
}

/* ====================== Clamp helper for inputs ====================== */
function clampInput(el) {
  // coerce to integer; treat empty/invalid as 0
  let v = parseInt(el.value, 10);
  if (Number.isNaN(v)) v = 0;
  // enforce range and integer step
  v = Math.max(0, Math.min(v, MAX_ENTITIES_PER_TYPE));
  el.value = String(v);
}

// RNG helpers
const rand = (min, max) => rng() * (max - min) + min;
const randVel = () => { const angle = rng() * Math.PI * 2; const mag = (rand(0.8, 2.0)) * 60; return { vx: Math.cos(angle) * mag, vy: Math.sin(angle) * mag } }; // px/s

function overlapsAny(x, y, r) {
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    const dx = x - e.x, dy = y - e.y;
    if (dx * dx + dy * dy < (r + e.r) * (r + e.r)) return true;
  }
  return false;
}

function spawn(typeIndex, n, radius) {
  n = Math.min(n, MAX_ENTITIES_PER_TYPE);
  for (let i = 0; i < n; i++) {
    const { vx, vy } = randVel();
    let x, y; let tries = 0; const maxTries = 50;
    do {
      x = rand(radius + 2, VIEW_W - radius - 2);
      y = rand(radius + 2, VIEW_H - radius - 2);
    } while (overlapsAny(x, y, radius) && ++tries < maxTries);
    entities.push(new Entity(typeIndex, x, y, radius, vx, vy));
  }
}

function initFromControls() {
  entities = []; ENTITY_ID = 1; accumulator = 0; lastTime = performance.now();
  Object.values(historyByType).forEach(arr => arr.length = 0);
  setSeed(seedInput.value);

  const r = Number(sizeEl.value);
  let total = 0;
  TypeRegistry.forEach((t, i) => {
    const want = Math.min(Number(typeInputEls[i].value || 0), MAX_ENTITIES_PER_TYPE);
    const can = Math.max(0, Math.min(want, MAX_TOTAL_ENTITIES - total));
    if (can < want) toast(`Capped ${t.id} at ${can} (global max)`);
    spawn(i, can, r);
    total += can;
  });

  updateStatsAndCharts(); drawSparkline(); render();
}

function computeCounts() {
  const counts = new Array(TypeRegistry.length).fill(0);
  for (const e of entities) counts[e.t]++;
  return counts;
}

function capFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function updateStatsAndCharts() {
  const counts = computeCounts();
  const total = entities.length || 1;

  const parts = counts.map((c, i) => `${TypeRegistry[i].id[0].toUpperCase() + TypeRegistry[i].id.slice(1)}: ${c}`);
  statsEl.textContent = `Total: ${entities.length} — ${parts.join(' | ')}`;

  const palette = buildPalette();
  const pctLabel = [];
  counts.forEach((c, i) => {
    const pct = (c / total) * 100;
    mixSegEls[i].style.width = pct.toFixed(2) + '%';
    mixSegEls[i].style.background = palette[TypeRegistry[i].id];
    pctLabel.push(`${TypeRegistry[i].id[0].toUpperCase() + TypeRegistry[i].id.slice(1)} ${(pct).toFixed(0)}%`);
  });
  mixPctEl.textContent = pctLabel.join(' • ');

  const typesPresent = counts.filter(v => v > 0).length;
  if (running && entities.length > 0 && typesPresent === 1) {
    running = false; if (animId != null) cancelAnimationFrame(animId); animId = null;
    const winnerIndex = counts.findIndex(v => v > 0);
    const winnerName = capFirst(TypeRegistry[winnerIndex].id);
    toast(`${winnerName} wins!`);
    startBtn.textContent = 'Resume';
    render();
  }

  maybeSampleSpark(counts.map(c => c / total));
}

/* ========================== Collisions (grid) =========================== */
const grid = new Map(); let CELL = 40; let GW = 1, GH = 1; let WRAP_ACTIVE = false;
const cellKey = (ix, iy) => ix + '|' + iy;
const mod = (n, m) => ((n % m) + m) % m;
function clampIdx(ix, max) { return Math.max(0, Math.min(ix, max)); }

function computeGridDims() { GW = Math.max(1, Math.ceil(VIEW_W / CELL)); GH = Math.max(1, Math.ceil(VIEW_H / CELL)); }

function insertIntoGrid(e) {
  let minx = Math.floor((e.x - e.r) / CELL);
  let maxx = Math.floor((e.x + e.r) / CELL);
  let miny = Math.floor((e.y - e.r) / CELL);
  let maxy = Math.floor((e.y + e.r) / CELL);
  for (let iy = miny; iy <= maxy; iy++) {
    for (let ix = minx; ix <= maxx; ix++) {
      const gx = WRAP_ACTIVE ? mod(ix, GW) : clampIdx(ix, GW - 1);
      const gy = WRAP_ACTIVE ? mod(iy, GH) : clampIdx(iy, GH - 1);
      const k = cellKey(gx, gy); let b = grid.get(k); if (!b) { b = []; grid.set(k, b) } b.push(e);
    }
  }
}

function periodicDelta(ax, ay, bx, by) {
  let dx = bx - ax, dy = by - ay;
  if (WRAP_ACTIVE) {
    if (dx > VIEW_W / 2) dx -= VIEW_W; else if (dx < -VIEW_W / 2) dx += VIEW_W;
    if (dy > VIEW_H / 2) dy -= VIEW_H; else if (dy < -VIEW_H / 2) dy += VIEW_H;
  }
  return { dx, dy };
}

function narrowPhase(a, b) {
  const { dx, dy } = periodicDelta(a.x, a.y, b.x, b.y);
  const minDist = a.r + b.r;
  const dist2 = dx * dx + dy * dy; if (dist2 > minDist * minDist) return;

  // Determine winner via beats map (ids)
  const aId = TypeRegistry[a.t].id;
  const bId = TypeRegistry[b.t].id;
  const winId = winnerOf(aId, bId);
  if (winId) { if (winId === aId) b.t = a.t; else a.t = b.t; }

  // Separation + elastic bounce along normal
  const dist = Math.sqrt(dist2) || 0.0001;
  const nx = dx / dist, ny = dy / dist;
  const overlap = Math.max(0, (minDist - dist) + EPS);
  a.x -= nx * overlap / 2; a.y -= ny * overlap / 2;
  b.x += nx * overlap / 2; b.y += ny * overlap / 2;
  if (WRAP_ACTIVE) {
    a.x = mod(a.x, VIEW_W); a.y = mod(a.y, VIEW_H);
    b.x = mod(b.x, VIEW_W); b.y = mod(b.y, VIEW_H);
  }

  // 1D elastic along normal with restitution
  const va = a.vx * nx + a.vy * ny; const vb = b.vx * nx + b.vy * ny;
  const ma = a.mass, mb = b.mass;
  const vaAfter = (va * (ma - mb) + 2 * mb * vb) / (ma + mb);
  const vbAfter = (vb * (mb - ma) + 2 * ma * va) / (ma + mb);
  const dvA = (vaAfter - va) * REST, dvB = (vbAfter - vb) * REST;
  a.vx += dvA * nx; a.vy += dvA * ny;
  b.vx += dvB * nx; b.vy += dvB * ny;
  clampVel(a); clampVel(b);
}

function handleCollisionsGrid() {
  grid.clear();
  for (const e of entities) insertIntoGrid(e);
  for (const [k, bucket] of grid) {
    const [cx, cy] = k.split('|').map(Number);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        let nx = WRAP_ACTIVE ? mod(cx + dx, GW) : (cx + dx);
        let ny = WRAP_ACTIVE ? mod(cy + dy, GH) : (cy + dy);
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        const nb = grid.get(cellKey(nx, ny));
        if (!nb) continue;
        for (let i = 0; i < bucket.length; i++) {
          const a = bucket[i];
          for (const b of nb) {
            if (a === b) continue;
            if (a._id > b._id) continue;
            narrowPhase(a, b);
          }
        }
      }
    }
  }
}

/* ============================== Stepping ================================ */
function step(dt) {
  const spd = Number(speedEl.value);
  const wrap = (wallModeEl.value === 'wrap');
  WRAP_ACTIVE = wrap;
  for (const e of entities) { e.update(VIEW_W, VIEW_H, dt, spd, wrap); }
  handleCollisionsGrid();
}

function render() {
  const palette = buildPalette();
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  for (const e of entities) { e.draw(ctx, palette); }
}

function frame() {
  const now = performance.now();
  let dt = (now - lastTime) / 1000; if (dt > 0.1) dt = 0.1; lastTime = now;
  accumulator += dt;
  while (accumulator >= FIXED_DT) { step(FIXED_DT); accumulator -= FIXED_DT; }
  render();
  updateStatsAndCharts();
  if (running) animId = requestAnimationFrame(frame);
}

/* ============================= UI handlers ============================= */
function startPauseToggle() {
  if (!running) { if (entities.length === 0) initFromControls(); running = true; lastTime = performance.now(); frame(); startBtn.textContent = 'Pause'; }
  else { running = false; if (animId != null) cancelAnimationFrame(animId); startBtn.textContent = 'Resume'; }
}
function reset() { initFromControls(); running = false; if (animId != null) cancelAnimationFrame(animId); animId = null; updateStatsAndCharts(); drawSparkline(); startBtn.textContent = 'Start'; }
function clearAll() { running = false; if (animId != null) cancelAnimationFrame(animId); animId = null; entities = []; accumulator = 0; ctx.clearRect(0, 0, VIEW_W, VIEW_H); mixSegEls.forEach(seg => seg.style.width = '0%'); mixPctEl.textContent = '—'; Object.values(historyByType).forEach(arr => arr.length = 0); drawSparkline(); updateStatsAndCharts(); startBtn.textContent = 'Start'; }

startBtn.addEventListener('click', startPauseToggle);
resetBtn.addEventListener('click', reset);
clearBtn.addEventListener('click', clearAll);
sizeEl.addEventListener('input', () => { if (!running) reset(); updateCellSize(); });
wallModeEl.addEventListener('change', () => { if (!running) reset(); });

/* =============================== Toast ================================= */
function toast(msg) { const div = document.createElement('div'); div.className = 'toast'; div.textContent = msg; div.setAttribute('role','status'); div.setAttribute('aria-live','polite'); document.body.appendChild(div); setTimeout(() => div.remove(), 1600); }

/* ============================== Sparkline ============================== */
const historyByType = {};
function ensureHistories() {
  TypeRegistry.forEach(t => { if (!historyByType[t.id]) historyByType[t.id] = []; });
  for (const k of Object.keys(historyByType)) if (!TypeIds.includes(k)) delete historyByType[k];
}
let lastSampleTime = 0; const SAMPLE_MS = 80;
function maybeSampleSpark(proportionsArr) {
  const now = performance.now(); if (now - lastSampleTime < SAMPLE_MS) return; lastSampleTime = now;
  ensureHistories();
  const maxPoints = Math.max(10, Math.floor(SPARK_W));
  proportionsArr.forEach((p, i) => {
    const arr = historyByType[TypeRegistry[i].id];
    arr.push(p);
    if (arr.length > maxPoints) arr.shift();
  });
  drawSparkline();
}
function drawSparkline() {
  ensureHistories();
  const palette = buildPalette();
  sctx.clearRect(0, 0, SPARK_W, SPARK_H);
  sctx.lineWidth = 1; sctx.globalAlpha = .25; sctx.strokeStyle = '#223048';
  [1 / 3, 2 / 3].forEach(fr => { sctx.beginPath(); const y = SPARK_H * (1 - fr); sctx.moveTo(0, y); sctx.lineTo(SPARK_W, y); sctx.stroke(); });
  sctx.globalAlpha = 1;

  const lens = TypeRegistry.map(t => historyByType[t.id]?.length || 0);
  const len = Math.max(...lens);
  if (len < 2) return;

  TypeRegistry.forEach(t => {
    const vals = historyByType[t.id] || [];
    sctx.strokeStyle = palette[t.id];
    sctx.lineWidth = 2; sctx.beginPath();
    for (let i = 0; i < vals.length; i++) {
      const x = i * (SPARK_W / Math.max(1, (len - 1)));
      const y = SPARK_H * (1 - vals[i]);
      if (i === 0) sctx.moveTo(x, y); else sctx.lineTo(x, y);
    }
    sctx.stroke();
  });
}

/* =============================== Helpers =============================== */
function updateCellSize() { const r = Number(sizeEl.value); CELL = Math.max(24, r * 2 + 6); computeGridDims(); }

// Persist common controls
const UI_KEYS_COMMON = ['wallMode', 'speed', 'size', 'seedInput'];
function saveCommon() { UI_KEYS_COMMON.forEach(k => { const el = document.getElementById(k); if (el) storage.setItem('rps_' + k, el.value); }); }
function loadCommon() { UI_KEYS_COMMON.forEach(k => { const v = storage.getItem('rps_' + k); const el = document.getElementById(k); if (v != null && el) el.value = v; }); }
['input', 'change'].forEach(evt => {
  UI_KEYS_COMMON.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(evt, saveCommon);
  });
});

/* ============================== Initialize ============================= */
function buildTypeUIAndInit() {
  buildTypeUI();
  loadCommon();
  const savedSeed = storage.getItem('rps_seedInput'); if (savedSeed) { seedInput.value = savedSeed; }
  seedInput.addEventListener('input', () => storage.setItem('rps_seedInput', seedInput.value));
  seedInput.addEventListener('change', () => storage.setItem('rps_seedInput', seedInput.value));
  updateCellSize(); resizeCanvas();
  setSeed(seedInput.value || rngSeedStr);
  initFromControls();
  render();
  updateStatsAndCharts(); drawSparkline();
}
buildTypeUIAndInit();