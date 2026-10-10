/**
 * Pooled particle + ring effects in world space (x in world units, h = height
 * in world units, upward). A fixed-size pool means zero allocations per frame.
 */
const GRAVITY = 1400; // world units / s^2 (pulls particles down, i.e. h decreases)

export class Effects {
  constructor(maxParticles = 160, maxRings = 6) {
    this.particles = Array.from({ length: maxParticles }, () => ({ alive: false }));
    this.rings = Array.from({ length: maxRings }, () => ({ alive: false }));
    this.shakeTime = 0;
    this.shakeIntensity = 0;
    this.flashAlpha = 0;
    this.flashColor = '#ffffff';
    this.shakeEnabled = true;
  }

  clear() {
    for (const p of this.particles) p.alive = false;
    for (const r of this.rings) r.alive = false;
    this.shakeTime = 0;
    this.flashAlpha = 0;
  }

  burst(x, h, { count = 16, colors = ['#fff'], speed = 520, life = 0.7, size = 9, spreadUp = true } = {}) {
    let spawned = 0;
    for (const p of this.particles) {
      if (spawned >= count) break;
      if (p.alive) continue;
      const angle = spreadUp ? Math.PI * (0.08 + Math.random() * 0.84) : Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.65);
      p.alive = true;
      p.x = x + (Math.random() - 0.5) * 40;
      p.h = h;
      p.vx = Math.cos(angle) * v;
      p.vh = Math.sin(angle) * v;
      p.life = p.maxLife = life * (0.6 + Math.random() * 0.4);
      p.size = size * (0.5 + Math.random() * 0.7);
      p.color = colors[(Math.random() * colors.length) | 0];
      spawned++;
    }
  }

  ring(x, h, color, maxRadius = 260, life = 0.5) {
    const r = this.rings.find((ring) => !ring.alive) || this.rings[0];
    Object.assign(r, { alive: true, x, h, color, maxRadius, life, maxLife: life });
  }

  shake(intensity = 10, duration = 0.25) {
    if (!this.shakeEnabled) return;
    this.shakeIntensity = Math.max(this.shakeIntensity * (this.shakeTime > 0 ? 1 : 0), intensity);
    this.shakeTime = Math.max(this.shakeTime, duration);
    this.shakeDuration = Math.max(this.shakeTime, duration);
  }

  flash(color, alpha = 0.25) {
    this.flashColor = color;
    this.flashAlpha = Math.max(this.flashAlpha, alpha);
  }

  update(dt) {
    for (const p of this.particles) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        continue;
      }
      p.vh -= GRAVITY * dt;
      p.vx *= 1 - 1.5 * dt;
      p.x += p.vx * dt;
      p.h += p.vh * dt;
    }
    for (const r of this.rings) {
      if (!r.alive) continue;
      r.life -= dt;
      if (r.life <= 0) r.alive = false;
    }
    this.shakeTime = Math.max(0, this.shakeTime - dt);
    this.flashAlpha = Math.max(0, this.flashAlpha - dt * 1.6);
  }

  /** Screen-space shake offset in pixels. */
  shakeOffset() {
    if (this.shakeTime <= 0) return { x: 0, y: 0 };
    const k = this.shakeTime / (this.shakeDuration || 1);
    const m = this.shakeIntensity * k;
    return { x: (Math.random() - 0.5) * 2 * m, y: (Math.random() - 0.5) * 2 * m };
  }

  draw(ctx, view) {
    for (const r of this.rings) {
      if (!r.alive) continue;
      const t = 1 - r.life / r.maxLife;
      const radius = r.maxRadius * (0.2 + 0.8 * (1 - (1 - t) * (1 - t))) * view.scale;
      ctx.globalAlpha = (1 - t) * 0.8;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = Math.max(1, 6 * (1 - t) * view.scale * 2);
      ctx.beginPath();
      ctx.ellipse(view.sx(r.x), view.sy(r.h), radius, radius * 0.35, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const p of this.particles) {
      if (!p.alive) continue;
      const k = p.life / p.maxLife;
      const s = Math.max(1, p.size * view.scale * (0.4 + 0.6 * k));
      ctx.globalAlpha = Math.min(1, k * 1.4);
      ctx.fillStyle = p.color;
      ctx.fillRect(view.sx(p.x) - s / 2, view.sy(p.h) - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  }
}
