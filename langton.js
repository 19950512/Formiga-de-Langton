(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Langton = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // invariant: direction index 0..3 = N, E, S, W; y grows downward (screen coordinates).
  const DX = [0, 1, 0, -1];
  const DY = [-1, 0, 1, 0];
  const TURNS = { R: 1, L: 3, N: 0, U: 2 };

  // why: numeric keys are much faster than "x,y" strings in a Map that is hit every step.
  // invariant: |x|, |y| < OFFSET keeps the key below 2^53 (safe integer).
  const OFFSET = 2 ** 24;
  const SPAN = 2 ** 25;
  const key = (x, y) => (x + OFFSET) * SPAN + (y + OFFSET);

  // invariant: HIST is a power of two so `step & MASK` is the ring index.
  const HIST = 16384;
  const MASK = HIST - 1;

  function parseRule(rule) {
    const r = String(rule).trim().toUpperCase();
    if (!/^[LRNU]{2,}$/.test(r)) {
      throw new Error('Regra inválida: use 2 ou mais letras entre L, R, N e U (ex.: RL).');
    }
    return Array.from(r, (c) => TURNS[c]);
  }

  class Ant {
    constructor(rule = 'RL') {
      this.rule = String(rule).trim().toUpperCase();
      this.turns = parseRule(rule);
      this.reset();
    }

    reset() {
      // invariant: a cell absent from the map has color 0 (white); color 0 is never stored.
      this.cells = new Map();
      this.x = 0;
      this.y = 0;
      this.dir = 0;
      this.steps = 0;
      this.minX = 0;
      this.maxX = 0;
      this.minY = 0;
      this.maxY = 0;
      this.hist = new Uint8Array(HIST);
      this.hx = new Int32Array(HIST);
      this.hy = new Int32Array(HIST);
      this.highWater = 0;
    }

    colorAt(x, y) {
      return this.cells.get(key(x, y)) || 0;
    }

    setCell(x, y, color) {
      const c = ((color % this.turns.length) + this.turns.length) % this.turns.length;
      if (c === 0) this.cells.delete(key(x, y));
      else this.cells.set(key(x, y), c);
      this.grow(x, y);
    }

    grow(x, y) {
      if (x < this.minX) this.minX = x;
      else if (x > this.maxX) this.maxX = x;
      if (y < this.minY) this.minY = y;
      else if (y > this.maxY) this.maxY = y;
    }

    step() {
      const k = key(this.x, this.y);
      const color = this.cells.get(k) || 0;
      this.dir = (this.dir + this.turns[color]) & 3;
      const next = (color + 1) % this.turns.length;
      if (next === 0) this.cells.delete(k);
      else this.cells.set(k, next);
      this.x += DX[this.dir];
      this.y += DY[this.dir];
      const i = this.steps & MASK;
      this.hist[i] = color;
      this.hx[i] = this.x;
      this.hy[i] = this.y;
      this.steps++;
      if (this.steps > this.highWater) this.highWater = this.steps;
      this.grow(this.x, this.y);
      return color;
    }

    // why: the rule is a bijection on (grid, position, direction), so every step can be undone exactly.
    back() {
      if (this.steps === 0) return false;
      const px = this.x - DX[this.dir];
      const py = this.y - DY[this.dir];
      const k = key(px, py);
      const n = this.turns.length;
      const prev = ((this.cells.get(k) || 0) - 1 + n) % n;
      if (prev === 0) this.cells.delete(k);
      else this.cells.set(k, prev);
      this.dir = (this.dir - this.turns[prev]) & 3;
      this.x = px;
      this.y = py;
      this.steps--;
      return true;
    }

    run(n) {
      for (let i = 0; i < n; i++) this.step();
    }

    runBack(n) {
      let done = 0;
      while (done < n && this.back()) done++;
      return done;
    }

    forEachCell(fn) {
      for (const [k, color] of this.cells) {
        const x = Math.floor(k / SPAN) - OFFSET;
        const y = (k % SPAN) - OFFSET;
        fn(x, y, color);
      }
    }

    // Looks for a cycle in the recent motion: the colors read in the last
    // max(3p, minWindow) steps repeat with period p and the ant drifted (a "highway").
    detectPeriod(maxPeriod = 2000, minWindow = 300) {
      // hazard: after back() the ring may hold records of undone steps; only steps
      // within HIST of the furthest point reached are trustworthy.
      const floor = Math.max(0, this.highWater - HIST);
      const s = this.steps;
      for (let p = 1; p <= maxPeriod; p++) {
        const span = Math.max(3 * p, minWindow);
        if (s - span - p < floor) break;
        let ok = true;
        for (let t = s - 1; t >= s - span; t--) {
          if (this.hist[t & MASK] !== this.hist[(t - p) & MASK]) { ok = false; break; }
        }
        if (!ok) continue;
        const ref = (s - 1 - p) & MASK;
        const dx = this.x - this.hx[ref];
        const dy = this.y - this.hy[ref];
        if (dx === 0 && dy === 0) continue;
        let start = s - span;
        while (start - 1 - p >= floor && this.hist[(start - 1) & MASK] === this.hist[(start - 1 - p) & MASK]) start--;
        // invariant: step `start` is the first that matches the one p earlier, so the cycle began at start - p.
        return { period: p, dx, dy, start: start - p };
      }
      return null;
    }
  }

  return { Ant, parseRule, DX, DY };
});
