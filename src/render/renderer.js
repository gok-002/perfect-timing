import { WORLD, TIMING, ACCURACY } from '../config.js';
import { STATES } from '../core/session.js';
import { toleranceFor } from '../core/geometry.js';

const BH = WORLD.BLOCK_HEIGHT;
const ANCHOR = 0.6; // vertical screen fraction where the active rows sit
const LANE_LIFT = 1.55; // moving block hovers this many rows above its target row
const MAX_DPR = 2; // cap pixel ratio for low/mid-range GPUs
const TRAIL_LENGTH = 4;

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

const easeInQuad = (t) => t * t;
const easeOutBack = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);

export class Renderer {
  constructor(canvas, effects) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.effects = effects;
    this.time = 0;
    this.cameraH = BH;
    this.trail = [];
    this.missAnim = null;
    this.landPulse = new Map(); // row -> seconds since landing
    this.motes = Array.from({ length: 28 }, () => ({
      x: Math.random(), y: Math.random(), r: 0.5 + Math.random() * 1.6, v: 0.004 + Math.random() * 0.012,
    }));
    this.view = {
      scale: 1,
      sx: (x) => x * this.view.scale,
      sy: (h) => this.h * ANCHOR - (h - this.cameraH) * this.view.scale,
    };
    this.w = 1;
    this.h = 1;
  }

  setTheme(theme) {
    this.theme = theme;
    this.bgCache = null;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    this.w = Math.max(1, Math.round(rect.width));
    this.h = Math.max(1, Math.round(rect.height));
    this.dpr = dpr;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.view.scale = this.w / WORLD.WIDTH;
    this.bgCache = null;
  }

  resetRun() {
    this.cameraH = BH;
    this.trail = [];
    this.missAnim = null;
    this.landPulse.clear();
    this.effects.clear();
  }

  // ---- event hooks -------------------------------------------------------
  onLand({ block, grade, perfectStreak }) {
    const c = this.theme.colors;
    const top = (block.row + 1) * BH;
    this.landPulse.set(block.row, 0);
    this.trail = [];
    if (grade === 'perfect') {
      this.effects.burst(block.x, top, { count: 22 + Math.min(perfectStreak, 6) * 3, colors: c.particles, speed: 640, size: 11 });
      this.effects.ring(block.x, top, c.perfect, 300 + Math.min(perfectStreak, 6) * 30, 0.55);
      this.effects.flash(c.perfect, 0.12);
      this.effects.shake(3, 0.12);
    } else if (grade === 'great') {
      this.effects.burst(block.x, top, { count: 10, colors: [c.great, c.blockEdge], speed: 460, size: 8 });
      this.effects.ring(block.x, top, c.great, 200, 0.4);
    } else {
      this.effects.burst(block.x, top, { count: 5, colors: [c.good], speed: 320, size: 7 });
    }
  }

  onMiss({ x, width, row }, direction, laneSpeed) {
    this.missAnim = {
      x, width, h: (row + LANE_LIFT) * BH, vx: direction * Math.min(420, laneSpeed * 0.35), vh: 0, rot: 0, vr: direction * 3.2, t: 0,
    };
    this.trail = [];
    this.effects.shake(14, 0.35);
    this.effects.flash(this.theme.colors.miss, 0.28);
  }

  // ---- drawing -----------------------------------------------------------
  drawBackground(ctx) {
    const c = this.theme.colors;
    if (!this.bgCache) {
      const off = document.createElement('canvas');
      off.width = this.canvas.width;
      off.height = this.canvas.height;
      const o = off.getContext('2d');
      const g = o.createLinearGradient(0, 0, 0, off.height);
      g.addColorStop(0, c.bgTop);
      g.addColorStop(1, c.bgBottom);
      o.fillStyle = g;
      o.fillRect(0, 0, off.width, off.height);
      // Soft theme-tinted glow behind the play area, darker towards the corners.
      const v = o.createRadialGradient(off.width / 2, off.height * 0.5, 0, off.width / 2, off.height * 0.5, off.height * 0.7);
      v.addColorStop(0, hexA(c.towerB, 0.45));
      v.addColorStop(1, hexA(c.bgTop, 0));
      o.fillStyle = v;
      o.fillRect(0, 0, off.width, off.height);
      this.bgCache = off;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.bgCache, 0, 0);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Parallax grid rows (half camera speed) give a sense of climbing.
    const spacing = BH * this.view.scale;
    const offset = ((this.cameraH * 0.5 * this.view.scale) % spacing + spacing) % spacing;
    ctx.strokeStyle = c.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = offset; y < this.h; y += spacing) {
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(this.w, Math.round(y) + 0.5);
    }
    ctx.stroke();

    ctx.fillStyle = c.blockEdge;
    for (const m of this.motes) {
      const y = (((m.y - this.time * m.v - this.cameraH * 0.0002) % 1) + 1) % 1;
      ctx.globalAlpha = 0.18 + 0.12 * Math.sin(this.time * 1.3 + m.x * 20);
      ctx.fillRect(m.x * this.w, y * this.h, m.r, m.r);
    }
    ctx.globalAlpha = 1;
  }

  drawBlock(ctx, x, h, width, { fill, edge, glow, alpha = 1, rot = 0, notch = false }) {
    const s = this.view.scale;
    const w = width * s;
    const hh = BH * s;
    const cx = this.view.sx(x);
    const cy = this.view.sy(h + BH / 2);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    if (rot) ctx.rotate(rot);
    if (glow) {
      ctx.shadowColor = glow;
      ctx.shadowBlur = 18;
    }
    roundRectPath(ctx, -w / 2, -hh / 2, w, hh, 6 * s * 1.6);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.shadowBlur = 0;
    if (edge) {
      ctx.fillStyle = edge;
      ctx.globalAlpha = alpha * 0.9;
      ctx.fillRect(-w / 2 + 4 * s, -hh / 2 + 1, w - 8 * s, Math.max(1.5, 4 * s));
    }
    if (notch) {
      ctx.globalAlpha = alpha * 0.85;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(-1.5, -hh / 2 + hh * 0.25, 3, hh * 0.5);
    }
    ctx.restore();
  }

  drawTower(ctx, placed) {
    const c = this.theme.colors;
    const s = this.view.scale;
    const minRow = Math.floor((this.cameraH - (this.h * (1 - ANCHOR)) / s) / BH) - 1;
    const maxRow = Math.ceil((this.cameraH + (this.h * ANCHOR) / s) / BH) + 1;

    // Foundation plinth below row 0.
    if (minRow <= 0) {
      const top = this.view.sy(0);
      const depth = BH * 2.5 * s;
      const fade = ctx.createLinearGradient(0, top, 0, top + depth);
      fade.addColorStop(0, hexA(c.towerA, 0.9));
      fade.addColorStop(1, hexA(c.towerA, 0));
      ctx.fillStyle = fade;
      ctx.fillRect(this.view.sx(WORLD.SIDE_MARGIN), top, (WORLD.WIDTH - WORLD.SIDE_MARGIN * 2) * s, depth);
      ctx.fillStyle = c.towerEdge;
      ctx.fillRect(this.view.sx(WORLD.SIDE_MARGIN), top, (WORLD.WIDTH - WORLD.SIDE_MARGIN * 2) * s, Math.max(1, 3 * s));
    }

    const start = Math.max(0, minRow);
    const end = Math.min(placed.length - 1, maxRow);

    // Connector thread linking consecutive block centres: the "timeline" of the run.
    if (end >= start) {
      ctx.strokeStyle = c.towerEdge;
      ctx.lineWidth = Math.max(1, 3 * s);
      ctx.beginPath();
      for (let i = Math.max(1, start); i <= end; i++) {
        const a = placed[i - 1];
        const b = placed[i];
        ctx.moveTo(this.view.sx(a.x), this.view.sy((a.row + 0.5) * BH));
        ctx.lineTo(this.view.sx(b.x), this.view.sy((b.row + 0.5) * BH));
      }
      ctx.stroke();
    }

    for (let i = start; i <= end; i++) {
      const b = placed[i];
      const age = this.landPulse.get(b.row);
      const fresh = age !== undefined && age < 0.6 ? 1 - age / 0.6 : 0;
      const squash = age !== undefined && age < 0.25 ? 1 - 0.08 * Math.sin((age / 0.25) * Math.PI) : 1;
      const edge = b.grade === 'perfect' ? c.perfect : b.grade === 'great' ? c.great : c.towerEdge;
      this.drawBlock(ctx, b.x, b.row * BH, b.width * (2 - squash), {
        fill: fresh > 0 ? mix(b.row % 2 ? c.towerB : c.towerA, c.block, fresh * 0.8) : b.row % 2 ? c.towerB : c.towerA,
        edge,
        glow: fresh > 0.5 ? c.glow : null,
      });
    }
  }

  drawTarget(ctx, round, flashMiss) {
    const c = this.theme.colors;
    const s = this.view.scale;
    const x = this.view.sx(round.targetX - round.targetWidth / 2);
    const w = round.targetWidth * s;
    const yTop = this.view.sy((round.row + 1) * BH);
    const hh = BH * s;
    const pulse = 0.55 + 0.25 * Math.sin(this.time * 5);
    const color = flashMiss ? c.miss : c.target;

    // Alignment guides rising from the target edges up through the lane.
    const guideTop = this.view.sy((round.row + LANE_LIFT + 1.4) * BH);
    const guide = ctx.createLinearGradient(0, yTop, 0, guideTop);
    guide.addColorStop(0, hexA(color, 0.35));
    guide.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = guide;
    ctx.fillRect(x, guideTop, Math.max(1, 2 * s), yTop - guideTop);
    ctx.fillRect(x + w - Math.max(1, 2 * s), guideTop, Math.max(1, 2 * s), yTop - guideTop);
    ctx.fillStyle = hexA(color, 0.05);
    ctx.fillRect(x, guideTop, w, yTop - guideTop);

    roundRectPath(ctx, x, yTop, w, hh, 6 * s * 1.6);
    ctx.fillStyle = c.targetFill;
    ctx.fill();
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 14 * pulse;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.6 + 0.4 * pulse;
    ctx.lineWidth = Math.max(1.5, 4 * s);
    ctx.setLineDash([10 * s * 1.5, 7 * s * 1.5]);
    ctx.lineDashOffset = -this.time * 30 * s;
    ctx.stroke();
    ctx.restore();

    // Perfect window markers: the moving block's centre notch must land between them.
    const maxOffset = (round.targetWidth + round.blockWidth) / 2;
    const tol = toleranceFor(ACCURACY.PERFECT, maxOffset, round.speed) * s;
    const cx = this.view.sx(round.targetX);
    ctx.fillStyle = c.perfect;
    ctx.globalAlpha = 0.85;
    const mh = hh * 0.5;
    ctx.fillRect(cx - tol - 1, yTop + hh * 0.25, 2, mh);
    ctx.fillRect(cx + tol - 1, yTop + hh * 0.25, 2, mh);
    ctx.globalAlpha = 0.25;
    ctx.fillRect(cx - tol, yTop + hh * 0.25, tol * 2, mh);
    ctx.globalAlpha = 1;
  }

  drawActiveBlock(ctx, session, dt) {
    const c = this.theme.colors;
    const { state, round } = session;
    const laneH = (round.row + LANE_LIFT) * BH;

    if (state === STATES.READY || state === STATES.MOVING) {
      const x = round.motion.x;
      const appear = state === STATES.READY ? Math.min(1, session.stateTime / TIMING.READY_DELAY) : 1;
      if (state === STATES.MOVING) {
        this.trail.push(x);
        if (this.trail.length > TRAIL_LENGTH) this.trail.shift();
        this.trail.forEach((tx, i) => {
          this.drawBlock(ctx, tx, laneH, round.blockWidth, { fill: c.block, alpha: 0.05 + i * 0.04 });
        });
      }
      const lift = (1 - easeOutBack(appear)) * BH * 0.6;
      this.drawBlock(ctx, x, laneH + lift, round.blockWidth, { fill: c.block, edge: c.blockEdge, glow: c.glow, alpha: appear, notch: true });
    } else if (state === STATES.DROPPING && session.pending) {
      const t = Math.min(1, session.stateTime / TIMING.DROP_DURATION);
      const h = laneH + (round.row * BH - laneH) * easeInQuad(t);
      this.drawBlock(ctx, session.pending.x, h, session.pending.width, { fill: c.block, edge: c.blockEdge, glow: c.glow, notch: true });
    }

    if (this.missAnim && (state === STATES.FALLING || state === STATES.OVER)) {
      const m = this.missAnim;
      if (!session.paused) {
        m.t += dt;
        m.vh -= 2600 * dt;
        m.x += m.vx * dt;
        m.h += m.vh * dt;
        m.rot += m.vr * dt;
      }
      const alpha = Math.max(0, 1 - m.t / 1.1);
      if (alpha > 0) this.drawBlock(ctx, m.x, m.h, m.width, { fill: c.miss, edge: c.blockEdge, alpha, rot: m.rot });
    }
  }

  /** Main per-frame draw for an active or finished run. */
  render(session, dt) {
    const ctx = this.ctx;
    this.time += dt;
    if (!session.paused) {
      this.effects.update(dt);
      for (const [row, age] of this.landPulse) {
        if (age > 1) this.landPulse.delete(row);
        else this.landPulse.set(row, age + dt);
      }
    }

    if (session.round) {
      const targetCam = (session.round.row + 1) * BH;
      this.cameraH += (targetCam - this.cameraH) * (1 - Math.exp(-dt * 7));
    }

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawBackground(ctx);

    const shake = this.effects.shakeOffset();
    ctx.save();
    ctx.translate(shake.x, shake.y);
    this.drawTower(ctx, session.placed);
    if (session.round && session.state !== STATES.IDLE) {
      const missFlash = session.state === STATES.FALLING || session.state === STATES.OVER;
      this.drawTarget(ctx, session.round, missFlash);
      this.drawActiveBlock(ctx, session, session.paused ? 0 : dt);
    }
    this.effects.draw(ctx, this.view);
    ctx.restore();

    if (this.effects.flashAlpha > 0) {
      ctx.globalAlpha = this.effects.flashAlpha;
      ctx.fillStyle = this.effects.flashColor;
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.globalAlpha = 1;
    }
  }

  /** Calm animated backdrop for the menu: a short tower and a gliding block. */
  /** @param topLimit screen y (px) the demo must stay below, e.g. the logo's bottom edge. */
  renderAmbient(dt, topLimit = 0) {
    const ctx = this.ctx;
    const c = this.theme.colors;
    this.time += dt;
    // Lift the plinth to ~52% of the height so the demo sits between the logo and the score.
    const menuCam = -(this.h * (ANCHOR - 0.52)) / this.view.scale;
    this.cameraH += (menuCam - this.cameraH) * (1 - Math.exp(-dt * 3));
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawBackground(ctx);
    // Show as many demo blocks as fit under the logo (short screens get fewer).
    const rowPx = BH * this.view.scale;
    const plinthY = this.h * 0.52;
    const fit = Math.floor((plinthY - topLimit - 12) / rowPx - (LANE_LIFT + 1));
    const demo = AMBIENT_TOWER.slice(0, Math.max(0, Math.min(AMBIENT_TOWER.length, fit)));
    this.drawTower(ctx, demo);
    const x = 500 + Math.sin(this.time * 0.9) * 300;
    this.drawBlock(ctx, x, (demo.length + LANE_LIFT) * BH, 200, { fill: c.block, edge: c.blockEdge, glow: c.glow, alpha: 0.9, notch: true });
  }
}

const AMBIENT_TOWER = [500, 560, 470, 530].map((x, row) => ({ x, row, width: 240 - row * 8, grade: row % 3 === 0 ? 'perfect' : 'great' }));

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((ch) => ch + ch).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hexA(hex, a) {
  if (!hex.startsWith('#')) return hex;
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function mix(hexA1, hexB, t) {
  if (!hexA1.startsWith('#') || !hexB.startsWith('#')) return hexA1;
  const a = hexToRgb(hexA1);
  const b = hexToRgb(hexB);
  const m = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${m[0]},${m[1]},${m[2]})`;
}
